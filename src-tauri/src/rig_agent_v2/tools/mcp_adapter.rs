use crate::mcp::{state::McpState, models::ToolWithServer};
use crate::rig_agent_v2::mcp_approval_manager::McpApprovalManager;
use serde_json::Value;
use std::sync::Arc;

/// MCP工具适配器，用于将MCP工具集成到rig_agent_v2
pub struct McpToolAdapter {
    mcp_state: Arc<McpState>,
    approval_manager: Option<Arc<McpApprovalManager>>,
}

impl McpToolAdapter {
    pub fn new(mcp_state: Arc<McpState>) -> Self {
        Self {
            mcp_state,
            approval_manager: None,
        }
    }

    pub fn with_approval_manager(mcp_state: Arc<McpState>, approval_manager: Arc<McpApprovalManager>) -> Self {
        Self {
            mcp_state,
            approval_manager: Some(approval_manager),
        }
    }

    /// 获取所有可用的MCP工具
    pub async fn list_tools(&self) -> Vec<ToolWithServer> {
        if let Some(client_manager) = &self.mcp_state.client_manager {
            match client_manager.list_tools("").await {
                Ok(tools) => {
                    tools.into_iter().map(|tool| ToolWithServer {
                        name: tool.name,
                        description: tool.description,
                        input_schema: tool.input_schema.unwrap_or_else(|| {
                            serde_json::json!({
                                "type": "object",
                                "properties": {}
                            })
                        }),
                        server: "mcp".to_string(),
                    }).collect()
                }
                Err(_) => vec![]
            }
        } else {
            vec![]
        }
    }

    /// 执行MCP工具（带审批流程）
    pub async fn execute_tool(
        &self,
        tool_name: &str,
        arguments: Option<Value>,
        conversation_id: Option<String>,
        user_message: Option<String>,
    ) -> Result<Value, String> {
        if let Some(client_manager) = &self.mcp_state.client_manager {
            // 从工具名中解析服务器名和实际工具名
            let (server_name, actual_tool_name) = if tool_name.contains("::") {
                let parts: Vec<&str> = tool_name.splitn(2, "::").collect();
                (parts[0].to_string(), parts[1].to_string())
            } else {
                // 如果没有服务器名前缀，默认使用第一个可用服务器
                let server_names: Vec<String> = self.mcp_state.active_servers_list.lock().await
                    .keys()
                    .cloned()
                    .collect();

                if server_names.is_empty() {
                    return Err("No MCP servers available".to_string());
                }

                (server_names[0].clone(), tool_name.to_string())
            };

            // 检查服务器是否活跃
            let active_servers = self.mcp_state.active_servers_list.lock().await;
            if !active_servers.contains_key(&server_name) {
                return Err(format!("MCP server '{}' is not active", server_name));
            }
            drop(active_servers);

            // 检查是否需要审批
            if let Some(approval_manager) = &self.approval_manager {
                if approval_manager.needs_approval(&server_name, &actual_tool_name).await {
                    // 需要用户审批
                    let request_id = approval_manager.create_approval_request(
                        server_name.clone(),
                        actual_tool_name.clone(),
                        arguments.clone().unwrap_or(serde_json::json!({})),
                        user_message.unwrap_or_default(),
                        conversation_id.unwrap_or_default(),
                    ).await.map_err(|e| format!("Failed to create approval request: {}", e))?;

                    return Err(format!("APPROVAL_REQUIRED:{}", request_id));
                }
            }

            // 执行工具调用
            match client_manager.call_tool(&server_name, &actual_tool_name, arguments).await {
                Ok(result) => Ok(result),
                Err(e) => Err(format!("Failed to execute MCP tool '{}': {}", tool_name, e)),
            }
        } else {
            Err("MCP client manager not initialized".to_string())
        }
    }

    /// 执行已批准的MCP工具
    pub async fn execute_approved_tool(
        &self,
        tool_name: &str,
        arguments: Option<Value>,
    ) -> Result<Value, String> {
        if let Some(client_manager) = &self.mcp_state.client_manager {
            // 从工具名中解析服务器名和实际工具名
            let (server_name, actual_tool_name) = if tool_name.contains("::") {
                let parts: Vec<&str> = tool_name.splitn(2, "::").collect();
                (parts[0].to_string(), parts[1].to_string())
            } else {
                // 如果没有服务器名前缀，默认使用第一个可用服务器
                let server_names: Vec<String> = self.mcp_state.active_servers_list.lock().await
                    .keys()
                    .cloned()
                    .collect();

                if server_names.is_empty() {
                    return Err("No MCP servers available".to_string());
                }

                (server_names[0].clone(), tool_name.to_string())
            };

            // 执行工具调用（跳过审批检查）
            match client_manager.call_tool(&server_name, &actual_tool_name, arguments).await {
                Ok(result) => Ok(result),
                Err(e) => Err(format!("Failed to execute MCP tool '{}': {}", tool_name, e)),
            }
        } else {
            Err("MCP client manager not initialized".to_string())
        }
    }

    /// 获取活跃的MCP服务器列表
    pub async fn get_active_servers(&self) -> Vec<String> {
        self.mcp_state.active_servers_list.lock().await
            .keys()
            .cloned()
            .collect()
    }

    /// 检查特定服务器是否活跃
    pub async fn is_server_active(&self, server_name: &str) -> bool {
        self.mcp_state.active_servers_list.lock().await
            .contains_key(server_name)
    }
}

/// 同步的MCP工具执行器，用于rig_agent_v2
pub struct McpToolExecutor {
    mcp_state: Arc<McpState>,
    approval_manager: Option<Arc<McpApprovalManager>>,
    runtime: tokio::runtime::Handle,
}

impl McpToolExecutor {
    pub fn new(mcp_state: Arc<McpState>) -> Self {
        Self {
            mcp_state,
            approval_manager: None,
            runtime: tokio::runtime::Handle::current(),
        }
    }

    pub fn with_approval_manager(mcp_state: Arc<McpState>, approval_manager: Arc<McpApprovalManager>) -> Self {
        Self {
            mcp_state,
            approval_manager: Some(approval_manager),
            runtime: tokio::runtime::Handle::current(),
        }
    }

    /// 同步执行MCP工具
    pub fn execute_tool_sync(&self, tool_name: &str, arguments: Option<Value>) -> Result<Value, String> {
        let mcp_state = self.mcp_state.clone();
        let approval_manager = self.approval_manager.clone();
        let tool_name = tool_name.to_string();

        self.runtime.block_on(async move {
            let adapter = if let Some(approval_manager) = approval_manager {
                McpToolAdapter::with_approval_manager(mcp_state, approval_manager)
            } else {
                McpToolAdapter::new(mcp_state)
            };
            adapter.execute_tool(&tool_name, arguments, None, None).await
        })
    }

    /// 同步执行MCP工具（带上下文）
    pub fn execute_tool_with_context(
        &self,
        tool_name: &str,
        arguments: Option<Value>,
        conversation_id: Option<String>,
        user_message: Option<String>,
    ) -> Result<Value, String> {
        let mcp_state = self.mcp_state.clone();
        let approval_manager = self.approval_manager.clone();
        let tool_name = tool_name.to_string();

        self.runtime.block_on(async move {
            let adapter = if let Some(approval_manager) = approval_manager {
                McpToolAdapter::with_approval_manager(mcp_state, approval_manager)
            } else {
                McpToolAdapter::new(mcp_state)
            };
            adapter.execute_tool(&tool_name, arguments, conversation_id, user_message).await
        })
    }

    /// 同步列出MCP工具
    pub fn list_tools_sync(&self) -> Vec<ToolWithServer> {
        let mcp_state = self.mcp_state.clone();

        self.runtime.block_on(async move {
            let adapter = McpToolAdapter::new(mcp_state);
            adapter.list_tools().await
        })
    }

    /// 同步获取活跃服务器
    pub fn get_active_servers_sync(&self) -> Vec<String> {
        let mcp_state = self.mcp_state.clone();

        self.runtime.block_on(async move {
            let adapter = McpToolAdapter::new(mcp_state);
            adapter.get_active_servers().await
        })
    }
}

/// 同步的MCP工具执行函数
async fn execute_mcp_tool_sync(
    mcp_state: Arc<McpState>,
    tool_name: String,
    arguments: Option<Value>,
) -> Result<Value, String> {
    let adapter = McpToolAdapter::new(mcp_state);
    adapter.execute_tool(&tool_name, arguments, None, None).await
}

/// 同步的MCP工具列表函数
async fn list_mcp_tools_sync(mcp_state: Arc<McpState>) -> Result<Value, String> {
    let adapter = McpToolAdapter::new(mcp_state);
    let tools = adapter.list_tools().await;
    serde_json::to_value(tools)
        .map_err(|e| format!("Failed to serialize tools: {}", e))
}

/// 同步的MCP服务器列表函数
async fn list_mcp_servers_sync(mcp_state: Arc<McpState>) -> Result<Value, String> {
    let adapter = McpToolAdapter::new(mcp_state);
    let servers = adapter.get_active_servers().await;
    serde_json::to_value(servers)
        .map_err(|e| format!("Failed to serialize servers: {}", e))
}

/// MCP工具包装器，用于将异步调用转换为同步
pub struct McpToolWrapper {
    mcp_state: Arc<McpState>,
}

impl McpToolWrapper {
    pub fn new(mcp_state: Arc<McpState>) -> Self {
        Self { mcp_state }
    }

    pub fn execute_tool(&self, params: serde_json::Value) -> Result<serde_json::Value, String> {
        let tool_name = params.get("tool_name")
            .and_then(|v| v.as_str())
            .ok_or("Missing tool_name parameter")?
            .to_string();

        let arguments = params.get("arguments").cloned();
        let mcp_state = self.mcp_state.clone();

        // 使用tokio runtime block来执行异步操作
        let runtime = tokio::runtime::Handle::try_current()
            .or_else(|_| tokio::runtime::Runtime::new().map(|rt| rt.handle().clone()))
            .map_err(|e| format!("Failed to get tokio runtime: {}", e))?;

        runtime.block_on(execute_mcp_tool_sync(mcp_state, tool_name, arguments))
    }

    pub fn list_tools(&self, _params: serde_json::Value) -> Result<serde_json::Value, String> {
        let mcp_state = self.mcp_state.clone();

        let runtime = tokio::runtime::Handle::try_current()
            .or_else(|_| tokio::runtime::Runtime::new().map(|rt| rt.handle().clone()))
            .map_err(|e| format!("Failed to get tokio runtime: {}", e))?;

        runtime.block_on(list_mcp_tools_sync(mcp_state))
    }

    pub fn list_servers(&self, _params: serde_json::Value) -> Result<serde_json::Value, String> {
        let mcp_state = self.mcp_state.clone();

        let runtime = tokio::runtime::Handle::try_current()
            .or_else(|_| tokio::runtime::Runtime::new().map(|rt| rt.handle().clone()))
            .map_err(|e| format!("Failed to get tokio runtime: {}", e))?;

        runtime.block_on(list_mcp_servers_sync(mcp_state))
    }
}

/// MCP工具函数类型
type ToolFunction = Box<dyn Fn(serde_json::Value) -> Result<serde_json::Value, String> + Send + Sync>;

/// 为rig_agent_v2的ToolManager提供的MCP工具函数
pub fn create_mcp_tool_functions(
    mcp_state: Arc<McpState>,
) -> std::collections::HashMap<String, ToolFunction> {
    let mut tools = std::collections::HashMap::new();

    // 创建MCP工具执行器
    let execute_tool_fn: ToolFunction = Box::new({
        let mcp_state = mcp_state.clone();
        move |params: serde_json::Value| {
            let tool_name = params.get("tool_name")
                .and_then(|v| v.as_str())
                .ok_or("Missing tool_name parameter")?
                .to_string();

            let arguments = params.get("arguments").cloned();
            let mcp_state = mcp_state.clone();

            // 使用tokio runtime block来执行异步操作
            let runtime = tokio::runtime::Handle::try_current()
                .or_else(|_| tokio::runtime::Runtime::new().map(|rt| rt.handle().clone()))
                .map_err(|e| format!("Failed to get tokio runtime: {}", e))?;

            runtime.block_on(execute_mcp_tool_sync(mcp_state, tool_name, arguments))
        }
    });

    // 创建MCP工具列表函数
    let list_tools_fn: ToolFunction = Box::new({
        let mcp_state = mcp_state.clone();
        move |_params: serde_json::Value| {
            let mcp_state = mcp_state.clone();

            let runtime = tokio::runtime::Handle::try_current()
                .or_else(|_| tokio::runtime::Runtime::new().map(|rt| rt.handle().clone()))
                .map_err(|e| format!("Failed to get tokio runtime: {}", e))?;

            runtime.block_on(list_mcp_tools_sync(mcp_state))
        }
    });

    // 创建MCP服务器列表函数
    let list_servers_fn: ToolFunction = Box::new({
        let mcp_state = mcp_state.clone();
        move |_params: serde_json::Value| {
            let mcp_state = mcp_state.clone();

            let runtime = tokio::runtime::Handle::try_current()
                .or_else(|_| tokio::runtime::Runtime::new().map(|rt| rt.handle().clone()))
                .map_err(|e| format!("Failed to get tokio runtime: {}", e))?;

            runtime.block_on(list_mcp_servers_sync(mcp_state))
        }
    });

    // 注册工具函数
    tools.insert("mcp_execute_tool".to_string(), execute_tool_fn);
    tools.insert("mcp_list_tools".to_string(), list_tools_fn);
    tools.insert("mcp_list_servers".to_string(), list_servers_fn);

    // 在运行时动态注册MCP工具（这里先注册基础函数，具体工具会在运行时发现）
    tools
}

/// 刷新MCP工具注册（用于运行时动态添加新的MCP工具）
pub async fn refresh_mcp_tools(
    _tool_manager: &crate::rig_agent_v2::core::types::ToolManager,
    mcp_state: Arc<McpState>,
) -> Result<(), String> {
    // 检查MCP服务器状态
    let adapter = McpToolAdapter::new(mcp_state.clone());

    // 获取当前可用的MCP工具
    let mcp_tools = adapter.list_tools().await;
    let active_servers = adapter.get_active_servers().await;

    log::info!(
        "MCP tools refresh: found {} tools from {} active servers",
        mcp_tools.len(),
        active_servers.len()
    );

    // 由于ToolManager需要可变引用来注册新工具，这里我们只能检查状态
    // 实际的工具注册需要在AgentManager层级进行
    for tool in &mcp_tools {
        log::debug!("Available MCP tool: {} from server: {}", tool.name, tool.server);
    }

    // 返回成功状态
    Ok(())
}

/// 为AgentManager提供的MCP工具刷新接口
/// 这个函数应该在AgentManager中调用，以便能够注册新的工具
pub async fn refresh_and_register_mcp_tools(
    tool_manager: &mut crate::rig_agent_v2::core::types::ToolManager,
    mcp_state: Arc<McpState>,
) -> Result<usize, String> {
    let adapter = McpToolAdapter::new(mcp_state.clone());

    // 获取当前可用的MCP工具
    let mcp_tools = adapter.list_tools().await;
    let active_servers = adapter.get_active_servers().await;

    log::info!(
        "Registering MCP tools: found {} tools from {} active servers",
        mcp_tools.len(),
        active_servers.len()
    );

    let mut registered_count = 0;

    // 注册每个MCP工具到ToolManager
    for tool in mcp_tools {
        let tool_name = format!("mcp::{}", tool.name);
        let mcp_state = mcp_state.clone();

        // 创建工具处理器
        let handler = {
            let tool_name_original = tool.name.clone();
            let mcp_state = mcp_state.clone();

            move |params: serde_json::Value| -> Result<serde_json::Value, String> {
                let tool_name = params.get("tool_name")
                    .and_then(|v| v.as_str())
                    .ok_or("Missing tool_name parameter")?
                    .to_string();

                let arguments = params.get("arguments").cloned();

                // 使用tokio runtime来执行异步操作
                let runtime = tokio::runtime::Handle::try_current()
                    .or_else(|_| tokio::runtime::Runtime::new().map(|rt| rt.handle().clone()))
                    .map_err(|e| format!("Failed to get tokio runtime: {}", e))?;

                let mcp_state = mcp_state.clone();
                runtime.block_on(async move {
                    let adapter = McpToolAdapter::new(mcp_state);
                    adapter.execute_tool(&tool_name, arguments, None, None).await
                })
            }
        };

        // 注册工具
        tool_manager.register_tool(tool_name, handler);
        registered_count += 1;

        log::debug!("Registered MCP tool: {} with handler", tool.name);
    }

    log::info!("Successfully registered {} MCP tools", registered_count);
    Ok(registered_count)
}