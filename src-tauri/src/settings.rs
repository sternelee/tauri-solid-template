use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tauri::{AppHandle, Manager, State};
use tokio::sync::RwLock;

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct SettingsData {
    pub language: String,
    pub theme: String, // "light", "dark", "auto"
    pub auto_start: bool,
    pub shortcuts: HashMap<String, String>,
    pub ai_provider: AIProviderConfig,
    pub notifications: bool,
    pub system_tray: bool,
    pub developer_mode: bool,
    pub log_level: String,
    pub text_selection_toolbar: TextSelectionToolbarConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct AIProviderConfig {
    pub provider: String,
    pub api_key: String,
    pub model: String,
    pub temperature: f64,
    pub max_tokens: u32,
    pub base_url: Option<String>,
    pub organization: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct TextSelectionToolbarConfig {
    pub enabled: bool,
    pub shortcut: String,
    pub auto_hide: bool,
    pub auto_hide_delay: u64,
    pub opacity: f64,
    pub position: String, // "cursor" or "center"
    pub enabled_actions: Vec<String>,
}

impl Default for SettingsData {
    fn default() -> Self {
        let mut shortcuts = HashMap::new();
        shortcuts.insert("toggleWindow".to_string(), "CmdOrCtrl+K".to_string());
        shortcuts.insert("openSettings".to_string(), "CmdOrCtrl+,".to_string());
        shortcuts.insert("quitApp".to_string(), "CmdOrCtrl+Q".to_string());
        shortcuts.insert("focusSearch".to_string(), "CmdOrCtrl+F".to_string());
        shortcuts.insert("textSelectionToolbar".to_string(), "CmdOrCtrl+Shift+Space".to_string());

        Self {
            language: "zh-CN".to_string(),
            theme: "auto".to_string(),
            auto_start: false,
            shortcuts,
            ai_provider: AIProviderConfig {
                provider: "OpenAI".to_string(),
                api_key: String::new(),
                model: "gpt-4o".to_string(),
                temperature: 0.7,
                max_tokens: 4000,
                base_url: None,
                organization: None,
            },
            notifications: true,
            system_tray: true,
            developer_mode: false,
            log_level: "info".to_string(),
            text_selection_toolbar: TextSelectionToolbarConfig {
                enabled: true,
                shortcut: "CmdOrCtrl+Shift+Space".to_string(),
                auto_hide: true,
                auto_hide_delay: 5000,
                opacity: 0.95,
                position: "cursor".to_string(),
                enabled_actions: vec![
                    "translate".to_string(),
                    "polish".to_string(),
                    "add_to_knowledge".to_string(),
                    "search".to_string(),
                    "chat_with_file".to_string(),
                    "open_file".to_string(),
                ],
            },
        }
    }
}

pub struct SettingsState(pub RwLock<SettingsData>);

impl SettingsState {
    pub fn new() -> Self {
        Self(RwLock::new(SettingsData::default()))
    }

    pub async fn load_settings(&self) -> Result<SettingsData, Box<dyn std::error::Error + Send + Sync>> {
        // Try to load from app data directory
        let settings = self.0.read().await;
        Ok(settings.clone())
    }

    pub async fn save_settings(&self, settings: SettingsData) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let mut current_settings = self.0.write().await;
        *current_settings = settings;
        Ok(())
    }

    pub async fn update_theme(&self, theme: String) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let mut settings = self.0.write().await;
        settings.theme = theme;
        Ok(())
    }

    pub async fn update_language(&self, language: String) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let mut settings = self.0.write().await;
        settings.language = language;
        Ok(())
    }

    pub async fn update_ai_provider(&self, config: AIProviderConfig) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let mut settings = self.0.write().await;
        settings.ai_provider = config;
        Ok(())
    }

    pub async fn update_shortcut(&self, action: String, shortcut: String) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let mut settings = self.0.write().await;
        settings.shortcuts.insert(action, shortcut);
        Ok(())
    }

    pub async fn get_ai_provider(&self) -> AIProviderConfig {
        let settings = self.0.read().await;
        settings.ai_provider.clone()
    }

    pub async fn get_theme(&self) -> String {
        let settings = self.0.read().await;
        settings.theme.clone()
    }

    pub async fn get_language(&self) -> String {
        let settings = self.0.read().await;
        settings.language.clone()
    }
}

// Tauri commands
#[tauri::command]
pub async fn get_settings(state: State<'_, SettingsState>) -> Result<SettingsData, String> {
    state.load_settings().await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn save_settings(state: State<'_, SettingsState>, settings: SettingsData) -> Result<(), String> {
    state.save_settings(settings).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn update_theme(state: State<'_, SettingsState>, theme: String) -> Result<(), String> {
    state.update_theme(theme).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn update_language(state: State<'_, SettingsState>, language: String) -> Result<(), String> {
    state.update_language(language).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn update_ai_provider_config(state: State<'_, SettingsState>, config: AIProviderConfig) -> Result<(), String> {
    state.update_ai_provider(config).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_ai_provider_config(state: State<'_, SettingsState>) -> Result<AIProviderConfig, String> {
    Ok(state.get_ai_provider().await)
}

#[tauri::command]
pub async fn update_shortcut(state: State<'_, SettingsState>, action: String, shortcut: String) -> Result<(), String> {
    state.update_shortcut(action, shortcut).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn reset_to_defaults(state: State<'_, SettingsState>) -> Result<(), String> {
    let default_settings = SettingsData::default();
    state.save_settings(default_settings).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn reset_settings(state: State<'_, SettingsState>) -> Result<SettingsData, String> {
    let default_settings = SettingsData::default();
    state.save_settings(default_settings.clone()).await.map_err(|e| e.to_string())?;
    Ok(default_settings)
}

#[tauri::command]
pub async fn toggle_auto_start(enable: bool) -> Result<(), String> {
    // TODO: Implement auto-start functionality
    // This would use platform-specific APIs to add/remove the app from startup
    println!("Auto-start {}: {}", if enable { "enabled" } else { "disabled" }, "not implemented yet");
    Ok(())
}

#[tauri::command]
pub async fn open_settings_window(_app: AppHandle) -> Result<(), String> {
    // Simplified implementation for now
    // In a real implementation, you would create a new window or use tauri-plugin-window
    println!("Settings window requested - showing in main window for now");
    Ok(())
}

#[tauri::command]
pub async fn get_available_languages() -> Result<Vec<LanguageInfo>, String> {
    Ok(vec![
        LanguageInfo {
            code: "zh-CN".to_string(),
            name: "简体中文".to_string(),
            native_name: "简体中文".to_string(),
        },
        LanguageInfo {
            code: "en-US".to_string(),
            name: "English".to_string(),
            native_name: "English".to_string(),
        },
        LanguageInfo {
            code: "ja-JP".to_string(),
            name: "Japanese".to_string(),
            native_name: "日本語".to_string(),
        },
        LanguageInfo {
            code: "ko-KR".to_string(),
            name: "Korean".to_string(),
            native_name: "한국어".to_string(),
        },
    ])
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct LanguageInfo {
    pub code: String,
    pub name: String,
    pub native_name: String,
}

#[tauri::command]
pub async fn get_available_themes() -> Result<Vec<ThemeInfo>, String> {
    Ok(vec![
        ThemeInfo {
            value: "light".to_string(),
            name: "Light".to_string(),
            description: "明亮主题".to_string(),
        },
        ThemeInfo {
            value: "dark".to_string(),
            name: "Dark".to_string(),
            description: "暗黑主题".to_string(),
        },
        ThemeInfo {
            value: "auto".to_string(),
            name: "Auto".to_string(),
            description: "跟随系统".to_string(),
        },
    ])
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct ThemeInfo {
    pub value: String,
    pub name: String,
    pub description: String,
}

#[tauri::command]
pub async fn export_settings(state: State<'_, SettingsState>) -> Result<String, String> {
    let settings = state.load_settings().await.map_err(|e| e.to_string())?;
    serde_json::to_string_pretty(&settings).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn import_settings(state: State<'_, SettingsState>, settings_json: String) -> Result<(), String> {
    let settings: SettingsData = serde_json::from_str(&settings_json).map_err(|e| e.to_string())?;
    state.save_settings(settings).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn clear_cache() -> Result<String, String> {
    // TODO: Implement cache clearing functionality
    // This would clear application cache, temporary files, etc.
    Ok("Cache cleared successfully".to_string())
}