use serde::{Deserialize, Serialize};
use specta::Type;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::{broadcast, RwLock};

pub mod emitter;
pub mod types;

pub use emitter::*;
pub use types::*;

/// Event handler trait
pub trait EventHandler: Send + Sync {
    fn handle_event(&self, event: &AgentEvent);
}

/// Event filter trait
pub trait EventFilter: Send + Sync {
    fn should_emit(&self, event: &AgentEvent) -> bool;
}

/// Event subscription configuration
#[derive(Serialize, Deserialize, Type, Clone, Debug)]
pub struct EventSubscription {
    pub event_types: Vec<EventType>,
    pub session_id: Option<String>,
    pub conversation_id: Option<String>,
    pub tool_names: Option<Vec<String>>,
    pub min_severity: Option<EventSeverity>,
    pub filters: Vec<EventFilterType>,
}

impl EventSubscription {
    pub fn new() -> Self {
        Self {
            event_types: Vec::new(),
            session_id: None,
            conversation_id: None,
            tool_names: None,
            min_severity: None,
            filters: Vec::new(),
        }
    }

    pub fn for_event_types(mut self, types: Vec<EventType>) -> Self {
        self.event_types = types;
        self
    }

    pub fn for_session(mut self, session_id: String) -> Self {
        self.session_id = Some(session_id);
        self
    }

    pub fn for_conversation(mut self, conversation_id: String) -> Self {
        self.conversation_id = Some(conversation_id);
        self
    }

    pub fn for_tools(mut self, tool_names: Vec<String>) -> Self {
        self.tool_names = Some(tool_names);
        self
    }

    pub fn with_min_severity(mut self, severity: EventSeverity) -> Self {
        self.min_severity = Some(severity);
        self
    }

    pub fn with_filters(mut self, filters: Vec<EventFilterType>) -> Self {
        self.filters = filters;
        self
    }
}

/// Event filter types
#[derive(Serialize, Deserialize, Type, Clone, Debug)]
#[serde(tag = "type")]
pub enum EventFilterType {
    /// Only allow events from specific user
    User { user_id: String },
    /// Only allow events within time range
    TimeRange { start: String, end: Option<String> },
    /// Only allow events with specific severity
    Severity { severity: EventSeverity },
    /// Custom filter expression
    Custom { expression: String },
}

/// Event statistics
#[derive(Serialize, Deserialize, Type, Clone, Debug)]
pub struct EventStatistics {
    #[specta(type = i32)] // Use i32 for TypeScript compatibility
    pub total_events: u64,
    // Skip HashMap fields for TypeScript binding to avoid BigInt issues
    #[serde(skip)]
    pub events_by_type: HashMap<EventType, u64>,
    #[serde(skip)]
    pub events_by_severity: HashMap<EventSeverity, u64>,
    #[serde(skip)]
    pub events_by_session: HashMap<String, u64>,
    pub average_events_per_minute: f64,
    #[specta(type = i32)] // Use i32 for TypeScript compatibility
    pub peak_events_per_minute: u64,
    pub first_event_time: Option<String>,
    pub last_event_time: Option<String>,
}

impl Default for EventStatistics {
    fn default() -> Self {
        Self {
            total_events: 0,
            events_by_type: HashMap::new(),
            events_by_severity: HashMap::new(),
            events_by_session: HashMap::new(),
            average_events_per_minute: 0.0,
            peak_events_per_minute: 0,
            first_event_time: None,
            last_event_time: None,
        }
    }
}

impl EventStatistics {
    pub fn record_event(&mut self, event: &AgentEvent) {
        self.total_events += 1;

        // Count by type
        *self.events_by_type.entry(event.event_type.clone()).or_insert(0) += 1;

        // Count by severity
        *self.events_by_severity.entry(event.severity.clone()).or_insert(0) += 1;

        // Count by session
        if let Some(session_id) = &event.session_id {
            *self.events_by_session.entry(session_id.clone()).or_insert(0) += 1;
        }

        // Update time tracking
        let event_time = &event.timestamp;
        if self.first_event_time.is_none() || event_time < self.first_event_time.as_ref().unwrap() {
            self.first_event_time = Some(event_time.clone());
        }
        if self.last_event_time.is_none() || event_time > self.last_event_time.as_ref().unwrap() {
            self.last_event_time = Some(event_time.clone());
        }
    }

    pub fn get_events_count(&self, event_type: &EventType) -> u64 {
        self.events_by_type.get(event_type).copied().unwrap_or(0)
    }

    pub fn get_events_by_severity(&self, severity: &EventSeverity) -> u64 {
        self.events_by_severity.get(severity).copied().unwrap_or(0)
    }
}