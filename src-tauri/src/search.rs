use anyhow::Result;
use serde::{Deserialize, Serialize};
use specta::Type;
use std::path::PathBuf;
use std::process::Command;

#[derive(Serialize, Deserialize, Type, Debug, Clone)]
pub struct SearchResult {
    pub path: String,
    pub line_number: Option<u32>,
    pub content: Option<String>,
    pub file_type: String,
}

#[derive(Serialize, Deserialize, Type)]
pub struct SearchOptions {
    pub pattern: String,
    pub max_results: Option<u32>,
    pub file_extensions: Option<Vec<String>>,
    pub include_hidden: Option<bool>,
}

/// Search for files using ripgrep command
#[tauri::command]
#[specta::specta]
pub fn search_files(
    options: SearchOptions,
    search_path: Option<String>,
) -> Result<Vec<SearchResult>, String> {
    // Default to current working directory if no path provided
    let search_dir = search_path
        .map(PathBuf::from)
        .unwrap_or_else(|| std::env::current_dir().unwrap_or_else(|_| PathBuf::from(".")));

    // Build ripgrep arguments
    let mut args = vec![
        "--json".to_string(),        // JSON output for easy parsing
        "--line-number".to_string(), // Include line numbers
        "--no-heading".to_string(),  // No file headings
    ];

    // Add file type filters if specified
    if let Some(ref extensions) = options.file_extensions {
        if !extensions.is_empty() {
            let mut glob_patterns = Vec::new();
            for ext in extensions {
                if !ext.starts_with('.') {
                    glob_patterns.push(format!("*.{}", ext));
                } else {
                    glob_patterns.push(format!("*{}", ext));
                }
            }
            let glob_pattern = glob_patterns.join(",");
            args.push("--glob".to_string());
            args.push(glob_pattern);
        }
    }

    // Include hidden files if requested
    if options.include_hidden.unwrap_or(false) {
        args.push("--hidden".to_string());
    }

    // Add max results limit if specified
    if let Some(max_results) = options.max_results {
        args.push("--max-count".to_string());
        args.push(max_results.to_string());
    }

    // Add the search pattern
    args.push(options.pattern.clone());

    // Add search directory
    args.push(search_dir.to_string_lossy().to_string());

    // Execute ripgrep command
    let output = Command::new("rg")
        .args(&args)
        .output()
        .map_err(|e| format!("Failed to execute ripgrep: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("ripgrep failed: {}", stderr));
    }

    // Parse JSON output
    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut results = Vec::new();

    for line in stdout.lines() {
        if line.trim().is_empty() {
            continue;
        }

        // Parse ripgrep JSON output
        match serde_json::from_str::<RgResult>(line) {
            Ok(rg_result) => {
                match rg_result {
                    RgResult::Begin { path } => {
                        // New file - continue to look for matches
                    }
                    RgResult::End { .. } => {
                        // End of file - continue
                    }
                    RgResult::Match {
                        path,
                        line_number,
                        lines,
                        submatches,
                        ..
                    } => {
                        let file_type = detect_file_type(&path);
                        let content = lines.first().cloned().unwrap_or_default();

                        results.push(SearchResult {
                            path,
                            line_number: Some(line_number.try_into().unwrap()),
                            content: Some(content),
                            file_type,
                        });
                    }
                    RgResult::Context {
                        path,
                        line_number,
                        lines,
                        ..
                    } => {
                        let file_type = detect_file_type(&path);
                        let content = lines.first().cloned().unwrap_or_default();

                        results.push(SearchResult {
                            path,
                            line_number: Some(line_number.try_into().unwrap()),
                            content: Some(content),
                            file_type,
                        });
                    }
                }
            }
            Err(e) => {
                // Skip invalid JSON lines (ripgrep sometimes outputs progress info)
                eprintln!("Failed to parse ripgrep output: {}", e);
                continue;
            }
        }
    }

    Ok(results)
}

#[derive(Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
enum RgResult {
    Begin {
        path: String,
    },
    End {
        binary: Option<bool>,
        stats: Option<RgStats>,
    },
    Match {
        path: String,
        line_number: u64,
        absolute_offset: u64,
        submatches: Vec<RgSubmatch>,
        lines: Vec<String>,
    },
    Context {
        path: String,
        line_number: u64,
        absolute_offset: u64,
        lines: Vec<String>,
    },
}

#[derive(Deserialize)]
struct RgStats {
    elapsed: Option<f64>,
    searches: Option<u64>,
    searches_with_match: Option<u64>,
    bytes_searched: Option<u64>,
    bytes_printed: Option<u64>,
    matched_lines: Option<u64>,
    matches: Option<u64>,
}

#[derive(Deserialize)]
struct RgSubmatch {
    #[serde(rename = "match")]
    match_text: RgMatchText,
    start: u64,
    end: u64,
}

#[derive(Deserialize)]
struct RgMatchText {
    text: String,
}

/// Detect file type based on file extension
fn detect_file_type(path: &str) -> String {
    if let Some(extension) = std::path::Path::new(path)
        .extension()
        .and_then(|ext| ext.to_str())
    {
        match extension.to_lowercase().as_str() {
            "rs" => "Rust".to_string(),
            "js" => "JavaScript".to_string(),
            "jsx" => "React".to_string(),
            "ts" => "TypeScript".to_string(),
            "tsx" => "React".to_string(),
            "py" => "Python".to_string(),
            "java" => "Java".to_string(),
            "cpp" | "cxx" | "cc" => "C++".to_string(),
            "c" => "C".to_string(),
            "cs" => "C#".to_string(),
            "go" => "Go".to_string(),
            "php" => "PHP".to_string(),
            "rb" => "Ruby".to_string(),
            "swift" => "Swift".to_string(),
            "kt" => "Kotlin".to_string(),
            "scala" => "Scala".to_string(),
            "html" => "HTML".to_string(),
            "css" | "scss" | "sass" | "less" => "CSS".to_string(),
            "json" => "JSON".to_string(),
            "yaml" | "yml" => "YAML".to_string(),
            "xml" => "XML".to_string(),
            "md" | "markdown" => "Markdown".to_string(),
            "txt" => "Text".to_string(),
            "sql" => "SQL".to_string(),
            "sh" | "bash" | "zsh" => "Shell".to_string(),
            "dockerfile" => "Docker".to_string(),
            "toml" => "TOML".to_string(),
            "lock" => "Lock".to_string(),
            "gitignore" => "Git".to_string(),
            "env" => "Environment".to_string(),
            "log" => "Log".to_string(),
            _ => extension.to_uppercase().to_string(),
        }
    } else {
        "Unknown".to_string()
    }
}

/// Get common search directories
#[tauri::command]
#[specta::specta]
pub fn get_search_directories() -> Result<Vec<String>, String> {
    let mut directories = Vec::new();

    // Current working directory
    if let Ok(current_dir) = std::env::current_dir() {
        directories.push(current_dir.to_string_lossy().to_string());
    }

    // User home directory
    if let Some(home_dir) = dirs::home_dir() {
        directories.push(home_dir.to_string_lossy().to_string());

        // Common subdirectories
        let common_dirs = vec![
            "Documents",
            "Downloads",
            "Desktop",
            "Projects",
            "Code",
            "src",
            "workspace",
        ];

        for dir in common_dirs {
            let dir_path = home_dir.join(dir);
            if dir_path.exists() && dir_path.is_dir() {
                directories.push(dir_path.to_string_lossy().to_string());
            }
        }
    }

    // Project root detection (look for common project files)
    if let Ok(current_dir) = std::env::current_dir() {
        let mut search_dir = current_dir.clone();

        // Look for project indicators
        loop {
            let has_project_indicator = [
                "Cargo.toml",
                "package.json",
                "pom.xml",
                "composer.json",
                "requirements.txt",
                "Gemfile",
                "go.mod",
                ".git",
            ]
            .iter()
            .any(|file| search_dir.join(file).exists());

            if has_project_indicator {
                directories.push(search_dir.to_string_lossy().to_string());
                break;
            }

            // Go up one directory
            if !search_dir.pop() {
                break;
            }

            // Stop at home directory
            if let Some(home_dir) = dirs::home_dir() {
                if search_dir == home_dir {
                    break;
                }
            }
        }
    }

    // Remove duplicates and limit
    directories.sort();
    directories.dedup();
    directories.truncate(10); // Limit to 10 directories

    Ok(directories)
}

