use std::sync::Arc;
use tokio::sync::RwLock;

// Re-export all modules
pub mod core;
pub mod tools;
pub mod capabilities;
pub mod events;
pub mod commands;
pub mod specta_events;

// Export specta-compatible events
pub use specta_events::*;

// Core re-exports
pub use core::*;
pub use capabilities::*;

// Utility re-exports
pub mod utils;

/// Unified Agent Manager - single entry point for all AI operations
#[derive(Clone)]
pub struct AgentManager {
    agent: Arc<core::agent::UnifiedAgent>,
    providers: Arc<core::ProviderManager>,
    config: Arc<RwLock<core::AgentConfig>>,
    tools: Arc<core::ToolManager>,
    events: Arc<events::EventEmitter>,
}

impl AgentManager {
    pub async fn new(config: core::AgentConfig) -> core::Result<Self> {
        let provider_manager = core::ProviderManager::new(&config).await?;
        let tool_manager = core::ToolManager::new();
        let event_emitter = events::EventEmitter::new(1000);

        // Create a real agent using the provider manager
        let agent = provider_manager.get_agent().await?;
        let client = provider_manager.get_client().await?;
        let unified_agent = Arc::new(core::agent::UnifiedAgent::new(agent, client));

        Ok(Self {
            agent: unified_agent,
            providers: Arc::new(provider_manager),
            config: Arc::new(RwLock::new(config)),
            tools: Arc::new(tool_manager),
            events: Arc::new(event_emitter),
        })
    }

    /// Get current configuration
    pub async fn get_config(&self) -> core::AgentConfig {
        self.config.read().await.clone()
    }

    /// Update configuration
    pub async fn update_config(&self, config: core::AgentConfig) -> core::Result<()> {
        *self.config.write().await = config.clone();
        self.providers.update_config(&config).await?;
        Ok(())
    }

    /// Get provider manager
    pub fn providers(&self) -> &core::ProviderManager {
        &self.providers
    }

    /// Get tool manager
    pub fn tools(&self) -> &core::ToolManager {
        &self.tools
    }

    /// Get the unified agent
    pub fn agent(&self) -> &core::agent::UnifiedAgent {
        &self.agent
    }

    /// Get event emitter
    pub fn events(&self) -> &events::EventEmitter {
        &self.events
    }
}

// Global agent manager instance
use std::sync::OnceLock;
static AGENT_MANAGER: OnceLock<Arc<AgentManager>> = OnceLock::new();

/// Initialize global agent manager
pub async fn init_agent_manager(config: core::AgentConfig) -> core::Result<()> {
    let manager = Arc::new(AgentManager::new(config).await?);
    AGENT_MANAGER.set(manager)
        .map_err(|_| AgentError::InitializationFailed("Agent manager already initialized".to_string()))?;
    Ok(())
}

/// Get global agent manager
pub fn get_agent_manager() -> Option<Arc<AgentManager>> {
    AGENT_MANAGER.get().cloned()
}

/// Agent state for Tauri management
#[derive(Default)]
pub struct AgentState {
    manager: Option<Arc<AgentManager>>,
}

impl AgentState {
    pub async fn initialize(&mut self, config: core::AgentConfig) -> core::Result<()> {
        let manager = AgentManager::new(config).await?;
        self.manager = Some(Arc::new(manager));
        Ok(())
    }

    pub fn get(&self) -> core::Result<Arc<AgentManager>> {
        self.manager.clone().ok_or(AgentError::ProviderNotInitialized)
    }
}

/// Get agent manager or return error
pub fn require_agent_manager() -> core::Result<Arc<AgentManager>> {
    get_agent_manager().ok_or(AgentError::NotInitialized)
}