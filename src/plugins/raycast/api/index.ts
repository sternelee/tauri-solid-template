// ============================================================================
// Raycast API Implementation - Main Entry Point
// ============================================================================
// Based on design.md requirements for complete Raycast API surface
// Integrated with Tauri plugins for native system access

import * as React from "react";
import type {
  RaycastAPI,
  RaycastAPIOptions,
  RaycastManifest,
  PluginExecutionContext,
} from "../types";

// Import API implementation components
import { RaycastAPIFactory, initializeRaycastAPIFactory } from "./factory";
import {
  APIContextManager,
  createAPIContextManager,
  PluginExecutionContextImpl,
  NavigationManagerImpl,
  StateManagerImpl,
  PermissionManagerImpl,
} from "./context";
import { APIInjector, createAPIInjector } from "./injector";
import { APIValidator, createAPIValidator } from "./validator";
import {
  CompatibilityLayer,
  createCompatibilityLayer,
  detectLegacyPatterns,
  estimateMigrationEffort,
} from "./compatibility";

// Import Tauri-adapted API implementations
import { Clipboard } from "./clipboard";
import { AI } from "./ai";
import { Cache, CacheManager } from "./cache";
import {
  environment,
  refreshEnvironment,
  environmentUtils,
} from "./environment";
import { RaycastTauriBridge } from "./tauri-bridge";

// Import additional APIs
import { BrowserExtension } from "./browserExtension";
import { OAuth } from "./oauth";
import { showToast, showHUD } from "./toast";
import { Keyboard } from "./keyboard";

// ============================================================================
// Raycast API System Manager
// ============================================================================

export interface RaycastAPISystemConfig {
  enableValidation: boolean;
  enableCompatibilityLayer: boolean;
  enableDebugMode: boolean;
  maxPluginContexts: number;
  defaultPermissions: string[];
}

export class RaycastAPISystem {
  private factory: RaycastAPIFactory;
  private contextManager: APIContextManager;
  private injector: APIInjector;
  private validator: APIValidator;
  private compatibilityLayer: CompatibilityLayer;
  private config: RaycastAPISystemConfig;
  private isInitialized = false;

  constructor(config: Partial<RaycastAPISystemConfig> = {}) {
    this.config = {
      enableValidation: true,
      enableCompatibilityLayer: true,
      enableDebugMode: false,
      maxPluginContexts: 100,
      defaultPermissions: ["basic"],
      ...config,
    };

    // Initialize managers
    const stateManager = new StateManagerImpl();
    const navigationManager = new NavigationManagerImpl();
    const permissionManager = new PermissionManagerImpl();

    // Initialize factory
    this.factory = initializeRaycastAPIFactory(
      stateManager,
      navigationManager,
      permissionManager,
    );

    // Initialize context manager
    this.contextManager = createAPIContextManager(this.factory);

    // Initialize injector
    this.injector = createAPIInjector(this.contextManager);

    // Initialize validator
    this.validator = createAPIValidator(permissionManager);

    // Initialize compatibility layer
    this.compatibilityLayer = createCompatibilityLayer();
  }

  // ============================================================================
  // System Initialization and Management
  // ============================================================================

  initialize(): void {
    if (this.isInitialized) {
      console.warn("Raycast API system already initialized");
      return;
    }

    try {
      console.log("Initializing Raycast API system...");

      // Set up global error handlers
      this.setupErrorHandlers();

      // Initialize debug mode if enabled
      if (this.config.enableDebugMode) {
        this.setupDebugMode();
      }

      this.isInitialized = true;
      console.log("Raycast API system initialized successfully");

      // Emit initialization event
      window.dispatchEvent(
        new CustomEvent("raycast:api:initialized", {
          detail: { config: this.config },
        }),
      );
    } catch (error) {
      console.error("Failed to initialize Raycast API system:", error);
      throw error;
    }
  }

  shutdown(): void {
    if (!this.isInitialized) {
      return;
    }

    console.log("Shutting down Raycast API system...");

    // Clean up all contexts
    this.contextManager.cleanup();

    // Clean up injector
    this.injector.cleanup();

    this.isInitialized = false;
    console.log("Raycast API system shut down");

    // Emit shutdown event
    window.dispatchEvent(new CustomEvent("raycast:api:shutdown"));
  }

  // ============================================================================
  // API Context Management
  // ============================================================================

  createAPI(
    pluginId: string,
    options: Partial<RaycastAPIOptions> = {},
  ): RaycastAPI {
    this.ensureInitialized();

    const fullOptions: RaycastAPIOptions = {
      pluginId,
      preferences: {},
      environment: {
        commandName: "default",
        extensionName: pluginId,
        isDevelopment: true,
      },
      ...options,
    };

    // Validate if enabled
    if (this.config.enableValidation) {
      this.validatePluginOptions(fullOptions);
    }

    return this.contextManager.createContext(pluginId, fullOptions);
  }

  destroyAPI(pluginId: string): void {
    this.ensureInitialized();
    this.contextManager.destroyContext(pluginId);
  }

  getAPI(pluginId: string): RaycastAPI | undefined {
    this.ensureInitialized();
    return this.contextManager.getContext(pluginId);
  }

  hasAPI(pluginId: string): boolean {
    this.ensureInitialized();
    return this.contextManager.hasContext(pluginId);
  }

  // ============================================================================
  // API Injection
  // ============================================================================

  injectAPI(pluginId: string, target: any): void {
    this.ensureInitialized();
    this.injector.inject(pluginId, target);
  }

  ejectAPI(pluginId: string, target: any): void {
    this.ensureInitialized();
    this.injector.eject(pluginId, target);
  }

  isAPIInjected(pluginId: string, target: any): boolean {
    this.ensureInitialized();
    return this.injector.isInjected(pluginId, target);
  }

  // ============================================================================
  // Plugin Migration and Compatibility
  // ============================================================================

  migratePlugin(pluginCode: string, manifest: RaycastManifest) {
    if (!this.config.enableCompatibilityLayer) {
      throw new Error("Compatibility layer is disabled");
    }

    return this.compatibilityLayer.migratePlugin(pluginCode, manifest);
  }

  validateCompatibility(manifest: RaycastManifest) {
    if (!this.config.enableCompatibilityLayer) {
      throw new Error("Compatibility layer is disabled");
    }

    return this.compatibilityLayer.validateCompatibility(manifest);
  }

  generateMigrationGuide(manifest: RaycastManifest) {
    if (!this.config.enableCompatibilityLayer) {
      throw new Error("Compatibility layer is disabled");
    }

    return this.compatibilityLayer.generateMigrationGuide(manifest);
  }

  wrapPluginFunction(pluginFunction: Function, api: RaycastAPI): Function {
    if (!this.config.enableCompatibilityLayer) {
      return pluginFunction;
    }

    return this.compatibilityLayer.wrapPluginFunction(pluginFunction, api);
  }

  handleLegacyAPI(legacyAPI: any): RaycastAPI {
    if (!this.config.enableCompatibilityLayer) {
      throw new Error("Compatibility layer is disabled");
    }

    return this.compatibilityLayer.handleLegacyAPI(legacyAPI);
  }

  // ============================================================================
  // Plugin Validation
  // ============================================================================

  validateManifest(manifest: RaycastManifest) {
    if (!this.config.enableValidation) {
      return { isValid: true, errors: [], warnings: [] };
    }

    return this.validator.validateManifest(manifest);
  }

  validateAPIUsage(pluginId: string, apiUsage: any) {
    if (!this.config.enableValidation) {
      return { isValid: true, errors: [], warnings: [] };
    }

    return this.validator.validateAPIUsage(pluginId, apiUsage);
  }

  validateComponentUsage(pluginId: string, component: string, props: any) {
    if (!this.config.enableValidation) {
      return { isValid: true, errors: [], warnings: [] };
    }

    return this.validator.validateComponentUsage(pluginId, component, props);
  }

  // ============================================================================
  // System Information and Debugging
  // ============================================================================

  getSystemInfo(): any {
    return {
      isInitialized: this.isInitialized,
      config: this.config,
      contextCount: this.contextManager.getAllContexts().size,
      injectionCount: this.injector.getTotalInjectionCount(),
      injectedPlugins: this.injector.getInjectedPlugins(),
      debugMode: this.config.enableDebugMode,
    };
  }

  getDebugInfo(): any {
    if (!this.config.enableDebugMode) {
      return { error: "Debug mode is not enabled" };
    }

    return {
      ...this.getSystemInfo(),
      injectorDebugInfo: this.injector.debugInfo(),
      timestamp: new Date().toISOString(),
    };
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  private ensureInitialized(): void {
    if (!this.isInitialized) {
      throw new Error(
        "Raycast API system not initialized. Call initialize() first.",
      );
    }
  }

  private validatePluginOptions(options: RaycastAPIOptions): void {
    if (!options.pluginId || typeof options.pluginId !== "string") {
      throw new Error("Plugin ID is required and must be a string");
    }

    if (options.pluginId.length > 100) {
      throw new Error("Plugin ID must be less than 100 characters");
    }

    if (!/^[a-z0-9-_]+$/.test(options.pluginId)) {
      throw new Error(
        "Plugin ID must contain only lowercase letters, numbers, hyphens, and underscores",
      );
    }
  }

  private setupErrorHandlers(): void {
    // Global error handler for Raycast API errors
    window.addEventListener("error", (event) => {
      if (event.message && event.message.includes("Raycast")) {
        console.error("Raycast API Error:", event.error);
      }
    });

    // Unhandled promise rejection handler
    window.addEventListener("unhandledrejection", (event) => {
      if (
        event.reason &&
        event.reason.message &&
        event.reason.message.includes("Raycast")
      ) {
        console.error("Unhandled Raycast API Promise Rejection:", event.reason);
      }
    });
  }

  private setupDebugMode(): void {
    // Add debug methods to global scope
    (window as any).__RAYCAST_DEBUG__ = {
      getSystemInfo: () => this.getSystemInfo(),
      getDebugInfo: () => this.getDebugInfo(),
      getContexts: () =>
        Array.from(this.contextManager.getAllContexts().keys()),
      getInjectorInfo: () => this.injector.debugInfo(),
    };

    console.log(
      "Raycast API debug mode enabled. Use window.__RAYCAST_DEBUG__ to access debug functions.",
    );
  }
}

// ============================================================================
// Global System Instance
// ============================================================================

let globalAPISystem: RaycastAPISystem | null = null;

export function getRaycastAPISystem(
  config?: Partial<RaycastAPISystemConfig>,
): RaycastAPISystem {
  if (!globalAPISystem) {
    globalAPISystem = new RaycastAPISystem(config);
  }
  return globalAPISystem;
}

export function initializeRaycastAPISystem(
  config?: Partial<RaycastAPISystemConfig>,
): RaycastAPISystem {
  const system = getRaycastAPISystem(config);
  system.initialize();
  return system;
}

export function shutdownRaycastAPISystem(): void {
  if (globalAPISystem) {
    globalAPISystem.shutdown();
    globalAPISystem = null;
  }
}

// ============================================================================
// Convenience Functions (backward compatibility)
// ============================================================================

export function createRaycastAPI(
  pluginId: string,
  options?: Partial<RaycastAPIOptions>,
): RaycastAPI {
  const system = getRaycastAPISystem();
  if (!system.isInitialized) {
    console.warn(
      "Raycast API system not initialized, initializing with default config...",
    );
    system.initialize();
  }
  return system.createAPI(pluginId, options);
}

export function destroyRaycastAPI(pluginId: string): void {
  const system = getRaycastAPISystem();
  if (system && system.isInitialized) {
    system.destroyAPI(pluginId);
  }
}

export function getRaycastAPI(pluginId: string): RaycastAPI | undefined {
  const system = getRaycastAPISystem();
  return system?.isInitialized ? system.getAPI(pluginId) : undefined;
}

export function injectRaycastAPI(pluginId: string, target: any): void {
  const system = getRaycastAPISystem();
  if (system && system.isInitialized) {
    system.injectAPI(pluginId, target);
  }
}

export function ejectRaycastAPI(pluginId: string, target: any): void {
  const system = getRaycastAPISystem();
  if (system && system.isInitialized) {
    system.ejectAPI(pluginId, target);
  }
}

// ============================================================================
// Exports
// ============================================================================

export {
  // System classes
  RaycastAPISystem,
  RaycastAPIFactory,

  // Manager classes
  APIContextManager,
  APIInjector,
  APIValidator,
  CompatibilityLayer,

  // Factory functions
  createAPIContextManager,
  createAPIInjector,
  createAPIValidator,
  createCompatibilityLayer,

  // Utility functions
  detectLegacyPatterns,
  estimateMigrationEffort,

  // Tauri-adapted API implementations
  Clipboard,
  AI,
  Cache,
  CacheManager,
  environment,
  refreshEnvironment,
  environmentUtils,
  RaycastTauriBridge,

  // Additional API implementations
  BrowserExtension,
  OAuth,
  showToast,
  showHUD,
  Keyboard,
};

// Re-export types
export type {
  RaycastAPI,
  RaycastAPIOptions,
  PluginExecutionContext,
  RaycastManifest,
  RaycastAPISystemConfig,
};

// Re-export from compatibility layer
export type {
  MigratedPlugin,
  CompatibilityReport,
  MigrationGuide,
  CompatibilityIssue,
  MigrationStep,
  MigrationExample,
};

// Re-export Tauri API types
export type {
  SystemInfo,
  ApplicationInfo,
  OpenOptions,
  NotificationOptions,
  FileInfo,
  AIRequest,
  AIResponse,
} from "./tauri-bridge";

// Re-export from individual APIs
export type { ClipboardContent, AskOptions, AskResult, Creativity } from "./ai";

export type { CacheOptions, CacheEntry } from "./cache";
