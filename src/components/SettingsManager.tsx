import { createSignal, onMount, onCleanup } from 'solid-js';
import { invoke } from '@tauri-apps/api/core';
import { listen, UnlistenFn } from '@tauri-apps/api/event';

export interface SettingsData {
  language: string;
  theme: 'light' | 'dark' | 'auto';
  auto_start: boolean;
  shortcuts: Record<string, string>;
  ai_provider: {
    provider: string;
    api_key: string;
    model: string;
    temperature: number;
    max_tokens: number;
    base_url?: string;
    organization?: string;
  };
  notifications: boolean;
  system_tray: boolean;
  developer_mode: boolean;
  log_level: string;
}

export interface LanguageInfo {
  code: string;
  name: string;
  native_name: string;
}

export interface ThemeInfo {
  value: string;
  name: string;
  description: string;
}

export function useSettings() {
  const [settings, setSettings] = createSignal<SettingsData>({
    language: 'zh-CN',
    theme: 'auto',
    auto_start: false,
    shortcuts: {
      toggleWindow: 'CmdOrCtrl+K',
      openSettings: 'CmdOrCtrl+,',
      quitApp: 'CmdOrCtrl+Q',
      focusSearch: 'CmdOrCtrl+F',
    },
    ai_provider: {
      provider: 'OpenAI',
      api_key: '',
      model: 'gpt-4o',
      temperature: 0.7,
      max_tokens: 4000,
    },
    notifications: true,
    system_tray: true,
    developer_mode: false,
    log_level: 'info',
  });

  const [isLoading, setIsLoading] = createSignal(false);
  const [isSaving, setIsSaving] = createSignal(false);
  const [lastError, setLastError] = createSignal<string | null>(null);

  // Load settings on mount
  onMount(async () => {
    await loadSettings();
  });

  const loadSettings = async () => {
    setIsLoading(true);
    setLastError(null);

    try {
      const loadedSettings = await invoke<SettingsData>('get_settings');
      setSettings(loadedSettings);
    } catch (error) {
      console.error('Failed to load settings:', error);
      setLastError(error as string);
    } finally {
      setIsLoading(false);
    }
  };

  const saveSettings = async (newSettings?: SettingsData) => {
    setIsSaving(true);
    setLastError(null);

    try {
      const settingsToSave = newSettings || settings();
      await invoke('save_settings', { settings: settingsToSave });

      if (!newSettings) {
        setSettings(settingsToSave);
      }

      return true;
    } catch (error) {
      console.error('Failed to save settings:', error);
      setLastError(error as string);
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const updateSetting = async <K extends keyof SettingsData>(
    key: K,
    value: SettingsData[K]
  ) => {
    const newSettings = { ...settings(), [key]: value };
    setSettings(newSettings);
    return await saveSettings(newSettings);
  };

  const updateAIProvider = async (field: keyof SettingsData['ai_provider'], value: any) => {
    const newSettings = {
      ...settings(),
      ai_provider: {
        ...settings().ai_provider,
        [field]: value
      }
    };
    setSettings(newSettings);
    return await saveSettings(newSettings);
  };

  const updateShortcut = async (action: string, shortcut: string) => {
    const newSettings = {
      ...settings(),
      shortcuts: {
        ...settings().shortcuts,
        [action]: shortcut
      }
    };
    setSettings(newSettings);
    return await saveSettings(newSettings);
  };

  const resetToDefaults = async () => {
    try {
      await invoke('reset_to_defaults');
      await loadSettings();
      return true;
    } catch (error) {
      console.error('Failed to reset settings:', error);
      setLastError(error as string);
      return false;
    }
  };

  const openSettingsWindow = async () => {
    try {
      await invoke('open_settings_window');
      return true;
    } catch (error) {
      console.error('Failed to open settings window:', error);
      setLastError(error as string);
      return false;
    }
  };

  const getAvailableLanguages = async (): Promise<LanguageInfo[]> => {
    try {
      return await invoke('get_available_languages');
    } catch (error) {
      console.error('Failed to get available languages:', error);
      return [];
    }
  };

  const getAvailableThemes = async (): Promise<ThemeInfo[]> => {
    try {
      return await invoke('get_available_themes');
    } catch (error) {
      console.error('Failed to get available themes:', error);
      return [];
    }
  };

  const exportSettings = async (): Promise<string | null> => {
    try {
      return await invoke('export_settings');
    } catch (error) {
      console.error('Failed to export settings:', error);
      setLastError(error as string);
      return null;
    }
  };

  const importSettings = async (settingsJson: string): Promise<boolean> => {
    try {
      await invoke('import_settings', { settingsJson });
      await loadSettings();
      return true;
    } catch (error) {
      console.error('Failed to import settings:', error);
      setLastError(error as string);
      return false;
    }
  };

  const clearCache = async (): Promise<string | null> => {
    try {
      return await invoke('clear_cache');
    } catch (error) {
      console.error('Failed to clear cache:', error);
      setLastError(error as string);
      return null;
    }
  };

  // Apply theme to document
  const applyTheme = (theme: string) => {
    const root = document.documentElement;

    if (theme === 'auto') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      root.setAttribute('data-theme', prefersDark ? 'dark' : 'light');

      // Listen for system theme changes
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = (e: MediaQueryListEvent) => {
        root.setAttribute('data-theme', e.matches ? 'dark' : 'light');
      };
      mediaQuery.addEventListener('change', handleChange);

      return () => mediaQuery.removeEventListener('change', handleChange);
    } else {
      root.setAttribute('data-theme', theme);
      return () => {};
    }
  };

  // Listen for theme changes from other windows
  onMount(() => {
    let unlistenTheme: UnlistenFn | null = null;

    const setupThemeListener = async () => {
      try {
        unlistenTheme = await listen('theme-changed', (event) => {
          const theme = event.payload as string;
          updateSetting('theme', theme);
          applyTheme(theme);
        });
      } catch (error) {
        console.error('Failed to setup theme listener:', error);
      }
    };

    setupThemeListener();

    onCleanup(() => {
      if (unlistenTheme) {
        unlistenTheme();
      }
    });
  });

  return {
    settings,
    isLoading,
    isSaving,
    lastError,
    loadSettings,
    saveSettings,
    updateSetting,
    updateAIProvider,
    updateShortcut,
    resetToDefaults,
    openSettingsWindow,
    getAvailableLanguages,
    getAvailableThemes,
    exportSettings,
    importSettings,
    clearCache,
    applyTheme,
  };
}

// Global settings hook for the entire application
let globalSettingsHook: ReturnType<typeof useSettings> | null = null;

export function useGlobalSettings() {
  if (!globalSettingsHook) {
    globalSettingsHook = useSettings();
  }
  return globalSettingsHook;
}