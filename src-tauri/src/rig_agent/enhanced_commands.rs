use super::*;
use tauri::AppHandle;
use tauri_specta::Event;

// Enhanced event for streaming chat updates
#[derive(serde::Serialize, serde::Deserialize, Debug, Clone, specta::Type, Event)]
pub struct EnhancedChatEvent(ChatStreamEvent);

// Initialize agent with enhanced configuration and multi-provider support
#[tauri::command]
#[specta::specta]
pub async fn initialize_enhanced_agent(
    app: AppHandle,
    state: tauri::State<'_, AgentState>,
    config: AgentConfig,
) -> Result<String, String> {
    // Create dynamic client based on provider
    let client = ProviderFactory::create_client(
        &config.provider,
        config.api_key.clone(),
        config.base_url.clone(),
    )
    .await
    .map_err(|e| e.to_string())?;

    // Create enhanced agent
    let agent = ProviderFactory::create_agent(&client, &config)
        .await
        .map_err(|e| e.to_string())?;

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
        "Enhanced agent initialized successfully with provider: {:?} and model: {}",
        config.provider, config.model
    ))
}

// Enhanced chat with multimodal and tool calling support
#[tauri::command]
#[specta::specta]
pub async fn enhanced_chat_with_agent(
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
    EnhancedChatEvent(ChatStreamEvent::Start {
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

    // Get configuration
    let config = state
        .get_config()
        .await
        .ok_or(AgentError::ConfigurationError(
            "Agent config not found".to_string(),
        ))?;

    // Create enhanced agent with tools
    let client_guard = state.client.lock().await;
    let client = client_guard.as_ref().ok_or(AgentError::NotInitialized)?;
    drop(client_guard);

    let available_tools =
        if state.are_tools_enabled().await && request.enable_tool_calling.unwrap_or(true) {
            request
                .tools
                .clone()
                .unwrap_or_else(|| ToolManager::get_available_tools())
        } else {
            Vec::new()
        };

    let cancel_signal = state.create_stream_cancellation(message_id.clone()).await;
    let enhanced_agent = EnhancedAgent::new(
        ProviderFactory::create_agent(client, &config).await?,
        config.clone(),
    )
    .with_cancellation(cancel_signal.clone())
    .with_tools(available_tools);

    // Process multimodal content
    let content_parts = request.content_parts.as_deref();

    // Process the chat
    let response = enhanced_agent
        .chat_with_context(&request.message, &history, content_parts)
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
        tokens_used: None,
        finish_reason: Some("stop".to_string()),
        tool_calls: None,
        status: ChatStatus::Completed,
    };

    // Emit completion event
    EnhancedChatEvent(ChatStreamEvent::Complete {
        response: chat_response.clone(),
    })
    .emit(&app)
    .map_err(|e| AgentError::Custom(format!("Failed to emit event: {}", e)))?;

    // Cleanup
    state.cleanup_stream(&message_id).await;

    Ok(chat_response)
}

// Process image for vision models
#[tauri::command]
#[specta::specta]
pub async fn process_image_for_vision(
    state: tauri::State<'_, AgentState>,
    image_path: String,
    description: Option<String>,
) -> Result<ImageContent, AgentError> {
    if !state.is_initialized().await {
        return Err(AgentError::NotInitialized);
    }

    let mut image_content = ImageProcessor::process_image_from_path(&image_path).await?;
    image_content.description = description;

    Ok(image_content)
}

// Generate embeddings for text
#[tauri::command]
#[specta::specta]
pub async fn generate_text_embeddings(
    state: tauri::State<'_, AgentState>,
    request: EmbeddingRequest,
) -> Result<EmbeddingResponse, AgentError> {
    if !state.are_embeddings_enabled().await {
        return Err(AgentError::ConfigurationError(
            "Embeddings are not enabled in the current configuration".to_string(),
        ));
    }

    // Get configuration
    let config = state
        .get_config()
        .await
        .ok_or(AgentError::ConfigurationError(
            "Agent config not found".to_string(),
        ))?;

    // Create enhanced agent for embeddings
    let client_guard = state.client.lock().await;
    let client = client_guard.as_ref().ok_or(AgentError::NotInitialized)?;
    drop(client_guard);

    let enhanced_agent = EnhancedAgent::new(
        ProviderFactory::create_agent(client, &config).await?,
        config.clone(),
    );

    // Generate embedding
    let embedding_vector = enhanced_agent
        .generate_embeddings(&request.input, &request.model)
        .await?;

    // Create response
    let embedding_data = EmbeddingData {
        object: "embedding".to_string(),
        embedding: embedding_vector,
        index: 0,
    };

    let embedding_response = EmbeddingResponse {
        object: "list".to_string(),
        data: vec![embedding_data],
        model: request.model,
        usage: EmbeddingUsage {
            prompt_tokens: request.input.len() as u32, // Rough estimate
            total_tokens: request.input.len() as u32,
        },
    };

    Ok(embedding_response)
}

// Execute tool directly
#[tauri::command]
#[specta::specta]
pub async fn execute_tool(
    state: tauri::State<'_, AgentState>,
    tool_name: String,
    parameters: serde_json::Value,
) -> Result<serde_json::Value, AgentError> {
    if !state.are_tools_enabled().await {
        return Err(AgentError::ConfigurationError(
            "Tools are not enabled in the current configuration".to_string(),
        ));
    }

    // Get configuration
    let config = state
        .get_config()
        .await
        .ok_or(AgentError::ConfigurationError(
            "Agent config not found".to_string(),
        ))?;

    // Create enhanced agent
    let client_guard = state.client.lock().await;
    let client = client_guard.as_ref().ok_or(AgentError::NotInitialized)?;
    drop(client_guard);

    let enhanced_agent = EnhancedAgent::new(
        ProviderFactory::create_agent(client, &config).await?,
        config.clone(),
    );

    // Execute tool
    enhanced_agent.call_tool(&tool_name, &parameters).await
}

// Streaming enhanced chat
#[tauri::command]
#[specta::specta]
pub async fn enhanced_chat_streaming(
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
    EnhancedChatEvent(ChatStreamEvent::Start {
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

    // Get configuration
    let config = state
        .get_config()
        .await
        .ok_or(AgentError::ConfigurationError(
            "Agent config not found".to_string(),
        ))?;

    // Create enhanced agent with streaming
    let client_guard = state.client.lock().await;
    let client = client_guard.as_ref().ok_or(AgentError::NotInitialized)?;
    drop(client_guard);

    let cancel_signal = state.create_stream_cancellation(stream_id.clone()).await;
    let enhanced_agent = EnhancedAgent::new(
        ProviderFactory::create_agent(client, &config).await?,
        config.clone(),
    )
    .with_cancellation(cancel_signal.clone());

    // Stream the response
    let app_clone = app.clone();
    let conversation_id_clone = conversation_id.clone();
    let stream_id_clone = stream_id.clone();

    let content_parts = request.content_parts.as_deref();

    let response = enhanced_agent
        .chat_streaming_with_context(&request.message, &history, content_parts, move |token| {
            // Emit token event
            EnhancedChatEvent(ChatStreamEvent::Token {
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

            EnhancedChatEvent(ChatStreamEvent::Complete {
                response: chat_response,
            })
            .emit(&app)
            .map_err(|e| AgentError::Custom(format!("Failed to emit completion event: {}", e)))?;

            // Cleanup
            state.cleanup_stream(&stream_id).await;

            Ok(stream_id)
        }
        Err(AgentError::Cancelled) => {
            EnhancedChatEvent(ChatStreamEvent::Cancelled)
                .emit(&app)
                .map_err(|e| {
                    AgentError::Custom(format!("Failed to emit cancelled event: {}", e))
                })?;

            // Cleanup
            state.cleanup_stream(&stream_id).await;

            Err(AgentError::Cancelled)
        }
        Err(e) => {
            EnhancedChatEvent(ChatStreamEvent::Error {
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

// Get available providers
#[tauri::command]
#[specta::specta]
pub async fn get_available_providers() -> Result<Vec<String>, AgentError> {
    Ok(vec![
        "OpenAI".to_string(),
        "Anthropic".to_string(),
        "Google".to_string(),
        "Ollama".to_string(),
        "Local".to_string(),
    ])
}

// Get provider configuration template
#[tauri::command]
#[specta::specta]
pub async fn get_provider_template(provider: String) -> Result<AgentConfig, AgentError> {
    let provider_enum = match provider.as_str() {
        "OpenAI" => AIProvider::OpenAI,
        "Anthropic" => AIProvider::Anthropic,
        "Google" => AIProvider::Google,
        "Ollama" => AIProvider::Ollama,
        "Local" => AIProvider::Local,
        _ => {
            return Err(AgentError::Custom(format!(
                "Unknown provider: {}",
                provider
            )))
        }
    };

    let config = match provider_enum {
        AIProvider::OpenAI => AgentConfig {
            provider: AIProvider::OpenAI,
            model: "gpt-4o-mini".to_string(),
            preamble: Some("You are a helpful AI assistant integrated into a desktop application. Provide helpful, concise responses.".to_string()),
            temperature: Some(0.7),
            max_tokens: Some(1000),
            max_iterations: Some(20),
            stream_events: Some(true),
            api_key: None,
            base_url: Some("https://api.openai.com/v1".to_string()),
            enable_vision: Some(true),
            enable_tools: Some(true),
            enable_embeddings: Some(true),
        },
        AIProvider::Anthropic => AgentConfig {
            provider: AIProvider::Anthropic,
            model: "claude-3-5-sonnet-20241022".to_string(),
            preamble: Some("You are Claude, a helpful AI assistant integrated into a desktop application. Provide helpful, concise responses.".to_string()),
            temperature: Some(0.7),
            max_tokens: Some(1000),
            max_iterations: Some(20),
            stream_events: Some(true),
            api_key: None,
            base_url: Some("https://api.anthropic.com".to_string()),
            enable_vision: Some(true),
            enable_tools: Some(true),
            enable_embeddings: Some(false), // Claude doesn't support embeddings
        },
        _ => AgentConfig::default(),
    };

    Ok(config)
}

