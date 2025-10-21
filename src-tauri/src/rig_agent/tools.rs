use super::*;
use serde_json::{json, Value};
use async_trait::async_trait;
use std::path::Path;
use sysinfo::System;
use dirs_next;

// Tool trait for dynamic tool execution
#[async_trait]
pub trait Tool: Send + Sync {
    async fn execute(&self, parameters: &Value) -> Result<Value, AgentError>;
    fn name(&self) -> &str;
    fn description(&self) -> &str;
    fn parameters_schema(&self) -> Value;
}

// Simplified tool definitions for frontend
#[derive(Serialize, Deserialize, Type, Debug, Clone)]
pub struct ToolDefinition {
    pub name: String,
    pub description: String,
    pub parameters: Value,
    pub enabled: Option<bool>,
}

// File System Tool Implementation
pub struct FileSystemTool;

#[async_trait]
impl Tool for FileSystemTool {
    async fn execute(&self, parameters: &Value) -> Result<Value, AgentError> {
        let operation = parameters
            .get("operation")
            .and_then(|v| v.as_str())
            .ok_or_else(|| AgentError::Custom("Missing operation parameter".to_string()))?;

        let path = parameters
            .get("path")
            .and_then(|v| v.as_str())
            .ok_or_else(|| AgentError::Custom("Missing path parameter".to_string()))?;

        match operation {
            "read" => self.read_file(path).await,
            "write" => {
                let content = parameters
                    .get("content")
                    .and_then(|v| v.as_str())
                    .ok_or_else(|| AgentError::Custom("Missing content parameter".to_string()))?;
                self.write_file(path, content).await
            }
            "list" => self.list_directory(path).await,
            "exists" => self.file_exists(path).await,
            "delete" => self.delete_file(path).await,
            "create_dir" => self.create_directory(path).await,
            _ => Err(AgentError::Custom(format!("Unknown operation: {}", operation))),
        }
    }

    fn name(&self) -> &str {
        "file_system"
    }

    fn description(&self) -> &str {
        "Perform file system operations like read, write, list directories"
    }

    fn parameters_schema(&self) -> Value {
        json!({
            "type": "object",
            "properties": {
                "operation": {
                    "type": "string",
                    "enum": ["read", "write", "list", "exists", "delete", "create_dir"],
                    "description": "The file system operation to perform"
                },
                "path": {
                    "type": "string",
                    "description": "The file or directory path"
                },
                "content": {
                    "type": "string",
                    "description": "Content to write (for write operation)"
                }
            },
            "required": ["operation", "path"]
        })
    }
}

impl FileSystemTool {
    pub async fn execute(parameters: &Value) -> Result<Value, AgentError> {
        let tool = FileSystemTool;
        tool.execute(parameters).await
    }

    async fn read_file(&self, path: &str) -> Result<Value, AgentError> {
        let content = tokio::fs::read_to_string(path)
            .await
            .map_err(|e| AgentError::Custom(format!("Failed to read file: {}", e)))?;

        Ok(json!({
            "success": true,
            "content": content,
            "path": path
        }))
    }

    async fn write_file(&self, path: &str, content: &str) -> Result<Value, AgentError> {
        tokio::fs::write(path, content)
            .await
            .map_err(|e| AgentError::Custom(format!("Failed to write file: {}", e)))?;

        Ok(json!({
            "success": true,
            "message": "File written successfully",
            "path": path,
            "bytes_written": content.len()
        }))
    }

    async fn list_directory(&self, path: &str) -> Result<Value, AgentError> {
        let mut entries = Vec::new();
        let path_obj = Path::new(path);

        if !path_obj.exists() {
            return Err(AgentError::Custom(format!("Directory does not exist: {}", path)));
        }

        let mut dir_entries = tokio::fs::read_dir(path)
            .await
            .map_err(|e| AgentError::Custom(format!("Failed to read directory: {}", e)))?;

        while let Some(entry) = dir_entries.next_entry().await.map_err(|e| {
            AgentError::Custom(format!("Failed to read directory entry: {}", e))
        })? {
            let metadata = entry.metadata().await.map_err(|e| {
                AgentError::Custom(format!("Failed to read metadata: {}", e))
            })?;

            let entry_info = json!({
                "name": entry.file_name().to_string_lossy(),
                "path": entry.path().to_string_lossy(),
                "is_file": metadata.is_file(),
                "is_dir": metadata.is_dir(),
                "size": metadata.len(),
                "modified": metadata.modified().ok().map(|t| t.duration_since(std::time::UNIX_EPOCH).ok().map(|d| d.as_secs())),
            });

            entries.push(entry_info);
        }

        Ok(json!({
            "success": true,
            "entries": entries,
            "path": path
        }))
    }

    async fn file_exists(&self, path: &str) -> Result<Value, AgentError> {
        let exists = tokio::fs::metadata(path).await.is_ok();

        Ok(json!({
            "success": true,
            "exists": exists,
            "path": path
        }))
    }

    async fn delete_file(&self, path: &str) -> Result<Value, AgentError> {
        let path_obj = Path::new(path);

        let result = if path_obj.is_dir() {
            tokio::fs::remove_dir_all(path).await
        } else {
            tokio::fs::remove_file(path).await
        };

        result.map_err(|e| AgentError::Custom(format!("Failed to delete: {}", e)))?;

        Ok(json!({
            "success": true,
            "message": "Deleted successfully",
            "path": path
        }))
    }

    async fn create_directory(&self, path: &str) -> Result<Value, AgentError> {
        tokio::fs::create_dir_all(path)
            .await
            .map_err(|e| AgentError::Custom(format!("Failed to create directory: {}", e)))?;

        Ok(json!({
            "success": true,
            "message": "Directory created successfully",
            "path": path
        }))
    }
}

// System Info Tool Implementation
pub struct SystemInfoTool;

#[async_trait]
impl Tool for SystemInfoTool {
    async fn execute(&self, parameters: &Value) -> Result<Value, AgentError> {
        let info_type = parameters
            .get("info_type")
            .and_then(|v| v.as_str())
            .ok_or_else(|| AgentError::Custom("Missing info_type parameter".to_string()))?;

        match info_type {
            "basic" => self.get_basic_info().await,
            "memory" => self.get_memory_info().await,
            "disk" => self.get_disk_info().await,
            "network" => self.get_network_info().await,
            "processes" => self.get_process_info().await,
            _ => Err(AgentError::Custom(format!("Unknown info_type: {}", info_type))),
        }
    }

    fn name(&self) -> &str {
        "system_info"
    }

    fn description(&self) -> &str {
        "Get system information like OS, architecture, memory usage"
    }

    fn parameters_schema(&self) -> Value {
        json!({
            "type": "object",
            "properties": {
                "info_type": {
                    "type": "string",
                    "enum": ["basic", "memory", "disk", "network", "processes"],
                    "description": "Type of system information to retrieve"
                }
            },
            "required": ["info_type"]
        })
    }
}

impl SystemInfoTool {
    pub async fn execute(parameters: &Value) -> Result<Value, AgentError> {
        let tool = SystemInfoTool;
        tool.execute(parameters).await
    }

    async fn get_basic_info(&self) -> Result<Value, AgentError> {
        Ok(json!({
            "success": true,
            "info": {
                "os": std::env::consts::OS,
                "family": std::env::consts::FAMILY,
                "arch": std::env::consts::ARCH,
                "hostname": hostname::get().unwrap_or_else(|_| "unknown".into()).to_string_lossy(),
                "current_dir": std::env::current_dir().unwrap_or_else(|_| "unknown".into()).to_string_lossy(),
                "home_dir": dirs_next::home_dir().unwrap_or_else(|| Path::new("/").to_path_buf()).to_string_lossy(),
            }
        }))
    }

    async fn get_memory_info(&self) -> Result<Value, AgentError> {
        let mut sys = System::new_all();
        sys.refresh_all();

        let total_memory = sys.total_memory();
        let used_memory = sys.used_memory();
        let available_memory = sys.available_memory();

        Ok(json!({
            "success": true,
            "info": {
                "total_memory": total_memory,
                "used_memory": used_memory,
                "available_memory": available_memory,
                "memory_usage_percent": (used_memory as f64 / total_memory as f64) * 100.0,
            }
        }))
    }

    async fn get_disk_info(&self) -> Result<Value, AgentError> {
        // Simplified disk info - TODO: fix sysinfo integration
        Ok(json!({
            "success": true,
            "info": {
                "message": "Disk information temporarily disabled due to sysinfo compatibility issues"
            }
        }))
    }

    async fn get_network_info(&self) -> Result<Value, AgentError> {
        // Simplified network info - TODO: fix sysinfo integration
        Ok(json!({
            "success": true,
            "info": {
                "message": "Network information temporarily disabled due to sysinfo compatibility issues"
            }
        }))
    }

    async fn get_process_info(&self) -> Result<Value, AgentError> {
        // Simplified process info - TODO: fix sysinfo integration
        Ok(json!({
            "success": true,
            "info": {
                "message": "Process information temporarily disabled due to sysinfo compatibility issues"
            }
        }))
    }
}

// Tool manager with actual implementations
pub struct ToolManager;

impl ToolManager {
    pub fn get_available_tools() -> Vec<ToolDefinition> {
        vec![
            ToolDefinition {
                name: "file_system".to_string(),
                description: "Perform file system operations like read, write, list directories".to_string(),
                parameters: FileSystemTool.parameters_schema(),
                enabled: Some(true),
            },
            ToolDefinition {
                name: "system_info".to_string(),
                description: "Get system information like OS, architecture, memory usage".to_string(),
                parameters: SystemInfoTool.parameters_schema(),
                enabled: Some(true),
            },
        ]
    }

    pub fn get_tool_instance(name: &str) -> Result<Box<dyn Tool>, AgentError> {
        match name {
            "file_system" => Ok(Box::new(FileSystemTool)),
            "system_info" => Ok(Box::new(SystemInfoTool)),
            _ => Err(AgentError::Custom(format!("Unknown tool: {}", name))),
        }
    }
}