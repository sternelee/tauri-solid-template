use serde_json::{Map, Value};
use std::sync::Arc;
use tauri::{AppHandle, Emitter, Manager, State};
use tokio::sync::oneshot;

use super::client::{format_tool_name, McpClientManager, McpTool};
use super::helpers::{restart_active_mcp_servers, start_mcp_server_with_restart, stop_mcp_servers};
use super::models::{McpServerConfig, ToolWithServer};
use super::state::McpState;
use std::fs;

// Simple CallToolResult for frontend compatibility
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, specta::Type)]
pub struct CallToolResult {
    pub content: Vec<Value>,
    pub is_error: bool,
    pub _meta: Option<Value>,
}

/// Activate an MCP server
#[tauri::command]
#[specta::specta]
pub async fn activate_mcp_server(
    app: AppHandle,
    state: State<'_, McpState>,
    name: String,
    config: Value,
) -> Result<(), String> {
    // Use the simplified start_mcp_server_with_restart
    start_mcp_server_with_restart(&app, Arc::new(state.inner().clone()), name, config, Some(3))
        .await
}

/// Deactivate an MCP server
#[tauri::command]
#[specta::specta]
pub async fn deactivate_mcp_server(state: State<'_, McpState>, name: String) -> Result<(), String> {
    log::info!("Deactivating MCP server: {}", name);

    // Remove from all state tracking
    {
        let mut active_servers = state.active_servers_list.lock().await;
        active_servers.remove(&name);
    }
    {
        let mut connected = state.successfully_connected.lock().await;
        connected.insert(name.clone(), false);
    }
    {
        let mut counts = state.restart_counts.lock().await;
        counts.remove(&name);
    }
    {
        let mut active_servers = state.active_servers.lock().await;
        active_servers.remove(&name);
    }

    log::info!(
        "Server {} stopped successfully and marked as deactivated.",
        name
    );
    Ok(())
}

/// Restart all MCP servers
#[tauri::command]
#[specta::specta]
pub async fn restart_mcp_servers(app: AppHandle, state: State<'_, McpState>) -> Result<(), String> {
    // Stop the servers
    stop_mcp_servers(Arc::new(state.inner().clone())).await?;

    // Restart only previously active servers
    restart_active_mcp_servers(&app, Arc::new(state.inner().clone())).await?;

    app.emit("mcp-update", "MCP servers updated")
        .map_err(|e| format!("Failed to emit event: {}", e))?;

    Ok(())
}

/// Reset MCP restart count for a specific server
#[tauri::command]
#[specta::specta]
pub async fn reset_mcp_restart_count(
    state: State<'_, McpState>,
    server_name: String,
) -> Result<(), String> {
    let mut counts = state.restart_counts.lock().await;

    let count = match counts.get_mut(&server_name) {
        Some(count) => count,
        None => return Ok(()), // Server not found, nothing to reset
    };

    let old_count = *count;
    *count = 0;
    log::info!(
        "MCP server {} restart count reset from {} to 0.",
        server_name,
        old_count
    );
    Ok(())
}

/// Get list of connected MCP servers
#[tauri::command]
#[specta::specta]
pub async fn get_connected_servers(
    _app: AppHandle,
    state: State<'_, McpState>,
) -> Result<Vec<String>, String> {
    let active_servers = state.active_servers_list.lock().await;
    Ok(active_servers.keys().cloned().collect())
}

/// Get available tools from MCP servers
#[tauri::command]
#[specta::specta]
pub async fn get_tools(
    state: State<'_, McpState>,
    server_name: Option<String>,
) -> Result<Vec<ToolWithServer>, String> {
    let client_manager = state
        .client_manager
        .as_ref()
        .ok_or("MCP client manager not initialized")?;

    let mut all_tools: Vec<ToolWithServer> = Vec::new();

    if let Some(server_name) = server_name {
        // Get tools from a specific server
        match client_manager.list_tools(&server_name).await {
            Ok(tools) => {
                log::info!("Found {} tools from server {}", tools.len(), server_name);
                for tool in tools {
                    all_tools.push(ToolWithServer {
                        name: format_tool_name(&server_name, &tool),
                        description: tool.description,
                        input_schema: tool.input_schema.unwrap_or_else(|| serde_json::json!({})),
                        server: server_name.clone(),
                    });
                }
            }
            Err(e) => {
                log::error!("Failed to get tools from server {}: {}", server_name, e);
                return Err(format!(
                    "Failed to get tools from server {}: {}",
                    server_name, e
                ));
            }
        }
    } else {
        // Get tools from all servers
        match client_manager.get_all_tools().await {
            Ok(server_tools) => {
                for (srv_name, tools) in server_tools {
                    log::info!("Found {} tools from server {}", tools.len(), srv_name);
                    for tool in tools {
                        all_tools.push(ToolWithServer {
                            name: format_tool_name(&srv_name, &tool),
                            description: tool.description,
                            input_schema: tool
                                .input_schema
                                .unwrap_or_else(|| serde_json::json!({})),
                            server: srv_name.clone(),
                        });
                    }
                }
            }
            Err(e) => {
                log::error!("Failed to get tools from all servers: {}", e);
                return Err(format!("Failed to get tools: {}", e));
            }
        }
    }

    Ok(all_tools)
}

/// Call a tool on an MCP server
#[tauri::command]
#[specta::specta]
pub async fn call_tool(
    state: State<'_, McpState>,
    tool_name: String,
    arguments: Option<Map<String, Value>>,
    cancellation_token: Option<String>,
) -> Result<CallToolResult, String> {
    let client_manager = state
        .client_manager
        .as_ref()
        .ok_or("MCP client manager not initialized")?;

    // Set up cancellation if token is provided
    let (cancel_tx, _cancel_rx) = oneshot::channel::<()>();

    if let Some(token) = &cancellation_token {
        let mut cancellations = state.tool_call_cancellations.lock().await;
        cancellations.insert(token.clone(), cancel_tx);
    }

    // Parse tool name to get server name and actual tool name
    let (server_name, actual_tool_name) = super::client::parse_tool_name(&tool_name)
        .ok_or_else(|| format!("Invalid tool name format: {}", tool_name))?;

    log::info!(
        "Calling tool '{}' on server '{}'",
        actual_tool_name,
        server_name
    );

    // Convert arguments format
    let args = arguments.map(|args_map| {
        let mut obj = serde_json::Map::new();
        for (k, v) in args_map {
            obj.insert(k, v);
        }
        Value::Object(obj)
    });

    // Call the tool using the client manager
    let result = match client_manager
        .call_tool(&server_name, &actual_tool_name, args)
        .await
    {
        Ok(mcp_result) => {
            log::info!("Tool '{}' called successfully", tool_name);
            // Convert the result to the expected format
            let content = if mcp_result.is_array() {
                mcp_result.as_array().unwrap().clone()
            } else {
                vec![mcp_result]
            };
            CallToolResult {
                content,
                is_error: false,
                _meta: None,
            }
        }
        Err(e) => {
            log::error!("Failed to call tool '{}': {}", tool_name, e);
            CallToolResult {
                content: vec![Value::String(format!("Error: {}", e))],
                is_error: true,
                _meta: None,
            }
        }
    };

    // Clean up cancellation token
    if let Some(token) = &cancellation_token {
        let mut cancellations = state.tool_call_cancellations.lock().await;
        cancellations.remove(token);
    }

    Ok(result)
}

/// Cancel a running tool call
#[tauri::command]
#[specta::specta]
pub async fn cancel_tool_call(
    state: State<'_, McpState>,
    cancellation_token: String,
) -> Result<(), String> {
    let mut cancellations = state.tool_call_cancellations.lock().await;

    if let Some(_cancel_tx) = cancellations.remove(&cancellation_token) {
        // Send cancellation signal - ignore if receiver is already dropped
        log::info!("Tool call with token {} cancelled", cancellation_token);
        Ok(())
    } else {
        Err(format!(
            "Cancellation token {} not found",
            cancellation_token
        ))
    }
}

/// Get MCP configurations
#[tauri::command]
#[specta::specta]
pub async fn get_mcp_configs(app: AppHandle) -> Result<String, String> {
    let mut path = super::helpers::get_app_data_folder_path(&app);
    path.push("mcp_config.json");
    log::info!("Reading MCP configs from {:?}", path);

    // Create default empty config if file doesn't exist
    if !path.exists() {
        log::info!("mcp_config.json not found, creating default empty config");
        fs::write(&path, super::constants::DEFAULT_MCP_CONFIG)
            .map_err(|e| format!("Failed to create default MCP config: {}", e))?;
    }

    fs::read_to_string(path).map_err(|e| e.to_string())
}

/// Save MCP configurations
#[tauri::command]
#[specta::specta]
pub async fn save_mcp_configs(app: AppHandle, configs: String) -> Result<(), String> {
    let mut path = super::helpers::get_app_data_folder_path(&app);
    path.push("mcp_config.json");
    log::info!("Saving MCP configs to {:?}", path);

    fs::write(path, configs).map_err(|e| e.to_string())
}

/// Get MCP server status
#[tauri::command]
#[specta::specta]
pub async fn get_mcp_server_status(
    state: State<'_, McpState>,
) -> Result<Vec<McpServerStatus>, String> {
    let active_servers = state.active_servers_list.lock().await;
    let restart_counts = state.restart_counts.lock().await;
    let successfully_connected = state.successfully_connected.lock().await;

    let mut status_list = Vec::new();

    for (name, _is_active) in active_servers.iter() {
        let restart_count = restart_counts.get(name).unwrap_or(&0);
        let connected = successfully_connected.get(name).unwrap_or(&false);

        status_list.push(McpServerStatus {
            name: name.clone(),
            connected: *connected,
            active: *_is_active,
            restart_count: *restart_count,
        });
    }

    Ok(status_list)
}

/// MCP server status information
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, specta::Type)]
pub struct McpServerStatus {
    pub name: String,
    pub connected: bool,
    pub active: bool,
    pub restart_count: u32,
}

