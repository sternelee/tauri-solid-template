use std::time::Duration;

// MCP Constants
pub const MCP_TOOL_CALL_TIMEOUT: Duration = Duration::from_secs(30);
pub const MCP_BASE_RESTART_DELAY_MS: u64 = 1000; // Start with 1 second
pub const MCP_MAX_RESTART_DELAY_MS: u64 = 30000; // Cap at 30 seconds
pub const MCP_BACKOFF_MULTIPLIER: f64 = 2.0; // Double the delay each time

pub const DEFAULT_MCP_CONFIG: &str = r#"{
  "mcpServers": {
    "exa": {
      "type": "http",
      "url": "https://mcp.exa.ai/mcp",
      "headers": {}
    },
    "deepwiki": {
      "type": "http",
      "url": "https://mcp.deepwiki.com/mcp",
      "headers": {}
    },
    "context7": {
      "type": "http",
      "url": "https://mcp.context7.com/mcp",
      "headers": {}
    },
    "grep": {
      "type": "http",
      "url": "https://mcp.grep.app",
      "headers": {}
    },
    "browsermcp": {
      "command": "npx",
      "args": ["@browsermcp/mcp"],
      "env": {},
      "active": false
    },
    "serper": {
      "command": "npx",
      "args": ["-y", "serper-search-scrape-mcp-server"],
      "env": { "SERPER_API_KEY": "YOUR_SERPER_API_KEY_HERE" },
      "active": false
    },
    "sequential-thinking": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-sequential-thinking"],
      "env": {},
      "active": false
    }
  }
}"#;

