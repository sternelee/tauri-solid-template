use crate::rig_agent_v2::core::*;
use crate::rig_agent_v2::events::*;
use crate::rig_agent_v2::tools::*;
use futures::Stream;
use std::pin::Pin;
use std::sync::Arc;

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

    /// Search tools (placeholder)
    pub async fn search_tools(&self, _query: &str) -> Vec<ToolMetadata> {
        // TODO: Implement tool search
        vec![]
    }

    /// Get tool suggestions (placeholder)
    pub async fn suggest_tools(&self, _context: &serde_json::Value) -> Vec<ToolMetadata> {
        // TODO: Implement tool suggestions
        vec![]
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
        // For now, just use chat_stream
        // TODO: Implement ReAct mode
        let agent = self.agent_manager.providers().get_agent().await?;
        let client = self.agent_manager.providers().get_client().await?;

        let unified_agent = UnifiedAgent::new(agent, client);
        unified_agent.chat_stream(request).await
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

