use super::{AIProvider, AgentConfig, AgentError, Result};
use lazy_static::lazy_static;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

// Import rig providers and prelude
use rig::prelude::*;
use rig::providers;

/// Dynamic client type
#[derive(Clone)]
pub enum DynamicClient {
    OpenAI(providers::openai::Client),
    Anthropic(providers::anthropic::Client),
    Gemini(providers::gemini::Client),
    Groq(providers::groq::Client),
    Cohere(providers::cohere::Client),
    Mistral(providers::mistral::Client),
    Together(providers::together::Client),
    HuggingFace(providers::huggingface::Client),
}

/// Dynamic agent type
#[derive(Clone)]
pub enum DynamicAgent {
    OpenAI(
        rig::agent::Agent<
            providers::openai::responses_api::ResponsesCompletionModel<reqwest::Client>,
        >,
    ),
    Anthropic(
        rig::agent::Agent<providers::anthropic::completion::CompletionModel<reqwest::Client>>,
    ),
    Gemini(rig::agent::Agent<providers::gemini::completion::CompletionModel>),
    Groq(rig::agent::Agent<providers::groq::CompletionModel<reqwest::Client>>),
    Cohere(rig::agent::Agent<providers::cohere::completion::CompletionModel>),
    Mistral(rig::agent::Agent<providers::mistral::CompletionModel>),
    Together(rig::agent::Agent<providers::together::completion::CompletionModel>),
    HuggingFace(rig::agent::Agent<providers::huggingface::completion::CompletionModel>),
}

/// Provider configuration cache
#[derive(Clone)]
struct ProviderCache {
    client: Option<DynamicClient>,
    agent: Option<DynamicAgent>,
    last_updated: chrono::DateTime<chrono::Utc>,
}

impl Default for ProviderCache {
    fn default() -> Self {
        Self {
            client: None,
            agent: None,
            last_updated: chrono::Utc::now(),
        }
    }
}

/// Unified provider manager with lazy initialization and caching
pub struct ProviderManager {
    config: Arc<RwLock<AgentConfig>>,
    cache: Arc<RwLock<HashMap<AIProvider, ProviderCache>>>,
}

impl ProviderManager {
    pub async fn new(config: &AgentConfig) -> Result<Self> {
        let manager = Self {
            config: Arc::new(RwLock::new(config.clone())),
            cache: Arc::new(RwLock::new(HashMap::new())),
        };

        // Validate configuration
        manager.validate_config().await?;

        Ok(manager)
    }

    /// Validate current configuration
    async fn validate_config(&self) -> Result<()> {
        let config = self.config.read().await;

        // Check API key
        if config.get_api_key().is_none() {
            return Err(AgentError::ConfigurationError(
                "API key is required for the selected provider".to_string(),
            ));
        }

        // Check model
        if config.provider.model.is_empty() {
            return Err(AgentError::ConfigurationError(
                "Model name is required".to_string(),
            ));
        }

        Ok(())
    }

    /// Update provider configuration
    pub async fn update_config(&self, new_config: &AgentConfig) -> Result<()> {
        // Validate new config
        if new_config.get_api_key().is_none() {
            return Err(AgentError::ConfigurationError(
                "API key is required for the selected provider".to_string(),
            ));
        }

        // Clear cache for provider that changed
        let mut cache = self.cache.write().await;
        cache.remove(&new_config.provider.provider);

        // Update config
        *self.config.write().await = new_config.clone();

        Ok(())
    }

    /// Get or create client for current provider
    pub async fn get_client(&self) -> Result<DynamicClient> {
        let config = self.config.read().await;
        let provider = config.provider.provider.clone();

        // Check cache first
        {
            let cache = self.cache.read().await;
            if let Some(provider_cache) = cache.get(&provider) {
                if provider_cache.client.is_some() {
                    return Ok(provider_cache.client.clone().unwrap());
                }
            }
        }

        // Create new client
        let client = self.create_client(&config).await?;

        // Update cache
        {
            let mut cache = self.cache.write().await;
            let provider_cache = cache.entry(provider).or_default();
            provider_cache.client = Some(client.clone());
            provider_cache.last_updated = chrono::Utc::now();
        }

        Ok(client)
    }

    /// Get or create agent for current provider
    pub async fn get_agent(&self) -> Result<DynamicAgent> {
        let config = self.config.read().await;
        let provider = config.provider.provider.clone();

        // Check cache first
        {
            let cache = self.cache.read().await;
            if let Some(provider_cache) = cache.get(&provider) {
                if provider_cache.agent.is_some() {
                    return Ok(provider_cache.agent.clone().unwrap());
                }
            }
        }

        // Get client first
        let client = self.get_client().await?;

        // Create new agent
        let agent = self.create_agent(&client, &config).await?;

        // Update cache
        {
            let mut cache = self.cache.write().await;
            let provider_cache = cache.entry(provider).or_default();
            provider_cache.agent = Some(agent.clone());
            provider_cache.last_updated = chrono::Utc::now();
        }

        Ok(agent)
    }

    /// Create client for specific provider
    async fn create_client(&self, config: &AgentConfig) -> Result<DynamicClient> {
        let api_key = config
            .get_api_key()
            .ok_or_else(|| AgentError::ConfigurationError("API key is required".to_string()))?;

        let base_url = config.get_base_url();

        match config.provider.provider {
            AIProvider::OpenAI => {
                let client = if let Some(url) = base_url {
                    providers::openai::Client::builder(&api_key)
                        .base_url(&url)
                        .build()
                } else {
                    providers::openai::Client::new(&api_key)
                };
                Ok(DynamicClient::OpenAI(client))
            }

            AIProvider::Anthropic => {
                // TODO: Implement Anthropic client when rig API is verified
                Err(AgentError::ProviderNotInitialized)
            }

            AIProvider::Google | AIProvider::GoogleGemini => {
                let client = providers::gemini::Client::new(&api_key);
                Ok(DynamicClient::Gemini(client))
            }

            AIProvider::Groq => {
                let client = providers::groq::Client::new(&api_key);
                Ok(DynamicClient::Groq(client))
            }

            AIProvider::Cohere => {
                let client = providers::cohere::Client::new(&api_key);
                Ok(DynamicClient::Cohere(client))
            }

            AIProvider::Mistral => {
                let client = providers::mistral::Client::new(&api_key);
                Ok(DynamicClient::Mistral(client))
            }

            AIProvider::TogetherAI => {
                let client = providers::together::Client::new(&api_key);
                Ok(DynamicClient::Together(client))
            }

            AIProvider::HuggingFace => {
                let client = providers::huggingface::Client::new(&api_key);
                Ok(DynamicClient::HuggingFace(client))
            }

            _ => Err(AgentError::UnsupportedProvider(format!(
                "{:?}",
                config.provider.provider
            ))),
        }
    }

    /// Create agent for specific client and configuration
    async fn create_agent(
        &self,
        client: &DynamicClient,
        config: &AgentConfig,
    ) -> Result<DynamicAgent> {
        let model = &config.provider.model;
        let temperature = config.provider.temperature.unwrap_or(0.7) as f64;
        let system_prompt = config.get_system_prompt();

        match client {
            DynamicClient::OpenAI(openai_client) => {
                // Create agent with OpenAI client using the correct pattern
                let mut agent_builder = openai_client.agent(model);

                if !system_prompt.is_empty() {
                    agent_builder = agent_builder.preamble(&system_prompt);
                }

                let agent = agent_builder.build();

                Ok(DynamicAgent::OpenAI(agent))
            }

            DynamicClient::Anthropic(anthropic_client) => {
                // TODO: Implement Anthropic agent creation when API is verified
                Err(AgentError::ProviderNotInitialized)
            }

            DynamicClient::Gemini(gemini_client) => {
                // Create agent with Gemini client
                let mut agent_builder = gemini_client.agent(model);

                if !system_prompt.is_empty() {
                    agent_builder = agent_builder.preamble(&system_prompt);
                }

                let agent = agent_builder.build();

                Ok(DynamicAgent::Gemini(agent))
            }

            DynamicClient::Groq(groq_client) => {
                // Create agent with Groq client
                let mut agent_builder = groq_client.agent(model);

                if !system_prompt.is_empty() {
                    agent_builder = agent_builder.preamble(&system_prompt);
                }

                let agent = agent_builder.build();

                Ok(DynamicAgent::Groq(agent))
            }

            DynamicClient::Cohere(cohere_client) => {
                // Create agent with Cohere client
                let mut agent_builder = cohere_client.agent(model);

                if !system_prompt.is_empty() {
                    agent_builder = agent_builder.preamble(&system_prompt);
                }

                let agent = agent_builder.build();

                Ok(DynamicAgent::Cohere(agent))
            }

            DynamicClient::Mistral(mistral_client) => {
                // Create agent with Mistral client
                let mut agent_builder = mistral_client.agent(model);

                if !system_prompt.is_empty() {
                    agent_builder = agent_builder.preamble(&system_prompt);
                }

                let agent = agent_builder.build();

                Ok(DynamicAgent::Mistral(agent))
            }

            DynamicClient::Together(together_client) => {
                // Create agent with Together client
                let mut agent_builder = together_client.agent(model);

                if !system_prompt.is_empty() {
                    agent_builder = agent_builder.preamble(&system_prompt);
                }

                let agent = agent_builder.build();

                Ok(DynamicAgent::Together(agent))
            }

            DynamicClient::HuggingFace(huggingface_client) => {
                // Create agent with HuggingFace client
                let mut agent_builder = huggingface_client.agent(model);

                if !system_prompt.is_empty() {
                    agent_builder = agent_builder.preamble(&system_prompt);
                }

                let agent = agent_builder.build();

                Ok(DynamicAgent::HuggingFace(agent))
            }
        }
    }

    /// Get current provider information
    pub async fn get_provider_info(&self) -> Result<ProviderInfo> {
        let config = self.config.read().await;

        Ok(ProviderInfo {
            provider: config.provider.provider.clone(),
            model: config.provider.model.clone(),
            has_api_key: config.get_api_key().is_some(),
            base_url: config.get_base_url(),
            supported_features: self.get_supported_features(&config.provider.provider),
        })
    }

    /// Get default client for the current provider
    pub async fn get_default_client(&self) -> Result<DynamicClient> {
        let config = self.config.read().await;
        self.create_client(&config).await
    }

    /// Get supported features for provider
    fn get_supported_features(&self, provider: &AIProvider) -> Vec<String> {
        match provider {
            AIProvider::OpenAI => vec![
                "chat".to_string(),
                "streaming".to_string(),
                "function_calling".to_string(),
                "vision".to_string(),
                "embeddings".to_string(),
                "image_generation".to_string(),
            ],
            AIProvider::Anthropic => vec![
                "chat".to_string(),
                "streaming".to_string(),
                "function_calling".to_string(),
                "vision".to_string(),
            ],
            AIProvider::Google | AIProvider::GoogleGemini => vec![
                "chat".to_string(),
                "streaming".to_string(),
                "function_calling".to_string(),
                "vision".to_string(),
                "embeddings".to_string(),
            ],
            AIProvider::Groq => vec![
                "chat".to_string(),
                "streaming".to_string(),
                "function_calling".to_string(),
            ],
            AIProvider::Cohere => vec![
                "chat".to_string(),
                "streaming".to_string(),
                "embeddings".to_string(),
            ],
            AIProvider::Mistral => vec![
                "chat".to_string(),
                "streaming".to_string(),
                "function_calling".to_string(),
            ],
            AIProvider::TogetherAI => vec![
                "chat".to_string(),
                "streaming".to_string(),
                "function_calling".to_string(),
            ],
            AIProvider::HuggingFace => vec!["chat".to_string(), "embeddings".to_string()],
            _ => vec!["chat".to_string()],
        }
    }

    /// Clear all caches
    pub async fn clear_cache(&self) {
        let mut cache = self.cache.write().await;
        cache.clear();
    }

    /// Clear cache for specific provider
    pub async fn clear_provider_cache(&self, provider: &AIProvider) {
        let mut cache = self.cache.write().await;
        cache.remove(provider);
    }
}

/// Provider information
#[derive(serde::Serialize, serde::Deserialize, specta::Type, Clone, Debug)]
pub struct ProviderInfo {
    pub provider: AIProvider,
    pub model: String,
    pub has_api_key: bool,
    pub base_url: Option<String>,
    pub supported_features: Vec<String>,
}

/// Global provider manager instance
lazy_static! {
    static ref PROVIDER_MANAGER: tokio::sync::Mutex<Option<Arc<ProviderManager>>> =
        tokio::sync::Mutex::const_new(None);
}

/// Initialize global provider manager
pub async fn init_provider_manager(config: &AgentConfig) -> Result<()> {
    let manager = Arc::new(ProviderManager::new(config).await?);
    let mut global = PROVIDER_MANAGER.lock().await;
    *global = Some(manager);
    Ok(())
}

/// Get global provider manager
pub async fn get_provider_manager() -> Option<Arc<ProviderManager>> {
    PROVIDER_MANAGER.lock().await.clone()
}

/// Get provider manager or return error
pub async fn require_provider_manager() -> Result<Arc<ProviderManager>> {
    get_provider_manager()
        .await
        .ok_or(AgentError::ProviderNotInitialized)
}

