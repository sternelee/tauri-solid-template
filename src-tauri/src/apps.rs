use applications::AppInfo;
use applications::{App, AppInfoContext};
use std::sync::Mutex;

#[derive(Default)]
pub struct ApplicationsState {
    ctx: Mutex<AppInfoContext>,
}

#[tauri::command]
pub fn get_applications(state: tauri::State<'_, ApplicationsState>) -> Result<Vec<App>, String> {
    Ok(state.ctx.lock().unwrap().get_all_apps())
}

#[tauri::command]
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
pub fn refresh_applications_list_in_bg(
    state: tauri::State<'_, ApplicationsState>,
) -> Result<(), String> {
    state.ctx.lock().unwrap().refresh_apps_in_background();
    Ok(())
}

#[tauri::command]
pub fn get_frontmost_app() -> Result<App, String> {
    let ctx = AppInfoContext::new(vec![]);
    ctx.get_frontmost_application()
        .map_err(|err: anyhow::Error| err.to_string())
}

/// Hide All Apps Except Frontmost (macOS only)
#[tauri::command]
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

