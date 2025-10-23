#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;
    use std::fs::File;
    use std::io::Write;
    use std::sync::Arc;
    use tauri::test::mock_app;
    use tokio::sync::Mutex;

    #[tokio::test]
    async fn test_run_mcp_commands() {
        let app = mock_app();

        // Get the app path where the config should be created
        let app_path = super::helpers::get_app_data_folder_path(app.handle());
        let config_path = app_path.join("mcp_config.json");

        // Ensure the directory exists
        if let Some(parent) = config_path.parent() {
            std::fs::create_dir_all(parent).expect("Failed to create parent directory");
        }

        // Create a mock mcp_config.json file
        let mut file: File = File::create(&config_path).expect("Failed to create config file");
        file.write_all(b"{\"mcpServers\":{}}")
            .expect("Failed to write to config file");

        // Create MCP state
        let mcp_state = Arc::new(McpState::new());

        // Call the run_mcp_commands function
        let result = super::helpers::run_mcp_commands(app.handle(), mcp_state.clone()).await;

        // Assert that the function returns Ok(())
        assert!(result.is_ok());

        // Clean up the mock config file
        std::fs::remove_file(&config_path).expect("Failed to remove config file");
    }

    #[test]
    fn test_calculate_exponential_backoff_delay() {
        // Test basic exponential backoff
        let delay1 = super::helpers::calculate_exponential_backoff_delay(1);
        let delay2 = super::helpers::calculate_exponential_backoff_delay(2);
        let delay3 = super::helpers::calculate_exponential_backoff_delay(3);

        // Delays should increase (approximately)
        assert!(delay2 > delay1);
        assert!(delay3 > delay2);

        // Delays should be reasonable
        assert!(delay1 >= 100);
        assert!(delay1 <= 2000); // Should be around 1000ms with jitter
        assert!(delay2 <= 4000); // Should be around 2000ms with jitter
        assert!(delay3 <= 8000); // Should be around 4000ms with jitter

        // Test max delay capping
        let max_delay = super::helpers::calculate_exponential_backoff_delay(100);
        assert!(max_delay <= super::constants::MCP_MAX_RESTART_DELAY_MS);
    }

    #[test]
    fn test_extract_command_args() {
        let config = serde_json::json!({
            "command": "npx",
            "args": ["-y", "test-server"],
            "env": {"NODE_ENV": "production"},
            "type": "http",
            "url": "http://localhost:3000",
            "timeout": 30,
            "headers": {"Authorization": "Bearer token"}
        });

        let result = super::helpers::extract_command_args(&config);
        assert!(result.is_some());

        let params = result.unwrap();
        assert_eq!(params.command, "npx");
        assert_eq!(params.args.len(), 2);
        assert_eq!(params.args[0], "-y");
        assert_eq!(params.args[1], "test-server");
        assert_eq!(params.transport_type, Some("http".to_string()));
        assert_eq!(params.url, Some("http://localhost:3000".to_string()));
        assert!(params.timeout.is_some());
        assert_eq!(params.envs.get("NODE_ENV").unwrap(), "production");
        assert_eq!(params.headers.get("Authorization").unwrap(), "Bearer token");
    }

    #[test]
    fn test_extract_active_status() {
        let active_config = serde_json::json!({
            "command": "test",
            "active": true
        });

        let inactive_config = serde_json::json!({
            "command": "test",
            "active": false
        });

        let no_active_config = serde_json::json!({
            "command": "test"
        });

        assert_eq!(super::helpers::extract_active_status(&active_config), Some(true));
        assert_eq!(super::helpers::extract_active_status(&inactive_config), Some(false));
        assert_eq!(super::helpers::extract_active_status(&no_active_config), None);
    }
}