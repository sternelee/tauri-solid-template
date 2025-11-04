use crate::rig_agent::{mcp_approval::*, mcp_approval_manager::{McpApprovalManager, ToolApprovalStatus}};
use std::sync::Arc;
use tauri::{AppHandle, Manager, State};

/// Initialize MCP approval manager
#[tauri::command]
#[specta::specta]
pub async fn initialize_mcp_approval_manager(app: AppHandle) -> Result<String, String> {
    // Get app data directory
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data directory: {}", e))?;

    let approval_manager = McpApprovalManager::new(app_data_dir)
        .await
        .map_err(|e| format!("Failed to initialize MCP approval manager: {}", e))?;

    // Store the approval manager in app state
    app.manage(Arc::new(approval_manager));

    Ok("MCP approval manager initialized successfully".to_string())
}

/// Get pending approval requests
#[tauri::command]
#[specta::specta]
pub async fn get_pending_approval_requests(
    app: AppHandle,
) -> Result<Vec<ToolApprovalRequest>, String> {
    let approval_manager = app.state::<Arc<McpApprovalManager>>().inner().clone();

    let requests = approval_manager
        .get_pending_requests()
        .await;

    Ok(requests)
}

/// Approve a tool request
#[tauri::command]
#[specta::specta]
pub async fn approve_tool_request(
    app: AppHandle,
    request_id: String,
    user_feedback: Option<String>,
) -> Result<String, String> {
    let approval_manager = app.state::<Arc<McpApprovalManager>>().inner().clone();

    let _response = approval_manager
        .approve_request(&request_id, user_feedback)
        .await
        .map_err(|e| format!("Failed to approve tool request: {}", e))?;

    Ok("Tool request approved successfully".to_string())
}

/// Reject a tool request
#[tauri::command]
#[specta::specta]
pub async fn reject_tool_request(
    app: AppHandle,
    request_id: String,
    user_feedback: Option<String>,
) -> Result<String, String> {
    let approval_manager = app.state::<Arc<McpApprovalManager>>().inner().clone();

    let _response = approval_manager
        .reject_request(&request_id, user_feedback)
        .await
        .map_err(|e| format!("Failed to reject tool request: {}", e))?;

    Ok("Tool request rejected successfully".to_string())
}

/// Get MCP approval configuration
#[tauri::command]
#[specta::specta]
pub async fn get_mcp_approval_config(app: AppHandle) -> Result<McpApprovalConfig, String> {
    let approval_manager = app.state::<Arc<McpApprovalManager>>().inner().clone();

    let config = approval_manager.get_config().await;
    Ok(config)
}

/// Update tool auto-approve setting
#[tauri::command]
#[specta::specta]
pub async fn toggle_tool_auto_approve(
    app: AppHandle,
    server_name: String,
    tool_name: String,
) -> Result<bool, String> {
    let approval_manager = app.state::<Arc<McpApprovalManager>>().inner().clone();

    let result = approval_manager
        .toggle_tool_auto_approve(&server_name, &tool_name)
        .await
        .map_err(|e| e.to_string())?;

    Ok(result)
}

/// Toggle MCP server enabled/disabled
#[tauri::command]
#[specta::specta]
pub async fn toggle_mcp_server(app: AppHandle, server_name: String) -> Result<bool, String> {
    let approval_manager = app.state::<Arc<McpApprovalManager>>().inner().clone();

    let config = approval_manager.get_config().await;
    let mut new_config = config;

    // Update server disabled status
    if let Some(server_config) = new_config.mcp_servers.get_mut(&server_name) {
        server_config.disabled = !server_config.disabled;
    } else {
        // Create new server config
        new_config.add_server_config(
            server_name.clone(),
            crate::rig_agent::mcp_approval::McpServerConfig {
                auto_approve: vec![],
                disabled: true,
                args: None,
                command: None,
                url: None,
                timeout: Some(600),
            },
        );
    }

    approval_manager
        .update_config(new_config)
        .await
        .map_err(|e| e.to_string())?;

    let updated_config = approval_manager.get_config().await;
    let is_disabled = updated_config
        .get_server_config(&server_name)
        .map(|c| c.disabled)
        .unwrap_or(true);

    Ok(!is_disabled)
}

/// Get tool approval status
#[tauri::command]
#[specta::specta]
pub async fn get_tool_approval_status(
    app: AppHandle,
    server_name: String,
    tool_name: String,
) -> Result<ToolApprovalStatus, String> {
    let approval_manager = app.state::<Arc<McpApprovalManager>>().inner().clone();

    let status = approval_manager
        .get_tool_approval_status(&server_name, &tool_name)
        .await;
    Ok(status)
}

/// Cleanup expired approval requests
#[tauri::command]
#[specta::specta]
pub async fn cleanup_expired_approval_requests(app: AppHandle) -> Result<usize, String> {
    let approval_manager = app.state::<Arc<McpApprovalManager>>().inner().clone();

    let cleaned_count = approval_manager.cleanup_expired_requests().await;
    Ok(cleaned_count)
}
