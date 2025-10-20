use applications::common::SearchPath;
use applications::AppInfo;
use applications::{App, AppInfoContext};
use dirs;
use serde::{Deserialize, Serialize};
use specta::Type;
use std::path::PathBuf;
use std::sync::Mutex;

#[derive(Default)]
pub struct ApplicationsState {
    ctx: Mutex<Option<AppInfoContext>>,
}

// Get default search paths for different platforms
fn get_default_search_paths() -> Vec<SearchPath> {
    let mut paths = Vec::new();

    #[cfg(target_os = "macos")]
    {
        // macOS Applications folders
        paths.push(SearchPath::new(PathBuf::from("/Applications"), 1));
        if let Some(home) = dirs::home_dir() {
            paths.push(SearchPath::new(home.join("Applications"), 2));
        }
        // System Applications
        paths.push(SearchPath::new(PathBuf::from("/System/Applications"), 3));
    }

    #[cfg(target_os = "windows")]
    {
        // Windows Program Files
        if let Some(program_files) = std::env::var_os("ProgramFiles") {
            paths.push(SearchPath::new(PathBuf::from(program_files), 1));
        }
        if let Some(program_files_x86) = std::env::var_os("ProgramFiles(x86)") {
            paths.push(SearchPath::new(PathBuf::from(program_files_x86), 2));
        }
        // Local AppData
        if let Some(appdata) = std::env::var_os("LOCALAPPDATA") {
            paths.push(SearchPath::new(
                PathBuf::from(appdata).join("Microsoft/WindowsApps"),
                3,
            ));
        }
    }

    #[cfg(target_os = "linux")]
    {
        // Common Linux application directories
        if let Some(home) = dirs::home_dir() {
            paths.push(SearchPath::new(home.join(".local/share/applications"), 1));
            paths.push(SearchPath::new(home.join("bin"), 2));
        }
        paths.push(SearchPath::new(PathBuf::from("/usr/share/applications"), 3));
        paths.push(SearchPath::new(
            PathBuf::from("/usr/local/share/applications"),
            4,
        ));
        paths.push(SearchPath::new(
            PathBuf::from("/var/lib/flatpak/exports/share/applications"),
            5,
        ));
    }

    // If no platform-specific paths found, add some generic ones
    if paths.is_empty() {
        #[cfg(target_os = "macos")]
        paths.push(SearchPath::new(PathBuf::from("/Applications"), 1));
        #[cfg(not(target_os = "macos"))]
        paths.push(SearchPath::new(PathBuf::from("/usr/bin"), 1));
    }

    paths
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
    fn from(app: App) -> Self {
        // Extract information from the actual App struct fields
        let path = app
            .app_path_exe
            .clone()
            .or_else(|| app.app_desktop_path.parent().map(|p| p.to_path_buf()))
            .map(|p| p.to_string_lossy().to_string());

        let icon = app.icon_path.map(|p| p.to_string_lossy().to_string());

        // For bundle_id, we can try to extract it from the desktop file name on Linux
        // or use the executable name on other platforms
        let bundle_id = if cfg!(target_os = "linux") {
            app.app_desktop_path
                .file_stem()
                .and_then(|name| name.to_str())
                .unwrap_or(&app.name)
                .to_string()
        } else {
            // For macOS and Windows, use the executable name without extension
            app.app_path_exe
                .as_ref()
                .and_then(|p| p.file_stem())
                .and_then(|name| name.to_str())
                .unwrap_or(&app.name)
                .to_string()
        };

        Self {
            name: app.name,
            bundle_id,
            path,
            icon,
        }
    }
}

#[tauri::command]
#[specta::specta]
pub fn get_applications(
    state: tauri::State<'_, ApplicationsState>,
) -> Result<Vec<AppInfoWrapper>, String> {
    let mut ctx_guard = state.ctx.lock().unwrap();

    // Initialize AppInfoContext if not already done
    if ctx_guard.is_none() {
        let search_paths = get_default_search_paths();
        let mut ctx = AppInfoContext::new(search_paths);

        // Refresh apps to populate the context
        if let Err(e) = ctx.refresh_apps() {
            return Err(format!("Failed to refresh applications: {}", e));
        }

        *ctx_guard = Some(ctx);
    }

    // Get all applications
    let apps = ctx_guard.as_ref().unwrap().get_all_apps();

    // Debug: print the number of apps found
    println!("Found {} applications", apps.len());

    Ok(apps.into_iter().map(AppInfoWrapper::from).collect())
}

#[tauri::command]
#[specta::specta]
pub fn refresh_applications_list(state: tauri::State<'_, ApplicationsState>) -> Result<(), String> {
    let mut ctx_guard = state.ctx.lock().unwrap();

    if let Some(ctx) = ctx_guard.as_mut() {
        ctx.refresh_apps()
            .map_err(|e: anyhow::Error| e.to_string())?;
    } else {
        // If context is not initialized, force re-initialization on next get_applications call
        *ctx_guard = None;
    }

    Ok(())
}

#[tauri::command]
#[specta::specta]
pub fn refresh_applications_list_in_bg(
    state: tauri::State<'_, ApplicationsState>,
) -> Result<(), String> {
    let mut ctx_guard = state.ctx.lock().unwrap();

    if let Some(ctx) = ctx_guard.as_mut() {
        ctx.refresh_apps_in_background();
    }
    // If context is not initialized, we don't do background refresh

    Ok(())
}

#[tauri::command]
#[specta::specta]
pub fn get_frontmost_app(
    state: tauri::State<'_, ApplicationsState>,
) -> Result<Option<AppInfoWrapper>, String> {
    let mut ctx_guard = state.ctx.lock().unwrap();

    // Initialize context if needed
    if ctx_guard.is_none() {
        let search_paths = get_default_search_paths();
        let ctx = AppInfoContext::new(search_paths);
        *ctx_guard = Some(ctx);
    }

    // Get frontmost app
    ctx_guard
        .as_ref()
        .unwrap()
        .get_frontmost_application()
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
