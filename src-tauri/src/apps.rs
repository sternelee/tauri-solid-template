use applications::common::SearchPath;
use applications::AppInfo;
use applications::{App, AppInfoContext};
use base64::{engine::general_purpose, Engine as _};
use dirs;
use serde::{Deserialize, Serialize};
use specta::Type;
use std::io::{BufReader, Cursor};
use std::path::{Path, PathBuf};
use std::sync::Mutex;

#[cfg(target_os = "macos")]
use tauri_icns::{IconFamily, IconType};

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

/// Convert icns file to PNG data URL for web display
#[cfg(target_os = "macos")]
fn icns_to_data_url(icns_path: &str) -> Result<String, Box<dyn std::error::Error>> {
    let path = PathBuf::from(icns_path);

    // Check if it's an icns file
    if path.extension().and_then(|s| s.to_str()) != Some("icns") {
        return Err("Not an icns file".into());
    }

    // Open and read the icns file
    let file = BufReader::new(std::fs::File::open(&path)?);
    let icon_family = IconFamily::read(file)?;

    // Prioritize more compatible icon formats (prefer standard RGBA32 formats)
    let preferred_types = vec![
        IconType::RGBA32_128x128,
        IconType::RGBA32_64x64,
        IconType::RGBA32_32x32,
        IconType::RGBA32_16x16,
    ];

    let mut selected_icon: Option<Result<tauri_icns::Image, Box<dyn std::error::Error>>> = None;

    // Try preferred types first
    for icon_type in preferred_types {
        if icon_family.available_icons().contains(&icon_type) {
            match icon_family.get_icon_with_type(icon_type) {
                Ok(icon) => {
                    selected_icon = Some(Ok(icon));
                    break;
                }
                Err(_) => continue,
            }
        }
    }

    // If preferred types failed, try any available icon
    if selected_icon.is_none() {
        for icon_type in icon_family.available_icons() {
            match icon_family.get_icon_with_type(icon_type) {
                Ok(icon) => {
                    selected_icon = Some(Ok(icon));
                    break;
                }
                Err(_) => continue,
            }
        }
    }

    let largest_icon = selected_icon.ok_or("No suitable icon found")??;

    // Write to PNG in memory
    let mut buffer: Vec<u8> = Vec::new();
    let cursor = Cursor::new(&mut buffer);
    largest_icon.write_png(cursor)?;

    // Encode to base64
    let base64_data = general_purpose::STANDARD.encode(&buffer);

    Ok(format!("data:image/png;base64,{}", base64_data))
}

/// Convert icns file to PNG data URL for web display (non-macOS fallback)
#[cfg(not(target_os = "macos"))]
fn icns_to_data_url(_icns_path: &str) -> Result<String, Box<dyn std::error::Error>> {
    Err("icns conversion is only supported on macOS".into())
}

/// Get application icon as web-compatible data URL
#[tauri::command]
#[specta::specta]
pub fn get_app_icon_data_url(icon_path: Option<String>) -> Result<Option<String>, String> {
    match icon_path {
        Some(path) => {
            #[cfg(target_os = "macos")]
            {
                // On macOS, try to convert icns to data URL
                if path.ends_with(".icns") {
                    match icns_to_data_url(&path) {
                        Ok(data_url) => Ok(Some(data_url)),
                        Err(e) => {
                            eprintln!("Failed to convert icns to data URL: {}", e);
                            // Fallback: try to find alternative icon formats
                            try_alternative_icon_formats(&path)
                        }
                    }
                } else {
                    // For non-icns files, return the path as-is
                    Ok(Some(path))
                }
            }

            #[cfg(not(target_os = "macos"))]
            {
                // On other platforms, just return the path as-is
                Ok(Some(path))
            }
        }
        None => Ok(None),
    }
}

/// Try to find alternative icon formats for macOS apps
#[cfg(target_os = "macos")]
fn try_alternative_icon_formats(icns_path: &str) -> Result<Option<String>, String> {
    let path = PathBuf::from(icns_path);

    // Try to find the app bundle and look for PNG icons
    if let Some(app_path) = path.parent().and_then(|p| p.parent()) {
        let resources_path = app_path.join("Contents/Resources");

        // Look for PNG files in Resources directory
        if let Ok(entries) = std::fs::read_dir(&resources_path) {
            for entry in entries.flatten() {
                let entry_path = entry.path();
                if let Some(extension) = entry_path.extension() {
                    if extension == "png" {
                        // Convert PNG to data URL
                        if let Ok(png_data) = std::fs::read(&entry_path) {
                            let base64_data = general_purpose::STANDARD.encode(&png_data);
                            return Ok(Some(format!("data:image/png;base64,{}", base64_data)));
                        }
                    }
                }
            }
        }
    }

    // If no alternative found, return an emoji fallback
    Ok(None)
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
