# Rig Agent v2 Architecture Documentation

## Overview

Rig Agent v2 is a comprehensive AI agent system built for the Tauri Solid Start application. It provides a unified interface for multiple AI providers, advanced tool execution capabilities, and robust event handling.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (SolidJS)                        │
├─────────────────────────────────────────────────────────────────┤
│                        Tauri Commands                           │
├─────────────────────────────────────────────────────────────────┤
│                      Rig Agent v2 Core                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌──────────┐ │
│  │   Agent     │  │  Provider   │  │    Tool     │  │  Event   │ │
│  │  Manager    │  │  Manager    │  │   System    │  │  System  │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └──────────┘ │
├─────────────────────────────────────────────────────────────────┤
│                       MCP Integration                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │   MCP       │  │   Approval  │  │    MCP      │              │
│  │  Client     │  │   Manager   │  │   Adapter   │              │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
├─────────────────────────────────────────────────────────────────┤
│                      AI Providers                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │   OpenAI    │  │  Anthropic  │  │    Others   │              │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
└─────────────────────────────────────────────────────────────────┘
```

## Core Components

### 1. Agent Manager (`mod.rs`)

The main entry point for all AI operations. Provides a unified interface for:

- Chat completion (standard and streaming)
- Tool execution
- Embedding generation
- Image generation
- Event emission

```rust
pub struct AgentManager {
    agent: Arc<core::agent::UnifiedAgent>,
    providers: Arc<core::ProviderManager>,
    config: Arc<RwLock<core::AgentConfig>>,
    tools: Arc<core::ToolManager>,
    events: Arc<events::EventEmitter>,
}
```

### 2. Core System (`core/`)

#### 2.1 Agent (`core/agent.rs`)

The `UnifiedAgent` provides a single interface for all AI operations:

- **Chat**: Standard chat completion with context support
- **Streaming**: Real-time token-by-token response streaming
- **Embeddings**: Text vectorization for semantic search
- **Image Generation**: AI-powered image creation
- **Tool Integration**: Seamless tool execution

#### 2.2 Provider Management (`core/provider.rs`)

Handles multiple AI providers with caching and configuration management:

- **Supported Providers**: OpenAI, Anthropic, Google, Groq, Cohere, Mistral, etc.
- **Caching**: Automatic client and agent caching for performance
- **Configuration**: Dynamic provider configuration updates
- **Validation**: Configuration validation and error handling

#### 2.3 Configuration (`core/config.rs`)

Type-safe configuration management:

```rust
pub struct AgentConfig {
    pub provider: ProviderConfig,
    pub features: FeatureConfig,
    pub system: SystemConfig,
}
```

- **Provider Configuration**: API keys, models, provider-specific settings
- **Feature Toggles**: Enable/disable capabilities (vision, tools, streaming, etc.)
- **System Prompts**: Customizable AI behavior and personality

#### 2.4 Types (`core/types.rs`)

Core data structures for the system:

- **Messages**: Multi-modal message support (text, images, audio, video)
- **Conversations**: Chat history management
- **Streaming Events**: Real-time communication events
- **Tool Execution**: Tool call and result structures

### 3. Tool System (`tools/`)

#### 3.1 Tool Registry (`tools/registry.rs`)

Centralized tool management with:

- **Registration**: Dynamic tool registration with metadata
- **Execution**: Safe tool execution with validation
- **Metrics**: Performance tracking and statistics
- **Permissions**: Role-based access control
- **Search**: Tool discovery by name, category, or tags

```rust
pub struct ToolRegistry {
    tools: Arc<RwLock<HashMap<String, ToolRegistration>>>,
    metrics: Arc<RwLock<HashMap<String, ToolMetrics>>>,
}
```

#### 3.2 MCP Adapter (`tools/mcp_adapter.rs`)

Integration with Model Context Protocol (MCP) servers:

- **Protocol Bridge**: Converts between internal and MCP formats
- **Tool Discovery**: Automatic tool discovery from MCP servers
- **Lifecycle Management**: Server connection and health monitoring

### 4. Event System (`events/`)

#### 4.1 Event Emitter (`events/emitter.rs`)

High-performance event broadcasting:

- **Subscriptions**: Filtered event subscriptions
- **History**: Configurable event history with circular buffer
- **Handlers**: Pluggable event handlers
- **Filters**: Event filtering and routing
- **Export**: JSON/CSV event export capabilities

#### 4.2 Event Types (`events/types.rs`)

Rich event modeling:

```rust
pub enum EventType {
    ChatStarted,
    ChatCompleted,
    ToolCalled,
    ToolCompleted,
    Error,
    // ... many more
}
```

### 5. MCP Integration (`mcp_approval.rs`, `mcp_approval_manager.rs`)

#### 5.1 Approval System

Security-focused tool execution approval:

- **Configuration**: Per-server and per-tool approval settings
- **Request Management**: Pending approval request tracking
- **Auto-approval**: Learning from user approvals
- **Expiration**: Automatic cleanup of expired requests
- **Statistics**: Approval metrics and insights

#### 5.2 Approval Manager

Lifecycle management for MCP tool approvals:

```rust
pub struct McpApprovalManager {
    config: Arc<RwLock<McpApprovalConfig>>,
    pending_requests: Arc<RwLock<HashMap<String, ToolApprovalRequest>>>,
    responses: Arc<RwLock<HashMap<String, ToolApprovalResponse>>>,
}
```

## Key Features

### 1. Multi-Provider Support

Seamless switching between AI providers:

```rust
let config = AgentConfig::for_provider(AIProvider::OpenAI, "gpt-4");
let manager = AgentManager::new(config).await?;
```

### 2. Streaming Chat

Real-time response streaming:

```rust
let stream = agent.chat_stream(request).await?;
pin_mut!(stream);
while let Some(event) = stream.next().await {
    match event? {
        StreamEvent::Token { content, .. } => {
            // Handle token
        }
        StreamEvent::Complete { message, .. } => {
            // Handle completion
        }
        // ... other events
    }
}
```

### 3. Tool Execution

Safe and monitored tool execution:

```rust
let request = ToolExecutionRequest::new(
    "search_web".to_string(),
    json!({"query": "Rust programming"}),
    context
);
let result = tool_registry.execute_tool(request).await?;
```

### 4. Event-Driven Architecture

Comprehensive event system:

```rust
let event = AgentEvent::new(
    EventType::ToolCalled,
    "Web Search".to_string(),
    "Searching for: Rust programming".to_string(),
    EventSeverity::Info
);
emitter.emit(event).await?;
```

## Usage Patterns

### 1. Basic Chat

```rust
// Initialize system
init_agent_manager(config).await?;
let manager = get_agent_manager().unwrap();

// Create conversation
let conversation = Conversation::new(Some("Chat".to_string()));

// Send message
let request = ChatRequest::from_text("Hello, AI!", conversation);
let response = manager.agent().chat(request).await?;
```

### 2. Streaming with Tools

```rust
let request = ChatRequest::from_text("Search for Rust tutorials", conversation)
    .stream(true)
    .with_tools(vec!["search_web".to_string()]);

let stream = manager.agent().chat_stream(request).await?;
```

### 3. Tool Registration

```rust
let metadata = ToolMetadata::new(
    "my_tool".to_string(),
    "A custom tool".to_string()
);

let registration = ToolRegistration {
    metadata,
    handler: Arc::new(|params, context| {
        Box::pin(async move {
            // Tool implementation
            Ok(ToolExecutionResult::success("my_tool", result))
        })
    }),
};

manager.tools().register_tool(registration).await?;
```

## Performance Considerations

### 1. Caching Strategy

- **Provider Caching**: Automatic caching of AI clients and agents
- **Tool Metrics**: In-memory metrics with periodic persistence
- **Event History**: Circular buffer to prevent memory leaks

### 2. Concurrency

- **Async/Await**: Full async support throughout the system
- **Arc<RwLock>**: Thread-safe shared state management
- **Batch Operations**: Support for bulk tool execution

### 3. Memory Management

- **Lazy Initialization**: Components created on-demand
- **Cleanup Tasks**: Automatic cleanup of expired data
- **Configuration Limits**: Configurable buffer sizes and limits

## Security Features

### 1. MCP Approval System

- **Per-Tool Approval**: Granular control over tool execution
- **Auto-Approval Learning**: Learns from user preferences
- **Request Expiration**: Prevents stale approval requests
- **Configuration Persistence**: Secure storage of approval settings

### 2. Permission Management

- **Tool Permissions**: Safe, Restricted, Dangerous permission levels
- **Context Validation**: Validation of tool execution context
- **Error Handling**: Secure error handling without information leakage

## Error Handling

### 1. Error Types

```rust
pub enum AgentError {
    ConfigurationError(String),
    ProviderNotInitialized,
    ChatError(String),
    ToolError(String),
    EventError(String),
    EmbeddingError(String),
    ImageGenerationError(String),
    InitializationFailed(String),
    NotInitialized,
    UnsupportedProvider(String),
    Cancelled,
}
```

### 2. Error Recovery

- **Graceful Degradation**: System continues operating with degraded functionality
- **Retry Logic**: Automatic retry for transient failures
- **Fallback Providers**: Automatic provider switching on failures
- **User Notifications**: Clear error messages and recovery suggestions

## Testing

### 1. Unit Tests

- **Component Tests**: Individual component testing
- **Mock Implementations**: Test doubles for external dependencies
- **Property Testing**: Verification of system invariants

### 2. Integration Tests

- **End-to-End Flows**: Complete user journey testing
- **Provider Tests**: Real AI provider integration testing
- **Performance Tests**: Load and stress testing

### 3. Test Architecture

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_agent_chat() {
        // Test implementation
    }

    #[tokio::test]
    async fn test_tool_execution() {
        // Test implementation
    }
}
```

## Future Enhancements

### 1. Planned Features

- **Multi-Modal Support**: Enhanced image, audio, and video processing
- **Plugin System**: Dynamic loading of external plugins
- **Distributed Execution**: Support for distributed tool execution
- **Advanced Caching**: Redis-based distributed caching

### 2. Performance Improvements

- **Connection Pooling**: Optimized AI provider connection management
- **Batch Processing**: Efficient batch request handling
- **Memory Optimization**: Reduced memory footprint for large conversations

### 3. Security Enhancements

- **Encryption**: End-to-end encryption for sensitive data
- **Audit Logging**: Comprehensive audit trail for all operations
- **Access Control**: Role-based access control (RBAC)

## Migration Guide

See `MIGRATION_GUIDE.md` for detailed migration instructions from the legacy system.

## Contributing

When contributing to Rig Agent v2:

1. Follow the existing code patterns and naming conventions
2. Add comprehensive tests for new features
3. Update documentation for API changes
4. Ensure all error cases are handled gracefully
5. Performance test critical paths
6. Security review for new capabilities

This architecture provides a robust, scalable, and maintainable foundation for AI agent capabilities in the Tauri Solid Start application.