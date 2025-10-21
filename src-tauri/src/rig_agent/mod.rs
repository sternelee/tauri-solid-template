use base64::{engine::general_purpose, Engine as _};
use rig::completion::Prompt;
use rig::prelude::*;
use rig::providers::openai;
use serde::{Deserialize, Serialize};
use specta::Type;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::{Mutex, Notify};

// Re-export different provider types for extensibility
pub use rig::providers::anthropic as anthropic_provider;
pub use rig::providers::openai as openai_provider;

pub mod agent;
pub mod commands;
pub mod tools;
// pub mod enhanced_agent; // Temporarily commented
// pub mod enhanced_commands; // Temporarily commented

pub use agent::*;
pub use commands::*;
pub use tools::*;
// pub use enhanced_agent::*; // Temporarily commented
// pub use enhanced_commands::*; // Temporarily commented

// Type aliases for different agent types
pub type OpenAIAgent = rig::agent::Agent<
    rig::providers::openai::responses_api::ResponsesCompletionModel<reqwest::Client>,
>;

// Dynamic agent type to support multiple providers
#[derive(Clone)]
pub enum DynamicAgent {
    OpenAI(OpenAIAgent),
    // Anthropic(rig::agent::Agent<rig::providers::anthropic::Client>),
    // Add more providers as needed
}

// Dynamic client type
#[derive(Clone)]
pub enum DynamicClient {
    OpenAI(openai::Client),
    // Anthropic(rig::providers::anthropic::Client),
    // Add more providers as needed
}

// AI Provider types
#[derive(Serialize, Deserialize, Type, Clone, Debug)]
pub enum AIProvider {
    OpenAI,
    Anthropic,
    Google,
    Ollama,
    Local,
}

// Agent configuration structure following the jan-dev pattern
#[derive(Serialize, Deserialize, Type, Clone, Debug)]
pub struct AgentConfig {
    pub provider: AIProvider,
    pub model: String,
    pub preamble: Option<String>,
    pub temperature: Option<f32>,
    pub max_tokens: Option<u32>,
    pub max_iterations: Option<u32>,
    pub stream_events: Option<bool>,
    pub api_key: Option<String>,
    pub base_url: Option<String>,
    pub enable_vision: Option<bool>,
    pub enable_tools: Option<bool>,
    pub enable_embeddings: Option<bool>,
}

impl Default for AgentConfig {
    fn default() -> Self {
        Self {
            provider: AIProvider::OpenAI,
            model: "gpt-4o-mini".to_string(),
            preamble: Some("You are a helpful AI assistant integrated into a desktop application. Provide helpful, concise responses.".to_string()),
            temperature: Some(0.7),
            max_tokens: Some(1000),
            max_iterations: Some(20),
            stream_events: Some(true),
            api_key: None,
            base_url: None,
            enable_vision: Some(false),
            enable_tools: Some(true),
            enable_embeddings: Some(false),
        }
    }
}

// Image content structure for vision models
#[derive(Serialize, Deserialize, Type, Clone, Debug)]
pub struct ImageContent {
    pub url: Option<String>,
    pub base64_data: Option<String>,
    pub media_type: Option<String>, // e.g., "image/png", "image/jpeg"
    pub width: Option<u32>,
    pub height: Option<u32>,
    pub description: Option<String>,
}

impl ImageContent {
    pub fn from_base64(data: String, media_type: String) -> Self {
        Self {
            url: None,
            base64_data: Some(data),
            media_type: Some(media_type),
            width: None,
            height: None,
            description: None,
        }
    }

    pub fn from_url(url: String) -> Self {
        Self {
            url: Some(url),
            base64_data: None,
            media_type: None,
            width: None,
            height: None,
            description: None,
        }
    }
}

// Content types for multimodal messages
#[derive(Serialize, Deserialize, Type, Clone, Debug)]
pub enum ContentPart {
    Text { text: String },
    Image { image: ImageContent },
}

// Chat request structure following clean API design
#[derive(Serialize, Deserialize, Type, Debug)]
pub struct ChatRequest {
    pub message: String,
    pub conversation_id: Option<String>,
    pub content_parts: Option<Vec<ContentPart>>, // For multimodal content
    pub tools: Option<Vec<ToolDefinition>>,
    pub parameters: Option<std::collections::HashMap<String, serde_json::Value>>,
    pub use_vision: Option<bool>,
    pub enable_tool_calling: Option<bool>,
}

// Embedding request structure
#[derive(Serialize, Deserialize, Type, Debug)]
pub struct EmbeddingRequest {
    pub input: String, // Single text or array of texts
    pub model: String,
    pub encoding_format: Option<String>, // "float" or "base64"
    pub dimensions: Option<u32>,
}

// Embedding response structure
#[derive(Serialize, Deserialize, Type, Debug, Clone)]
pub struct EmbeddingResponse {
    pub object: String,
    pub data: Vec<EmbeddingData>,
    pub model: String,
    pub usage: EmbeddingUsage,
}

#[derive(Serialize, Deserialize, Type, Debug, Clone)]
pub struct EmbeddingData {
    pub object: String,
    pub embedding: Vec<f32>, // The embedding vector
    pub index: u32,
}

#[derive(Serialize, Deserialize, Type, Debug, Clone)]
pub struct EmbeddingUsage {
    pub prompt_tokens: u32,
    pub total_tokens: u32,
}

// Chat response structure with comprehensive information
#[derive(Serialize, Deserialize, Type, Debug, Clone)]
pub struct ChatResponse {
    pub content: String,
    pub model_used: String,
    pub conversation_id: String,
    pub message_id: String,
    pub tokens_used: Option<u32>,
    pub finish_reason: Option<String>,
    pub tool_calls: Option<Vec<serde_json::Value>>,
    pub status: ChatStatus,
}

#[derive(Serialize, Deserialize, Type, Debug, Clone)]
pub enum ChatStatus {
    Completed,
    Streaming,
    Error,
    Cancelled,
}

// Stream events for real-time updates
#[derive(Serialize, Deserialize, Type, Debug, Clone)]
pub enum ChatStreamEvent {
    Start {
        conversation_id: String,
        message_id: String,
    },
    Token {
        content: String,
    },
    ToolCall {
        tool: serde_json::Value,
    },
    Complete {
        response: ChatResponse,
    },
    Error {
        error: String,
    },
    Cancelled,
}

// Enhanced message structure
#[derive(Serialize, Deserialize, Type, Clone, Debug)]
pub struct ChatMessage {
    pub id: String,
    pub role: String, // "user" or "assistant"
    pub content: String,
    pub timestamp: String,
    pub tool_calls: Option<Vec<serde_json::Value>>,
    pub metadata: Option<std::collections::HashMap<String, serde_json::Value>>,
}

// Conversation state with better structure
#[derive(Serialize, Deserialize, Type, Debug, Clone)]
pub struct Conversation {
    pub id: String,
    pub messages: Vec<ChatMessage>,
    pub created_at: String,
    pub updated_at: String,
    pub metadata: std::collections::HashMap<String, serde_json::Value>,
}

// Error types following the jan-dev pattern
#[derive(Debug, thiserror::Error)]
pub enum AgentError {
    #[error("Agent not initialized")]
    NotInitialized,

    #[error("Initialization failed: {0}")]
    InitializationFailed(String),

    #[error("Completion failed: {0}")]
    CompletionFailed(#[from] rig::completion::CompletionError),

    #[error("Prompt failed: {0}")]
    PromptFailed(String),

    #[error("Tool execution failed: {0}")]
    ToolFailed(#[from] rig::tool::ToolSetError),

    #[error("Configuration error: {0}")]
    ConfigurationError(String),

    #[error("API error: {0}")]
    ApiError(String),

    #[error("Request cancelled")]
    Cancelled,

    #[error("Custom error: {0}")]
    Custom(String),
}

impl From<AgentError> for String {
    fn from(error: AgentError) -> Self {
        error.to_string()
    }
}

// Main agent state management following jan-dev patterns
pub struct AgentState {
    pub client: Arc<Mutex<Option<DynamicClient>>>,
    pub agent: Arc<Mutex<Option<DynamicAgent>>>,
    pub conversations: Arc<Mutex<std::collections::HashMap<String, Conversation>>>,
    pub active_streams: Arc<Mutex<std::collections::HashMap<String, Arc<Notify>>>>,
    pub config: Arc<Mutex<Option<AgentConfig>>>,
}

impl Default for AgentState {
    fn default() -> Self {
        Self {
            client: Arc::new(Mutex::new(None)),
            agent: Arc::new(Mutex::new(None)),
            conversations: Arc::new(Mutex::new(std::collections::HashMap::new())),
            active_streams: Arc::new(Mutex::new(std::collections::HashMap::new())),
            config: Arc::new(Mutex::new(None)),
        }
    }
}

impl AgentState {
    pub fn new() -> Self {
        Self::default()
    }

    pub async fn is_initialized(&self) -> bool {
        self.agent.lock().await.is_some()
    }

    pub async fn get_config(&self) -> Option<AgentConfig> {
        self.config.lock().await.clone()
    }

    pub async fn set_config(&self, config: AgentConfig) {
        *self.config.lock().await = Some(config);
    }

    pub async fn create_conversation(&self) -> String {
        let conversation_id = uuid::Uuid::new_v4().to_string();
        let now = chrono::Utc::now().to_rfc3339();

        let conversation = Conversation {
            id: conversation_id.clone(),
            messages: Vec::new(),
            created_at: now.clone(),
            updated_at: now,
            metadata: HashMap::new(),
        };

        self.conversations
            .lock()
            .await
            .insert(conversation_id.clone(), conversation);
        conversation_id
    }

    pub async fn get_conversation(&self, id: &str) -> Option<Conversation> {
        self.conversations.lock().await.get(id).cloned()
    }

    pub async fn update_conversation<F>(&self, id: &str, updater: F) -> Result<(), AgentError>
    where
        F: FnOnce(&mut Conversation),
    {
        let mut conversations = self.conversations.lock().await;
        if let Some(conversation) = conversations.get_mut(id) {
            updater(conversation);
            conversation.updated_at = chrono::Utc::now().to_rfc3339();
            Ok(())
        } else {
            Err(AgentError::ConfigurationError(format!(
                "Conversation {} not found",
                id
            )))
        }
    }

    pub async fn add_message(
        &self,
        conversation_id: &str,
        message: ChatMessage,
    ) -> Result<(), AgentError> {
        self.update_conversation(conversation_id, |conv| {
            conv.messages.push(message);
        })
        .await
    }

    pub async fn create_stream_cancellation(&self, stream_id: String) -> Arc<Notify> {
        let notify = Arc::new(Notify::new());
        self.active_streams
            .lock()
            .await
            .insert(stream_id, notify.clone());
        notify
    }

    pub async fn cancel_stream(&self, stream_id: &str) -> Result<(), AgentError> {
        let mut streams = self.active_streams.lock().await;
        if let Some(notify) = streams.remove(stream_id) {
            notify.notify_one();
            Ok(())
        } else {
            Err(AgentError::ConfigurationError(format!(
                "Stream {} not found",
                stream_id
            )))
        }
    }

    pub async fn cleanup_stream(&self, stream_id: &str) {
        self.active_streams.lock().await.remove(stream_id);
    }

    // New methods for enhanced functionality

    pub async fn get_chat_history(
        &self,
        conversation_id: &str,
    ) -> Result<Vec<ChatMessage>, AgentError> {
        self.get_conversation(conversation_id)
            .await
            .map(|conv| conv.messages)
            .ok_or_else(|| {
                AgentError::ConfigurationError(format!(
                    "Conversation {} not found",
                    conversation_id
                ))
            })
    }

    pub async fn get_provider(&self) -> Option<AIProvider> {
        self.config
            .lock()
            .await
            .as_ref()
            .map(|config| config.provider.clone())
    }

    pub async fn is_vision_enabled(&self) -> bool {
        self.config
            .lock()
            .await
            .as_ref()
            .and_then(|c| c.enable_vision)
            .unwrap_or(false)
    }

    pub async fn are_tools_enabled(&self) -> bool {
        self.config
            .lock()
            .await
            .as_ref()
            .and_then(|c| c.enable_tools)
            .unwrap_or(true)
    }

    pub async fn are_embeddings_enabled(&self) -> bool {
        self.config
            .lock()
            .await
            .as_ref()
            .and_then(|c| c.enable_embeddings)
            .unwrap_or(false)
    }
}
