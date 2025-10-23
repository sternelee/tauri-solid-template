use tauri::Manager;
use tauri_specta::Event;
pub mod apps;
pub mod database;
pub mod mcp;
pub mod rig_agent;
pub mod search;
pub mod settings;
pub mod text_selection;

// demo command
#[tauri::command]
#[specta::specta]
fn greet(app: tauri::AppHandle, name: &str) -> String {
    DemoEvent("Demo event fired from Rust 🦀".to_string())
        .emit(&app)
        .ok();
    format!("Hello, {}! You've been greeted from Rust!", name)
}

// Execute shell command
#[tauri::command]
#[specta::specta]
async fn execute_command(command: String, args: Vec<String>) -> Result<String, String> {
    use std::process::Command;

    match Command::new(&command).args(&args).output() {
        Ok(output) => {
            let stdout = String::from_utf8_lossy(&output.stdout);
            let stderr = String::from_utf8_lossy(&output.stderr);

            if output.status.success() {
                Ok(stdout.to_string())
            } else {
                Err(format!("Command failed: {}", stderr))
            }
        }
        Err(e) => Err(format!("Failed to execute command: {}", e)),
    }
}

// Get system info
#[tauri::command]
#[specta::specta]
fn get_system_info() -> SystemInfo {
    SystemInfo {
        os: format!("{}-{}", std::env::consts::OS, std::env::consts::FAMILY),
        arch: std::env::consts::ARCH.to_string(),
    }
}

// Plugin window management
#[tauri::command]
#[specta::specta]
async fn create_plugin_window(
    _app: tauri::AppHandle,
    _window_id: String,
    _config: serde_json::Value,
) -> Result<(), String> {
    // This would create a new window for plugins - simplified for now
    Ok(())
}

#[tauri::command]
#[specta::specta]
async fn update_plugin_window(
    _app: tauri::AppHandle,
    _window_id: String,
    _config: serde_json::Value,
) -> Result<(), String> {
    // Update window configuration
    Ok(())
}

#[tauri::command]
#[specta::specta]
async fn close_plugin_window(_app: tauri::AppHandle, _window_id: String) -> Result<(), String> {
    // Close plugin window
    Ok(())
}

#[tauri::command]
#[specta::specta]
async fn focus_plugin_window(_app: tauri::AppHandle, _window_id: String) -> Result<(), String> {
    // Focus plugin window
    Ok(())
}

#[tauri::command]
#[specta::specta]
async fn set_window_fullscreen(
    _app: tauri::AppHandle,
    _window_id: String,
    _fullscreen: bool,
) -> Result<(), String> {
    // Set window fullscreen mode
    Ok(())
}

// Permission management
#[tauri::command]
#[specta::specta]
async fn request_screenshot_permission() -> Result<bool, String> {
    // Request screen capture permission
    // In a real implementation, this would show system permission dialog
    Ok(true)
}

// Window management
#[tauri::command]
#[specta::specta]
async fn toggle_window_visibility(app: tauri::AppHandle) -> Result<(), String> {
    let window = app.get_webview_window("main").unwrap();

    if window
        .is_visible()
        .map_err(|e: tauri::Error| e.to_string())?
    {
        window.hide().map_err(|e: tauri::Error| e.to_string())?;
    } else {
        window.show().map_err(|e: tauri::Error| e.to_string())?;
        window
            .set_focus()
            .map_err(|e: tauri::Error| e.to_string())?;
    }

    Ok(())
}

#[tauri::command]
#[specta::specta]
async fn hide_window(app: tauri::AppHandle) -> Result<(), String> {
    let window = app.get_webview_window("main").unwrap();
    window.hide().map_err(|e: tauri::Error| e.to_string())?;
    Ok(())
}

// System info struct
#[derive(serde::Serialize, serde::Deserialize, specta::Type)]
pub struct SystemInfo {
    os: String,
    arch: String,
}

// demo event
#[derive(serde::Serialize, serde::Deserialize, Debug, Clone, specta::Type, Event)]
pub struct DemoEvent(String);

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    #[cfg(debug_assertions)]
    {
        log::info!("App started!");
        log::warn!("Example Rust Log: warning!");
        log::error!("Example Rust Log: error!");
    }

    #[cfg(debug_assertions)]
    let devtools = tauri_plugin_devtools::init();
    let mut builder = tauri::Builder::default().plugin(tauri_plugin_cache::init());

    let specta_builder = tauri_specta::Builder::<tauri::Wry>::new()
        .commands(tauri_specta::collect_commands![
            greet,
            execute_command,
            get_system_info,
            create_plugin_window,
            update_plugin_window,
            close_plugin_window,
            focus_plugin_window,
            set_window_fullscreen,
            request_screenshot_permission,
            toggle_window_visibility,
            hide_window,
            // Apps commands
            apps::get_applications,
            apps::get_frontmost_app,
            apps::refresh_applications_list,
            apps::refresh_applications_list_in_bg,
            apps::hide_all_apps_except_frontmost,
            apps::get_app_icon_data_url,
            // MCP commands
            mcp::commands::activate_mcp_server,
            mcp::commands::deactivate_mcp_server,
            mcp::commands::restart_mcp_servers,
            mcp::commands::get_connected_servers,
            mcp::commands::get_tools,
            mcp::commands::call_tool,
            mcp::commands::cancel_tool_call,
            mcp::commands::get_mcp_configs,
            mcp::commands::save_mcp_configs,
            mcp::commands::get_mcp_server_status,
            mcp::commands::reset_mcp_restart_count,
        ])
        .events(tauri_specta::collect_events![
            crate::DemoEvent,
            // rig_agent::commands::ChatEvent, // Temporarily commented
            // rig_agent::enhanced_commands::EnhancedChatEvent // Temporarily commented
        ]);

    #[cfg(debug_assertions)]
    {
        builder = builder.plugin(devtools);
    }

    #[cfg(all(debug_assertions, not(mobile)))]
    specta_builder
        .export(
            specta_typescript::Typescript::default()
                .formatter(specta_typescript::formatter::prettier),
            "../src/bindings.ts",
        )
        .expect("failed to export typescript bindings");

    builder
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_clipboard_x::init())
        .plugin(tauri_plugin_screenshots::init())
        .plugin(tauri_plugin_http::init())
        .manage(apps::ApplicationsState::default())
        .manage(rig_agent::AgentState::default())
        .manage(settings::SettingsState::new())
        .manage(text_selection::init_text_selection_system())
        .manage(mcp::state::McpState::with_client_manager())
        .invoke_handler(specta_builder.invoke_handler())
        .setup(move |app| {
            specta_builder.mount_events(app);

            // Initialize database
            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                let db = database::Database::new(&app_handle)
                    .await
                    .expect("Failed to initialize database");
                app_handle.manage(db);
            });

            // Initialize MCP servers
            // Note: MCP servers will be initialized on-demand to avoid AppHandle Send issues
            log::info!("MCP integration ready - servers will be initialized on demand");

            // listen to demo event
            DemoEvent::listen(app, |event| {
                log::info!("DemoEvent received in Rust:: {:?}", event.payload);
            });

            // dispatch demo event
            DemoEvent("Hello from Rust 🦀".to_string()).emit(app).ok();
            // /dispatch demo event

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
