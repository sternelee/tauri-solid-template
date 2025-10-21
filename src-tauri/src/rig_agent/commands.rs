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
) -> Result<String, String> {
    // Set up environment variables
    if let Some(key) = api_key {
        std::env::set_var("OPENAI_API_KEY", key);
    }

    // Create OpenAI client
    let client = openai::Client::from_env();

    // Create agent with configuration
    let mut agent_builder = client.agent(&config.model);

    if let Some(preamble) = &config.preamble {
        agent_builder = agent_builder.preamble(preamble);
    }

    if let Some(temperature) = config.temperature {
        agent_builder = agent_builder.temperature(temperature as f64);
    }

    let agent = agent_builder.build();

    // Store in state
    {
        let mut client_guard = state.client.lock().await;
        *client_guard = Some(DynamicClient::OpenAI(client));
    }

    {
        let mut agent_guard = state.agent.lock().await;
        *agent_guard = Some(DynamicAgent::OpenAI(agent));
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
) -> Result<ChatResponse, String> {
    let agent_guard = state.agent.lock().await;
    let agent = agent_guard.as_ref().ok_or("Agent not initialized")?;
    drop(agent_guard);

    // Get or create conversation
    let conversation_id = match request.conversation_id {
        Some(id) => id,
        None => state.create_conversation().await,
    };
    let message_id = uuid::Uuid::new_v4().to_string();

    // Add user message to conversation
    let user_message = ChatMessage {
        id: uuid::Uuid::new_v4().to_string(),
        role: "user".to_string(),
        content: request.message.clone(),
        timestamp: chrono::Utc::now().to_rfc3339(),
        tool_calls: None,
        metadata: None,
    };

    state
        .add_message(&conversation_id, user_message)
        .await
        .map_err(|e| e.to_string())?;

    // Get conversation history
    let conversation = state
        .get_conversation(&conversation_id)
        .await
        .ok_or("Conversation not found")?;
    let history = conversation.messages;

    // Create enhanced agent
    let config = state.get_config().await.ok_or("Agent config not found")?;

    let (openai_client, dynamic_agent) = {
        let client_guard = state.client.lock().await;
        let agent_guard = state.agent.lock().await;

        let client = client_guard.as_ref().ok_or("Client not initialized")?;

        let agent = agent_guard.as_ref().ok_or("Agent not initialized")?;

        match (client, agent) {
            (DynamicClient::OpenAI(openai_client), DynamicAgent::OpenAI(openai_agent)) => {
                (openai_client.clone(), openai_agent.clone())
            }
            _ => return Err("Unsupported provider type".to_string()),
        }
    };

    // Process the chat
    let response = dynamic_agent
        .prompt(&request.message)
        .await
        .map_err(|e| format!("Agent request failed: {}", e))?;

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
        .await
        .map_err(|e| e.to_string())?;

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

    Ok(chat_response)
}

// Get conversation history
#[tauri::command]
#[specta::specta]
pub async fn get_conversation_history(
    state: tauri::State<'_, AgentState>,
    conversation_id: Option<String>,
) -> Result<Vec<ChatMessage>, String> {
    if let Some(id) = conversation_id {
        let conversation = state
            .get_conversation(&id)
            .await
            .ok_or(format!("Conversation {} not found", id))?;
        Ok(conversation.messages)
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
) -> Result<String, String> {
    state
        .update_conversation(&conversation_id, |conv| {
            conv.messages.clear();
        })
        .await
        .map_err(|e| e.to_string())?;
    Ok(format!("Conversation {} cleared", conversation_id))
}

// List all conversations
#[tauri::command]
#[specta::specta]
pub async fn list_conversations(
    state: tauri::State<'_, AgentState>,
) -> Result<Vec<Conversation>, String> {
    let conversations = state.conversations.lock().await;
    Ok(conversations.values().cloned().collect())
}

// Get agent status
#[tauri::command]
#[specta::specta]
pub async fn get_agent_status(state: tauri::State<'_, AgentState>) -> Result<AgentStatus, String> {
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
pub async fn get_available_tools() -> Result<Vec<ToolDefinition>, String> {
    let definitions = tools::ToolManager::get_available_tools();
    Ok(definitions)
}

// Agent status structure
#[derive(Serialize, Deserialize, Type, Debug)]
pub struct AgentStatus {
    pub initialized: bool,
    pub config: Option<AgentConfig>,
    pub active_streams: u32,
}
