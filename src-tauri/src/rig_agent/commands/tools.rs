use tauri::{AppHandle, Manager};

/// Execute a tool
#[tauri::command]
#[specta::specta]
pub async fn execute_tool(
    app: AppHandle,
    tool_name: String,
    parameters: serde_json::Value,
) -> std::result::Result<serde_json::Value, String> {
    // Get the agent manager from app state
    let manager: std::sync::Arc<crate::rig_agent::AgentManager> = app
        .state::<std::sync::Arc<crate::rig_agent::AgentManager>>()
        .inner()
        .clone();

    // Execute the tool
    manager
        .tools()
        .execute(&tool_name, parameters)
        .map_err(|e| format!("Failed to execute tool '{}': {}", tool_name, e))
}

/// Get available tools
#[tauri::command]
#[specta::specta]
pub async fn get_available_tools(app: AppHandle) -> std::result::Result<Vec<String>, String> {
    // Get the agent manager from app state
    let manager: std::sync::Arc<crate::rig_agent::AgentManager> = app
        .state::<std::sync::Arc<crate::rig_agent::AgentManager>>()
        .inner()
        .clone();

    // Get available tools
    let tools = manager.tools().list_tools();
    Ok(tools)
}

