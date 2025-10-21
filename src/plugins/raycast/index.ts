// ============================================================================
// Raycast Plugin System - Main Entry Point
// ============================================================================
// Complete Raycast API compatibility system based on design.md specifications

// Core API System
export * from './api';

// Component System
export * from './components';

// Mapping System
export * from './mapping';

// Shadow DOM System
export * from './shadow';

// Context and Execution
export * from './context';

// Types and Interfaces
export * from './types';

// Hooks
export * from './hooks';

// Constants
export * from './constants';

// Enhanced Plugin Manager
export { RaycastPluginManager } from './RaycastPluginManager';

// Re-export key types for convenience
export type {
  RaycastAPI,
  RaycastManifest,
  RaycastCommand,
  RaycastPlugin,
  PluginExecutionContext,
  PluginStateContext,
  NavigationManager,
  NavigationHook,
  RaycastAPIFactory,
  APIContextManager,
  ExtendedPluginInstance,
  ExtendedPluginMeta,
  ExtendedCommand
} from './types';

// ============================================================================
// Raycast System Configuration
// ============================================================================

export interface RaycastSystemConfig {
  // Component system
  enableShadowDOM: boolean;
  enableComponentValidation: boolean;
  enableCompatibilityLayer: boolean;
  
  // Performance
  enableVirtualScrolling: boolean;
  enableComponentMemoization: boolean;
  enableLazyLoading: boolean;
  
  // Security
  enablePermissionValidation: boolean;
  enableAPIValidation: boolean;
  enableSandboxing: boolean;
  
  // Development
  enableHotReloading: boolean;
  enableDebugging: boolean;
  enablePerformanceMonitoring: boolean;
  
  // Theme
  defaultTheme: 'light' | 'dark' | 'auto';
  customTheme?: any;
}

export const DEFAULT_RAYCAST_CONFIG: RaycastSystemConfig = {
  // Component system
  enableShadowDOM: true,
  enableComponentValidation: true,
  enableCompatibilityLayer: true,
  
  // Performance
  enableVirtualScrolling: true,
  enableComponentMemoization: true,
  enableLazyLoading: true,
  
  // Security
  enablePermissionValidation: true,
  enableAPIValidation: true,
  enableSandboxing: true,
  
  // Development
  enableHotReloading: typeof process !== 'undefined' && process.env?.NODE_ENV === 'development',
  enableDebugging: typeof process !== 'undefined' && process.env?.NODE_ENV === 'development',
  enablePerformanceMonitoring: typeof process !== 'undefined' && process.env?.NODE_ENV === 'development',
  
  // Theme
  defaultTheme: 'auto'
};

// ============================================================================
// Raycast System Manager
// ============================================================================

export class RaycastSystemManager {
  private config: RaycastSystemConfig;
  private apiFactory: any | null = null;
  private contextManager: any | null = null;
  private injector: any | null = null;
  private compatibilityLayer: any | null = null;
  private validator: any | null = null;
  private isInitialized = false;

  constructor(config: Partial<RaycastSystemConfig> = {}) {
    this.config = { ...DEFAULT_RAYCAST_CONFIG, ...config };
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.warn('Raycast system is already initialized');
      return;
    }

    try {
      console.log('Initializing Raycast plugin system...');

      // Initialize component system
      await this.initializeComponentSystem();

      // Initialize API system
      await this.initializeAPISystem();

      // Initialize compatibility layer
      if (this.config.enableCompatibilityLayer) {
        this.compatibilityLayer = new CompatibilityLayerImpl();
      }

      // Initialize validation
      if (this.config.enableAPIValidation) {
        // TODO: Inject actual permission manager
        this.validator = new APIValidatorImpl(null);
      }

      this.isInitialized = true;
      console.log('Raycast plugin system initialized successfully');

      // Emit initialization event
      window.dispatchEvent(new CustomEvent('raycast:system:initialized', {
        detail: { config: this.config }
      }));

    } catch (error) {
      console.error('Failed to initialize Raycast system:', error);
      throw error;
    }
  }

  private async initializeComponentSystem(): Promise<void> {
    // Initialize the mapping system
    const { initializeMappingSystem, getMappingSystem } = await import('./mapping');
    
    await initializeMappingSystem({
      enableShadowDOM: this.config.enableShadowDOM,
      enableThemeDetection: true,
      theme: this.config.customTheme
    });

    console.log('Component mapping system initialized');
  }

  private async initializeAPISystem(): Promise<void> {
    // Get the initialized mapping system
    const { getMappingSystem } = await import('./mapping');
    const mappingSystem = getMappingSystem();
    
    const componentFactory = mappingSystem.getFactory();
    const utilityFactory = null; // Will be implemented in next tasks

    if (componentFactory && utilityFactory) {
      this.apiFactory = new RaycastAPIFactoryImpl(componentFactory, utilityFactory);
      this.contextManager = new APIContextManagerImpl(this.apiFactory);
      this.injector = new APIInjectorImpl(this.contextManager);
    } else if (componentFactory) {
      // Initialize with component factory only for now
      console.log('Component factory initialized, utility factory pending');
    }
  }

  async shutdown(): Promise<void> {
    if (!this.isInitialized) {
      return;
    }

    console.log('Shutting down Raycast plugin system...');

    // Clean up contexts
    if (this.contextManager) {
      // TODO: Clean up all contexts
    }

    // Reset state
    this.apiFactory = null;
    this.contextManager = null;
    this.injector = null;
    this.compatibilityLayer = null;
    this.validator = null;
    this.isInitialized = false;

    console.log('Raycast plugin system shut down');

    // Emit shutdown event
    window.dispatchEvent(new CustomEvent('raycast:system:shutdown'));
  }

  getConfig(): RaycastSystemConfig {
    return { ...this.config };
  }

  updateConfig(updates: Partial<RaycastSystemConfig>): void {
    this.config = { ...this.config, ...updates };
    
    // Emit config update event
    window.dispatchEvent(new CustomEvent('raycast:system:config-updated', {
      detail: { config: this.config }
    }));
  }

  isSystemInitialized(): boolean {
    return this.isInitialized;
  }

  getAPIFactory(): any | null {
    return this.apiFactory;
  }

  getContextManager(): any | null {
    return this.contextManager;
  }

  getInjector(): any | null {
    return this.injector;
  }

  getCompatibilityLayer(): any | null {
    return this.compatibilityLayer;
  }

  getValidator(): any | null {
    return this.validator;
  }
}

// ============================================================================
// Global System Instance
// ============================================================================

let globalSystemManager: RaycastSystemManager | null = null;

export function getRaycastSystem(config?: Partial<RaycastSystemConfig>): RaycastSystemManager {
  if (!globalSystemManager) {
    globalSystemManager = new RaycastSystemManager(config);
  }
  return globalSystemManager;
}

export function initializeRaycastSystem(config?: Partial<RaycastSystemConfig>): Promise<void> {
  const system = getRaycastSystem(config);
  return system.initialize();
}

export function shutdownRaycastSystem(): Promise<void> {
  if (globalSystemManager) {
    return globalSystemManager.shutdown();
  }
  return Promise.resolve();
}

// ============================================================================
// Utility Functions
// ============================================================================

export function createRaycastAPI(pluginId: string): any | null {
  const system = getRaycastSystem();
  const contextManager = system.getContextManager();
  
  if (!contextManager) {
    console.error('Raycast system not initialized');
    return null;
  }

  return contextManager.createContext(pluginId);
}

export function destroyRaycastAPI(pluginId: string): void {
  const system = getRaycastSystem();
  const contextManager = system.getContextManager();
  
  if (contextManager) {
    contextManager.destroyContext(pluginId);
  }
}

export function injectRaycastAPI(pluginId: string, target: any): void {
  const system = getRaycastSystem();
  const injector = system.getInjector();
  
  if (injector) {
    injector.inject(pluginId, target);
  }
}

export function ejectRaycastAPI(pluginId: string, target: any): void {
  const system = getRaycastSystem();
  const injector = system.getInjector();
  
  if (injector) {
    injector.eject(pluginId, target);
  }
}

// ============================================================================
// Version Information
// ============================================================================

export const RAYCAST_SYSTEM_VERSION = '1.0.0';
export const RAYCAST_API_VERSION = '1.0.0';
export const SUPPORTED_RAYCAST_VERSION = '^1.0.0';

// ============================================================================
// Development Utilities
// ============================================================================

export function enableRaycastDebugging(): void {
  if (typeof window !== 'undefined') {
    (window as any).__RAYCAST_DEBUG__ = true;
    console.log('Raycast debugging enabled');
  }
}

export function disableRaycastDebugging(): void {
  if (typeof window !== 'undefined') {
    (window as any).__RAYCAST_DEBUG__ = false;
    console.log('Raycast debugging disabled');
  }
}

export function getRaycastDebugInfo(): any {
  const system = getRaycastSystem();
  return {
    version: RAYCAST_SYSTEM_VERSION,
    apiVersion: RAYCAST_API_VERSION,
    config: system.getConfig(),
    initialized: system.isSystemInitialized(),
    timestamp: new Date().toISOString()
  };
}