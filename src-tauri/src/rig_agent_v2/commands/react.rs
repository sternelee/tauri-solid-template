use crate::rig_agent_v2::capabilities::streaming::*;
use crate::rig_agent_v2::core::*;
use tauri::{AppHandle, Emitter, Manager};

/// Start ReAct chat
#[tauri::command]
#[specta::specta]
pub async fn start_react_chat(
    app: AppHandle,
    message: String,
    conversation_id: Option<String>,
    max_iterations: Option<u32>,
    enable_tools: Option<bool>,
    window: tauri::Window,
) -> std::result::Result<String, String> {
    // Get the agent manager from app state
    let manager: std::sync::Arc<crate::rig_agent_v2::AgentManager> = app
        .state::<std::sync::Arc<crate::rig_agent_v2::AgentManager>>()
        .inner()
        .clone();

    // Create conversation
    let conversation_id = conversation_id.unwrap_or_else(|| uuid::Uuid::new_v4().to_string());
    let conversation = crate::rig_agent_v2::core::types::Conversation {
        id: conversation_id.clone(),
        title: Some(format!(
            "ReAct Chat: {}",
            &message[..std::cmp::min(30, message.len())]
        )),
        messages: vec![],
        created_at: chrono::Utc::now().to_rfc3339(),
        updated_at: chrono::Utc::now().to_rfc3339(),
        metadata: std::collections::HashMap::new(),
    };

    // Create ReAct configuration
    let mut react_config = ReActConfig::default();
    if let Some(max_iter) = max_iterations {
        react_config.max_iterations = max_iter;
    }
    if let Some(enable) = enable_tools {
        react_config.enable_tool_use = enable;
    }

    // Get available tools
    let available_tools = manager.tools().list_tools();
    react_config.available_tools = available_tools.clone();

    // Create ReAct capability
    let react_capability = ReActCapability::new(manager).with_config(react_config);

    // Start ReAct streaming
    let stream = react_capability
        .chat_react(&message, conversation, Some(available_tools))
        .await
        .map_err(|e| format!("Failed to start ReAct chat: {}", e))?;

    // Start streaming in a background task and emit events to frontend
    let window_clone = window.clone();
    tokio::spawn(async move {
        use futures::StreamExt;
        futures::pin_mut!(stream);

        while let Some(event_result) = stream.next().await {
            match event_result {
                Ok(event) => {
                    let json = serde_json::to_string(&event).unwrap_or_default();
                    // Emit event to frontend
                    if let Err(e) = window_clone.emit("react-stream-event", &event) {
                        eprintln!("Failed to emit ReAct event: {}", e);
                    }
                }
                Err(e) => {
                    let error_event = crate::rig_agent_v2::core::types::StreamEvent::Error {
                        error: e.to_string(),
                        timestamp: chrono::Utc::now().to_rfc3339(),
                    };
                    if let Err(err) = window_clone.emit("react-stream-error", &error_event) {
                        eprintln!("Failed to emit ReAct error: {}", err);
                    }
                    break;
                }
            }
        }
    });

    Ok("ReAct chat started".to_string())
}

/// Get ReAct configuration
#[tauri::command]
#[specta::specta]
pub async fn get_react_config(app: AppHandle) -> std::result::Result<ReActConfig, String> {
    // Return default configuration for now
    // In a real implementation, this could be stored and retrieved from a database
    Ok(ReActConfig::default())
}

/// Update ReAct configuration
#[tauri::command]
#[specta::specta]
pub async fn update_react_config(
    app: AppHandle,
    config: ReActConfig,
) -> std::result::Result<String, String> {
    // In a real implementation, this would persist the configuration
    // For now, just return success
    Ok("ReAct configuration updated".to_string())
}

/// Execute a single ReAct step (for debugging and testing)
#[tauri::command]
#[specta::specta]
pub async fn execute_react_step(
    app: AppHandle,
    step_type: String,
    context: String,
    state: Option<ReActState>,
) -> std::result::Result<serde_json::Value, String> {
    // Get the agent manager from app state
    let manager: std::sync::Arc<crate::rig_agent_v2::AgentManager> = app
        .state::<std::sync::Arc<crate::rig_agent_v2::AgentManager>>()
        .inner()
        .clone();

    // This is a utility function for debugging ReAct steps
    // It allows testing individual steps of the ReAct process
    let chat_message = crate::rig_agent_v2::core::types::ChatMessage::new(
        crate::rig_agent_v2::core::types::MessageRole::User,
        context,
    );

    let request = crate::rig_agent_v2::core::types::ChatRequest::new(
        format!("react_step_{}", step_type),
        chat_message,
    );

    match manager.agent().chat(request).await {
        Ok(response) => {
            let result = serde_json::json!({
                "step_type": step_type,
                "response": response.message.text_content().unwrap_or_default(),
                "timestamp": chrono::Utc::now().to_rfc3339()
            });
            Ok(result)
        }
        Err(e) => Err(format!(
            "Failed to execute ReAct step '{}': {}",
            step_type, e
        )),
    }
}

