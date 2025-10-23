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

// ReAct Agent factory for creating ReAct-enabled agents
pub struct ReactAgentFactory;

impl ReactAgentFactory {
    pub async fn create_react_agent<M>(
        client: &rig::Client<M>,
        config: &AgentConfig,
        tools: Vec<Box<dyn rig::tool::Tool>>,
    ) -> Result<rig::Agent<M>, AgentError>
    where
        M: rig::completion::CompletionModel + 'static,
        <M as rig::completion::CompletionModel>::StreamingResponse: std::marker::Send,
    {
        let mut agent_builder = client.agent(&config.model);

        // Add ReAct preamble if specified
        let preamble = config.preamble.as_ref().map_or_else(
            || {
                Some(
                    "You are a helpful AI assistant that uses the ReAct (Reasoning and Acting) pattern. \
                    Think step by step and use available tools when necessary. \
                    Follow this format:\n\n\
                    Thought: [Your reasoning about what to do]\n\
                    Action: [Tool name and parameters if needed]\n\
                    Observation: [Result of the action]\n\
                    ... (repeat as needed)\n\
                    Final Answer: [Your final response]"
                        .to_string(),
                )
            },
            |p| Some(p.clone()),
        );

        if let Some(preamble) = &preamble {
            agent_builder = agent_builder.preamble(preamble);
        }

        // Add tools
        for tool in tools {
            agent_builder = agent_builder.tool(tool);
        }

        // Set temperature if specified
        if let Some(temperature) = config.temperature {
            agent_builder = agent_builder.temperature(temperature as f64);
        }

        let agent = agent_builder.build();
        Ok(agent)
    }

    pub async fn create_react_agent_from_dynamic(
        client: &DynamicClient,
        config: &AgentConfig,
        tools: Vec<Box<dyn rig::tool::Tool>>,
    ) -> Result<DynamicAgent, AgentError> {
        match client {
            DynamicClient::OpenAI(openai_client) => {
                let agent = Self::create_react_agent(openai_client, config, tools).await?;
                Ok(DynamicAgent::OpenAI(agent))
            }
            DynamicClient::Anthropic(anthropic_client) => {
                let agent = Self::create_react_agent(anthropic_client, config, tools).await?;
                Ok(DynamicAgent::Anthropic(agent))
            }
            DynamicClient::Gemini(gemini_client) => {
                let agent = Self::create_react_agent(gemini_client, config, tools).await?;
                Ok(DynamicAgent::Gemini(agent))
            }
            DynamicClient::Groq(groq_client) => {
                let agent = Self::create_react_agent(groq_client, config, tools).await?;
                Ok(DynamicAgent::Groq(agent))
            }
            DynamicClient::Cohere(cohere_client) => {
                let agent = Self::create_react_agent(cohere_client, config, tools).await?;
                Ok(DynamicAgent::Cohere(agent))
            }
            DynamicClient::Mistral(mistral_client) => {
                let agent = Self::create_react_agent(mistral_client, config, tools).await?;
                Ok(DynamicAgent::Mistral(agent))
            }
            DynamicClient::Together(together_client) => {
                let agent = Self::create_react_agent(together_client, config, tools).await?;
                Ok(DynamicAgent::Together(agent))
            }
            DynamicClient::HuggingFace(huggingface_client) => {
                let agent = Self::create_react_agent(huggingface_client, config, tools).await?;
                Ok(DynamicAgent::HuggingFace(agent))
            }
        }
    }
}

// Enhanced Agent wrapper with ReAct support
pub struct ReactAgentWrapper {
    agent: DynamicAgent,
    config: AgentConfig,
    cancel_signal: Option<Arc<Notify>>,
}

impl ReactAgentWrapper {
    pub fn new(agent: DynamicAgent, config: AgentConfig) -> Self {
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

    pub async fn chat_with_react<F>(
        &self,
        message: &str,
        history: &[ChatMessage],
        mut on_event: F,
    ) -> Result<String, AgentError>
    where
        F: FnMut(ReactAgentStreamEvent) -> Result<(), AgentError>,
    {
        // Check for cancellation
        if let Some(signal) = &self.cancel_signal {
            if signal.notified().now_or_never().is_some() {
                return Err(AgentError::Cancelled);
            }
        }

        // Convert history to rig format
        let rig_history: Vec<rig::completion::Message> = history
            .iter()
            .map(|msg| match msg.role.as_str() {
                "user" => rig::completion::Message::User {
                    content: rig::OneOrMany::one(rig::message::UserContent::Text(
                        rig::message::Text { text: msg.content.clone() },
                    )),
                },
                "assistant" => rig::completion::Message::Assistant {
                    id: None,
                    content: rig::OneOrMany::one(rig::message::AssistantContent::Text(
                        rig::message::Text { text: msg.content.clone() },
                    )),
                },
                _ => rig::completion::Message::User {
                    content: rig::OneOrMany::one(rig::message::UserContent::Text(
                        rig::message::Text { text: msg.content.clone() },
                    )),
                },
            })
            .collect();

        // Create ReAct configuration
        let react_config = ReactAgentConfig {
            max_iterations: self.config.max_iterations.unwrap_or(20),
            stream_tool_events: true,
            enable_reasoning: true,
            cancel_signal: self.cancel_signal.clone(),
            react_preamble: self.config.preamble.clone(),
        };

        // Execute ReAct agent based on the dynamic agent type
        match &self.agent {
            DynamicAgent::OpenAI(openai_agent) => {
                let mut stream = multi_turn_react_agent(
                    openai_agent.clone(),
                    message.to_string(),
                    rig_history,
                    react_config,
                )
                .await;

                let mut final_response = String::new();

                while let Some(event_result) = stream.next().await {
                    match event_result {
                        Ok(event) => {
                            on_event(event.clone())?;

                            match event {
                                ReactAgentStreamEvent::Text { content } => {
                                    final_response.push_str(&content);
                                }
                                ReactAgentStreamEvent::Reasoning { content } => {
                                    // Include reasoning in final response
                                    final_response.push_str(&format!("[Reasoning: {}] ", content));
                                }
                                ReactAgentStreamEvent::Complete => {
                                    break;
                                }
                                _ => {} // Handle other events as needed
                            }
                        }
                        Err(e) => {
                            return Err(AgentError::Custom(format!("ReAct stream error: {}", e)));
                        }
                    }
                }

                Ok(final_response)
            }
            _ => {
                // Fallback to regular chat for other providers
                self.chat_with_context(message, history).await
            }
        }
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
