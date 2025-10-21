// ============================================================================
// Raycast Component Utilities
// ============================================================================
// Utility functions for working with Raycast components in Shadow DOM

import { render } from 'solid-js/web';
import type { Component, JSX } from 'solid-js';
import type {
  ShadowDOMConfig,
  ShadowDOMRenderer,
  PluginComponentContext,
  ComponentRenderingOptions,
  ComponentType,
  ComponentMetadata,
} from '../types';
import {
  createShadowDOMFactory,
  createShadowDOMConfig,
  defaultShadowDOMConfig,
} from '../shadow-dom-adapter';
import type { RaycastAPI } from '../../api/types';

// ============================================================================
// Component Renderer Factory
// ============================================================================

const shadowDOMFactory = createShadowDOMFactory();

/**
 * Creates a component renderer with Shadow DOM isolation
 */
export function createComponentRenderer(
  container: HTMLElement,
  config: Partial<ShadowDOMConfig>,
  api: RaycastAPI
): ShadowDOMRenderer {
  const fullConfig = createShadowDOMConfig('default', config);
  const validation = validateShadowDOMConfig(fullConfig);

  if (!validation.isValid) {
    throw new Error(
      `Invalid Shadow DOM configuration: ${validation.errors.join(', ')}`
    );
  }

  return shadowDOMFactory.createRenderer(container, fullConfig, api);
}

/**
 * Renders a component in a Shadow DOM container
 */
export function renderComponentInShadowDOM(
  component: Component<any>,
  options: ComponentRenderingOptions = {}
): {
  container: HTMLElement;
  renderer: ShadowDOMRenderer;
  element: HTMLElement | null;
  destroy: () => void;
} {
  // Default API (would be injected by plugin system)
  const defaultAPI: Partial<RaycastAPI> = {
    List: {} as any,
    Detail: {} as any,
    Form: {} as any,
    Grid: {} as any,
    Action: {} as any,
    ActionPanel: {} as any,
    showToast: async () => {},
    showHUD: async () => {},
    open: async () => {},
  };

  // Create container if not provided
  const container = options.container || document.createElement('div');
  container.style.width = '100%';
  container.style.height = '100%';

  // Create renderer
  const renderer = createComponentRenderer(
    container,
    {
      ...defaultShadowDOMConfig,
      ...options.shadowDOMConfig,
      pluginId: options.shadowDOMConfig?.pluginId || 'unknown',
    },
    defaultAPI as RaycastAPI
  );

  // Render component
  renderer.render(component);

  // Get rendered element
  const element = renderer.getRenderedElement();

  // Setup cleanup
  const destroy = () => {
    renderer.destroy();
    if (options.onDestroy) {
      options.onDestroy();
    }
  };

  // Auto-mount if enabled
  if (options.autoMount !== false && !container.parentElement) {
    document.body.appendChild(container);
  }

  // Call render callback
  if (options.onRender && element) {
    options.onRender(element);
  }

  return {
    container,
    renderer,
    element,
    destroy,
  };
}

/**
 * Creates a plugin component context
 */
export function createPluginComponentContext(
  pluginId: string,
  api: RaycastAPI,
  options: ComponentRenderingOptions = {}
): PluginComponentContext {
  let currentRenderer: ShadowDOMRenderer | null = null;
  let currentContainer: HTMLElement | null = null;

  const context: PluginComponentContext = {
    pluginId,
    api,
    shadowRoot: null as any,

    renderComponent: (component, config = {}) => {
      // Clean up previous render
      if (currentRenderer) {
        context.destroyComponent();
      }

      // Create new container
      currentContainer = document.createElement('div');
      currentContainer.id = `raycast-plugin-${pluginId}`;
      currentContainer.style.width = '100%';
      currentContainer.style.height = '100%';

      // Merge configs
      const mergedConfig = {
        ...options.shadowDOMConfig,
        ...config,
        pluginId,
      };

      // Render component
      const renderResult = renderComponentInShadowDOM(component, {
        ...options,
        container: currentContainer,
        shadowDOMConfig: mergedConfig,
      });

      currentRenderer = renderResult.renderer;
      context.shadowRoot = renderResult.shadowRoot;

      return renderResult.element;
    },

    destroyComponent: () => {
      if (currentRenderer) {
        currentRenderer.destroy();
        currentRenderer = null;
      }

      if (currentContainer && currentContainer.parentElement) {
        currentContainer.parentElement.removeChild(currentContainer);
        currentContainer = null;
      }
    },
  };

  return context;
}

// ============================================================================
// Component Metadata Utilities
// ============================================================================

export function getComponentMetadata(type: ComponentType): ComponentMetadata {
  const metadata: Record<ComponentType, ComponentMetadata> = {
    List: {
      type: 'List',
      name: 'List',
      description: 'A scrollable list of items with search functionality',
      props: ['children', 'searchBarPlaceholder', 'filtering', 'navigationTitle'],
      category: 'layout',
    },
    'List.Item': {
      type: 'List.Item',
      name: 'List Item',
      description: 'An item in a list with title, subtitle, and actions',
      props: ['title', 'subtitle', 'icon', 'accessories', 'actions', 'detail'],
      category: 'layout',
    },
    Detail: {
      type: 'Detail',
      name: 'Detail',
      description: 'A detail view with markdown content and metadata',
      props: ['markdown', 'metadata', 'actions', 'navigationTitle'],
      category: 'display',
    },
    Form: {
      type: 'Form',
      name: 'Form',
      description: 'A form with various input fields',
      props: ['children', 'actions', 'onSubmit', 'navigationTitle'],
      category: 'input',
    },
    'Form.TextField': {
      type: 'Form.TextField',
      name: 'Text Field',
      description: 'A text input field',
      props: ['id', 'title', 'placeholder', 'value', 'onChange', 'required'],
      category: 'input',
    },
    'Form.TextArea': {
      type: 'Form.TextArea',
      name: 'Text Area',
      description: 'A multi-line text input field',
      props: ['id', 'title', 'placeholder', 'value', 'onChange', 'rows'],
      category: 'input',
    },
    'Form.Dropdown': {
      type: 'Form.Dropdown',
      name: 'Dropdown',
      description: 'A dropdown select field',
      props: ['id', 'title', 'placeholder', 'value', 'onChange', 'children'],
      category: 'input',
    },
    Grid: {
      type: 'Grid',
      name: 'Grid',
      description: 'A responsive grid layout',
      props: ['children', 'columns', 'aspectRatio', 'inset', 'fit'],
      category: 'layout',
    },
    'Grid.Item': {
      type: 'Grid.Item',
      name: 'Grid Item',
      description: 'An item in a grid with content and actions',
      props: ['title', 'subtitle', 'content', 'accessories', 'actions'],
      category: 'layout',
    },
    Action: {
      type: 'Action',
      name: 'Action',
      description: 'An action button with icon and shortcut',
      props: ['title', 'icon', 'shortcut', 'onAction', 'style'],
      category: 'action',
    },
    ActionPanel: {
      type: 'ActionPanel',
      name: 'Action Panel',
      description: 'A panel containing action buttons',
      props: ['title', 'children'],
      category: 'action',
    },
  };

  return (
    metadata[type] || {
      type,
      name: 'Unknown',
      description: 'Unknown component',
      props: [],
      category: 'layout',
    }
  );
}

export function getAllComponentMetadata(): Record<ComponentType, ComponentMetadata> {
  const types: ComponentType[] = [
    'List',
    'List.Item',
    'List.Section',
    'List.EmptyView',
    'Detail',
    'Detail.Metadata',
    'Detail.Metadata.Label',
    'Form',
    'Form.TextField',
    'Form.TextArea',
    'Form.Dropdown',
    'Grid',
    'Grid.Item',
    'Grid.Section',
    'Grid.EmptyView',
    'Action',
    'ActionPanel',
    'ActionPanel.Section',
    'ActionPanel.Submenu',
    'Action.Push',
    'Action.CopyToClipboard',
    'Action.Paste',
    'Action.OpenInBrowser',
    'Action.SubmitForm',
  ];

  const result: Record<string, ComponentMetadata> = {};
  types.forEach(type => {
    result[type] = getComponentMetadata(type);
  });

  return result as Record<ComponentType, ComponentMetadata>;
}

// ============================================================================
// Validation Utilities
// ============================================================================

export function validateComponentProps(
  type: ComponentType,
  props: Record<string, any>
): { isValid: boolean; errors: string[] } {
  const metadata = getComponentMetadata(type);
  const errors: string[] = [];

  // Check required props
  if (type === 'List.Item' && !props.title) {
    errors.push('List.Item requires a title prop');
  }

  if (type === 'Form.TextField' && !props.id) {
    errors.push('Form.TextField requires an id prop');
  }

  if (type === 'Form.TextArea' && !props.id) {
    errors.push('Form.TextArea requires an id prop');
  }

  if (type === 'Form.Dropdown' && !props.id) {
    errors.push('Form.Dropdown requires an id prop');
  }

  if (type === 'Detail.Metadata.Label' && !props.title) {
    errors.push('Detail.Metadata.Label requires a title prop');
  }

  if (type === 'Grid.Item' && !props.content && !props.title) {
    errors.push('Grid.Item requires either content or title prop');
  }

  if (type === 'Action' && !props.title) {
    errors.push('Action requires a title prop');
  }

  // Check prop types
  if (props.accessories && !Array.isArray(props.accessories)) {
    errors.push('accessories prop must be an array');
  }

  if (props.keywords && !Array.isArray(props.keywords)) {
    errors.push('keywords prop must be an array');
  }

  if (props.actions && typeof props.actions !== 'object') {
    errors.push('actions prop must be a valid JSX element');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

// ============================================================================
// CSS and Styling Utilities
// ============================================================================

export function generateComponentCSS(type: ComponentType): string {
  const baseStyles = `
    .raycast-${type.toLowerCase().replace('.', '-')} {
      /* Component-specific styles */
    }
  `;

  // Component-specific styles
  switch (type) {
    case 'List':
      return baseStyles + `
        .raycast-list {
          max-height: 400px;
          overflow-y: auto;
          background: white;
          border-radius: 8px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }
        .raycast-list-item {
          padding: 8px 12px;
          border-bottom: 1px solid #eee;
          cursor: pointer;
          transition: background-color 0.15s ease;
        }
        .raycast-list-item:hover {
          background-color: #f5f5f5;
        }
      `;

    case 'Detail':
      return baseStyles + `
        .raycast-detail {
          padding: 16px;
          background: white;
          border-radius: 8px;
        }
        .raycast-detail-content {
          max-width: 600px;
        }
      `;

    case 'Form':
      return baseStyles + `
        .raycast-form {
          padding: 16px;
          background: white;
          border-radius: 8px;
        }
        .raycast-form-field {
          margin-bottom: 16px;
        }
        .raycast-form-label {
          display: block;
          margin-bottom: 4px;
          font-weight: 500;
          font-size: 14px;
        }
        .raycast-form-input {
          width: 100%;
          padding: 8px 12px;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 14px;
        }
        .raycast-form-input:focus {
          outline: none;
          border-color: #007AFF;
          box-shadow: 0 0 0 2px rgba(0, 122, 255, 0.2);
        }
      `;

    case 'Grid':
      return baseStyles + `
        .raycast-grid {
          display: grid;
          gap: 16px;
          padding: 16px;
        }
        .raycast-grid-item {
          background: white;
          border-radius: 8px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
          overflow: hidden;
          aspect-ratio: 1;
        }
      `;

    case 'Action':
      return baseStyles + `
        .raycast-action {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          border: none;
          border-radius: 6px;
          background: #007AFF;
          color: white;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
          transition: background-color 0.15s ease;
        }
        .raycast-action:hover {
          background: #0056CC;
        }
        .raycast-action.destructive {
          background: #FF3B30;
        }
        .raycast-action.destructive:hover {
          background: #D70015;
        }
      `;

    case 'ActionPanel':
      return baseStyles + `
        .raycast-action-panel {
          background: white;
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
          border: 1px solid #eee;
        }
        .raycast-action-panel-section {
          padding: 8px;
          border-bottom: 1px solid #eee;
        }
        .raycast-action-panel-section:last-child {
          border-bottom: none;
        }
      `;

    default:
      return baseStyles;
  }
}

export function createComponentTheme(
  primaryColor: string = '#007AFF',
  secondaryColor: string = '#5856D6',
  backgroundColor: string = '#FFFFFF',
  textColor: string = '#000000'
): string {
  return `
    :host {
      --raycast-primary: ${primaryColor};
      --raycast-secondary: ${secondaryColor};
      --raycast-background: ${backgroundColor};
      --raycast-surface: #F2F2F7;
      --raycast-border: #E1E1E1;
      --raycast-text: ${textColor};
      --raycast-text-secondary: #666666;
    }

    .raycast-item:hover {
      background-color: var(--raycast-surface);
    }

    .raycast-action {
      background-color: var(--raycast-primary);
    }

    .raycast-action:hover {
      background-color: color-mix(
        var(--raycast-primary),
        var(--raycast-secondary)
      );
    }

    .raycast-action.destructive {
      background-color: #FF3B30;
    }
  `;
}

// ============================================================================
// Performance Utilities
// ============================================================================

export function optimizeComponentBundle(
  componentTypes: ComponentType[]
): {
  treeShake: ComponentType[];
  lazyLoad: ComponentType[];
  dynamicImport: string[];
} {
  // Components that should be tree-shakable
  const treeShake: ComponentType[] = [
    'List.EmptyView',
    'Detail.Metadata.Separator',
    'Form.Description',
    'ActionPanel.Submenu',
  ];

  // Components that should be lazy loaded
  const lazyLoad: ComponentType[] = [
    'Grid',
    'Detail',
    'Form',
  ];

  // Dynamic import strings
  const dynamicImport = componentTypes
    .filter(type => lazyLoad.includes(type))
    .map(type => `() => import('./components/${type}')`);

  return {
    treeShake,
    lazyLoad,
    dynamicImport,
  };
}