// ============================================================================
// Raycast Component Mapping System - Main Entry Point
// ============================================================================

// Core mapping exports
export * from './ComponentMappingConfig';
export * from './ComponentFactory';
export * from './PropsTransformer';
export * from './ComponentRenderer';

// Re-export key classes and functions
export {
  DEFAULT_COMPONENT_MAPPINGS,
  DEFAULT_MAPPING_CONFIG,
  createMappingConfig,
  mergeMappingConfigs,
  applyMappingOverrides
} from './ComponentMappingConfig';

export {
  SolidComponentFactory,
  createSolidComponentFactory
} from './ComponentFactory';

export {
  PropsTransformerImpl,
  ListPropsTransformer,
  FormPropsTransformer,
  GridPropsTransformer,
  ActionPropsTransformer,
  TransformationUtils,
  createPropsTransformer
} from './PropsTransformer';

export {
  SolidComponentRenderer,
  ThemeManager,
  createSolidComponentRenderer
} from './ComponentRenderer';

// ============================================================================
// Mapping System Manager
// ============================================================================

import { ComponentRenderer } from '../components';
import { SolidComponentFactory } from './ComponentFactory';
import { SolidComponentRenderer, ThemeManager } from './ComponentRenderer';
import { ComponentMappingConfig, DEFAULT_MAPPING_CONFIG } from './ComponentMappingConfig';

export interface MappingSystemConfig {
  theme?: any;
  customMappings?: any[];
  enableShadowDOM?: boolean;
  enableThemeDetection?: boolean;
}

export class MappingSystemManager {
  private renderer: ComponentRenderer;
  private factory: SolidComponentFactory;
  private themeManager: ThemeManager;
  private config: MappingSystemConfig;
  private isInitialized = false;

  constructor(config: MappingSystemConfig = {}) {
    this.config = {
      enableShadowDOM: true,
      enableThemeDetection: true,
      ...config
    };
    
    this.themeManager = ThemeManager.getInstance();
    this.renderer = new SolidComponentRenderer(config.theme);
    this.factory = new SolidComponentFactory(this.renderer);
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.warn('Mapping system is already initialized');
      return;
    }

    try {
      console.log('Initializing Raycast component mapping system...');

      // Setup theme detection if enabled
      if (this.config.enableThemeDetection) {
        this.setupThemeDetection();
      }

      // Register custom mappings if provided
      if (this.config.customMappings) {
        this.registerCustomMappings(this.config.customMappings);
      }

      this.isInitialized = true;
      console.log('Raycast component mapping system initialized successfully');

      // Emit initialization event
      window.dispatchEvent(new CustomEvent('raycast:mapping:initialized', {
        detail: { config: this.config }
      }));

    } catch (error) {
      console.error('Failed to initialize mapping system:', error);
      throw error;
    }
  }

  getRenderer(): ComponentRenderer {
    return this.renderer;
  }

  getFactory(): SolidComponentFactory {
    return this.factory;
  }

  getThemeManager(): ThemeManager {
    return this.themeManager;
  }

  isSystemInitialized(): boolean {
    return this.isInitialized;
  }

  private setupThemeDetection(): void {
    this.themeManager.onThemeChange((theme) => {
      // Update renderer with new theme
      console.log('Theme updated:', theme);
      
      // Emit theme change event
      window.dispatchEvent(new CustomEvent('raycast:theme:changed', {
        detail: { theme }
      }));
    });
  }

  private registerCustomMappings(mappings: any[]): void {
    // TODO: Implement custom mapping registration
    console.log('Registering custom mappings:', mappings);
  }
}

// ============================================================================
// Global Mapping System Instance
// ============================================================================

let globalMappingSystem: MappingSystemManager | null = null;

export function getMappingSystem(config?: MappingSystemConfig): MappingSystemManager {
  if (!globalMappingSystem) {
    globalMappingSystem = new MappingSystemManager(config);
  }
  return globalMappingSystem;
}

export function initializeMappingSystem(config?: MappingSystemConfig): Promise<void> {
  const system = getMappingSystem(config);
  return system.initialize();
}

// ============================================================================
// Utility Functions
// ============================================================================

export function createRaycastComponent(
  type: string, 
  props: any, 
  children?: any[]
): any {
  const system = getMappingSystem();
  if (!system.isSystemInitialized()) {
    console.warn('Mapping system not initialized, initializing now...');
    system.initialize();
  }
  
  const renderer = system.getRenderer();
  return renderer.renderComponent(type, props, children);
}

export function createShadowContainer(pluginId: string): ShadowRoot {
  const system = getMappingSystem();
  const renderer = system.getRenderer();
  return renderer.createShadowContainer(pluginId);
}

export function getCurrentTheme(): any {
  const system = getMappingSystem();
  const themeManager = system.getThemeManager();
  return themeManager.getCurrentTheme();
}

// ============================================================================
// Component Mapping Validation
// ============================================================================

export interface MappingValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export class MappingValidator {
  static validateMappingConfig(config: ComponentMappingConfig): MappingValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate mappings
    config.mappings.forEach((mapping, index) => {
      if (!mapping.raycastType) {
        errors.push(`Mapping at index ${index} is missing raycastType`);
      }
      
      if (!mapping.shadcnComponent) {
        errors.push(`Mapping at index ${index} is missing shadcnComponent`);
      }

      // Check for duplicate raycast types
      const duplicates = config.mappings.filter(m => m.raycastType === mapping.raycastType);
      if (duplicates.length > 1) {
        warnings.push(`Duplicate mapping found for raycastType: ${mapping.raycastType}`);
      }
    });

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  static validateComponentProps(componentType: string, props: any): MappingValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Basic prop validation
    if (typeof props !== 'object' || props === null) {
      errors.push('Props must be an object');
      return { isValid: false, errors, warnings };
    }

    // Component-specific validation
    switch (componentType) {
      case 'List.Item':
        if (!props.title) {
          errors.push('List.Item requires a title prop');
        }
        break;
      
      case 'Form.TextField':
        if (!props.id) {
          errors.push('Form.TextField requires an id prop');
        }
        break;
      
      case 'Grid.Item':
        if (!props.content && !props.title) {
          warnings.push('Grid.Item should have either content or title');
        }
        break;
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }
}

// ============================================================================
// Development Utilities
// ============================================================================

export function enableMappingDebugging(): void {
  if (typeof window !== 'undefined') {
    (window as any).__RAYCAST_MAPPING_DEBUG__ = true;
    console.log('Raycast mapping debugging enabled');
  }
}

export function disableMappingDebugging(): void {
  if (typeof window !== 'undefined') {
    (window as any).__RAYCAST_MAPPING_DEBUG__ = false;
    console.log('Raycast mapping debugging disabled');
  }
}

export function getMappingDebugInfo(): any {
  const system = getMappingSystem();
  return {
    initialized: system.isSystemInitialized(),
    theme: system.getThemeManager().getCurrentTheme(),
    mappings: DEFAULT_MAPPING_CONFIG,
    timestamp: new Date().toISOString()
  };
}

// ============================================================================
// Version Information
// ============================================================================

export const MAPPING_SYSTEM_VERSION = '1.0.0';
export const SUPPORTED_RAYCAST_COMPONENTS = [
  'List', 'List.Item', 'List.Section', 'List.EmptyView',
  'Detail', 'Detail.Metadata', 'Detail.Metadata.Label',
  'Form', 'Form.TextField', 'Form.TextArea', 'Form.Dropdown',
  'Grid', 'Grid.Item', 'Grid.Section', 'Grid.EmptyView',
  'Action', 'ActionPanel', 'Action.Push', 'Action.CopyToClipboard'
];

console.log(`Raycast Mapping System v${MAPPING_SYSTEM_VERSION} loaded`);
console.log(`Supported components: ${SUPPORTED_RAYCAST_COMPONENTS.length}`);