use serde::{Deserialize, Serialize};
use specta::Type;
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;

/// MCP工具审批配置
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct McpApprovalConfig {
    pub mcp_servers: HashMap<String, McpServerConfig>,
}

/// 单个MCP服务器配置
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct McpServerConfig {
    /// 自动批准的工具列表
    pub auto_approve: Vec<String>,
    /// 是否禁用该服务器
    pub disabled: bool,
    /// 服务器参数
    pub args: Option<Vec<String>>,
    /// 启动命令
    pub command: Option<String>,
    /// URL或连接字符串
    pub url: Option<String>,
    /// 超时时间（秒）
    #[specta(type = Option<i32>)] // Use Option<i32> for TypeScript compatibility
    pub timeout: Option<u64>,
}

/// 工具审批状态
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub enum ApprovalStatus {
    /// 等待用户批准
    Pending,
    /// 用户已批准
    Approved,
    /// 用户拒绝
    Rejected,
    /// 自动批准
    AutoApproved,
}

/// 工具审批请求
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct ToolApprovalRequest {
    /// 请求ID
    pub request_id: String,
    /// 服务器名称
    pub server_name: String,
    /// 工具名称
    pub tool_name: String,
    /// 工具参数
    pub parameters: serde_json::Value,
    /// 用户请求的消息
    pub user_message: String,
    /// 会话ID
    pub conversation_id: String,
    /// 创建时间
    pub created_at: String,
    /// 过期时间
    pub expires_at: String,
}

/// 工具审批响应
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct ToolApprovalResponse {
    /// 请求ID
    pub request_id: String,
    /// 审批状态
    pub status: ApprovalStatus,
    /// 用户反馈
    pub user_feedback: Option<String>,
    /// 响应时间
    pub responded_at: String,
}

impl McpApprovalConfig {
    /// 创建默认配置
    pub fn default() -> Self {
        let mut mcp_servers = HashMap::new();

        // 添加默认的mcp-hub配置
        mcp_servers.insert(
            "mcp-hub".to_string(),
            McpServerConfig {
                auto_approve: vec![
                    "fetch-fetch".to_string(),
                    "figma-get_figma_data".to_string(),
                    "figma-download_figma_images".to_string(),
                    "brave-search-brave_web_search".to_string(),
                    "brave-search-brave_local_search".to_string(),
                    "context7-resolve-library-id".to_string(),
                    "context7-get-library-docs".to_string(),
                ],
                disabled: false,
                args: None,
                command: None,
                url: Some("http://localhost:3300/sse".to_string()),
                timeout: Some(600),
            },
        );

        Self { mcp_servers }
    }

    /// 从配置文件加载
    pub async fn load_from_file(config_path: &PathBuf) -> Result<Self, Box<dyn std::error::Error>> {
        if !config_path.exists() {
            // 如果配置文件不存在，创建默认配置
            let default_config = Self::default();
            default_config.save_to_file(config_path).await?;
            return Ok(default_config);
        }

        let content = fs::read_to_string(config_path)?;
        let config: Self = serde_json::from_str(&content)?;
        Ok(config)
    }

    /// 保存到配置文件
    pub async fn save_to_file(
        &self,
        config_path: &PathBuf,
    ) -> Result<(), Box<dyn std::error::Error>> {
        if let Some(parent) = config_path.parent() {
            fs::create_dir_all(parent)?;
        }

        let content = serde_json::to_string_pretty(self)?;
        fs::write(config_path, content)?;
        Ok(())
    }

    /// 检查工具是否需要批准
    pub fn needs_approval(&self, server_name: &str, tool_name: &str) -> bool {
        if let Some(server_config) = self.mcp_servers.get(server_name) {
            if server_config.disabled {
                return false; // 禁用的服务器不需要批准
            }
            !server_config.auto_approve.contains(&tool_name.to_string())
        } else {
            true // 未知服务器默认需要批准
        }
    }

    /// 获取服务器的配置
    pub fn get_server_config(&self, server_name: &str) -> Option<&McpServerConfig> {
        self.mcp_servers.get(server_name)
    }

    /// 更新服务器配置
    pub fn update_server_config<F>(&mut self, server_name: &str, updater: F) -> bool
    where
        F: FnOnce(&mut McpServerConfig),
    {
        if let Some(config) = self.mcp_servers.get_mut(server_name) {
            updater(config);
            true
        } else {
            false
        }
    }

    /// 添加或更新服务器配置
    pub fn add_server_config(&mut self, server_name: String, config: McpServerConfig) {
        self.mcp_servers.insert(server_name, config);
    }

    /// 移除服务器配置
    pub fn remove_server_config(&mut self, server_name: &str) -> Option<McpServerConfig> {
        self.mcp_servers.remove(server_name)
    }

    /// 切换工具的自动批准状态
    pub fn toggle_tool_auto_approve(
        &mut self,
        server_name: &str,
        tool_name: &str,
    ) -> Result<bool, String> {
        if let Some(config) = self.mcp_servers.get_mut(server_name) {
            let tool_name = tool_name.to_string();
            if let Some(index) = config.auto_approve.iter().position(|t| t == &tool_name) {
                config.auto_approve.remove(index);
                Ok(false)
            } else {
                config.auto_approve.push(tool_name);
                Ok(true)
            }
        } else {
            Err(format!("Server '{}' not found", server_name))
        }
    }
}

impl ToolApprovalRequest {
    /// 创建新的审批请求
    pub fn new(
        server_name: String,
        tool_name: String,
        parameters: serde_json::Value,
        user_message: String,
        conversation_id: String,
    ) -> Self {
        let now = chrono::Utc::now().to_rfc3339();
        let expires_at = chrono::Utc::now()
            .checked_add_signed(chrono::Duration::minutes(5))
            .unwrap_or_else(|| chrono::Utc::now())
            .to_rfc3339();

        Self {
            request_id: uuid::Uuid::new_v4().to_string(),
            server_name,
            tool_name,
            parameters,
            user_message,
            conversation_id,
            created_at: now,
            expires_at,
        }
    }

    /// 检查请求是否已过期
    pub fn is_expired(&self) -> bool {
        let now = chrono::Utc::now().to_rfc3339();
        now > self.expires_at
    }

    /// 创建已批准的响应
    pub fn approved(&self, user_feedback: Option<String>) -> ToolApprovalResponse {
        ToolApprovalResponse {
            request_id: self.request_id.clone(),
            status: ApprovalStatus::Approved,
            user_feedback,
            responded_at: chrono::Utc::now().to_rfc3339(),
        }
    }

    /// 创建拒绝的响应
    pub fn rejected(&self, user_feedback: Option<String>) -> ToolApprovalResponse {
        ToolApprovalResponse {
            request_id: self.request_id.clone(),
            status: ApprovalStatus::Rejected,
            user_feedback,
            responded_at: chrono::Utc::now().to_rfc3339(),
        }
    }

    /// 创建自动批准的响应
    pub fn auto_approved(&self) -> ToolApprovalResponse {
        ToolApprovalResponse {
            request_id: self.request_id.clone(),
            status: ApprovalStatus::AutoApproved,
            user_feedback: None,
            responded_at: chrono::Utc::now().to_rfc3339(),
        }
    }
}

