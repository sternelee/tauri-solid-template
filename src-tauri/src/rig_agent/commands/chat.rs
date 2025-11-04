use crate::rig_agent::core::*;
use tauri::{AppHandle, Emitter, Manager};

/// Send chat message
#[tauri::command]
#[specta::specta]
pub async fn send_chat_message(
    app: AppHandle,
    message: String,
    conversation_id: Option<String>,
) -> std::result::Result<ChatResponse, String> {
    // Get the agent manager from app state
    let manager: std::sync::Arc<crate::rig_agent::AgentManager> = app
        .state::<std::sync::Arc<crate::rig_agent::AgentManager>>()
        .inner()
        .clone();

    // Create conversation and message
    let conversation_id = conversation_id.unwrap_or_else(|| uuid::Uuid::new_v4().to_string());
    let _conversation = Conversation {
        id: conversation_id.clone(),
        title: None,
        messages: vec![],
        created_at: chrono::Utc::now().to_rfc3339(),
        updated_at: chrono::Utc::now().to_rfc3339(),
        metadata: std::collections::HashMap::new(),
    };

    // Create chat message
    let chat_message = ChatMessage::new(MessageRole::User, message);

    // Create chat request
    let request = ChatRequest::new(conversation_id, chat_message);

    // Send the chat message
    let response: crate::rig_agent::core::ChatResponse = manager
        .agent()
        .chat(request)
        .await
        .map_err(|e| format!("Failed to send chat message: {}", e))?;

    Ok(response)
}

/// Start streaming chat
#[tauri::command]
#[specta::specta]
pub async fn start_chat_stream(
    app: AppHandle,
    message: String,
    conversation_id: Option<String>,
    window: tauri::Window,
) -> std::result::Result<String, String> {
    // Get the agent manager from app state
    let manager: std::sync::Arc<crate::rig_agent::AgentManager> = app
        .state::<std::sync::Arc<crate::rig_agent::AgentManager>>()
        .inner()
        .clone();

    // Create conversation and message
    let conversation_id = conversation_id.unwrap_or_else(|| uuid::Uuid::new_v4().to_string());
    let conversation = crate::rig_agent::core::types::Conversation {
        id: conversation_id.clone(),
        title: None,
        messages: vec![],
        created_at: chrono::Utc::now().to_rfc3339(),
        updated_at: chrono::Utc::now().to_rfc3339(),
        metadata: std::collections::HashMap::new(),
    };

    let chat_message = crate::rig_agent::core::types::ChatMessage::new(
        crate::rig_agent::core::types::MessageRole::User,
        message.clone(),
    );

    // Create chat request for streaming
    let _request =
        crate::rig_agent::core::types::ChatRequest::new(conversation_id.clone(), chat_message);

    // Get the stream using capabilities
    let chat_capability = crate::rig_agent::capabilities::ChatCapability::new(manager.clone());
    let stream = chat_capability
        .chat_stream(&message.clone(), conversation)
        .await
        .map_err(|e| format!("Failed to start chat stream: {}", e))?;

    // Start streaming in a background task and emit events to frontend
    let window_clone = window.clone();
    tokio::spawn(async move {
        use futures::StreamExt;
        futures::pin_mut!(stream);

        while let Some(event_result) = stream.next().await {
            match event_result {
                Ok(event) => {
                    // Emit event to frontend
                    if let Err(e) = window_clone.emit("chat-stream-event", &event) {
                        eprintln!("Failed to emit chat event: {}", e);
                    }
                }
                Err(e) => {
                    let error_event = crate::rig_agent::core::types::StreamEvent::Error {
                        error: e.to_string(),
                        timestamp: chrono::Utc::now().to_rfc3339(),
                    };
                    if let Err(err) = window_clone.emit("chat-stream-error", &error_event) {
                        eprintln!("Failed to emit chat error: {}", err);
                    }
                    break;
                }
            }
        }
    });

    Ok("Streaming started".to_string())
}
