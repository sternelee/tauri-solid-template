pub use super::*;

/// Streaming chat capability
pub struct StreamingCapability {
    agent_manager: Arc<super::super::AgentManager>,
}

impl StreamingCapability {
    pub fn new(agent_manager: Arc<super::super::AgentManager>) -> Self {
        Self { agent_manager }
    }

    pub async fn chat_stream(
        &self,
        message: &str,
        conversation: super::Conversation,
    ) -> Result<Pin<Box<dyn futures::Stream<Item = Result<super::StreamEvent>> + Send>>> {
        let chat_message = super::ChatMessage::new(super::MessageRole::User, message);
        let request = super::ChatRequest::new(conversation.id.clone(), chat_message);

        // Emit stream started event
        let start_event = crate::rig_agent_v2::events::types::AgentEvent::new(
            crate::rig_agent_v2::events::types::EventType::StreamStarted,
            "Stream Started".to_string(),
            format!("Starting stream with conversation: {}", conversation.id),
        )
        .with_conversation_id(conversation.id.clone())
        .with_correlation_id(conversation.id.clone());

        let _ = crate::rig_agent_v2::events::EventEmitter::emit_global(start_event).await;

        // Execute streaming chat through agent manager
        match self.agent_manager.providers().get_agent().await {
            Ok(agent) => {
                let client = self.agent_manager.providers().get_client().await?;
                let unified_agent = super::UnifiedAgent::new(agent, client);
                unified_agent.chat_stream(request).await
            }
            Err(e) => {
                // Return error stream
                use futures::stream;
                Ok(Box::pin(stream::once(async {
                    Err(super::AgentError::ProviderNotInitialized)
                })))
            }
        }
    }
}

/// Tool call parsing result
struct ParsedToolCall {
    name: String,
    parameters: serde_json::Value,
}

/// ReAct streaming capability with complete reasoning loop
pub struct ReActCapability {
    agent_manager: Arc<super::super::AgentManager>,
    config: super::ReActConfig,
}

impl ReActCapability {
    pub fn new(agent_manager: Arc<super::super::AgentManager>) -> Self {
        Self {
            agent_manager,
            config: super::ReActConfig::default(),
        }
    }

    pub fn with_config(mut self, config: super::ReActConfig) -> Self {
        self.config = config;
        self
    }

    pub async fn chat_react(
        &self,
        message: &str,
        conversation: super::Conversation,
        tools: Option<Vec<String>>,
    ) -> Result<Pin<Box<dyn futures::Stream<Item = Result<super::StreamEvent>> + Send>>> {
        use futures::stream;
        use futures::StreamExt;

        // Initialize ReAct state
        let mut state = super::ReActState::new();
        state.current_context = format!("User question: {}", message);

        let agent_manager = self.agent_manager.clone();
        let config = self.config.clone();
        let conversation_id = conversation.id.clone();

        // Create a stream that will emit ReAct events
        let stream = stream::unfold(
            (
                state,
                conversation,
                agent_manager,
                config,
                tools,
                message.to_string(),
            ),
            |(mut state, conv, manager, config, tools, original_message)| {
                async move {
                    if state.iteration == 0 {
                        // First iteration - emit start event
                        state.next_iteration();
                        let event = super::StreamEvent::Start {
                            conversation_id: conv.id.clone(),
                            message_id: uuid::Uuid::new_v4().to_string(),
                            timestamp: chrono::Utc::now().to_rfc3339(),
                        };
                        Some((
                            Ok(event),
                            (state, conv, manager, config, tools, original_message),
                        ))
                    } else if state.iteration > config.max_iterations || state.is_complete() {
                        // Final iteration - emit completion
                        let final_answer = state.final_answer.clone().unwrap_or_else(|| {
                            "I apologize, but I couldn't complete the reasoning process."
                                .to_string()
                        });
                        let event = super::StreamEvent::ReActComplete {
                            final_answer,
                            iterations: state.iteration,
                            timestamp: chrono::Utc::now().to_rfc3339(),
                        };
                        Some((
                            Ok(event),
                            (state, conv, manager, config, tools, original_message),
                        ))
                    } else {
                        // Regular ReAct iteration
                        state.next_iteration();

                        // Emit iteration start event
                        let iteration_event = super::StreamEvent::ReActIteration {
                            iteration: state.iteration,
                            max_iterations: config.max_iterations,
                            timestamp: chrono::Utc::now().to_rfc3339(),
                        };

                        // Perform thinking step
                        let thinking_result = Self::perform_thinking_step(
                            &manager,
                            &config,
                            &state,
                            &original_message,
                        )
                        .await;

                        match thinking_result {
                            Ok(thought) => {
                                state.add_thought(thought.clone());
                                let thought_event = super::StreamEvent::ReActThought {
                                    thought,
                                    iteration: state.iteration,
                                    timestamp: chrono::Utc::now().to_rfc3339(),
                                };
                                Some((
                                    Ok(thought_event),
                                    (state, conv, manager, config, tools, original_message),
                                ))
                            }
                            Err(e) => {
                                let error_event = super::StreamEvent::Error {
                                    error: e.to_string(),
                                    timestamp: chrono::Utc::now().to_rfc3339(),
                                };
                                Some((
                                    Ok(error_event),
                                    (state, conv, manager, config, tools, original_message),
                                ))
                            }
                        }
                    }
                }
            },
        );

        Ok(Box::pin(stream))
    }

    // ReAct reasoning steps
    async fn perform_thinking_step(
        manager: &Arc<super::super::AgentManager>,
        config: &super::ReActConfig,
        state: &super::ReActState,
        original_message: &str,
    ) -> Result<String> {
        // Create thinking prompt
        let context = format!(
            "Original question: {}\n\nIteration: {}\n\nPrevious thoughts:\n{}\n\nPrevious actions:\n{}\n\nPrevious observations:\n{}\n\n{}",
            original_message,
            state.iteration,
            state.thoughts.join("\n"),
            state.actions.join("\n"),
            state.observations.join("\n"),
            config.thinking_prompt
        );

        // Use the agent to generate thinking
        let chat_message = super::ChatMessage::new(super::MessageRole::User, context);
        let request = super::ChatRequest::new("thinking".to_string(), chat_message);

        match manager.agent().chat(request).await {
            Ok(response) => Ok(response.message.text_content().unwrap_or_default()),
            Err(e) => Err(e),
        }
    }

    async fn perform_action_step(
        manager: &Arc<super::super::AgentManager>,
        config: &super::ReActConfig,
        state: &mut super::ReActState,
        available_tools: &Option<Vec<String>>,
    ) -> Result<String> {
        // Create action prompt
        let tools_info = if let Some(tools) = available_tools {
            format!("Available tools: {}", tools.join(", "))
        } else {
            "No tools available".to_string()
        };

        let context = format!(
            "Current context: {}\n\nIteration: {}\n\nLast thought: {}\n\n{}\n\n{}\n\nTools info: {}\n\nAvailable actions:\n1. Use a tool: specify the tool name and parameters\n2. Provide answer directly: say 'FINAL ANSWER: [your answer]' if you have enough information\n3. Continue thinking: say 'CONTINUE THINKING' if you need more analysis",
            state.current_context,
            state.iteration,
            state.thoughts.last().unwrap_or(&"No previous thought".to_string()),
            config.action_prompt,
            if config.enable_tool_use { "You may use available tools if needed." } else { "" },
            tools_info
        );

        // Use the agent to generate action
        let chat_message = super::ChatMessage::new(super::MessageRole::User, context);
        let request = super::ChatRequest::new("action".to_string(), chat_message);

        match manager.agent().chat(request).await {
            Ok(response) => {
                let action = response.message.text_content().unwrap_or_default();

                // Check if action contains tool usage
                if config.enable_tool_use && action.to_lowercase().contains("use") {
                    // Parse tool call from action
                    if let Some(tool_call) = Self::parse_tool_call(&action, available_tools) {
                        // Execute tool
                        match Self::execute_tool(manager, &tool_call).await {
                            Ok(result) => {
                                // Store tool call and result
                                let tool_call_name = tool_call.name.clone();
                                let tool_call_obj = super::ToolCall {
                                    id: uuid::Uuid::new_v4().to_string(),
                                    name: tool_call_name.clone(),
                                    arguments: tool_call.parameters,
                                    result: Some(result.clone()),
                                };
                                state.add_tool_call(tool_call_obj);
                                state.add_tool_result(result);
                                Ok(format!("Used tool '{}' and got result", tool_call_name))
                            }
                            Err(e) => Ok(format!("Failed to use tool: {}", e)),
                        }
                    } else {
                        Ok("Tool call could not be parsed. Please specify tool name and parameters clearly.".to_string())
                    }
                } else {
                    Ok(action)
                }
            }
            Err(e) => Err(e),
        }
    }

    async fn perform_observation_step(
        manager: &Arc<super::super::AgentManager>,
        config: &super::ReActConfig,
        state: &super::ReActState,
    ) -> Result<String> {
        // Create observation prompt
        let context = format!(
            "Current context: {}\n\nIteration: {}\n\nLast action: {}\n\n{}",
            state.current_context,
            state.iteration,
            state
                .actions
                .last()
                .unwrap_or(&"No previous action".to_string()),
            config.observation_prompt
        );

        // Use the agent to generate observation
        let chat_message = super::ChatMessage::new(super::MessageRole::User, context);
        let request = super::ChatRequest::new("observation".to_string(), chat_message);

        match manager.agent().chat(request).await {
            Ok(response) => Ok(response.message.text_content().unwrap_or_default()),
            Err(e) => Err(e),
        }
    }

    async fn generate_final_answer(
        manager: &Arc<super::super::AgentManager>,
        config: &super::ReActConfig,
        state: &super::ReActState,
        original_message: &str,
    ) -> Result<String> {
        // Create final answer prompt
        let context = format!(
            "Original question: {}\n\nTotal iterations: {}\n\nComplete reasoning:\n\nThoughts:\n{}\n\nActions:\n{}\n\nObservations:\n{}\n\n{}",
            original_message,
            state.iteration,
            state.thoughts.join("\n"),
            state.actions.join("\n"),
            state.observations.join("\n"),
            config.final_answer_prompt
        );

        // Use the agent to generate final answer
        let chat_message = super::ChatMessage::new(super::MessageRole::User, context);
        let request = super::ChatRequest::new("final_answer".to_string(), chat_message);

        match manager.agent().chat(request).await {
            Ok(response) => Ok(response.message.text_content().unwrap_or_default()),
            Err(e) => Err(e),
        }
    }

    // Tool parsing and execution helpers

    fn parse_tool_call(
        action: &str,
        available_tools: &Option<Vec<String>>,
    ) -> Option<ParsedToolCall> {
        // Simple tool call parsing
        // Look for patterns like "use tool_name with parameters: {...}" or "use tool_name({})"
        let action_lower = action.to_lowercase();

        if let Some(tools) = available_tools {
            for tool_name in tools {
                let tool_pattern = format!("use {}", tool_name.to_lowercase());
                if action_lower.contains(&tool_pattern) {
                    // Extract parameters - this is a simple implementation
                    // In a real implementation, you'd want more sophisticated parsing
                    if let Some(start) = action.find('{') {
                        if let Some(end) = action.rfind('}') {
                            let params_str = &action[start..=end];
                            if let Ok(params) =
                                serde_json::from_str::<serde_json::Value>(params_str)
                            {
                                return Some(ParsedToolCall {
                                    name: tool_name.clone(),
                                    parameters: params,
                                });
                            }
                        }
                    }

                    // If no JSON found, try to extract simple parameters
                    return Some(ParsedToolCall {
                        name: tool_name.clone(),
                        parameters: serde_json::json!({}),
                    });
                }
            }
        }

        None
    }

    async fn execute_tool(
        manager: &Arc<super::super::AgentManager>,
        tool_call: &ParsedToolCall,
    ) -> Result<super::ToolResult> {
        // Execute tool using the manager's tool system
        match manager
            .tools()
            .execute(&tool_call.name, tool_call.parameters.clone())
        {
            Ok(result) => Ok(super::ToolResult {
                tool_call_id: uuid::Uuid::new_v4().to_string(),
                success: true,
                result: Some(result),
                error: None,
                execution_time_ms: None,
            }),
            Err(e) => Ok(super::ToolResult {
                tool_call_id: uuid::Uuid::new_v4().to_string(),
                success: false,
                result: None,
                error: Some(e),
                execution_time_ms: None,
            }),
        }
    }
}
