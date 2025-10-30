use tauri::{AppHandle, Manager};
use crate::rig_agent_v2::core::*;

/// Get agent configuration
#[tauri::command]
#[specta::specta]
pub async fn get_agent_config(
    app: AppHandle,
) -> std::result::Result<AgentConfig, String> {
    // Get the agent manager from app state
    let manager: std::sync::Arc<crate::rig_agent_v2::AgentManager> = app.state::<std::sync::Arc<crate::rig_agent_v2::AgentManager>>().inner().clone();

    // Get the current configuration
    Ok(manager.get_config().await)
}

/// Update agent configuration
#[tauri::command]
#[specta::specta]
pub async fn update_agent_config(
    app: AppHandle,
    config: AgentConfig,
) -> std::result::Result<String, String> {
    // Get the agent manager from app state
    let manager: std::sync::Arc<crate::rig_agent_v2::AgentManager> = app.state::<std::sync::Arc<crate::rig_agent_v2::AgentManager>>().inner().clone();

    // Update the configuration
    manager.update_config(config).await
        .map_err(|e| format!("Failed to update agent config: {}", e))?;

    Ok("Configuration updated successfully".to_string())
}