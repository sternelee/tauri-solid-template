use super::*;
use std::sync::Arc;
use tokio::sync::Notify;

// Legacy Agent wrapper (deprecated, use EnhancedAgent from enhanced_agent instead)
pub struct LegacyAgent {
    agent: OpenAIAgent,
    config: AgentConfig,
    cancel_signal: Option<Arc<Notify>>,
}

impl LegacyAgent {
    pub fn new(agent: OpenAIAgent, config: AgentConfig) -> Self {
        Self {
            agent,
            config,
            cancel_signal: None,
        }
    }

    pub fn with_cancellation(mut self, cancel_signal: Arc<Notify>) -> Self {
        self.cancel_signal = Some(cancel_signal);
        self
    }

    pub async fn chat_with_context(
        &self,
        message: &str,
        history: &[ChatMessage],
    ) -> Result<String, AgentError> {
        // For now, skip cancellation checks to simplify
        // TODO: Implement proper cancellation in the future

        // Convert message history to rig format
        let mut context = Vec::new();
        for msg in history {
            match msg.role.as_str() {
                "user" => {
                    context.push(format!("User: {}", msg.content));
                }
                "assistant" => {
                    context.push(format!("Assistant: {}", msg.content));
                }
                _ => {} // Ignore other roles for now
            }
        }

        // Add current message
        let full_prompt = if context.is_empty() {
            message.to_string()
        } else {
            format!("{}\n\nUser: {}", context.join("\n"), message)
        };

        // Get response
        let response = self
            .agent
            .prompt(&full_prompt)
            .await
            .map_err(|e| AgentError::Custom(format!("Prompt error: {}", e)))?;

        Ok(response)
    }

    pub async fn chat_streaming_with_context<F>(
        &self,
        message: &str,
        history: &[ChatMessage],
        mut on_token: F,
    ) -> Result<String, AgentError>
    where
        F: FnMut(String) -> Result<(), AgentError>,
    {
        // Simplified streaming - just get the full response and return it
        // TODO: Implement proper streaming in the future

        let response = self.chat_with_context(message, history).await?;

        // For now, just call the callback once with the full response
        on_token(response.clone())?;

        Ok(response)
    }
}

// Agent factory following jan-dev patterns
pub struct AgentFactory;

impl AgentFactory {
    pub async fn create_agent(
        client: &openai::Client,
        config: &AgentConfig,
    ) -> Result<OpenAIAgent, AgentError> {
        let mut agent_builder = client.agent(&config.model);

        if let Some(preamble) = &config.preamble {
            agent_builder = agent_builder.preamble(preamble);
        }

        if let Some(temperature) = config.temperature {
            agent_builder = agent_builder.temperature(temperature as f64);
        }

        let agent = agent_builder.build();
        Ok(agent)
    }

    pub async fn create_legacy_agent(
        client: &openai::Client,
        config: &AgentConfig,
        cancel_signal: Option<Arc<Notify>>,
    ) -> Result<LegacyAgent, AgentError> {
        let agent = Self::create_agent(client, config).await?;
        let mut enhanced = LegacyAgent::new(agent, config.clone());

        if let Some(signal) = cancel_signal {
            enhanced = enhanced.with_cancellation(signal);
        }

        Ok(enhanced)
    }
}

// Provider configuration management
pub struct ProviderManager;

impl ProviderManager {
    pub fn get_provider_config(provider: &str) -> Option<ProviderConfig> {
        match provider {
            "openai" => Some(ProviderConfig::OpenAI {
                api_key: std::env::var("OPENAI_API_KEY").ok(),
                base_url: std::env::var("OPENAI_BASE_URL").ok(),
            }),
            "anthropic" => Some(ProviderConfig::Anthropic {
                api_key: std::env::var("ANTHROPIC_API_KEY").ok(),
                base_url: std::env::var("ANTHROPIC_BASE_URL").ok(),
            }),
            _ => None,
        }
    }

    pub fn set_provider_env_vars(config: &ProviderConfig) -> Result<(), AgentError> {
        match config {
            ProviderConfig::OpenAI { api_key, base_url } => {
                if let Some(key) = api_key {
                    std::env::set_var("OPENAI_API_KEY", key);
                }
                if let Some(url) = base_url {
                    std::env::set_var("OPENAI_BASE_URL", url);
                }
            }
            ProviderConfig::Anthropic { api_key, base_url } => {
                if let Some(key) = api_key {
                    std::env::set_var("ANTHROPIC_API_KEY", key);
                }
                if let Some(url) = base_url {
                    std::env::set_var("ANTHROPIC_BASE_URL", url);
                }
            }
        }
        Ok(())
    }
}

#[derive(Debug, Clone)]
pub enum ProviderConfig {
    OpenAI {
        api_key: Option<String>,
        base_url: Option<String>,
    },
    Anthropic {
        api_key: Option<String>,
        base_url: Option<String>,
    },
}

// Conversation manager
pub struct ConversationManager {
    state: Arc<AgentState>,
}

impl ConversationManager {
    pub fn new(state: Arc<AgentState>) -> Self {
        Self { state }
    }

    pub async fn create_conversation(&self) -> String {
        self.state.create_conversation().await
    }

    pub async fn get_conversation(&self, id: &str) -> Option<Conversation> {
        self.state.get_conversation(id).await
    }

    pub async fn add_message(
        &self,
        conversation_id: &str,
        role: &str,
        content: &str,
    ) -> Result<ChatMessage, AgentError> {
        let message = ChatMessage {
            id: uuid::Uuid::new_v4().to_string(),
            role: role.to_string(),
            content: content.to_string(),
            timestamp: chrono::Utc::now().to_rfc3339(),
            tool_calls: None,
            metadata: None,
        };

        let message_clone = message.clone();
        self.state.add_message(conversation_id, message).await?;
        Ok(message_clone)
    }

    pub async fn get_chat_history(
        &self,
        conversation_id: &str,
    ) -> Result<Vec<ChatMessage>, AgentError> {
        self.state
            .get_conversation(conversation_id)
            .await
            .map(|conv| conv.messages)
            .ok_or_else(|| {
                AgentError::ConfigurationError(format!(
                    "Conversation {} not found",
                    conversation_id
                ))
            })
    }

    pub async fn clear_conversation(&self, conversation_id: &str) -> Result<(), AgentError> {
        self.state
            .update_conversation(conversation_id, |conv| {
                conv.messages.clear();
            })
            .await
    }
}
