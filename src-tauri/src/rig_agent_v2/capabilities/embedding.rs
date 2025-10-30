use crate::rig_agent_v2::core::*;
use std::sync::Arc;

pub struct EmbeddingCapability {
    agent_manager: Arc<super::super::AgentManager>,
}

impl EmbeddingCapability {
    pub fn new(agent_manager: Arc<super::super::AgentManager>) -> Self {
        Self { agent_manager }
    }

    pub async fn generate_embeddings(&self, texts: Vec<String>) -> Result<Vec<Vec<f32>>> {
        // Get the unified agent from the agent manager
        let agent = self.agent_manager.agent();

        // Use the agent's embedding functionality
        agent.generate_embeddings(texts).await
    }
}

