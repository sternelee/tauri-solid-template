use super::mcp_approval::*;
use crate::rig_agent::AgentError;
use serde::{Deserialize, Serialize};
use specta::Type;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use tokio::time::{interval, Duration};

/// MCP工具审批管理器
pub struct McpApprovalManager {
    /// 配置
    config: Arc<RwLock<McpApprovalConfig>>,
    /// 待审批的请求
    pending_requests: Arc<RwLock<HashMap<String, ToolApprovalRequest>>>,
    /// 审批响应
    responses: Arc<RwLock<HashMap<String, ToolApprovalResponse>>>,
    /// 配置文件路径
    config_path: std::path::PathBuf,
}

impl McpApprovalManager {
    /// 创建新的审批管理器
    pub async fn new(config_path: std::path::PathBuf) -> Result<Self, AgentError> {
        let config = McpApprovalConfig::load_from_file(&config_path)
            .await
            .map_err(|e| {
                AgentError::ConfigurationError(format!("Failed to load MCP config: {}", e))
            })?;

        let manager = Self {
            config: Arc::new(RwLock::new(config)),
            pending_requests: Arc::new(RwLock::new(HashMap::new())),
            responses: Arc::new(RwLock::new(HashMap::new())),
            config_path,
        };

        // 启动清理任务
        manager.start_cleanup_task().await;

        Ok(manager)
    }

    /// 检查工具是否需要审批
    pub async fn needs_approval(&self, server_name: &str, tool_name: &str) -> bool {
        let config = self.config.read().await;
        config.needs_approval(server_name, tool_name)
    }

    /// 创建审批请求
    pub async fn create_approval_request(
        &self,
        server_name: String,
        tool_name: String,
        parameters: serde_json::Value,
        user_message: String,
        conversation_id: String,
    ) -> Result<String, AgentError> {
        let request = ToolApprovalRequest::new(
            server_name,
            tool_name,
            parameters,
            user_message,
            conversation_id,
        );

        let request_id = request.request_id.clone();

        // 检查是否需要审批
        if !self
            .needs_approval(&request.server_name, &request.tool_name)
            .await
        {
            // 自动批准
            let response = request.auto_approved();
            let mut responses = self.responses.write().await;
            responses.insert(request_id.clone(), response);
            return Ok(request_id);
        }

        // 添加到待审批列表
        {
            let mut pending = self.pending_requests.write().await;
            pending.insert(request_id.clone(), request.clone());
        }

        log::info!(
            "Created approval request for tool {}.{}.{}",
            request.server_name,
            request.tool_name,
            request_id
        );
        Ok(request_id)
    }

    /// 获取待审批的请求列表
    pub async fn get_pending_requests(&self) -> Vec<ToolApprovalRequest> {
        let pending = self.pending_requests.read().await;
        pending.values().cloned().collect()
    }

    /// 批准工具请求
    pub async fn approve_request(
        &self,
        request_id: &str,
        user_feedback: Option<String>,
    ) -> Result<ToolApprovalResponse, AgentError> {
        let request = {
            let mut pending = self.pending_requests.write().await;
            pending.remove(request_id).ok_or_else(|| {
                AgentError::ToolError(format!("Approval request not found: {}", request_id))
            })?
        };

        // 检查请求是否已过期
        if request.is_expired() {
            return Err(AgentError::ToolError(
                "Approval request has expired".to_string(),
            ));
        }

        let response = request.approved(user_feedback);

        // 保存响应
        {
            let mut responses = self.responses.write().await;
            responses.insert(request_id.to_string(), response.clone());
        }

        log::info!("Approved tool request: {}", request_id);
        Ok(response)
    }

    /// 拒绝工具请求
    pub async fn reject_request(
        &self,
        request_id: &str,
        user_feedback: Option<String>,
    ) -> Result<ToolApprovalResponse, AgentError> {
        let request = {
            let mut pending = self.pending_requests.write().await;
            pending.remove(request_id).ok_or_else(|| {
                AgentError::ToolError(format!("Approval request not found: {}", request_id))
            })?
        };

        // 检查请求是否已过期
        if request.is_expired() {
            return Err(AgentError::ToolError(
                "Approval request has expired".to_string(),
            ));
        }

        let response = request.rejected(user_feedback);

        // 保存响应
        {
            let mut responses = self.responses.write().await;
            responses.insert(request_id.to_string(), response.clone());
        }

        log::info!("Rejected tool request: {}", request_id);
        Ok(response)
    }

    /// 获取审批状态
    pub async fn get_approval_status(&self, request_id: &str) -> Option<ApprovalStatus> {
        // 检查待审批列表
        {
            let pending = self.pending_requests.read().await;
            if pending.contains_key(request_id) {
                return Some(ApprovalStatus::Pending);
            }
        }

        // 检查响应列表
        {
            let responses = self.responses.read().await;
            responses.get(request_id).map(|r| r.status.clone())
        }
    }

    /// 获取审批配置
    pub async fn get_config(&self) -> McpApprovalConfig {
        self.config.read().await.clone()
    }

    /// 更新审批配置
    pub async fn update_config(&self, config: McpApprovalConfig) -> Result<(), AgentError> {
        // 保存到文件
        config.save_to_file(&self.config_path).await.map_err(|e| {
            AgentError::ConfigurationError(format!("Failed to save MCP config: {}", e))
        })?;

        // 更新内存中的配置
        *self.config.write().await = config;

        log::info!("Updated MCP approval configuration");
        Ok(())
    }

    /// 切换工具的自动批准状态
    pub async fn toggle_tool_auto_approve(
        &self,
        server_name: &str,
        tool_name: &str,
    ) -> Result<bool, AgentError> {
        let mut config = self.config.write().await;
        let result = config
            .toggle_tool_auto_approve(server_name, tool_name)
            .map_err(|e| AgentError::ToolError(e))?;

        // 保存配置
        let config_clone = config.clone();
        drop(config);
        self.update_config(config_clone).await?;

        Ok(result)
    }

    /// 获取工具的批准状态
    pub async fn get_tool_approval_status(
        &self,
        server_name: &str,
        tool_name: &str,
    ) -> ToolApprovalStatus {
        let config = self.config.read().await;
        let server_config = config.get_server_config(server_name);

        match server_config {
            Some(config) => {
                if config.disabled {
                    ToolApprovalStatus::Disabled
                } else if config.auto_approve.contains(&tool_name.to_string()) {
                    ToolApprovalStatus::AutoApproved
                } else {
                    ToolApprovalStatus::RequiresApproval
                }
            }
            None => ToolApprovalStatus::UnknownServer,
        }
    }

    /// 清理过期的请求
    pub async fn cleanup_expired_requests(&self) -> usize {
        let mut pending = self.pending_requests.write().await;
        let initial_count = pending.len();

        pending.retain(|_, request| !request.is_expired());

        let cleaned_count = initial_count - pending.len();
        if cleaned_count > 0 {
            log::info!("Cleaned up {} expired approval requests", cleaned_count);
        }

        cleaned_count
    }

    /// 获取统计信息
    pub async fn get_statistics(&self) -> ApprovalStatistics {
        let config = self.config.read().await;
        let pending = self.pending_requests.read().await;
        let responses = self.responses.read().await;

        let mut total_requests = pending.len() + responses.len();
        let mut approved_count = 0;
        let mut rejected_count = 0;
        let mut auto_approved_count = 0;

        for response in responses.values() {
            match response.status {
                ApprovalStatus::Approved => approved_count += 1,
                ApprovalStatus::Rejected => rejected_count += 1,
                ApprovalStatus::AutoApproved => auto_approved_count += 1,
                _ => {}
            }
        }

        let enabled_servers = config.mcp_servers.values().filter(|s| !s.disabled).count();

        let disabled_servers = config.mcp_servers.values().filter(|s| s.disabled).count();

        ApprovalStatistics {
            total_requests: total_requests as u64,
            pending_requests: pending.len() as u64,
            approved_requests: approved_count as u64,
            rejected_requests: rejected_count as u64,
            auto_approved_requests: auto_approved_count as u64,
            enabled_servers: enabled_servers as u64,
            disabled_servers: disabled_servers as u64,
        }
    }

    /// 启动清理任务
    async fn start_cleanup_task(&self) {
        let pending_requests = self.pending_requests.clone();

        tokio::spawn(async move {
            let mut interval = interval(Duration::from_secs(60)); // 每分钟检查一次

            loop {
                interval.tick().await;

                let mut pending = pending_requests.write().await;
                let initial_count = pending.len();

                pending.retain(|_, request| !request.is_expired());

                let cleaned_count = initial_count - pending.len();
                if cleaned_count > 0 {
                    log::debug!("Cleaned up {} expired approval requests", cleaned_count);
                }
            }
        });
    }

    /// 批量处理审批请求
    pub async fn process_approval_batch(
        &self,
        decisions: Vec<ApprovalDecision>,
    ) -> Vec<Result<ToolApprovalResponse, AgentError>> {
        let mut results = Vec::new();

        for decision in decisions {
            let result = match decision.action {
                ApprovalAction::Approve => {
                    self.approve_request(&decision.request_id, decision.feedback)
                        .await
                }
                ApprovalAction::Reject => {
                    self.reject_request(&decision.request_id, decision.feedback)
                        .await
                }
            };
            results.push(result);
        }

        results
    }

    /// 获取服务器配置摘要
    pub async fn get_server_summary(&self) -> Vec<ServerSummary> {
        let config = self.config.read().await;
        let mut summaries = Vec::new();

        for (server_name, server_config) in &config.mcp_servers {
            let auto_approve_count = server_config.auto_approve.len();
            let disabled = server_config.disabled;

            summaries.push(ServerSummary {
                name: server_name.clone(),
                auto_approve_count: auto_approve_count as u64,
                disabled,
                url: server_config.url.clone(),
                command: server_config.command.clone(),
            });
        }

        summaries
    }
}

/// 工具批准状态
#[derive(Serialize, Deserialize, Type, Clone, Debug)]
pub enum ToolApprovalStatus {
    /// 需要用户批准
    RequiresApproval,
    /// 自动批准
    AutoApproved,
    /// 服务器已禁用
    Disabled,
    /// 未知服务器
    UnknownServer,
}

/// 审批统计信息
#[derive(Serialize, Deserialize, Type, Clone, Debug)]
pub struct ApprovalStatistics {
    pub total_requests: u64,
    pub pending_requests: u64,
    pub approved_requests: u64,
    pub rejected_requests: u64,
    pub auto_approved_requests: u64,
    pub enabled_servers: u64,
    pub disabled_servers: u64,
}

/// 审批决策
#[derive(Serialize, Deserialize, Type, Clone, Debug)]
pub struct ApprovalDecision {
    pub request_id: String,
    pub action: ApprovalAction,
    pub feedback: Option<String>,
}

/// 审批动作
#[derive(Serialize, Deserialize, Type, Clone, Debug)]
pub enum ApprovalAction {
    Approve,
    Reject,
}

/// 服务器摘要
#[derive(Serialize, Deserialize, Type, Clone, Debug)]
pub struct ServerSummary {
    pub name: String,
    pub auto_approve_count: u64,
    pub disabled: bool,
    pub url: Option<String>,
    pub command: Option<String>,
}

/// 默认的审批管理器实例
use std::sync::OnceLock;
static APPROVAL_MANAGER: OnceLock<Arc<McpApprovalManager>> = OnceLock::new();

/// 初始化全局审批管理器
pub async fn init_approval_manager(config_path: std::path::PathBuf) -> Result<(), AgentError> {
    let manager = Arc::new(McpApprovalManager::new(config_path).await?);
    APPROVAL_MANAGER.set(manager).map_err(|_| {
        AgentError::InitializationFailed("Approval manager already initialized".to_string())
    })?;
    Ok(())
}

/// 获取全局审批管理器
pub fn get_approval_manager() -> Option<Arc<McpApprovalManager>> {
    APPROVAL_MANAGER.get().cloned()
}

/// 获取审批管理器或返回错误
pub fn require_approval_manager() -> Result<Arc<McpApprovalManager>, AgentError> {
    get_approval_manager().ok_or(AgentError::NotInitialized)
}

