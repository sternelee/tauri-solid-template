import { ReactElement, Dispatch, SetStateAction } from 'react';
import {
  RaycastAPI,
  ToastOptions,
  Toast,
  NavigationHook,
  AIAPI,
  ClipboardAPI,
  OAuthAPI,
  BrowserExtensionAPI,
  KeyboardAPI,
  Environment,
  Application,
  CacheAPI,
  LocalStorageAPI,
  ListComponent,
  DetailComponent,
  FormComponent,
  GridComponent,
  ActionComponent,
  ActionPanelComponent
} from './types';

// ============================================================================
// Raycast API Factory
// ============================================================================

export interface RaycastAPIFactory {
  createAPI(pluginId: string): RaycastAPI;
  destroyAPI(pluginId: string): void;
}

export class RaycastAPIFactoryImpl implements RaycastAPIFactory {
  private apis: Map<string, RaycastAPI> = new Map();
  private componentFactory: any; // Will be injected
  private utilityFactory: any; // Will be injected

  constructor(
    componentFactory: any,
    utilityFactory: any
  ) {
    this.componentFactory = componentFactory;
    this.utilityFactory = utilityFactory;
  }

  createAPI(pluginId: string): RaycastAPI {
    if (this.apis.has(pluginId)) {
      return this.apis.get(pluginId)!;
    }

    const api = this.buildAPI(pluginId);
    this.apis.set(pluginId, api);
    return api;
  }

  destroyAPI(pluginId: string): void {
    this.apis.delete(pluginId);
  }

  private buildAPI(pluginId: string): RaycastAPI {
    return {
      // UI Components
      List: this.componentFactory.createListComponent(pluginId),
      Detail: this.componentFactory.createDetailComponent(pluginId),
      Form: this.componentFactory.createFormComponent(pluginId),
      Grid: this.componentFactory.createGridComponent(pluginId),
      Action: this.componentFactory.createActionComponent(pluginId),
      ActionPanel: this.componentFactory.createActionPanelComponent(pluginId),

      // Utility Functions
      showToast: this.utilityFactory.createShowToast(pluginId),
      showHUD: this.utilityFactory.createShowHUD(pluginId),
      open: this.utilityFactory.createOpen(pluginId),
      showInFinder: this.utilityFactory.createShowInFinder(pluginId),
      trash: this.utilityFactory.createTrash(pluginId),
      getPreferenceValues: this.utilityFactory.createGetPreferenceValues(pluginId),
      getSelectedText: this.utilityFactory.createGetSelectedText(pluginId),
      getSelectedFinderItems: this.utilityFactory.createGetSelectedFinderItems(pluginId),
      getApplications: this.utilityFactory.createGetApplications(pluginId),
      getDefaultApplication: this.utilityFactory.createGetDefaultApplication(pluginId),
      getFrontmostApplication: this.utilityFactory.createGetFrontmostApplication(pluginId),

      // Hooks
      useNavigation: this.utilityFactory.createUseNavigation(pluginId),
      usePersistentState: this.utilityFactory.createUsePersistentState(pluginId),

      // System APIs
      Clipboard: this.utilityFactory.createClipboardAPI(pluginId),
      AI: this.utilityFactory.createAIAPI(pluginId),
      OAuth: this.utilityFactory.createOAuthAPI(pluginId),
      BrowserExtension: this.utilityFactory.createBrowserExtensionAPI(pluginId),
      Keyboard: this.utilityFactory.createKeyboardAPI(pluginId),

      // Constants
      Color: this.utilityFactory.getColorConstants(),
      Icon: this.utilityFactory.getIconConstants(),
      Image: this.utilityFactory.getImageConstants(),
      Toast: this.utilityFactory.getToastConstants(),
      LaunchType: this.utilityFactory.getLaunchTypeConstants(),

      // Environment
      environment: this.utilityFactory.createEnvironment(pluginId),

      // Cache and Storage
      Cache: this.utilityFactory.createCacheAPI(pluginId),
      LocalStorage: this.utilityFactory.createLocalStorageAPI(pluginId)
    };
  }
}

// ============================================================================
// API Context Manager
// ============================================================================

export interface APIContextManager {
  createContext(pluginId: string): RaycastAPI;
  getContext(pluginId: string): RaycastAPI | undefined;
  destroyContext(pluginId: string): void;
  hasContext(pluginId: string): boolean;
}

export class APIContextManagerImpl implements APIContextManager {
  private contexts: Map<string, RaycastAPI> = new Map();
  private factory: RaycastAPIFactory;

  constructor(factory: RaycastAPIFactory) {
    this.factory = factory;
  }

  createContext(pluginId: string): RaycastAPI {
    if (this.contexts.has(pluginId)) {
      return this.contexts.get(pluginId)!;
    }

    const api = this.factory.createAPI(pluginId);
    this.contexts.set(pluginId, api);
    return api;
  }

  getContext(pluginId: string): RaycastAPI | undefined {
    return this.contexts.get(pluginId);
  }

  destroyContext(pluginId: string): void {
    this.factory.destroyAPI(pluginId);
    this.contexts.delete(pluginId);
  }

  hasContext(pluginId: string): boolean {
    return this.contexts.has(pluginId);
  }
}

// ============================================================================
// API Injection System
// ============================================================================

export interface APIInjector {
  inject(pluginId: string, target: any): void;
  eject(pluginId: string, target: any): void;
}

export class APIInjectorImpl implements APIInjector {
  private contextManager: APIContextManager;

  constructor(contextManager: APIContextManager) {
    this.contextManager = contextManager;
  }

  inject(pluginId: string, target: any): void {
    const api = this.contextManager.createContext(pluginId);
    
    // Inject API into global scope for the plugin
    if (typeof target === 'object' && target !== null) {
      Object.assign(target, api);
    }

    // Also make it available as a global for compatibility
    if (typeof window !== 'undefined') {
      (window as any).__RAYCAST_API__ = api;
    }
  }

  eject(pluginId: string, _target: any): void {
    this.contextManager.destroyContext(pluginId);
    
    // Clean up global references
    if (typeof window !== 'undefined') {
      delete (window as any).__RAYCAST_API__;
    }
  }
}

// ============================================================================
// API Compatibility Layer
// ============================================================================

export interface CompatibilityLayer {
  adaptLegacyPlugin(plugin: any): any;
  adaptLegacyCommand(command: any): any;
  adaptLegacyProps(props: any, componentType: string): any;
}

export class CompatibilityLayerImpl implements CompatibilityLayer {
  adaptLegacyPlugin(plugin: any): any {
    // Convert old plugin format to Raycast format
    if (plugin.meta && plugin.commands) {
      return {
        manifest: {
          name: plugin.meta.id,
          title: plugin.meta.name,
          description: plugin.meta.description || '',
          icon: 'icon.png', // Default icon
          author: plugin.meta.author || 'Unknown',
          commands: plugin.commands.map((cmd: any) => this.adaptLegacyCommand(cmd))
        }
      };
    }
    return plugin;
  }

  adaptLegacyCommand(command: any): any {
    return {
      name: command.id,
      title: command.title,
      description: command.description || '',
      mode: 'view' as const,
      keywords: command.keywords || []
    };
  }

  adaptLegacyProps(props: any, componentType: string): any {
    // Adapt props based on component type
    switch (componentType) {
      case 'List':
        return this.adaptListProps(props);
      case 'Detail':
        return this.adaptDetailProps(props);
      case 'Form':
        return this.adaptFormProps(props);
      case 'Grid':
        return this.adaptGridProps(props);
      default:
        return props;
    }
  }

  private adaptListProps(props: any): any {
    // Convert legacy list props to Raycast format
    return {
      ...props,
      searchBarPlaceholder: props.placeholder || 'Search...',
      filtering: props.enableFiltering !== false
    };
  }

  private adaptDetailProps(props: any): any {
    // Convert legacy detail props to Raycast format
    return {
      ...props,
      isLoading: props.loading || false
    };
  }

  private adaptFormProps(props: any): any {
    // Convert legacy form props to Raycast format
    return {
      ...props,
      navigationTitle: props.title || 'Form'
    };
  }

  private adaptGridProps(props: any): any {
    // Convert legacy grid props to Raycast format
    return {
      ...props,
      columns: props.columns || 5,
      inset: props.inset || 'medium'
    };
  }
}

// ============================================================================
// API Error Handling
// ============================================================================

export class APIError extends Error {
  constructor(
    message: string,
    public code: string,
    public pluginId?: string,
    public cause?: Error
  ) {
    super(message);
    this.name = 'APIError';
  }
}

export class APINotAvailableError extends APIError {
  constructor(apiName: string, pluginId?: string) {
    super(
      `API "${apiName}" is not available`,
      'API_NOT_AVAILABLE',
      pluginId
    );
    this.name = 'APINotAvailableError';
  }
}

export class APIPermissionError extends APIError {
  constructor(apiName: string, pluginId?: string) {
    super(
      `Permission denied for API "${apiName}"`,
      'API_PERMISSION_DENIED',
      pluginId
    );
    this.name = 'APIPermissionError';
  }
}

// ============================================================================
// API Validation
// ============================================================================

export interface APIValidator {
  validateAPICall(apiName: string, args: any[], pluginId: string): ValidationResult;
  validatePermissions(apiName: string, pluginId: string): boolean;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export class APIValidatorImpl implements APIValidator {
  private permissionManager: any; // Will be injected

  constructor(_permissionManager: any) {
    // TODO: Implement permission manager integration
  }

  validateAPICall(apiName: string, args: any[], pluginId: string): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check permissions
    if (!this.validatePermissions(apiName, pluginId)) {
      errors.push(`Permission denied for API "${apiName}"`);
    }

    // Validate arguments based on API
    const argValidation = this.validateArguments(apiName, args);
    errors.push(...argValidation.errors);
    warnings.push(...argValidation.warnings);

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  validatePermissions(_apiName: string, _pluginId: string): boolean {
    // TODO: Implement permission validation
    return true;
  }

  private validateArguments(_apiName: string, _args: any[]): ValidationResult {
    // TODO: Implement argument validation based on API
    return {
      isValid: true,
      errors: [],
      warnings: []
    };
  }
}

// ============================================================================
// Exports
// ============================================================================

export function createRaycastAPIFactory(
  componentFactory: any,
  utilityFactory: any
): RaycastAPIFactory {
  return new RaycastAPIFactoryImpl(componentFactory, utilityFactory);
}

export function createAPIContextManager(factory: RaycastAPIFactory): APIContextManager {
  return new APIContextManagerImpl(factory);
}

export function createAPIInjector(contextManager: APIContextManager): APIInjector {
  return new APIInjectorImpl(contextManager);
}

export function createCompatibilityLayer(): CompatibilityLayer {
  return new CompatibilityLayerImpl();
}

export function createAPIValidator(permissionManager: any): APIValidator {
  return new APIValidatorImpl(permissionManager);
}