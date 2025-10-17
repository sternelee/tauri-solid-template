use tauri_specta::Event;
pub mod apps;

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
    app: tauri::AppHandle,
    window_id: String,
    config: serde_json::Value,
) -> Result<(), String> {
    // This would create a new window for plugins - simplified for now
    Ok(())
}

#[tauri::command]
#[specta::specta]
async fn update_plugin_window(
    app: tauri::AppHandle,
    window_id: String,
    config: serde_json::Value,
) -> Result<(), String> {
    // Update window configuration
    Ok(())
}

#[tauri::command]
#[specta::specta]
async fn close_plugin_window(app: tauri::AppHandle, window_id: String) -> Result<(), String> {
    // Close plugin window
    Ok(())
}

#[tauri::command]
#[specta::specta]
async fn focus_plugin_window(app: tauri::AppHandle, window_id: String) -> Result<(), String> {
    // Focus plugin window
    Ok(())
}

#[tauri::command]
#[specta::specta]
async fn set_window_fullscreen(
    app: tauri::AppHandle,
    window_id: String,
    fullscreen: bool,
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
    let mut builder = tauri::Builder::default();

    let specta_builder = tauri_specta::Builder::<tauri::Wry>::new()
        .commands(tauri_specta::collect_commands![
            greet,
            execute_command,
            get_system_info
        ])
        .events(tauri_specta::collect_events![crate::DemoEvent]);

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
        .manage(apps::ApplicationsState::default())
        .invoke_handler(specta_builder.invoke_handler())
        .invoke_handler(tauri::generate_handler![
            apps::get_applications,
            apps::refresh_applications_list,
            apps::refresh_applications_list_in_bg,
            apps::get_frontmost_app,
            apps::hide_all_apps_except_frontmost,
            create_plugin_window,
            update_plugin_window,
            close_plugin_window,
            focus_plugin_window,
            set_window_fullscreen,
            request_screenshot_permission
        ])
        .setup(move |app| {
            specta_builder.mount_events(app);

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
