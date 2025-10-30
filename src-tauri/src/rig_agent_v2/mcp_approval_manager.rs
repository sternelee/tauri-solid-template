use crate::rig_agent_v2::mcp_approval::*;
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;
use std::error::Error;
use tokio::sync::RwLock;
use tracing::info;

/// MCP工具审批管理器
pub struct McpApprovalManager {
    config: Arc<RwLock<McpApprovalConfig>>,
    config_path: PathBuf,
    pending_requests: Arc<RwLock<HashMap<String, ToolApprovalRequest>>>,
}

impl McpApprovalManager {
    /// 创建新的审批管理器
    pub async fn new(config_dir: &PathBuf) -> Result<Self, Box<dyn Error>> {
        let config_path = config_dir.join("mcp_approval_config.json");
        let config = McpApprovalConfig::load_from_file(&config_path).await?;

        Ok(Self {
            config: Arc::new(RwLock::new(config)),
            config_path,
            pending_requests: Arc::new(RwLock::new(HashMap::new())),
        })
    }

    /// 获取配置
    pub async fn get_config(&self) -> McpApprovalConfig {
        self.config.read().await.clone()
    }

    /// 保存配置
    pub async fn save_config(&self) -> Result<(), Box<dyn Error>> {
        let config = self.config.read().await.clone();
        config.save_to_file(&self.config_path).await
    }

    /// 更新配置
    pub async fn update_config<F>(&self, updater: F) -> Result<(), Box<dyn Error>>
    where
        F: FnOnce(&mut McpApprovalConfig),
    {
        let mut config = self.config.write().await;
        updater(&mut config);
        self.save_config().await
    }

    /// 检查工具是否需要批准
    pub async fn needs_approval(&self, server_name: &str, tool_name: &str) -> bool {
        let config = self.config.read().await;
        config.needs_approval(server_name, tool_name)
    }

    /// 创建工具审批请求
    pub async fn create_approval_request(
        &self,
        server_name: String,
        tool_name: String,
        parameters: serde_json::Value,
        user_message: String,
        conversation_id: String,
    ) -> Result<String, Box<dyn Error>> {
        let tool_name_for_log = tool_name.clone();
        let request = ToolApprovalRequest::new(
            server_name,
            tool_name,
            parameters,
            user_message,
            conversation_id,
        );

        let request_id = request.request_id.clone();

        // 添加到待处理队列
        {
            let mut pending = self.pending_requests.write().await;
            pending.insert(request_id.clone(), request);
        }

        info!("Created MCP tool approval request: {} for tool: {}", request_id, tool_name_for_log);
        Ok(request_id)
    }

    /// 获取待处理的审批请求
    pub async fn get_pending_request(&self, request_id: &str) -> Option<ToolApprovalRequest> {
        let pending = self.pending_requests.read().await;
        pending.get(request_id).cloned()
    }

    /// 获取所有待处理的审批请求
    pub async fn get_all_pending_requests(&self, conversation_id: Option<&str>) -> Vec<ToolApprovalRequest> {
        let pending = self.pending_requests.read().await;

        let mut requests: Vec<ToolApprovalRequest> = pending.values().cloned().collect();

        // 如果指定了会话ID，只返回该会话的请求
        if let Some(conv_id) = conversation_id {
            requests.retain(|req| req.conversation_id == conv_id);
        }

        // 过滤掉已过期的请求
        requests.retain(|req| !req.is_expired());

        requests
    }

    /// 处理审批响应
    pub async fn handle_approval_response(
        &self,
        request_id: &str,
        response: ToolApprovalResponse,
    ) -> Result<(), Box<dyn Error>> {
        // 移除待处理请求
        {
            let mut pending = self.pending_requests.write().await;
            pending.remove(request_id);
        }

        // 如果用户批准了某个工具，更新自动批准列表
        if matches!(response.status, ApprovalStatus::Approved) {
            if let Some(request) = self.get_pending_request(request_id).await {
                let tool_name = request.tool_name.clone();
                let server_name = request.server_name.clone();
                self.update_config(|config| {
                    if let Some(server_config) = config.mcp_servers.get_mut(&server_name) {
                        if !server_config.auto_approve.contains(&tool_name) {
                            server_config.auto_approve.push(tool_name.clone());
                            info!("Added tool '{}' to auto-approve list for server '{}'", tool_name, server_name);
                        }
                    }
                }).await?;
            }
        }

        info!("Handled MCP tool approval: {} -> {:?}", request_id, response.status);
        Ok(())
    }

    /// 清理过期的审批请求
    pub async fn cleanup_expired_requests(&self) -> usize {
        let mut pending = self.pending_requests.write().await;
        let mut expired_keys = Vec::new();

        for (key, request) in pending.iter() {
            if request.is_expired() {
                expired_keys.push(key.clone());
            }
        }

        let expired_count = expired_keys.len();
        for key in expired_keys {
            pending.remove(&key);
        }

        if expired_count > 0 {
            info!("Cleaned up {} expired MCP approval requests", expired_count);
        }

        expired_count
    }

    /// 获取工具批准状态
    pub async fn get_tool_approval_status(&self, server_name: &str, tool_name: &str) -> (bool, bool, bool) {
        let config = self.config.read().await;

        let disabled = config
            .get_server_config(server_name)
            .map(|c| c.disabled)
            .unwrap_or(false);

        let auto_approved = config
            .get_server_config(server_name)
            .map(|c| c.auto_approve.contains(&tool_name.to_string()))
            .unwrap_or(false);

        let needs_approval = !disabled && !auto_approved;

        (needs_approval, auto_approved, disabled)
    }

    /// 更新服务器配置
    pub async fn update_server_config<F>(&self, server_name: &str, updater: F) -> Result<bool, String>
    where
        F: FnOnce(&mut McpServerConfig),
    {
        let mut was_updated = false;
        self.update_config(|config| {
            was_updated = config.update_server_config(server_name, updater)
        }).await.map_err(|e| e.to_string())?;

        if was_updated {
            info!("Updated MCP server configuration: {}", server_name);
        }

        Ok(was_updated)
    }

    /// 切换工具的自动批准状态
    pub async fn toggle_tool_auto_approve(&self, server_name: &str, tool_name: &str) -> Result<bool, String> {
        let mut updated = false;
        self.update_config(|config| {
            match config.toggle_tool_auto_approve(server_name, tool_name) {
                Ok(result) => {
                    updated = result;
                }
                Err(_) => {
                    // Server not found, nothing to update
                }
            }
        }).await.map_err(|e| e.to_string())?;

        if updated {
            let status = "enabled";
            info!("Toggled auto-approve for tool '{}' on server '{}': {}", tool_name, server_name, status);
        }

        Ok(updated)
    }

    /// 启用/禁用服务器
    pub async fn toggle_server(&self, server_name: &str) -> Result<bool, String> {
        let mut updated = false;
        self.update_config(|config| {
            if config.update_server_config(server_name, |c| {
                c.disabled = !c.disabled;
            }) {
                updated = true;
            } else {
                // 如果服务器不存在，创建一个禁用的配置
                config.add_server_config(
                    server_name.to_string(),
                    McpServerConfig {
                        auto_approve: vec![],
                        disabled: true,
                        args: None,
                        command: None,
                        url: None,
                        timeout: Some(600),
                    },
                );
                updated = true;
            }
        }).await.map_err(|e| e.to_string())?;

        let current_config = self.config.read().await;
        let status = if updated {
            if let Some(config) = current_config.get_server_config(server_name) {
                if config.disabled { "disabled" } else { "enabled" }
            } else {
                "enabled"
            }
        } else {
            "unchanged"
        };

        info!("Toggled MCP server '{}': {}", server_name, status);
        Ok(updated)
    }
}