use serde_json::Value;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::{oneshot, Mutex};

/// Global state for MCP functionality
#[derive(Debug, Default)]
pub struct McpState {
    pub active_servers: Arc<Mutex<HashMap<String, serde_json::Value>>>,
    pub restart_counts: Arc<Mutex<HashMap<String, u32>>>,
    pub successfully_connected: Arc<Mutex<HashMap<String, bool>>>,
    pub active_servers_list: Arc<Mutex<HashMap<String, bool>>>,
    pub tool_call_cancellations: Arc<Mutex<HashMap<String, oneshot::Sender<()>>>>,
    pub client_manager: Option<Arc<super::client::McpClientManager>>,
}

impl McpState {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn with_client_manager() -> Self {
        let mut state = Self::default();
        let client_manager = Arc::new(super::client::McpClientManager::new(Arc::new(state.clone())));
        state.client_manager = Some(client_manager);
        state
    }
}

impl Clone for McpState {
    fn clone(&self) -> Self {
        Self {
            active_servers: self.active_servers.clone(),
            restart_counts: self.restart_counts.clone(),
            successfully_connected: self.successfully_connected.clone(),
            active_servers_list: self.active_servers_list.clone(),
            tool_call_cancellations: self.tool_call_cancellations.clone(),
            // Note: client_manager is not cloned, it's created only once
            client_manager: self.client_manager.clone(),
        }
    }
}