use super::*;
use crate::database::{self, MessageContext, AppReference, FileReference};
use tauri::{AppHandle, Manager};
use tauri_specta::Event;
use serde_json::{json, Value};

// Enhanced event for streaming chat updates
#[derive(serde::Serialize, serde::Deserialize, Debug, Clone, specta::Type, Event)]
pub struct EnhancedChatEvent {
    pub event_type: String,
    pub data: serde_json::Value,
}

// Initialize agent with database integration and multi-provider support
#[tauri::command]
#[specta::specta]
pub async fn initialize_agent_with_db(
    app: AppHandle,
    state: tauri::State<'_, AgentState>,
    config: AgentConfig,
) -> Result<String, String> {
    // Validate configuration
    super::providers::ProviderFactory::validate_config(&config)
        .map_err(|e| e.to_string())?;

    // Set up environment variables if provided
    if let Some(api_key) = &config.api_key {
        match config.provider {
            AIProvider::OpenAI => std::env::set_var("OPENAI_API_KEY", api_key),
            AIProvider::Anthropic => std::env::set_var("ANTHROPIC_API_KEY", api_key),
            AIProvider::Google | AIProvider::GoogleGemini => std::env::set_var("GOOGLE_API_KEY", api_key),
            AIProvider::Groq => std::env::set_var("GROQ_API_KEY", api_key),
            AIProvider::Cohere => std::env::set_var("COHERE_API_KEY", api_key),
            AIProvider::Mistral => std::env::set_var("MISTRAL_API_KEY", api_key),
            AIProvider::TogetherAI => std::env::set_var("TOGETHER_API_KEY", api_key),
            AIProvider::HuggingFace => std::env::set_var("HUGGINGFACE_API_KEY", api_key),
            _ => {}
        }
    }

    // Create client and agent using provider factory
    let client = super::providers::ProviderFactory::create_client(&config)
        .await
        .map_err(|e| e.to_string())?;

    let agent = super::providers::ProviderFactory::create_agent(&client, &config)
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
        "Agent initialized successfully with {} provider and model: {}",
        format!("{:?}", config.provider),
        config.model
    ))
}

// Create new conversation with database persistence
#[tauri::command]
#[specta::specta]
pub async fn create_conversation_with_db(
    app: AppHandle,
    title: Option<String>,
    model: String,
    provider: String,
) -> Result<String, String> {
    let db = app.state::<database::Database>();

    let conversation_id = db
        .create_conversation(title, &model, &provider)
        .await
        .map_err(|e| e.to_string())?;

    Ok(conversation_id)
}

// Enhanced chat with database integration and tool calling
#[tauri::command]
#[specta::specta]
pub async fn chat_with_agent_db(
    app: AppHandle,
    state: tauri::State<'_, AgentState>,
    conversation_id: String,
    message: String,
    context_apps: Option<Vec<String>>,
    context_files: Option<Vec<String>>,
    sources: Option<Vec<SourceReference>>,
    use_vision: Option<bool>,
    enable_tool_calling: Option<bool>,
) -> Result<ChatResponse, String> {
    // Get model first before locking agent
    let model = get_model_from_state(state.clone()).await;

    // Get database instance
    let db = app.state::<database::Database>();

    // Process sources using ContextProcessor if provided
    let sources_context = if let Some(sources) = &sources {
        super::context::ContextProcessor::process_sources_for_context(sources).await
            .unwrap_or_else(|e| {
                eprintln!("Error processing sources: {}", e);
                String::new()
            })
    } else {
        String::new()
    };

    // Extract and build context
    let message_context = if context_apps.is_some() || context_files.is_some() {
        let mut ctx = MessageContext {
            apps: Vec::new(),
            files: Vec::new(),
        };

        // Add app context
        if let Some(app_refs) = context_apps {
            // Load system apps to get detailed info
            if let Ok(apps_result) = crate::apps::get_applications(app.state()) {
                for app_ref in app_refs {
                    if let Some(app_info) = apps_result.iter().find(|a| a.bundle_id == app_ref) {
                        ctx.apps.push(AppReference {
                            name: app_info.name.clone(),
                            bundle_id: app_info.bundle_id.clone(),
                            path: app_info.path.clone(),
                        });
                    }
                }
            }
        }

        // Add file context
        if let Some(file_refs) = context_files {
            for file_ref in file_refs {
                ctx.files.push(FileReference {
                    path: file_ref.clone(),
                    file_type: extract_file_type(&file_ref),
                    content_preview: None, // Could add content preview here if needed
                });
            }
        }

        Some(ctx)
    } else {
        None
    };

    // Add user message to database
    db.add_message(
        &conversation_id,
        "user",
        &message,
        message_context.clone(),
        None,
        &model
    ).await
    .map_err(|e| e.to_string())?;

    // Get conversation history from database
    let db_messages = db.get_messages(&conversation_id)
        .await
        .map_err(|e| e.to_string())?;

    // Convert database messages to agent format
    let _history: Vec<String> = db_messages
        .iter()
        .map(|msg| format!("{}: {}", msg.role, msg.content))
        .collect();

    // Build enhanced prompt with context
    let enhanced_message = {
        let mut context_parts = Vec::new();

        // Add sources context if available
        if !sources_context.is_empty() {
            context_parts.push(sources_context);
        }

        // Add legacy context if available
        if let Some(ctx) = &message_context {
            let mut legacy_context = String::new();

            if !ctx.apps.is_empty() {
                legacy_context.push_str("Legacy Context Apps:\n");
                for app in &ctx.apps {
                    legacy_context.push_str(&format!("- {} (Bundle ID: {})\n", app.name, app.bundle_id));
                }
            }

            if !ctx.files.is_empty() {
                legacy_context.push_str("Legacy Context Files:\n");
                for file in &ctx.files {
                    legacy_context.push_str(&format!("- {} ({})\n", file.path, file.file_type));
                }
            }

            if !legacy_context.is_empty() {
                context_parts.push(legacy_context);
            }
        }

        // Combine all context with the user message
        if context_parts.is_empty() {
            message.clone()
        } else {
            format!("{}\n\nUser Message: {}", context_parts.join("\n\n"), message)
        }
    };

    // Get agent and process the chat
    let _config = state.get_config().await.ok_or("Agent config not found")?;

    // Check if tool calling is enabled and process potential tool calls
    let response = if enable_tool_calling.unwrap_or(false) {
        process_chat_with_tools(
            &enhanced_message,
            state.clone(),
            use_vision.unwrap_or(false),
        ).await?
    } else {
        let agent_guard = state.agent.lock().await;
        let agent = agent_guard.as_ref().ok_or("Agent not initialized")?;

        match agent {
            DynamicAgent::OpenAI(openai_agent) => {
                openai_agent
                    .prompt(&enhanced_message)
                    .await
                    .map_err(|e| format!("Agent request failed: {}", e))?
            }
            DynamicAgent::Anthropic(anthropic_agent) => {
                anthropic_agent
                    .prompt(&enhanced_message)
                    .await
                    .map_err(|e| format!("Agent request failed: {}", e))?
            }
            DynamicAgent::Gemini(gemini_agent) => {
                gemini_agent
                    .prompt(&enhanced_message)
                    .await
                    .map_err(|e| format!("Agent request failed: {}", e))?
            }
            DynamicAgent::Groq(groq_agent) => {
                let response: String = groq_agent
                    .prompt(&enhanced_message)
                    .await
                    .map_err(|e| format!("Agent request failed: {}", e))?;
                response
            }
            DynamicAgent::Cohere(cohere_agent) => {
                cohere_agent
                    .prompt(&enhanced_message)
                    .await
                    .map_err(|e| format!("Agent request failed: {}", e))?
            }
            DynamicAgent::Mistral(mistral_agent) => {
                mistral_agent
                    .prompt(&enhanced_message)
                    .await
                    .map_err(|e| format!("Agent request failed: {}", e))?
            }
            DynamicAgent::Together(together_agent) => {
                together_agent
                    .prompt(&enhanced_message)
                    .await
                    .map_err(|e| format!("Agent request failed: {}", e))?
            }
            DynamicAgent::HuggingFace(huggingface_agent) => {
                huggingface_agent
                    .prompt(&enhanced_message)
                    .await
                    .map_err(|e| format!("Agent request failed: {}", e))?
            }
        }
    };

    // Add assistant response to database
    db.add_message(
        &conversation_id,
        "assistant",
        &response,
        None,
        Some(estimate_tokens(&response) as i32),
        &model
    ).await
    .map_err(|e| e.to_string())?;

    // Create response
    let chat_response = ChatResponse {
        content: response.clone(),
        model_used: model,
        conversation_id: conversation_id.clone(),
        message_id: uuid::Uuid::new_v4().to_string(),
        tokens_used: Some(estimate_tokens(&response)),
        finish_reason: Some("stop".to_string()),
        tool_calls: None,
        status: ChatStatus::Completed,
    };

    Ok(chat_response)
}

// Get conversation history from database
#[tauri::command]
#[specta::specta]
pub async fn get_conversation_history_db(
    app: AppHandle,
    conversation_id: String,
) -> Result<Vec<database::Message>, String> {
    let db = app.state::<database::Database>();

    db.get_messages(&conversation_id)
        .await
        .map_err(|e| e.to_string())
}

// List all conversations from database
#[tauri::command]
#[specta::specta]
pub async fn list_conversations_db(
    app: AppHandle,
    limit: Option<f64>,
) -> Result<Vec<database::Conversation>, String> {
    let db = app.state::<database::Database>();

    db.list_conversations(limit)
        .await
        .map_err(|e| e.to_string())
}

// Delete conversation from database
#[tauri::command]
#[specta::specta]
pub async fn delete_conversation_db(
    app: AppHandle,
    conversation_id: String,
) -> Result<(), String> {
    let db = app.state::<database::Database>();

    db.delete_conversation(&conversation_id)
        .await
        .map_err(|e| e.to_string())
}

// Update conversation title
#[tauri::command]
#[specta::specta]
pub async fn update_conversation_title_db(
    app: AppHandle,
    conversation_id: String,
    title: String,
) -> Result<(), String> {
    let db = app.state::<database::Database>();

    db.update_conversation_title(&conversation_id, &title)
        .await
        .map_err(|e| e.to_string())
}

// Search conversations
#[tauri::command]
#[specta::specta]
pub async fn search_conversations_db(
    app: AppHandle,
    query: String,
) -> Result<Vec<database::Conversation>, String> {
    let db = app.state::<database::Database>();

    db.search_conversations(&query)
        .await
        .map_err(|e| e.to_string())
}

// Get chat statistics
#[tauri::command]
#[specta::specta]
pub async fn get_chat_statistics_db(
    app: AppHandle,
) -> Result<EnhancedAgentStatus, String> {
    let db = app.state::<database::Database>();
    let db_stats = db.get_basic_statistics()
        .await
        .map_err(|e| e.to_string())?;

    // Convert database statistics to public EnhancedAgentStatus
    Ok(EnhancedAgentStatus {
        initialized: true, // Assume initialized if we can get stats
        config: None,       // Not available in this context
        active_streams: 0,
        total_conversations: db_stats.0,
        total_messages: db_stats.1,
        user_messages: 0, // Not available in simplified stats
        assistant_messages: 0, // Not available in simplified stats
        total_tokens: 0, // Not available in simplified stats
        provider: None,
        model: None,
    })
}

// Get enhanced agent status with database info
#[tauri::command]
#[specta::specta]
pub async fn get_enhanced_agent_status(
    app: AppHandle,
    state: tauri::State<'_, AgentState>,
) -> Result<EnhancedAgentStatus, String> {
    let is_initialized = state.is_initialized().await;
    let config = state.get_config().await;
    let active_streams = state.active_streams.lock().await.len() as u32;

    // Get database statistics
    let db = app.state::<database::Database>();
    let db_stats = db.get_basic_statistics()
        .await
        .map_err(|e| e.to_string())?;

    // Get provider and model from config
    let (provider, model) = if let Some(ref config) = config {
        (Some(format!("{:?}", config.provider)), Some(config.model.clone()))
    } else {
        (None, None)
    };

    Ok(EnhancedAgentStatus {
        initialized: is_initialized,
        config,
        active_streams,
        total_conversations: db_stats.0,
        total_messages: db_stats.1,
        user_messages: 0, // Not available in simplified stats
        assistant_messages: 0, // Not available in simplified stats
        total_tokens: 0, // Not available in simplified stats
        provider,
        model,
    })
}

// Helper functions
fn extract_file_type(path: &str) -> String {
    if let Some(extension) = std::path::Path::new(path)
        .extension()
        .and_then(|ext| ext.to_str())
    {
        match extension.to_lowercase().as_str() {
            "rs" => "Rust".to_string(),
            "js" => "JavaScript".to_string(),
            "jsx" => "React".to_string(),
            "ts" => "TypeScript".to_string(),
            "tsx" => "React".to_string(),
            "py" => "Python".to_string(),
            "java" => "Java".to_string(),
            "cpp" | "cxx" | "cc" => "C++".to_string(),
            "c" => "C".to_string(),
            "go" => "Go".to_string(),
            "html" => "HTML".to_string(),
            "css" => "CSS".to_string(),
            "json" => "JSON".to_string(),
            "markdown" | "md" => "Markdown".to_string(),
            _ => extension.to_uppercase().to_string(),
        }
    } else {
        "Unknown".to_string()
    }
}

fn estimate_tokens(text: &str) -> u32 {
    // Simple token estimation (rough approximation)
    // Average token is about 4 characters for English text
    (text.len() / 4) as u32
}

async fn get_model_from_state(state: tauri::State<'_, AgentState>) -> String {
    state.get_config()
        .await
        .map(|c| c.model)
        .unwrap_or_else(|| "gpt-4o-mini".to_string())
}

// Process chat with tool calling capabilities
async fn process_chat_with_tools(
    message: &str,
    state: tauri::State<'_, AgentState>,
    use_vision: bool,
) -> Result<String, String> {
    // Get available tools
    let tools = super::tools::ToolManager::get_available_tools();
    let tool_descriptions = super::tools::ToolManager::get_tool_descriptions();

    // Build enhanced prompt with tool information
    let tool_enhanced_prompt = format!(
        "{}\n\nAvailable tools:\n{}\n\nIf you need to use a tool, format your response with JSON like:\n{{\"tool_calls\": [{{\"name\": \"tool_name\", \"parameters\": {{...}}}}]}}",
        message,
        tool_descriptions
    );

    // Get agent response
    let agent_guard = state.agent.lock().await;
    let agent = agent_guard.as_ref().ok_or("Agent not initialized")?;

    let response = match agent {
        DynamicAgent::OpenAI(openai_agent) => {
            openai_agent
                .prompt(&tool_enhanced_prompt)
                .await
                .map_err(|e| format!("Agent request failed: {}", e))?
        }
        DynamicAgent::Anthropic(anthropic_agent) => {
            anthropic_agent
                .prompt(&tool_enhanced_prompt)
                .await
                .map_err(|e| format!("Agent request failed: {}", e))?
        }
        DynamicAgent::Gemini(gemini_agent) => {
            gemini_agent
                .prompt(&tool_enhanced_prompt)
                .await
                .map_err(|e| format!("Agent request failed: {}", e))?
        }
        DynamicAgent::Groq(groq_agent) => {
            let response: String = groq_agent
                .prompt(&tool_enhanced_prompt)
                .await
                .map_err(|e| format!("Agent request failed: {}", e))?;
            response
        }
        DynamicAgent::Cohere(cohere_agent) => {
            cohere_agent
                .prompt(&tool_enhanced_prompt)
                .await
                .map_err(|e| format!("Agent request failed: {}", e))?
        }
        DynamicAgent::Mistral(mistral_agent) => {
            mistral_agent
                .prompt(&tool_enhanced_prompt)
                .await
                .map_err(|e| format!("Agent request failed: {}", e))?
        }
        DynamicAgent::Together(together_agent) => {
            together_agent
                .prompt(&tool_enhanced_prompt)
                .await
                .map_err(|e| format!("Agent request failed: {}", e))?
        }
        DynamicAgent::HuggingFace(huggingface_agent) => {
            huggingface_agent
                .prompt(&tool_enhanced_prompt)
                .await
                .map_err(|e| format!("Agent request failed: {}", e))?
        }
    };

    // Check if response contains tool calls
    if let Some(tool_calls_json) = extract_tool_calls(&response) {
        let tool_calls: Vec<Value> = serde_json::from_str(&tool_calls_json)
            .map_err(|e| format!("Failed to parse tool calls: {}", e))?;

        let mut tool_results = Vec::new();

        for tool_call in tool_calls {
            if let Some(tool_name) = tool_call.get("name").and_then(|v| v.as_str()) {
                if let Some(parameters) = tool_call.get("parameters") {
                    match super::tools::ToolManager::execute_tool(tool_name, parameters).await {
                        Ok(result) => {
                            tool_results.push(format!("Tool '{}' executed successfully: {}", tool_name, result));
                        }
                        Err(e) => {
                            tool_results.push(format!("Tool '{}' failed: {}", tool_name, e));
                        }
                    }
                }
            }
        }

        // Send tool results back to agent for final response
        let final_prompt = format!(
            "{}\n\nTool Results:\n{}\n\nPlease provide a final response based on these tool results.",
            response,
            tool_results.join("\n")
        );

        let final_response = match agent {
            DynamicAgent::OpenAI(openai_agent) => {
                openai_agent
                    .prompt(&final_prompt)
                    .await
                    .map_err(|e| format!("Final agent request failed: {}", e))?
            }
            DynamicAgent::Anthropic(anthropic_agent) => {
                anthropic_agent
                    .prompt(&final_prompt)
                    .await
                    .map_err(|e| format!("Final agent request failed: {}", e))?
            }
            DynamicAgent::Gemini(gemini_agent) => {
                gemini_agent
                    .prompt(&final_prompt)
                    .await
                    .map_err(|e| format!("Final agent request failed: {}", e))?
            }
            DynamicAgent::Groq(groq_agent) => {
                let response: String = groq_agent
                    .prompt(&final_prompt)
                    .await
                    .map_err(|e| format!("Final agent request failed: {}", e))?;
                response
            }
            DynamicAgent::Cohere(cohere_agent) => {
                cohere_agent
                    .prompt(&final_prompt)
                    .await
                    .map_err(|e| format!("Final agent request failed: {}", e))?
            }
            DynamicAgent::Mistral(mistral_agent) => {
                mistral_agent
                    .prompt(&final_prompt)
                    .await
                    .map_err(|e| format!("Final agent request failed: {}", e))?
            }
            DynamicAgent::Together(together_agent) => {
                together_agent
                    .prompt(&final_prompt)
                    .await
                    .map_err(|e| format!("Final agent request failed: {}", e))?
            }
            DynamicAgent::HuggingFace(huggingface_agent) => {
                huggingface_agent
                    .prompt(&final_prompt)
                    .await
                    .map_err(|e| format!("Final agent request failed: {}", e))?
            }
        };

        Ok(final_response)
    } else {
        Ok(response)
    }
}

// Extract tool calls from agent response
fn extract_tool_calls(response: &str) -> Option<String> {
    // Look for JSON patterns in the response
    if let Some(start) = response.find("{\"tool_calls\"") {
        if let Some(end) = response[start..].find("}") {
            let potential_json = &response[start..start + end + 1];
            // Try to parse as JSON to verify it's valid
            if serde_json::from_str::<Value>(potential_json).is_ok() {
                return Some(potential_json.to_string());
            }
        }
    }
    None
}

// New command: Execute tool directly
#[tauri::command]
#[specta::specta]
pub async fn execute_tool_command(
    app: AppHandle,
    tool_name: String,
    parameters: Value,
) -> Result<Value, String> {
    super::tools::ToolManager::execute_tool(&tool_name, &parameters)
        .await
        .map_err(|e| e.to_string())
}

// New command: Get available tools
#[tauri::command]
#[specta::specta]
pub async fn get_available_tools_command(
    app: AppHandle,
) -> Result<Vec<super::tools::ToolDefinition>, String> {
    Ok(super::tools::ToolManager::get_available_tools())
}

// New command: Generate image with enhanced capabilities
#[tauri::command]
#[specta::specta]
pub async fn generate_image_enhanced(
    app: AppHandle,
    conversation_id: String,
    prompt: String,
    style: Option<String>,
    size: Option<String>,
    quality: Option<String>,
    save_to_database: Option<bool>,
) -> Result<super::ImageGenerationResponse, String> {
    let request = super::ImageGenerationRequest {
        prompt,
        model: Some("dall-e-3".to_string()),
        n: Some(1),
        size: size.or(Some("1024x1024".to_string())),
        quality: quality.or(Some("standard".to_string())),
        style: style.or(Some("vivid".to_string())),
        response_format: Some("b64_json".to_string()),
    };

    let response = super::generate_image_command(app.clone(), request.clone(), None).await?;

    // Optionally save to database
    if save_to_database.unwrap_or(false) {
        let db = app.state::<database::Database>();

        if let Some(first_image) = response.data.first() {
            let content = format!(
                "Image generated with prompt: {}\nRevised prompt: {:?}\nImage data: [Base64 encoded image]",
                request.prompt,
                first_image.revised_prompt
            );

            if let Err(e) = db.add_message(
                &conversation_id,
                "assistant",
                &content,
                None,
                None,
                "dall-e-3"
            ).await {
                return Err(format!("Failed to save image to database: {}", e));
            }
        }
    }

    Ok(response)
}

// New command: Create embeddings for semantic search
#[tauri::command]
#[specta::specta]
pub async fn create_embeddings_for_search(
    app: AppHandle,
    conversation_id: String,
    text: String,
) -> Result<super::EmbeddingResponse, String> {
    let request = super::EmbeddingRequest {
        input: text,
        model: "text-embedding-3-small".to_string(),
        encoding_format: Some("float".to_string()),
        dimensions: None,
    };

    super::create_embeddings_command(app, request).await
}

// New command: Semantic search within conversation
#[tauri::command]
#[specta::specta]
pub async fn semantic_search_conversation(
    app: AppHandle,
    conversation_id: String,
    query: String,
) -> Result<Vec<(f64, f32, String)>, String> {
    let db = app.state::<database::Database>();

    // Get conversation messages
    let messages = db.get_messages(&conversation_id)
        .await
        .map_err(|e| e.to_string())?;

    // Extract message contents
    let documents: Vec<String> = messages.iter()
        .map(|msg| format!("{}: {}", msg.role, msg.content))
        .collect();

    // Perform semantic search
    super::semantic_search_command(
        app,
        query,
        documents,
        Some("text-embedding-3-small".to_string()),
        Some(5),
    ).await
}

// Enhanced agent status structure
#[derive(Serialize, Deserialize, Type, Debug)]
pub struct EnhancedAgentStatus {
    pub initialized: bool,
    pub config: Option<AgentConfig>,
    pub active_streams: u32,
    pub total_conversations: u32,
    pub total_messages: u32,
    pub user_messages: u32,
    pub assistant_messages: u32,
    pub total_tokens: u32,
    pub provider: Option<String>,
    pub model: Option<String>,
}