use serde::{Deserialize, Serialize};
use specta::Type;
use std::collections::HashMap;

/// Message role
#[derive(Serialize, Deserialize, Type, Clone, Debug, PartialEq)]
pub enum MessageRole {
    User,
    Assistant,
    System,
    Tool,
}

/// Content types for multimodal messages
#[derive(Serialize, Deserialize, Type, Clone, Debug)]
#[serde(tag = "type")]
pub enum ContentPart {
    Text {
        text: String,
    },
    Image {
        url: Option<String>,
        base64_data: Option<String>,
        media_type: String,
        width: Option<u32>,
        height: Option<u32>,
        description: Option<String>,
    },
    Audio {
        url: Option<String>,
        base64_data: Option<String>,
        media_type: String,
        duration: Option<f32>,
    },
    Video {
        url: Option<String>,
        base64_data: Option<String>,
        media_type: String,
        width: Option<u32>,
        height: Option<u32>,
        duration: Option<f32>,
    },
}

impl ContentPart {
    pub fn text(text: impl Into<String>) -> Self {
        Self::Text { text: text.into() }
    }

    pub fn image_url(url: impl Into<String>) -> Self {
        Self::Image {
            url: Some(url.into()),
            base64_data: None,
            media_type: "image/*".to_string(),
            width: None,
            height: None,
            description: None,
        }
    }

    pub fn image_base64(data: String, media_type: String) -> Self {
        Self::Image {
            url: None,
            base64_data: Some(data),
            media_type,
            width: None,
            height: None,
            description: None,
        }
    }
}

/// Chat message structure
#[derive(Serialize, Deserialize, Type, Clone, Debug)]
pub struct ChatMessage {
    pub id: String,
    pub role: MessageRole,
    #[serde(skip)] // Skip Vec field to avoid usize BigInt issues
    pub content: Vec<ContentPart>,
    pub timestamp: String,
    #[serde(skip)] // Skip Vec field to avoid usize BigInt issues
    pub tool_calls: Option<Vec<ToolCall>>,
    #[serde(skip)] // Skip Vec field to avoid usize BigInt issues
    pub tool_results: Option<Vec<ToolResult>>,
    pub metadata: Option<HashMap<String, serde_json::Value>>,
}

impl ChatMessage {
    pub fn new(role: MessageRole, content: impl Into<String>) -> Self {
        Self {
            id: uuid::Uuid::new_v4().to_string(),
            role,
            content: vec![ContentPart::text(content.into())],
            timestamp: chrono::Utc::now().to_rfc3339(),
            tool_calls: None,
            tool_results: None,
            metadata: None,
        }
    }

    pub fn with_content(role: MessageRole, content: Vec<ContentPart>) -> Self {
        Self {
            id: uuid::Uuid::new_v4().to_string(),
            role,
            content,
            timestamp: chrono::Utc::now().to_rfc3339(),
            tool_calls: None,
            tool_results: None,
            metadata: None,
        }
    }

    pub fn text_content(&self) -> Option<String> {
        self.content.iter().find_map(|part| {
            if let ContentPart::Text { text } = part {
                Some(text.clone())
            } else {
                None
            }
        })
    }

    pub fn add_metadata(&mut self, key: String, value: serde_json::Value) {
        if let Some(metadata) = &mut self.metadata {
            metadata.insert(key, value);
        } else {
            let mut new_metadata = HashMap::new();
            new_metadata.insert(key, value);
            self.metadata = Some(new_metadata);
        }
    }
}

/// Tool call representation
#[derive(Serialize, Deserialize, Type, Clone, Debug)]
pub struct ToolCall {
    pub id: String,
    pub name: String,
    pub arguments: serde_json::Value,
    pub result: Option<ToolResult>,
}

/// Tool result representation
#[derive(Serialize, Deserialize, Type, Clone, Debug)]
pub struct ToolResult {
    pub tool_call_id: String,
    pub success: bool,
    pub result: Option<serde_json::Value>,
    pub error: Option<String>,
    #[specta(type = Option<i32>)] // Use Option<i32> for TypeScript compatibility
    pub execution_time_ms: Option<u64>,
}

/// Conversation structure
#[derive(Serialize, Deserialize, Type, Clone, Debug)]
pub struct Conversation {
    pub id: String,
    pub title: Option<String>,
    #[serde(skip)] // Skip Vec field to avoid usize BigInt issues
    pub messages: Vec<ChatMessage>,
    pub created_at: String,
    pub updated_at: String,
    pub metadata: HashMap<String, serde_json::Value>,
}

impl Conversation {
    pub fn new(title: Option<String>) -> Self {
        let now = chrono::Utc::now().to_rfc3339();
        Self {
            id: uuid::Uuid::new_v4().to_string(),
            title,
            messages: Vec::new(),
            created_at: now.clone(),
            updated_at: now,
            metadata: HashMap::new(),
        }
    }

    pub fn add_message(&mut self, message: ChatMessage) {
        self.messages.push(message);
        self.updated_at = chrono::Utc::now().to_rfc3339();
    }

    pub fn get_last_user_message(&self) -> Option<&ChatMessage> {
        self.messages
            .iter()
            .rev()
            .find(|msg| msg.role == MessageRole::User)
    }

    pub fn get_last_assistant_message(&self) -> Option<&ChatMessage> {
        self.messages
            .iter()
            .rev()
            .find(|msg| msg.role == MessageRole::Assistant)
    }

    pub fn get_message_count(&self) -> usize {
        self.messages.len()
    }

    pub fn clear_messages(&mut self) {
        self.messages.clear();
        self.updated_at = chrono::Utc::now().to_rfc3339();
    }
}

/// Streaming event types
#[derive(Serialize, Deserialize, Type, Clone, Debug)]
#[serde(tag = "event")]
pub enum StreamEvent {
    Start {
        conversation_id: String,
        message_id: String,
        timestamp: String,
    },
    Token {
        content: String,
        timestamp: String,
    },
    Thinking {
        content: String,
        timestamp: String,
    },
    ToolCall {
        tool: ToolCall,
        timestamp: String,
    },
    ToolResult {
        result: ToolResult,
        timestamp: String,
    },
    // ReAct specific events
    ReActThought {
        thought: String,
        iteration: u32,
        timestamp: String,
    },
    ReActAction {
        action: String,
        tool_call: Option<ToolCall>,
        iteration: u32,
        timestamp: String,
    },
    ReActObservation {
        observation: String,
        tool_result: Option<ToolResult>,
        iteration: u32,
        timestamp: String,
    },
    ReActIteration {
        iteration: u32,
        max_iterations: u32,
        timestamp: String,
    },
    ReActComplete {
        final_answer: String,
        iterations: u32,
        timestamp: String,
    },
    Complete {
        message: ChatMessage,
        usage: Option<TokenUsage>,
        timestamp: String,
    },
    Error {
        error: String,
        timestamp: String,
    },
    Cancelled {
        timestamp: String,
    },
    End {
        timestamp: String,
    },
}

/// Token usage information
#[derive(Serialize, Deserialize, Type, Clone, Debug)]
pub struct TokenUsage {
    pub prompt_tokens: u32,
    pub completion_tokens: u32,
    pub total_tokens: u32,
    pub cost_usd: Option<f64>,
}

/// Image generation parameters
#[derive(Serialize, Deserialize, Type, Clone, Debug)]
pub struct ImageGenerationParams {
    pub prompt: String,
    pub model: Option<String>,
    pub size: Option<String>,
    pub quality: Option<String>,
    pub n: Option<u32>,
    pub style: Option<String>,
    pub response_format: Option<String>,
}

/// Embedding parameters
#[derive(Serialize, Deserialize, Type, Clone, Debug)]
pub struct EmbeddingParams {
    pub input: String,
    pub model: String,
    pub encoding_format: Option<String>,
    pub dimensions: Option<u32>,
}

/// Embedding response
#[derive(Serialize, Deserialize, Type, Clone, Debug)]
pub struct EmbeddingResponse {
    pub object: String,
    pub data: Vec<EmbeddingData>,
    pub model: String,
    pub usage: TokenUsage,
}

/// ReAct configuration
#[derive(Serialize, Deserialize, Type, Clone, Debug)]
pub struct ReActConfig {
    pub max_iterations: u32,
    pub thinking_prompt: String,
    pub action_prompt: String,
    pub observation_prompt: String,
    pub final_answer_prompt: String,
    pub enable_tool_use: bool,
    pub available_tools: Vec<String>,
}

impl Default for ReActConfig {
    fn default() -> Self {
        Self {
            max_iterations: 10,
            thinking_prompt: "Think step by step about what you need to do to answer the user's question.".to_string(),
            action_prompt: "Based on your thinking, what action should you take? If you need to use a tool, specify which one and what parameters. If you have enough information to answer, say 'I have enough information to answer'.".to_string(),
            observation_prompt: "You have received the results of your action. What did you learn and what should you do next?".to_string(),
            final_answer_prompt: "Based on all your observations, provide a comprehensive answer to the user's original question.".to_string(),
            enable_tool_use: true,
            available_tools: vec![],
        }
    }
}

/// ReAct state for tracking reasoning progress
#[derive(Serialize, Deserialize, Type, Clone, Debug)]
pub struct ReActState {
    pub iteration: u32,
    pub thoughts: Vec<String>,
    pub actions: Vec<String>,
    pub observations: Vec<String>,
    pub tool_calls: Vec<ToolCall>,
    pub tool_results: Vec<ToolResult>,
    pub current_context: String,
    pub final_answer: Option<String>,
    pub completed: bool,
}

impl ReActState {
    pub fn new() -> Self {
        Self {
            iteration: 0,
            thoughts: Vec::new(),
            actions: Vec::new(),
            observations: Vec::new(),
            tool_calls: Vec::new(),
            tool_results: Vec::new(),
            current_context: String::new(),
            final_answer: None,
            completed: false,
        }
    }

    pub fn add_thought(&mut self, thought: String) {
        self.thoughts.push(thought);
    }

    pub fn add_action(&mut self, action: String) {
        self.actions.push(action);
    }

    pub fn add_observation(&mut self, observation: String) {
        self.observations.push(observation);
    }

    pub fn add_tool_call(&mut self, tool_call: ToolCall) {
        self.tool_calls.push(tool_call);
    }

    pub fn add_tool_result(&mut self, tool_result: ToolResult) {
        self.tool_results.push(tool_result);
    }

    pub fn next_iteration(&mut self) {
        self.iteration += 1;
    }

    pub fn is_complete(&self) -> bool {
        self.completed || self.final_answer.is_some()
    }

    pub fn complete(&mut self, answer: String) {
        self.final_answer = Some(answer);
        self.completed = true;
    }
}

#[derive(Serialize, Deserialize, Type, Clone, Debug)]
pub struct EmbeddingData {
    pub object: String,
    pub embedding: Vec<f32>,
    pub index: u32,
}

/// Image generation response
#[derive(Serialize, Deserialize, Type, Clone, Debug)]
pub struct ImageGenerationResponse {
    #[specta(type = i32)] // Use i32 for TypeScript compatibility
    pub created: u64,
    pub data: Vec<ImageData>,
}

#[derive(Serialize, Deserialize, Type, Clone, Debug)]
pub struct ImageData {
    pub url: Option<String>,
    pub b64_json: Option<String>,
    pub revised_prompt: Option<String>,
}

/// Chat request structure
#[derive(Serialize, Deserialize, Type, Clone, Debug)]
pub struct ChatRequest {
    pub conversation_id: String,
    pub message: ChatMessage,
    pub temperature: Option<f32>,
    pub max_tokens: Option<u32>,
    pub stream: bool,
    pub tools: Option<Vec<String>>,
    #[serde(skip)]
    #[specta(skip)]
    pub cancel_signal: Option<std::sync::Arc<tokio::sync::Notify>>,
}

impl ChatRequest {
    pub fn new(conversation_id: String, message: ChatMessage) -> Self {
        Self {
            conversation_id,
            message,
            temperature: None,
            max_tokens: None,
            stream: false,
            tools: None,
            cancel_signal: None,
        }
    }

    pub fn from_text(text: impl Into<String>, conversation: Conversation) -> Self {
        let message = ChatMessage::new(MessageRole::User, text.into());
        Self::new(conversation.id, message)
    }

    pub fn with_content(mut self, content: Vec<ContentPart>) -> Self {
        self.message.content = content;
        self
    }

    pub fn stream(mut self, enabled: bool) -> Self {
        self.stream = enabled;
        self
    }

    pub fn with_tools(mut self, tools: Vec<String>) -> Self {
        self.tools = Some(tools);
        self
    }

    pub fn with_max_iterations(self, _iterations: u32) -> Self {
        // For now, just return self
        self
    }
}

/// Chat response structure
#[derive(Serialize, Deserialize, Type, Clone, Debug)]
pub struct ChatResponse {
    pub message: ChatMessage,
    pub usage: Option<TokenUsage>,
    pub finish_reason: Option<String>,
    #[serde(skip)] // Skip Vec field to avoid usize BigInt issues
    pub tool_calls: Option<Vec<ToolCall>>,
    #[serde(rename = "duration_ms")]
    #[specta(type = i32)] // Use i32 instead of u64 for TypeScript compatibility
    pub duration_ms: u64,
}

/// Tool manager for managing available tools
pub struct ToolManager {
    tools: HashMap<
        String,
        Box<dyn Fn(serde_json::Value) -> Result<serde_json::Value, String> + Send + Sync>,
    >,
}

impl ToolManager {
    pub fn new() -> Self {
        Self {
            tools: HashMap::new(),
        }
    }

    pub fn register_tool<F>(&mut self, name: String, handler: F)
    where
        F: Fn(serde_json::Value) -> Result<serde_json::Value, String> + Send + Sync + 'static,
    {
        self.tools.insert(name, Box::new(handler));
    }

    pub fn execute(
        &self,
        name: &str,
        args: serde_json::Value,
    ) -> Result<serde_json::Value, String> {
        if let Some(tool) = self.tools.get(name) {
            tool(args)
        } else {
            Err(format!("Tool not found: {}", name))
        }
    }

    pub fn list_tools(&self) -> Vec<String> {
        self.tools.keys().cloned().collect()
    }
}

impl Default for ToolManager {
    fn default() -> Self {
        Self::new()
    }
}

