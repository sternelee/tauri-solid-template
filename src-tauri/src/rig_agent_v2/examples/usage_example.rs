use crate::rig_agent_v2::*;
use crate::rig_agent_v2::core::*;
use crate::rig_agent_v2::tools::*;
use crate::rig_agent_v2::capabilities::*;

/// Example usage of the unified AI system
pub async fn example_usage() -> Result<()> {
    // 1. Initialize AI system with OpenAI
    let config = AgentConfig::for_provider(AIProvider::OpenAI, "gpt-4o-mini");
    let ai_capability = create_ai_capability_with_config(config).await?;

    // 2. Create a new conversation
    let mut conversation = Conversation::new(Some("Example Conversation".to_string()));

    // 3. Simple chat
    println!("=== Simple Chat ===");
    let response = ai_capability.chat(
        "Hello! How can you help me today?",
        conversation.clone()
    ).await?;

    println!("Assistant: {}", response.message.text_content().unwrap_or("No response"));
    conversation.add_message(response.message);

    // 4. Chat with tools
    println!("\n=== Chat with Tools ===");
    let tool_context = ToolExecutionContext::new("example_session".to_string())
        .with_permissions(vec![
            ToolPermission::Safe,
            ToolPermission::Restricted
        ]);

    let available_tools = ai_capability.get_available_tools(&tool_context).await;
    println!("Available tools: {}", available_tools.len());

    // 5. Execute a tool
    println!("\n=== Tool Execution ===");
    let tool_result = ai_capability.execute_tool(
        "system_info",
        serde_json::json!({}),
        tool_context.clone()
    ).await?;

    if tool_result.success {
        println!("Tool executed successfully: {:?}", tool_result.result);
    } else {
        println!("Tool execution failed: {}", tool_result.error.unwrap_or_default());
    }

    // 6. Streaming chat
    println!("\n=== Streaming Chat ===");
    let mut stream = ai_capability.chat_stream(
        "Tell me a short story about AI",
        conversation.clone()
    ).await?;

    while let Some(event) = stream.next().await {
        match event {
            Ok(StreamEvent::Token { content }) => {
                print!("{}", content);
                // Flush stdout for immediate output
                use std::io::{self, Write};
                let _ = io::stdout().flush();
            }
            Ok(StreamEvent::Complete { .. }) => {
                println!("\n[Stream completed]");
                break;
            }
            Ok(StreamEvent::Error { error }) => {
                println!("\n[Stream error]: {}", error);
                break;
            }
            Err(e) => {
                println!("\n[Error]: {}", e);
                break;
            }
            _ => {}
        }
    }

    // 7. Get system information
    println!("\n=== System Information ===");
    let provider_info = ai_capability.get_provider_info().await?;
    println!("Provider: {:?}", provider_info.provider);
    println!("Model: {}", provider_info.model);
    println!("Supported features: {:?}", provider_info.supported_features);

    // 8. Search tools
    println!("\n=== Tool Search ===");
    let search_results = ai_capability.search_tools("file").await;
    println!("Found {} file-related tools:", search_results.len());
    for tool in search_results {
        println!("- {}: {}", tool.name, tool.description);
    }

    // 9. Update configuration
    println!("\n=== Configuration Update ===");
    let mut new_config = ai_capability.get_config().await;
    new_config.features.enable_react_mode = Some(true);
    new_config.provider.temperature = Some(0.9);

    ai_capability.update_config(new_config).await?;
    println!("Configuration updated successfully");

    // 10. Generate embeddings (if supported)
    if ai_capability.get_provider_info().await?.supported_features.contains(&"embeddings".to_string()) {
        println!("\n=== Embeddings ===");
        let embeddings = ai_capability.embed_texts(vec![
            "Hello world".to_string(),
            "AI is amazing".to_string()
        ]).await?;

        println!("Generated {} embeddings", embeddings.len());
        println!("First embedding dimension: {}", embeddings[0].len());
    }

    Ok(())
}

/// Example of tool registration
pub async fn example_tool_registration() -> Result<()> {
    // Create a custom tool
    struct GreetingTool {
        name: String,
    }

    #[async_trait]
    impl Tool for GreetingTool {
        fn metadata(&self) -> &ToolMetadata {
            static METADATA: std::sync::OnceLock<ToolMetadata> = std::sync::OnceLock::new();
            METADATA.get_or_init(|| ToolMetadata {
                name: "greeting".to_string(),
                description: "Generate a personalized greeting".to_string(),
                category: ToolCategory::Utility,
                priority: ToolPriority::Medium,
                permission: ToolPermission::Safe,
                version: "1.0.0".to_string(),
                author: Some("Example Author".to_string()),
                tags: vec!["greeting".to_string(), "utility".to_string()],
                parameters_schema: serde_json::json!({
                    "type": "object",
                    "properties": {
                        "name": {
                            "type": "string",
                            "description": "Name to greet"
                        },
                        "language": {
                            "type": "string",
                            "description": "Language for greeting",
                            "default": "English"
                        }
                    },
                    "required": ["name"]
                }),
                returns_schema: Some(serde_json::json!({
                    "type": "object",
                    "properties": {
                        "greeting": {
                            "type": "string",
                            "description": "Generated greeting"
                        }
                    }
                })),
                examples: vec![
                    r#"{"name": "Alice"}"#.to_string(),
                    r#"{"name": "Bob", "language": "Spanish"}"#.to_string()
                ],
                dependencies: vec![],
            })
        }

        async fn execute(&self, parameters: &serde_json::Value) -> Result<ToolExecutionResult> {
            let name = parameters.get("name")
                .and_then(|v| v.as_str())
                .ok_or_else(|| AgentError::ToolError("Missing 'name' parameter".to_string()))?;

            let language = parameters.get("language")
                .and_then(|v| v.as_str())
                .unwrap_or("English");

            let greeting = match language {
                "Spanish" => format!("¡Hola, {}!", name),
                "French" => format!("Bonjour, {}!", name),
                "German" => format!("Hallo, {}!", name),
                "Japanese" => format!("こんにちは、{}さん！", name),
                _ => format!("Hello, {}!", name),
            };

            let result = serde_json::json!({
                "greeting": greeting,
                "language": language,
                "name": name
            });

            Ok(ToolExecutionResult::success(
                "greeting".to_string(),
                result,
                10 // 10ms execution time
            ))
        }
    }

    // Register the tool
    let tool_manager = ToolManager::new().await;
    let tool_registration = ToolRegistration::new(
        Arc::new(GreetingTool {
            name: "GreetingTool".to_string(),
        }),
        ToolMetadata::default()
    );

    tool_manager.register_tool(tool_registration).await?;

    println!("Custom tool registered successfully!");

    Ok(())
}

/// Example of event handling
pub async fn example_event_handling() -> Result<()> {
    use crate::rig_agent_v2::events::*;

    let event_emitter = EventEmitter::with_default_buffer();

    // Add console handler for debugging
    event_emitter.add_handler(Arc::new(ConsoleEventHandler)).await;

    // Add file handler for logging
    let file_handler = FileEventHandler::new("agent_events.log".to_string());
    event_emitter.add_handler(Arc::new(file_handler)).await;

    // Add severity filter
    let severity_filter = SeverityFilter::new(EventSeverity::Warning);
    event_emitter.add_filter(Arc::new(severity_filter)).await;

    // Emit some test events
    let info_event = AgentEvent::info(
        "System Started".to_string(),
        "AI agent system has been initialized".to_string()
    ).with_session_id("example_session".to_string());

    let warning_event = AgentEvent::warning(
        "High Memory Usage".to_string(),
        "Memory usage is approaching 80%".to_string()
    ).with_data(serde_json::json!({
        "memory_usage_percent": 80,
        "threshold_percent": 75
    }));

    let error_event = AgentEvent::error(
        "Tool Execution Failed".to_string(),
        "Failed to execute file system tool".to_string(),
        EventError::new(
            "TOOL_ERROR".to_string(),
            "Permission denied".to_string(),
            "PermissionError".to_string()
        )
    ).with_source(EventSource::Tool { tool_name: "file_system".to_string() });

    event_emitter.emit(info_event).await?;
    event_emitter.emit(warning_event).await?;
    event_emitter.emit(error_event).await?;

    // Get statistics
    let stats = event_emitter.get_statistics().await;
    println!("Event Statistics: {:?}", stats);

    Ok(())
}