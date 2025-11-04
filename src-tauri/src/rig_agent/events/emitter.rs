use super::*;
use std::collections::HashMap;
use std::sync::Arc;
use std::sync::OnceLock;
use tokio::sync::{broadcast, RwLock};
use uuid::Uuid;

/// Event emitter for broadcasting agent events
pub struct EventEmitter {
    /// Main event broadcast channel
    event_sender: broadcast::Sender<AgentEvent>,

    /// Event subscribers
    subscribers: Arc<RwLock<HashMap<String, EventSubscription>>>,

    /// Event statistics
    statistics: Arc<RwLock<EventStatistics>>,

    /// Event handlers
    handlers: Arc<RwLock<Vec<Arc<dyn EventHandler>>>>,

    /// Event filters
    filters: Arc<RwLock<Vec<Arc<dyn EventFilter>>>>,

    /// Maximum number of events to keep in buffer
    buffer_size: usize,

    /// Event history (circular buffer)
    event_history: Arc<RwLock<Vec<AgentEvent>>>,
}

impl EventEmitter {
    pub fn new(buffer_size: usize) -> Self {
        let (event_sender, _) = broadcast::channel(buffer_size);

        Self {
            event_sender,
            subscribers: Arc::new(RwLock::new(HashMap::new())),
            statistics: Arc::new(RwLock::new(EventStatistics::default())),
            handlers: Arc::new(RwLock::new(Vec::new())),
            filters: Arc::new(RwLock::new(Vec::new())),
            buffer_size,
            event_history: Arc::new(RwLock::new(Vec::with_capacity(buffer_size))),
        }
    }

    /// Create a new event emitter with default buffer size
    pub fn with_default_buffer() -> Self {
        Self::new(1000)
    }

    /// Emit an event to all subscribers
    pub async fn emit(&self, event: AgentEvent) -> Result<(), EventError> {
        // Apply filters
        let filters = self.filters.read().await;
        for filter in filters.iter() {
            if !filter.should_emit(&event) {
                return Ok(()); // Event filtered out
            }
        }

        // Update statistics
        {
            let mut stats = self.statistics.write().await;
            stats.record_event(&event);
        }

        // Add to history
        {
            let mut history = self.event_history.write().await;
            if history.len() >= self.buffer_size {
                history.remove(0); // Remove oldest event
            }
            history.push(event.clone());
        }

        // Call handlers
        {
            let handlers = self.handlers.read().await;
            for handler in handlers.iter() {
                handler.handle_event(&event);
            }
        }

        // Broadcast to subscribers
        if let Err(e) = self.event_sender.send(event.clone()) {
            return Err(EventError::new(
                "BROADCAST_ERROR".to_string(),
                format!("Failed to broadcast event: {}", e),
                "BroadcastError".to_string(),
            ));
        }

        Ok(())
    }

    /// Subscribe to events with specific criteria
    pub async fn subscribe(
        &self,
        subscription: EventSubscription,
    ) -> broadcast::Receiver<AgentEvent> {
        let subscription_id = Uuid::new_v4().to_string();

        // Store subscription
        {
            let mut subscribers = self.subscribers.write().await;
            subscribers.insert(subscription_id, subscription);
        }

        self.event_sender.subscribe()
    }

    /// Unsubscribe from events
    pub async fn unsubscribe(&self, subscription_id: &str) {
        let mut subscribers = self.subscribers.write().await;
        subscribers.remove(subscription_id);
    }

    /// Add an event handler
    pub async fn add_handler(&self, handler: Arc<dyn EventHandler>) {
        let mut handlers = self.handlers.write().await;
        handlers.push(handler);
    }

    /// Remove an event handler
    pub async fn remove_handler(&self, handler: &Arc<dyn EventHandler>) {
        let mut handlers = self.handlers.write().await;
        handlers.retain(|h| !Arc::ptr_eq(h, handler));
    }

    /// Add an event filter
    pub async fn add_filter(&self, filter: Arc<dyn EventFilter>) {
        let mut filters = self.filters.write().await;
        filters.push(filter);
    }

    /// Remove an event filter
    pub async fn remove_filter(&self, filter: &Arc<dyn EventFilter>) {
        let mut filters = self.filters.write().await;
        filters.retain(|f| !Arc::ptr_eq(f, filter));
    }

    /// Get current event statistics
    pub async fn get_statistics(&self) -> EventStatistics {
        self.statistics.read().await.clone()
    }

    /// Get recent events from history
    pub async fn get_recent_events(&self, limit: Option<usize>) -> Vec<AgentEvent> {
        let history = self.event_history.read().await;
        let limit = limit.unwrap_or(history.len());

        if limit >= history.len() {
            history.clone()
        } else {
            history[history.len() - limit..].to_vec()
        }
    }

    /// Get events by type
    pub async fn get_events_by_type(
        &self,
        event_type: &EventType,
        limit: Option<usize>,
    ) -> Vec<AgentEvent> {
        let history = self.event_history.read().await;
        let mut filtered_events: Vec<AgentEvent> = history
            .iter()
            .filter(|event| &event.event_type == event_type)
            .cloned()
            .collect();

        if let Some(limit) = limit {
            filtered_events.truncate(limit);
        }

        filtered_events
    }

    /// Get events by session
    pub async fn get_events_by_session(
        &self,
        session_id: &str,
        limit: Option<usize>,
    ) -> Vec<AgentEvent> {
        let history = self.event_history.read().await;
        let mut filtered_events: Vec<AgentEvent> = history
            .iter()
            .filter(|event| {
                event
                    .session_id
                    .as_ref()
                    .map_or(false, |id| id == session_id)
            })
            .cloned()
            .collect();

        if let Some(limit) = limit {
            filtered_events.truncate(limit);
        }

        filtered_events
    }

    /// Get events by conversation
    pub async fn get_events_by_conversation(
        &self,
        conversation_id: &str,
        limit: Option<usize>,
    ) -> Vec<AgentEvent> {
        let history = self.event_history.read().await;
        let mut filtered_events: Vec<AgentEvent> = history
            .iter()
            .filter(|event| {
                event
                    .conversation_id
                    .as_ref()
                    .map_or(false, |id| id == conversation_id)
            })
            .cloned()
            .collect();

        if let Some(limit) = limit {
            filtered_events.truncate(limit);
        }

        filtered_events
    }

    /// Get events by severity
    pub async fn get_events_by_severity(
        &self,
        severity: &EventSeverity,
        limit: Option<usize>,
    ) -> Vec<AgentEvent> {
        let history = self.event_history.read().await;
        let mut filtered_events: Vec<AgentEvent> = history
            .iter()
            .filter(|event| &event.severity == severity)
            .cloned()
            .collect();

        if let Some(limit) = limit {
            filtered_events.truncate(limit);
        }

        filtered_events
    }

    /// Get current subscribers
    pub async fn get_subscribers(&self) -> HashMap<String, EventSubscription> {
        self.subscribers.read().await.clone()
    }

    /// Clear event history
    pub async fn clear_history(&self) {
        let mut history = self.event_history.write().await;
        history.clear();
    }

    /// Reset statistics
    pub async fn reset_statistics(&self) {
        let mut stats = self.statistics.write().await;
        *stats = EventStatistics::default();
    }

    /// Export events to JSON
    pub async fn export_events(&self, format: ExportFormat) -> Result<String, EventError> {
        let history = self.event_history.read().await;

        match format {
            ExportFormat::Json => serde_json::to_string_pretty(&*history).map_err(|e| {
                EventError::new(
                    "SERIALIZATION_ERROR".to_string(),
                    format!("Failed to serialize events: {}", e),
                    "SerializationError".to_string(),
                )
            }),
            ExportFormat::Csv => self.export_events_to_csv(&history),
        }
    }

    // Private helper methods

    fn export_events_to_csv(&self, events: &[AgentEvent]) -> Result<String, EventError> {
        let mut csv = String::new();

        // CSV header
        csv.push_str("id,timestamp,event_type,severity,title,description,session_id,conversation_id,duration_ms\n");

        // CSV rows
        for event in events {
            csv.push_str(&format!(
                "{},{},{},{},{},{},{},{},{}\n",
                event.id,
                event.timestamp,
                event.event_type.as_str(),
                event.severity.as_str(),
                event.title.replace(',', ";"),
                event.description.replace(',', ";"),
                event.session_id.as_deref().unwrap_or(""),
                event.conversation_id.as_deref().unwrap_or(""),
                event.duration_ms.unwrap_or(0)
            ));
        }

        Ok(csv)
    }
}

/// Export formats for events
#[derive(Serialize, Deserialize, Type, Clone, Debug)]
pub enum ExportFormat {
    Json,
    Csv,
}

impl Default for EventEmitter {
    fn default() -> Self {
        Self::with_default_buffer()
    }
}

// Global event emitter instance
static GLOBAL_EMITTER: OnceLock<Arc<EventEmitter>> = OnceLock::new();

impl EventEmitter {
    /// Get or create the global event emitter instance
    pub fn global() -> Arc<Self> {
        GLOBAL_EMITTER
            .get_or_init(|| Arc::new(Self::with_default_buffer()))
            .clone()
    }

    /// Emit an event globally using the global emitter
    pub async fn emit_global(event: AgentEvent) -> Result<(), EventError> {
        Self::global().emit(event).await
    }

    /// Subscribe to events globally using the global emitter
    pub async fn subscribe_global(
        subscription: EventSubscription,
    ) -> broadcast::Receiver<AgentEvent> {
        let emitter = Self::global();
        emitter.subscribe(subscription).await
    }
}

/// Simple console event handler for debugging
pub struct ConsoleEventHandler;

impl EventHandler for ConsoleEventHandler {
    fn handle_event(&self, event: &AgentEvent) {
        println!(
            "[{}] {}: {} - {}",
            event.timestamp,
            event.severity.as_str().to_uppercase(),
            event.event_type.as_str(),
            event.description
        );

        if let Some(error) = &event.error {
            println!("  Error: {} - {}", error.code, error.message);
        }
    }
}

/// File event handler for logging events to file
pub struct FileEventHandler {
    file_path: String,
}

impl FileEventHandler {
    pub fn new(file_path: String) -> Self {
        Self { file_path }
    }
}

impl EventHandler for FileEventHandler {
    fn handle_event(&self, event: &AgentEvent) {
        if let Ok(event_json) = serde_json::to_string(event) {
            let _ = std::fs::write(&self.file_path, format!("{}\n", event_json));
        }
    }
}

/// Simple event filter that filters by minimum severity
pub struct SeverityFilter {
    min_severity: EventSeverity,
}

impl SeverityFilter {
    pub fn new(min_severity: EventSeverity) -> Self {
        Self { min_severity }
    }
}

impl EventFilter for SeverityFilter {
    fn should_emit(&self, event: &AgentEvent) -> bool {
        event.severity >= self.min_severity
    }
}

/// Event filter that filters by event types
pub struct EventTypeFilter {
    allowed_types: Vec<EventType>,
}

impl EventTypeFilter {
    pub fn new(allowed_types: Vec<EventType>) -> Self {
        Self { allowed_types }
    }
}

impl EventFilter for EventTypeFilter {
    fn should_emit(&self, event: &AgentEvent) -> bool {
        self.allowed_types.contains(&event.event_type)
    }
}

