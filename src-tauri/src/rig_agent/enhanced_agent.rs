use super::*;
use std::sync::Arc;
use tokio::sync::Notify;

// Enhanced agent wrapper with multimodal and tool calling support
pub struct EnhancedAgent {
    agent: DynamicAgent,
    config: AgentConfig,
    cancel_signal: Option<Arc<Notify>>,
    available_tools: Vec<ToolDefinition>,
}

impl EnhancedAgent {
    pub fn new(agent: DynamicAgent, config: AgentConfig) -> Self {
        let tools = if config.enable_tools.unwrap_or(true) {
            tools::ToolManager::get_available_tools()
        } else {
            Vec::new()
        };

        Self {
            agent,
            config,
            cancel_signal: None,
            available_tools: tools,
        }
    }

    pub fn with_cancellation(mut self, cancel_signal: Arc<Notify>) -> Self {
        self.cancel_signal = Some(cancel_signal);
        self
    }

    pub fn with_tools(mut self, tools: Vec<ToolDefinition>) -> Self {
        self.available_tools = tools;
        self
    }

    // Process multimodal content (text + images)
    fn process_content_parts(&self, content_parts: &[ContentPart]) -> String {
        if content_parts.is_empty() {
            return String::new();
        }

        let mut processed_content = Vec::new();

        for part in content_parts {
            match part {
                ContentPart::Text { text } => {
                    processed_content.push(format!("Text: {}", text));
                }
                ContentPart::Image { image } => {
                    let mut image_desc = String::from("[IMAGE: ");

                    if let Some(description) = &image.description {
                        image_desc.push_str(&format!("Description: {}, ", description));
                    }

                    if let Some(media_type) = &image.media_type {
                        image_desc.push_str(&format!("Type: {}, ", media_type));
                    }

                    if let Some(width) = image.width {
                        image_desc.push_str(&format!("Width: {}, ", width));
                    }

                    if let Some(height) = image.height {
                        image_desc.push_str(&format!("Height: {}, ", height));
                    }

                    if image.base64_data.is_some() {
                        image_desc.push_str("Base64 encoded data available");
                    } else if image.url.is_some() {
                        image_desc.push_str("URL provided");
                    }

                    image_desc.push(']');
                    processed_content.push(image_desc);
                }
            }
        }

        processed_content.join("\n")
    }

    // Enhanced chat with multimodal support
    pub async fn chat_with_context(
        &self,
        message: &str,
        history: &[ChatMessage],
        content_parts: Option<&[ContentPart]>,
    ) -> Result<String, AgentError> {
        // Check for cancellation
        if let Some(signal) = &self.cancel_signal {
            let signal = signal.clone();
            let wait_result = tokio::time::timeout(
                std::time::Duration::from_millis(100),
                signal.notified()
            ).await;

            if wait_result.is_ok() {
                return Err(AgentError::Cancelled);
            }
        }

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

        // Process multimodal content if available
        let additional_content = if let Some(parts) = content_parts {
            self.process_content_parts(parts)
        } else {
            String::new()
        };

        // Build the full prompt
        let full_prompt = if context.is_empty() {
            if additional_content.is_empty() {
                message.to_string()
            } else {
                format!("{}\n\nAdditional context:\n{}", message, additional_content)
            }
        } else {
            if additional_content.is_empty() {
                format!("{}\n\nUser: {}", context.join("\n"), message)
            } else {
                format!(
                    "{}\n\nUser: {}\n\nAdditional context:\n{}",
                    context.join("\n"),
                    message,
                    additional_content
                )
            }
        };

        // Get response based on provider
        match &self.agent {
            DynamicAgent::OpenAI(agent) => {
                let response = agent
                    .prompt(&full_prompt)
                    .await
                    .map_err(|e| AgentError::Custom(format!("Prompt error: {}", e)))?;
                Ok(response)
            }
        }
    }

    // Streaming chat with multimodal support
    pub async fn chat_streaming_with_context<F>(
        &self,
        message: &str,
        history: &[ChatMessage],
        content_parts: Option<&[ContentPart]>,
        mut on_token: F,
    ) -> Result<String, AgentError>
    where
        F: FnMut(String) -> Result<(), AgentError>,
    {
        // For now, implement simplified streaming
        // TODO: Implement proper streaming with different providers

        let response = self.chat_with_context(message, history, content_parts).await?;

        // Simulate streaming by calling the callback with chunks
        let words: Vec<&str> = response.split_whitespace().collect();
        let mut accumulated = String::new();

        for word in words {
            accumulated.push_str(word);
            accumulated.push(' ');

            on_token(accumulated.clone())?;

            // Small delay to simulate streaming
            tokio::time::sleep(std::time::Duration::from_millis(50)).await;
        }

        Ok(response)
    }

    // Generate embeddings for text
    pub async fn generate_embeddings(
        &self,
        input: &str,
        model: &str,
    ) -> Result<Vec<f32>, AgentError> {
        // TODO: Implement embedding generation
        // This would require embedding support from the rig framework
        // For now, return a placeholder embedding
        let placeholder_embedding = vec![0.0; 1536]; // Common embedding size
        Ok(placeholder_embedding)
    }

    // Tool calling functionality
    pub fn get_available_tools(&self) -> &Vec<ToolDefinition> {
        &self.available_tools
    }

    pub async fn call_tool(
        &self,
        tool_name: &str,
        parameters: &serde_json::Value,
    ) -> Result<serde_json::Value, AgentError> {
        match tool_name {
            "file_system" => {
                // Call file system tool
                tools::FileSystemTool::execute(parameters).await
            }
            "system_info" => {
                // Call system info tool
                tools::SystemInfoTool::execute(parameters).await
            }
            _ => Err(AgentError::Custom(format!(
                "Unknown tool: {}",
                tool_name
            ))),
        }
    }
}

// Provider factory for creating different types of agents
pub struct ProviderFactory;

impl ProviderFactory {
    pub async fn create_client(
        provider: &AIProvider,
        api_key: Option<String>,
        base_url: Option<String>,
    ) -> Result<DynamicClient, AgentError> {
        match provider {
            AIProvider::OpenAI => {
                // Set up environment variables
                if let Some(key) = api_key {
                    std::env::set_var("OPENAI_API_KEY", key);
                }
                if let Some(url) = base_url {
                    std::env::set_var("OPENAI_BASE_URL", url);
                }

                let client = openai::Client::from_env();
                Ok(DynamicClient::OpenAI(client))
            }
            AIProvider::Anthropic => {
                // TODO: Implement Anthropic client creation
                Err(AgentError::Custom(
                    "Anthropic provider not yet implemented".to_string(),
                ))
            }
            AIProvider::Google => {
                // TODO: Implement Google client creation
                Err(AgentError::Custom(
                    "Google provider not yet implemented".to_string(),
                ))
            }
            AIProvider::Ollama => {
                // TODO: Implement Ollama client creation
                Err(AgentError::Custom(
                    "Ollama provider not yet implemented".to_string(),
                ))
            }
            AIProvider::Local => {
                // TODO: Implement local model support
                Err(AgentError::Custom(
                    "Local provider not yet implemented".to_string(),
                ))
            }
        }
    }

    pub async fn create_agent(
        client: &DynamicClient,
        config: &AgentConfig,
    ) -> Result<DynamicAgent, AgentError> {
        match client {
            DynamicClient::OpenAI(openai_client) => {
                let mut agent_builder = openai_client.agent(&config.model);

                if let Some(preamble) = &config.preamble {
                    agent_builder = agent_builder.preamble(preamble);
                }

                if let Some(temperature) = config.temperature {
                    agent_builder = agent_builder.temperature(temperature as f64);
                }

                let agent = agent_builder.build();
                Ok(DynamicAgent::OpenAI(agent))
            }
        }
    }
}

// Image processing utilities
pub struct ImageProcessor;

impl ImageProcessor {
    pub async fn process_image_from_path(path: &str) -> Result<ImageContent, AgentError> {
        let image_data = tokio::fs::read(path)
            .await
            .map_err(|e| AgentError::Custom(format!("Failed to read image: {}", e)))?;

        let image = image::load_from_memory(&image_data)
            .map_err(|e| AgentError::Custom(format!("Failed to parse image: {}", e)))?;

        let mime_type = mime_guess::from_path(path)
            .first_or_octet_stream()
            .to_string();

        let base64_data = general_purpose::STANDARD.encode(&image_data);

        Ok(ImageContent {
            url: None,
            base64_data: Some(base64_data),
            media_type: Some(mime_type),
            width: Some(image.width()),
            height: Some(image.height()),
            description: None,
        })
    }

    pub async fn process_image_from_url(url: &str) -> Result<ImageContent, AgentError> {
        // TODO: Implement image downloading from URL
        Ok(ImageContent::from_url(url.to_string()))
    }

    pub fn validate_image_format(mime_type: &str) -> bool {
        matches!(mime_type, "image/jpeg" | "image/png" | "image/gif" | "image/webp")
    }
}