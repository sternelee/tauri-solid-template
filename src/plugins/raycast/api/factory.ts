// ============================================================================
// Raycast API Factory Implementation
// ============================================================================
// Based on design.md requirements for API injection and context management

import React from "react";
import { List } from "../components/list";
import { Detail } from "../components/detail";
import { Form } from "../components/form";
import { Grid } from "../components/grid";
import { Action, ActionPanel } from "../components/actions";
import { Cache } from "../cache";
import { LocalStorage } from "../localStorage";
import { useNavigation } from "../hooks/useNavigation";
import { usePersistentState } from "../hooks/usePersistentState";
import { environment } from "../environment";
import { showToast } from "../toast";
import { showHUD } from "../hud";
import { Clipboard } from "../clipboard";
import { AI } from "../ai";
import { OAuth } from "../oauth";
import { BrowserExtension } from "../browserExtension";
import { Keyboard } from "../keyboard";
import { Color } from "../constants/color";
import { Icon } from "../constants/icon";
import { LaunchType } from "../constants/launchType";
import { Toast } from "../constants/toast";
import { Image } from "../constants/image";
import type {
  RaycastAPI,
  RaycastAPIOptions,
  PluginExecutionContext,
} from "../types";

// ============================================================================
// API Factory Implementation
// ============================================================================

export class RaycastAPIFactory {
  private contexts = new Map<string, PluginExecutionContext>();
  private readonly stateManager: StateManager;
  private readonly navigationManager: NavigationManager;
  private readonly permissionManager: PermissionManager;

  constructor(
    stateManager: StateManager,
    navigationManager: NavigationManager,
    permissionManager: PermissionManager,
  ) {
    this.stateManager = stateManager;
    this.navigationManager = navigationManager;
    this.permissionManager = permissionManager;
  }

  createAPI(options: RaycastAPIOptions): RaycastAPI {
    // Check permissions before creating API
    this.permissionManager.validatePluginAccess(options.pluginId);

    // Create plugin execution context
    const context = this.createPluginExecutionContext(options);
    this.contexts.set(options.pluginId, context);

    return context.api;
  }

  destroyAPI(pluginId: string): void {
    const context = this.contexts.get(pluginId);
    if (context) {
      context.cleanup();
      this.contexts.delete(pluginId);

      // Clean up state and navigation
      this.stateManager.destroyPluginStateContext(pluginId);
      this.navigationManager.cleanupPluginContext(pluginId);
    }
  }

  getAPI(pluginId: string): RaycastAPI | undefined {
    const context = this.contexts.get(pluginId);
    return context?.api;
  }

  getExecutionContext(pluginId: string): PluginExecutionContext | undefined {
    return this.contexts.get(pluginId);
  }

  private createPluginExecutionContext(
    options: RaycastAPIOptions,
  ): PluginExecutionContext {
    // Create plugin state context
    const stateContext = this.stateManager.createPluginStateContext(
      options.pluginId,
    );

    // Create navigation context
    const navigationContext = this.navigationManager.createPluginContext(
      options.pluginId,
    );

    // Create storage instances
    const cache = new Cache({
      namespace: options.pluginId,
      capacity: 10 * 1024 * 1024, // 10MB default
    });

    const localStorage = new LocalStorage(options.pluginId);

    // Create the API instance
    const api: RaycastAPI = {
      // UI Components (built on shadcn-solid)
      List,
      Detail,
      Form,
      Grid,
      Action,
      ActionPanel,

      // Utility Functions
      showToast,
      showHUD,
      open: (target: string, application?: string) =>
        this.open(target, application),
      showInFinder: (path: string) => this.showInFinder(path),
      trash: (paths: string | string[]) => this.trash(paths),
      getPreferenceValues: () => options.preferences || {},
      getSelectedText: () => this.getSelectedText(),
      getSelectedFinderItems: () => this.getSelectedFinderItems(),
      getApplications: () => this.getApplications(),
      getDefaultApplication: (extension: string) =>
        this.getDefaultApplication(extension),
      getFrontmostApplication: () => this.getFrontmostApplication(),

      // Hooks with plugin isolation
      useNavigation: () =>
        this.navigationManager.createNavigationHook(options.pluginId),
      usePersistentState: <T>(key: string, initialValue: T) =>
        usePersistentState<T>(
          `${options.pluginId}:${key}`,
          initialValue,
          stateContext,
        ),

      // System APIs
      Clipboard,
      AI,
      OAuth,
      BrowserExtension,
      Keyboard,

      // Constants
      Color,
      Icon,
      Image,
      Toast,
      LaunchType,

      // Environment
      environment: {
        ...environment,
        commandName: options.environment?.commandName || "default",
        extensionName: options.environment?.extensionName || options.pluginId,
        isDevelopment: options.environment?.isDevelopment ?? true,
      },

      // Cache and Storage
      Cache: cache,
      LocalStorage: localStorage,
    };

    return {
      pluginId: options.pluginId,
      api,
      state: stateContext,
      navigation: navigationContext,
      shadowRoot: null, // Will be set by component renderer
      cleanup: () => {
        cache.clear();
        stateContext.cleanup();
      },
    };
  }

  // ============================================================================
  // Platform Integration Methods (to be implemented with Tauri commands)
  // ============================================================================

  private async open(target: string, application?: string): Promise<void> {
    // Implementation would use Tauri invoke command
    console.log(
      `Opening ${target} with ${application || "default application"}`,
    );
    // await invoke('open', { target, application });
  }

  private async showInFinder(path: string): Promise<void> {
    console.log(`Showing ${path} in Finder`);
    // await invoke('show_in_finder', { path });
  }

  private async trash(paths: string | string[]): Promise<void> {
    const pathArray = Array.isArray(paths) ? paths : [paths];
    console.log(`Moving to trash: ${pathArray.join(", ")}`);
    // await invoke('trash', { paths: pathArray });
  }

  private async getSelectedText(): Promise<string> {
    // Implementation would use Tauri invoke command
    return "";
    // return await invoke('get_selected_text');
  }

  private async getSelectedFinderItems(): Promise<string[]> {
    // Implementation would use Tauri invoke command
    return [];
    // return await invoke('get_selected_finder_items');
  }

  private async getApplications(): Promise<any[]> {
    // Implementation would use Tauri invoke command
    return [];
    // return await invoke('get_applications');
  }

  private async getDefaultApplication(extension: string): Promise<any> {
    // Implementation would use Tauri invoke command
    return null;
    // return await invoke('get_default_application', { extension });
  }

  private async getFrontmostApplication(): Promise<any> {
    // Implementation would use Tauri invoke command
    return null;
    // return await invoke('get_frontmost_application');
  }
}

// ============================================================================
// Supporting Managers (to be implemented in detail)
// ============================================================================

export interface StateManager {
  createPluginStateContext(pluginId: string): PluginStateContext;
  destroyPluginStateContext(pluginId: string): void;
}

export interface NavigationManager {
  createPluginContext(pluginId: string): NavigationContext;
  createNavigationHook(pluginId: string): NavigationHook;
  cleanupPluginContext(pluginId: string): void;
}

export interface PermissionManager {
  validatePluginAccess(pluginId: string): void;
  checkPermission(pluginId: string, permission: string): boolean;
}

export interface PluginStateContext {
  reactState: Map<string, any>;
  persistentState: Map<string, any>;
  hooks: Map<string, any>;
  cleanup(): void;
}

export interface NavigationContext {
  push(component: React.ReactElement, title?: string): void;
  pop(): void;
  popToRoot(): void;
  getCurrentView(): React.ReactElement | null;
  getNavigationStack(): NavigationEntry[];
}

export interface NavigationHook {
  push: (component: React.ReactElement, title?: string) => void;
  pop: () => void;
  popToRoot: () => void;
}

export interface NavigationEntry {
  component: React.ReactElement;
  title?: string;
  timestamp: number;
}

// ============================================================================
// Factory Instance and Utilities
// ============================================================================

let globalAPIFactory: RaycastAPIFactory | null = null;

export function initializeRaycastAPIFactory(
  stateManager: StateManager,
  navigationManager: NavigationManager,
  permissionManager: PermissionManager,
): RaycastAPIFactory {
  if (globalAPIFactory) {
    console.warn("RaycastAPIFactory already initialized");
    return globalAPIFactory;
  }

  globalAPIFactory = new RaycastAPIFactory(
    stateManager,
    navigationManager,
    permissionManager,
  );

  return globalAPIFactory;
}

export function getRaycastAPIFactory(): RaycastAPIFactory | null {
  return globalAPIFactory;
}

export function createRaycastAPI(options: RaycastAPIOptions): RaycastAPI {
  const factory = getRaycastAPIFactory();
  if (!factory) {
    throw new Error(
      "RaycastAPIFactory not initialized. Call initializeRaycastAPIFactory first.",
    );
  }
  return factory.createAPI(options);
}

export function destroyRaycastAPI(pluginId: string): void {
  const factory = getRaycastAPIFactory();
  if (factory) {
    factory.destroyAPI(pluginId);
  }
}

export function getRaycastAPI(pluginId: string): RaycastAPI | undefined {
  const factory = getRaycastAPIFactory();
  return factory?.getAPI(pluginId);
}

export function getPluginExecutionContext(
  pluginId: string,
): PluginExecutionContext | undefined {
  const factory = getRaycastAPIFactory();
  return factory?.getExecutionContext(pluginId);
}

