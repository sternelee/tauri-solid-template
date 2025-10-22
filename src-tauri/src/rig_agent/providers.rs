use super::*;
use rig::providers;

// Provider factory for creating AI clients and agents
pub struct ProviderFactory;

impl ProviderFactory {
    // Create a client based on provider configuration
    pub async fn create_client(config: &AgentConfig) -> Result<DynamicClient, AgentError> {
        match config.provider {
            AIProvider::OpenAI => {
                let client = match config.api_key.as_ref() {
                    Some(api_key) => {
                        if let Some(base_url) = &config.base_url {
                            // Custom base URL for Azure OpenAI or custom endpoints
                            providers::openai::Client::builder(api_key)
                                .base_url(base_url)
                                .build()
                        } else {
                            providers::openai::Client::new(api_key)
                        }
                    }
                    None => providers::openai::Client::from_env(),
                };
                Ok(DynamicClient::OpenAI(client))
            }

            AIProvider::Anthropic => {
                let client = match config.api_key.as_ref() {
                    Some(api_key) => providers::anthropic::Client::new(api_key),
                    None => providers::anthropic::Client::from_env(),
                };
                Ok(DynamicClient::Anthropic(client))
            }

            AIProvider::Google => {
                let client = match config.api_key.as_ref() {
                    Some(api_key) => providers::gemini::Client::new(api_key),
                    None => providers::gemini::Client::from_env(),
                };
                Ok(DynamicClient::Gemini(client))
            }

            AIProvider::Groq => {
                let client = match config.api_key.as_ref() {
                    Some(api_key) => providers::groq::Client::new(api_key),
                    None => providers::groq::Client::from_env(),
                };
                Ok(DynamicClient::Groq(client))
            }

            AIProvider::Cohere => {
                let client = match config.api_key.as_ref() {
                    Some(api_key) => providers::cohere::Client::new(api_key),
                    None => providers::cohere::Client::from_env(),
                };
                Ok(DynamicClient::Cohere(client))
            }

            AIProvider::Mistral => {
                let client = match config.api_key.as_ref() {
                    Some(api_key) => providers::mistral::Client::new(api_key),
                    None => providers::mistral::Client::from_env(),
                };
                Ok(DynamicClient::Mistral(client))
            }

            AIProvider::TogetherAI => {
                let client = match config.api_key.as_ref() {
                    Some(api_key) => providers::together::Client::new(api_key),
                    None => providers::together::Client::from_env(),
                };
                Ok(DynamicClient::Together(client))
            }

            AIProvider::HuggingFace => {
                let client = match config.api_key.as_ref() {
                    Some(api_key) => providers::huggingface::Client::new(api_key),
                    None => providers::huggingface::Client::from_env(),
                };
                Ok(DynamicClient::HuggingFace(client))
            }

            _ => Err(AgentError::ConfigurationError(
                format!("Provider {:?} not yet implemented", config.provider)
            ))
        }
    }

    // Create an agent based on provider configuration
    pub async fn create_agent(client: &DynamicClient, config: &AgentConfig) -> Result<DynamicAgent, AgentError> {
        let model = config.model.clone();
        let temperature = config.temperature.unwrap_or(0.7) as f64;

        let agent = match client {
            DynamicClient::OpenAI(openai_client) => {
                let mut agent_builder = openai_client.agent(&model);

                if let Some(preamble) = &config.preamble {
                    agent_builder = agent_builder.preamble(preamble);
                }

                agent_builder = agent_builder.temperature(temperature);
                DynamicAgent::OpenAI(agent_builder.build())
            }

            DynamicClient::Anthropic(anthropic_client) => {
                let mut agent_builder = anthropic_client.agent(&model);

                if let Some(preamble) = &config.preamble {
                    agent_builder = agent_builder.preamble(preamble);
                }

                agent_builder = agent_builder.temperature(temperature);
                DynamicAgent::Anthropic(agent_builder.build())
            }

            DynamicClient::Gemini(gemini_client) => {
                let mut agent_builder = gemini_client.agent(&model);

                if let Some(preamble) = &config.preamble {
                    agent_builder = agent_builder.preamble(preamble);
                }

                agent_builder = agent_builder.temperature(temperature);
                DynamicAgent::Gemini(agent_builder.build())
            }

            DynamicClient::Groq(groq_client) => {
                let mut agent_builder = groq_client.agent(&model);

                if let Some(preamble) = &config.preamble {
                    agent_builder = agent_builder.preamble(preamble);
                }

                agent_builder = agent_builder.temperature(temperature);
                DynamicAgent::Groq(agent_builder.build())
            }

            DynamicClient::Cohere(cohere_client) => {
                let mut agent_builder = cohere_client.agent(&model);

                if let Some(preamble) = &config.preamble {
                    agent_builder = agent_builder.preamble(preamble);
                }

                agent_builder = agent_builder.temperature(temperature);
                DynamicAgent::Cohere(agent_builder.build())
            }

            DynamicClient::Mistral(mistral_client) => {
                let mut agent_builder = mistral_client.agent(&model);

                if let Some(preamble) = &config.preamble {
                    agent_builder = agent_builder.preamble(preamble);
                }

                agent_builder = agent_builder.temperature(temperature);
                DynamicAgent::Mistral(agent_builder.build())
            }

            DynamicClient::Together(together_client) => {
                let mut agent_builder = together_client.agent(&model);

                if let Some(preamble) = &config.preamble {
                    agent_builder = agent_builder.preamble(preamble);
                }

                agent_builder = agent_builder.temperature(temperature);
                DynamicAgent::Together(agent_builder.build())
            }

            DynamicClient::HuggingFace(huggingface_client) => {
                let mut agent_builder = huggingface_client.agent(&model);

                if let Some(preamble) = &config.preamble {
                    agent_builder = agent_builder.preamble(preamble);
                }

                agent_builder = agent_builder.temperature(temperature);
                DynamicAgent::HuggingFace(agent_builder.build())
            }
        };

        Ok(agent)
    }

    // Get available models for a provider
    pub fn get_available_models(provider: &AIProvider) -> Vec<String> {
        match provider {
            AIProvider::OpenAI => vec![
                providers::openai::GPT_4O.to_string(),
                providers::openai::GPT_4O_MINI.to_string(),
                providers::openai::GPT_4_TURBO.to_string(),
                providers::openai::GPT_4.to_string(),
                providers::openai::GPT_35_TURBO.to_string(),
            ],
            AIProvider::Anthropic => vec![
                providers::anthropic::CLAUDE_3_5_SONNET.to_string(),
                providers::anthropic::CLAUDE_3_OPUS.to_string(),
                providers::anthropic::CLAUDE_3_SONNET.to_string(),
                providers::anthropic::CLAUDE_3_HAIKU.to_string(),
            ],
            AIProvider::Google => vec![
                "gemini-1.5-pro".to_string(),
                "gemini-1.5-flash".to_string(),
                "gemini-1.0-pro".to_string(),
            ],
            AIProvider::Groq => vec![
                providers::groq::LLAMA_3_2_70B_VERSATILE.to_string(),
                providers::groq::LLAMA_3_1_8B_INSTANT.to_string(),
                "mixtral-8x7b-32768".to_string(),
            ],
            AIProvider::Cohere => vec![
                providers::cohere::COMMAND_R.to_string(),
                providers::cohere::COMMAND_R_PLUS.to_string(),
                providers::cohere::COMMAND.to_string(),
            ],
            AIProvider::Mistral => vec![
                providers::mistral::MISTRAL_LARGE.to_string(),
                "mistral-medium".to_string(),
                providers::mistral::MISTRAL_SMALL.to_string(),
            ],
            AIProvider::TogetherAI => vec![
                providers::together::LLAMA_3_1_70B_INSTRUCT_TURBO.to_string(),
                "meta-llama/Llama-3.1-8B-Instruct-Turbo".to_string(),
                "Qwen/Qwen2-72B-Instruct-Turbo".to_string(),
            ],
            AIProvider::HuggingFace => vec![
                "microsoft/Phi-4-mini-instruct".to_string(),
                "meta-llama/Llama-3.1-70B-Instruct".to_string(),
                "mistralai/Mixtral-8x7B-Instruct-v0.1".to_string(),
            ],
            _ => vec![
                "model-not-available".to_string(),
            ],
        }
    }

    // Validate provider configuration
    pub fn validate_config(config: &AgentConfig) -> Result<(), AgentError> {
        // All rig providers can handle API key from config or environment
        match config.provider {
            AIProvider::OpenAI |
            AIProvider::Anthropic |
            AIProvider::Google |
            AIProvider::Groq |
            AIProvider::Cohere |
            AIProvider::Mistral |
            AIProvider::TogetherAI |
            AIProvider::HuggingFace => Ok(()),

            _ => Err(AgentError::ConfigurationError(
                format!("Provider {:?} not yet implemented", config.provider)
            )),
        }
    }
}

// Command to get available providers
#[tauri::command]
#[specta::specta]
pub async fn get_available_providers() -> Result<Vec<ProviderInfo>, String> {
    let providers = vec![
        ProviderInfo {
            provider: AIProvider::OpenAI,
            name: "OpenAI".to_string(),
            description: "GPT models from OpenAI".to_string(),
            requires_api_key: true,
            supports_vision: true,
            supports_tools: true,
            supports_embeddings: true,
            default_models: ProviderFactory::get_available_models(&AIProvider::OpenAI),
        },
        ProviderInfo {
            provider: AIProvider::Anthropic,
            name: "Anthropic".to_string(),
            description: "Claude models from Anthropic".to_string(),
            requires_api_key: true,
            supports_vision: true,
            supports_tools: true,
            supports_embeddings: false,
            default_models: ProviderFactory::get_available_models(&AIProvider::Anthropic),
        },
        ProviderInfo {
            provider: AIProvider::Google,
            name: "Google Gemini".to_string(),
            description: "Gemini models from Google".to_string(),
            requires_api_key: true,
            supports_vision: true,
            supports_tools: true,
            supports_embeddings: true,
            default_models: ProviderFactory::get_available_models(&AIProvider::Google),
        },
        ProviderInfo {
            provider: AIProvider::Groq,
            name: "Groq".to_string(),
            description: "Fast inference with Groq".to_string(),
            requires_api_key: true,
            supports_vision: false,
            supports_tools: true,
            supports_embeddings: false,
            default_models: ProviderFactory::get_available_models(&AIProvider::Groq),
        },
        ProviderInfo {
            provider: AIProvider::Cohere,
            name: "Cohere".to_string(),
            description: "Command models from Cohere".to_string(),
            requires_api_key: true,
            supports_vision: false,
            supports_tools: true,
            supports_embeddings: true,
            default_models: ProviderFactory::get_available_models(&AIProvider::Cohere),
        },
        ProviderInfo {
            provider: AIProvider::Mistral,
            name: "Mistral".to_string(),
            description: "Mistral AI models".to_string(),
            requires_api_key: true,
            supports_vision: true,
            supports_tools: true,
            supports_embeddings: false,
            default_models: ProviderFactory::get_available_models(&AIProvider::Mistral),
        },
        ProviderInfo {
            provider: AIProvider::TogetherAI,
            name: "Together AI".to_string(),
            description: "Open source models via Together AI".to_string(),
            requires_api_key: true,
            supports_vision: false,
            supports_tools: true,
            supports_embeddings: true,
            default_models: ProviderFactory::get_available_models(&AIProvider::TogetherAI),
        },
        ProviderInfo {
            provider: AIProvider::HuggingFace,
            name: "Hugging Face".to_string(),
            description: "Hugging Face models".to_string(),
            requires_api_key: true,
            supports_vision: false,
            supports_tools: true,
            supports_embeddings: false,
            default_models: ProviderFactory::get_available_models(&AIProvider::HuggingFace),
        },
    ];

    Ok(providers)
}

#[derive(Serialize, Deserialize, Type, Debug, Clone)]
pub struct ProviderInfo {
    pub provider: AIProvider,
    pub name: String,
    pub description: String,
    pub requires_api_key: bool,
    pub supports_vision: bool,
    pub supports_tools: bool,
    pub supports_embeddings: bool,
    pub default_models: Vec<String>,
}

// Command to get models for a specific provider
#[tauri::command]
#[specta::specta]
pub async fn get_provider_models(provider: AIProvider) -> Result<Vec<String>, String> {
    Ok(ProviderFactory::get_available_models(&provider))
}