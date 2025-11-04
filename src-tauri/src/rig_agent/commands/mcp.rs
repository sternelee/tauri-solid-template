use crate::mcp::state::McpState;
use crate::rig_agent::tools::mcp_adapter::{create_mcp_tool_functions, McpToolAdapter};
use serde_json::Value;
use std::sync::Arc;
use tauri::{AppHandle, Emitter, State};

/// Initialize MCP tools in rig_agent
#[tauri::command]
#[specta::specta]
pub async fn initialize_mcp_tools(
    _app: AppHandle,
    mcp_state: State<'_, McpState>,
) -> Result<String, String> {
    // Create MCP tool adapter to verify MCP integration is working
    let mcp_state_arc = Arc::new(mcp_state.inner().clone());
    let adapter = McpToolAdapter::new(mcp_state_arc);

    // Try to list tools to verify MCP connection
    let tools = adapter.list_tools().await;

    if tools.is_empty() {
        log::info!("MCP tools initialized - no tools available yet (servers may not be connected)");
        return Ok("MCP tools initialized successfully - no active servers".to_string());
    }

    log::info!(
        "MCP tools initialized successfully with {} tools available",
        tools.len()
    );

    // Create tool functions for rig_agent integration
    let _tool_functions = create_mcp_tool_functions(Arc::new(mcp_state.inner().clone()));

    Ok(format!(
        "MCP tools initialized successfully with {} tools",
        tools.len()
    ))
}

/// List available MCP tools
#[tauri::command]
#[specta::specta]
pub async fn list_mcp_tools(
    _app: AppHandle,
    mcp_state: State<'_, McpState>,
) -> Result<Value, String> {
    let mcp_state_arc = Arc::new(mcp_state.inner().clone());
    let adapter = McpToolAdapter::new(mcp_state_arc);

    let tools = adapter.list_tools().await;
    let total_count = tools.len();

    // Get active servers for additional context
    let active_servers = adapter.get_active_servers().await;

    Ok(serde_json::json!({
        "mcp_tools": tools,
        "total_count": total_count,
        "active_servers": active_servers,
        "message": if total_count == 0 {
            "No MCP tools available - make sure MCP servers are connected"
        } else {
            "MCP tools listed successfully"
        }
    }))
}

/// Refresh MCP tools (called when MCP servers change)
#[tauri::command]
#[specta::specta]
pub async fn refresh_mcp_tools_command(
    app: AppHandle,
    mcp_state: State<'_, McpState>,
) -> Result<String, String> {
    log::info!("Refreshing MCP tools in rig_agent");

    // Get current server status
    let mcp_state_arc = Arc::new(mcp_state.inner().clone());
    let adapter = McpToolAdapter::new(mcp_state_arc);

    let active_servers = adapter.get_active_servers().await;
    let tools_count = adapter.list_tools().await.len();

    // Emit event to notify frontend about MCP tools refresh
    if let Err(e) = app.emit(
        "rig_agent:mcp_tools_refreshed",
        serde_json::json!({
            "active_servers": active_servers,
            "tools_count": tools_count,
            "timestamp": chrono::Utc::now().to_rfc3339()
        }),
    ) {
        log::warn!("Failed to emit MCP tools refresh event: {}", e);
    }

    Ok(format!(
        "MCP tools refreshed - {} tools from {} active servers",
        tools_count,
        active_servers.len()
    ))
}

/// Get MCP servers status
#[tauri::command]
#[specta::specta]
pub async fn get_mcp_servers_status(mcp_state: State<'_, McpState>) -> Result<Value, String> {
    let active_servers = mcp_state.active_servers_list.lock().await;
    let connected = mcp_state.successfully_connected.lock().await;
    let restart_counts = mcp_state.restart_counts.lock().await;

    let servers_status: Vec<Value> = active_servers
        .keys()
        .map(|server_name| {
            serde_json::json!({
                "name": server_name,
                "active": active_servers.get(server_name).unwrap_or(&false),
                "connected": connected.get(server_name).unwrap_or(&false),
                "restart_count": restart_counts.get(server_name).unwrap_or(&0)
            })
        })
        .collect();

    Ok(serde_json::json!({
        "servers": servers_status,
        "total_count": servers_status.len()
    }))
}
