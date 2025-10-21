// ============================================================================
// Enhanced Plugin Manager with Raycast Compatibility
// ============================================================================
// Based on design.md requirements for Raycast plugin support

import { PluginManager, PluginState } from './PluginManager';
import { PluginInstance, ExtendedPluginInstance, ExtendedPluginMeta } from './types';
import {
  initializeRaycastAPISystem,
  getRaycastAPISystem,
  createRaycastAPI,
  injectRaycastAPI,
  destroyRaycastAPI
} from './raycast/api';
import type { RaycastManifest, RaycastCommand, RaycastAPI } from './raycast/types';

export interface RaycastPluginOptions {
  enableCompatibilityMode?: boolean;
  enableValidation?: boolean;
  enableDebugMode?: boolean;
}

export class RaycastPluginManager extends PluginManager {
  private raycastAPIs = new Map<string, RaycastAPI>();
  private raycastManifests = new Map<string, RaycastManifest>();
  private options: RaycastPluginOptions;
  private raycastSystem: any;

  constructor(options: RaycastPluginOptions = {}) {
    super();
    this.options = {
      enableCompatibilityMode: true,
      enableValidation: true,
      enableDebugMode: false,
      ...options
    };

    // Initialize Raycast API system
    this.initializeRaycastSystem();
  }

  // ============================================================================
  // Raycast Plugin Registration
  // ============================================================================

  async registerRaycastPlugin(
    plugin: ExtendedPluginInstance,
    manifest: RaycastManifest
  ): Promise<void> {
    try {
      // Validate Raycast manifest
      if (this.options.enableValidation) {
        const system = getRaycastAPISystem();
        const validationResult = system.validateManifest(manifest);

        if (!validationResult.isValid) {
          throw new Error(`Raycast manifest validation failed: ${validationResult.errors.join(', ')}`);
        }
      }

      // Store manifest
      this.raycastManifests.set(plugin.meta.id, manifest);

      // Create Raycast API for this plugin
      const raycastAPI = createRaycastAPI(plugin.meta.id);

      this.raycastAPIs.set(plugin.meta.id, raycastAPI);

      // Extend plugin with Raycast API
      const extendedPlugin = this.extendPluginWithRaycastAPI(plugin, raycastAPI, manifest);

      // Register with base plugin manager
      await super.register(extendedPlugin);

      console.log(`Raycast plugin registered: ${plugin.meta.id}`);

    } catch (error) {
      console.error(`Failed to register Raycast plugin ${plugin.meta.id}:`, error);
      throw error;
    }
  }

  async loadRaycastPluginFromManifest(manifest: RaycastManifest): Promise<void> {
    // Create plugin instance from manifest
    const pluginInstance = await this.createPluginInstanceFromManifest(manifest);

    // Register as Raycast plugin
    await this.registerRaycastPlugin(pluginInstance, manifest);
  }

  // ============================================================================
  // Plugin Activation with Raycast API
  // ============================================================================

  async activatePlugin(pluginId: string, commandName?: string): Promise<void> {
    try {
      // Activate using base plugin manager
      await super.activatePlugin(pluginId);

      // Inject Raycast API into plugin context
      const raycastAPI = this.raycastAPIs.get(pluginId);
      if (raycastAPI) {
        // Inject into global scope for plugin
        injectRaycastAPI(pluginId, (globalThis as any));

        // Set active command in environment
        if (commandName) {
          raycastAPI.environment.commandName = commandName;
        }

        console.log(`Raycast API injected for plugin: ${pluginId}`);
      }

    } catch (error) {
      console.error(`Failed to activate Raycast plugin ${pluginId}:`, error);
      throw error;
    }
  }

  async deactivateRaycastPlugin(pluginId: string): Promise<void> {
    try {
      // Clean up Raycast API
      const raycastAPI = this.raycastAPIs.get(pluginId);
      if (raycastAPI) {
        // Eject from global scope
        destroyRaycastAPI(pluginId);
      }

      // Deactivate using base plugin manager
      await super.deactivatePlugin();

      console.log(`Raycast plugin deactivated: ${pluginId}`);

    } catch (error) {
      console.error(`Failed to deactivate Raycast plugin ${pluginId}:`, error);
      throw error;
    }
  }

  // ============================================================================
  // Raycast Command Management
  // ============================================================================

  async executeRaycastCommand(pluginId: string, commandName: string): Promise<void> {
    const plugin = this.getPlugins().find(p => p.meta.id === pluginId);
    const manifest = this.raycastManifests.get(pluginId);

    if (!plugin || !manifest) {
      throw new Error(`Plugin not found: ${pluginId}`);
    }

    // Find command in manifest
    const command = manifest.commands.find(cmd => cmd.name === commandName);
    if (!command) {
      throw new Error(`Command not found: ${commandName} in plugin ${pluginId}`);
    }

    // Activate plugin with specific command
    await this.activatePlugin(pluginId, commandName);

    // Execute command
    if (plugin.ui) {
      // For UI commands, the UI will be rendered by the plugin system
      console.log(`Executing UI command: ${commandName} in plugin ${pluginId}`);
    } else {
      // For non-view commands, execute directly
      console.log(`Executing non-view command: ${commandName} in plugin ${pluginId}`);
    }
  }

  getRaycastCommands(pluginId: string): RaycastCommand[] {
    const manifest = this.raycastManifests.get(pluginId);
    return manifest ? manifest.commands : [];
  }

  getAllRaycastCommands(): Array<{ pluginId: string; command: RaycastCommand }> {
    const allCommands: Array<{ pluginId: string; command: RaycastCommand }> = [];

    for (const [pluginId, manifest] of Array.from(this.raycastManifests.entries())) {
      for (const command of manifest.commands) {
        allCommands.push({ pluginId, command });
      }
    }

    return allCommands;
  }

  // ============================================================================
  // Compatibility and Migration
  // ============================================================================

  async migrateExistingPlugin(pluginId: string): Promise<void> {
    const plugin = this.getPlugins().find(p => p.meta.id === pluginId);
    if (!plugin) {
      throw new Error(`Plugin not found: ${pluginId}`);
    }

    // Check if plugin is already a Raycast plugin
    if (this.raycastAPIs.has(pluginId)) {
      console.log(`Plugin ${pluginId} is already a Raycast plugin`);
      return;
    }

    try {
      // Generate Raycast manifest from existing plugin
      const manifest = this.generateRaycastManifestFromPlugin(plugin);

      // Create extended plugin instance
      const extendedPlugin = this.extendPluginAsRaycast(plugin, manifest);

      // Create Raycast API
      const raycastAPI = createRaycastAPI(pluginId);

      this.raycastAPIs.set(pluginId, raycastAPI);
      this.raycastManifests.set(pluginId, manifest);

      // Replace plugin in registry
      // Note: Cannot directly modify plugins in base class - this would need base class modification

      console.log(`Plugin migrated to Raycast compatibility: ${pluginId}`);

    } catch (error) {
      console.error(`Failed to migrate plugin ${pluginId}:`, error);
      throw error;
    }
  }

  // ============================================================================
  // System Information and Debugging
  // ============================================================================

  getRaycastSystemInfo(): any {
    const system = getRaycastAPISystem();
    return system ? system.getSystemInfo() : { error: 'Raycast system not initialized' };
  }

  getRaycastPluginInfo(pluginId: string): any {
    const plugin = this.getPlugins().find(p => p.meta.id === pluginId);
    const manifest = this.raycastManifests.get(pluginId);
    const raycastAPI = this.raycastAPIs.get(pluginId);

    return {
      plugin: plugin ? {
        id: plugin.meta.id,
        name: plugin.meta.name,
        state: this.getPluginState(pluginId)
      } : null,
      manifest: manifest || null,
      hasRaycastAPI: !!raycastAPI,
      isActive: this.getActivePlugin()?.meta.id === pluginId
    };
  }

  getAllRaycastPluginInfo(): Array<{ pluginId: string; info: any }> {
    const allInfo: Array<{ pluginId: string; info: any }> = [];

    for (const plugin of this.getPlugins()) {
      const pluginId = plugin.meta.id;
      allInfo.push({
        pluginId,
        info: this.getRaycastPluginInfo(pluginId)
      });
    }

    return allInfo;
  }

  // ============================================================================
  // Cleanup and Shutdown
  // ============================================================================

  async shutdown(): Promise<void> {
    // Clean up all Raycast APIs
    for (const pluginId of Array.from(this.raycastAPIs.keys())) {
      destroyRaycastAPI(pluginId);
    }
    this.raycastAPIs.clear();
    this.raycastManifests.clear();

    // Shutdown Raycast system
    if (this.raycastSystem) {
      this.raycastSystem.shutdown();
    }

    // Base plugin manager doesn't have shutdown method
    // All cleanup happens through deactivatePlugin calls
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  private initializeRaycastSystem(): void {
    try {
      initializeRaycastAPISystem(
        // Component factory - would be implemented with shadcn-solid components
        {},
        // Utility factory - would be implemented with Tauri commands
        {}
      );
      this.raycastSystem = getRaycastAPISystem();

      console.log('Raycast API system initialized');
    } catch (error) {
      console.error('Failed to initialize Raycast API system:', error);
      throw error;
    }
  }

  private extractPreferencesFromManifest(manifest: RaycastManifest): Record<string, any> {
    const preferences: Record<string, any> = {};

    if (manifest.preferences) {
      for (const pref of manifest.preferences) {
        if (pref.default !== undefined) {
          preferences[pref.name] = pref.default;
        }
      }
    }

    return preferences;
  }

  private extendPluginWithRaycastAPI(
    plugin: ExtendedPluginInstance,
    raycastAPI: RaycastAPI,
    manifest: RaycastManifest
  ): ExtendedPluginInstance {
    return {
      ...plugin,
      raycastAPI,
      raycastManifest: manifest,
      meta: {
        ...plugin.meta,
        raycastCompatible: true
      } as ExtendedPluginMeta
    };
  }

  private async createPluginInstanceFromManifest(manifest: RaycastManifest): Promise<ExtendedPluginInstance> {
    // This would typically load the plugin code and create an instance
    // For now, return a basic plugin instance
    const pluginInstance: ExtendedPluginInstance = {
      meta: {
        id: manifest.name,
        name: manifest.name,
        version: '1.0.0',
        description: manifest.description,
        author: typeof manifest.author === 'string' ? manifest.author : manifest.author?.name,
        raycastCompatible: true
      } as ExtendedPluginMeta,
      commands: manifest.commands.map(cmd => ({
        id: cmd.name,
        title: cmd.title,
        description: cmd.description,
        mode: cmd.mode,
        action: () => {
          console.log(`Command executed: ${cmd.name}`);
        }
      })),
      onMount: () => {
        console.log(`Plugin mounted: ${manifest.name}`);
      },
      onUnmount: () => {
        console.log(`Plugin unmounted: ${manifest.name}`);
      }
    };

    return pluginInstance;
  }

  private extendPluginAsRaycast(plugin: PluginInstance, manifest: RaycastManifest): ExtendedPluginInstance {
    const extendedPlugin: ExtendedPluginInstance = {
      ...plugin,
      meta: {
        ...plugin.meta,
        raycastCompatible: true
      } as ExtendedPluginMeta,
      commands: plugin.commands.map(cmd => ({
        ...cmd,
        mode: 'view' as const
      }))
    };

    return extendedPlugin;
  }

  private generateRaycastManifestFromPlugin(plugin: PluginInstance): RaycastManifest {
    return {
      name: plugin.meta.name,
      title: plugin.meta.name,
      description: plugin.meta.description || 'Auto-generated description',
      icon: 'app-window-16',
      author: plugin.meta.author || 'Unknown',
      commands: plugin.commands.map(cmd => ({
        name: cmd.id,
        title: cmd.title,
        description: cmd.description || '',
        mode: 'view' as const
      }))
    };
  }

  private getPluginState(pluginId: string): PluginState {
    // This would typically come from the base plugin manager
    // For now, return a default state
    return 'loaded';
  }
}