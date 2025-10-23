import { createSignal, onMount, For, Show } from "solid-js";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { invoke } from "@tauri-apps/api/core";
import McpManager from "../components/McpManager";

interface SettingsData {
  language: string;
  theme: 'light' | 'dark' | 'auto';
  autoStart: boolean;
  shortcuts: Record<string, string>;
  aiProvider: {
    provider: string;
    apiKey: string;
    model: string;
    temperature: number;
    maxTokens: number;
  };
  notifications: boolean;
  systemTray: boolean;
  textSelectionToolbar: {
    enabled: boolean;
    shortcut: string;
    autoHide: boolean;
    autoHideDelay: number;
    opacity: number;
    position: 'cursor' | 'center';
    enabledActions: string[];
  };
}

const availableLanguages = [
  { code: 'zh-CN', name: '简体中文' },
  { code: 'en-US', name: 'English' },
  { code: 'ja-JP', name: '日本語' },
  { code: 'ko-KR', name: '한국어' },
];

const availableThemes = [
  { value: 'light', name: 'Light' },
  { value: 'dark', name: 'Dark' },
  { value: 'auto', name: 'Auto (System)' },
];

const defaultShortcuts = {
  'toggleWindow': 'CmdOrCtrl+K',
  'openSettings': 'CmdOrCtrl+,',
  'quitApp': 'CmdOrCtrl+Q',
  'focusSearch': 'CmdOrCtrl+F',
  'textSelectionToolbar': 'CmdOrCtrl+Shift+Space',
};

export default function SettingsPage() {
  const [settings, setSettings] = createSignal<SettingsData>({
    language: 'zh-CN',
    theme: 'auto',
    autoStart: false,
    shortcuts: defaultShortcuts,
    aiProvider: {
      provider: 'OpenAI',
      apiKey: '',
      model: 'gpt-4o',
      temperature: 0.7,
      maxTokens: 4000,
    },
    notifications: true,
    systemTray: true,
    textSelectionToolbar: {
      enabled: true,
      shortcut: 'CmdOrCtrl+Shift+Space',
      autoHide: true,
      autoHideDelay: 5000,
      opacity: 0.95,
      position: 'cursor',
      enabledActions: ['translate', 'polish', 'add_to_knowledge', 'search', 'chat_with_file', 'open_file'],
    },
  });

  const [activeTab, setActiveTab] = createSignal('general');
  const [isSaving, setIsSaving] = createSignal(false);
  const [saveStatus, setSaveStatus] = createSignal<'idle' | 'success' | 'error'>('idle');

  const tabs = [
    { id: 'general', name: '通用设置', icon: '⚙️' },
    { id: 'ai', name: 'AI 配置', icon: '🤖' },
    { id: 'mcp', name: 'MCP 服务器', icon: '🔌' },
    { id: 'toolbar', name: '划词工具栏', icon: '📝' },
    { id: 'shortcuts', name: '快捷键', icon: '⌨️' },
    { id: 'advanced', name: '高级设置', icon: '🔧' },
  ];

  onMount(async () => {
    await loadSettings();
  });

  const loadSettings = async () => {
    try {
      const savedSettings = await invoke<SettingsData>('get_settings');
      if (savedSettings) {
        setSettings(savedSettings);
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  };

  const saveSettings = async () => {
    setIsSaving(true);
    setSaveStatus('idle');

    try {
      await invoke('save_settings', { settings: settings() });
      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (error) {
      console.error('Failed to save settings:', error);
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } finally {
      setIsSaving(false);
    }
  };

  const updateSetting = <K extends keyof SettingsData>(
    key: K,
    value: SettingsData[K]
  ) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const updateAIProvider = (field: keyof SettingsData['aiProvider'], value: any) => {
    setSettings(prev => ({
      ...prev,
      aiProvider: {
        ...prev.aiProvider,
        [field]: value
      }
    }));
  };

  const updateShortcut = (action: string, value: string) => {
    setSettings(prev => ({
      ...prev,
      shortcuts: {
        ...prev.shortcuts,
        [action]: value
      }
    }));
  };

  const updateToolbarSetting = (field: keyof SettingsData['textSelectionToolbar'], value: any) => {
    setSettings(prev => ({
      ...prev,
      textSelectionToolbar: {
        ...prev.textSelectionToolbar,
        [field]: value
      }
    }));
  };

  const closeWindow = async () => {
    const window = getCurrentWindow();
    await window.close();
  };

  const resetToDefaults = async () => {
    if (confirm('确定要重置所有设置到默认值吗？')) {
      const defaultSettings: SettingsData = {
        language: 'zh-CN',
        theme: 'auto',
        autoStart: false,
        shortcuts: defaultShortcuts,
        aiProvider: {
          provider: 'OpenAI',
          apiKey: '',
          model: 'gpt-4o',
          temperature: 0.7,
          maxTokens: 4000,
        },
        notifications: true,
        systemTray: true,
        textSelectionToolbar: {
          enabled: true,
          shortcut: 'CmdOrCtrl+Shift+Space',
          autoHide: true,
          autoHideDelay: 5000,
          opacity: 0.95,
          position: 'cursor',
          enabledActions: ['translate', 'polish', 'add_to_knowledge', 'search', 'chat_with_file', 'open_file'],
        },
      };
      setSettings(defaultSettings);
      await saveSettings();
    }
  };

  return (
    <div class="settings-container">
      {/* Header */}
      <header class="settings-header">
        <div class="settings-title">
          <h1>设置</h1>
          <p class="settings-subtitle">配置你的应用程序偏好</p>
        </div>
        <div class="settings-actions">
          <button
            class="btn btn-ghost"
            onClick={resetToDefaults}
          >
            重置默认
          </button>
          <button
            class="btn btn-primary"
            onClick={saveSettings}
            disabled={isSaving()}
          >
            {isSaving() ? '保存中...' : '保存设置'}
          </button>
          <button class="btn btn-ghost" onClick={closeWindow}>
            ✕
          </button>
        </div>
      </header>

      {/* Save Status */}
      <Show when={saveStatus() !== 'idle'}>
        <div class={`save-status save-status-${saveStatus()}`}>
          {saveStatus() === 'success' ? '✅ 设置已保存' : '❌ 保存失败'}
        </div>
      </Show>

      <div class="settings-content">
        {/* Sidebar */}
        <nav class="settings-sidebar">
          <For each={tabs}>
            {tab => (
              <button
                class={`sidebar-item ${activeTab() === tab.id ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                <span class="sidebar-icon">{tab.icon}</span>
                <span class="sidebar-label">{tab.name}</span>
              </button>
            )}
          </For>
        </nav>

        {/* Main Content */}
        <main class="settings-main">
          {/* General Settings */}
          <Show when={activeTab() === 'general'}>
            <div class="settings-section">
              <h2>通用设置</h2>

              {/* Language */}
              <div class="setting-item">
                <label class="setting-label">
                  <span class="setting-name">语言</span>
                  <span class="setting-description">选择应用程序界面语言</span>
                </label>
                <select
                  class="setting-select"
                  value={settings().language}
                  onChange={(e) => updateSetting('language', e.target.value)}
                >
                  <For each={availableLanguages}>
                    {lang => (
                      <option value={lang.code}>{lang.name}</option>
                    )}
                  </For>
                </select>
              </div>

              {/* Theme */}
              <div class="setting-item">
                <label class="setting-label">
                  <span class="setting-name">主题</span>
                  <span class="setting-description">选择界面主题样式</span>
                </label>
                <div class="theme-selector">
                  <For each={availableThemes}>
                    {theme => (
                      <button
                        class={`theme-option ${settings().theme === theme.value ? 'active' : ''}`}
                        onClick={() => updateSetting('theme', theme.value as any)}
                      >
                        {theme.name}
                      </button>
                    )}
                  </For>
                </div>
              </div>

              {/* Auto Start */}
              <div class="setting-item">
                <label class="setting-label">
                  <span class="setting-name">开机自启</span>
                  <span class="setting-description">系统启动时自动运行应用程序</span>
                </label>
                <label class="toggle-switch">
                  <input
                    type="checkbox"
                    checked={settings().autoStart}
                    onChange={(e) => updateSetting('autoStart', e.target.checked)}
                  />
                  <span class="toggle-slider"></span>
                </label>
              </div>

              {/* Notifications */}
              <div class="setting-item">
                <label class="setting-label">
                  <span class="setting-name">通知</span>
                  <span class="setting-description">启用系统通知</span>
                </label>
                <label class="toggle-switch">
                  <input
                    type="checkbox"
                    checked={settings().notifications}
                    onChange={(e) => updateSetting('notifications', e.target.checked)}
                  />
                  <span class="toggle-slider"></span>
                </label>
              </div>

              {/* System Tray */}
              <div class="setting-item">
                <label class="setting-label">
                  <span class="setting-name">系统托盘</span>
                  <span class="setting-description">显示系统托盘图标</span>
                </label>
                <label class="toggle-switch">
                  <input
                    type="checkbox"
                    checked={settings().systemTray}
                    onChange={(e) => updateSetting('systemTray', e.target.checked)}
                  />
                  <span class="toggle-slider"></span>
                </label>
              </div>
            </div>
          </Show>

          {/* AI Provider Settings */}
          <Show when={activeTab() === 'ai'}>
            <div class="settings-section">
              <h2>AI 配置</h2>

              {/* Provider Selection */}
              <div class="setting-item">
                <label class="setting-label">
                  <span class="setting-name">AI Provider</span>
                  <span class="setting-description">选择你的 AI 服务提供商</span>
                </label>
                <select
                  class="setting-select"
                  value={settings().aiProvider.provider}
                  onChange={(e) => updateAIProvider('provider', e.target.value)}
                >
                  <option value="OpenAI">OpenAI</option>
                  <option value="Anthropic">Anthropic (Claude)</option>
                  <option value="Google">Google Gemini</option>
                  <option value="Groq">Groq</option>
                  <option value="Cohere">Cohere</option>
                  <option value="Mistral">Mistral</option>
                  <option value="TogetherAI">Together AI</option>
                  <option value="HuggingFace">Hugging Face</option>
                </select>
              </div>

              {/* API Key */}
              <div class="setting-item">
                <label class="setting-label">
                  <span class="setting-name">API Key</span>
                  <span class="setting-description">你的 API 密钥</span>
                </label>
                <div class="api-key-input">
                  <input
                    type="password"
                    class="setting-input"
                    placeholder="输入你的 API Key"
                    value={settings().aiProvider.apiKey}
                    onChange={(e) => updateAIProvider('apiKey', e.target.value)}
                  />
                  <button
                    class="btn btn-ghost btn-sm"
                    onClick={() => {
                      // Open API key URL in default browser
                      invoke('open_url', { url: 'https://platform.openai.com/api-keys' });
                    }}
                  >
                    获取 API Key
                  </button>
                </div>
              </div>

              {/* Model Selection */}
              <div class="setting-item">
                <label class="setting-label">
                  <span class="setting-name">模型</span>
                  <span class="setting-description">选择要使用的 AI 模型</span>
                </label>
                <select
                  class="setting-select"
                  value={settings().aiProvider.model}
                  onChange={(e) => updateAIProvider('model', e.target.value)}
                >
                  <option value="gpt-4o">GPT-4o</option>
                  <option value="gpt-4o-mini">GPT-4o Mini</option>
                  <option value="gpt-4-turbo">GPT-4 Turbo</option>
                  <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                  <option value="claude-3-5-sonnet-20240620">Claude 3.5 Sonnet</option>
                  <option value="claude-3-opus-20240229">Claude 3 Opus</option>
                  <option value="claude-3-sonnet-20240229">Claude 3 Sonnet</option>
                  <option value="claude-3-haiku-20240307">Claude 3 Haiku</option>
                  <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
                  <option value="gemini-1.5-flash">Gemini 1.5 Flash</option>
                </select>
              </div>

              {/* Temperature */}
              <div class="setting-item">
                <label class="setting-label">
                  <span class="setting-name">Temperature</span>
                  <span class="setting-description">控制回答的随机性 (0.0-2.0)</span>
                </label>
                <div class="slider-container">
                  <input
                    type="range"
                    class="setting-slider"
                    min="0"
                    max="2"
                    step="0.1"
                    value={settings().aiProvider.temperature}
                    onInput={(e) => updateAIProvider('temperature', parseFloat(e.target.value))}
                  />
                  <span class="slider-value">{settings().aiProvider.temperature}</span>
                </div>
              </div>

              {/* Max Tokens */}
              <div class="setting-item">
                <label class="setting-label">
                  <span class="setting-name">最大 Tokens</span>
                  <span class="setting-description">回答的最大长度</span>
                </label>
                <input
                  type="number"
                  class="setting-input"
                  min="100"
                  max="8000"
                  value={settings().aiProvider.maxTokens}
                  onChange={(e) => updateAIProvider('maxTokens', parseInt(e.target.value))}
                />
              </div>
            </div>
          </Show>

          {/* MCP Settings */}
          <Show when={activeTab() === 'mcp'}>
            <McpManager />
          </Show>

          {/* Text Selection Toolbar Settings */}
          <Show when={activeTab() === 'toolbar'}>
            <div class="settings-section">
              <h2>划词工具栏设置</h2>

              {/* Enable Toolbar */}
              <div class="setting-item">
                <label class="setting-label">
                  <span class="setting-name">启用划词工具栏</span>
                  <span class="setting-description">选择文本时显示工具栏</span>
                </label>
                <label class="toggle-switch">
                  <input
                    type="checkbox"
                    checked={settings().textSelectionToolbar.enabled}
                    onChange={(e) => updateToolbarSetting('enabled', e.target.checked)}
                  />
                  <span class="toggle-slider"></span>
                </label>
              </div>

              {/* Toolbar Shortcut */}
              <div class="setting-item">
                <label class="setting-label">
                  <span class="setting-name">快捷键</span>
                  <span class="setting-description">显示划词工具栏的快捷键</span>
                </label>
                <input
                  type="text"
                  class="setting-input shortcut-input"
                  value={settings().textSelectionToolbar.shortcut}
                  onChange={(e) => updateToolbarSetting('shortcut', e.target.value)}
                  placeholder="例如: CmdOrCtrl+Shift+Space"
                />
              </div>

              {/* Auto Hide */}
              <div class="setting-item">
                <label class="setting-label">
                  <span class="setting-name">自动隐藏</span>
                  <span class="setting-description">工具栏在无操作后自动隐藏</span>
                </label>
                <label class="toggle-switch">
                  <input
                    type="checkbox"
                    checked={settings().textSelectionToolbar.autoHide}
                    onChange={(e) => updateToolbarSetting('autoHide', e.target.checked)}
                  />
                  <span class="toggle-slider"></span>
                </label>
              </div>

              {/* Auto Hide Delay */}
              <div class="setting-item">
                <label class="setting-label">
                  <span class="setting-name">自动隐藏延迟</span>
                  <span class="setting-description">自动隐藏的延迟时间（毫秒）</span>
                </label>
                <div class="slider-container">
                  <input
                    type="range"
                    class="setting-slider"
                    min="1000"
                    max="10000"
                    step="500"
                    value={settings().textSelectionToolbar.autoHideDelay}
                    onInput={(e) => updateToolbarSetting('autoHideDelay', parseInt(e.target.value))}
                  />
                  <span class="slider-value">{settings().textSelectionToolbar.autoHideDelay}ms</span>
                </div>
              </div>

              {/* Opacity */}
              <div class="setting-item">
                <label class="setting-label">
                  <span class="setting-name">透明度</span>
                  <span class="setting-description">工具栏的透明度</span>
                </label>
                <div class="slider-container">
                  <input
                    type="range"
                    class="setting-slider"
                    min="0.5"
                    max="1.0"
                    step="0.05"
                    value={settings().textSelectionToolbar.opacity}
                    onInput={(e) => updateToolbarSetting('opacity', parseFloat(e.target.value))}
                  />
                  <span class="slider-value">{Math.round(settings().textSelectionToolbar.opacity * 100)}%</span>
                </div>
              </div>

              {/* Position */}
              <div class="setting-item">
                <label class="setting-label">
                  <span class="setting-name">显示位置</span>
                  <span class="setting-description">工具栏显示的位置</span>
                </label>
                <div class="theme-selector">
                  <button
                    class={`theme-option ${settings().textSelectionToolbar.position === 'cursor' ? 'active' : ''}`}
                    onClick={() => updateToolbarSetting('position', 'cursor')}
                  >
                    跟随光标
                  </button>
                  <button
                    class={`theme-option ${settings().textSelectionToolbar.position === 'center' ? 'active' : ''}`}
                    onClick={() => updateToolbarSetting('position', 'center')}
                  >
                    屏幕中央
                  </button>
                </div>
              </div>

              {/* Enabled Actions */}
              <div class="setting-item">
                <label class="setting-label">
                  <span class="setting-name">可用操作</span>
                  <span class="setting-description">选择工具栏中显示的操作</span>
                </label>
                <div style={{ display: 'flex', 'flex-direction': 'column', gap: '8px', 'min-width': '250px' }}>
                  {[
                    { id: 'translate', name: '翻译', description: '翻译选中的文本' },
                    { id: 'polish', name: '润色', description: '优化和润色文本' },
                    { id: 'add_to_knowledge', name: '加入知识库', description: '将文本添加到知识库' },
                    { id: 'search', name: '搜索', description: '搜索相关信息' },
                    { id: 'chat_with_file', name: 'Chat with File', description: '与文件内容对话' },
                    { id: 'open_file', name: '打开文件', description: '打开文件路径' },
                  ].map((action) => (
                    <label
                      key={action.id}
                      style={{
                        display: 'flex',
                        'align-items': 'center',
                        gap: '8px',
                        padding: '8px 12px',
                        background: settings().textSelectionToolbar.enabledActions.includes(action.id) ? 'var(--raycast-accent)' : 'transparent',
                        border: '1px solid var(--raycast-border)',
                        'border-radius': '6px',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={settings().textSelectionToolbar.enabledActions.includes(action.id)}
                        onChange={(e) => {
                          const currentActions = settings().textSelectionToolbar.enabledActions;
                          const newActions = e.target.checked
                            ? [...currentActions, action.id]
                            : currentActions.filter(id => id !== action.id);
                          updateToolbarSetting('enabledActions', newActions);
                        }}
                        style={{ margin: 0 }}
                      />
                      <div style={{ flex: 1 }}>
                        <div style={{ 'font-weight': '500', 'font-size': '14px' }}>{action.name}</div>
                        <div style={{ 'font-size': '12px', color: 'var(--raycast-muted)' }}>{action.description}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </Show>

          {/* Shortcuts Settings */}
          <Show when={activeTab() === 'shortcuts'}>
            <div class="settings-section">
              <h2>快捷键设置</h2>
              <div class="shortcuts-grid">
                <For each={Object.entries(settings().shortcuts)}>
                  {([action, shortcut]) => (
                    <div class="setting-item">
                      <label class="setting-label">
                        <span class="setting-name">
                          {action === 'toggleWindow' ? '切换窗口' :
                           action === 'openSettings' ? '打开设置' :
                           action === 'quitApp' ? '退出应用' :
                           action === 'focusSearch' ? '聚焦搜索' :
                           action === 'textSelectionToolbar' ? '划词工具栏' : action}
                        </span>
                        <span class="setting-description">自定义快捷键</span>
                      </label>
                      <input
                        type="text"
                        class="setting-input shortcut-input"
                        value={shortcut}
                        onChange={(e) => updateShortcut(action, e.target.value)}
                        placeholder="例如: CmdOrCtrl+K"
                      />
                    </div>
                  )}
                </For>
              </div>
            </div>
          </Show>

          {/* Advanced Settings */}
          <Show when={activeTab() === 'advanced'}>
            <div class="settings-section">
              <h2>高级设置</h2>

              <div class="setting-item">
                <label class="setting-label">
                  <span class="setting-name">开发者模式</span>
                  <span class="setting-description">启用开发者工具和调试功能</span>
                </label>
                <label class="toggle-switch">
                  <input type="checkbox" />
                  <span class="toggle-slider"></span>
                </label>
              </div>

              <div class="setting-item">
                <label class="setting-label">
                  <span class="setting-name">日志级别</span>
                  <span class="setting-description">设置应用程序日志详细程度</span>
                </label>
                <select class="setting-select">
                  <option value="error">Error</option>
                  <option value="warn">Warning</option>
                  <option value="info">Info</option>
                  <option value="debug">Debug</option>
                </select>
              </div>

              <div class="setting-item">
                <label class="setting-label">
                  <span class="setting-name">缓存清理</span>
                  <span class="setting-description">清理应用程序缓存数据</span>
                </label>
                <button class="btn btn-secondary">
                  清理缓存
                </button>
              </div>

              <div class="setting-item">
                <label class="setting-label">
                  <span class="setting-name">重置应用</span>
                  <span class="setting-description">将所有设置重置为默认值</span>
                </label>
                <button
                  class="btn btn-danger"
                  onClick={resetToDefaults}
                >
                  重置所有设置
                </button>
              </div>
            </div>
          </Show>
        </main>
      </div>

      <style jsx>{`
        .settings-container {
          display: flex;
          flex-direction: column;
          height: 100vh;
          background: var(--raycast-background);
          color: var(--raycast-foreground);
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        .settings-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 20px 24px;
          border-bottom: 1px solid var(--raycast-border);
          background: var(--raycast-surface);
        }

        .settings-title h1 {
          margin: 0;
          font-size: 24px;
          font-weight: 600;
          color: var(--raycast-foreground);
        }

        .settings-subtitle {
          margin: 4px 0 0 0;
          color: var(--raycast-muted);
          font-size: 14px;
        }

        .settings-actions {
          display: flex;
          gap: 8px;
          align-items: center;
        }

        .save-status {
          position: fixed;
          top: 80px;
          right: 20px;
          padding: 12px 16px;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 500;
          z-index: 1000;
          animation: slideIn 0.3s ease;
        }

        .save-status-success {
          background: var(--raycast-success);
          color: white;
        }

        .save-status-error {
          background: var(--raycast-destructive);
          color: white;
        }

        @keyframes slideIn {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }

        .settings-content {
          display: flex;
          flex: 1;
          overflow: hidden;
        }

        .settings-sidebar {
          width: 200px;
          background: var(--raycast-surface);
          border-right: 1px solid var(--raycast-border);
          padding: 16px 0;
        }

        .sidebar-item {
          display: flex;
          align-items: center;
          gap: 12px;
          width: 100%;
          padding: 12px 20px;
          background: transparent;
          border: none;
          color: var(--raycast-muted);
          font-size: 14px;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .sidebar-item:hover {
          background: var(--raycast-accent);
          color: var(--raycast-foreground);
        }

        .sidebar-item.active {
          background: var(--raycast-accent);
          color: var(--raycast-accent-foreground);
          font-weight: 500;
        }

        .sidebar-icon {
          font-size: 16px;
        }

        .sidebar-label {
          text-align: left;
        }

        .settings-main {
          flex: 1;
          overflow-y: auto;
          padding: 24px;
        }

        .settings-section {
          max-width: 800px;
        }

        .settings-section h2 {
          margin: 0 0 24px 0;
          font-size: 20px;
          font-weight: 600;
          color: var(--raycast-foreground);
        }

        .setting-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 0;
          border-bottom: 1px solid var(--raycast-border);
        }

        .setting-item:last-child {
          border-bottom: none;
        }

        .setting-label {
          flex: 1;
          margin-right: 16px;
        }

        .setting-name {
          display: block;
          font-weight: 500;
          color: var(--raycast-foreground);
          margin-bottom: 4px;
        }

        .setting-description {
          display: block;
          font-size: 13px;
          color: var(--raycast-muted);
        }

        .setting-select,
        .setting-input {
          padding: 8px 12px;
          border: 1px solid var(--raycast-border);
          border-radius: 6px;
          background: var(--raycast-input);
          color: var(--raycast-foreground);
          font-size: 14px;
          min-width: 200px;
        }

        .setting-select:focus,
        .setting-input:focus {
          outline: none;
          border-color: var(--raycast-accent-foreground);
        }

        .theme-selector {
          display: flex;
          gap: 8px;
        }

        .theme-option {
          padding: 8px 16px;
          border: 1px solid var(--raycast-border);
          border-radius: 6px;
          background: var(--raycast-input);
          color: var(--raycast-foreground);
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .theme-option:hover {
          background: var(--raycast-accent);
        }

        .theme-option.active {
          background: var(--raycast-accent-foreground);
          color: var(--raycast-accent);
          border-color: var(--raycast-accent-foreground);
        }

        .toggle-switch {
          position: relative;
          display: inline-block;
          width: 44px;
          height: 24px;
        }

        .toggle-switch input {
          opacity: 0;
          width: 0;
          height: 0;
        }

        .toggle-slider {
          position: absolute;
          cursor: pointer;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: var(--raycast-border);
          transition: 0.3s;
          border-radius: 24px;
        }

        .toggle-slider:before {
          position: absolute;
          content: "";
          height: 18px;
          width: 18px;
          left: 3px;
          bottom: 3px;
          background-color: white;
          transition: 0.3s;
          border-radius: 50%;
        }

        input:checked + .toggle-slider {
          background-color: var(--raycast-accent-foreground);
        }

        input:checked + .toggle-slider:before {
          transform: translateX(20px);
        }

        .api-key-input {
          display: flex;
          gap: 8px;
          align-items: center;
        }

        .api-key-input .setting-input {
          flex: 1;
        }

        .slider-container {
          display: flex;
          align-items: center;
          gap: 12px;
          min-width: 200px;
        }

        .setting-slider {
          flex: 1;
          height: 4px;
          border-radius: 2px;
          background: var(--raycast-border);
          outline: none;
          -webkit-appearance: none;
        }

        .setting-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: var(--raycast-accent-foreground);
          cursor: pointer;
        }

        .slider-value {
          min-width: 40px;
          text-align: center;
          font-size: 14px;
          color: var(--raycast-foreground);
        }

        .shortcuts-grid {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .shortcut-input {
          min-width: 200px;
          font-family: monospace;
        }

        .btn {
          padding: 8px 16px;
          border: none;
          border-radius: 6px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .btn-primary {
          background: var(--raycast-accent-foreground);
          color: var(--raycast-accent);
        }

        .btn-primary:hover:not(:disabled) {
          opacity: 0.9;
        }

        .btn-secondary {
          background: var(--raycast-accent);
          color: var(--raycast-accent-foreground);
        }

        .btn-secondary:hover {
          opacity: 0.8;
        }

        .btn-danger {
          background: var(--raycast-destructive);
          color: white;
        }

        .btn-danger:hover {
          opacity: 0.9;
        }

        .btn-ghost {
          background: transparent;
          color: var(--raycast-foreground);
        }

        .btn-ghost:hover {
          background: var(--raycast-accent);
        }

        .btn-sm {
          padding: 6px 12px;
          font-size: 12px;
        }
      `}</style>
    </div>
  );
}