//! Test module for rig_agent
//!
//! This module contains unit tests and integration tests for the rig_agent system.

#[cfg(test)]
mod tests {
    use super::*;
    use tokio;

    /// Test basic agent configuration
    #[tokio::test]
    async fn test_agent_config() {
        let config = crate::rig_agent::core::AgentConfig::default();

        assert!(!config.provider.model.is_empty());
        assert!(config.features.enable_tools.unwrap_or(false));
        assert!(config.features.enable_streaming.unwrap_or(false));
        assert!(!config.get_system_prompt().is_empty());
    }

    /// Test provider configuration
    #[tokio::test]
    async fn test_provider_config() {
        let mut config = crate::rig_agent::core::AgentConfig::default();

        // Test OpenAI configuration
        config.provider.provider = crate::rig_agent::core::AIProvider::OpenAI;
        config.provider.model = "gpt-4".to_string();

        assert_eq!(config.provider.provider, crate::rig_agent::core::AIProvider::OpenAI);
        assert_eq!(config.provider.model, "gpt-4");
    }

    /// Test conversation creation and management
    #[tokio::test]
    async fn test_conversation() {
        let mut conversation = crate::rig_agent::core::types::Conversation::new(Some("Test".to_string()));

        assert_eq!(conversation.title, Some("Test".to_string()));
        assert_eq!(conversation.get_message_count(), 0);

        // Add messages
        let user_msg = crate::rig_agent::core::types::ChatMessage::new(
            crate::rig_agent::core::types::MessageRole::User,
            "Hello"
        );
        conversation.add_message(user_msg);

        assert_eq!(conversation.get_message_count(), 1);
        assert!(conversation.get_last_user_message().is_some());
    }

    /// Test tool registry
    #[tokio::test]
    async fn test_tool_registry() {
        let registry = crate::rig_agent::tools::ToolRegistry::new();

        // Test empty registry
        let tools = registry.list_tools().await;
        assert_eq!(tools.len(), 0);

        // Test tool existence check
        assert!(!registry.has_tool("test_tool").await);
    }

    /// Test event emission
    #[tokio::test]
    async fn test_event_emission() {
        let emitter = crate::rig_agent::events::EventEmitter::new(100);

        // Create a test event
        let event = crate::rig_agent::events::types::AgentEvent::new(
            crate::rig_agent::events::types::EventType::ChatStarted,
            "Test Event".to_string(),
            "Test Description".to_string(),
            crate::rig_agent::events::types::EventSeverity::Info,
        );

        // Emit event
        let result = emitter.emit(event).await;
        assert!(result.is_ok());

        // Check statistics
        let stats = emitter.get_statistics().await;
        assert_eq!(stats.total_events, 1);
    }

    /// Test MCP approval configuration
    #[tokio::test]
    async fn test_mcp_approval_config() {
        let config = crate::rig_agent::mcp_approval::McpApprovalConfig::default();

        // Test default configuration
        assert!(!config.mcp_servers.is_empty());
        assert!(config.mcp_servers.contains_key("mcp-hub"));

        // Test approval check
        let hub_config = config.get_server_config("mcp-hub").unwrap();
        assert!(!hub_config.disabled);
        assert!(!hub_config.auto_approve.is_empty());

        // Test needs_approval
        assert!(!config.needs_approval("mcp-hub", "fetch-fetch"));
        assert!(config.needs_approval("mcp-hub", "unknown_tool"));
    }

    /// Test tool approval request creation
    #[tokio::test]
    async fn test_tool_approval_request() {
        let request = crate::rig_agent::mcp_approval::ToolApprovalRequest::new(
            "test-server".to_string(),
            "test-tool".to_string(),
            serde_json::json!({"param": "value"}),
            "Test message".to_string(),
            "conv-123".to_string(),
        );

        assert!(!request.request_id.is_empty());
        assert_eq!(request.server_name, "test-server");
        assert_eq!(request.tool_name, "test-tool");
        assert!(!request.is_expired());
    }

    /// Test agent manager
    #[tokio::test]
    async fn test_agent_manager() {
        let config = crate::rig_agent::core::AgentConfig::default();
        let manager = crate::rig_agent::AgentManager::new(config).await.unwrap();

        // Test configuration retrieval
        let retrieved_config = manager.get_config().await;
        assert_eq!(retrieved_config.provider.model, config.provider.model);

        // Test tool manager access
        let tools = manager.tools();
        let tool_list = tools.list_tools().await;
        assert_eq!(tool_list.len(), 0);
    }

    /// Test content parts
    #[tokio::test]
    async fn test_content_parts() {
        // Test text content
        let text_part = crate::rig_agent::core::types::ContentPart::text("Hello, world!");
        if let crate::rig_agent::core::types::ContentPart::Text { text } = text_part {
            assert_eq!(text, "Hello, world!");
        } else {
            panic!("Expected text content part");
        }

        // Test image content
        let image_part = crate::rig_agent::core::types::ContentPart::image_url("https://example.com/image.jpg");
        if let crate::rig_agent::core::types::ContentPart::Image { url, .. } = image_part {
            assert_eq!(url, Some("https://example.com/image.jpg".to_string()));
        } else {
            panic!("Expected image content part");
        }
    }

    /// Test ReAct state
    #[tokio::test]
    async fn test_react_state() {
        let mut state = crate::rig_agent::core::types::ReActState::new();

        assert_eq!(state.iteration, 0);
        assert!(!state.is_complete());

        // Add thought
        state.add_thought("I need to think about this".to_string());
        assert_eq!(state.thoughts.len(), 1);

        // Next iteration
        state.next_iteration();
        assert_eq!(state.iteration, 1);

        // Complete
        state.complete("Final answer".to_string());
        assert!(state.is_complete());
        assert_eq!(state.final_answer, Some("Final answer".to_string()));
    }

    /// Test chat request and response
    #[tokio::test]
    async fn test_chat_request_response() {
        let conversation = crate::rig_agent::core::types::Conversation::new(None);
        let message = crate::rig_agent::core::types::ChatMessage::new(
            crate::rig_agent::core::types::MessageRole::User,
            "Hello"
        );

        let request = crate::rig_agent::core::types::ChatRequest::new(conversation.id.clone(), message);
        assert_eq!(request.conversation_id, conversation.id);

        // Create response
        let response_message = crate::rig_agent::core::types::ChatMessage::new(
            crate::rig_agent::core::types::MessageRole::Assistant,
            "Hi there!"
        );

        let response = crate::rig_agent::core::types::ChatResponse {
            message: response_message,
            usage: None,
            finish_reason: Some("stop".to_string()),
            tool_calls: None,
            duration_ms: 100,
        };

        assert_eq!(response.message.role, crate::rig_agent::core::types::MessageRole::Assistant);
        assert_eq!(response.duration_ms, 100);
    }

    /// Test tool execution context
    #[tokio::test]
    async fn test_tool_execution_context() {
        let context = crate::rig_agent::tools::ToolExecutionContext::new("session-123".to_string());

        assert_eq!(context.session_id, "session-123");
        assert!(context.user_id.is_none());
        assert!(context.has_permission(crate::rig_agent::tools::ToolPermission::Safe));

        // Add permissions
        let context = context.with_permissions(vec![
            crate::rig_agent::tools::ToolPermission::Restricted,
            crate::rig_agent::tools::ToolPermission::Safe,
        ]);

        assert!(context.has_permission(crate::rig_agent::tools::ToolPermission::Restricted));
    }
}

/// Integration tests for the complete system
#[cfg(test)]
mod integration_tests {
    use super::*;

    /// Test complete chat flow
    #[tokio::test]
    async fn test_complete_chat_flow() {
        // Initialize agent manager
        let config = crate::rig_agent::core::AgentConfig::default();
        let manager = crate::rig_agent::AgentManager::new(config).await.unwrap();

        // Create conversation
        let mut conversation = crate::rig_agent::core::types::Conversation::new(Some("Test Chat".to_string()));

        // Add user message
        let user_message = crate::rig_agent::core::types::ChatMessage::new(
            crate::rig_agent::core::types::MessageRole::User,
            "Hello, how are you?"
        );
        conversation.add_message(user_message);

        // Create chat request
        let last_message = conversation.get_last_user_message().unwrap().clone();
        let request = crate::rig_agent::core::types::ChatRequest::new(conversation.id.clone(), last_message);

        // Get agent and send message
        let agent = manager.agent();
        let response = agent.chat(request).await;

        // Verify response
        assert!(response.is_ok());
        let chat_response = response.unwrap();
        assert_eq!(chat_response.message.role, crate::rig_agent::core::types::MessageRole::Assistant);
        assert!(!chat_response.message.text_content().unwrap_or_default().is_empty());
    }

    /// Test tool registration and execution
    #[tokio::test]
    async fn test_tool_registration_and_execution() {
        let registry = crate::rig_agent::tools::ToolRegistry::new();

        // Create a simple test tool
        let metadata = crate::rig_agent::tools::ToolMetadata::new(
            "test_tool".to_string(),
            "A simple test tool".to_string()
        );

        // Create tool handler
        let handler = Arc::new(|parameters: serde_json::Value, _context: crate::rig_agent::tools::ToolExecutionContext| {
            Box::pin(async move {
                Ok(crate::rig_agent::tools::ToolExecutionResult::success(
                    "test_tool".to_string(),
                    serde_json::json!({"result": "success", "input": parameters})
                ))
            })
        });

        let registration = crate::rig_agent::tools::ToolRegistration {
            metadata,
            handler,
        };

        // Register tool
        registry.register_tool(registration).await.unwrap();

        // Verify tool is registered
        assert!(registry.has_tool("test_tool").await);

        // Execute tool
        let request = crate::rig_agent::tools::ToolExecutionRequest::new(
            "test_tool".to_string(),
            serde_json::json!({"test": "value"}),
            crate::rig_agent::tools::ToolExecutionContext::new("test-session".to_string())
        );

        let result = registry.execute_tool(request).await.unwrap();
        assert!(result.success);
        assert_eq!(result.tool_name, "test_tool");
    }

    /// Test event system integration
    #[tokio::test]
    async fn test_event_system_integration() {
        let emitter = crate::rig_agent::events::EventEmitter::new(100);

        // Subscribe to events
        let mut receiver = emitter.subscribe().await;

        // Create and emit event
        let event = crate::rig_agent::events::types::AgentEvent::new(
            crate::rigagent_v2::events::types::EventType::ToolCalled,
            "Tool Called".to_string(),
            "Test tool was called".to_string(),
            crate::rig_agent::events::types::EventSeverity::Info,
        );

        emitter.emit(event).await.unwrap();

        // Receive event
        let received_event = receiver.recv().await.unwrap();
        assert_eq!(received_event.title, "Tool Called");

        // Check statistics
        let stats = emitter.get_statistics().await;
        assert_eq!(stats.total_events, 1);
    }
}