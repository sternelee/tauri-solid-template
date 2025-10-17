import { PluginInstance, Command, PluginContext } from "./types";
import { createPluginSDK, setCurrentPluginSDK } from "./PluginSDK";
import { windowManager } from "./WindowManager";
import { permissionManager } from "./PermissionManager";
import { PluginLoadError, ShortcutConflictError, PluginError } from "./errors";
import { tauriCommands } from "../tauri-commands";

export type PluginState = 'unloaded' | 'loading' | 'loaded' | 'active' | 'error';

export interface PluginStatus {
  id: string;
  state: PluginState;
  error?: string;
  loadTime?: number;
}

export class PluginManager {
  private plugins: Map<string, PluginInstance> = new Map();
  private activePlugin: PluginInstance | null = null;
  private pluginHosts: Map<string, HTMLElement> = new Map();
  private globalShortcuts: Map<string, Command> = new Map();
  private pluginStatuses: Map<string, PluginStatus> = new Map();
  private pluginSDKs: Map<string, any> = new Map(); // Store SDK instances per plugin

  constructor() {
    this.setupGlobalListeners();
    this.setupPluginEventListeners();
  }

  // Register a plugin with validation
  async register(plugin: PluginInstance): Promise<void> {
    const startTime = Date.now();

    try {
      this.setPluginStatus(plugin.meta.id, 'loading');

      // Validate plugin structure
      this.validatePlugin(plugin);

      // Check for shortcut conflicts
      this.checkShortcutConflicts(plugin);

      // Validate permissions
      if (plugin.meta.permissions) {
        await permissionManager.validatePluginPermissions(
          plugin.meta.permissions,
          plugin.meta.id
        );
      }

      // Create SDK instance for this plugin
      const sdk = createPluginSDK(plugin.meta.id);
      this.pluginSDKs.set(plugin.meta.id, sdk);

      this.plugins.set(plugin.meta.id, plugin);

      // Register global shortcuts
      plugin.commands.forEach((command) => {
        if (command.shortcut) {
          this.globalShortcuts.set(command.shortcut, command);
        }
      });

      this.setPluginStatus(plugin.meta.id, 'loaded', undefined, Date.now() - startTime);
      console.log(`Plugin registered: ${plugin.meta.name} (${plugin.meta.id})`);

    } catch (error) {
      this.setPluginStatus(plugin.meta.id, 'error', error.message);
      console.error(`Failed to register plugin "${plugin.meta.id}":`, error);
      throw error;
    }
  }

  // Validate plugin structure
  private validatePlugin(plugin: PluginInstance): void {
    if (!plugin.meta?.id || typeof plugin.meta.id !== 'string') {
      throw new PluginError('Plugin must have a valid id', 'INVALID_PLUGIN_STRUCTURE');
    }

    if (!plugin.meta?.name || typeof plugin.meta.name !== 'string') {
      throw new PluginError('Plugin must have a valid name', 'INVALID_PLUGIN_STRUCTURE', plugin.meta.id);
    }

    if (!Array.isArray(plugin.commands)) {
      throw new PluginError('Plugin commands must be an array', 'INVALID_PLUGIN_STRUCTURE', plugin.meta.id);
    }

    // Validate each command
    plugin.commands.forEach((command, index) => {
      if (!command.id || typeof command.id !== 'string') {
        throw new PluginError(
          `Command at index ${index} must have a valid id`,
          'INVALID_COMMAND',
          plugin.meta.id
        );
      }

      if (!command.title || typeof command.title !== 'string') {
        throw new PluginError(
          `Command "${command.id}" must have a valid title`,
          'INVALID_COMMAND',
          plugin.meta.id
        );
      }

      if (typeof command.action !== 'function') {
        throw new PluginError(
          `Command "${command.id}" must have a valid action function`,
          'INVALID_COMMAND',
          plugin.meta.id
        );
      }
    });
  }

  // Check for shortcut conflicts
  private checkShortcutConflicts(plugin: PluginInstance): void {
    plugin.commands.forEach((command) => {
      if (command.shortcut) {
        const normalizedShortcut = this.normalizeShortcut(command.shortcut);
        const existingCommand = this.globalShortcuts.get(normalizedShortcut);

        if (existingCommand) {
          // Find which plugin owns the existing command
          const existingPlugin = Array.from(this.plugins.values())
            .find(p => p.commands.some(c => c === existingCommand));

          throw new ShortcutConflictError(
            normalizedShortcut,
            existingPlugin?.meta.id || 'unknown',
            plugin.meta.id
          );
        }
      }
    });
  }

  // Load plugin from URL/path with better error handling
  async loadPlugin(pluginPath: string): Promise<void> {
    const pluginId = this.extractPluginId(pluginPath);

    try {
      this.setPluginStatus(pluginId, 'loading');

      const module = await import(/* @vite-ignore */ pluginPath);

      if (!module.default) {
        throw new PluginLoadError(pluginId, 'Plugin module must export a default plugin instance');
      }

      const plugin = module.default;
      await this.register(plugin);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.setPluginStatus(pluginId, 'error', errorMessage);

      if (error instanceof PluginLoadError || error instanceof PluginError) {
        throw error;
      }

      throw new PluginLoadError(pluginId, `Failed to load plugin: ${errorMessage}`, error);
    }
  }

  // Extract plugin ID from path
  private extractPluginId(pluginPath: string): string {
    // Extract from path like './plugins/my-plugin/index.tsx'
    const pathParts = pluginPath.split('/');
    const pluginDir = pathParts[pathParts.length - 2] || 'unknown';
    return pluginDir;
  }

  // Set plugin status
  private setPluginStatus(id: string, state: PluginState, error?: string, loadTime?: number): void {
    this.pluginStatuses.set(id, { id, state, error, loadTime });

    // Emit status change event
    window.dispatchEvent(new CustomEvent('plugin:status-changed', {
      detail: { pluginId: id, status: { id, state, error, loadTime } }
    }));
  }

  // Setup plugin event listeners
  private setupPluginEventListeners(): void {
    // Listen for HUD events from plugins
    window.addEventListener('plugin:hud', (event: any) => {
      const { pluginId, text } = event.detail;
      this.showPluginHUD(pluginId, text);
    });
  }

  // Show HUD for plugin
  private showPluginHUD(pluginId: string, text: string): void {
    // TODO: Implement actual HUD UI
    console.log(`HUD [${pluginId}]: ${text}`);

    // For now, you could dispatch to main app to show a toast
    window.dispatchEvent(new CustomEvent('app:show-hud', {
      detail: { pluginId, text }
    }));
  }

  // Activate plugin with better error handling
  async activatePlugin(pluginId: string, commandId?: string): Promise<void> {
    try {
      const plugin = this.plugins.get(pluginId);
      if (!plugin) {
        throw new PluginError(`Plugin "${pluginId}" not found`, 'PLUGIN_NOT_FOUND', pluginId);
      }

      // Check if already active
      if (this.activePlugin?.meta.id === pluginId) {
        console.warn(`Plugin "${pluginId}" is already active`);
        return;
      }

      // Deactivate current plugin first
      if (this.activePlugin) {
        await this.deactivatePlugin();
      }

      this.activePlugin = plugin;
      this.setPluginStatus(pluginId, 'active');

      // Get SDK instance for this plugin
      const sdk = this.pluginSDKs.get(pluginId);
      if (!sdk) {
        throw new PluginError(`SDK not found for plugin "${pluginId}"`, 'SDK_NOT_FOUND', pluginId);
      }

      // Set current SDK for context
      setCurrentPluginSDK(sdk);

      // Create plugin context
      const context: PluginContext = {
        window: {
          setMode: (mode) => {
            const windowId = windowManager.getCurrentWindow();
            if (windowId) {
              windowManager.setWindowMode(windowId, mode).catch(error => {
                console.error(`Failed to set window mode for plugin "${pluginId}":`, error);
              });
            }
          },
          close: () => {
            const windowId = windowManager.getCurrentWindow();
            if (windowId) {
              windowManager.closeWindow(windowId).catch(error => {
                console.error(`Failed to close window for plugin "${pluginId}":`, error);
              });
            }
          },
        },
        invoke: async (command, args) => {
          try {
            return await tauriCommands.executeCommand(command, args || []);
          } catch (error) {
            console.error(`Command execution failed for plugin "${pluginId}":`, error);
            throw error;
          }
        },
        showHUD: (text) => sdk.showHUD(text),
        onExit: (callback) => sdk.onExit(callback),
      };

      sdk.setContext(context);

      // Mount plugin UI
      await this.mountPlugin(plugin);

      // Execute specific command if provided
      if (commandId) {
        const command = plugin.commands.find((cmd) => cmd.id === commandId);
        if (command) {
          try {
            await command.action();
          } catch (error) {
            console.error(`Command "${commandId}" execution failed for plugin "${pluginId}":`, error);
            // Don't throw - command errors shouldn't crash the plugin
          }
        }
      }

      // Call onMount hook
      if (plugin.onMount) {
        try {
          plugin.onMount();
        } catch (error) {
          console.error(`onMount hook failed for plugin "${pluginId}":`, error);
        }
      }

    } catch (error) {
      console.error(`Failed to activate plugin "${pluginId}":`, error);
      this.setPluginStatus(pluginId, 'error', error.message);
      throw error;
    }
  }

  // Mount plugin UI to Shadow DOM with better error handling
  private async mountPlugin(plugin: PluginInstance): Promise<void> {
  const hostId = `plugin-host-${plugin.meta.id}`;
  let host = this.pluginHosts.get(hostId);

  if (!host) {
  host = document.createElement('plugin-host');
  host.id = hostId;
  host.setAttribute('data-plugin-id', plugin.meta.id);

    const container = document.getElementById('plugin-container');
      if (!container) {
      throw new PluginError(
      'Plugin container not found in DOM',
      'CONTAINER_NOT_FOUND',
          plugin.meta.id
    );
  }

      container.appendChild(host);
  this.pluginHosts.set(hostId, host);
  }

  // Clear existing content
  host.innerHTML = '';

  if (plugin.ui) {
    try {
        const shadow = host.attachShadow({ mode: 'open' });

        // Clear shadow DOM
        shadow.innerHTML = '';

        // Add base styles to shadow DOM
        const style = document.createElement('style');
        style.textContent = `
          :host {
            display: block;
            width: 100%;
            height: 100%;
          }
          .plugin-ui {
            width: 100%;
            height: 100%;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          }
        `;
        shadow.appendChild(style);

        // Create plugin UI container
        const uiContainer = document.createElement('div');
        uiContainer.className = 'plugin-ui';

        // Mount component
        const uiElement = plugin.ui();
        if (uiElement) {
          uiContainer.appendChild(uiElement as any);
        }

        shadow.appendChild(uiContainer);

      } catch (error) {
        console.error(`Failed to mount UI for plugin "${plugin.meta.id}":`, error);
        throw new PluginError(
          `UI mount failed: ${error.message}`,
          'UI_MOUNT_FAILED',
          plugin.meta.id,
          error
        );
      }
    }
  }

  // Deactivate current plugin with proper cleanup
  async deactivatePlugin(): Promise<void> {
  if (!this.activePlugin) return;

  const pluginId = this.activePlugin.meta.id;

  try {
      // Call onExit hook
  if (this.activePlugin.onExit) {
    try {
      this.activePlugin.onExit();
    } catch (error) {
    console.error(`onExit hook failed for plugin "${pluginId}":`, error);
    }
      }

  // Clean up UI
    const hostId = `plugin-host-${pluginId}`;
      const host = this.pluginHosts.get(hostId);
      if (host) {
        try {
          // Clear shadow DOM
          const shadow = host.shadowRoot;
          if (shadow) {
            shadow.innerHTML = '';
          }
          // Remove host element
          host.remove();
          this.pluginHosts.delete(hostId);
        } catch (error) {
          console.error(`Failed to clean up UI for plugin "${pluginId}":`, error);
        }
      }

      // Clean up SDK
      const sdk = this.pluginSDKs.get(pluginId);
      if (sdk) {
        try {
          sdk.destroy();
        } catch (error) {
          console.error(`Failed to destroy SDK for plugin "${pluginId}":`, error);
        }
      }

      // Clear current SDK reference
      setCurrentPluginSDK(null);

      // Update status
      this.setPluginStatus(pluginId, 'loaded');
      this.activePlugin = null;

    } catch (error) {
      console.error(`Failed to deactivate plugin "${pluginId}":`, error);
      this.setPluginStatus(pluginId, 'error', error.message);
      throw error;
    }
  }

  // Handle global keyboard events
  private setupGlobalListeners() {
    document.addEventListener(
      "keydown",
      (e) => {
        // Handle Escape key for plugin exit
        if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          this.handleEscape();
        }

        // Handle global shortcuts
        const shortcut = this.getShortcutString(e);
        const command = this.globalShortcuts.get(shortcut);
        if (command) {
          e.preventDefault();
          command.action();
        }
      },
      true,
    ); // Use capture phase
  }

  // Handle escape key
  private handleEscape() {
    if (this.activePlugin) {
      this.deactivatePlugin();
    }
  }

  // Normalize shortcut string for consistent comparison
  private normalizeShortcut(shortcut: string): string {
  return shortcut
    .toLowerCase()
    .replace(/\s+/g, '') // Remove spaces
    .replace(/cmd|ctrl|control/gi, 'cmd') // Normalize cmd/ctrl
    .replace(/option|alt/gi, 'alt') // Normalize option/alt
    .replace(/shift/gi, 'shift'); // Normalize shift
  }

  // Convert keyboard event to shortcut string
  private getShortcutString(e: KeyboardEvent): string {
    const parts = [];
    if (e.ctrlKey || e.metaKey) parts.push('cmd');
    if (e.altKey) parts.push('alt');
    if (e.shiftKey) parts.push('shift');

    // Normalize key name
    let key = e.key.toLowerCase();
    if (key === ' ') key = 'space';
    if (key.length === 1) key = key.toUpperCase();

    parts.push(key);
    return parts.join('+');
  }

  // Get all registered commands
  getAllCommands(): Command[] {
    const allCommands: Command[] = [];
    this.plugins.forEach((plugin) => {
      allCommands.push(...plugin.commands);
    });
    return allCommands;
  }

  // Search commands
  searchCommands(query: string): Command[] {
    const allCommands = this.getAllCommands();
    if (!query) return allCommands;

    return allCommands.filter(
      (cmd) =>
        cmd.title.toLowerCase().includes(query.toLowerCase()) ||
        cmd.keywords?.some((keyword) =>
          keyword.toLowerCase().includes(query.toLowerCase()),
        ),
    );
  }

  // Get active plugin
  getActivePlugin(): PluginInstance | null {
    return this.activePlugin;
  }

  // Get registered plugins
  getPlugins(): PluginInstance[] {
    return Array.from(this.plugins.values());
  }

  // Get plugin statuses
  getPluginStatuses(): PluginStatus[] {
    return Array.from(this.pluginStatuses.values());
  }

  // Get plugin status
  getPluginStatus(pluginId: string): PluginStatus | undefined {
    return this.pluginStatuses.get(pluginId);
  }

  // Reload plugin
  async reloadPlugin(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      throw new PluginError(`Plugin "${pluginId}" not found`, 'PLUGIN_NOT_FOUND', pluginId);
    }

    // Deactivate if active
    if (this.activePlugin?.meta.id === pluginId) {
      await this.deactivatePlugin();
    }

    // Remove from registries
    this.plugins.delete(pluginId);
    this.pluginStatuses.delete(pluginId);

    // TODO: Implement actual reload from source
    // For now, this just removes the plugin
    console.log(`Plugin "${pluginId}" unloaded. Manual reload required.`);
  }

  // Unload plugin
  async unloadPlugin(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      throw new PluginError(`Plugin "${pluginId}" not found`, 'PLUGIN_NOT_FOUND', pluginId);
    }

    // Deactivate if active
    if (this.activePlugin?.meta.id === pluginId) {
      await this.deactivatePlugin();
    }

    // Clean up resources
    this.plugins.delete(pluginId);
    this.pluginStatuses.delete(pluginId);
    this.pluginSDKs.delete(pluginId);

    // Remove shortcuts
    const shortcutsToRemove: string[] = [];
    this.globalShortcuts.forEach((command, shortcut) => {
      if (plugin.commands.some(cmd => cmd === command)) {
        shortcutsToRemove.push(shortcut);
      }
    });
    shortcutsToRemove.forEach(shortcut => this.globalShortcuts.delete(shortcut));

    console.log(`Plugin "${pluginId}" unloaded successfully`);
  }

  // Get active plugin
  getActivePlugin(): PluginInstance | null {
    return this.activePlugin;
  }
}

// Singleton instance
export const pluginManager = new PluginManager();
