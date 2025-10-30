pub use super::*;

// Chat module implementation
pub struct ChatCapability {
    agent_manager: Arc<super::super::AgentManager>,
}

impl ChatCapability {
    pub fn new(agent_manager: Arc<super::super::AgentManager>) -> Self {
        Self { agent_manager }
    }

    pub async fn chat(
        &self,
        message: &str,
        conversation: super::Conversation,
    ) -> Result<super::ChatResponse> {
        let chat_message = super::ChatMessage::new(super::MessageRole::User, message);
        let request = super::ChatRequest::new(conversation.id.clone(), chat_message);

        let start_time = std::time::Instant::now();

        // Emit chat started event
        let start_event = crate::rig_agent_v2::events::types::AgentEvent::new(
            crate::rig_agent_v2::events::types::EventType::ChatStarted,
            "Chat Started".to_string(),
            format!("Starting chat with conversation: {}", conversation.id),
        )
        .with_conversation_id(conversation.id.clone())
        .with_correlation_id(conversation.id.clone());

        let _ = crate::rig_agent_v2::events::EventEmitter::emit_global(start_event).await;

        // Execute chat through agent manager
        let response = match self.agent_manager.providers().get_agent().await {
            Ok(agent) => {
                let client = self.agent_manager.providers().get_client().await?;
                let unified_agent = super::UnifiedAgent::new(agent, client);
                unified_agent.chat(request).await
            }
            Err(e) => Err(super::AgentError::ProviderNotInitialized),
        };

        let duration = start_time.elapsed().as_millis() as u64;

        // Emit chat completed event
        let completion_event = crate::rig_agent_v2::events::types::AgentEvent::new(
            crate::rig_agent_v2::events::types::EventType::ChatCompleted,
            "Chat Completed".to_string(),
            format!("Chat completed successfully in {}ms", duration)
        ).with_conversation_id(conversation.id.clone())
        .with_correlation_id(conversation.id.clone())
        .with_data(serde_json::json!({
            "duration_ms": duration,
            "response_length": response.as_ref().ok().map(|r| r.message.text_content().unwrap_or_default().len()).unwrap_or(0)
        }));

        let _ = self.agent_manager.events().emit(completion_event).await;

        response
    }

    pub async fn chat_stream(
        &self,
        message: &str,
        conversation: super::Conversation,
    ) -> Result<Pin<Box<dyn futures::Stream<Item = Result<super::StreamEvent>> + Send>>> {
        let chat_message = super::ChatMessage::new(super::MessageRole::User, message);
        let mut request = super::ChatRequest::new(conversation.id.clone(), chat_message);
        // Note: We can't set stream=true on ChatRequest directly, so we'll use the chat_stream method

        // Emit stream started event
        let start_event = crate::rig_agent_v2::events::types::AgentEvent::new(
            crate::rig_agent_v2::events::types::EventType::StreamStarted,
            "Stream Started".to_string(),
            format!("Starting stream with conversation: {}", conversation.id),
        )
        .with_conversation_id(conversation.id.clone())
        .with_correlation_id(conversation.id.clone());

        let _ = crate::rig_agent_v2::events::EventEmitter::emit_global(start_event).await;

        // Execute streaming chat through agent manager
        match self.agent_manager.providers().get_agent().await {
            Ok(agent) => {
                let client = self.agent_manager.providers().get_client().await?;
                let unified_agent = super::UnifiedAgent::new(agent, client);
                unified_agent.chat_stream(request).await
            }
            Err(e) => {
                // Return error stream
                use futures::stream;
                Ok(Box::pin(stream::once(async {
                    Err(super::AgentError::ProviderNotInitialized)
                })))
            }
        }
    }
}

