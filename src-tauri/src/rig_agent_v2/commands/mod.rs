use crate::rig_agent_v2::*;
use serde_json::Value;
use tauri::{AppHandle, Manager};

pub mod agent;
pub mod chat;
pub mod tools;
pub mod config;
pub mod react;
pub mod mcp;
pub mod mcp_approval;

pub use agent::*;
pub use chat::*;
pub use tools::*;
pub use config::*;
pub use react::*;
pub use mcp::*;
pub use mcp_approval::*;

/// Initialize AI system
#[tauri::command]
#[specta::specta]
pub async fn initialize_ai_system(
    app: AppHandle,
    config: super::core::AgentConfig,
) -> std::result::Result<String, String> {
    // Initialize actual agent manager with provided config
    let config_clone = config.clone();
    match super::AgentManager::new(config).await {
        Ok(agent_manager) => {
            // Store the agent manager in app state
            app.manage(std::sync::Arc::new(agent_manager));

            log::info!("AI system initialized successfully with provider: {:?}", config_clone.provider);
            Ok("AI system initialized successfully".to_string())
        }
        Err(e) => {
            log::error!("Failed to initialize AI system: {}", e);
            Err(format!("Failed to initialize AI system: {}", e))
        }
    }
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
            "embeddings": true,
            "image_generation": true,
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
            "embeddings": true,
            "image_generation": true,
            "function_calling": false,
            "react_mode": false
        },
        "supported_features": [],
        "status": "temporarily simplified to avoid compilation issues"
    }))
}