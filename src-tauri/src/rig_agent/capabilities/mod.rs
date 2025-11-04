use crate::rig_agent::core::*;
use crate::rig_agent::events::*;
use crate::rig_agent::tools::*;
use futures::Stream;
use std::pin::Pin;
use std::sync::Arc;

/// User intent categories for tool suggestions
#[derive(Debug, Clone, PartialEq)]
enum IntentCategory {
    Search,
    FileOperation,
    Generation,
    Communication,
    Analysis,
    MCP,
    General,
}

/// User intent extracted from message and context
#[derive(Debug, Clone)]
struct UserIntent {
    primary_category: IntentCategory,
    keywords: Vec<String>,
    confidence: f32,
}

pub mod chat;
pub mod embedding;
pub mod image;
pub mod streaming;

pub use chat::*;
pub use embedding::*;
pub use image::*;
pub use streaming::*;

/// Main capability interface for all AI operations
pub struct AICapability {
    agent_manager: Arc<super::AgentManager>,
}

impl AICapability {
    pub fn new(agent_manager: Arc<super::AgentManager>) -> Self {
        Self { agent_manager }
    }

    /// Simple chat completion
    pub async fn chat(&self, message: &str, conversation: Conversation) -> Result<ChatResponse> {
        let chat_req = ChatRequest::from_text(message, conversation);
        self.execute_chat(chat_req).await
    }

    /// Chat with content parts (images, etc.)
    pub async fn chat_with_content(
        &self,
        message: &str,
        content_parts: Vec<ContentPart>,
        conversation: Conversation,
    ) -> Result<ChatResponse> {
        let chat_req = ChatRequest::from_text(message, conversation).with_content(content_parts);
        self.execute_chat(chat_req).await
    }

    /// Streaming chat completion
    pub async fn chat_stream(
        &self,
        message: &str,
        conversation: Conversation,
    ) -> Result<Pin<Box<dyn Stream<Item = Result<StreamEvent>> + Send>>> {
        let chat_req = ChatRequest::from_text(message, conversation).stream(true);
        self.execute_chat_stream(chat_req).await
    }

    /// ReAct mode chat
    pub async fn chat_react(
        &self,
        message: &str,
        conversation: Conversation,
        tools: Option<Vec<String>>,
    ) -> Result<Pin<Box<dyn Stream<Item = Result<StreamEvent>> + Send>>> {
        let mut chat_req = ChatRequest::from_text(message, conversation).stream(true);
        if let Some(tools) = tools {
            chat_req = chat_req.with_tools(tools);
        }
        self.execute_chat_react(chat_req).await
    }

    /// Generate embeddings
    pub async fn embed_texts(&self, texts: Vec<String>) -> Result<Vec<Vec<f32>>> {
        self.execute_embeddings(texts).await
    }

    /// Generate image
    pub async fn generate_image(
        &self,
        prompt: &str,
        params: Option<ImageGenerationParams>,
    ) -> Result<ImageGenerationResponse> {
        self.execute_image_generation(prompt, params).await
    }

    /// Execute tool
    pub async fn execute_tool(
        &self,
        tool_name: &str,
        parameters: serde_json::Value,
        _context: ToolExecutionContext,
    ) -> Result<serde_json::Value> {
        self.agent_manager
            .tools()
            .execute(tool_name, parameters)
            .map_err(|e| AgentError::ToolError(e))
    }

    /// Get available tools
    pub async fn get_available_tools(&self, _context: &ToolExecutionContext) -> Vec<String> {
        self.agent_manager.tools().list_tools()
    }

    /// Search tools by query
    pub async fn search_tools(&self, query: &str) -> Vec<ToolMetadata> {
        if query.is_empty() {
            return vec![];
        }

        // Get available tools from the tool manager
        let available_tools = self.agent_manager.tools().list_tools();

        // Convert tool names to ToolMetadata with search matching
        let mut matching_tools = Vec::new();

        for tool_name in available_tools {
            // Create basic metadata for each tool
            let metadata = ToolMetadata {
                name: tool_name.clone(),
                description: format!("Tool: {}", tool_name),
                parameters: serde_json::json!({
                    "type": "object",
                    "properties": {}
                }),
                category: self.categorize_tool(&tool_name),
                tags: self.generate_tool_tags(&tool_name),
            };

            // Check if tool matches search query
            if self.tool_matches_query(&metadata, query) {
                matching_tools.push(metadata);
            }
        }

        // Sort by relevance (simple heuristic: exact name matches first, then description matches)
        matching_tools.sort_by(|a, b| {
            let a_exact = a.name.to_lowercase() == query.to_lowercase();
            let b_exact = b.name.to_lowercase() == query.to_lowercase();

            if a_exact && !b_exact {
                std::cmp::Ordering::Less
            } else if !a_exact && b_exact {
                std::cmp::Ordering::Greater
            } else {
                // Sort by name if neither or both are exact matches
                a.name.cmp(&b.name)
            }
        });

        matching_tools
    }

    /// Get tool suggestions based on context
    pub async fn suggest_tools(&self, context: &serde_json::Value) -> Vec<ToolMetadata> {
        // Get available tools from the tool manager
        let available_tools = self.agent_manager.tools().list_tools();

        // Extract context information
        let user_message = context.get("message")
            .and_then(|m| m.as_str())
            .unwrap_or("")
            .to_lowercase();

        let empty_history = vec![];
        let conversation_history = context.get("conversation_history")
            .and_then(|h| h.as_array())
            .unwrap_or(&empty_history);

        let history_refs: Vec<&serde_json::Value> = conversation_history.iter().collect();
        let user_intent = self.extract_user_intent(&user_message, &history_refs);

        // Generate suggestions based on context and intent
        let mut suggestions = Vec::new();

        for tool_name in available_tools {
            let metadata = ToolMetadata {
                name: tool_name.clone(),
                description: format!("Tool: {}", tool_name),
                parameters: serde_json::json!({
                    "type": "object",
                    "properties": {}
                }),
                category: self.categorize_tool(&tool_name),
                tags: self.generate_tool_tags(&tool_name),
            };

            // Calculate relevance score
            let relevance_score = self.calculate_tool_relevance(&metadata, &user_intent, &user_message, &history_refs);

            // Include tool if it's relevant enough
            if relevance_score > 0.3 {
                suggestions.push((metadata, relevance_score));
            }
        }

        // Sort by relevance score (descending)
        suggestions.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));

        // Take top suggestions (max 10)
        suggestions.into_iter()
            .take(10)
            .map(|(metadata, _score)| metadata)
            .collect()
    }

    /// Get current provider information
    pub async fn get_provider_info(&self) -> Result<ProviderInfo> {
        self.agent_manager.providers().get_provider_info().await
    }

    /// Update configuration
    pub async fn update_config(&self, config: AgentConfig) -> Result<()> {
        self.agent_manager.update_config(config).await
    }

    /// Get current configuration
    pub async fn get_config(&self) -> AgentConfig {
        self.agent_manager.get_config().await
    }

    /// Get ReAct configuration
    pub async fn get_react_config(&self) -> Result<ReActConfig> {
        // For now, return default config
        // TODO: Store and retrieve ReAct config from AgentConfig
        Ok(ReActConfig::default())
    }

    // Helper methods for tool search

    /// Categorize a tool based on its name
    fn categorize_tool(&self, tool_name: &str) -> Option<String> {
        let name_lower = tool_name.to_lowercase();

        if name_lower.contains("search") || name_lower.contains("find") {
            Some("Search".to_string())
        } else if name_lower.contains("file") || name_lower.contains("read") || name_lower.contains("write") {
            Some("File System".to_string())
        } else if name_lower.contains("web") || name_lower.contains("http") || name_lower.contains("api") {
            Some("Network".to_string())
        } else if name_lower.contains("mcp") {
            Some("MCP".to_string())
        } else if name_lower.contains("embed") || name_lower.contains("vector") {
            Some("Embeddings".to_string())
        } else if name_lower.contains("image") || name_lower.contains("generate") {
            Some("Generation".to_string())
        } else if name_lower.contains("chat") || name_lower.contains("conversation") {
            Some("Communication".to_string())
        } else if name_lower.contains("database") || name_lower.contains("db") {
            Some("Database".to_string())
        } else if name_lower.contains("system") || name_lower.contains("process") {
            Some("System".to_string())
        } else {
            Some("General".to_string())
        }
    }

    /// Generate tags for a tool based on its name
    fn generate_tool_tags(&self, tool_name: &str) -> Vec<String> {
        let name_lower = tool_name.to_lowercase();
        let mut tags = Vec::new();

        // Add common tags based on keywords
        if name_lower.contains("async") {
            tags.push("async".to_string());
        }
        if name_lower.contains("mcp") {
            tags.push("mcp".to_string());
        }
        if name_lower.contains("tool") {
            tags.push("tool".to_string());
        }
        if name_lower.contains("execute") {
            tags.push("execution".to_string());
        }
        if name_lower.contains("list") {
            tags.push("listing".to_string());
        }
        if name_lower.contains("search") {
            tags.push("search".to_string());
        }
        if name_lower.contains("generate") {
            tags.push("generation".to_string());
        }
        if name_lower.contains("file") {
            tags.push("file".to_string());
        }

        // Add the tool name itself as a tag
        tags.push(tool_name.to_string());

        tags
    }

    /// Check if a tool matches a search query
    fn tool_matches_query(&self, metadata: &ToolMetadata, query: &str) -> bool {
        let query_lower = query.to_lowercase();

        // Check exact name match
        if metadata.name.to_lowercase() == query_lower {
            return true;
        }

        // Check if query is contained in tool name
        if metadata.name.to_lowercase().contains(&query_lower) {
            return true;
        }

        // Check description match
        if metadata.description.to_lowercase().contains(&query_lower) {
            return true;
        }

        // Check category match
        if let Some(category) = &metadata.category {
            if category.to_lowercase().contains(&query_lower) {
                return true;
            }
        }

        // Check tags match
        for tag in &metadata.tags {
            if tag.to_lowercase().contains(&query_lower) {
                return true;
            }
        }

        false
    }

    // Helper methods for tool suggestions

    /// Extract user intent from message and conversation history
    fn extract_user_intent(&self, message: &str, _history: &[&serde_json::Value]) -> UserIntent {
        let mut intent = UserIntent {
            primary_category: IntentCategory::General,
            keywords: Vec::new(),
            confidence: 0.5,
        };

        // Analyze message for intent indicators
        let message_lower = message.to_lowercase();

        // Search intent
        if message_lower.contains("search") || message_lower.contains("find") || message_lower.contains("look for") {
            intent.primary_category = IntentCategory::Search;
            intent.confidence = 0.8;
            intent.keywords.push("search".to_string());
        }
        // File operations intent
        else if message_lower.contains("file") || message_lower.contains("read") || message_lower.contains("write")
            || message_lower.contains("create") || message_lower.contains("delete") {
            intent.primary_category = IntentCategory::FileOperation;
            intent.confidence = 0.8;
            intent.keywords.push("file".to_string());
        }
        // Generation intent
        else if message_lower.contains("generate") || message_lower.contains("create") || message_lower.contains("make") {
            intent.primary_category = IntentCategory::Generation;
            intent.confidence = 0.7;
            intent.keywords.push("generate".to_string());
        }
        // Communication intent
        else if message_lower.contains("chat") || message_lower.contains("talk") || message_lower.contains("ask") {
            intent.primary_category = IntentCategory::Communication;
            intent.confidence = 0.6;
            intent.keywords.push("communication".to_string());
        }
        // Analysis intent
        else if message_lower.contains("analyze") || message_lower.contains("check") || message_lower.contains("review") {
            intent.primary_category = IntentCategory::Analysis;
            intent.confidence = 0.7;
            intent.keywords.push("analysis".to_string());
        }
        // MCP-specific intent
        else if message_lower.contains("mcp") {
            intent.primary_category = IntentCategory::MCP;
            intent.confidence = 0.9;
            intent.keywords.push("mcp".to_string());
        }

        intent
    }

    /// Calculate relevance score for a tool based on context
    fn calculate_tool_relevance(&self, metadata: &ToolMetadata, intent: &UserIntent, message: &str, _history: &[&serde_json::Value]) -> f32 {
        let mut score = 0.0;

        // Base score for tool availability
        score += 0.1;

        // Category matching with intent
        if let Some(tool_category) = &metadata.category {
            match intent.primary_category {
                IntentCategory::Search => {
                    if tool_category.to_lowercase().contains("search") {
                        score += 0.5;
                    }
                }
                IntentCategory::FileOperation => {
                    if tool_category.to_lowercase().contains("file") || tool_category.to_lowercase().contains("system") {
                        score += 0.5;
                    }
                }
                IntentCategory::Generation => {
                    if tool_category.to_lowercase().contains("generation") || tool_category.to_lowercase().contains("create") {
                        score += 0.5;
                    }
                }
                IntentCategory::Communication => {
                    if tool_category.to_lowercase().contains("communication") || tool_category.to_lowercase().contains("chat") {
                        score += 0.5;
                    }
                }
                IntentCategory::Analysis => {
                    if tool_category.to_lowercase().contains("embeddings") || tool_category.to_lowercase().contains("vector") {
                        score += 0.5;
                    }
                }
                IntentCategory::MCP => {
                    if tool_category.to_lowercase().contains("mcp") {
                        score += 0.5;
                    }
                }
                IntentCategory::General => {
                    // No specific category boost for general intent
                }
            }
        }

        // Keyword matching in tool name and description
        for keyword in &intent.keywords {
            if metadata.name.to_lowercase().contains(keyword) {
                score += 0.3;
            }
            if metadata.description.to_lowercase().contains(keyword) {
                score += 0.2;
            }
        }

        // Direct message keyword matching
        let message_words: Vec<&str> = message.split_whitespace().collect();
        for word in message_words {
            if metadata.name.to_lowercase().contains(word) {
                score += 0.2;
            }
            for tag in &metadata.tags {
                if tag.to_lowercase().contains(word) {
                    score += 0.1;
                }
            }
        }

        // Apply intent confidence as a multiplier
        score *= intent.confidence;

        // Cap the score at 1.0
        if score > 1.0 {
            score = 1.0;
        }

        score
    }

    // Private implementation methods

    async fn execute_chat(&self, request: ChatRequest) -> Result<ChatResponse> {
        // Get agent from provider manager
        let agent = self.agent_manager.providers().get_agent().await?;
        let client = self.agent_manager.providers().get_client().await?;

        let unified_agent = UnifiedAgent::new(agent, client);

        // Emit chat started event
        let start_event = AgentEvent::new(
            EventType::ChatStarted,
            "Chat Started".to_string(),
            "Chat started".to_string(),
        )
        .with_conversation_id(request.conversation_id.clone())
        .with_correlation_id(request.conversation_id.clone());

        let _ = self.agent_manager.events().emit(start_event).await;

        // Execute chat
        let response = unified_agent.chat(request.clone()).await;

        // Emit appropriate event based on result
        match &response {
            Ok(chat_response) => {
                let complete_event = AgentEvent::new(
                    EventType::ChatCompleted,
                    "Chat Completed".to_string(),
                    "Chat completed successfully".to_string(),
                )
                .with_conversation_id(request.conversation_id.clone())
                .with_message_id(chat_response.message.id.clone())
                .with_correlation_id(request.conversation_id.clone())
                .with_duration(chat_response.duration_ms)
                .with_data(serde_json::to_value(chat_response).unwrap_or_default());

                let _ = self.agent_manager.events().emit(complete_event).await;
            }
            Err(error) => {
                let error_event = AgentEvent::error(
                    "Chat Failed".to_string(),
                    format!("Chat failed: {}", error),
                    EventError::new(
                        "CHAT_ERROR".to_string(),
                        error.to_string(),
                        "ChatError".to_string(),
                    ),
                )
                .with_conversation_id(request.conversation_id.clone())
                .with_correlation_id(request.conversation_id.clone());

                let _ = self.agent_manager.events().emit(error_event).await;
            }
        }

        response
    }

    async fn execute_chat_stream(
        &self,
        request: ChatRequest,
    ) -> Result<Pin<Box<dyn Stream<Item = Result<StreamEvent>> + Send>>> {
        let agent = self.agent_manager.providers().get_agent().await?;
        let client = self.agent_manager.providers().get_client().await?;

        let unified_agent = UnifiedAgent::new(agent, client);
        unified_agent.chat_stream(request).await
    }

    async fn execute_chat_react(
        &self,
        request: ChatRequest,
    ) -> Result<Pin<Box<dyn Stream<Item = Result<StreamEvent>> + Send>>> {
        // For now, implement basic ReAct mode by delegating to chat_stream
        // TODO: Implement full ReAct reasoning loop with proper state management

        let agent = self.agent_manager.providers().get_agent().await?;
        let client = self.agent_manager.providers().get_client().await?;
        let unified_agent = UnifiedAgent::new(agent, client);

        // Create ReAct-specific events by wrapping the chat stream
        let chat_stream = unified_agent.chat_stream(request).await?;

        // For now, just return the chat stream as-is
        // Future enhancement: add ReAct events (thought, action, observation) around the chat stream
        Ok(chat_stream)
    }

    async fn execute_embeddings(&self, texts: Vec<String>) -> Result<Vec<Vec<f32>>> {
        let client = self.agent_manager.providers().get_client().await?;
        let agent = UnifiedAgent::new(self.agent_manager.providers().get_agent().await?, client);

        agent.generate_embeddings(texts).await
    }

    async fn execute_image_generation(
        &self,
        prompt: &str,
        params: Option<ImageGenerationParams>,
    ) -> Result<ImageGenerationResponse> {
        let client = self.agent_manager.providers().get_client().await?;
        let agent = UnifiedAgent::new(self.agent_manager.providers().get_agent().await?, client);

        let params_json = params.map(|p| serde_json::to_value(p).unwrap_or_default());
        let result = agent.generate_image(prompt, params_json).await?;

        serde_json::from_value(result).map_err(|e| AgentError::SerializationError(e))
    }
}

/// Convenience functions for creating capabilities

/// Create AI capability with default configuration
pub async fn create_ai_capability() -> Result<AICapability> {
    let config = AgentConfig::default();
    create_ai_capability_with_config(config).await
}

/// Create AI capability with custom configuration
pub async fn create_ai_capability_with_config(config: AgentConfig) -> Result<AICapability> {
    let agent_manager = super::AgentManager::new(config).await?;
    Ok(AICapability::new(Arc::new(agent_manager)))
}

/// Create AI capability from environment
pub async fn create_ai_capability_from_env() -> Result<AICapability> {
    let config = AgentConfig::default();
    create_ai_capability_with_config(config).await
}

