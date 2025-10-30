// Agent implementation - Core functionality

use super::{DynamicAgent, DynamicClient};
use futures::FutureExt;
use rig::OneOrMany;
use std::pin::Pin;

type Result<T> = std::result::Result<T, super::AgentError>;

/// Unified agent implementation
pub struct UnifiedAgent {
    agent: DynamicAgent,
    client: DynamicClient,
    tools: Option<super::ToolManager>,
    stream: bool,
    temperature: Option<f32>,
    max_tokens: Option<u32>,
}

impl UnifiedAgent {
    /// Create new unified agent
    pub fn new(agent: DynamicAgent, client: DynamicClient) -> Self {
        Self {
            agent,
            client,
            tools: None,
            stream: false,
            temperature: None,
            max_tokens: None,
        }
    }

    /// Get configuration
    pub fn config(&self) -> super::AgentConfig {
        super::AgentConfig::default()
    }

    /// Set tools
    pub fn with_tools(mut self, tools: super::ToolManager) -> Self {
        self.tools = Some(tools);
        self
    }

    /// Set streaming
    pub fn with_stream(mut self, stream: bool) -> Self {
        self.stream = stream;
        self
    }

    /// Set temperature
    pub fn with_temperature(mut self, temperature: f32) -> Self {
        self.temperature = Some(temperature);
        self
    }

    /// Set max tokens
    pub fn with_max_tokens(mut self, max_tokens: u32) -> Self {
        self.max_tokens = Some(max_tokens);
        self
    }

    /// Execute chat completion
    pub async fn chat(&self, _request: super::ChatRequest) -> Result<super::ChatResponse> {
        let start_time = std::time::Instant::now();

        // TODO: Implement actual chat completion with rig
        // For now, return mock response
        let message = super::ChatMessage::new(
            super::MessageRole::Assistant,
            "Chat functionality not yet implemented in this version".to_string(),
        );

        Ok(super::ChatResponse {
            message,
            usage: None,
            finish_reason: Some("stop".to_string()),
            tool_calls: None,
            duration_ms: start_time.elapsed().as_millis() as u64,
        })
    }

    /// Create streaming response
    pub async fn chat_stream(
        &self,
        request: super::ChatRequest,
    ) -> Result<Pin<Box<dyn futures::Stream<Item = Result<super::StreamEvent>> + Send>>> {
        use futures::StreamExt;

        let start_time = std::time::Instant::now();
        let request_id = request.conversation_id.clone();

        // Check cancellation
        if let Some(signal) = &request.cancel_signal {
            if signal.notified().now_or_never().is_some() {
                return Err(super::AgentError::Cancelled);
            }
        }

        // Get response text
        let response_text = match self.chat(request).await {
            Ok(response) => response.message.text_content().unwrap_or_default(),
            Err(e) => e.to_string(),
        };

        // Stream response as tokens
        let chars: Vec<char> = response_text.chars().collect();
        let request_id_clone = request_id.clone();

        let start_stream = futures::stream::once(async move {
            Ok(super::StreamEvent::Start {
                conversation_id: request_id_clone,
                message_id: uuid::Uuid::new_v4().to_string(),
                timestamp: chrono::Utc::now().to_rfc3339(),
            })
        });

        let token_stream = futures::stream::iter(
            chars
                .chunks(5)
                .map(|chunk_chars| {
                    let chunk: String = chunk_chars.iter().collect();
                    Ok(super::StreamEvent::Token {
                        content: chunk,
                        timestamp: chrono::Utc::now().to_rfc3339(),
                    })
                })
                .collect::<Vec<_>>(),
        );

        let end_stream = futures::stream::once(async move {
            Ok(super::StreamEvent::End {
                timestamp: chrono::Utc::now().to_rfc3339(),
            })
        });

        Ok(Box::pin(start_stream.chain(token_stream).chain(end_stream)))
    }

    /// Generate embeddings
    pub async fn generate_embeddings(&self, _texts: Vec<String>) -> Result<Vec<Vec<f32>>> {
        Err(super::AgentError::EmbeddingError(
            "Not implemented yet".to_string(),
        ))
    }

    /// Generate image
    pub async fn generate_image(
        &self,
        _prompt: &str,
        _params: Option<serde_json::Value>,
    ) -> Result<serde_json::Value> {
        Err(super::AgentError::ImageGenerationError(
            "Not implemented yet".to_string(),
        ))
    }

    /// Convert internal message format to rig format
    fn convert_message_to_rig(&self, msg: &super::ChatMessage) -> rig::completion::Message {
        match &msg.role {
            super::MessageRole::User => rig::completion::Message::User {
                content: rig::OneOrMany::one(rig::message::UserContent::Text(rig::message::Text {
                    text: msg.text_content().unwrap_or_default(),
                })),
            },
            super::MessageRole::Assistant => {
                if let Some(content) = msg.text_content() {
                    rig::completion::Message::Assistant {
                        content: rig::OneOrMany::one(rig::message::AssistantContent::Text(
                            rig::message::Text { text: content },
                        )),
                        id: None,
                    }
                } else {
                    rig::completion::Message::Assistant {
                        content: rig::OneOrMany::one(rig::message::AssistantContent::Text(
                            rig::message::Text {
                                text: "".to_string(),
                            },
                        )),
                        id: None,
                    }
                }
            }
            super::MessageRole::System => rig::completion::Message::User {
                content: rig::OneOrMany::one(rig::message::UserContent::Text(rig::message::Text {
                    text: msg.text_content().unwrap_or_default(),
                })),
            },
            super::MessageRole::Tool => rig::completion::Message::User {
                content: rig::OneOrMany::one(rig::message::UserContent::Text(rig::message::Text {
                    text: msg.text_content().unwrap_or_default(),
                })),
            },
        }
    }
}
