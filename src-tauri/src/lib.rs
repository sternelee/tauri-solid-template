use tauri::Manager;
use tauri_specta::Event;
pub mod apps;
pub mod database;
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
            apps::get_applications,
            apps::get_frontmost_app,
            apps::refresh_applications_list,
            apps::refresh_applications_list_in_bg,
            apps::hide_all_apps_except_frontmost,
            apps::get_app_icon_data_url,
            close_plugin_window,
            focus_plugin_window,
            set_window_fullscreen,
            request_screenshot_permission,
            toggle_window_visibility,
            hide_window,
            // File search commands
            search::search_files,
            search::get_search_directories,
            search::search_screenshots,
            // Enhanced rig agent commands with database integration
            rig_agent::chat_commands::initialize_agent_with_db,
            rig_agent::chat_commands::chat_with_agent_db,
            rig_agent::chat_commands::get_conversation_history_db,
            rig_agent::chat_commands::list_conversations_db,
            rig_agent::chat_commands::delete_conversation_db,
            rig_agent::chat_commands::update_conversation_title_db,
            rig_agent::chat_commands::search_conversations_db,
            rig_agent::chat_commands::get_enhanced_agent_status,
            rig_agent::chat_commands::create_conversation_with_db,
            rig_agent::chat_commands::execute_tool_command,
            rig_agent::chat_commands::get_available_tools_command,
            rig_agent::chat_commands::generate_image_enhanced,
            rig_agent::chat_commands::create_embeddings_for_search,
            rig_agent::chat_commands::semantic_search_conversation,
            // Provider management commands
            rig_agent::providers::get_available_providers,
            rig_agent::providers::get_provider_models,
            // Image generation commands
            rig_agent::generate_image_command,
            rig_agent::create_image_variation_command,
            rig_agent::edit_image_command,
            // Embedding commands
            rig_agent::create_embeddings_command,
            rig_agent::semantic_search_command,
            rig_agent::calculate_similarity_command,
            // Legacy rig agent commands
            rig_agent::commands::initialize_agent,
            rig_agent::commands::chat_with_agent,
            rig_agent::commands::get_conversation_history,
            rig_agent::commands::clear_conversation,
            rig_agent::commands::list_conversations,
            rig_agent::commands::get_agent_status,
            rig_agent::commands::get_available_tools,
            // New enhanced commands with multimodal and tool support (temporarily commented for compilation)
            // rig_agent::enhanced_commands::initialize_enhanced_agent,
            // rig_agent::enhanced_commands::enhanced_chat_with_agent,
            // rig_agent::enhanced_commands::enhanced_chat_streaming,
            // rig_agent::enhanced_commands::process_image_for_vision,
            // rig_agent::enhanced_commands::generate_text_embeddings,
            // rig_agent::enhanced_commands::execute_tool,
            // rig_agent::enhanced_commands::get_available_providers,
            // rig_agent::enhanced_commands::get_provider_template,
            // Legacy compatibility commands (temporarily removed for compilation)
            // rig_agent::initialize_agent_legacy,
            // rig_agent::chat_with_agent_legacy,
            // rig_agent::get_conversation_history_legacy,
            // rig_agent::clear_conversation_legacy,
            // rig_agent::is_agent_initialized,
            // rig_agent::get_agent_config,
            // Text selection toolbar commands
            text_selection::get_system_text_selection,
            text_selection::get_toolbar_actions,
            text_selection::execute_toolbar_action,
            text_selection::get_toolbar_config,
            text_selection::update_toolbar_config,
            text_selection::show_toolbar,
            text_selection::hide_toolbar,
            text_selection::replace_original_text,
            // Settings commands
            settings::get_settings,
            settings::save_settings,
            settings::reset_settings,
        ])
        .events(tauri_specta::collect_events![
            crate::DemoEvent,
            rig_agent::commands::ChatEvent,
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
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_screenshots::init())
        .manage(apps::ApplicationsState::default())
        .manage(rig_agent::AgentState::default())
        .manage(settings::SettingsState::new())
        .manage(text_selection::init_text_selection_system())
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
