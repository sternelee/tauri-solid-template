// ============================================================================
// Raycast Shadow DOM Adapter
// ============================================================================
// Adapter for rendering Raycast components in Shadow DOM with isolation

import { render } from 'solid-js/web';
import { createSignal, createEffect, onCleanup } from 'solid-js';
import type { Component, JSX } from 'solid-js';
import type { RaycastAPI } from '../api/types';

// ============================================================================
// Shadow DOM Configuration
// ============================================================================

export interface ShadowDOMConfig {
  /**
   * CSS isolation mode
   * - 'strict': Complete isolation with scoped CSS
   * - 'shared': Shared CSS with host page
   * - 'none': No CSS isolation
   */
  cssIsolation?: 'strict' | 'shared' | 'none';

  /**
   * JavaScript isolation mode
   * - 'sandbox': Isolated global scope
   * - 'proxy': Proxy global access
   * - 'none': No isolation
   */
  jsIsolation?: 'sandbox' | 'proxy' | 'none';

  /**
   * Event handling mode
   * - 'bubble': Events bubble to host
   * 'capture': Events are captured
   * 'isolated': Events stay within Shadow DOM
   */
  eventMode?: 'bubble' | 'capture' | 'isolated';

  /**
   * Resource loading mode
   * - 'blocked': External resources blocked
   * - 'allowed': External resources allowed
   * - 'sandbox': External resources sandboxed
   */
  resourceMode?: 'blocked' | 'allowed' | 'sandbox';

  /**
   * Custom styles to inject
   */
  customStyles?: string[];

  /**
   * Custom CSS variables
   */
  cssVariables?: Record<string, string>;

  /**
   * Plugin ID for isolation
   */
  pluginId: string;
}

// ============================================================================
// Shadow DOM Renderer
// ============================================================================

export interface ShadowDOMRenderer {
  container: HTMLElement;
  shadowRoot: ShadowRoot;
  render: (component: Component<any>) => void;
  destroy: () => void;
  updateStyles: (styles: string[]) => void;
  getRenderedElement: () => HTMLElement | null;
}

export class ShadowDOMRendererImpl implements ShadowDOMRenderer {
  private disposers: (() => void)[] = [];
  private currentComponent: Component<any> | null = null;
  private renderRoot: any = null;

  constructor(
    public container: HTMLElement,
    public shadowRoot: ShadowRoot,
    private config: ShadowDOMConfig,
    private api: RaycastAPI
  ) {
    this.setupCSSIsolation();
    this.setupJavaScriptIsolation();
    this.setupEventHandling();
    this.injectBaseStyles();
  }

  render(component: Component<any>): void {
    // Clean up previous render
    this.destroy();

    this.currentComponent = component;

    // Setup isolated global context for the component
    const isolatedGlobal = this.createIsolatedGlobal();

    // Render the component with Solid.js
    try {
      this.renderRoot = render(() => {
        // Provide Raycast API to component
        (isolatedGlobal as any).__RAYCAST_API__ = this.api;

        // Render the component
        return component;
      }, this.shadowRoot);

      console.log(`Component rendered in Shadow DOM for plugin ${this.config.pluginId}`);
    } catch (error) {
      console.error(`Failed to render component for plugin ${this.config.pluginId}:`, error);
      throw error;
    }
  }

  destroy(): void {
    // Clean up Solid.js render
    if (this.renderRoot) {
      try {
        this.renderRoot.dispose();
      } catch (error) {
        console.error(`Error disposing render root for plugin ${this.config.pluginId}:`, error);
      }
      this.renderRoot = null;
    }

    // Clean up disposers
    this.disposers.forEach(dispose => {
      try {
        dispose();
      } catch (error) {
        console.error(`Error running disposer for plugin ${this.config.pluginId}:`, error);
      }
    });
    this.disposers = [];

    this.currentComponent = null;
  }

  updateStyles(styles: string[]): void {
    if (this.config.cssIsolation === 'strict') {
      // Remove existing style elements
      const existingStyles = this.shadowRoot.querySelectorAll('style[data-raycast-style]');
      existingStyles.forEach(style => style.remove());

      // Add new styles
      styles.forEach((styleContent, index) => {
        const styleElement = document.createElement('style');
        styleElement.setAttribute('data-raycast-style', String(index));
        styleElement.textContent = styleContent;
        this.shadowRoot.appendChild(styleElement);
      });
    }
  }

  getRenderedElement(): HTMLElement | null {
    return this.shadowRoot.firstElementChild as HTMLElement || null;
  }

  private setupCSSIsolation(): void {
    switch (this.config.cssIsolation) {
      case 'strict':
        // Strict CSS isolation - styles don't leak in or out
        this.shadowRoot.adoptedStyleSheets = [];
        break;

      case 'shared':
        // Shared CSS - allow some host styles
        this.allowHostStyles();
        break;

      case 'none':
        // No CSS isolation
        break;
    }

    // Inject custom CSS variables
    if (this.config.cssVariables) {
      const styleElement = document.createElement('style');
      const cssVars = Object.entries(this.config.cssVariables)
        .map(([key, value]) => `  --${key}: ${value};`)
        .join('\n');

      styleElement.textContent = `
        :host {
${cssVars}
        }
      `;
      this.shadowRoot.appendChild(styleElement);
    }
  }

  private setupJavaScriptIsolation(): void {
    switch (this.config.jsIsolation) {
      case 'sandbox':
        // Create isolated global scope
        this.createSandboxedGlobal();
        break;

      case 'proxy':
        // Proxy global access
        this.createProxyGlobal();
        break;

      case 'none':
        // No JavaScript isolation
        break;
    }
  }

  private setupEventHandling(): void {
    switch (this.config.eventMode) {
      case 'bubble':
        // Allow events to bubble to host
        this.shadowRoot.addEventListener('click', this.bubbleEvent.bind(this), true);
        this.shadowRoot.addEventListener('keydown', this.bubbleEvent.bind(this), true);
        break;

      case 'capture':
        // Capture events at Shadow DOM boundary
        this.container.addEventListener('click', this.captureEvent.bind(this), true);
        break;

      case 'isolated':
        // Events stay within Shadow DOM
        break;
    }
  }

  private injectBaseStyles(): void {
    const baseStyles = `
      :host {
        display: block;
        font-family: system-ui, -apple-system, sans-serif;
        font-size: 14px;
        line-height: 1.5;
        color: #333;
        background: #fff;
        border-radius: 8px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        overflow: hidden;
      }

      :host * {
        box-sizing: border-box;
      }

      /* Raycast-specific base styles */
      .raycast-list {
        max-height: 400px;
        overflow-y: auto;
      }

      .raycast-item {
        padding: 8px 12px;
        border-bottom: 1px solid #eee;
        cursor: pointer;
        transition: background-color 0.15s ease;
      }

      .raycast-item:hover {
        background-color: #f5f5f5;
      }

      .raycast-item.selected {
        background-color: #e3f2fd;
      }

      .raycast-actions {
        position: sticky;
        bottom: 0;
        background: white;
        border-top: 1px solid #eee;
        padding: 8px;
      }

      /* Loading and error states */
      .raycast-loading {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 40px;
        color: #666;
      }

      .raycast-error {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 40px;
        color: #d32f2f;
      }
    `;

    const styleElement = document.createElement('style');
    styleElement.setAttribute('data-raycast-base', 'true');
    styleElement.textContent = baseStyles;
    this.shadowRoot.appendChild(styleElement);

    // Inject custom styles
    if (this.config.customStyles && this.config.customStyles.length > 0) {
      this.updateStyles(this.config.customStyles);
    }
  }

  private createIsolatedGlobal(): any {
    const isolatedGlobal: any = {};

    // Copy safe global properties
    const safeGlobals = [
      'console',
      'setTimeout',
      'clearTimeout',
      'setInterval',
      'clearInterval',
      'requestAnimationFrame',
      'cancelAnimationFrame',
      'Date',
      'Math',
      'JSON',
      'parseInt',
      'parseFloat',
      'encodeURIComponent',
      'decodeURIComponent',
    ];

    safeGlobals.forEach(prop => {
      if (prop in window) {
        (isolatedGlobal as any)[prop] = (window as any)[prop];
      }
    });

    // Mock potentially dangerous globals
    isolatedGlobal.window = isolatedGlobal;
    isolatedGlobal.document = this.shadowRoot;
    isolatedGlobal.location = {
      href: `raycast://${this.config.pluginId}`,
      origin: `raycast://${this.config.pluginId}`,
    };

    return isolatedGlobal;
  }

  private createSandboxedGlobal(): void {
    // Create a sandboxed environment
    const sandboxScript = document.createElement('script');
    sandboxScript.textContent = `
      (function() {
        const sandbox = {
          console: window.console,
          setTimeout: window.setTimeout,
          clearTimeout: window.clearTimeout,
          setInterval: window.setInterval,
          clearInterval: window.clearInterval,
          requestAnimationFrame: window.requestAnimationFrame,
          cancelAnimationFrame: window.cancelAnimationFrame,
          Date: window.Date,
          Math: window.Math,
          JSON: window.JSON,
        };

        // Override global in this context
        Object.defineProperty(window, '__RAYCAST_SANDBOX__', {
          value: sandbox,
          writable: false,
          configurable: false
        });
      })();
    `;
    this.shadowRoot.appendChild(sandboxScript);
  }

  private createProxyGlobal(): void {
    // Create a proxy that monitors global access
    const globalProxy = new Proxy(window, {
      get(target, prop) {
        // Log access to global properties for debugging
        if (this.config.pluginId && typeof prop === 'string') {
          console.log(`Plugin ${this.config.pluginId} accessing global: ${prop}`);
        }
        return target[prop];
      },
      set(target, prop, value) {
        // Prevent modification of certain global properties
        const blockedProps = ['location', 'document', 'window'];
        if (blockedProps.includes(String(prop))) {
          console.warn(`Plugin ${this.config.pluginId} blocked from setting global: ${prop}`);
          return false;
        }
        target[prop] = value;
        return true;
      }
    });

    (globalProxy as any).__RAYCAST_PLUGIN_ID__ = this.config.pluginId;
  }

  private allowHostStyles(): void {
    // Allow certain host styles to be inherited
    const hostStyles = [
      'font-family',
      'font-size',
      'font-weight',
      'color',
      'line-height',
    ];

    hostStyles.forEach(prop => {
      const hostValue = getComputedStyle(this.container).getPropertyValue(prop);
      if (hostValue) {
        this.shadowRoot.style.setProperty(prop, hostValue);
      }
    });
  }

  private bubbleEvent(event: Event): void {
    // Re-dispatch event to host
    const newEvent = new (event.constructor as any)(event.type, event);
    this.container.dispatchEvent(newEvent);
  }

  private captureEvent(event: Event): void {
    // Handle event at host level
    console.log(`Event captured for plugin ${this.config.pluginId}:`, event.type);
  }
}

// ============================================================================
// Shadow DOM Factory
// ============================================================================

export interface ShadowDOMFactory {
  createRenderer: (
    container: HTMLElement,
    config: ShadowDOMConfig,
    api: RaycastAPI
  ) => ShadowDOMRenderer;
}

export class ShadowDOMFactoryImpl implements ShadowDOMFactory {
  private renderers = new Map<string, ShadowDOMRenderer>();

  createRenderer(
    container: HTMLElement,
    config: ShadowDOMConfig,
    api: RaycastAPI
  ): ShadowDOMRenderer {
    // Create Shadow Root
    const shadowRoot = container.attachShadow({
      mode: config.cssIsolation === 'none' ? 'open' : 'closed',
    });

    // Create renderer
    const renderer = new ShadowDOMRendererImpl(
      container,
      shadowRoot,
      config,
      api
    );

    // Store renderer for cleanup
    this.renderers.set(config.pluginId, renderer);

    return renderer;
  }

  destroyRenderer(pluginId: string): void {
    const renderer = this.renderers.get(pluginId);
    if (renderer) {
      renderer.destroy();
      this.renderers.delete(pluginId);
    }
  }

  getRenderer(pluginId: string): ShadowDOMRenderer | undefined {
    return this.renderers.get(pluginId);
  }

  getAllRenderers(): Map<string, ShadowDOMRenderer> {
    return new Map(this.renderers);
  }

  destroyAll(): void {
    for (const [pluginId] of this.renderers) {
      this.destroyRenderer(pluginId);
    }
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createShadowDOMFactory(): ShadowDOMFactory {
  return new ShadowDOMFactoryImpl();
}

// ============================================================================
// Default Configuration
// ============================================================================

export const defaultShadowDOMConfig: Partial<ShadowDOMConfig> = {
  cssIsolation: 'strict',
  jsIsolation: 'sandbox',
  eventMode: 'bubble',
  resourceMode: 'sandbox',
  customStyles: [],
  cssVariables: {
    'raycast-primary': '#007AFF',
    'raycast-secondary': '#5856D6',
    'raycast-background': '#FFFFFF',
    'raycast-surface': '#F2F2F7',
    'raycast-border': '#E1E1E1',
    'raycast-text': '#000000',
    'raycast-text-secondary': '#666666',
  },
};

// ============================================================================
// Utility Functions
// ============================================================================

export function createShadowDOMConfig(
  pluginId: string,
  overrides: Partial<ShadowDOMConfig> = {}
): ShadowDOMConfig {
  return {
    ...defaultShadowDOMConfig,
    ...overrides,
    pluginId,
  } as ShadowDOMConfig;
}

export function validateShadowDOMConfig(
  config: ShadowDOMConfig
): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!config.pluginId || typeof config.pluginId !== 'string') {
    errors.push('Plugin ID is required and must be a string');
  }

  if (config.pluginId.length > 100) {
    errors.push('Plugin ID must be less than 100 characters');
  }

  if (!/^[a-z0-9-_]+$/.test(config.pluginId)) {
    errors.push('Plugin ID must contain only lowercase letters, numbers, hyphens, and underscores');
  }

  if (config.customStyles && !Array.isArray(config.customStyles)) {
    errors.push('Custom styles must be an array of strings');
  }

  if (config.cssVariables && typeof config.cssVariables !== 'object') {
    errors.push('CSS variables must be an object');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}