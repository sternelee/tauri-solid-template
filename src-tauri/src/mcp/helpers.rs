use serde_json::Value;
use std::{sync::Arc, time::Duration};
use tauri::{AppHandle, Manager, Runtime};
use tokio::process::Command;
use tokio::time::sleep;

use super::constants::{
    MCP_BACKOFF_MULTIPLIER, MCP_BASE_RESTART_DELAY_MS, MCP_MAX_RESTART_DELAY_MS,
};
use super::models::McpServerConfig;
use super::state::McpState;

/// Calculate exponential backoff delay with jitter
pub fn calculate_exponential_backoff_delay(attempt: u32) -> u64 {
    use std::cmp;

    // Calculate base exponential delay: base_delay * multiplier^(attempt-1)
    let exponential_delay =
        (MCP_BASE_RESTART_DELAY_MS as f64) * MCP_BACKOFF_MULTIPLIER.powi((attempt - 1) as i32);

    // Cap the delay at maximum
    let capped_delay = cmp::min(exponential_delay as u64, MCP_MAX_RESTART_DELAY_MS);

    // Add jitter (±25% randomness) to prevent thundering herd
    let jitter_range = (capped_delay as f64 * 0.25) as u64;
    let jitter = if jitter_range > 0 {
        use std::collections::hash_map::DefaultHasher;
        use std::hash::{Hash, Hasher};

        // Use attempt number as seed for deterministic but varied jitter
        let mut hasher = DefaultHasher::new();
        attempt.hash(&mut hasher);
        let hash = hasher.finish();

        // Convert hash to jitter value in range [-jitter_range, +jitter_range]
        let jitter_offset = (hash % (jitter_range * 2)) as i64 - jitter_range as i64;
        jitter_offset
    } else {
        0
    };

    // Apply jitter while ensuring delay stays positive and within bounds
    let final_delay = cmp::max(
        100, // Minimum 100ms delay
        cmp::min(
            MCP_MAX_RESTART_DELAY_MS,
            (capped_delay as i64 + jitter) as u64,
        ),
    );

    final_delay
}

/// Get app data directory for MCP config storage
pub fn get_app_data_folder_path<R: Runtime>(app: &AppHandle<R>) -> std::path::PathBuf {
    let app_data_dir = app.path().app_data_dir().expect("Failed to get app data dir");
    std::fs::create_dir_all(&app_data_dir).expect("Failed to create app data directory");
    app_data_dir
}

/// Run MCP commands by reading configuration from a JSON file and initializing servers
pub async fn run_mcp_commands<R: Runtime>(
    app: &AppHandle<R>,
    mcp_state: &McpState,
) -> Result<(), String> {
    let app_path = get_app_data_folder_path(app);
    let config_path = app_path.join("mcp_config.json");

    log::info!("Loading MCP configs from {:?}", config_path);

    // Create default config if it doesn't exist
    if !config_path.exists() {
        log::info!("mcp_config.json not found, creating default config");
        std::fs::write(&config_path, super::constants::DEFAULT_MCP_CONFIG)
            .map_err(|e| format!("Failed to create default MCP config: {}", e))?;
    }

    let config_content = std::fs::read_to_string(&config_path)
        .map_err(|e| format!("Failed to read config file: {}", e))?;

    let mcp_servers: serde_json::Value = serde_json::from_str(&config_content)
        .map_err(|e| format!("Failed to parse config: {}", e))?;

    let server_map = mcp_servers
        .get("mcpServers")
        .and_then(Value::as_object)
        .ok_or("No mcpServers found in config")?;

    log::info!("Found {} MCP servers in config", server_map.len());

    // Start active servers
    for (name, config) in server_map {
        if extract_active_status(config) == Some(false) {
            log::info!("Server {} is not active, skipping", name);
            continue;
        }

        log::info!("Starting MCP server: {}", name);
        match start_mcp_server(&name, config).await {
            Ok(_) => {
                log::info!("MCP server {} started successfully", name);
                // Store server in state
                let mut active_servers = mcp_state.active_servers.lock().await;
                active_servers.insert(name.clone(), config.clone());
                drop(active_servers);
            }
            Err(e) => {
                log::error!("Failed to start MCP server {}: {}", name, e);
            }
        }
    }

    Ok(())
}

/// Start an MCP server
pub async fn start_mcp_server(
    name: &str,
    config: &Value,
) -> Result<(), String> {
    let config_params = extract_command_args(config)
        .ok_or_else(|| format!("Failed to extract command args from config for {}", name))?;

    // For now, only support command/process based servers
    let mut cmd = Command::new(&config_params.command);

    #[cfg(windows)]
    {
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW: prevents shell window on Windows
    }

    cmd.kill_on_drop(true);

    config_params
        .args
        .iter()
        .filter_map(Value::as_str)
        .for_each(|arg| {
            cmd.arg(arg);
        });

    config_params.envs.iter().for_each(|(k, v)| {
        if let Some(v_str) = v.as_str() {
            cmd.env(k, v_str);
        }
    });

    // Start the process
    let mut child = cmd.spawn()
        .map_err(|e| format!("Failed to start MCP server {}: {}", name, e))?;

    // Simple verification - wait a bit and check if it's still running
    sleep(Duration::from_millis(500)).await;

    match child.try_wait() {
        Ok(Some(status)) => {
            Err(format!("MCP server {} exited immediately with status: {}", name, status))
        }
        Ok(None) => {
            log::info!("MCP server {} is running", name);
            Ok(())
        }
        Err(e) => {
            Err(format!("Failed to check MCP server {} status: {}", name, e))
        }
    }
}

/// Extract command arguments from config
pub fn extract_command_args(config: &Value) -> Option<McpServerConfig> {
    let obj = config.as_object()?;
    let command = obj.get("command")?.as_str()?.to_string();
    let args = obj.get("args")?.as_array()?.clone();
    let envs = obj
        .get("env")
        .unwrap_or(&Value::Object(serde_json::Map::new()))
        .as_object()?
        .clone();
    Some(McpServerConfig {
        transport_type: obj.get("type").and_then(|t| t.as_str()).map(String::from),
        url: obj.get("url").and_then(|u| u.as_str()).map(String::from),
        timeout: obj.get("timeout").and_then(|t| t.as_u64()).map(Duration::from_secs),
        headers: obj
            .get("headers")
            .unwrap_or(&Value::Object(serde_json::Map::new()))
            .as_object()?
            .clone(),
        command,
        args,
        envs,
    })
}

/// Extract active status from config
pub fn extract_active_status(config: &Value) -> Option<bool> {
    let obj = config.as_object()?;
    obj.get("active")?.as_bool()
}

/// Stop all MCP servers (simplified version)
pub async fn stop_mcp_servers(_mcp_state: Arc<McpState>) -> Result<(), String> {
    // For now, just log - we'll implement proper cleanup later
    log::info!("Stopping all MCP servers");
    Ok(())
}

/// Start an MCP server with restart capability (with client integration)
pub async fn start_mcp_server_with_restart<R: Runtime>(
    app: &AppHandle<R>,
    mcp_state: Arc<McpState>,
    name: String,
    config: Value,
    max_attempts: Option<u32>,
) -> Result<(), String> {
    let max_attempts = max_attempts.unwrap_or(3);

    // Mark as active server
    {
        let mut active_servers = mcp_state.active_servers_list.lock().await;
        active_servers.insert(name.clone(), true);
    }

    // Store config for restart
    {
        let mut active_servers = mcp_state.active_servers.lock().await;
        active_servers.insert(name.clone(), config.clone());
    }

    for attempt in 1..=max_attempts {
        log::info!("Starting MCP server {} (attempt {}/{})", name, attempt, max_attempts);

        match start_mcp_server(&name, &config).await {
            Ok(_) => {
                log::info!("MCP server {} started successfully", name);

                // Create MCP client for this server
                if let Some(client_manager) = &mcp_state.client_manager {
                    let server_config = extract_command_args(&config)
                        .ok_or_else(|| format!("Failed to extract server config for {}", name))?;

                    match client_manager.create_client(&name, &server_config).await {
                        Ok(_) => {
                            log::info!("MCP client for {} created successfully", name);
                        }
                        Err(e) => {
                            log::warn!("Failed to create MCP client for {}: {}", name, e);
                            // Continue anyway - the server started but client creation failed
                        }
                    }
                }

                // Mark as successfully connected
                {
                    let mut connected = mcp_state.successfully_connected.lock().await;
                    connected.insert(name.clone(), true);
                }

                // Reset restart count on success
                {
                    let mut counts = mcp_state.restart_counts.lock().await;
                    counts.insert(name.clone(), 0);
                }

                return Ok(());
            }
            Err(e) => {
                log::error!("Failed to start MCP server {} on attempt {}: {}", name, attempt, e);

                // Update restart count
                {
                    let mut counts = mcp_state.restart_counts.lock().await;
                    let count = counts.entry(name.clone()).or_insert(0);
                    *count += 1;
                }

                if attempt < max_attempts {
                    let delay = calculate_exponential_backoff_delay(attempt);
                    log::info!("Waiting {}ms before retry", delay);
                    sleep(Duration::from_millis(delay)).await;
                }
            }
        }
    }

    // Mark as not successfully connected after all attempts failed
    {
        let mut connected = mcp_state.successfully_connected.lock().await;
        connected.insert(name.clone(), false);
    }

    Err(format!("Failed to start MCP server {} after {} attempts", name, max_attempts))
}

/// Restart active MCP servers
pub async fn restart_active_mcp_servers<R: Runtime>(
    app: &AppHandle<R>,
    mcp_state: Arc<McpState>,
) -> Result<(), String> {
    let active_servers = mcp_state.active_servers.lock().await;
    let configs_to_restart = active_servers.clone();
    drop(active_servers);

    for (name, config) in configs_to_restart {
        log::info!("Restarting MCP server: {}", name);
        if let Err(e) = start_mcp_server_with_restart(app, mcp_state.clone(), name.clone(), config, Some(3)).await {
            log::error!("Failed to restart MCP server {}: {}", name, e);
        }
    }

    Ok(())
}

/// Clean up all MCP servers and state
pub async fn clean_up_mcp_servers(mcp_state: Arc<McpState>) {
    log::info!("Cleaning up MCP servers");

    // Stop servers
    let _ = stop_mcp_servers(mcp_state.clone()).await;

    // Clean up clients
    if let Some(client_manager) = &mcp_state.client_manager {
        client_manager.cleanup().await;
    }

    // Clear state
    {
        let mut active_servers = mcp_state.active_servers.lock().await;
        active_servers.clear();
    }
    {
        let mut restart_counts = mcp_state.restart_counts.lock().await;
        restart_counts.clear();
    }
    {
        let mut connected = mcp_state.successfully_connected.lock().await;
        connected.clear();
    }
    {
        let mut active_servers_list = mcp_state.active_servers_list.lock().await;
        active_servers_list.clear();
    }
    {
        let mut cancellations = mcp_state.tool_call_cancellations.lock().await;
        cancellations.clear();
    }

    log::info!("MCP servers cleaned up successfully");
}