use serde::{Deserialize, Serialize};
use specta::Type;
use std::collections::HashMap;

/// AI Provider types
#[derive(Serialize, Deserialize, Type, Clone, Debug, PartialEq, Eq, Hash)]
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

/// Provider-specific configuration
#[derive(Serialize, Deserialize, Type, Clone, Debug)]
pub struct ProviderConfig {
    pub provider: AIProvider,
    pub model: String,
    pub api_key: Option<String>,
    pub base_url: Option<String>,
    pub temperature: Option<f32>,
    pub max_tokens: Option<u32>,
    pub top_p: Option<f32>,
    pub frequency_penalty: Option<f32>,
    pub presence_penalty: Option<f32>,
    #[specta(type = Option<i32>)] // Use Option<i32> for TypeScript compatibility
    pub timeout_seconds: Option<u64>,

    // Provider-specific settings
    pub azure_endpoint: Option<String>,
    pub azure_deployment: Option<String>,
    pub azure_api_version: Option<String>,
    pub anthropic_version: Option<String>,
    pub google_project_id: Option<String>,
    pub google_location: Option<String>,
    pub ollama_host: Option<String>,
    pub ollama_port: Option<u16>,
    pub custom_headers: Option<HashMap<String, String>>,
}

impl Default for ProviderConfig {
    fn default() -> Self {
        Self {
            provider: AIProvider::OpenAI,
            model: "gpt-4o-mini".to_string(),
            api_key: None,
            base_url: None,
            temperature: Some(0.7),
            max_tokens: Some(2000),
            top_p: None,
            frequency_penalty: None,
            presence_penalty: None,
            timeout_seconds: Some(60),
            azure_endpoint: None,
            azure_deployment: None,
            azure_api_version: None,
            anthropic_version: None,
            google_project_id: None,
            google_location: None,
            ollama_host: None,
            ollama_port: None,
            custom_headers: None,
        }
    }
}

/// Feature configuration
#[derive(Serialize, Deserialize, Type, Clone, Debug)]
pub struct FeatureConfig {
    pub enable_vision: Option<bool>,
    pub enable_tools: Option<bool>,
    pub enable_embeddings: Option<bool>,
    pub enable_image_generation: Option<bool>,
    pub enable_streaming: Option<bool>,
    pub enable_function_calling: Option<bool>,
    pub enable_react_mode: Option<bool>,
    pub max_iterations: Option<u32>,
    pub max_conversation_length: Option<u32>,
}

impl Default for FeatureConfig {
    fn default() -> Self {
        Self {
            enable_vision: Some(false),
            enable_tools: Some(true),
            enable_embeddings: Some(false),
            enable_image_generation: Some(false),
            enable_streaming: Some(true),
            enable_function_calling: Some(true),
            enable_react_mode: Some(false),
            max_iterations: Some(20),
            max_conversation_length: Some(50),
        }
    }
}

/// System prompt configuration
#[derive(Serialize, Deserialize, Type, Clone, Debug)]
pub struct SystemConfig {
    pub system_prompt: Option<String>,
    pub personality: Option<String>,
    pub behavior_guidelines: Option<Vec<String>>,
    pub response_format: Option<String>,
    pub knowledge_cutoff: Option<String>,
}

impl Default for SystemConfig {
    fn default() -> Self {
        Self {
            system_prompt: Some(
                "You are a helpful AI assistant integrated into a desktop application. \
                Provide helpful, accurate, and concise responses."
                    .to_string(),
            ),
            personality: None,
            behavior_guidelines: None,
            response_format: None,
            knowledge_cutoff: None,
        }
    }
}

/// Unified agent configuration
#[derive(Serialize, Deserialize, Type, Clone, Debug)]
pub struct AgentConfig {
    pub provider: ProviderConfig,
    pub features: FeatureConfig,
    pub system: SystemConfig,
}

impl Default for AgentConfig {
    fn default() -> Self {
        Self {
            provider: ProviderConfig::default(),
            features: FeatureConfig::default(),
            system: SystemConfig::default(),
        }
    }
}

impl AgentConfig {
    /// Create config for specific provider
    pub fn for_provider(provider: AIProvider, model: &str) -> Self {
        let mut config = Self::default();
        config.provider.provider = provider;
        config.provider.model = model.to_string();
        config
    }

    /// Get API key for current provider
    pub fn get_api_key(&self) -> Option<String> {
        self.provider
            .api_key
            .clone()
            .or_else(|| match self.provider.provider {
                AIProvider::OpenAI => std::env::var("OPENAI_API_KEY").ok(),
                AIProvider::Anthropic => std::env::var("ANTHROPIC_API_KEY").ok(),
                AIProvider::Google | AIProvider::GoogleGemini => {
                    std::env::var("GOOGLE_API_KEY").ok()
                }
                AIProvider::Groq => std::env::var("GROQ_API_KEY").ok(),
                AIProvider::Cohere => std::env::var("COHERE_API_KEY").ok(),
                AIProvider::Mistral => std::env::var("MISTRAL_API_KEY").ok(),
                AIProvider::TogetherAI => std::env::var("TOGETHER_API_KEY").ok(),
                AIProvider::HuggingFace => std::env::var("HUGGINGFACE_API_KEY").ok(),
                _ => None,
            })
    }

    /// Get base URL for current provider
    pub fn get_base_url(&self) -> Option<String> {
        self.provider
            .base_url
            .clone()
            .or_else(|| match self.provider.provider {
                AIProvider::OpenAI => std::env::var("OPENAI_BASE_URL").ok(),
                AIProvider::Anthropic => std::env::var("ANTHROPIC_BASE_URL").ok(),
                _ => None,
            })
    }

    /// Check if feature is enabled
    pub fn is_feature_enabled(&self, feature: &str) -> bool {
        match feature {
            "vision" => self.features.enable_vision.unwrap_or(false),
            "tools" => self.features.enable_tools.unwrap_or(true),
            "embeddings" => self.features.enable_embeddings.unwrap_or(false),
            "image_generation" => self.features.enable_image_generation.unwrap_or(false),
            "streaming" => self.features.enable_streaming.unwrap_or(true),
            "function_calling" => self.features.enable_function_calling.unwrap_or(true),
            "react_mode" => self.features.enable_react_mode.unwrap_or(false),
            _ => false,
        }
    }

    /// Get system prompt
    pub fn get_system_prompt(&self) -> String {
        self.system
            .system_prompt
            .clone()
            .unwrap_or_else(|| "You are a helpful AI assistant.".to_string())
    }
}
