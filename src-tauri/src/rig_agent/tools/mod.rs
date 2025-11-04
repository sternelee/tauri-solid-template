// Tool management system - simplified for compilation

pub mod registry;
pub mod mcp_adapter;

// Re-export core types
pub use registry::*;
pub use mcp_adapter::*;

// Simple mock types for now
use serde::{Deserialize, Serialize};
pub use serde_json::Value;
use std::sync::Arc;

/// Tool execution context (simplified)
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ToolExecutionContext {
    pub user_id: Option<String>,
    pub session_id: String,
    pub conversation_id: Option<String>,
    pub metadata: std::collections::HashMap<String, Value>,
}

impl ToolExecutionContext {
    pub fn new(session_id: String) -> Self {
        Self {
            user_id: None,
            session_id,
            conversation_id: None,
            metadata: std::collections::HashMap::new(),
        }
    }
}

/// Tool metadata
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ToolMetadata {
    pub name: String,
    pub description: String,
    pub parameters: Value,
    pub category: Option<String>,
    pub tags: Vec<String>,
}

impl ToolMetadata {
    pub fn new(name: String, description: String) -> Self {
        Self {
            name,
            description,
            parameters: Value::Null,
            category: None,
            tags: Vec::new(),
        }
    }
}

/// Tool registration
#[derive(Clone)]
pub struct ToolRegistration {
    pub metadata: ToolMetadata,
    pub handler: Arc<
        dyn Fn(
                Value,
                ToolExecutionContext,
            ) -> std::pin::Pin<
                Box<
                    dyn std::future::Future<
                            Output = Result<ToolExecutionResult, crate::rig_agent::AgentError>,
                        > + Send,
                >,
            > + Send
            + Sync,
    >,
}

/// Tool execution request
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ToolExecutionRequest {
    pub tool_name: String,
    pub parameters: Value,
    pub context: ToolExecutionContext,
}

impl ToolExecutionRequest {
    pub fn new(tool_name: String, parameters: Value, context: ToolExecutionContext) -> Self {
        Self {
            tool_name,
            parameters,
            context,
        }
    }
}

/// Tool execution result
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ToolExecutionResult {
    pub tool_name: String,
    pub success: bool,
    pub result: Option<Value>,
    pub error: Option<String>,
    pub execution_time_ms: u64,
}

impl ToolExecutionResult {
    pub fn success(tool_name: String, result: Value) -> Self {
        Self {
            tool_name,
            success: true,
            result: Some(result),
            error: None,
            execution_time_ms: 0,
        }
    }

    pub fn error(tool_name: String, error: String) -> Self {
        Self {
            tool_name,
            success: false,
            result: None,
            error: Some(error),
            execution_time_ms: 0,
        }
    }

    pub fn with_execution_time(mut self, execution_time_ms: u64) -> Self {
        self.execution_time_ms = execution_time_ms;
        self
    }
}

