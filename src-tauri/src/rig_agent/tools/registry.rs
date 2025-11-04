use super::*;
use crate::rig_agent::AgentError;
use serde::{Deserialize, Serialize};
use specta::Type;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use uuid::Uuid;

/// Tool registry for managing available tools
pub struct ToolRegistry {
    tools: Arc<RwLock<HashMap<String, ToolRegistration>>>,
    metrics: Arc<RwLock<HashMap<String, ToolMetrics>>>,
}

impl ToolRegistry {
    pub fn new() -> Self {
        Self {
            tools: Arc::new(RwLock::new(HashMap::new())),
            metrics: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// Register a new tool
    pub async fn register_tool(&self, registration: ToolRegistration) -> Result<(), AgentError> {
        let name = registration.metadata.name.clone();

        // Validate tool registration
        self.validate_tool_registration(&registration)?;

        let mut tools = self.tools.write().await;
        tools.insert(name.clone(), registration);

        // Initialize metrics for the tool
        let mut metrics = self.metrics.write().await;
        metrics.insert(name.clone(), ToolMetrics::new());

        log::info!("Tool registered: {}", name);
        Ok(())
    }

    /// Unregister a tool
    pub async fn unregister_tool(&self, name: &str) -> Result<(), AgentError> {
        let mut tools = self.tools.write().await;
        if tools.remove(name).is_some() {
            let mut metrics = self.metrics.write().await;
            metrics.remove(name);
            log::info!("Tool unregistered: {}", name);
            Ok(())
        } else {
            Err(AgentError::ToolError(format!("Tool not found: {}", name)))
        }
    }

    /// Get a tool by name
    pub async fn get_tool(&self, name: &str) -> Option<ToolRegistration> {
        let tools = self.tools.read().await;
        tools.get(name).cloned()
    }

    /// List all registered tools
    pub async fn list_tools(&self) -> Vec<ToolMetadata> {
        let tools = self.tools.read().await;
        tools.values().map(|t| t.metadata.clone()).collect()
    }

    /// List tools by category
    pub async fn list_tools_by_category(&self, category: &str) -> Vec<ToolMetadata> {
        let tools = self.tools.read().await;
        tools
            .values()
            .filter(|t| t.metadata.category.as_ref().map_or(false, |c| c == category))
            .map(|t| t.metadata.clone())
            .collect()
    }

    /// Check if a tool exists
    pub async fn has_tool(&self, name: &str) -> bool {
        let tools = self.tools.read().await;
        tools.contains_key(name)
    }

    /// Execute a tool
    pub async fn execute_tool(
        &self,
        request: ToolExecutionRequest,
    ) -> Result<ToolExecutionResult, AgentError> {
        let start_time = std::time::Instant::now();
        let tool_name = request.tool_name.clone();

        // Get the tool
        let tool = self.get_tool(&tool_name).await
            .ok_or_else(|| AgentError::ToolError(format!("Tool not found: {}", tool_name)))?;

        // Validate parameters
        self.validate_parameters(&tool.metadata, &request.parameters)?;

        // Execute the tool
        let execution_result = {
            let handler = &tool.handler;
            let context = request.context.clone();
            let parameters = request.parameters.clone();

            handler(parameters, context).await
        };

        let execution_time = start_time.elapsed().as_millis() as u64;

        // Update metrics
        self.update_metrics(&tool_name, execution_time, &execution_result).await;

        // Create result with timing
        match execution_result {
            Ok(result) => {
                Ok(result.with_execution_time(execution_time))
            }
            Err(error) => {
                Err(error)
            }
        }
    }

    /// Execute multiple tools in parallel
    pub async fn execute_tools_batch(
        &self,
        requests: Vec<ToolExecutionRequest>,
    ) -> Vec<Result<ToolExecutionResult, AgentError>> {
        let futures: Vec<_> = requests
            .into_iter()
            .map(|req| self.execute_tool(req))
            .collect();

        futures::future::join_all(futures).await
    }

    /// Get tool metrics
    pub async fn get_tool_metrics(&self, name: &str) -> Option<ToolMetrics> {
        let metrics = self.metrics.read().await;
        metrics.get(name).cloned()
    }

    /// Get all tool metrics
    pub async fn get_all_metrics(&self) -> HashMap<String, ToolMetrics> {
        let metrics = self.metrics.read().await;
        metrics.clone()
    }

    /// Reset tool metrics
    pub async fn reset_metrics(&self, name: &str) -> Result<(), AgentError> {
        let mut metrics = self.metrics.write().await;
        if let Some(metric) = metrics.get_mut(name) {
            *metric = ToolMetrics::new();
            Ok(())
        } else {
            Err(AgentError::ToolError(format!("Tool not found: {}", name)))
        }
    }

    /// Reset all metrics
    pub async fn reset_all_metrics(&self) {
        let mut metrics = self.metrics.write().await;
        for (_, metric) in metrics.iter_mut() {
            *metric = ToolMetrics::new();
        }
    }

    /// Validate tool registration
    fn validate_tool_registration(&self, registration: &ToolRegistration) -> Result<(), AgentError> {
        if registration.metadata.name.is_empty() {
            return Err(AgentError::ToolError("Tool name cannot be empty".to_string()));
        }

        if registration.metadata.description.is_empty() {
            return Err(AgentError::ToolError("Tool description cannot be empty".to_string()));
        }

        // Validate JSON schema for parameters if present
        if !registration.metadata.parameters.is_null() {
            // TODO: Add JSON schema validation
            log::warn!("JSON schema validation not implemented yet");
        }

        Ok(())
    }

    /// Validate tool parameters
    fn validate_parameters(
        &self,
        metadata: &ToolMetadata,
        parameters: &serde_json::Value,
    ) -> Result<(), AgentError> {
        // If no parameters schema is defined, accept any parameters
        if metadata.parameters.is_null() {
            return Ok(());
        }

        // TODO: Implement JSON schema validation for parameters
        // For now, just check if parameters is a valid JSON value
        if parameters.is_null() || parameters.is_object() {
            Ok(())
        } else {
            Err(AgentError::ToolError(
                "Parameters must be a valid JSON object".to_string(),
            ))
        }
    }

    /// Update tool metrics
    async fn update_metrics(
        &self,
        tool_name: &str,
        execution_time_ms: u64,
        result: &Result<ToolExecutionResult, AgentError>,
    ) {
        let mut metrics = self.metrics.write().await;
        if let Some(metric) = metrics.get_mut(tool_name) {
            metric.total_executions += 1;
            metric.total_execution_time_ms += execution_time_ms;

            match result {
                Ok(_) => metric.successful_executions += 1,
                Err(_) => metric.failed_executions += 1,
            }

            // Update average execution time
            metric.average_execution_time_ms = metric.total_execution_time_ms / metric.total_executions;
        }
    }

    /// Search tools by name or description
    pub async fn search_tools(&self, query: &str) -> Vec<ToolMetadata> {
        let tools = self.tools.read().await;
        let query_lower = query.to_lowercase();

        tools
            .values()
            .filter(|t| {
                t.metadata.name.to_lowercase().contains(&query_lower)
                    || t.metadata.description.to_lowercase().contains(&query_lower)
                    || t.metadata.tags.iter().any(|tag| tag.to_lowercase().contains(&query_lower))
            })
            .map(|t| t.metadata.clone())
            .collect()
    }

    /// Get tools by tags
    pub async fn get_tools_by_tags(&self, tags: &[String]) -> Vec<ToolMetadata> {
        let tools = self.tools.read().await;

        tools
            .values()
            .filter(|t| {
                tags.iter().any(|tag| t.metadata.tags.contains(tag))
            })
            .map(|t| t.metadata.clone())
            .collect()
    }

    /// Get registry statistics
    pub async fn get_registry_stats(&self) -> RegistryStats {
        let tools = self.tools.read().await;
        let metrics = self.metrics.read().await;

        RegistryStats {
            total_tools: tools.len(),
            categories: self.get_categories().await.len(),
            total_executions: metrics.values().map(|m| m.total_executions).sum(),
            successful_executions: metrics.values().map(|m| m.successful_executions).sum(),
        }
    }

    /// Get all categories
    async fn get_categories(&self) -> Vec<String> {
        let tools = self.tools.read().await;
        let mut categories: std::collections::HashSet<String> = std::collections::HashSet::new();

        for tool in tools.values() {
            if let Some(category) = &tool.metadata.category {
                categories.insert(category.clone());
            }
        }

        categories.into_iter().collect()
    }
}

impl Default for ToolRegistry {
    fn default() -> Self {
        Self::new()
    }
}

/// Tool execution metrics
#[derive(Serialize, Deserialize, Type, Clone, Debug)]
pub struct ToolMetrics {
    pub total_executions: u64,
    pub successful_executions: u64,
    pub failed_executions: u64,
    pub total_execution_time_ms: u64,
    pub average_execution_time_ms: u64,
    pub last_execution: Option<String>,
}

impl ToolMetrics {
    pub fn new() -> Self {
        Self {
            total_executions: 0,
            successful_executions: 0,
            failed_executions: 0,
            total_execution_time_ms: 0,
            average_execution_time_ms: 0,
            last_execution: None,
        }
    }

    pub fn success_rate(&self) -> f64 {
        if self.total_executions == 0 {
            0.0
        } else {
            self.successful_executions as f64 / self.total_executions as f64
        }
    }
}

/// Registry statistics
#[derive(Serialize, Deserialize, Type, Clone, Debug)]
pub struct RegistryStats {
    pub total_tools: usize,
    pub categories: usize,
    pub total_executions: u64,
    pub successful_executions: u64,
}

/// Tool permission levels
#[derive(Serialize, Deserialize, Type, Clone, Debug, PartialEq, Eq)]
pub enum ToolPermission {
    Safe,       // Read-only operations
    Restricted, // Requires user confirmation
    Dangerous,  // Potentially harmful operations
}

/// Tool execution context with permissions
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ToolExecutionContext {
    pub user_id: Option<String>,
    pub session_id: String,
    pub conversation_id: Option<String>,
    pub permissions: Vec<ToolPermission>,
    pub metadata: std::collections::HashMap<String, serde_json::Value>,
}

impl ToolExecutionContext {
    pub fn new(session_id: String) -> Self {
        Self {
            user_id: None,
            session_id,
            conversation_id: None,
            permissions: vec![ToolPermission::Safe],
            metadata: std::collections::HashMap::new(),
        }
    }

    pub fn with_permissions(mut self, permissions: Vec<ToolPermission>) -> Self {
        self.permissions = permissions;
        self
    }

    pub fn has_permission(&self, permission: ToolPermission) -> bool {
        self.permissions.contains(&permission)
    }
}