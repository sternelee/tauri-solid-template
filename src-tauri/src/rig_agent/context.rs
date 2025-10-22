use super::*;
use serde_json::{json, Value};
use std::path::Path;
use tokio::fs;

// Context processor for handling @file and #app references
pub struct ContextProcessor;

impl ContextProcessor {
    /// Parse message to extract @file and #app references
    pub fn parse_message_context(message: &str) -> (String, Vec<SourceReference>) {
        let mut sources = Vec::new();
        let mut processed_message = message.to_string();

        // Extract @file references
        let file_pattern = r"@([^\s]+)";
        let file_regex = regex::Regex::new(file_pattern).unwrap();

        for cap in file_regex.captures_iter(message) {
            if let Some(file_path) = cap.get(1) {
                let path_str = file_path.as_str();
                let file_ref = Self::create_file_reference(path_str);
                sources.push(file_ref);

                // Replace @file with a placeholder in the processed message
                processed_message = processed_message.replace(&format!("@{}", path_str), &format!("[FILE: {}]", path_str));
            }
        }

        // Extract #app references
        let app_pattern = r"#([^\s]+)";
        let app_regex = regex::Regex::new(app_pattern).unwrap();

        for cap in app_regex.captures_iter(message) {
            if let Some(app_name) = cap.get(1) {
                let app_str = app_name.as_str();
                let app_ref = Self::create_app_reference(app_str);
                sources.push(app_ref);

                // Replace #app with a placeholder in the processed message
                processed_message = processed_message.replace(&format!("#{}", app_str), &format!("[APP: {}]", app_str));
            }
        }

        (processed_message, sources)
    }

    /// Create a file source reference
    fn create_file_reference(file_path: &str) -> SourceReference {
        let path_obj = Path::new(file_path);
        let extension = path_obj.extension()
            .and_then(|ext| ext.to_str())
            .map(|s| s.to_lowercase());

        SourceReference {
            id: uuid::Uuid::new_v4().to_string(),
            source_type: SourceType::File {
                file_type: extension.clone(),
                size: None, // Will be populated asynchronously
                last_modified: None, // Will be populated asynchronously
            },
            path: file_path.to_string(),
            name: path_obj.file_name()
                .and_then(|name| name.to_str())
                .map(|s| s.to_string()),
            description: Some(format!("File: {}", file_path)),
            metadata: Some({
                let mut metadata = std::collections::HashMap::new();
                if let Some(ext) = extension {
                    metadata.insert("file_type".to_string(), json!(ext));
                }
                metadata
            }),
        }
    }

    /// Create an app source reference
    fn create_app_reference(app_name: &str) -> SourceReference {
        SourceReference {
            id: uuid::Uuid::new_v4().to_string(),
            source_type: SourceType::App {
                bundle_id: None, // Will be populated by app search
                app_name: Some(app_name.to_string()),
                version: None,
            },
            path: app_name.to_string(),
            name: Some(app_name.to_string()),
            description: Some(format!("Application: {}", app_name)),
            metadata: Some({
                let mut metadata = std::collections::HashMap::new();
                metadata.insert("search_query".to_string(), json!(app_name));
                metadata
            }),
        }
    }

    /// Process sources to generate context for AI
    pub async fn process_sources_for_context(sources: &[SourceReference]) -> Result<String, AgentError> {
        let mut context_parts = Vec::new();

        for source in sources {
            match &source.source_type {
                SourceType::File { file_type, .. } => {
                    if let Ok(content) = Self::process_file_source(source).await {
                        context_parts.push(content);
                    }
                }
                SourceType::App { app_name, .. } => {
                    if let Some(name) = app_name {
                        let context = format!("[Application Reference: {}]\nThe user is referring to the application '{}'. You can use the application_launcher tool to find and launch this application.", name, name);
                        context_parts.push(context);
                    }
                }
                SourceType::Url { url, title } => {
                    let title_str = title.as_deref().unwrap_or("Web Page");
                    let context = format!("[URL Reference: {}]\n{}: {}", title_str, title_str, url);
                    context_parts.push(context);
                }
                SourceType::Conversation { conversation_id, title, .. } => {
                    let title_str = title.as_deref().unwrap_or("Previous Conversation");
                    let context = format!("[Conversation Reference: {}]\nConversation ID: {}\nTitle: {}", title_str, conversation_id, title_str);
                    context_parts.push(context);
                }
            }
        }

        if context_parts.is_empty() {
            Ok(String::new())
        } else {
            Ok(context_parts.join("\n\n"))
        }
    }

    /// Process a file source and return its content
    async fn process_file_source(source: &SourceReference) -> Result<String, AgentError> {
        let path = Path::new(&source.path);

        if !path.exists() {
            return Ok(format!("[File Reference: {}]\nFile not found at path: {}", source.name.as_deref().unwrap_or(&source.path), source.path));
        }

        // Read file metadata
        let metadata = fs::metadata(path).await
            .map_err(|e| AgentError::Custom(format!("Failed to read file metadata: {}", e)))?;

        let file_size = metadata.len();
        let last_modified = metadata.modified()
            .ok()
            .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
            .map(|d| d.as_secs());

        // Determine file type and process accordingly
        let extension = path.extension()
            .and_then(|ext| ext.to_str())
            .map(|s| s.to_lowercase())
            .unwrap_or_else(|| "txt".to_string());

        match extension.as_str() {
            "txt" | "md" | "json" | "yaml" | "yml" | "toml" | "xml" | "csv" | "log" | "conf" | "config" |
            "rs" | "js" | "ts" | "py" | "java" | "cpp" | "c" | "h" | "hpp" | "go" | "php" | "rb" | "swift" |
            "kt" | "scala" | "sh" | "bat" | "ps1" | "sql" | "html" | "css" | "scss" | "less" => {
                // Text-based files - read content directly
                Self::read_text_file(&source.path, file_size).await
            }
            "pdf" | "docx" | "xlsx" | "pptx" => {
                // Binary document files - provide metadata
                Ok(format!(
                    "[File Reference: {}]\nType: {} document\nSize: {} bytes\nLast modified: {}\nNote: This is a binary document file. Content extraction requires specialized tools.",
                    source.name.as_deref().unwrap_or(&source.path),
                    extension.to_uppercase(),
                    file_size,
                    last_modified.map(|t| chrono::DateTime::from_timestamp(t as i64, 0)
                        .map(|dt| dt.to_rfc3339())
                        .unwrap_or_else(|| "Unknown".to_string()))
                        .unwrap_or_else(|| "Unknown".to_string())
                ))
            }
            "png" | "jpg" | "jpeg" | "gif" | "bmp" | "svg" | "webp" | "ico" => {
                // Image files - provide metadata
                Ok(format!(
                    "[File Reference: {}]\nType: {} image\nSize: {} bytes\nLast modified: {}\nNote: This is an image file. Visual content analysis requires image processing tools.",
                    source.name.as_deref().unwrap_or(&source.path),
                    extension.to_uppercase(),
                    file_size,
                    last_modified.map(|t| chrono::DateTime::from_timestamp(t as i64, 0)
                        .map(|dt| dt.to_rfc3339())
                        .unwrap_or_else(|| "Unknown".to_string()))
                        .unwrap_or_else(|| "Unknown".to_string())
                ))
            }
            "mp3" | "wav" | "flac" | "aac" | "ogg" | "m4a" => {
                // Audio files - provide metadata
                Ok(format!(
                    "[File Reference: {}]\nType: {} audio file\nSize: {} bytes\nLast modified: {}\nNote: This is an audio file. Content analysis requires audio processing tools.",
                    source.name.as_deref().unwrap_or(&source.path),
                    extension.to_uppercase(),
                    file_size,
                    last_modified.map(|t| chrono::DateTime::from_timestamp(t as i64, 0)
                        .map(|dt| dt.to_rfc3339())
                        .unwrap_or_else(|| "Unknown".to_string()))
                        .unwrap_or_else(|| "Unknown".to_string())
                ))
            }
            "mp4" | "avi" | "mkv" | "mov" | "wmv" | "flv" | "webm" => {
                // Video files - provide metadata
                Ok(format!(
                    "[File Reference: {}]\nType: {} video file\nSize: {} bytes\nLast modified: {}\nNote: This is a video file. Content analysis requires video processing tools.",
                    source.name.as_deref().unwrap_or(&source.path),
                    extension.to_uppercase(),
                    file_size,
                    last_modified.map(|t| chrono::DateTime::from_timestamp(t as i64, 0)
                        .map(|dt| dt.to_rfc3339())
                        .unwrap_or_else(|| "Unknown".to_string()))
                        .unwrap_or_else(|| "Unknown".to_string())
                ))
            }
            _ => {
                // Other file types - provide basic info
                Ok(format!(
                    "[File Reference: {}]\nType: {} file\nSize: {} bytes\nLast modified: {}\nNote: This file type may require specialized tools for content analysis.",
                    source.name.as_deref().unwrap_or(&source.path),
                    extension.to_uppercase(),
                    file_size,
                    last_modified.map(|t| chrono::DateTime::from_timestamp(t as i64, 0)
                        .map(|dt| dt.to_rfc3339())
                        .unwrap_or_else(|| "Unknown".to_string()))
                        .unwrap_or_else(|| "Unknown".to_string())
                ))
            }
        }
    }

    /// Read text file content with size limits
    async fn read_text_file(file_path: &str, file_size: u64) -> Result<String, AgentError> {
        const MAX_FILE_SIZE: u64 = 1024 * 1024; // 1MB limit for text files

        if file_size > MAX_FILE_SIZE {
            return Ok(format!(
                "[File Reference: {}]\nFile size: {} bytes (exceeds 1MB limit)\nFirst 1000 characters:\n{}",
                file_path,
                file_size,
                // Read first 1000 characters as preview
                match fs::read_to_string(file_path).await {
                    Ok(content) => {
                        let preview = content.chars().take(1000).collect::<String>();
                        if content.chars().count() > 1000 {
                            preview + "\n... (truncated)"
                        } else {
                            preview
                        }
                    }
                    Err(_) => "Unable to read file preview".to_string(),
                }
            ));
        }

        match fs::read_to_string(file_path).await {
            Ok(content) => {
                let char_count = content.chars().count();
                if char_count > 10000 { // 10k character limit
                    let truncated = content.chars().take(10000).collect::<String>();
                    Ok(format!(
                        "[File Reference: {}]\nFile size: {} bytes, {} characters (truncated to 10k)\nContent:\n{}\n... (content truncated)",
                        file_path,
                        file_size,
                        char_count,
                        truncated
                    ))
                } else {
                    Ok(format!(
                        "[File Reference: {}]\nFile size: {} bytes, {} characters\nContent:\n{}",
                        file_path,
                        file_size,
                        char_count,
                        content
                    ))
                }
            }
            Err(e) => Ok(format!(
                "[File Reference: {}]\nError reading file: {}",
                file_path,
                e
            )),
        }
    }

    /// Generate embedding for file content (placeholder for now)
    pub async fn generate_file_embedding(file_path: &str) -> Result<Vec<f32>, AgentError> {
        // In a real implementation, this would:
        // 1. Read the file content
        // 2. Split into chunks if needed
        // 3. Generate embeddings using the AI provider's embedding model
        // 4. Return the embedding vectors

        // For now, return a placeholder embedding
        let content = fs::read_to_string(file_path).await
            .map_err(|e| AgentError::Custom(format!("Failed to read file for embedding: {}", e)))?;

        // Simple hash-based embedding (placeholder)
        let mut embedding = Vec::new();
        let hash = content.chars().map(|c| c as u32).sum::<u32>();

        for i in 0..1536 { // Common embedding dimension
            embedding.push(((hash.wrapping_mul(i as u32 + 1)) % 1000) as f32 / 1000.0);
        }

        Ok(embedding)
    }

    /// Search for similar files based on embeddings (placeholder)
    pub async fn search_similar_files(query_embedding: &[f32], file_paths: &[String]) -> Result<Vec<(String, f32)>, AgentError> {
        // In a real implementation, this would:
        // 1. Load pre-computed embeddings for files
        // 2. Calculate cosine similarity between query and each file
        // 3. Return ranked results

        let mut results = Vec::new();

        for (i, path) in file_paths.iter().enumerate() {
            // Simple scoring based on filename similarity (placeholder)
            let similarity = 1.0 / (i + 1) as f32; // Placeholder similarity score
            results.push((path.clone(), similarity));
        }

        // Sort by similarity (descending)
        results.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));

        Ok(results)
    }
}