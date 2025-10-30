use super::{ToolTraitExecutionResult, ToolTraitMetadata, ToolTraitValidationResult};
use crate::rig_agent_v2::Result;
use async_trait::async_trait;
use serde_json::Value;
use std::collections::HashMap;

/// Core trait that all tools must implement
#[async_trait]
pub trait Tool: Send + Sync {
    /// Get tool metadata
    fn metadata(&self) -> &ToolTraitMetadata;

    /// Execute the tool with given parameters
    async fn execute(&self, parameters: &Value) -> Result<ToolTraitExecutionResult>;

    /// Validate tool parameters before execution
    fn validate_parameters(&self, parameters: &Value) -> ToolTraitValidationResult {
        // Default validation - just check if parameters match the schema
        if let Err(e) = self.validate_against_schema(parameters, &self.metadata().parameters_schema)
        {
            ToolTraitValidationResult::invalid(vec![e])
        } else {
            ToolTraitValidationResult::valid()
        }
    }

    /// Check if tool is available for execution
    async fn is_available(&self) -> bool {
        true
    }

    /// Get tool dependencies
    fn get_dependencies(&self) -> Vec<String> {
        self.metadata().dependencies.clone()
    }

    /// Initialize the tool (called once during registration)
    async fn initialize(&mut self) -> Result<()> {
        Ok(())
    }

    /// Cleanup the tool (called once during unregistration)
    async fn cleanup(&mut self) -> Result<()> {
        Ok(())
    }

    /// Get current tool status
    async fn get_status(&self) -> super::ToolTraitStatus {
        super::ToolTraitStatus::Active
    }

    // Helper methods

    /// Validate parameters against JSON schema
    fn validate_against_schema(
        &self,
        parameters: &Value,
        schema: &Value,
    ) -> std::result::Result<(), String> {
        // Simple JSON schema validation - in a real implementation, use a proper JSON schema validator
        if let Some(schema_obj) = schema.as_object() {
            if let Some(required) = schema_obj.get("required").and_then(|r| r.as_array()) {
                if let Some(params_obj) = parameters.as_object() {
                    for required_field in required {
                        if let Some(field_name) = required_field.as_str() {
                            if !params_obj.contains_key(field_name) {
                                return Err(format!("Missing required parameter: {}", field_name));
                            }
                        }
                    }
                } else {
                    return Err("Parameters must be an object".to_string());
                }
            }
        }
        Ok(())
    }
}

/// ToolTrait that can be cancelled during execution
#[async_trait]
pub trait CancellableToolTrait: ToolTrait {
    /// Cancel the current execution
    async fn cancel(&self) -> Result<()>;

    /// Check if the tool is currently running
    async fn is_running(&self) -> bool;
}

/// Streaming tool that provides progress updates
#[async_trait]
pub trait StreamingToolTrait: ToolTrait {
    /// Stream type for progress updates
    type Stream: futures::Stream<Item = Result<Value>> + Send;

    /// Execute tool with streaming output
    async fn execute_streaming(&self, parameters: &Value) -> Result<Self::Stream>;
}

/// Batch tool that can process multiple inputs
#[async_trait]
pub trait BatchToolTrait: ToolTrait {
    /// Execute tool on multiple inputs
    async fn execute_batch(
        &self,
        batch_parameters: &[Value],
    ) -> Result<Vec<ToolTraitExecutionResult>> {
        let mut results = Vec::new();
        for params in batch_parameters {
            let result = self.execute(params).await?;
            results.push(result);
        }
        Ok(results)
    }
}

/// ToolTrait that can be cached
#[async_trait]
pub trait CacheableToolTrait: ToolTrait {
    /// Generate cache key for parameters
    fn cache_key(&self, parameters: &Value) -> Option<String>;

    /// Get cache TTL in seconds
    fn cache_ttl(&self) -> u64 {
        3600 // Default 1 hour
    }

    /// Check if result can be cached for given parameters
    fn should_cache(&self, parameters: &Value) -> bool {
        self.cache_key(parameters).is_some()
    }
}

/// ToolTrait that requires authentication
#[async_trait]
pub trait AuthenticatedToolTrait: ToolTrait {
    /// Get required authentication scopes
    fn required_scopes(&self) -> Vec<String>;

    /// Check if tool has valid authentication
    async fn is_authenticated(&self) -> bool;

    /// Refresh authentication if needed
    async fn refresh_auth(&mut self) -> Result<()>;
}

/// ToolTrait with custom configuration
#[async_trait]
pub trait ConfigurableToolTrait: ToolTrait {
    type Config: Clone + Send + Sync;

    /// Get current configuration
    fn get_config(&self) -> &Self::Config;

    /// Update tool configuration
    async fn update_config(&mut self, config: Self::Config) -> Result<()>;

    /// Validate configuration
    fn validate_config(&self, config: &Self::Config) -> ToolTraitValidationResult {
        ToolTraitValidationResult::valid()
    }
}

/// ToolTrait with rate limiting
#[async_trait]
pub trait RateLimitedToolTrait: ToolTrait {
    /// Get rate limit (requests per second)
    fn rate_limit(&self) -> f64 {
        1.0 // Default: 1 request per second
    }

    /// Get current usage count
    async fn get_usage_count(&self) -> u64;

    /// Reset usage count
    async fn reset_usage_count(&self);
}

/// ToolTrait that can provide suggestions for parameters
#[async_trait]
pub trait SuggestableToolTrait: ToolTrait {
    /// Get parameter suggestions for given context
    async fn suggest_parameters(&self, context: &Value) -> Result<Vec<Value>>;

    /// Get example usage
    fn get_examples(&self) -> Vec<String> {
        self.metadata().examples.clone()
    }
}

/// ToolTrait that can be monitored
#[async_trait]
pub trait MonitorableToolTrait: ToolTrait {
    /// Get tool metrics
    async fn get_metrics(&self) -> ToolTraitMetrics;

    /// Reset tool metrics
    async fn reset_metrics(&self);
}

/// ToolTrait execution metrics
#[derive(serde::Serialize, serde::Deserialize, specta::Type, Clone, Debug)]
pub struct ToolTraitMetrics {
    pub total_executions: u64,
    pub successful_executions: u64,
    pub failed_executions: u64,
    pub total_execution_time_ms: u64,
    pub average_execution_time_ms: f64,
    pub last_execution_time: Option<String>,
    pub error_rate: f64,
}

impl Default for ToolTraitMetrics {
    fn default() -> Self {
        Self {
            total_executions: 0,
            successful_executions: 0,
            failed_executions: 0,
            total_execution_time_ms: 0,
            average_execution_time_ms: 0.0,
            last_execution_time: None,
            error_rate: 0.0,
        }
    }
}

impl ToolTraitMetrics {
    pub fn record_execution(&mut self, success: bool, execution_time_ms: u64) {
        self.total_executions += 1;
        self.total_execution_time_ms += execution_time_ms;
        self.average_execution_time_ms =
            self.total_execution_time_ms as f64 / self.total_executions as f64;

        if success {
            self.successful_executions += 1;
        } else {
            self.failed_executions += 1;
        }

        self.error_rate = self.failed_executions as f64 / self.total_executions as f64;
        self.last_execution_time = Some(chrono::Utc::now().to_rfc3339());
    }
}

