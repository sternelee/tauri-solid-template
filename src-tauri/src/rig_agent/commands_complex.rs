use super::*;
use tauri::{AppHandle, Manager};
use tauri_specta::Event;

// Event for streaming chat updates
#[derive(serde::Serialize, serde::Deserialize, Debug, Clone, specta::Type, Event)]
pub struct ChatEvent(ChatStreamEvent);

// Initialize agent with enhanced configuration
#[tauri::command]
#[specta::specta]
pub async fn initialize_agent(
    app: AppHandle,
    state: tauri::State<'_, AgentState>,
    config: AgentConfig,
    api_key: Option<String>,
) -> Result<String, AgentError> {
    // Set up environment variables
    let env_config = if let Some(key) = api_key {
        ProviderConfig::OpenAI {
            api_key: Some(key),
            base_url: None,
        }
    } else {
        ProviderManager::get_provider_config("openai").ok_or(AgentError::ConfigurationError(
            "OpenAI provider config not found".to_string(),
        ))?
    };

    ProviderManager::set_provider_env_vars(&env_config)?;

    // Create OpenAI client
    let client = openai::Client::from_env();

    // Create enhanced agent
    let agent = AgentFactory::create_agent(&client, &config).await?;

    // Store in state
    {
        let mut client_guard = state.client.lock().await;
        *client_guard = Some(client);
    }

    {
        let mut agent_guard = state.agent.lock().await;
        *agent_guard = Some(agent);
    }

    // Store configuration
    state.set_config(config.clone()).await;

    Ok(format!(
        "Agent initialized successfully with model: {}",
        config.model
    ))
}

// Enhanced chat with streaming support
#[tauri::command]
#[specta::specta]
pub async fn chat_with_agent(
    app: AppHandle,
    state: tauri::State<'_, AgentState>,
    request: ChatRequest,
) -> Result<ChatResponse, AgentError> {
    let agent_guard = state.agent.lock().await;
    let agent = agent_guard.as_ref().ok_or(AgentError::NotInitialized)?;
    drop(agent_guard);

    // Get or create conversation
    let conversation_id = match request.conversation_id {
        Some(id) => id,
        None => state.create_conversation().await,
    };
    let message_id = uuid::Uuid::new_v4().to_string();

    // Emit start event
    ChatEvent(ChatStreamEvent::Start {
        conversation_id: conversation_id.clone(),
        message_id: message_id.clone(),
    })
    .emit(&app)
    .map_err(|e| AgentError::Custom(format!("Failed to emit event: {}", e)))?;

    // Add user message to conversation
    let user_message = ChatMessage {
        id: uuid::Uuid::new_v4().to_string(),
        role: "user".to_string(),
        content: request.message.clone(),
        timestamp: chrono::Utc::now().to_rfc3339(),
        tool_calls: None,
        metadata: None,
    };

    state.add_message(&conversation_id, user_message).await?;

    // Get conversation history
    let history = state.get_chat_history(&conversation_id).await?;

    // Create enhanced agent
    let config = state
        .get_config()
        .await
        .ok_or(AgentError::ConfigurationError(
            "Agent config not found".to_string(),
        ))?;

    let client_guard = state.client.lock().await;
    let client = client_guard.as_ref().ok_or(AgentError::NotInitialized)?;
    drop(client_guard);

    let cancel_signal = state.create_stream_cancellation(message_id.clone()).await;
    let enhanced_agent =
        AgentFactory::create_enhanced_agent(client, &config, Some(cancel_signal.clone())).await?;

    // Process the chat
    let response = enhanced_agent
        .chat_with_context(&request.message, &history)
        .await?;

    // Add assistant response to conversation
    let assistant_message = ChatMessage {
        id: uuid::Uuid::new_v4().to_string(),
        role: "assistant".to_string(),
        content: response.clone(),
        timestamp: chrono::Utc::now().to_rfc3339(),
        tool_calls: None,
        metadata: None,
    };

    state
        .add_message(&conversation_id, assistant_message)
        .await?;

    // Create response
    let chat_response = ChatResponse {
        content: response.clone(),
        model_used: config.model.clone(),
        conversation_id: conversation_id.clone(),
        message_id: message_id.clone(),
        tokens_used: None, // TODO: Get from response when available
        finish_reason: Some("stop".to_string()),
        tool_calls: None,
        status: ChatStatus::Completed,
    };

    // Emit completion event
    ChatEvent(ChatStreamEvent::Complete {
        response: chat_response.clone(),
    })
    .emit(&app)
    .map_err(|e| AgentError::Custom(format!("Failed to emit event: {}", e)))?;

    // Cleanup
    state.cleanup_stream(&message_id).await;

    Ok(chat_response)
}

// Streaming chat implementation
#[tauri::command]
#[specta::specta]
pub async fn chat_streaming(
    app: AppHandle,
    state: tauri::State<'_, AgentState>,
    request: ChatRequest,
) -> Result<String, AgentError> {
    let agent_guard = state.agent.lock().await;
    let agent = agent_guard.as_ref().ok_or(AgentError::NotInitialized)?;
    drop(agent_guard);

    // Get or create conversation
    let conversation_id = match request.conversation_id {
        Some(id) => id,
        None => state.create_conversation().await,
    };
    let stream_id = uuid::Uuid::new_v4().to_string();

    // Emit start event
    ChatEvent(ChatStreamEvent::Start {
        conversation_id: conversation_id.clone(),
        message_id: stream_id.clone(),
    })
    .emit(&app)
    .map_err(|e| AgentError::Custom(format!("Failed to emit event: {}", e)))?;

    // Add user message to conversation
    let user_message = ChatMessage {
        id: uuid::Uuid::new_v4().to_string(),
        role: "user".to_string(),
        content: request.message.clone(),
        timestamp: chrono::Utc::now().to_rfc3339(),
        tool_calls: None,
        metadata: None,
    };

    state.add_message(&conversation_id, user_message).await?;

    // Get conversation history
    let history = state.get_chat_history(&conversation_id).await?;

    // Create enhanced agent with cancellation
    let config = state
        .get_config()
        .await
        .ok_or(AgentError::ConfigurationError(
            "Agent config not found".to_string(),
        ))?;

    let client_guard = state.client.lock().await;
    let client = client_guard.as_ref().ok_or(AgentError::NotInitialized)?;
    drop(client_guard);

    let cancel_signal = state.create_stream_cancellation(stream_id.clone()).await;
    let enhanced_agent =
        AgentFactory::create_enhanced_agent(client, &config, Some(cancel_signal.clone())).await?;

    // Stream the response
    let app_clone = app.clone();
    let conversation_id_clone = conversation_id.clone();
    let stream_id_clone = stream_id.clone();

    let response = enhanced_agent
        .chat_streaming_with_context(&request.message, &history, move |token| {
            // Emit token event
            ChatEvent(ChatStreamEvent::Token {
                content: token.clone(),
            })
            .emit(&app_clone)
            .map_err(|e| AgentError::Custom(format!("Failed to emit token event: {}", e)))?;
            Ok(())
        })
        .await;

    match response {
        Ok(content) => {
            // Add assistant response to conversation
            let assistant_message = ChatMessage {
                id: uuid::Uuid::new_v4().to_string(),
                role: "assistant".to_string(),
                content: content.clone(),
                timestamp: chrono::Utc::now().to_rfc3339(),
                tool_calls: None,
                metadata: None,
            };

            state
                .add_message(&conversation_id, assistant_message)
                .await?;

            // Emit completion event
            let chat_response = ChatResponse {
                content: content.clone(),
                model_used: config.model.clone(),
                conversation_id: conversation_id_clone,
                message_id: stream_id_clone,
                tokens_used: None,
                finish_reason: Some("stop".to_string()),
                tool_calls: None,
                status: ChatStatus::Completed,
            };

            ChatEvent(ChatStreamEvent::Complete {
                response: chat_response,
            })
            .emit(&app)
            .map_err(|e| AgentError::Custom(format!("Failed to emit completion event: {}", e)))?;

            // Cleanup
            state.cleanup_stream(&stream_id).await;

            Ok(stream_id)
        }
        Err(AgentError::Cancelled) => {
            ChatEvent(ChatStreamEvent::Cancelled)
                .emit(&app)
                .map_err(|e| {
                    AgentError::Custom(format!("Failed to emit cancelled event: {}", e))
                })?;

            // Cleanup
            state.cleanup_stream(&stream_id).await;

            Err(AgentError::Cancelled)
        }
        Err(e) => {
            ChatEvent(ChatStreamEvent::Error {
                error: e.to_string(),
            })
            .emit(&app)
            .map_err(|e2| AgentError::Custom(format!("Failed to emit error event: {}", e2)))?;

            // Cleanup
            state.cleanup_stream(&stream_id).await;

            Err(e)
        }
    }
}

// Cancel streaming chat
#[tauri::command]
#[specta::specta]
pub async fn cancel_chat(
    state: tauri::State<'_, AgentState>,
    stream_id: String,
) -> Result<(), AgentError> {
    state.cancel_stream(&stream_id).await
}

// Get conversation history
#[tauri::command]
#[specta::specta]
pub async fn get_conversation_history(
    state: tauri::State<'_, AgentState>,
    conversation_id: Option<String>,
) -> Result<Vec<ChatMessage>, AgentError> {
    if let Some(id) = conversation_id {
        state.get_chat_history(&id).await
    } else {
        // Return all conversations
        let conversations = state.conversations.lock().await;
        let all_messages = conversations
            .values()
            .flat_map(|conv| conv.messages.clone())
            .collect();
        Ok(all_messages)
    }
}

// Clear conversation
#[tauri::command]
#[specta::specta]
pub async fn clear_conversation(
    state: tauri::State<'_, AgentState>,
    conversation_id: String,
) -> Result<String, AgentError> {
    let manager = ConversationManager::new(state.inner().clone());
    manager.clear_conversation(&conversation_id).await?;
    Ok(format!("Conversation {} cleared", conversation_id))
}

// List all conversations
#[tauri::command]
#[specta::specta]
pub async fn list_conversations(
    state: tauri::State<'_, AgentState>,
) -> Result<Vec<Conversation>, AgentError> {
    let conversations = state.conversations.lock().await;
    Ok(conversations.values().cloned().collect())
}

// Get agent status
#[tauri::command]
#[specta::specta]
pub async fn get_agent_status(
    state: tauri::State<'_, AgentState>,
) -> Result<AgentStatus, AgentError> {
    let is_initialized = state.is_initialized().await;
    let config = state.get_config().await;
    let active_streams = state.active_streams.lock().await.len() as u32;

    Ok(AgentStatus {
        initialized: is_initialized,
        config,
        active_streams,
    })
}

// Get available tools
#[tauri::command]
#[specta::specta]
pub async fn get_available_tools() -> Result<Vec<ToolDefinition>, AgentError> {
    let definitions = ToolManager::get_available_tools();
    Ok(definitions)
}

// Agent status structure
#[derive(Serialize, Deserialize, Type, Debug)]
pub struct AgentStatus {
    pub initialized: bool,
    pub config: Option<AgentConfig>,
    pub active_streams: u32,
}
