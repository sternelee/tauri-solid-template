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
pub mod chat_commands;
pub mod image_generation;
pub mod embeddings;
pub mod providers;
pub mod context;
// pub mod enhanced_agent; // Temporarily commented
// pub mod enhanced_commands; // Temporarily commented

pub use agent::*;
pub use commands::*;
pub use tools::*;
pub use chat_commands::*;
pub use image_generation::*;
pub use embeddings::*;
pub use providers::*;
pub use context::*;
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
    Anthropic(rig::agent::Agent<rig::providers::anthropic::completion::CompletionModel<reqwest::Client>>),
    Gemini(rig::agent::Agent<rig::providers::gemini::completion::CompletionModel>),
    Groq(rig::agent::Agent<rig::providers::groq::CompletionModel<reqwest::Client>>),
    Cohere(rig::agent::Agent<rig::providers::cohere::completion::CompletionModel>),
    Mistral(rig::agent::Agent<rig::providers::mistral::CompletionModel>),
    Together(rig::agent::Agent<rig::providers::together::completion::CompletionModel>),
    HuggingFace(rig::agent::Agent<rig::providers::huggingface::completion::CompletionModel>),
}

// Dynamic client type
#[derive(Clone)]
pub enum DynamicClient {
    OpenAI(rig::providers::openai::Client),
    Anthropic(rig::providers::anthropic::Client),
    Gemini(rig::providers::gemini::Client),
    Groq(rig::providers::groq::Client),
    Cohere(rig::providers::cohere::Client),
    Mistral(rig::providers::mistral::Client),
    Together(rig::providers::together::Client),
    HuggingFace(rig::providers::huggingface::Client),
}

// AI Provider types
#[derive(Serialize, Deserialize, Type, Clone, Debug)]
pub enum AIProvider {
    OpenAI,
    OpenAIAzure,
    Anthropic,
    AnthropicVertex,
    Google,
    GoogleGemini,
    Ollama,
    Groq,
    Cohere,
    Mistral,
    TogetherAI,
    HuggingFace,
    Local,
    Custom,
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
    // Provider-specific configurations
    pub azure_endpoint: Option<String>,
    pub azure_deployment: Option<String>,
    pub azure_api_version: Option<String>,
    pub anthropic_version: Option<String>,
    pub google_project_id: Option<String>,
    pub google_location: Option<String>,
    pub ollama_host: Option<String>,
    pub ollama_port: Option<u16>,
    pub groq_model: Option<String>,
    pub cohere_model: Option<String>,
    pub mistral_model: Option<String>,
    pub together_model: Option<String>,
    pub huggingface_model: Option<String>,
    pub custom_config: Option<std::collections::HashMap<String, serde_json::Value>>,
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
            // Provider-specific defaults
            azure_endpoint: None,
            azure_deployment: None,
            azure_api_version: Some("2023-12-01-preview".to_string()),
            anthropic_version: Some("2023-06-01".to_string()),
            google_project_id: None,
            google_location: Some("us-central1".to_string()),
            ollama_host: Some("localhost".to_string()),
            ollama_port: Some(11434),
            groq_model: Some("llama3-8b-8192".to_string()),
            cohere_model: Some("command".to_string()),
            mistral_model: Some("mistral-tiny".to_string()),
            together_model: Some("meta-llama/Llama-2-7b-chat-hf".to_string()),
            huggingface_model: Some("microsoft/DialoGPT-medium".to_string()),
            custom_config: None,
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

// Source reference for context
#[derive(Serialize, Deserialize, Type, Clone, Debug)]
pub struct SourceReference {
    pub id: String,
    pub source_type: SourceType,
    pub path: String,
    pub name: Option<String>,
    pub description: Option<String>,
    pub metadata: Option<std::collections::HashMap<String, serde_json::Value>>,
}

#[derive(Serialize, Deserialize, Type, Clone, Debug)]
#[serde(tag = "type")]
pub enum SourceType {
    #[serde(rename = "file")]
    File {
        file_type: Option<String>, // e.g., "txt", "md", "pdf", "code"
        size: Option<f64>,
        last_modified: Option<String>,
    },
    #[serde(rename = "app")]
    App {
        bundle_id: Option<String>,
        app_name: Option<String>,
        version: Option<String>,
    },
    #[serde(rename = "url")]
    Url {
        url: String,
        title: Option<String>,
    },
    #[serde(rename = "conversation")]
    Conversation {
        conversation_id: String,
        title: Option<String>,
        message_count: Option<u32>,
    },
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
    pub sources: Option<Vec<SourceReference>>, // Context sources (@ and # references)
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
