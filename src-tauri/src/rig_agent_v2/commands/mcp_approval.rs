use crate::rig_agent_v2::{mcp_approval::*, mcp_approval_manager::McpApprovalManager};
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

    let approval_manager = McpApprovalManager::new(&app_data_dir)
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
    conversation_id: Option<String>,
) -> Result<Vec<ToolApprovalRequest>, String> {
    let approval_manager = app.state::<Arc<McpApprovalManager>>().inner().clone();

    let requests = approval_manager
        .get_all_pending_requests(conversation_id.as_deref())
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

    let response = ToolApprovalResponse {
        request_id: request_id.clone(),
        status: ApprovalStatus::Approved,
        user_feedback,
        responded_at: chrono::Utc::now().to_rfc3339(),
    };

    approval_manager
        .handle_approval_response(&request_id, response)
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

    let response = ToolApprovalResponse {
        request_id: request_id.clone(),
        status: ApprovalStatus::Rejected,
        user_feedback,
        responded_at: chrono::Utc::now().to_rfc3339(),
    };

    approval_manager
        .handle_approval_response(&request_id, response)
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

    let result = approval_manager
        .toggle_server(&server_name)
        .await
        .map_err(|e| e.to_string())?;

    Ok(result)
}

/// Get tool approval status
#[tauri::command]
#[specta::specta]
pub async fn get_tool_approval_status(
    app: AppHandle,
    server_name: String,
    tool_name: String,
) -> Result<(bool, bool, bool), String> {
    let approval_manager = app.state::<Arc<McpApprovalManager>>().inner().clone();

    let status = approval_manager
        .get_tool_approval_status(&server_name, tool_name.as_str())
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

/// Execute approved MCP tool
#[tauri::command]
#[specta::specta]
pub async fn execute_approved_mcp_tool(
    mcp_state: State<'_, crate::mcp::state::McpState>,
    tool_name: String,
    arguments: Option<serde_json::Value>,
) -> Result<serde_json::Value, String> {
    use crate::rig_agent_v2::tools::mcp_adapter::McpToolAdapter;
    use std::sync::Arc;

    let mcp_state_arc = Arc::new(mcp_state.inner().clone());

    let adapter = McpToolAdapter::new(mcp_state_arc);

    adapter.execute_approved_tool(&tool_name, arguments).await
}
