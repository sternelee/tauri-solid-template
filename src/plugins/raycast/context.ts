import { ReactElement } from 'react';
import { 
  RaycastAPI, 
  PluginExecutionContext, 
  PluginStateContext, 
  NavigationManager,
  NavigationEntry,
  NavigationHook,
  RaycastManifest,
  RaycastCommand,
  RaycastPlugin,
  RaycastCommandHandler
} from './types';

// ============================================================================
// Plugin Execution Context Implementation
// ============================================================================

export class PluginExecutionContextImpl implements PluginExecutionContext {
  public pluginId: string;
  public api: RaycastAPI;
  public state: PluginStateContext;
  public navigation: NavigationManager;
  public shadowRoot: ShadowRoot;
  
  private cleanupCallbacks: Set<() => void> = new Set();

  constructor(
    pluginId: string,
    api: RaycastAPI,
    state: PluginStateContext,
    navigation: NavigationManager,
    shadowRoot: ShadowRoot
  ) {
    this.pluginId = pluginId;
    this.api = api;
    this.state = state;
    this.navigation = navigation;
    this.shadowRoot = shadowRoot;
  }

  cleanup(): void {
    // Execute all cleanup callbacks
    this.cleanupCallbacks.forEach(callback => {
      try {
        callback();
      } catch (error) {
        console.error(`Cleanup callback failed for plugin "${this.pluginId}":`, error);
      }
    });
    
    // Clear callbacks
    this.cleanupCallbacks.clear();
    
    // Clear state
    this.state.reactState.clear();
    this.state.hooks.clear();
    
    // Note: persistent state is intentionally not cleared
  }

  addCleanupCallback(callback: () => void): void {
    this.cleanupCallbacks.add(callback);
  }

  removeCleanupCallback(callback: () => void): void {
    this.cleanupCallbacks.delete(callback);
  }
}

// ============================================================================
// Plugin State Context Implementation
// ============================================================================

export class PluginStateContextImpl implements PluginStateContext {
  public reactState: Map<string, any> = new Map();
  public persistentState: Map<string, any> = new Map();
  public hooks: Map<string, any> = new Map();

  constructor(private pluginId: string) {}

  // React state management
  setReactState(key: string, value: any): void {
    this.reactState.set(key, value);
  }

  getReactState(key: string): any {
    return this.reactState.get(key);
  }

  clearReactState(): void {
    this.reactState.clear();
  }

  // Persistent state management
  setPersistentState(key: string, value: any): void {
    this.persistentState.set(key, value);
    // TODO: Persist to storage backend
    this.persistToStorage(key, value);
  }

  getPersistentState(key: string): any {
    return this.persistentState.get(key);
  }

  // Hook state management
  setHookState(hookId: string, state: any): void {
    this.hooks.set(hookId, state);
  }

  getHookState(hookId: string): any {
    return this.hooks.get(hookId);
  }

  clearHookState(): void {
    this.hooks.clear();
  }

  private async persistToStorage(key: string, value: any): Promise<void> {
    try {
      const storageKey = `plugin:${this.pluginId}:${key}`;
      localStorage.setItem(storageKey, JSON.stringify(value));
    } catch (error) {
      console.error(`Failed to persist state for plugin "${this.pluginId}":`, error);
    }
  }

  async loadFromStorage(key: string): Promise<any> {
    try {
      const storageKey = `plugin:${this.pluginId}:${key}`;
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const value = JSON.parse(stored);
        this.persistentState.set(key, value);
        return value;
      }
    } catch (error) {
      console.error(`Failed to load state for plugin "${this.pluginId}":`, error);
    }
    return undefined;
  }
}

// ============================================================================
// Navigation Manager Implementation
// ============================================================================

export class NavigationManagerImpl implements NavigationManager {
  private navigationStack: NavigationEntry[] = [];
  private navigationHooks: Map<string, NavigationHook> = new Map();

  constructor(private pluginId: string) {}

  push(component: ReactElement, title?: string): void {
    const entry: NavigationEntry = {
      component,
      title,
      timestamp: Date.now()
    };
    
    this.navigationStack.push(entry);
    this.notifyHooks('push', entry);
  }

  pop(): void {
    if (this.navigationStack.length > 1) {
      const popped = this.navigationStack.pop();
      this.notifyHooks('pop', popped);
    }
  }

  popToRoot(): void {
    if (this.navigationStack.length > 1) {
      const root = this.navigationStack[0];
      this.navigationStack = [root];
      this.notifyHooks('popToRoot', root);
    }
  }

  getCurrentView(): ReactElement | null {
    const current = this.navigationStack[this.navigationStack.length - 1];
    return current?.component || null;
  }

  getNavigationStack(): NavigationEntry[] {
    return [...this.navigationStack];
  }

  createNavigationHook(pluginId: string): NavigationHook {
    const hook: NavigationHook = {
      push: (component: ReactElement, title?: string) => this.push(component, title),
      pop: () => this.pop(),
      popToRoot: () => this.popToRoot()
    };

    this.navigationHooks.set(pluginId, hook);
    return hook;
  }

  private notifyHooks(action: string, entry?: NavigationEntry): void {
    // Emit navigation events for UI updates
    window.dispatchEvent(new CustomEvent('plugin:navigation', {
      detail: {
        pluginId: this.pluginId,
        action,
        entry,
        stack: this.navigationStack
      }
    }));
  }

  cleanup(): void {
    this.navigationStack = [];
    this.navigationHooks.clear();
  }
}

// ============================================================================
// Raycast Plugin Implementation
// ============================================================================

export class RaycastPluginImpl implements RaycastPlugin {
  public manifest: RaycastManifest;
  public commands: Map<string, RaycastCommandHandler> = new Map();
  public preferences?: any[];

  constructor(manifest: RaycastManifest) {
    this.manifest = manifest;
    this.preferences = manifest.preferences;
  }

  addCommand(command: RaycastCommand, handler: () => ReactElement | Promise<ReactElement>): void {
    this.commands.set(command.name, {
      command,
      handler
    });
  }

  getCommand(commandName: string): RaycastCommandHandler | undefined {
    return this.commands.get(commandName);
  }

  getAllCommands(): RaycastCommandHandler[] {
    return Array.from(this.commands.values());
  }

  hasCommand(commandName: string): boolean {
    return this.commands.has(commandName);
  }
}

// ============================================================================
// Context Factory Functions
// ============================================================================

export function createPluginExecutionContext(
  pluginId: string,
  api: RaycastAPI,
  shadowRoot: ShadowRoot
): PluginExecutionContext {
  const state = new PluginStateContextImpl(pluginId);
  const navigation = new NavigationManagerImpl(pluginId);
  
  return new PluginExecutionContextImpl(
    pluginId,
    api,
    state,
    navigation,
    shadowRoot
  );
}

export function createPluginStateContext(pluginId: string): PluginStateContext {
  return new PluginStateContextImpl(pluginId);
}

export function createNavigationManager(pluginId: string): NavigationManager {
  return new NavigationManagerImpl(pluginId);
}

export function createRaycastPlugin(manifest: RaycastManifest): RaycastPlugin {
  return new RaycastPluginImpl(manifest);
}

// ============================================================================
// Context Utilities
// ============================================================================

export class ContextManager {
  private contexts: Map<string, PluginExecutionContext> = new Map();

  createContext(
    pluginId: string,
    api: RaycastAPI,
    shadowRoot: ShadowRoot
  ): PluginExecutionContext {
    const context = createPluginExecutionContext(pluginId, api, shadowRoot);
    this.contexts.set(pluginId, context);
    return context;
  }

  getContext(pluginId: string): PluginExecutionContext | undefined {
    return this.contexts.get(pluginId);
  }

  destroyContext(pluginId: string): void {
    const context = this.contexts.get(pluginId);
    if (context) {
      context.cleanup();
      this.contexts.delete(pluginId);
    }
  }

  getAllContexts(): PluginExecutionContext[] {
    return Array.from(this.contexts.values());
  }

  cleanup(): void {
    this.contexts.forEach(context => context.cleanup());
    this.contexts.clear();
  }
}

// Singleton context manager
export const contextManager = new ContextManager();