use super::*;
use crate::rig_agent_v2::core::Result;
use crate::rig_agent_v2::AgentError;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

/// Tool registry for managing tool registrations
pub struct ToolRegistry {
    tools: Arc<RwLock<HashMap<String, ToolRegistration>>>,
}

impl ToolRegistry {
    pub fn new() -> Self {
        Self {
            tools: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    pub async fn register_tool(&self, registration: ToolRegistration) -> Result<()> {
        let tool_name = registration.metadata.name.clone();
        let mut tools = self.tools.write().await;

        if tools.contains_key(&tool_name) {
            return Err(AgentError::ToolError(format!(
                "Tool '{}' already registered",
                tool_name
            )));
        }

        tools.insert(tool_name, registration);
        Ok(())
    }

    pub async fn unregister_tool(&self, tool_name: &str) -> Result<()> {
        let mut tools = self.tools.write().await;

        if tools.remove(tool_name).is_none() {
            return Err(AgentError::ToolError(format!(
                "Tool '{}' not found",
                tool_name
            )));
        }

        Ok(())
    }

    pub async fn get_tool(&self, tool_name: &str) -> Option<ToolRegistration> {
        let tools = self.tools.read().await;
        tools.get(tool_name).cloned()
    }

    pub async fn list_tools(&self) -> Vec<ToolRegistration> {
        let tools = self.tools.read().await;
        tools.values().cloned().collect()
    }

    pub async fn clear(&self) {
        let mut tools = self.tools.write().await;
        tools.clear();
    }

    pub async fn count(&self) -> usize {
        let tools = self.tools.read().await;
        tools.len()
    }
}

impl Default for ToolRegistry {
    fn default() -> Self {
        Self::new()
    }
}

