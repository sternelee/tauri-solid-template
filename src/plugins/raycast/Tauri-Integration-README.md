# Raycast Plugin API Tauri 集成

这个文档描述了 Raycast 插件 API 系统与 Tauri 框架的集成实现。

## 概述

我们成功实现了一个完整的 Raycast 插件 API 兼容层，将其与 Tauri 的原生系统集成，允许现有的 Raycast 插件在我们的平台上运行。

## 已实现的 Tauri 适配

### 1. Clipboard API (剪贴板)
- **文件**: `src/plugins/raycast/api/clipboard.ts`
- **Tauri 集成**: 使用 `@tauri-apps/plugin-clipboard-manager`
- **功能**:
  - 读取/写入文本到系统剪贴板
  - 清空剪贴板
  - HTML 内容支持（需要自定义 Tauri 命令）
  - 完整的错误处理

### 2. Environment API (环境信息)
- **文件**: `src/plugins/raycast/api/environment.ts`
- **Tauri 集成**: 使用 `@tauri-apps/api/app` 和 `@tauri-apps/plugin-os`
- **功能**:
  - 动态系统信息获取
  - 应用程序版本检测
  - 平台特性检查
  - 开发模式检测

### 3. Cache API (缓存)
- **文件**: `src/plugins/raycast/api/cache.ts`
- **Tauri 集成**: 使用 `@tauri-apps/plugin-fs` 进行持久化
- **功能**:
  - 内存缓存管理
  - 文件系统持久化
  - LRU 淘汰策略
  - TTL (生存时间) 支持
  - 自动保存和清理

### 4. AI API (人工智能)
- **文件**: `src/plugins/raycast/api/ai.ts`
- **Tauri 集成**: 使用自定义 Tauri 命令桥接
- **功能**:
  - 流式 AI 响应
  - 多模型支持
  - 创造度控制
  - 中止和超时处理
  - 模拟回退机制

### 5. Tauri Bridge (桥接器)
- **文件**: `src/plugins/raycast/api/tauri-bridge.ts`
- **功能**:
  - 统一的 Tauri 命令接口
  - 系统信息获取
  - 应用程序管理
  - 通知系统
  - 文件系统操作
  - AI 服务桥接

## 核心特性

### Shadow DOM 隔离
- 每个 Raycast 插件在独立的 Shadow DOM 中运行
- 完全的 CSS 样式隔离
- 安全的 API 注入和访问控制

### 插件兼容性
- 现有 Raycast 插件可无需修改或少量修改即可运行
- 自动代码迁移和兼容性检查
- 向后兼容的 API 包装

### 类型安全
- 完整的 TypeScript 类型定义
- 编译时 API 使用验证
- 智能代码补全和错误检测

## 使用示例

### 基本插件使用

```typescript
import { List, ActionPanel, Action, showToast } from "@raycast/api";

export default function Command() {
  return (
    <List>
      <List.Item
        title="Hello World"
        subtitle="Tauri + Raycast Integration"
        actions={
          <ActionPanel>
            <Action
              title="Show Notification"
              onAction={() => showToast({ title: "Hello from Tauri!" })}
            />
            <Action
              title="Copy to Clipboard"
              onAction={() => Clipboard.copy("Hello from Tauri!")}
            />
          </ActionPanel>
        }
      />
    </List>
  );
}
```

### AI API 使用

```typescript
import { Detail, ActionPanel, Action, AI } from "@raycast/api";

export default async function Command() {
  const response = await AI.ask("What is Tauri?", {
    creativity: "medium",
    model: "OpenAI_GPT4o"
  });

  return (
    <Detail markdown={response} />
  );
}
```

### Cache API 使用

```typescript
import { Cache, ActionPanel, Action } from "@raycast/api";

const cache = new Cache({ namespace: "my-plugin" });

export default function Command() {
  const handleCache = async () => {
    await cache.set("key", "value");
    const value = cache.get("key");
    console.log(value); // "value"
  };

  return (
    <ActionPanel>
      <Action title="Test Cache" onAction={handleCache} />
    </ActionPanel>
  );
}
```

## 配置要求

### Tauri 插件依赖

需要在 `src-tauri/Cargo.toml` 中添加以下插件：

```toml
[dependencies]
tauri-plugin-opener = "2.0"
tauri-plugin-fs = "2.0"
tauri-plugin-clipboard-manager = "2.0"
tauri-plugin-notification = "2.0"
tauri-plugin-os = "2.0"
```

### 自定义 Tauri 命令

需要在 `src-tauri/src/main.rs` 中实现以下命令：

```rust
#[tauri::command]
async fn get_system_info() -> Result<SystemInfo, String> {
    // 系统信息获取实现
}

#[tauri::command]
async fn ai_ask(request: AIRequest) -> Result<AIResponse, String> {
    // AI 服务实现
}

#[tauri::command]
async fn get_running_applications() -> Result<Vec<ApplicationInfo>, String> {
    // 应用程序列表获取实现
}
```

## 架构优势

1. **安全隔离**: Shadow DOM 确保插件间完全隔离
2. **原生性能**: Tauri 提供原生系统访问性能
3. **跨平台**: 支持 Windows、macOS 和 Linux
4. **类型安全**: 完整的 TypeScript 支持
5. **向后兼容**: 现有 Raycast 插件可无缝迁移

## 下一步计划

1. **完整组件支持**: 实现所有 Raycast UI 组件
2. **更多 API**: 扩展对更多 Raycast API 的支持
3. **性能优化**: 进一步优化内存使用和响应速度
4. **插件市场**: 构建插件分享和分发机制

## 贡献指南

如需扩展或修改 Tauri 集成：

1. 新 API 实现在 `src/plugins/raycast/api/` 目录下
2. 使用 `RaycastTauriBridge` 统一接口
3. 确保完整的 TypeScript 类型定义
4. 添加适当的错误处理和回退机制
5. 更新此文档记录新功能