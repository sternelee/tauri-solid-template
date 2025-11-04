use anyhow::{anyhow, Result};
use async_trait::async_trait;
use serde_json::Value;
use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::RwLock;
use tokio::time::timeout;
use tracing::{info, warn};

use super::models::McpServerConfig;

/// MCP Tool definition
#[derive(Debug, Clone)]
pub struct McpTool {
    pub name: String,
    pub description: Option<String>,
    pub input_schema: Option<Value>,
}

/// MCP Client trait for different transport types
#[async_trait]
pub trait McpClientHandler: Send + Sync {
    async fn list_tools(&self) -> Result<Vec<McpTool>>;
    async fn call_tool(&self, name: &str, arguments: Option<Value>) -> Result<Value>;
    async fn is_connected(&self) -> bool;
    async fn close(&self) -> Result<()>;
}

/// Simple HTTP-based MCP Client using direct HTTP requests
pub struct HttpMcpClient {
    url: String,
    headers: HashMap<String, String>,
    client: reqwest::Client,
}

impl HttpMcpClient {
    pub async fn new(url: String, headers: HashMap<String, String>) -> Result<Self> {
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(30))
            .build()?;

        Ok(Self {
            url,
            headers,
            client,
        })
    }

    async fn make_mcp_request(&self, method: &str, params: Value) -> Result<Value> {
        let request_body = serde_json::json!({
            "jsonrpc": "2.0",
            "id": 1,
            "method": method,
            "params": params
        });

        info!("Making MCP request to {}: {}", self.url, method);

        let mut req = self
            .client
            .post(&self.url)
            .header("Accept", "application/json, text/event-stream")
            .json(&request_body);

        for (key, value) in &self.headers {
            req = req.header(key, value);
        }

        let response = req
            .send()
            .await
            .map_err(|e| anyhow!("Failed to send MCP request: {}", e))?;

        if !response.status().is_success() {
            return Err(anyhow!(
                "MCP request failed with status: {}",
                response.status()
            ));
        }

        // Get response text to handle both JSON and SSE formats
        let response_text = response
            .text()
            .await
            .map_err(|e| anyhow!("Failed to read MCP response: {}", e))?;

        // Try to parse as SSE first (most common format for these servers)
        if response_text.starts_with("event: message\ndata: ") {
            // Parse SSE response
            let json_start = response_text.find("data: ").unwrap_or(0) + 6;
            let json_end = response_text[json_start..]
                .find('\n')
                .map(|pos| pos + json_start)
                .unwrap_or(response_text.len());
            let json_str = &response_text[json_start..json_end];

            let sse_response: Value = serde_json::from_str(json_str)
                .map_err(|e| anyhow!("Failed to parse SSE response JSON: {}", e))?;

            // Check for JSON-RPC error in SSE response
            if let Some(error) = sse_response.get("error") {
                return Err(anyhow!("MCP RPC error in SSE: {}", error));
            }

            let result = sse_response
                .get("result")
                .ok_or_else(|| anyhow!("No result in SSE MCP response"))?
                .clone();

            Ok(result)
        } else {
            // Try to parse as regular JSON
            let response_body: Value = serde_json::from_str(&response_text)
                .map_err(|e| anyhow!("Failed to parse JSON response: {}", e))?;

            // Check for JSON-RPC error
            if let Some(error) = response_body.get("error") {
                return Err(anyhow!("MCP RPC error: {}", error));
            }

            let result = response_body
                .get("result")
                .ok_or_else(|| anyhow!("No result in MCP response"))?
                .clone();

            Ok(result)
        }
    }
}

#[async_trait]
impl McpClientHandler for HttpMcpClient {
    async fn list_tools(&self) -> Result<Vec<McpTool>> {
        let result = self
            .make_mcp_request("tools/list", serde_json::json!({}))
            .await?;

        let tools_array = result
            .get("tools")
            .and_then(|t| t.as_array())
            .ok_or_else(|| anyhow!("Invalid tools response"))?;

        let mut tools = Vec::new();
        for tool_value in tools_array {
            if let Some(tool_obj) = tool_value.as_object() {
                let tool = McpTool {
                    name: tool_obj
                        .get("name")
                        .and_then(|n| n.as_str())
                        .unwrap_or("")
                        .to_string(),
                    description: tool_obj
                        .get("description")
                        .and_then(|d| d.as_str())
                        .map(String::from),
                    input_schema: tool_obj.get("inputSchema").cloned(),
                };
                tools.push(tool);
            }
        }

        Ok(tools)
    }

    async fn call_tool(&self, name: &str, arguments: Option<Value>) -> Result<Value> {
        let params = serde_json::json!({
            "name": name,
            "arguments": arguments.unwrap_or_else(|| serde_json::json!({}))
        });

        let result = self.make_mcp_request("tools/call", params).await?;

        // Extract content from the result
        let content = result
            .get("content")
            .cloned()
            .unwrap_or_else(|| serde_json::json!({"text": "No content returned"}));

        Ok(content)
    }

    async fn is_connected(&self) -> bool {
        // Simple health check - try to list tools with a timeout
        match timeout(Duration::from_secs(5), self.list_tools()).await {
            Ok(Ok(_)) => true,
            _ => false,
        }
    }

    async fn close(&self) -> Result<()> {
        // No explicit cleanup needed for HTTP client
        Ok(())
    }
}

/// Main MCP Client Manager
pub struct McpClientManager {
    clients: Arc<RwLock<HashMap<String, Box<dyn McpClientHandler>>>>,
}

impl std::fmt::Debug for McpClientManager {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("McpClientManager")
            .field("clients", &"<hidden>")
            .finish()
    }
}

impl McpClientManager {
    pub fn new(_mcp_state: Arc<super::state::McpState>) -> Self {
        Self {
            clients: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    pub async fn create_client(&self, name: &str, config: &McpServerConfig) -> Result<()> {
        let client: Box<dyn McpClientHandler> = match config.transport_type.as_deref() {
            Some("http") | Some("sse") => {
                if let Some(url) = &config.url {
                    let headers = config
                        .headers
                        .iter()
                        .map(|(k, v)| (k.clone(), v.as_str().unwrap_or_default().to_string()))
                        .collect();

                    Box::new(HttpMcpClient::new(url.clone(), headers).await?)
                } else {
                    return Err(anyhow!("URL required for HTTP/SSE transport"));
                }
            }
            Some("stdio") | _ => {
                // For now, we only support HTTP-based clients
                // TODO: Implement stdio client if needed
                return Err(anyhow!("STDIO transport not yet implemented"));
            }
        };

        {
            let mut clients = self.clients.write().await;
            clients.insert(name.to_string(), client);
        }

        info!("MCP client '{}' created", name);
        Ok(())
    }

    pub async fn remove_client(&self, name: &str) -> Result<()> {
        {
            let mut clients = self.clients.write().await;
            if let Some(client) = clients.remove(name) {
                if let Err(e) = client.close().await {
                    warn!("Error closing client '{}': {}", name, e);
                }
            }
        }
        info!("MCP client '{}' removed", name);
        Ok(())
    }

    pub async fn list_tools(&self, server_name: &str) -> Result<Vec<McpTool>> {
        let clients = self.clients.read().await;
        if let Some(client) = clients.get(server_name) {
            client.list_tools().await
        } else {
            Err(anyhow!("No client found for server: {}", server_name))
        }
    }

    pub async fn call_tool(
        &self,
        server_name: &str,
        tool_name: &str,
        arguments: Option<Value>,
    ) -> Result<Value> {
        let clients = self.clients.read().await;
        if let Some(client) = clients.get(server_name) {
            client.call_tool(tool_name, arguments).await
        } else {
            Err(anyhow!("No client found for server: {}", server_name))
        }
    }

    pub async fn is_connected(&self, server_name: &str) -> bool {
        let clients = self.clients.read().await;
        if let Some(client) = clients.get(server_name) {
            client.is_connected().await
        } else {
            false
        }
    }

    pub async fn get_all_tools(&self) -> Result<HashMap<String, Vec<McpTool>>> {
        let mut all_tools = HashMap::new();
        let clients = self.clients.read().await;

        for (server_name, client) in clients.iter() {
            match client.list_tools().await {
                Ok(tools) => {
                    all_tools.insert(server_name.clone(), tools);
                }
                Err(e) => {
                    warn!("Failed to list tools for server '{}': {}", server_name, e);
                    all_tools.insert(server_name.clone(), vec![]);
                }
            }
        }

        Ok(all_tools)
    }

    pub async fn cleanup(&self) {
        let mut clients = self.clients.write().await;
        for (name, client) in clients.drain() {
            if let Err(e) = client.close().await {
                warn!("Error closing client '{}' during cleanup: {}", name, e);
            }
        }
        info!("All MCP clients cleaned up");
    }
}

// Helper function to determine tool name format
pub fn format_tool_name(server_name: &str, tool: &McpTool) -> String {
    format!("{}__{}", server_name, tool.name)
}

// Helper function to parse tool name
pub fn parse_tool_name(tool_name: &str) -> Option<(String, String)> {
    if let Some((server_name, tool_name)) = tool_name.split_once("__") {
        Some((server_name.to_string(), tool_name.to_string()))
    } else {
        None
    }
}

