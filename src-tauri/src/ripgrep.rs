// Ripgrep functionality is only available on desktop platforms
// Mobile platforms do not support external binaries or sidecar processes

#[cfg(not(target_os = "android"))]
#[cfg(not(target_os = "ios"))]
use std::process::Command;

/// Determines the ripgrep executable path to use.
/// First checks if 'rg' is available in the system PATH.
/// If not found, falls back to the sidecar binary bundled with the application.
/// 
/// Note: This function is only available on desktop platforms.
#[cfg(not(target_os = "android"))]
#[cfg(not(target_os = "ios"))]
pub fn get_ripgrep_command(app_handle: &tauri::AppHandle) -> Result<String, String> {
    // First, try to find ripgrep on the system
    if is_ripgrep_installed() {
        return Ok("rg".to_string());
    }

    // If not found, use the sidecar binary
    get_sidecar_path(app_handle)
}

/// Check if ripgrep is installed on the system by trying to run 'rg --version'
#[cfg(not(target_os = "android"))]
#[cfg(not(target_os = "ios"))]
fn is_ripgrep_installed() -> bool {
    Command::new("rg")
        .arg("--version")
        .output()
        .map(|output| output.status.success())
        .unwrap_or(false)
}

/// Get the path to the ripgrep sidecar binary
#[cfg(not(target_os = "android"))]
#[cfg(not(target_os = "ios"))]
fn get_sidecar_path(app_handle: &tauri::AppHandle) -> Result<String, String> {
    use tauri::Manager;
    
    // Get the sidecar command from Tauri
    let sidecar_command = app_handle
        .shell()
        .sidecar("rg")
        .map_err(|e| format!("Failed to get ripgrep sidecar: {}", e))?;

    // Get the program path from the sidecar command
    let program = sidecar_command.program();
    
    Ok(program.to_string_lossy().to_string())
}

/// Execute ripgrep with the given arguments
/// 
/// Note: This function is only available on desktop platforms.
#[cfg(not(target_os = "android"))]
#[cfg(not(target_os = "ios"))]
pub fn execute_ripgrep(
    app_handle: &tauri::AppHandle,
    args: &[String],
) -> Result<std::process::Output, String> {
    let rg_command = get_ripgrep_command(app_handle)?;

    Command::new(&rg_command)
        .args(args)
        .output()
        .map_err(|e| format!("Failed to execute ripgrep: {}", e))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_is_ripgrep_installed() {
        // This test will pass or fail depending on whether ripgrep is installed
        // It's more of a system check than a unit test
        let installed = is_ripgrep_installed();
        println!("Ripgrep installed: {}", installed);
    }
}
