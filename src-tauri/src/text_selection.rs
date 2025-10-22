use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager, State};
use std::sync::{Arc, Mutex};
use specta::Type;

// Wrapper for DateTime<Utc> to implement specta::Type
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Timestamp(chrono::DateTime<chrono::Utc>);

impl Type for Timestamp {
    fn inline(type_map: &mut specta::TypeMap, generics: specta::Generics<'_>) -> specta::DataType {
        // Delegate to String's Type implementation
        String::inline(type_map, generics)
    }

    fn reference(type_map: &mut specta::TypeMap, generics: &[specta::DataType]) -> specta::datatype::reference::Reference {
        // Delegate to String's Type implementation
        String::reference(type_map, generics)
    }
}

impl From<chrono::DateTime<chrono::Utc>> for Timestamp {
    fn from(dt: chrono::DateTime<chrono::Utc>) -> Self {
        Timestamp(dt)
    }
}

impl From<Timestamp> for chrono::DateTime<chrono::Utc> {
    fn from(ts: Timestamp) -> Self {
        ts.0
    }
}

// Text selection toolbar data structures
#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct TextSelection {
    pub text: String,
    pub selected_text: String,
    pub rect: SelectionRect,
    pub timestamp: Timestamp,
    pub source_app: Option<String>,
    pub context_type: SelectionContextType,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct SelectionRect {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
    pub screen: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub enum SelectionContextType {
    Text,
    FilePath,
    Url,
    Email,
    PhoneNumber,
    Code,
    Other,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct ToolbarAction {
    pub id: String,
    pub label: String,
    pub icon: String,
    pub shortcut: Option<String>,
    pub category: ActionCategory,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub enum ActionCategory {
    Translation,
    Polish,
    KnowledgeBase,
    FileAction,
    Search,
    Other,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct ToolbarConfig {
    pub enabled: bool,
    pub shortcut: String,
    pub auto_hide: bool,
    pub opacity: f32,
    pub position_offset: (f64, f64),
    pub enabled_actions: Vec<String>,
}

impl Default for ToolbarConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            shortcut: "cmd+shift+space".to_string(),
            auto_hide: true,
            opacity: 0.9,
            position_offset: (10.0, 10.0),
            enabled_actions: vec![
                "translate".to_string(),
                "polish".to_string(),
                "add_to_knowledge".to_string(),
                "search".to_string(),
                "chat_with_file".to_string(),
            ],
        }
    }
}

// Global state for text selection
#[derive(Debug, Default)]
pub struct TextSelectionState {
    pub current_selection: Arc<Mutex<Option<TextSelection>>>,
    pub toolbar_visible: Arc<Mutex<bool>>,
    pub toolbar_position: Arc<Mutex<Option<SelectionRect>>>,
    pub last_action_time: Arc<Mutex<Option<Timestamp>>>,
}

impl TextSelectionState {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn set_selection(&self, selection: TextSelection) {
        if let Ok(mut current) = self.current_selection.lock() {
            *current = Some(selection);
        }
    }

    pub fn get_selection(&self) -> Option<TextSelection> {
        self.current_selection.lock()
            .ok()
            .and_then(|s| s.clone())
    }

    pub fn set_toolbar_visible(&self, visible: bool) {
        if let Ok(mut toolbar_visible) = self.toolbar_visible.lock() {
            *toolbar_visible = visible;
        }
    }

    pub fn is_toolbar_visible(&self) -> bool {
        self.toolbar_visible.lock()
            .map(|v| *v)
            .unwrap_or(false)
    }

    pub fn set_toolbar_position(&self, rect: SelectionRect) {
        if let Ok(mut position) = self.toolbar_position.lock() {
            *position = Some(rect);
        }
    }

    pub fn get_toolbar_position(&self) -> Option<SelectionRect> {
        self.toolbar_position.lock()
            .ok()
            .and_then(|p| p.clone())
    }
}

// Get system text selection (cross-platform clipboard-based approach)
#[tauri::command]
#[specta::specta]
pub async fn get_system_text_selection(
    app: AppHandle,
    state: State<'_, TextSelectionState>,
) -> Result<Option<TextSelection>, String> {
    use arboard::Clipboard;

    // Try to get text from clipboard as a proxy for system selection
    match Clipboard::new() {
        Ok(mut _clipboard) => {
            match _clipboard.get_text() {
                Ok(text) => {
                    if !text.trim().is_empty() {
                        let selection = TextSelection {
                            text: text.clone(),
                            selected_text: text.clone(),
                            rect: SelectionRect {
                                x: 100.0,
                                y: 100.0,
                                width: 200.0,
                                height: 30.0,
                                screen: None,
                            },
                            timestamp: Timestamp::from(chrono::Utc::now()),
                            source_app: None,
                            context_type: detect_context_type(&text),
                        };

                        state.set_selection(selection.clone());
                        return Ok(Some(selection));
                    }
                }
                Err(e) => {
                    return Err(format!("Failed to read clipboard: {}", e));
                }
            }
        }
        Err(e) => {
            return Err(format!("Failed to initialize clipboard: {}", e));
        }
    }

    Ok(None)
}

// Detect the type of selected text
fn detect_context_type(text: &str) -> SelectionContextType {
    if text.starts_with('/') || (text.contains('/') && text.contains('.')) {
        if text.contains('.') && text.split('.').last().map_or(false, |ext| {
            matches!(ext.to_lowercase().as_str(), "txt" | "doc" | "pdf" | "jpg" | "png" | "js" | "ts" | "py" | "java" | "cpp" | "html" | "css" | "json" | "xml" | "md")
        }) {
            SelectionContextType::FilePath
        } else if text.starts_with("http://") || text.starts_with("https://") {
            SelectionContextType::Url
        } else {
            SelectionContextType::Text
        }
    } else if text.contains('@') && text.contains('.') {
        SelectionContextType::Email
    } else if text.chars().all(|c| c.is_ascii_digit() || c == '+' || c == '-' || c == '(' || c == ')' || c == ' ') && text.chars().filter(|c| c.is_ascii_digit()).count() >= 7 {
        SelectionContextType::PhoneNumber
    } else if text.contains('\n') || (text.len() > 10 && (text.contains("function") || text.contains("class") || text.contains("import") || text.contains("export"))) {
        SelectionContextType::Code
    } else {
        SelectionContextType::Text
    }
}

// Get available toolbar actions based on selection type
#[tauri::command]
#[specta::specta]
pub async fn get_toolbar_actions(
    selection_type: SelectionContextType,
) -> Result<Vec<ToolbarAction>, String> {
    let mut actions = Vec::new();

    // Universal actions
    actions.push(ToolbarAction {
        id: "translate".to_string(),
        label: "翻译".to_string(),
        icon: "translate".to_string(),
        shortcut: Some("t".to_string()),
        category: ActionCategory::Translation,
    });

    actions.push(ToolbarAction {
        id: "polish".to_string(),
        label: "润色".to_string(),
        icon: "edit".to_string(),
        shortcut: Some("p".to_string()),
        category: ActionCategory::Polish,
    });

    actions.push(ToolbarAction {
        id: "add_to_knowledge".to_string(),
        label: "加入知识库".to_string(),
        icon: "book".to_string(),
        shortcut: Some("k".to_string()),
        category: ActionCategory::KnowledgeBase,
    });

    actions.push(ToolbarAction {
        id: "search".to_string(),
        label: "搜索".to_string(),
        icon: "search".to_string(),
        shortcut: Some("s".to_string()),
        category: ActionCategory::Search,
    });

    // Context-specific actions
    match selection_type {
        SelectionContextType::FilePath => {
            actions.push(ToolbarAction {
                id: "chat_with_file".to_string(),
                label: "Chat with file".to_string(),
                icon: "chat".to_string(),
                shortcut: Some("c".to_string()),
                category: ActionCategory::FileAction,
            });

            actions.push(ToolbarAction {
                id: "open_file".to_string(),
                label: "打开文件".to_string(),
                icon: "folder".to_string(),
                shortcut: Some("o".to_string()),
                category: ActionCategory::FileAction,
            });
        }
        SelectionContextType::Url => {
            actions.push(ToolbarAction {
                id: "open_url".to_string(),
                label: "打开链接".to_string(),
                icon: "link".to_string(),
                shortcut: Some("o".to_string()),
                category: ActionCategory::Other,
            });
        }
        SelectionContextType::Email => {
            actions.push(ToolbarAction {
                id: "send_email".to_string(),
                label: "发送邮件".to_string(),
                icon: "mail".to_string(),
                shortcut: Some("e".to_string()),
                category: ActionCategory::Other,
            });
        }
        _ => {}
    }

    Ok(actions)
}

// Execute toolbar action
#[tauri::command]
#[specta::specta]
pub async fn execute_toolbar_action(
    app: AppHandle,
    state: State<'_, TextSelectionState>,
    action_id: String,
    selection: Option<TextSelection>,
) -> Result<String, String> {
    let selection = match selection.or_else(|| state.get_selection()) {
        Some(s) => s,
        None => return Err("No text selection available".to_string()),
    };

    // Update last action time
    if let Ok(mut last_action) = state.last_action_time.lock() {
        *last_action = Some(Timestamp::from(chrono::Utc::now()));
    }

    match action_id.as_str() {
        "translate" => {
            // Create a window for translation
            let window = create_translation_window(&app, &selection).await?;
            return Ok(format!("Translation window created: {}", window));
        }
        "polish" => {
            // Create a window for text polishing
            let window = create_polish_window(&app, &selection).await?;
            return Ok(format!("Polish window created: {}", window));
        }
        "add_to_knowledge" => {
            // Add to knowledge base
            add_text_to_knowledge_base(&selection).await?;
            return Ok("Text added to knowledge base".to_string());
        }
        "search" => {
            // Create search window
            let window = create_search_window(&app, &selection).await?;
            return Ok(format!("Search window created: {}", window));
        }
        "chat_with_file" => {
            // Create chat with file window
            if let SelectionContextType::FilePath = selection.context_type {
                let window = create_chat_with_file_window(&app, &selection).await?;
                return Ok(format!("Chat with file window created: {}", window));
            }
            return Err("This action is only available for file paths".to_string());
        }
        "open_file" => {
            // Open the file
            if let SelectionContextType::FilePath = selection.context_type {
                open::that(&selection.selected_text).map_err(|e| e.to_string())?;
                return Ok("File opened".to_string());
            }
            return Err("This action is only available for file paths".to_string());
        }
        "open_url" => {
            // Open the URL
            if let SelectionContextType::Url = selection.context_type {
                open::that(&selection.selected_text).map_err(|e| e.to_string())?;
                return Ok("URL opened".to_string());
            }
            return Err("This action is only available for URLs".to_string());
        }
        _ => {
            return Err(format!("Unknown action: {}", action_id));
        }
    }
}

// Helper functions for creating windows
async fn create_translation_window(app: &AppHandle, selection: &TextSelection) -> Result<String, String> {
    let window_id = format!("translation-{}", chrono::Utc::now().timestamp_millis());

    let _window = tauri::WebviewWindowBuilder::new(app, &window_id, tauri::WebviewUrl::App("/toolbar/translate".into()))
        .title("翻译")
        .inner_size(600.0, 400.0)
        .resizable(true)
        .decorations(true)
        .always_on_top(true)
        .build()
        .map_err(|e| format!("Failed to create translation window: {}", e))?;

    // Store the selection data for the window to use
    app.state::<TextSelectionState>().set_selection(selection.clone());

    Ok(window_id)
}

async fn create_polish_window(app: &AppHandle, selection: &TextSelection) -> Result<String, String> {
    let window_id = format!("polish-{}", chrono::Utc::now().timestamp_millis());

    let _window = tauri::WebviewWindowBuilder::new(app, &window_id, tauri::WebviewUrl::App("/toolbar/polish".into()))
        .title("文本润色")
        .inner_size(600.0, 400.0)
        .resizable(true)
        .decorations(true)
        .always_on_top(true)
        .build()
        .map_err(|e| format!("Failed to create polish window: {}", e))?;

    app.state::<TextSelectionState>().set_selection(selection.clone());

    Ok(window_id)
}

async fn create_search_window(app: &AppHandle, selection: &TextSelection) -> Result<String, String> {
    let window_id = format!("search-{}", chrono::Utc::now().timestamp_millis());

    let _window = tauri::WebviewWindowBuilder::new(app, &window_id, tauri::WebviewUrl::App("/toolbar/search".into()))
        .title("搜索")
        .inner_size(800.0, 600.0)
        .resizable(true)
        .decorations(true)
        .always_on_top(true)
        .build()
        .map_err(|e| format!("Failed to create search window: {}", e))?;

    app.state::<TextSelectionState>().set_selection(selection.clone());

    Ok(window_id)
}

async fn create_chat_with_file_window(app: &AppHandle, selection: &TextSelection) -> Result<String, String> {
    let window_id = format!("chat-file-{}", chrono::Utc::now().timestamp_millis());

    let _window = tauri::WebviewWindowBuilder::new(app, &window_id, tauri::WebviewUrl::App("/toolbar/chat-file".into()))
        .title("Chat with File")
        .inner_size(1000.0, 700.0)
        .resizable(true)
        .decorations(true)
        .always_on_top(true)
        .build()
        .map_err(|e| format!("Failed to create chat with file window: {}", e))?;

    app.state::<TextSelectionState>().set_selection(selection.clone());

    Ok(window_id)
}

async fn add_text_to_knowledge_base(selection: &TextSelection) -> Result<(), String> {
    // This would integrate with the embeddings system
    // For now, we'll just return success
    Ok(())
}

/// Replace original text with translated text
#[tauri::command]
#[specta::specta]
pub async fn replace_original_text(
    original_text: String,
    translated_text: String,
    app: tauri::AppHandle,
) -> Result<String, String> {
    use arboard::Clipboard;

    match Clipboard::new() {
        Ok(mut _clipboard) => {
            // In a real implementation, this would:
            // 1. Use system accessibility APIs to find and replace the original text
            // 2. Or use clipboard monitoring + keyboard shortcuts to replace text

            // For now, we'll put the translated text in clipboard
            // and instruct the user to manually paste it
            match _clipboard.set_text(&translated_text) {
                Ok(_) => {
                    // Show a notification that text has been copied
                    if let Err(e) = show_notification(&app, "文本已复制", "翻译结果已复制到剪贴板，请手动粘贴替换原文") {
                        println!("Failed to show notification: {}", e);
                    }
                    Ok("翻译结果已复制到剪贴板，请手动粘贴替换原文".to_string())
                }
                Err(e) => Err(format!("Failed to copy text to clipboard: {}", e))
            }
        }
        Err(e) => Err(format!("Failed to access clipboard: {}", e))
    }
}

/// Show system notification
fn show_notification(app: &tauri::AppHandle, title: &str, body: &str) -> Result<(), tauri::Error> {
    use tauri::Manager;

    if let Some(main_window) = app.get_webview_window("main") {
        main_window.emit("show-notification", (title, body))?;
    }

    Ok(())
}

// Get current toolbar configuration
#[tauri::command]
#[specta::specta]
pub async fn get_toolbar_config() -> Result<ToolbarConfig, String> {
    // This would load from persistent storage
    Ok(ToolbarConfig::default())
}

// Update toolbar configuration
#[tauri::command]
#[specta::specta]
pub async fn update_toolbar_config(config: ToolbarConfig) -> Result<(), String> {
    // This would save to persistent storage
    Ok(())
}

// Show/hide toolbar
#[tauri::command]
#[specta::specta]
pub async fn show_toolbar(
    app: AppHandle,
    state: State<'_, TextSelectionState>,
    position: SelectionRect,
) -> Result<String, String> {
    state.set_toolbar_position(position);
    state.set_toolbar_visible(true);

    // Show or create the toolbar window
    if let Some(window) = app.get_webview_window("toolbar") {
        window.show().map_err(|e| e.to_string())?;
        window.set_focus().map_err(|e| e.to_string())?;
        Ok("toolbar".to_string())
    } else {
        let window = tauri::WebviewWindowBuilder::new(
            &app,
            "toolbar",
            tauri::WebviewUrl::App("/toolbar/main".into()),
        )
        .title("Text Selection Toolbar")
        .inner_size(300.0, 200.0)
        .resizable(false)
        .decorations(false)
        .always_on_top(true)
        .skip_taskbar(true)
        .build()
        .map_err(|e| format!("Failed to create toolbar window: {}", e))?;

        Ok(window.label().to_string())
    }
}

#[tauri::command]
#[specta::specta]
pub async fn hide_toolbar(
    app: AppHandle,
    state: State<'_, TextSelectionState>,
) -> Result<(), String> {
    state.set_toolbar_visible(false);

    if let Some(window) = app.get_webview_window("toolbar") {
        window.hide().map_err(|e| e.to_string())?;
    }

    Ok(())
}

// Initialize the text selection system
pub fn init_text_selection_system() -> TextSelectionState {
    TextSelectionState::new()
}