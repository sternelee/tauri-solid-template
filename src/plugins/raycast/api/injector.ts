// ============================================================================
// Raycast API Injector Implementation
// ============================================================================
// Based on design.md requirements for API injection into plugin execution context

import type { RaycastAPI, PluginExecutionContext } from "../types";
import type { APIContextManager } from "./context";

// ============================================================================
// API Injector Interface
// ============================================================================

export interface APIInjector {
  inject(pluginId: string, target: any): void;
  eject(pluginId: string, target: any): void;
  isInjected(pluginId: string, target: any): boolean;
  validateInjection(pluginId: string, target: any): boolean;
}

// ============================================================================
// API Injector Implementation
// ============================================================================

export class APIInjectorImpl implements APIInjector {
  private injectedContexts = new Map<string, WeakMap<any, RaycastAPI>>();
  private contextManager: APIContextManager;

  constructor(contextManager: APIContextManager) {
    this.contextManager = contextManager;
  }

  inject(pluginId: string, target: any): void {
    if (!target) {
      throw new Error(
        "Target object for API injection cannot be null or undefined",
      );
    }

    // Validate injection
    if (!this.validateInjection(pluginId, target)) {
      throw new Error(`API injection validation failed for plugin ${pluginId}`);
    }

    // Get the API instance
    const api = this.contextManager.getContext(pluginId);
    if (!api) {
      throw new Error(`No API context found for plugin ${pluginId}`);
    }

    // Create weak map for this plugin if it doesn't exist
    if (!this.injectedContexts.has(pluginId)) {
      this.injectedContexts.set(pluginId, new WeakMap());
    }

    const pluginInjections = this.injectedContexts.get(pluginId)!;

    // Check if already injected
    if (pluginInjections.has(target)) {
      console.warn(`API already injected into target for plugin ${pluginId}`);
      return;
    }

    // Inject the API
    this.performInjection(pluginId, target, api);

    // Store the injection reference
    pluginInjections.set(target, api);

    console.log(`API injected successfully for plugin ${pluginId}`);
  }

  eject(pluginId: string, target: any): void {
    if (!target) {
      throw new Error(
        "Target object for API ejection cannot be null or undefined",
      );
    }

    const pluginInjections = this.injectedContexts.get(pluginId);
    if (!pluginInjections) {
      console.warn(`No injections found for plugin ${pluginId}`);
      return;
    }

    // Check if API was injected
    if (!pluginInjections.has(target)) {
      console.warn(`API not injected into target for plugin ${pluginId}`);
      return;
    }

    // Eject the API
    this.performEjection(pluginId, target);

    // Remove the injection reference
    pluginInjections.delete(target);

    // Clean up weak map if empty
    if (pluginInjections.size === 0) {
      this.injectedContexts.delete(pluginId);
    }

    console.log(`API ejected successfully for plugin ${pluginId}`);
  }

  isInjected(pluginId: string, target: any): boolean {
    const pluginInjections = this.injectedContexts.get(pluginId);
    return pluginInjections ? pluginInjections.has(target) : false;
  }

  validateInjection(pluginId: string, target: any): boolean {
    // Basic validation - can be extended based on requirements
    try {
      // Check if target is an object
      if (typeof target !== "object" || target === null) {
        console.error("Injection target must be an object");
        return false;
      }

      // Check if API context exists
      const api = this.contextManager.getContext(pluginId);
      if (!api) {
        console.error(`No API context found for plugin ${pluginId}`);
        return false;
      }

      // Check for conflicting properties
      const conflictingProps = this.getConflictingProperties(target, api);
      if (conflictingProps.length > 0) {
        console.warn(
          `Conflicting properties found for plugin ${pluginId}:`,
          conflictingProps,
        );
        // Allow injection but warn about conflicts
      }

      return true;
    } catch (error) {
      console.error(
        `Error during injection validation for plugin ${pluginId}:`,
        error,
      );
      return false;
    }
  }

  private performInjection(
    pluginId: string,
    target: any,
    api: RaycastAPI,
  ): void {
    // Define non-enumerable properties to avoid interference
    const injectionConfig = {
      enumerable: false,
      writable: false,
      configurable: true, // Allow removal during ejection
    };

    // Inject the API as a special property
    Object.defineProperty(target, "__RAYCAST_API__", {
      value: api,
      ...injectionConfig,
    });

    // Inject plugin ID for reference
    Object.defineProperty(target, "__RAYCAST_PLUGIN_ID__", {
      value: pluginId,
      ...injectionConfig,
    });

    // Optionally inject individual API components for easier access
    this.injectAPIComponents(target, api, injectionConfig);

    // Set up injection cleanup
    this.setupInjectionCleanup(pluginId, target, api);
  }

  private performEjection(pluginId: string, target: any): void {
    // Remove the main API property
    if (target.hasOwnProperty("__RAYCAST_API__")) {
      delete target.__RAYCAST_API__;
    }

    // Remove plugin ID
    if (target.hasOwnProperty("__RAYCAST_PLUGIN_ID__")) {
      delete target.__RAYCAST_PLUGIN_ID__;
    }

    // Remove individual API components
    this.ejectAPIComponents(target);

    // Clean up injection metadata
    this.cleanupInjectionMetadata(pluginId, target);
  }

  private injectAPIComponents(
    target: any,
    api: RaycastAPI,
    config: PropertyDescriptor,
  ): void {
    // Inject commonly used API components for easier access
    const components = [
      "List",
      "Detail",
      "Form",
      "Grid",
      "Action",
      "ActionPanel",
      "showToast",
      "showHUD",
      "open",
      "useNavigation",
      "usePersistentState",
      "Clipboard",
      "AI",
      "OAuth",
      "BrowserExtension",
      "Keyboard",
      "Color",
      "Icon",
      "Toast",
      "LaunchType",
    ];

    components.forEach((component) => {
      if (api.hasOwnProperty(component)) {
        Object.defineProperty(target, component, {
          value: (api as any)[component],
          ...config,
        });
      }
    });
  }

  private ejectAPIComponents(target: any): void {
    const components = [
      "List",
      "Detail",
      "Form",
      "Grid",
      "Action",
      "ActionPanel",
      "showToast",
      "showHUD",
      "open",
      "useNavigation",
      "usePersistentState",
      "Clipboard",
      "AI",
      "OAuth",
      "BrowserExtension",
      "Keyboard",
      "Color",
      "Icon",
      "Toast",
      "LaunchType",
    ];

    components.forEach((component) => {
      if (target.hasOwnProperty(component)) {
        delete target[component];
      }
    });
  }

  private setupInjectionCleanup(
    pluginId: string,
    target: any,
    api: RaycastAPI,
  ): void {
    // Set up cleanup function that will be called when plugin is destroyed
    const cleanupSymbol = Symbol("raycast_cleanup");

    Object.defineProperty(target, cleanupSymbol, {
      value: () => {
        console.log(`Cleaning up API injection for plugin ${pluginId}`);
        this.performEjection(pluginId, target);
      },
      enumerable: false,
      writable: false,
      configurable: true,
    });

    // Store cleanup symbol for later reference
    (target as any).__RAYCAST_CLEANUP__ = cleanupSymbol;
  }

  private cleanupInjectionMetadata(pluginId: string, target: any): void {
    // Remove cleanup function
    const cleanupSymbol = (target as any).__RAYCAST_CLEANUP__;
    if (cleanupSymbol && target.hasOwnProperty(cleanupSymbol)) {
      delete target[cleanupSymbol];
    }

    // Remove metadata
    if (target.hasOwnProperty("__RAYCAST_CLEANUP__")) {
      delete target.__RAYCAST_CLEANUP__;
    }
  }

  private getConflictingProperties(target: any, api: RaycastAPI): string[] {
    const conflicts: string[] = [];
    const apiProperties = Object.getOwnPropertyNames(api);
    const apiSymbols = Object.getOwnPropertySymbols(api);

    // Check for property conflicts
    apiProperties.forEach((prop) => {
      if (target.hasOwnProperty(prop)) {
        conflicts.push(prop);
      }
    });

    // Check for symbol conflicts
    apiSymbols.forEach((symbol) => {
      if (target.hasOwnProperty(symbol)) {
        conflicts.push(symbol.toString());
      }
    });

    return conflicts;
  }

  // ============================================================================
  // Advanced Injection Features
  // ============================================================================

  injectWithScope(pluginId: string, target: any, scope: string): void {
    // Scope-based injection for more granular control
    const api = this.contextManager.getContext(pluginId);
    if (!api) {
      throw new Error(`No API context found for plugin ${pluginId}`);
    }

    // Create scoped API wrapper
    const scopedAPI = this.createScopedAPI(api, scope);

    // Inject scoped API
    Object.defineProperty(target, "__RAYCAST_API__", {
      value: scopedAPI,
      enumerable: false,
      writable: false,
      configurable: true,
    });

    console.log(
      `Scoped API injected for plugin ${pluginId} with scope: ${scope}`,
    );
  }

  private createScopedAPI(api: RaycastAPI, scope: string): Partial<RaycastAPI> {
    // Create a scoped version of the API based on the requested scope
    switch (scope) {
      case "ui-only":
        return {
          List: api.List,
          Detail: api.Detail,
          Form: api.Form,
          Grid: api.Grid,
          Action: api.Action,
          ActionPanel: api.ActionPanel,
          Color: api.Color,
          Icon: api.Icon,
          Image: api.Image,
          Toast: api.Toast,
          LaunchType: api.LaunchType,
          environment: api.environment,
          useNavigation: api.useNavigation,
          usePersistentState: api.usePersistentState,
        };

      case "system-only":
        return {
          Clipboard: api.Clipboard,
          AI: api.AI,
          OAuth: api.OAuth,
          BrowserExtension: api.BrowserExtension,
          Keyboard: api.Keyboard,
          showToast: api.showToast,
          showHUD: api.showHUD,
          open: api.open,
          showInFinder: api.showInFinder,
          trash: api.trash,
          getPreferenceValues: api.getPreferenceValues,
          getSelectedText: api.getSelectedText,
          getSelectedFinderItems: api.getSelectedFinderItems,
          getApplications: api.getApplications,
          getDefaultApplication: api.getDefaultApplication,
          getFrontmostApplication: api.getFrontmostApplication,
        };

      default:
        return api;
    }
  }

  // ============================================================================
  // Cleanup and Maintenance
  // ============================================================================

  cleanup(): void {
    // Clean up all injection references
    this.injectedContexts.clear();
    console.log("API injector cleaned up");
  }

  getInjectionCount(pluginId: string): number {
    const pluginInjections = this.injectedContexts.get(pluginId);
    return pluginInjections ? pluginInjections.size : 0;
  }

  getTotalInjectionCount(): number {
    let total = 0;
    for (const pluginInjections of this.injectedContexts.values()) {
      total += pluginInjections.size;
    }
    return total;
  }

  getInjectedPlugins(): string[] {
    return Array.from(this.injectedContexts.keys());
  }

  // Debug method to inspect current injection state
  debugInfo(): any {
    return {
      injectedPlugins: this.getInjectedPlugins(),
      totalInjections: this.getTotalInjectionCount(),
      pluginDetails: Array.from(this.injectedContexts.entries()).map(
        ([pluginId, injections]) => ({
          pluginId,
          injectionCount: injections.size,
        }),
      ),
    };
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createAPIInjector(
  contextManager: APIContextManager,
): APIInjector {
  return new APIInjectorImpl(contextManager);
}

