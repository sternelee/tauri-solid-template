// ============================================================================
// Raycast API Context Manager Implementation
// ============================================================================
// Based on design.md requirements for plugin execution context and API injection

import * as React from "react";
import type {
  RaycastAPI,
  PluginExecutionContext,
  PluginStateContext,
  NavigationContext,
  NavigationManager,
} from "../types";
import type { RaycastAPIFactory } from "./factory";

// ============================================================================
// API Context Manager
// ============================================================================

export interface APIContextManager {
  createContext(pluginId: string, options: any): RaycastAPI;
  getContext(pluginId: string): RaycastAPI | undefined;
  destroyContext(pluginId: string): void;
  hasContext(pluginId: string): boolean;
  getAllContexts(): Map<string, RaycastAPI>;
}

export class APIContextManagerImpl implements APIContextManager {
  private contexts = new Map<string, RaycastAPI>();
  private apiFactory: RaycastAPIFactory;

  constructor(apiFactory: RaycastAPIFactory) {
    this.apiFactory = apiFactory;
  }

  createContext(pluginId: string, options: any): RaycastAPI {
    if (this.contexts.has(pluginId)) {
      console.warn(
        `Context for plugin ${pluginId} already exists, destroying existing context`,
      );
      this.destroyContext(pluginId);
    }

    const api = this.apiFactory.createAPI({
      pluginId,
      ...options,
    });

    this.contexts.set(pluginId, api);
    return api;
  }

  getContext(pluginId: string): RaycastAPI | undefined {
    return this.contexts.get(pluginId);
  }

  destroyContext(pluginId: string): void {
    const api = this.contexts.get(pluginId);
    if (api) {
      this.apiFactory.destroyAPI(pluginId);
      this.contexts.delete(pluginId);
    }
  }

  hasContext(pluginId: string): boolean {
    return this.contexts.has(pluginId);
  }

  getAllContexts(): Map<string, RaycastAPI> {
    return new Map(this.contexts);
  }

  // Cleanup all contexts
  cleanup(): void {
    for (const [pluginId] of Array.from(this.contexts.entries())) {
      this.destroyContext(pluginId);
    }
  }
}

// ============================================================================
// Plugin Execution Context Implementation
// ============================================================================

export class PluginExecutionContextImpl implements PluginExecutionContext {
  public shadowRoot: ShadowRoot | null = null;
  private cleanupFunctions: Array<() => void> = [];

  constructor(
    public pluginId: string,
    public api: RaycastAPI,
    public state: PluginStateContext,
    public navigation: NavigationContext,
  ) {}

  cleanup(): void {
    // Execute all cleanup functions
    this.cleanupFunctions.forEach((fn) => {
      try {
        fn();
      } catch (error) {
        console.error(
          `Error during cleanup for plugin ${this.pluginId}:`,
          error,
        );
      }
    });

    // Clear cleanup functions
    this.cleanupFunctions = [];

    // Clean up state
    this.state.cleanup();

    // Clear shadow root reference
    this.shadowRoot = null;
  }

  addCleanupFunction(fn: () => void): void {
    this.cleanupFunctions.push(fn);
  }

  removeCleanupFunction(fn: () => void): void {
    const index = this.cleanupFunctions.indexOf(fn);
    if (index > -1) {
      this.cleanupFunctions.splice(index, 1);
    }
  }
}

// ============================================================================
// Plugin State Context Implementation
// ============================================================================

export class PluginStateContextImpl implements PluginStateContext {
  public reactState = new Map<string, any>();
  public persistentState = new Map<string, any>();
  public hooks = new Map<string, any>();
  private cleanupFunctions: Array<() => void> = [];

  constructor(public pluginId: string) {}

  setReactState(key: string, value: any): void {
    this.reactState.set(key, value);
  }

  getReactState(key: string): any {
    return this.reactState.get(key);
  }

  setPersistentState(key: string, value: any): void {
    this.persistentState.set(key, value);
  }

  getPersistentState(key: string): any {
    return this.persistentState.get(key);
  }

  setHook(key: string, hook: any): void {
    this.hooks.set(key, hook);
  }

  getHook(key: string): any {
    return this.hooks.get(key);
  }

  addCleanupFunction(fn: () => void): void {
    this.cleanupFunctions.push(fn);
  }

  cleanup(): void {
    // Execute all cleanup functions
    this.cleanupFunctions.forEach((fn) => {
      try {
        fn();
      } catch (error) {
        console.error(
          `Error during state cleanup for plugin ${this.pluginId}:`,
          error,
        );
      }
    });

    // Clear all state
    this.reactState.clear();
    this.persistentState.clear();
    this.hooks.clear();
    this.cleanupFunctions = [];
  }
}

// ============================================================================
// Navigation Context Implementation
// ============================================================================

export interface NavigationEntry {
  component: React.ReactElement;
  title?: string;
  timestamp: number;
}

export class NavigationContextImpl implements NavigationContext {
  private navigationStack: NavigationEntry[] = [];
  private maxStackSize = 50; // Prevent unlimited growth

  constructor(public pluginId: string) {}

  push(component: React.ReactElement, title?: string): void {
    const entry: NavigationEntry = {
      component,
      title,
      timestamp: Date.now(),
    };

    this.navigationStack.push(entry);

    // Prevent unlimited stack growth
    if (this.navigationStack.length > this.maxStackSize) {
      this.navigationStack.shift();
    }

    console.log(
      `Navigation push for plugin ${this.pluginId}:`,
      title || "unnamed",
    );
  }

  pop(): void {
    if (this.navigationStack.length > 1) {
      this.navigationStack.pop();
      console.log(`Navigation pop for plugin ${this.pluginId}`);
    } else {
      console.warn(
        `Cannot pop from navigation stack for plugin ${this.pluginId}: at root`,
      );
    }
  }

  popToRoot(): void {
    if (this.navigationStack.length > 1) {
      this.navigationStack = [this.navigationStack[0]];
      console.log(`Navigation popToRoot for plugin ${this.pluginId}`);
    }
  }

  getCurrentView(): React.ReactElement | null {
    if (this.navigationStack.length === 0) {
      return null;
    }
    return this.navigationStack[this.navigationStack.length - 1].component;
  }

  getNavigationStack(): NavigationEntry[] {
    return [...this.navigationStack];
  }

  getStackSize(): number {
    return this.navigationStack.length;
  }

  canPop(): boolean {
    return this.navigationStack.length > 1;
  }

  clear(): void {
    this.navigationStack = [];
    console.log(`Navigation stack cleared for plugin ${this.pluginId}`);
  }
}

// ============================================================================
// Navigation Hook Implementation
// ============================================================================

export interface NavigationHook {
  push: (component: React.ReactElement, title?: string) => void;
  pop: () => void;
  popToRoot: () => void;
}

export class NavigationHookImpl implements NavigationHook {
  constructor(private navigationContext: NavigationContext) {}

  push(component: React.ReactElement, title?: string): void {
    this.navigationContext.push(component, title);
  }

  pop(): void {
    this.navigationContext.pop();
  }

  popToRoot(): void {
    this.navigationContext.popToRoot();
  }
}

// ============================================================================
// Navigation Manager Implementation
// ============================================================================

// Note: NavigationManager interface is defined in types.ts to avoid conflicts

export class NavigationManagerImpl implements NavigationManager {
  private contexts = new Map<string, NavigationContext>();

  createPluginContext(pluginId: string): NavigationContext {
    if (this.contexts.has(pluginId)) {
      console.warn(`Navigation context for plugin ${pluginId} already exists`);
      this.cleanupPluginContext(pluginId);
    }

    const context = new NavigationContextImpl(pluginId);
    this.contexts.set(pluginId, context);
    return context;
  }

  createNavigationHook(pluginId: string): NavigationHook {
    const context = this.contexts.get(pluginId);
    if (!context) {
      throw new Error(`Navigation context for plugin ${pluginId} not found`);
    }

    return new NavigationHookImpl(context);
  }

  cleanupPluginContext(pluginId: string): void {
    const context = this.contexts.get(pluginId);
    if (context) {
      context.clear();
      this.contexts.delete(pluginId);
    }
  }

  getPluginContext(pluginId: string): NavigationContext | undefined {
    return this.contexts.get(pluginId);
  }

  getAllContexts(): Map<string, NavigationContext> {
    return new Map(this.contexts);
  }

  cleanup(): void {
    for (const [pluginId] of Array.from(this.contexts.entries())) {
      this.cleanupPluginContext(pluginId);
    }
  }
}

// ============================================================================
// State Manager Implementation
// ============================================================================

export interface StateManager {
  createPluginStateContext(pluginId: string): PluginStateContext;
  destroyPluginStateContext(pluginId: string): void;
  getPluginStateContext(pluginId: string): PluginStateContext | undefined;
}

export class StateManagerImpl implements StateManager {
  private contexts = new Map<string, PluginStateContext>();

  createPluginStateContext(pluginId: string): PluginStateContext {
    if (this.contexts.has(pluginId)) {
      console.warn(`State context for plugin ${pluginId} already exists`);
      this.destroyPluginStateContext(pluginId);
    }

    const context = new PluginStateContextImpl(pluginId);
    this.contexts.set(pluginId, context);
    return context;
  }

  destroyPluginStateContext(pluginId: string): void {
    const context = this.contexts.get(pluginId);
    if (context) {
      context.cleanup();
      this.contexts.delete(pluginId);
    }
  }

  getPluginStateContext(pluginId: string): PluginStateContext | undefined {
    return this.contexts.get(pluginId);
  }

  getAllContexts(): Map<string, PluginStateContext> {
    return new Map(this.contexts);
  }

  cleanup(): void {
    for (const [pluginId] of Array.from(this.contexts.entries())) {
      this.destroyPluginStateContext(pluginId);
    }
  }
}

// ============================================================================
// Permission Manager Implementation (Basic Version)
// ============================================================================

export interface PermissionManager {
  validatePluginAccess(pluginId: string): void;
  checkPermission(pluginId: string, permission: string): boolean;
}

export class PermissionManagerImpl implements PermissionManager {
  private pluginPermissions = new Map<string, Set<string>>();

  setPluginPermissions(pluginId: string, permissions: string[]): void {
    this.pluginPermissions.set(pluginId, new Set(permissions));
  }

  validatePluginAccess(pluginId: string): void {
    // Basic validation - in a real implementation, this would check
    // against a permission manifest or configuration
    if (!this.pluginPermissions.has(pluginId)) {
      // Grant default permissions for new plugins
      this.pluginPermissions.set(pluginId, new Set(["basic"]));
    }
  }

  checkPermission(pluginId: string, permission: string): boolean {
    const permissions = this.pluginPermissions.get(pluginId);
    if (!permissions) {
      return false;
    }

    // Basic permission check - can be expanded
    return permissions.has("basic") || permissions.has(permission);
  }

  grantPermission(pluginId: string, permission: string): void {
    const permissions = this.pluginPermissions.get(pluginId) || new Set();
    permissions.add(permission);
    this.pluginPermissions.set(pluginId, permissions);
  }

  revokePermission(pluginId: string, permission: string): void {
    const permissions = this.pluginPermissions.get(pluginId);
    if (permissions) {
      permissions.delete(permission);
    }
  }

  getPluginPermissions(pluginId: string): string[] {
    const permissions = this.pluginPermissions.get(pluginId);
    return permissions ? Array.from(permissions) : [];
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

export function createAPIContextManager(
  apiFactory: RaycastAPIFactory,
): APIContextManager {
  return new APIContextManagerImpl(apiFactory);
}

export function createPluginExecutionContext(
  pluginId: string,
  api: RaycastAPI,
  state: PluginStateContext,
  navigation: NavigationContext,
): PluginExecutionContext {
  return new PluginExecutionContextImpl(pluginId, api, state, navigation);
}

export function createPluginStateContext(pluginId: string): PluginStateContext {
  return new PluginStateContextImpl(pluginId);
}

export function createNavigationContext(pluginId: string): NavigationContext {
  return new NavigationContextImpl(pluginId);
}

export function createNavigationHook(
  navigationContext: NavigationContext,
): NavigationHook {
  return new NavigationHookImpl(navigationContext);
}

export function createNavigationManager(): NavigationManager {
  return new NavigationManagerImpl();
}

export function createStateManager(): StateManager {
  return new StateManagerImpl();
}

export function createPermissionManager(): PermissionManager {
  return new PermissionManagerImpl();
}
