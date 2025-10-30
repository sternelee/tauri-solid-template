use rig::agent::Agent;
use rig::completion::{CompletionError, CompletionModel, PromptError};
use rig::message::{AssistantContent, Message, ToolResultContent, UserContent};
use rig::streaming::{StreamedAssistantContent, StreamingCompletion};
use rig::tool::{Tool, ToolSetError};
use rig::OneOrMany;
use serde::{Deserialize, Serialize};
use std::pin::Pin;
use std::sync::Arc;
use thiserror::Error;
use futures::FutureExt;
use tokio::sync::Notify;

#[derive(Debug, Error)]
pub enum ReactAgentError {
    #[error("CompletionError: {0}")]
    Completion(#[from] CompletionError),
    #[error("PromptError: {0}")]
    Prompt(#[from] PromptError),
    #[error("ToolSetError: {0}")]
    Tool(#[from] ToolSetError),
    #[error("Agent error: {0}")]
    Custom(String),
    #[error("Agent execution cancelled")]
    Cancelled,
}

pub type ReactAgentStreamResult =
    Pin<Box<dyn futures::Stream<Item = Result<ReactAgentStreamEvent, ReactAgentError>> + Send>>;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum ReactAgentStreamEvent {
    Text {
        content: String,
    },
    Reasoning {
        content: String,
    },
    ToolCall {
        tool_name: String,
        arguments: String,
    },
    ToolResult {
        tool_name: String,
        result: String,
    },
    Complete,
}

/// Configuration for the ReAct agent behavior
#[derive(Debug, Clone)]
pub struct ReactAgentConfig {
    /// Maximum number of tool call iterations (default: 20)
    pub max_iterations: usize,
    /// Whether to stream tool calls and results (default: true)
    pub stream_tool_events: bool,
    /// Cancellation signal (optional)
    pub cancel_signal: Option<Arc<Notify>>,
    /// Whether to enable reasoning steps (default: true)
    pub enable_reasoning: bool,
    /// Custom preamble for ReAct mode
    pub react_preamble: Option<String>,
}

impl Default for ReactAgentConfig {
    fn default() -> Self {
        Self {
            max_iterations: 20,
            stream_tool_events: true,
            cancel_signal: None,
            enable_reasoning: true,
            react_preamble: Some(
                "You are a helpful AI assistant that uses the ReAct (Reasoning and Acting) pattern. \
                Think step by step and use available tools when necessary. \
                Follow this format:\n\n\
                Thought: [Your reasoning about what to do]\n\
                Action: [Tool name and parameters if needed]\n\
                Observation: [Result of the action]\n\
                ... (repeat as needed)\n\
                Final Answer: [Your final response]"
                    .to_string(),
            ),
        }
    }
}

/// Multi-turn agent prompt execution using ReAct pattern
/// This function implements the ReAct pattern:
/// 1. Thought: Reason about the current situation
/// 2. Action: Decide on a tool to use (if needed)
/// 3. Observation: Get the result of the tool action
/// 4. Repeat until final answer is ready
pub async fn multi_turn_react_agent<M>(
    agent: Agent<M>,
    prompt: impl Into<Message> + Send,
    chat_history: Vec<rig::completion::Message>,
    config: ReactAgentConfig,
) -> ReactAgentStreamResult
where
    M: CompletionModel + 'static,
    <M as CompletionModel>::StreamingResponse: std::marker::Send,
{
    let prompt: Message = prompt.into();
    let mut current_prompt = prompt;
    let mut history = chat_history;
    let mut iteration = 0;
    let mut events = Vec::new();

    // Add ReAct preamble if provided
    let enhanced_prompt = if let Some(preamble) = &config.react_preamble {
        format!("{}\n\n{}", preamble, current_prompt)
    } else {
        current_prompt
    };

    loop {
        // Check cancellation signal
        if let Some(cancel_signal) = &config.cancel_signal {
            if cancel_signal.notified().now_or_never().is_some() {
                events.push(Err(ReactAgentError::Cancelled));
                break;
            }
        }

        // Check max iterations
        if iteration >= config.max_iterations {
            events.push(Err(ReactAgentError::Custom(format!(
                "Maximum agent iterations ({}) reached",
                config.max_iterations
            ))));
            break;
        }

        iteration += 1;

        // Get streaming completion from the agent
        let stream_result: Result<_, CompletionError> = agent
            .stream_completion(enhanced_prompt.clone(), history.clone())
            .await;

        let mut stream_content = match stream_result {
            Ok(completion) => match completion.stream().await {
                Ok(s) => s,
                Err(e) => {
                    events.push(Err(ReactAgentError::Completion(e)));
                    break;
                }
            },
            Err(e) => {
                events.push(Err(ReactAgentError::Completion(e)));
                break;
            }
        };

        // Add current prompt to history
        history.push(enhanced_prompt.clone());

        let mut tool_calls = vec![];
        let mut tool_results = vec![];
        let mut reasoning_content = String::new();
        let mut text_content = String::new();

        // Process the stream
        while let Some(content) = stream_content.next().await {
            // Check cancellation during stream processing
            if let Some(cancel_signal) = &config.cancel_signal {
                if cancel_signal.notified().now_or_never().is_some() {
                    return Box::pin(futures::stream::iter(events));
                }
            }

            match content {
                Ok(StreamedAssistantContent::Text(text)) => {
                    // Only send text event if content is not empty
                    if !text.text.is_empty() {
                        text_content.push_str(&text.text);
                        if config.stream_tool_events {
                            events.push(Ok(ReactAgentStreamEvent::Text {
                                content: text.text.clone(),
                            }));
                        }
                    }
                }
                Ok(StreamedAssistantContent::Reasoning(reasoning)) => {
                    if config.enable_reasoning && !reasoning.reasoning.is_empty() {
                        let reasoning_text = reasoning.reasoning.join("");
                        reasoning_content.push_str(&reasoning_text);
                        if config.stream_tool_events {
                            events.push(Ok(ReactAgentStreamEvent::Reasoning {
                                content: reasoning_text.clone(),
                            }));
                        }
                    }
                }
                Ok(StreamedAssistantContent::ToolCall(tool_call)) => {
                    // Emit tool call event if configured
                    if config.stream_tool_events {
                        events.push(Ok(ReactAgentStreamEvent::ToolCall {
                            tool_name: tool_call.function.name.clone(),
                            arguments: tool_call.function.arguments.to_string(),
                        }));
                    }

                    // Execute the tool
                    let tool_result = match agent
                        .tools
                        .call(
                            &tool_call.function.name,
                            tool_call.function.arguments.to_string(),
                        )
                        .await
                    {
                        Ok(result) => result,
                        Err(e) => {
                            events.push(Err(ReactAgentError::Tool(e)));
                            break;
                        }
                    };

                    // Emit tool result event if configured
                    if config.stream_tool_events {
                        events.push(Ok(ReactAgentStreamEvent::ToolResult {
                            tool_name: tool_call.function.name.clone(),
                            result: tool_result.clone(),
                        }));
                    }

                    let tool_call_msg = AssistantContent::ToolCall(tool_call.clone());
                    tool_calls.push(tool_call_msg);
                    tool_results.push((tool_call.id, tool_call.call_id, tool_result));
                }
                Ok(StreamedAssistantContent::Final(_)) => {
                    // Stream completed
                    break;
                }
                Err(e) => {
                    events.push(Err(ReactAgentError::Completion(e)));
                    break;
                }
            }
        }

        // If we had tool calls, add them to history and continue the loop
        if !tool_calls.is_empty() {
            // Add assistant's tool calls to chat history
            history.push(Message::Assistant {
                id: None,
                content: OneOrMany::many(tool_calls).expect("Tool calls should not be empty"),
            });

            // Add tool results to chat history
            for (id, call_id, tool_result) in tool_results {
                if let Some(call_id) = call_id {
                    history.push(Message::User {
                        content: OneOrMany::one(UserContent::tool_result_with_call_id(
                            id,
                            call_id,
                            OneOrMany::one(ToolResultContent::text(tool_result)),
                        )),
                    });
                } else {
                    history.push(Message::User {
                        content: OneOrMany::one(UserContent::tool_result(
                            id,
                            OneOrMany::one(ToolResultContent::text(tool_result)),
                        )),
                    });
                }
            }

            // Create a continuation prompt for the next iteration
            enhanced_prompt = Message::User {
                content: OneOrMany::one(UserContent::Text(rig::message::Text {
                    text: "Please continue with the next step in your reasoning process.".to_string(),
                })),
            };

            // Continue the loop to get the next response
            continue;
        }

        // No tool calls - agent has finished
        events.push(Ok(ReactAgentStreamEvent::Complete));
        break;
    }

    Box::pin(futures::stream::iter(events))
}

/// Non-streaming version of multi-turn ReAct agent
/// Returns the final response as a string
pub async fn multi_turn_react_chat<M>(
    agent: Agent<M>,
    prompt: impl Into<Message> + Send,
    mut chat_history: Vec<rig::completion::Message>,
    config: ReactAgentConfig,
) -> Result<String, ReactAgentError>
where
    M: CompletionModel + 'static,
    <M as CompletionModel>::StreamingResponse: std::marker::Send,
{
    let prompt: Message = prompt.into();
    let mut current_prompt = prompt;
    let mut iteration = 0;
    let mut final_response = String::new();

    // Add ReAct preamble if provided
    let enhanced_prompt = if let Some(preamble) = &config.react_preamble {
        format!("{}\n\n{}", preamble, current_prompt)
    } else {
        current_prompt
    };

    loop {
        // Check cancellation signal
        if let Some(cancel_signal) = &config.cancel_signal {
            if cancel_signal.notified().now_or_never().is_some() {
                return Err(ReactAgentError::Cancelled);
            }
        }

        // Check max iterations
        if iteration >= config.max_iterations {
            return Err(ReactAgentError::Custom(format!(
                "Maximum agent iterations ({}) reached",
                config.max_iterations
            )));
        }

        iteration += 1;

        // Get streaming completion from the agent
        let stream_result: Result<_, CompletionError> = agent
            .stream_completion(enhanced_prompt.clone(), chat_history.clone())
            .await;

        let mut stream = match stream_result {
            Ok(completion) => match completion.stream().await {
                Ok(s) => s,
                Err(e) => return Err(ReactAgentError::Completion(e)),
            },
            Err(e) => return Err(ReactAgentError::Completion(e)),
        };

        // Add current prompt to history
        chat_history.push(enhanced_prompt.clone());

        let mut tool_calls = vec![];
        let mut tool_results = vec![];
        let mut response_text = String::new();

        // Process the stream
        while let Some(content) = stream.next().await {
            match content {
                Ok(StreamedAssistantContent::Text(text)) => {
                    response_text.push_str(&text.text);
                }
                Ok(StreamedAssistantContent::Reasoning(reasoning)) => {
                    // Include reasoning in the response
                    if config.enable_reasoning && !reasoning.reasoning.is_empty() {
                        response_text.push_str(&format!("[Reasoning: {}] ", reasoning.reasoning.join("")));
                    }
                }
                Ok(StreamedAssistantContent::ToolCall(tool_call)) => {
                    // Execute the tool
                    let tool_result = agent
                        .tools
                        .call(
                            &tool_call.function.name,
                            tool_call.function.arguments.to_string(),
                        )
                        .await?;

                    let tool_call_msg = AssistantContent::ToolCall(tool_call.clone());
                    tool_calls.push(tool_call_msg);
                    tool_results.push((tool_call.id, tool_call.call_id, tool_result));
                }
                Ok(StreamedAssistantContent::Final(_)) => {
                    // Stream completed
                    break;
                }
                Err(e) => {
                    return Err(ReactAgentError::Completion(e));
                }
            }
        }

        // If we had tool calls, add them to history and continue the loop
        if !tool_calls.is_empty() {
            // Add assistant's tool calls to chat history
            history.push(Message::Assistant {
                id: None,
                content: OneOrMany::many(tool_calls).expect("Tool calls should not be empty"),
            });

            // Add tool results to chat history
            for (id, call_id, tool_result) in tool_results {
                if let Some(call_id) = call_id {
                    history.push(Message::User {
                        content: OneOrMany::one(UserContent::tool_result_with_call_id(
                            id,
                            call_id,
                            OneOrMany::one(ToolResultContent::text(tool_result)),
                        )),
                    });
                } else {
                    history.push(Message::User {
                        content: OneOrMany::one(UserContent::tool_result(
                            id,
                            OneOrMany::one(ToolResultContent::text(tool_result)),
                        )),
                    });
                }
            }

            // Create a continuation prompt for the next iteration
            enhanced_prompt = Message::User {
                content: OneOrMany::one(UserContent::Text(rig::message::Text {
                    text: "Please continue with the next step in your reasoning process.".to_string(),
                })),
            };

            // Continue the loop to get the next response
            continue;
        }

        // No tool calls - agent has finished
        final_response = response_text;
        break;
    }

    Ok(final_response)
}

#[cfg(test)]
mod tests {
    use super::*;
    use rig::providers::openai;
    use serde_json::json;

    #[derive(Deserialize)]
    struct OperationArgs {
        x: f64,
        y: f64,
    }

    #[derive(Debug, thiserror::Error)]
    #[error("Math error")]
    struct MathError;

    #[derive(Deserialize, Serialize)]
    struct Add;

    impl Tool for Add {
        const NAME: &'static str = "add";
        type Error = MathError;
        type Args = OperationArgs;
        type Output = f64;

        async fn definition(&self, _prompt: String) -> rig::tool::ToolDefinition {
            rig::tool::ToolDefinition {
                name: "add".to_string(),
                description: "Add x and y together".to_string(),
                parameters: json!({
                    "type": "object",
                    "properties": {
                        "x": {"type": "number"},
                        "y": {"type": "number"}
                    },
                    "required": ["x", "y"]
                }),
            }
        }

        async fn call(&self, args: Self::Args) -> Result<Self::Output, Self::Error> {
            Ok(args.x + args.y)
        }
    }

    #[tokio::test]
    #[ignore] // Ignore by default as it requires API key
    async fn test_react_agent() {
        // This test requires OPENAI_API_KEY environment variable
        let client = openai::Client::from_env();

        let agent = client
            .agent("gpt-4o-mini")
            .preamble("You are a calculator. You must use tools to get the user result")
            .tool(Add)
            .build();

        let config = ReactAgentConfig {
            max_iterations: 10,
            stream_tool_events: true,
            ..Default::default()
        };

        let result = multi_turn_react_chat(agent, "What is 2 + 3?", Vec::new(), config).await;

        assert!(result.is_ok());
        println!("ReAct agent response: {}", result.unwrap());
    }
}