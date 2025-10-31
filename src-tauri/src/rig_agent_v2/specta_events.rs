use serde::{Deserialize, Serialize};
use specta::Type;
use tauri_specta::Event;

// Chat stream events
#[derive(Serialize, Deserialize, Debug, Clone, Type, Event)]
pub struct ChatStreamEvent {
    pub conversation_id: String,
    pub event_type: ChatStreamEventType,
    pub content: Option<String>,
    pub timestamp: String,
}

#[derive(Serialize, Deserialize, Debug, Clone, Type)]
pub enum ChatStreamEventType {
    Start,
    Token,
    Complete,
    Error,
}

// ReAct stream events
#[derive(Serialize, Deserialize, Debug, Clone, Type, Event)]
pub struct ReActStreamEvent {
    pub conversation_id: String,
    pub event_type: ReActStreamEventType,
    pub iteration: Option<u32>,
    pub content: Option<String>,
    pub timestamp: String,
}

#[derive(Serialize, Deserialize, Debug, Clone, Type)]
pub enum ReActStreamEventType {
    Start,
    Thought,
    Action,
    Observation,
    Iteration,
    Complete,
    Error,
}

// AI system events
#[derive(Serialize, Deserialize, Debug, Clone, Type, Event)]
pub struct AISystemEvent {
    pub event_type: AISystemEventType,
    pub message: String,
    pub details: Option<serde_json::Value>,
    pub timestamp: String,
}

#[derive(Serialize, Deserialize, Debug, Clone, Type)]
pub enum AISystemEventType {
    Initialized,
    Shutdown,
    ConfigurationUpdated,
    ProviderChanged,
    Error,
}

// Tool execution events
#[derive(Serialize, Deserialize, Debug, Clone, Type, Event)]
pub struct ToolEvent {
    pub tool_name: String,
    pub event_type: ToolEventType,
    pub parameters: Option<serde_json::Value>,
    pub result: Option<serde_json::Value>,
    pub error: Option<String>,
    #[specta(type = Option<i32>)] // Use Option<i32> for TypeScript compatibility
    pub execution_time_ms: Option<u64>,
    pub timestamp: String,
}

#[derive(Serialize, Deserialize, Debug, Clone, Type)]
pub enum ToolEventType {
    Called,
    Completed,
    Error,
    Cancelled,
}