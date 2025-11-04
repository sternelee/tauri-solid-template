use crate::rig_agent::core::*;
use std::sync::Arc;

pub struct ImageCapability {
    agent_manager: Arc<super::super::AgentManager>,
}

impl ImageCapability {
    pub fn new(agent_manager: Arc<super::super::AgentManager>) -> Self {
        Self { agent_manager }
    }

    pub async fn generate_image(
        &self,
        prompt: &str,
        params: Option<ImageGenerationParams>,
    ) -> Result<ImageGenerationResponse> {
        // Get the unified agent from the agent manager
        let agent = self.agent_manager.agent();

        // Convert parameters to JSON format
        let params_json = params.map(|p| serde_json::to_value(p).unwrap_or_default());

        // Use the agent's image generation functionality
        let result = agent.generate_image(prompt, params_json).await?;

        // Convert the result to ImageGenerationResponse format
        serde_json::from_value(result).map_err(|e| AgentError::SerializationError(e))
    }
}
