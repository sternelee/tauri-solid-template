use serde::{Deserialize, Serialize};
use specta::Type;
use std::collections::HashMap;
use thiserror::Error;

pub mod agent;
pub mod config;
pub mod provider;
pub mod types;

pub use agent::*;
pub use config::*;
pub use provider::*;
pub use types::*;

/// Unified error types
#[derive(Debug, Error)]
pub enum AgentError {
    #[error("Provider not supported: {0}")]
    UnsupportedProvider(String),

    #[error("Provider not initialized")]
    ProviderNotInitialized,

    #[error("Configuration error: {0}")]
    ConfigurationError(String),

    #[error("API error: {0}")]
    ApiError(String),

    #[error("Tool execution failed: {0}")]
    ToolError(String),

    #[error("Chat completion failed: {0}")]
    ChatError(String),

    #[error("Embedding failed: {0}")]
    EmbeddingError(String),

    #[error("Image generation failed: {0}")]
    ImageGenerationError(String),

    #[error("Streaming error: {0}")]
    StreamingError(String),

    #[error("Rate limit exceeded")]
    RateLimitExceeded,

    #[error("Request timed out")]
    Timeout,

    #[error("Request cancelled")]
    Cancelled,

    #[error("Invalid request: {0}")]
    InvalidRequest(String),

    #[error("Resource not found: {0}")]
    NotFound(String),

    #[error("Initialization failed: {0}")]
    InitializationFailed(String),

    #[error("Not initialized")]
    NotInitialized,

    #[error("Not implemented")]
    NotImplemented,

    #[error("Serialization error: {0}")]
    SerializationError(#[from] serde_json::Error),

    #[error("IO error: {0}")]
    IoError(#[from] std::io::Error),

    #[error("Network error: {0}")]
    NetworkError(String),

    #[error("Authentication failed")]
    AuthenticationFailed,

    #[error("Insufficient credits")]
    InsufficientCredits,

    #[error("Model not available: {0}")]
    ModelNotAvailable(String),

    #[error("Token limit exceeded")]
    TokenLimitExceeded,

    #[error("Custom error: {0}")]
    Custom(String),
}

impl From<rig::completion::CompletionError> for AgentError {
    fn from(err: rig::completion::CompletionError) -> Self {
        AgentError::ChatError(err.to_string())
    }
}

impl From<rig::tool::ToolSetError> for AgentError {
    fn from(err: rig::tool::ToolSetError) -> Self {
        AgentError::ToolError(err.to_string())
    }
}

/// Result type for agent operations
pub type Result<T> = std::result::Result<T, AgentError>;

/// Streaming result type
pub type StreamResult<T> = std::result::Result<T, AgentError>;

