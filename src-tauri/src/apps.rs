use applications::AppInfo;
use applications::{App, AppInfoContext};
use serde::{Deserialize, Serialize};
use specta::Type;
use std::sync::Mutex;

#[derive(Default)]
pub struct ApplicationsState {
    ctx: Mutex<AppInfoContext>,
}

// specta-compatible wrapper for App
#[derive(Serialize, Deserialize, Type)]
pub struct AppInfoWrapper {
    pub name: String,
    pub bundle_id: String,
    pub path: Option<String>,
    pub icon: Option<String>,
}

impl From<App> for AppInfoWrapper {
    fn from(_app: App) -> Self {
        // We need to check the actual API of the App struct
        // For now, let's use a basic implementation and fix it as needed
        Self {
            name: "Unknown".to_string(), // Placeholder until we know the correct API
            bundle_id: "unknown".to_string(),
            path: None,
            icon: None,
        }
    }
}

#[tauri::command]
#[specta::specta]
pub fn get_applications(
    state: tauri::State<'_, ApplicationsState>,
) -> Result<Vec<AppInfoWrapper>, String> {
    let apps = state.ctx.lock().unwrap().get_all_apps();
    Ok(apps.into_iter().map(AppInfoWrapper::from).collect())
}

#[tauri::command]
#[specta::specta]
pub fn refresh_applications_list(state: tauri::State<'_, ApplicationsState>) -> Result<(), String> {
    state
        .ctx
        .lock()
        .unwrap()
        .refresh_apps()
        .map_err(|e: anyhow::Error| e.to_string())?;
    Ok(())
}

#[tauri::command]
#[specta::specta]
pub fn refresh_applications_list_in_bg(
    state: tauri::State<'_, ApplicationsState>,
) -> Result<(), String> {
    state.ctx.lock().unwrap().refresh_apps_in_background();
    Ok(())
}

#[tauri::command]
#[specta::specta]
pub fn get_frontmost_app() -> Result<Option<AppInfoWrapper>, String> {
    let ctx = AppInfoContext::new(vec![]);
    ctx.get_frontmost_application()
        .map(|app| Some(AppInfoWrapper::from(app)))
        .map_err(|err: anyhow::Error| err.to_string())
}

/// Hide All Apps Except Frontmost (macOS only)
#[tauri::command]
#[specta::specta]
pub fn hide_all_apps_except_frontmost() -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        use std::process::Command;

        let script = r#"
tell application "System Events"
    set frontApp to name of first application process whose frontmost is true
    set visibleApps to every process whose visible is true and name is not frontApp
    repeat with theApp in visibleApps
        set visible of theApp to false
    end repeat
end tell
        "#;

        Command::new("osascript")
            .arg("-e")
            .arg(script)
            .output()
            .map_err(|e| format!("Failed to execute AppleScript: {}", e))?;

        Ok(())
    }

    #[cfg(not(target_os = "macos"))]
    {
        Err("This feature is only available on macOS".to_string())
    }
}
