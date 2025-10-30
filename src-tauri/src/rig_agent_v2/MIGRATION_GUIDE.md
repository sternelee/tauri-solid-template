# Rig Agent v2 迁移指南

## 概述

本文档描述了如何从旧的 Rig Agent 架构迁移到新的统一架构 v2。

## 主要改进

### 1. 统一的 Provider 管理
- **之前**: 分散的客户端和代理创建逻辑
- **现在**: 集中的 `ProviderManager` 使用 lazy_static 缓存
- **优势**: 自动配置管理、缓存优化、错误处理改进

### 2. 统一的 Agent 接口
- **之前**: 多个不同的 Agent 类型（LegacyAgent, EnhancedAgent, ReactAgentWrapper）
- **现在**: 单一的 `UnifiedAgent` 接口支持所有操作
- **优势**: 简化 API、减少代码重复、统一的错误处理

### 3. 改进的工具系统
- **之前**: 简单的工具实现，缺乏验证和权限控制
- **现在**: 完整的工具生态系统，包括:
  - 工具注册表 (`ToolRegistry`)
  - 工具管理器 (`ToolManager`)
  - 权限系统
  - 工具验证
  - 缓存支持
  - 指标收集

### 4. 统一的事件流处理
- **之前**: 分散的事件处理逻辑
- **现在**: 集中的 `EventEmitter` 支持订阅、过滤、统计
- **优势**: 更好的可观测性、调试支持、事件导出

### 5. 类型安全的配置管理
- **之前**: 松散的配置结构
- **现在**: 强类型的 `AgentConfig` 与验证
- **优势**: 编译时检查、自动验证、类型安全

## 迁移步骤

### 1. 更新导入

**之前:**
```rust
use crate::rig_agent::*;
use crate::rig_agent::agent::*;
use crate::rig_agent::providers::*;
```

**现在:**
```rust
use crate::rig_agent_v2::*;
use crate::rig_agent_v2::core::*;
use crate::rig_agent_v2::capabilities::*;
```

### 2. 初始化系统

**之前:**
```rust
let config = AgentConfig::default();
let client = create_client(&config)?;
let agent = create_agent(&client, &config)?;
```

**现在:**
```rust
let config = AgentConfig::default();
let ai_capability = create_ai_capability_with_config(config).await?;
// 或者使用全局管理器
init_agent_manager(config).await?;
```

### 3. 聊天操作

**之前:**
```rust
let legacy_agent = LegacyAgent::new(agent, config);
let response = legacy_agent.chat_with_context(message, &history).await?;
```

**现在:**
```rust
let response = ai_capability.chat(message, conversation).await?;
// 或者流式
let stream = ai_capability.chat_stream(message, conversation).await?;
```

### 4. 工具使用

**之前:**
```rust
let result = FileSystemTool::execute(&parameters).await?;
```

**现在:**
```rust
let context = ToolExecutionContext::new("session_id".to_string());
let request = ToolExecutionRequest::new("file_system".to_string(), parameters, context);
let result = ai_capability.execute_tool("file_system".to_string(), parameters, context).await?;
```

### 5. 事件处理

**之前:**
```rust
app.emit("chat_event", ChatEvent(stream_event)).unwrap();
```

**现在:**
```rust
let event = AgentEvent::new(EventType::ChatMessageReceived, title, description)
    .with_conversation_id(conversation_id);
ai_capability.agent_manager.events().emit(event).await?;
```

## 配置迁移

### Provider 配置

**之前:**
```rust
AgentConfig {
    provider: AIProvider::OpenAI,
    model: "gpt-4o-mini".to_string(),
    api_key: Some(key),
    // ... 其他字段
}
```

**现在:**
```rust
AgentConfig {
    provider: ProviderConfig {
        provider: AIProvider::OpenAI,
        model: "gpt-4o-mini".to_string(),
        api_key: Some(key),
        // ... 其他提供者配置
    },
    features: FeatureConfig {
        enable_streaming: Some(true),
        enable_tools: Some(true),
        // ... 其他功能配置
    },
    system: SystemConfig {
        system_prompt: Some(prompt),
        // ... 其他系统配置
    },
}
```

## 新功能使用指南

### 1. ReAct 模式

```rust
let response = ai_capability.chat_react(
    message,
    conversation,
    Some(Arc::new(tool_manager))
).await?;
```

### 2. 工具注册

```rust
let tool_registration = ToolRegistration::new(
    Arc::new(MyCustomTool::new()),
    tool_metadata
);

ai_capability.agent_manager.tools()
    .register_tool(tool_registration).await?;
```

### 3. 事件订阅

```rust
let subscription = EventSubscription::new()
    .for_event_types(vec![EventType::ChatCompleted, EventType::ToolCalled])
    .for_session_id("my_session".to_string())
    .with_min_severity(EventSeverity::Info);

let mut receiver = ai_capability.agent_manager.events()
    .subscribe(subscription).await;
```

### 4. 工具权限

```rust
let context = ToolExecutionContext::new("session_id".to_string())
    .with_permissions(vec![
        ToolPermission::Safe,
        ToolPermission::Restricted
    ]);
```

### 5. 事件导出

```rust
let json_export = ai_capability.agent_manager.events()
    .export_events(ExportFormat::Json).await?;
let csv_export = ai_capability.agent_manager.events()
    .export_events(ExportFormat::Csv).await?;
```

## 性能优化建议

### 1. 使用全局管理器

```rust
// 推荐：使用全局单例
init_agent_manager(config).await?;
let capability = AICapability::new(get_agent_manager().unwrap());

// 避免：重复创建管理器
let manager = AgentManager::new(config).await?; // 不要这样做
```

### 2. 启用缓存

```rust
let mut config = AgentConfig::default();
config.features.enable_embeddings = Some(true);
// 工具会自动使用缓存（如果实现了 CacheableTool）
```

### 3. 批量操作

```rust
let requests = vec![
    ToolExecutionRequest::new("tool1".to_string(), params1, context.clone()),
    ToolExecutionRequest::new("tool2".to_string(), params2, context.clone()),
];

let results = ai_capability.execute_tools_batch(requests).await?;
```

## 错误处理改进

新的架构提供了更细粒度的错误类型：

```rust
match ai_capability.chat(message, conversation).await {
    Ok(response) => println!("Success: {}", response.message.text_content().unwrap_or("")),
    Err(AgentError::ApiError(msg)) => println!("API Error: {}", msg),
    Err(AgentError::ToolError(msg)) => println!("Tool Error: {}", msg),
    Err(AgentError::RateLimitExceeded) => println!("Rate limit exceeded"),
    Err(e) => println!("Other error: {}", e),
}
```

## 向后兼容性

为了平滑迁移，可以创建兼容性层：

```rust
pub mod compat {
    use super::*;

    pub struct LegacyAgentCompat {
        capability: AICapability,
    }

    impl LegacyAgentCompat {
        pub async fn new(config: AgentConfig) -> Result<Self> {
            let capability = create_ai_capability_with_config(config).await?;
            Ok(Self { capability })
        }

        pub async fn chat_with_context(
            &self,
            message: &str,
            history: &[ChatMessage],
        ) -> Result<String, AgentError> {
            let conversation = Conversation::new(None);
            let response = self.capability.chat(message, conversation).await?;
            Ok(response.message.text_content().unwrap_or_default())
        }
    }
}
```

## 测试迁移

确保所有现有测试更新为使用新 API：

```rust
#[tokio::test]
async fn test_chat_functionality() -> Result<()> {
    let ai_capability = create_ai_capability().await?;
    let conversation = Conversation::new(None);

    let response = ai_capability.chat("Hello", conversation).await?;
    assert!(!response.message.content.is_empty());

    Ok(())
}
```

## 调试和监控

新架构提供了更好的调试支持：

```rust
// 启用事件日志
ai_capability.agent_manager.events()
    .add_handler(Arc::new(ConsoleEventHandler)).await;

// 查看系统信息
let info = ai_capability.get_provider_info().await?;
println!("Provider: {:?}", info);

// 获取工具指标
let metrics = ai_capability.agent_manager.tools()
    .get_all_metrics().await;
println!("Tool metrics: {:?}", metrics);
```

## 总结

新的 Rig Agent v2 架构提供了：

1. **统一的接口**: 所有 AI 操作通过单一的 `AICapability` 接口
2. **更好的类型安全**: 强类型配置和验证
3. **改进的性能**: 缓存、批量操作、异步优化
4. **增强的可观测性**: 事件系统、指标收集、统计
5. **灵活的工具系统**: 权限、验证、缓存、扩展性
6. **简化的错误处理**: 细粒度错误类型和统一处理

迁移过程应该逐步进行，确保每个组件都经过测试后再继续下一个。