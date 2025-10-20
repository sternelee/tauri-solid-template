import { PluginInstance, PluginMeta, Command, PluginContext } from "./types";
import { permissionManager } from "./PermissionManager";
import { PluginError } from "./errors";

// Plugin SDK instance per plugin
export class PluginSDK {
  private context: PluginContext | null = null;
  private exitCallbacks: Set<() => void> = new Set();
  private pluginId: string;

  constructor(pluginId: string) {
    this.pluginId = pluginId;
  }

  // Plugin registration
  definePlugin(
    meta: PluginMeta,
    commands: Command[],
    ui?: () => any, // More generic component type
  ): PluginInstance {
    // Validate permissions during definition
    if (meta.permissions && meta.permissions.length > 0) {
      permissionManager
        .validatePluginPermissions(meta.permissions, meta.id)
        .catch((error) => {
          console.error(
            `Plugin "${meta.id}" permission validation failed:`,
            error,
          );
          // Don't throw here - let the plugin load but log the issue
        });
    }

    return {
      meta,
      commands,
      ui,
      onExit: () => {
        this.exitCallbacks.forEach((callback) => {
          try {
            callback();
          } catch (error) {
            console.error(
              `Error in exit callback for plugin "${this.pluginId}":`,
              error,
            );
          }
        });
        this.exitCallbacks.clear(); // Clean up after execution
      },
    };
  }

  // Context management
  setContext(context: PluginContext) {
    this.context = context;
  }

  getContext(): PluginContext | null {
    return this.context;
  }

  // Event handlers
  onExit(callback: () => void) {
    if (typeof callback !== "function") {
      throw new PluginError(
        "onExit callback must be a function",
        "INVALID_CALLBACK",
        this.pluginId,
      );
    }
    this.exitCallbacks.add(callback);

    // Return cleanup function
    return () => {
      this.exitCallbacks.delete(callback);
    };
  }

  // Utility functions with error handling
  async invoke(command: string, args?: any) {
    try {
      if (typeof command !== "string" || command.trim() === "") {
        throw new PluginError(
          "Command must be a non-empty string",
          "INVALID_COMMAND",
          this.pluginId,
        );
      }
      return await this.context?.invoke(command, args);
    } catch (error) {
      console.error(`Plugin "${this.pluginId}" invoke failed:`, error);
      throw error;
    }
  }

  showHUD(text: string) {
    if (typeof text !== "string") {
      console.warn(
        `Plugin "${this.pluginId}": showHUD expects a string, got ${typeof text}`,
      );
      text = String(text);
    }

    // TODO: Implement actual HUD UI instead of console.log
    console.log(`HUD [${this.pluginId}]:`, text);

    // Emit event for main app to show HUD
    window.dispatchEvent(
      new CustomEvent("plugin:hud", {
        detail: { pluginId: this.pluginId, text },
      }),
    );
  }

  // Window management with validation
  setWindowMode(mode: "normal" | "fullscreen" | "floating") {
    if (!this.context?.window.setMode) {
      console.warn(
        `Plugin "${this.pluginId}": Window management not available`,
      );
      return;
    }

    try {
      this.context.window.setMode(mode);
    } catch (error) {
      console.error(
        `Plugin "${this.pluginId}" window mode change failed:`,
        error,
      );
      throw error;
    }
  }

  closeWindow() {
    if (!this.context?.window.close) {
      console.warn(`Plugin "${this.pluginId}": Window close not available`);
      return;
    }

    try {
      this.context.window.close();
    } catch (error) {
      console.error(`Plugin "${this.pluginId}" window close failed:`, error);
      throw error;
    }
  }

  // Cleanup method
  destroy() {
    this.exitCallbacks.clear();
    this.context = null;
  }
}

// Factory function to create SDK instance per plugin
export function createPluginSDK(pluginId: string): PluginSDK {
  return new PluginSDK(pluginId);
}

// Helper function for plugin definition (backwards compatibility)
export function definePlugin(
  meta: PluginMeta,
  commands: Command[],
  ui?: () => any,
): PluginInstance {
  const sdk = createPluginSDK(meta.id);
  return sdk.definePlugin(meta, commands, ui);
}

// Hook for using plugin context in React components
export function usePluginContext(): PluginContext | null {
  // This needs to be implemented to get context from current plugin
  // For now, return null - plugins should get context through props
  return null;
}

// Hook that plugins can use to get their own SDK instance
let currentPluginSDK: PluginSDK | null = null;

export function setCurrentPluginSDK(sdk: PluginSDK) {
  currentPluginSDK = sdk;
}

export function getCurrentPluginSDK(): PluginSDK | null {
  return currentPluginSDK;
}
