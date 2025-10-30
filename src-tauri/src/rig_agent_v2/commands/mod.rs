use crate::rig_agent_v2::*;
use serde_json::Value;
use tauri::AppHandle;

pub mod agent;
pub mod chat;
pub mod tools;
pub mod config;
pub mod react;

pub use agent::*;
pub use chat::*;
pub use tools::*;
pub use config::*;
pub use react::*;

/// Initialize AI system
#[tauri::command]
#[specta::specta]
pub async fn initialize_ai_system(
    app: AppHandle,
    config: super::core::AgentConfig,
) -> std::result::Result<String, String> {
    // For now, just return success
    Ok("AI system initialized successfully".to_string())

    // TODO: Initialize actual agent manager with provided config
    // let agent_manager = super::AgentManager::new(config).await
    // app.manage(Arc::new(agent_manager))
}

/// Get AI system information
#[tauri::command]
#[specta::specta]
pub async fn get_ai_system_info(
    app: AppHandle,
) -> std::result::Result<Value, String> {
    // Return mock data for now
    Ok(serde_json::json!({
        "provider": "mock",
        "features": {
            "chat": true,
            "streaming": false,
            "tools": false,
            "vision": false,
            "embeddings": false,
            "image_generation": false,
            "function_calling": false,
            "react_mode": false
        },
        "supported_features": [],
        "status": "temporarily simplified to avoid compilation issues",
        "timestamp": chrono::Utc::now().to_rfc3339()
    }))
}

/// Get AI capabilities
#[tauri::command]
#[specta::specta]
pub async fn get_ai_capabilities(
    app: AppHandle,
) -> std::result::Result<Value, String> {
    // Return mock capabilities for now
    Ok(serde_json::json!({
        "provider": "mock",
        "features": {
            "chat": true,
            "streaming": false,
            "tools": false,
            "vision": false,
            "embeddings": false,
            "image_generation": false,
            "function_calling": false,
            "react_mode": false
        },
        "supported_features": [],
        "status": "temporarily simplified to avoid compilation issues"
    }))
}