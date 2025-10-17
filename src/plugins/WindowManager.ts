import { WindowConfig } from './types';
import { invoke } from '@tauri-apps/api/core';

export class WindowManager {
  private currentWindowId: string | null = null;
  private windowConfigs: Map<string, WindowConfig> = new Map();

  // Create a new window for plugin
  async createWindow(pluginId: string, config: WindowConfig): Promise<string> {
    const windowId = `plugin-${pluginId}-${Date.now()}`;

    await invoke('create_plugin_window', {
      windowId,
      config
    });

    this.windowConfigs.set(windowId, config);
    this.currentWindowId = windowId;

    return windowId;
  }

  // Update window configuration
  async updateWindow(windowId: string, config: Partial<WindowConfig>) {
    const currentConfig = this.windowConfigs.get(windowId);
    if (!currentConfig) return;

    const newConfig = { ...currentConfig, ...config };
    this.windowConfigs.set(windowId, newConfig);

    await invoke('update_plugin_window', {
      windowId,
      config: newConfig
    });
  }

  // Set window mode
  async setWindowMode(windowId: string, mode: WindowConfig['mode']) {
    const config = this.windowConfigs.get(windowId);
    if (!config) return;

    config.mode = mode;
    this.windowConfigs.set(windowId, config);

    switch (mode) {
      case 'fullscreen':
        await invoke('set_window_fullscreen', { windowId, fullscreen: true });
        break;
      case 'floating':
        await this.updateWindow(windowId, {
          transparent: true,
          undecorated: true,
          alwaysOnTop: true,
          resizable: false
        });
        break;
      case 'normal':
        await invoke('set_window_fullscreen', { windowId, fullscreen: false });
        await this.updateWindow(windowId, {
          transparent: false,
          undecorated: false,
          alwaysOnTop: false,
          resizable: true
        });
        break;
    }
  }

  // Close window
  async closeWindow(windowId: string) {
    await invoke('close_plugin_window', { windowId });
    this.windowConfigs.delete(windowId);

    if (this.currentWindowId === windowId) {
      this.currentWindowId = null;
    }
  }

  // Focus window
  async focusWindow(windowId: string) {
    await invoke('focus_plugin_window', { windowId });
    this.currentWindowId = windowId;
  }

  // Get current window
  getCurrentWindow(): string | null {
    return this.currentWindowId;
  }

  // Get window config
  getWindowConfig(windowId: string): WindowConfig | undefined {
    return this.windowConfigs.get(windowId);
  }
}

// Singleton instance
export const windowManager = new WindowManager();
