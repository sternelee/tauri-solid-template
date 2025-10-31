use serde::{Deserialize, Serialize};
use specta::Type;
use std::collections::HashMap;

/// Event types
#[derive(Serialize, Deserialize, Type, Clone, Debug, PartialEq, Hash, Eq)]
pub enum EventType {
    // Agent lifecycle events
    AgentInitialized,
    AgentConfigurationUpdated,
    AgentShutdown,

    // Chat events
    ChatStarted,
    ChatMessageReceived,
    ChatMessageSent,
    ChatCompleted,
    ChatError,
    ChatCancelled,

    // Streaming events
    StreamStarted,
    StreamToken,
    StreamThinking,
    StreamToolCall,
    StreamToolResult,
    StreamCompleted,
    StreamError,

    // Tool events
    ToolCalled,
    ToolCompleted,
    ToolError,
    ToolCancelled,
    ToolRegistered,
    ToolUnregistered,

    // ReAct events
    ReActThought,
    ReActAction,
    ReActObservation,
    ReActIteration,
    ReActCompleted,

    // System events
    Error,
    Warning,
    Info,
    Debug,
    Performance,
    Security,

    // Configuration events
    ConfigurationLoaded,
    ConfigurationUpdated,
    ConfigurationError,

    // Provider events
    ProviderConnected,
    ProviderDisconnected,
    ProviderError,

    // Resource events
    ResourceCreated,
    ResourceUpdated,
    ResourceDeleted,
    ResourceError,

    // Custom events
    Custom(String),
}

impl EventType {
    pub fn as_str(&self) -> &str {
        match self {
            Self::AgentInitialized => "agent_initialized",
            Self::AgentConfigurationUpdated => "agent_configuration_updated",
            Self::AgentShutdown => "agent_shutdown",
            Self::ChatStarted => "chat_started",
            Self::ChatMessageReceived => "chat_message_received",
            Self::ChatMessageSent => "chat_message_sent",
            Self::ChatCompleted => "chat_completed",
            Self::ChatError => "chat_error",
            Self::ChatCancelled => "chat_cancelled",
            Self::StreamStarted => "stream_started",
            Self::StreamToken => "stream_token",
            Self::StreamThinking => "stream_thinking",
            Self::StreamToolCall => "stream_tool_call",
            Self::StreamToolResult => "stream_tool_result",
            Self::StreamCompleted => "stream_completed",
            Self::StreamError => "stream_error",
            Self::ToolCalled => "tool_called",
            Self::ToolCompleted => "tool_completed",
            Self::ToolError => "tool_error",
            Self::ToolCancelled => "tool_cancelled",
            Self::ToolRegistered => "tool_registered",
            Self::ToolUnregistered => "tool_unregistered",
            Self::ReActThought => "react_thought",
            Self::ReActAction => "react_action",
            Self::ReActObservation => "react_observation",
            Self::ReActIteration => "react_iteration",
            Self::ReActCompleted => "react_completed",
            Self::Error => "error",
            Self::Warning => "warning",
            Self::Info => "info",
            Self::Debug => "debug",
            Self::Performance => "performance",
            Self::Security => "security",
            Self::ConfigurationLoaded => "configuration_loaded",
            Self::ConfigurationUpdated => "configuration_updated",
            Self::ConfigurationError => "configuration_error",
            Self::ProviderConnected => "provider_connected",
            Self::ProviderDisconnected => "provider_disconnected",
            Self::ProviderError => "provider_error",
            Self::ResourceCreated => "resource_created",
            Self::ResourceUpdated => "resource_updated",
            Self::ResourceDeleted => "resource_deleted",
            Self::ResourceError => "resource_error",
            Self::Custom(name) => name,
        }
    }
}

/// Event severity levels
#[derive(Serialize, Deserialize, Type, Clone, Debug, PartialEq, PartialOrd, Ord, Eq, Hash)]
pub enum EventSeverity {
    Debug,
    Info,
    Warning,
    Error,
    Critical,
}

impl EventSeverity {
    pub fn as_str(&self) -> &str {
        match self {
            Self::Debug => "debug",
            Self::Info => "info",
            Self::Warning => "warning",
            Self::Error => "error",
            Self::Critical => "critical",
        }
    }

    pub fn numeric_value(&self) -> u8 {
        match self {
            Self::Debug => 1,
            Self::Info => 2,
            Self::Warning => 3,
            Self::Error => 4,
            Self::Critical => 5,
        }
    }
}

/// Source of the event
#[derive(Serialize, Deserialize, Type, Clone, Debug)]
pub enum EventSource {
    Agent,
    Tool { tool_name: String },
    Provider { provider_name: String },
    System,
    User { user_id: String },
    Custom { source_name: String },
}

/// Core agent event structure
#[derive(Serialize, Deserialize, Type, Clone, Debug)]
pub struct AgentEvent {
    /// Unique event identifier
    pub id: String,

    /// Type of the event
    pub event_type: EventType,

    /// Event severity level
    pub severity: EventSeverity,

    /// Event timestamp (ISO 8601)
    pub timestamp: String,

    /// Source that generated the event
    pub source: EventSource,

    /// Session identifier
    pub session_id: Option<String>,

    /// Conversation identifier
    pub conversation_id: Option<String>,

    /// Message identifier (if applicable)
    pub message_id: Option<String>,

    /// Tool call identifier (if applicable)
    pub tool_call_id: Option<String>,

    /// Event title
    pub title: String,

    /// Detailed event description
    pub description: String,

    /// Event data payload
    pub data: Option<serde_json::Value>,

    /// Event metadata
    pub metadata: HashMap<String, serde_json::Value>,

    /// Duration of the operation in milliseconds (if applicable)
    #[specta(type = Option<i32>)] // Use Option<i32> for TypeScript compatibility
    pub duration_ms: Option<u64>,

    /// Error information (if applicable)
    pub error: Option<EventError>,

    /// Causation event ID (for event chains)
    pub caused_by: Option<String>,

    /// Correlation ID for tracking related events
    pub correlation_id: Option<String>,
}

impl AgentEvent {
    pub fn new(event_type: EventType, title: String, description: String) -> Self {
        let now = chrono::Utc::now().to_rfc3339();
        Self {
            id: uuid::Uuid::new_v4().to_string(),
            event_type,
            severity: EventSeverity::Info,
            timestamp: now,
            source: EventSource::Agent,
            session_id: None,
            conversation_id: None,
            message_id: None,
            tool_call_id: None,
            title,
            description,
            data: None,
            metadata: HashMap::new(),
            duration_ms: None,
            error: None,
            caused_by: None,
            correlation_id: None,
        }
    }

    pub fn with_severity(mut self, severity: EventSeverity) -> Self {
        self.severity = severity;
        self
    }

    pub fn with_source(mut self, source: EventSource) -> Self {
        self.source = source;
        self
    }

    pub fn with_session_id(mut self, session_id: String) -> Self {
        self.session_id = Some(session_id);
        self
    }

    pub fn with_conversation_id(mut self, conversation_id: String) -> Self {
        self.conversation_id = Some(conversation_id);
        self
    }

    pub fn with_message_id(mut self, message_id: String) -> Self {
        self.message_id = Some(message_id);
        self
    }

    pub fn with_tool_call_id(mut self, tool_call_id: String) -> Self {
        self.tool_call_id = Some(tool_call_id);
        self
    }

    pub fn with_data(mut self, data: serde_json::Value) -> Self {
        self.data = Some(data);
        self
    }

    pub fn with_metadata(mut self, key: String, value: serde_json::Value) -> Self {
        self.metadata.insert(key, value);
        self
    }

    pub fn with_duration(mut self, duration_ms: u64) -> Self {
        self.duration_ms = Some(duration_ms);
        self
    }

    pub fn with_error(mut self, error: EventError) -> Self {
        self.error = Some(error);
        self.severity = EventSeverity::Error;
        self
    }

    pub fn with_correlation_id(mut self, correlation_id: String) -> Self {
        self.correlation_id = Some(correlation_id);
        self
    }

    pub fn with_caused_by(mut self, caused_by: String) -> Self {
        self.caused_by = Some(caused_by);
        self
    }

    /// Convenience method for error events
    pub fn error(title: String, description: String, error: EventError) -> Self {
        Self::new(EventType::Error, title, description)
            .with_error(error)
    }

    /// Convenience method for warning events
    pub fn warning(title: String, description: String) -> Self {
        Self::new(EventType::Warning, title, description)
            .with_severity(EventSeverity::Warning)
    }

    /// Convenience method for info events
    pub fn info(title: String, description: String) -> Self {
        Self::new(EventType::Info, title, description)
    }

    /// Convenience method for debug events
    pub fn debug(title: String, description: String) -> Self {
        Self::new(EventType::Debug, title, description)
            .with_severity(EventSeverity::Debug)
    }

    /// Convenience method for tool events
    pub fn tool_event(event_type: EventType, tool_name: String, title: String, description: String) -> Self {
        Self::new(event_type, title, description)
            .with_source(EventSource::Tool { tool_name })
    }

    /// Check if event matches subscription criteria
    pub fn matches_subscription(&self, subscription: &super::EventSubscription) -> bool {
        // Check event types
        if !subscription.event_types.is_empty() && !subscription.event_types.contains(&self.event_type) {
            return false;
        }

        // Check session ID
        if let Some(sub_session) = &subscription.session_id {
            if self.session_id.as_ref() != Some(sub_session) {
                return false;
            }
        }

        // Check conversation ID
        if let Some(sub_conversation) = &subscription.conversation_id {
            if self.conversation_id.as_ref() != Some(sub_conversation) {
                return false;
            }
        }

        // Check tool names
        if let Some(sub_tools) = &subscription.tool_names {
            if let EventSource::Tool { tool_name } = &self.source {
                if !sub_tools.contains(tool_name) {
                    return false;
                }
            } else {
                return false;
            }
        }

        // Check severity
        if let Some(min_severity) = &subscription.min_severity {
            if self.severity < *min_severity {
                return false;
            }
        }

        true
    }
}

/// Event error information
#[derive(Serialize, Deserialize, Type, Clone, Debug)]
pub struct EventError {
    /// Error code
    pub code: String,

    /// Error message
    pub message: String,

    /// Error type
    pub error_type: String,

    /// Stack trace (if available)
    pub stack_trace: Option<String>,

    /// Additional error context
    pub context: HashMap<String, serde_json::Value>,
}

impl EventError {
    pub fn new(code: String, message: String, error_type: String) -> Self {
        Self {
            code,
            message,
            error_type,
            stack_trace: None,
            context: HashMap::new(),
        }
    }

    pub fn with_stack_trace(mut self, stack_trace: String) -> Self {
        self.stack_trace = Some(stack_trace);
        self
    }

    pub fn with_context(mut self, key: String, value: serde_json::Value) -> Self {
        self.context.insert(key, value);
        self
    }
}

/// Event batch for bulk operations
#[derive(Serialize, Deserialize, Type, Clone, Debug)]
pub struct EventBatch {
    /// Batch identifier
    pub batch_id: String,

    /// Events in this batch
    #[serde(skip)] // Skip Vec field to avoid usize BigInt issues
    pub events: Vec<AgentEvent>,

    /// Batch timestamp
    pub timestamp: String,

    /// Batch metadata
    pub metadata: HashMap<String, serde_json::Value>,
}

impl EventBatch {
    pub fn new(events: Vec<AgentEvent>) -> Self {
        Self {
            batch_id: uuid::Uuid::new_v4().to_string(),
            events,
            timestamp: chrono::Utc::now().to_rfc3339(),
            metadata: HashMap::new(),
        }
    }

    pub fn with_metadata(mut self, key: String, value: serde_json::Value) -> Self {
        self.metadata.insert(key, value);
        self
    }
}