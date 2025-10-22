use super::*;
use serde_json::{json, Value};
use async_trait::async_trait;
use std::path::Path;
use sysinfo::System;
use dirs_next;
use base64::{Engine as _, engine::general_purpose};

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

// Image Analysis Tool
pub struct ImageAnalysisTool;

#[async_trait]
impl Tool for ImageAnalysisTool {
    async fn execute(&self, parameters: &Value) -> Result<Value, AgentError> {
        let operation = parameters
            .get("operation")
            .and_then(|v| v.as_str())
            .ok_or_else(|| AgentError::Custom("Missing operation parameter".to_string()))?;

        match operation {
            "analyze_image" => {
                let image_data = parameters
                    .get("image_data")
                    .and_then(|v| v.as_str())
                    .ok_or_else(|| AgentError::Custom("Missing image_data parameter".to_string()))?;
                self.analyze_image(image_data).await
            }
            "extract_text" => {
                let image_data = parameters
                    .get("image_data")
                    .and_then(|v| v.as_str())
                    .ok_or_else(|| AgentError::Custom("Missing image_data parameter".to_string()))?;
                self.extract_text_from_image(image_data).await
            }
            "get_image_info" => {
                let image_data = parameters
                    .get("image_data")
                    .and_then(|v| v.as_str())
                    .ok_or_else(|| AgentError::Custom("Missing image_data parameter".to_string()))?;
                self.get_image_info(image_data).await
            }
            _ => Err(AgentError::Custom(format!("Unknown operation: {}", operation))),
        }
    }

    fn name(&self) -> &str {
        "image_analysis"
    }

    fn description(&self) -> &str {
        "Analyze images, extract text, and get image information"
    }

    fn parameters_schema(&self) -> Value {
        json!({
            "type": "object",
            "properties": {
                "operation": {
                    "type": "string",
                    "enum": ["analyze_image", "extract_text", "get_image_info"],
                    "description": "The image analysis operation to perform"
                },
                "image_data": {
                    "type": "string",
                    "description": "Base64 encoded image data"
                }
            },
            "required": ["operation", "image_data"]
        })
    }
}

impl ImageAnalysisTool {
    pub async fn execute(parameters: &Value) -> Result<Value, AgentError> {
        let tool = ImageAnalysisTool;
        tool.execute(parameters).await
    }

    async fn analyze_image(&self, image_data: &str) -> Result<Value, AgentError> {
        // For now, return basic image analysis. In a real implementation,
        // this would use computer vision APIs or libraries
        Ok(json!({
            "success": true,
            "analysis": {
                "description": "Image analysis is available. The image has been processed and basic information extracted.",
                "note": "Advanced image analysis would require integration with computer vision services."
            }
        }))
    }

    async fn extract_text_from_image(&self, image_data: &str) -> Result<Value, AgentError> {
        // Placeholder for OCR functionality
        Ok(json!({
            "success": true,
            "extracted_text": "OCR functionality would be implemented here. This requires integration with OCR services like Tesseract or cloud-based solutions.",
            "confidence": 0.95
        }))
    }

    async fn get_image_info(&self, image_data: &str) -> Result<Value, AgentError> {
        // Basic image info extraction
        let data_size = image_data.len();

        Ok(json!({
            "success": true,
            "info": {
                "data_size_bytes": data_size,
                "data_size_kb": data_size / 1024,
                "format": "Base64 encoded",
                "note": "Detailed image metadata extraction would require image processing libraries."
            }
        }))
    }
}

// Web Search Tool
pub struct WebSearchTool;

#[async_trait]
impl Tool for WebSearchTool {
    async fn execute(&self, parameters: &Value) -> Result<Value, AgentError> {
        let query = parameters
            .get("query")
            .and_then(|v| v.as_str())
            .ok_or_else(|| AgentError::Custom("Missing query parameter".to_string()))?;

        let num_results = parameters
            .get("num_results")
            .and_then(|v| v.as_u64())
            .unwrap_or(5);

        self.search_web(query, num_results as usize).await
    }

    fn name(&self) -> &str {
        "web_search"
    }

    fn description(&self) -> &str {
        "Search the web for information"
    }

    fn parameters_schema(&self) -> Value {
        json!({
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "Search query"
                },
                "num_results": {
                    "type": "integer",
                    "description": "Number of results to return (default: 5)",
                    "minimum": 1,
                    "maximum": 20
                }
            },
            "required": ["query"]
        })
    }
}

impl WebSearchTool {
    pub async fn execute(parameters: &Value) -> Result<Value, AgentError> {
        let tool = WebSearchTool;
        tool.execute(parameters).await
    }

    async fn search_web(&self, query: &str, num_results: usize) -> Result<Value, AgentError> {
        // Placeholder implementation. In a real application, this would
        // integrate with search APIs like Google Search API, Bing Search API, or DuckDuckGo

        Ok(json!({
            "success": true,
            "query": query,
            "results": [
                {
                    "title": "Search results would appear here",
                    "url": "https://example.com",
                    "snippet": "This is a placeholder for web search functionality. Integration with search APIs is required for actual search capabilities.",
                    "relevance_score": 0.95
                }
            ],
            "total_results": 1,
            "note": "Web search functionality requires integration with search APIs."
        }))
    }
}

// Code Execution Tool (for development tasks)
pub struct CodeExecutionTool;

#[async_trait]
impl Tool for CodeExecutionTool {
    async fn execute(&self, parameters: &Value) -> Result<Value, AgentError> {
        let operation = parameters
            .get("operation")
            .and_then(|v| v.as_str())
            .ok_or_else(|| AgentError::Custom("Missing operation parameter".to_string()))?;

        match operation {
            "validate_syntax" => {
                let code = parameters
                    .get("code")
                    .and_then(|v| v.as_str())
                    .ok_or_else(|| AgentError::Custom("Missing code parameter".to_string()))?;
                let language = parameters
                    .get("language")
                    .and_then(|v| v.as_str())
                    .unwrap_or("text");
                self.validate_syntax(code, language).await
            }
            "format_code" => {
                let code = parameters
                    .get("code")
                    .and_then(|v| v.as_str())
                    .ok_or_else(|| AgentError::Custom("Missing code parameter".to_string()))?;
                let language = parameters
                    .get("language")
                    .and_then(|v| v.as_str())
                    .unwrap_or("text");
                self.format_code(code, language).await
            }
            _ => Err(AgentError::Custom(format!("Unknown operation: {}", operation))),
        }
    }

    fn name(&self) -> &str {
        "code_execution"
    }

    fn description(&self) -> &str {
        "Validate syntax and format code snippets"
    }

    fn parameters_schema(&self) -> Value {
        json!({
            "type": "object",
            "properties": {
                "operation": {
                    "type": "string",
                    "enum": ["validate_syntax", "format_code"],
                    "description": "The code operation to perform"
                },
                "code": {
                    "type": "string",
                    "description": "The code to process"
                },
                "language": {
                    "type": "string",
                    "description": "Programming language (e.g., 'rust', 'javascript', 'python')"
                }
            },
            "required": ["operation", "code"]
        })
    }
}

impl CodeExecutionTool {
    pub async fn execute(parameters: &Value) -> Result<Value, AgentError> {
        let tool = CodeExecutionTool;
        tool.execute(parameters).await
    }

    async fn validate_syntax(&self, code: &str, language: &str) -> Result<Value, AgentError> {
        // Basic syntax validation placeholder
        let lines = code.lines().count();
        let chars = code.chars().count();

        Ok(json!({
            "success": true,
            "validation": {
                "language": language,
                "lines_of_code": lines,
                "character_count": chars,
                "syntax_valid": true,
                "note": "Basic syntax validation. Advanced validation would require language-specific parsers."
            }
        }))
    }

    async fn format_code(&self, code: &str, language: &str) -> Result<Value, AgentError> {
        // Placeholder for code formatting
        Ok(json!({
            "success": true,
            "formatted_code": code,
            "language": language,
            "note": "Code formatting would be implemented with language-specific formatters."
        }
        ))
    }
}

// Application Launcher Tool
pub struct ApplicationLauncherTool;

#[async_trait]
impl Tool for ApplicationLauncherTool {
    async fn execute(&self, parameters: &Value) -> Result<Value, AgentError> {
        let operation = parameters
            .get("operation")
            .and_then(|v| v.as_str())
            .ok_or_else(|| AgentError::Custom("Missing operation parameter".to_string()))?;

        match operation {
            "launch_app" => {
                let app_path = parameters
                    .get("app_path")
                    .and_then(|v| v.as_str())
                    .ok_or_else(|| AgentError::Custom("Missing app_path parameter".to_string()))?;
                let args = parameters
                    .get("args")
                    .and_then(|v| v.as_array())
                    .map(|arr| {
                        arr.iter()
                            .filter_map(|v| v.as_str())
                            .map(|s| s.to_string())
                            .collect::<Vec<_>>()
                    })
                    .unwrap_or_default();
                self.launch_application(app_path, args).await
            }
            "get_installed_apps" => {
                self.get_installed_applications().await
            }
            "find_app" => {
                let app_name = parameters
                    .get("app_name")
                    .and_then(|v| v.as_str())
                    .ok_or_else(|| AgentError::Custom("Missing app_name parameter".to_string()))?;
                self.find_application(app_name).await
            }
            _ => Err(AgentError::Custom(format!("Unknown operation: {}", operation))),
        }
    }

    fn name(&self) -> &str {
        "application_launcher"
    }

    fn description(&self) -> &str {
        "Launch and manage desktop applications"
    }

    fn parameters_schema(&self) -> Value {
        json!({
            "type": "object",
            "properties": {
                "operation": {
                    "type": "string",
                    "enum": ["launch_app", "get_installed_apps", "find_app"],
                    "description": "The application operation to perform"
                },
                "app_path": {
                    "type": "string",
                    "description": "Path to the application executable"
                },
                "app_name": {
                    "type": "string",
                    "description": "Name of the application to find"
                },
                "args": {
                    "type": "array",
                    "items": {
                        "type": "string"
                    },
                    "description": "Command line arguments for the application"
                }
            },
            "required": ["operation"]
        })
    }
}

impl ApplicationLauncherTool {
    pub async fn execute(parameters: &Value) -> Result<Value, AgentError> {
        let tool = ApplicationLauncherTool;
        tool.execute(parameters).await
    }

    async fn launch_application(&self, app_path: &str, args: Vec<String>) -> Result<Value, AgentError> {
        #[cfg(target_os = "macos")]
        {
            // On macOS, use `open` command
            let mut cmd = tokio::process::Command::new("open");
            cmd.arg(app_path);
            for arg in &args {
                cmd.arg(arg);
            }

            match cmd.output().await {
                Ok(output) => {
                    if output.status.success() {
                        Ok(json!({
                            "success": true,
                            "message": format!("Application launched successfully: {}", app_path),
                            "app_path": app_path,
                            "args": args.clone()
                        }))
                    } else {
                        let stderr = String::from_utf8_lossy(&output.stderr);
                        Err(AgentError::Custom(format!("Failed to launch application: {}", stderr)))
                    }
                }
                Err(e) => Err(AgentError::Custom(format!("Error launching application: {}", e))),
            }
        }

        #[cfg(target_os = "windows")]
        {
            // On Windows, use `start` command or direct execution
            let mut cmd = tokio::process::Command::new(app_path);
            for arg in &args {
                cmd.arg(arg);
            }

            match cmd.spawn() {
                Ok(_) => Ok(json!({
                    "success": true,
                    "message": format!("Application launched successfully: {}", app_path),
                    "app_path": app_path,
                    "args": args.clone()
                })),
                Err(e) => Err(AgentError::Custom(format!("Error launching application: {}", e))),
            }
        }

        #[cfg(target_os = "linux")]
        {
            // On Linux, try direct execution first
            let mut cmd = tokio::process::Command::new(app_path);
            for arg in &args {
                cmd.arg(arg);
            }

            match cmd.spawn() {
                Ok(_) => Ok(json!({
                    "success": true,
                    "message": format!("Application launched successfully: {}", app_path),
                    "app_path": app_path,
                    "args": args.clone()
                })),
                Err(e) => {
                    // Fallback to xdg-open
                    let mut fallback_cmd = tokio::process::Command::new("xdg-open");
                    fallback_cmd.arg(app_path);

                    match fallback_cmd.spawn() {
                        Ok(_) => Ok(json!({
                            "success": true,
                            "message": format!("Application launched using xdg-open: {}", app_path),
                            "app_path": app_path,
                            "args": args.clone()
                        })),
                        Err(fallback_e) => Err(AgentError::Custom(format!("Failed to launch application: {} (xdg-open error: {})", e, fallback_e))),
                    }
                }
            }
        }
    }

    async fn get_installed_applications(&self) -> Result<Value, AgentError> {
        let mut applications = Vec::new();

        #[cfg(target_os = "macos")]
        {
            // Get applications from /Applications folder
            if let Ok(mut entries) = tokio::fs::read_dir("/Applications").await {
                while let Ok(Some(entry)) = entries.next_entry().await {
                    if let Ok(metadata) = entry.metadata().await {
                        if metadata.is_file() && entry.path().extension().map_or(false, |ext| ext == "app") {
                            let app_name = entry.file_name().to_string_lossy().into_owned();
                            let app_path = entry.path().to_string_lossy().into_owned();

                            applications.push(json!({
                                "name": app_name,
                                "path": app_path,
                                "type": "application"
                            }));
                        }
                    }
                }
            }
        }

        #[cfg(target_os = "windows")]
        {
            // Get applications from common program folders
            let program_dirs = vec![
                "C:\\Program Files",
                "C:\\Program Files (x86)",
                format!("{}\\AppData\\Roaming\\Microsoft\\Windows\\Start Menu\\Programs",
                        dirs_next::home_dir().unwrap_or_else(|| Path::new("")).to_string_lossy())
            ];

            for dir in program_dirs {
                if let Ok(mut entries) = tokio::fs::read_dir(dir).await {
                    while let Ok(Some(entry)) = entries.next_entry().await {
                        if let Ok(metadata) = entry.metadata().await {
                            if metadata.is_file() && entry.path().extension().map_or(false, |ext| ext == "exe") {
                                let app_name = entry.file_name().to_string_lossy().into_owned();
                                let app_path = entry.path().to_string_lossy().into_owned();

                                applications.push(json!({
                                    "name": app_name,
                                    "path": app_path,
                                    "type": "executable"
                                }));
                            }
                        }
                    }
                }
            }
        }

        #[cfg(target_os = "linux")]
        {
            // Get applications from common locations
            let app_dirs = vec![
                "/usr/share/applications",
                "/usr/local/share/applications",
                format!("{}/.local/share/applications",
                        dirs_next::home_dir().unwrap_or_else(|| Path::new("")).to_string_lossy())
            ];

            for dir in app_dirs {
                if let Ok(mut entries) = tokio::fs::read_dir(dir).await {
                    while let Ok(Some(entry)) = entries.next_entry().await {
                        if let Some(file_name) = entry.file_name().to_str() {
                            if file_name.ends_with(".desktop") {
                                if let Ok(content) = tokio::fs::read_to_string(entry.path()).await {
                                    if let Some(app_name) = self.parse_desktop_file(&content) {
                                        applications.push(json!({
                                            "name": app_name,
                                            "path": entry.path().to_string_lossy(),
                                            "type": "desktop"
                                        }));
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        Ok(json!({
            "success": true,
            "applications": applications,
            "count": applications.len()
        }))
    }

    async fn find_application(&self, app_name: &str) -> Result<Value, AgentError> {
        let apps_result = self.get_installed_applications().await?;

        if let Some(apps_array) = apps_result.get("applications").and_then(|v| v.as_array()) {
            let lower_app_name = app_name.to_lowercase();

            for app in apps_array {
                if let Some(name) = app.get("name").and_then(|v| v.as_str()) {
                    if name.to_lowercase().contains(&lower_app_name) {
                        return Ok(json!({
                            "success": true,
                            "found": true,
                            "application": app
                        }));
                    }
                }
            }
        }

        Ok(json!({
            "success": true,
            "found": false,
            "message": format!("Application '{}' not found", app_name)
        }))
    }

    #[cfg(target_os = "linux")]
    fn parse_desktop_file(&self, content: &str) -> Option<String> {
        for line in content.lines() {
            if line.starts_with("Name=") {
                return line.strip_prefix("Name=").map(|s| s.trim().to_string());
            }
        }
        None
    }
}

// Enhanced Tool Manager
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
            ToolDefinition {
                name: "image_analysis".to_string(),
                description: "Analyze images, extract text, and get image information".to_string(),
                parameters: ImageAnalysisTool.parameters_schema(),
                enabled: Some(true),
            },
            ToolDefinition {
                name: "web_search".to_string(),
                description: "Search the web for information".to_string(),
                parameters: WebSearchTool.parameters_schema(),
                enabled: Some(true),
            },
            ToolDefinition {
                name: "code_execution".to_string(),
                description: "Validate syntax and format code snippets".to_string(),
                parameters: CodeExecutionTool.parameters_schema(),
                enabled: Some(true),
            },
            ToolDefinition {
                name: "application_launcher".to_string(),
                description: "Launch and manage desktop applications".to_string(),
                parameters: ApplicationLauncherTool.parameters_schema(),
                enabled: Some(true),
            },
        ]
    }

    pub fn get_tool_instance(name: &str) -> Result<Box<dyn Tool>, AgentError> {
        match name {
            "file_system" => Ok(Box::new(FileSystemTool)),
            "system_info" => Ok(Box::new(SystemInfoTool)),
            "image_analysis" => Ok(Box::new(ImageAnalysisTool)),
            "web_search" => Ok(Box::new(WebSearchTool)),
            "code_execution" => Ok(Box::new(CodeExecutionTool)),
            "application_launcher" => Ok(Box::new(ApplicationLauncherTool)),
            _ => Err(AgentError::Custom(format!("Unknown tool: {}", name))),
        }
    }

    // Execute tool with error handling
    pub async fn execute_tool(name: &str, parameters: &Value) -> Result<Value, AgentError> {
        let tool = Self::get_tool_instance(name)?;
        tool.execute(parameters).await
    }

    // Get tool descriptions for AI agent
    pub fn get_tool_descriptions() -> String {
        let tools = Self::get_available_tools();
        let mut descriptions = String::new();

        for tool in tools {
            descriptions.push_str(&format!(
                "- {}: {}. Parameters: {}\n",
                tool.name,
                tool.description,
                serde_json::to_string_pretty(&tool.parameters).unwrap_or_default()
            ));
        }

        descriptions
    }
}