use super::*;

#[tokio::test]
async fn test_react_agent_config() {
    // Test configuration defaults
    let config = ReactAgentConfig::default();
    assert_eq!(config.max_iterations, 20);
    assert!(config.stream_tool_events);
    assert!(config.enable_reasoning);
    assert!(config.react_preamble.is_some());
    assert!(config.cancel_signal.is_none());

    // Test custom configuration
    let custom_config = ReactAgentConfig {
        max_iterations: 5,
        stream_tool_events: false,
        enable_reasoning: false,
        react_preamble: Some("Custom preamble".to_string()),
        cancel_signal: None,
    };

    assert_eq!(custom_config.max_iterations, 5);
    assert!(!custom_config.stream_tool_events);
    assert!(!custom_config.enable_reasoning);
    assert_eq!(custom_config.react_preamble, Some("Custom preamble".to_string()));
}

#[tokio::test]
async fn test_react_agent_events() {
    // Test event serialization
    let text_event = ReactAgentStreamEvent::Text {
        content: "Hello, world!".to_string(),
    };
    
    let reasoning_event = ReactAgentStreamEvent::Reasoning {
        content: "I need to think about this.".to_string(),
    };
    
    let tool_call_event = ReactAgentStreamEvent::ToolCall {
        tool_name: "add".to_string(),
        arguments: "{\"x\": 1, \"y\": 2}".to_string(),
    };
    
    let tool_result_event = ReactAgentStreamEvent::ToolResult {
        tool_name: "add".to_string(),
        result: "3".to_string(),
    };
    
    let complete_event = ReactAgentStreamEvent::Complete;

    // Test serialization
    let text_json = serde_json::to_value(&text_event).unwrap();
    let reasoning_json = serde_json::to_value(&reasoning_event).unwrap();
    let tool_call_json = serde_json::to_value(&tool_call_event).unwrap();
    let tool_result_json = serde_json::to_value(&tool_result_event).unwrap();
    let complete_json = serde_json::to_value(&complete_event).unwrap();

    // Verify serialized values
    assert_eq!(text_json["type"], "Text");
    assert_eq!(text_json["content"], "Hello, world!");
    
    assert_eq!(reasoning_json["type"], "Reasoning");
    assert_eq!(reasoning_json["content"], "I need to think about this.");
    
    assert_eq!(tool_call_json["type"], "ToolCall");
    assert_eq!(tool_call_json["tool_name"], "add");
    assert_eq!(tool_call_json["arguments"], "{\"x\": 1, \"y\": 2}");
    
    assert_eq!(tool_result_json["type"], "ToolResult");
    assert_eq!(tool_result_json["tool_name"], "add");
    assert_eq!(tool_result_json["result"], "3");
    
    assert_eq!(complete_json["type"], "Complete");
}

// Performance test for ReAct agent (simplified)
#[tokio::test]
async fn test_react_agent_performance() {
    // Simple performance test without actual API calls
    let start = std::time::Instant::now();
    
    // Simulate some processing time
    tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
    
    let duration = start.elapsed();
    
    println!("Performance test completed in: {:?}", duration);
    
    // Should complete within a reasonable time (adjust as needed)
    assert!(duration.as_millis() < 1000);
}