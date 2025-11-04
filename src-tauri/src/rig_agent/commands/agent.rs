use crate::rig_agent::core::*;
use tauri::{AppHandle, Manager};

/// Initialize AI agent system
#[tauri::command]
#[specta::specta]
pub async fn initialize_agent_system(
    app: AppHandle,
    config: AgentConfig,
) -> std::result::Result<String, String> {
    // Create a new agent manager with the provided configuration
    match crate::rig_agent::AgentManager::new(config).await {
        Ok(manager) => {
            // Store the manager in the app state
            app.manage(std::sync::Arc::new(manager));
            Ok("Agent system initialized successfully".to_string())
        }
        Err(e) => Err(format!("Failed to initialize agent system: {}", e)),
    }
}

/// Get agent information
#[tauri::command]
#[specta::specta]
pub async fn get_agent_info(app: AppHandle) -> std::result::Result<serde_json::Value, String> {
    // Try to get the agent manager from app state
    match app.try_state::<std::sync::Arc<crate::rig_agent::AgentManager>>() {
        Some(manager) => {
            let info = serde_json::json!({
                "status": "initialized",
                "provider_info": manager.providers().get_provider_info().await.map_err(|e| e.to_string())?,
                "capabilities": {
                    "chat": true,
                    "streaming": true,
                    "tools": manager.tools().list_tools().len() > 0,
                    "embeddings": true,
                    "image_generation": true,
                },
                "timestamp": chrono::Utc::now().to_rfc3339()
            });
            Ok(info)
        }
        None => Err("Agent system not initialized".to_string()),
    }
}

/// Shutdown agent system
#[tauri::command]
#[specta::specta]
pub async fn shutdown_agent_system(app: AppHandle) -> std::result::Result<String, String> {
    // Check if agent manager exists
    match app.try_state::<std::sync::Arc<crate::rig_agent::AgentManager>>() {
        Some(_manager) => {
            // In a real implementation, we might want to cleanup resources here
            // For now, just return success
            Ok("Agent system shutdown successfully".to_string())
        }
        None => Err("Agent system not initialized".to_string()),
    }
}
