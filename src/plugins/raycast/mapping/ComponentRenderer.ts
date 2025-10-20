import { JSX, createComponent, mergeProps } from 'solid-js';
import { ComponentRenderer, RaycastTheme } from '../components';
import { ComponentMapping } from '../components';
import { PropsTransformer, createPropsTransformer } from './PropsTransformer';
import { DEFAULT_COMPONENT_MAPPINGS } from './ComponentMappingConfig';

// ============================================================================
// SolidJS Component Renderer Implementation
// ============================================================================

export class SolidComponentRenderer implements ComponentRenderer {
  private propsTransformer: PropsTransformer;
  private theme: RaycastTheme;
  private shadowContainers: Map<string, ShadowRoot> = new Map();

  constructor(theme?: Partial<RaycastTheme>) {
    this.propsTransformer = createPropsTransformer(DEFAULT_COMPONENT_MAPPINGS);
    this.theme = this.createDefaultTheme(theme);
  }

  // ========================================
  // Core Rendering Methods
  // ========================================

  renderComponent(type: string, props: any, children?: any[]): any {
    try {
      // Transform props using the mapping system
      const transformedProps = this.propsTransformer.transform(type, props);
      
      // Apply theme
      const themedProps = this.applyRaycastStyling(transformedProps, this.theme);
      
      // Merge children
      const finalProps = children ? mergeProps(themedProps, { children }) : themedProps;
      
      // Create the SolidJS component
      return this.createSolidComponent(type, finalProps);
    } catch (error) {
      console.error(`Failed to render component "${type}":`, error);
      return this.createErrorFallback(type, error);
    }
  }

  createShadowContainer(pluginId: string): ShadowRoot {
    // Create host element
    const hostElement = document.createElement('div');
    hostElement.id = `raycast-plugin-${pluginId}`;
    hostElement.className = 'raycast-plugin-host';
    
    // Create shadow root
    const shadowRoot = hostElement.attachShadow({ mode: 'open' });
    
    // Inject base styles
    this.injectBaseStyles(shadowRoot);
    
    // Store reference
    this.shadowContainers.set(pluginId, shadowRoot);
    
    return shadowRoot;
  }

  createBaseComponent(solidComponent: any, raycastProps: any): any {
    // This method creates a SolidJS component from a base component
    // In our case, solidComponent is usually a string tag name
    return this.createSolidComponent(solidComponent, raycastProps);
  }

  applyRaycastStyling(component: any, theme: RaycastTheme): any {
    // Apply Raycast-specific styling and theme
    const styledProps = {
      ...component,
      style: {
        ...component.style,
        '--raycast-primary': theme.colors.primary,
        '--raycast-secondary': theme.colors.secondary,
        '--raycast-background': theme.colors.background,
        '--raycast-surface': theme.colors.surface,
        '--raycast-text': theme.colors.text,
        '--raycast-text-secondary': theme.colors.textSecondary,
        '--raycast-border': theme.colors.border,
        '--raycast-accent': theme.colors.accent,
        fontFamily: theme.typography.fontFamily
      }
    };

    return styledProps;
  }

  mapRaycastToShadcn(raycastType: string): any {
    // Map Raycast component types to SolidJS element types
    const mapping = this.getComponentMapping(raycastType);
    return mapping?.shadcnComponent || 'div';
  }

  mountComponent(component: any, container: Element): void {
    // Mount a SolidJS component to a DOM container
    try {
      // In a real implementation, this would use SolidJS's render function
      // For now, we'll simulate mounting
      console.log('Mounting component to container:', container);
    } catch (error) {
      console.error('Failed to mount component:', error);
    }
  }

  unmountComponent(container: Element): void {
    // Unmount component from container
    try {
      // Clear the container
      container.innerHTML = '';
      console.log('Unmounted component from container:', container);
    } catch (error) {
      console.error('Failed to unmount component:', error);
    }
  }

  // ========================================
  // Private Helper Methods
  // ========================================

  private createSolidComponent(type: string, props: any): any {
    // Create a SolidJS element
    if (typeof type === 'string') {
      // HTML element - create a simple object representation
      return {
        type,
        props,
        children: props.children
      };
    } else {
      // SolidJS component
      return createComponent(type, props);
    }
  }

  private getComponentMapping(raycastType: string): ComponentMapping | undefined {
    return DEFAULT_COMPONENT_MAPPINGS.find(mapping => mapping.raycastType === raycastType);
  }

  private createErrorFallback(type: string, error: any): any {
    return {
      type: 'div',
      props: {
        class: 'raycast-error-fallback bg-red-50 border border-red-200 rounded-md p-4 text-red-800',
        children: [
          {
            type: 'h3',
            props: {
              class: 'font-medium text-red-900 mb-2',
              children: `Error rendering ${type}`
            }
          },
          {
            type: 'p',
            props: {
              class: 'text-sm',
              children: error.message || 'Unknown error occurred'
            }
          }
        ]
      }
    };
  }

  private injectBaseStyles(shadowRoot: ShadowRoot): void {
    const style = document.createElement('style');
    style.textContent = this.generateBaseCSS();
    shadowRoot.appendChild(style);
  }

  private generateBaseCSS(): string {
    return `
      /* Raycast Plugin Base Styles */
      :host {
        display: block;
        width: 100%;
        height: 100%;
        font-family: ${this.theme.typography.fontFamily};
        color: ${this.theme.colors.text};
        background-color: ${this.theme.colors.background};
      }

      /* Reset and base styles */
      * {
        box-sizing: border-box;
      }

      /* Raycast List Styles */
      .raycast-list {
        display: flex;
        flex-direction: column;
        height: 100%;
        overflow: hidden;
      }

      .raycast-list-item {
        display: flex;
        align-items: center;
        padding: ${this.theme.spacing.sm} ${this.theme.spacing.md};
        border-bottom: 1px solid ${this.theme.colors.border};
        cursor: pointer;
        transition: background-color 0.15s ease;
      }

      .raycast-list-item:hover {
        background-color: ${this.theme.colors.surface};
      }

      .raycast-list-item:focus {
        outline: 2px solid ${this.theme.colors.accent};
        outline-offset: -2px;
      }

      /* Raycast Detail Styles */
      .raycast-detail {
        display: flex;
        height: 100%;
        overflow: hidden;
      }

      .raycast-detail-metadata {
        background-color: ${this.theme.colors.surface};
        border-left: 1px solid ${this.theme.colors.border};
        padding: ${this.theme.spacing.md};
        overflow-y: auto;
      }

      /* Raycast Form Styles */
      .raycast-form {
        padding: ${this.theme.spacing.md};
        display: flex;
        flex-direction: column;
        gap: ${this.theme.spacing.md};
      }

      .raycast-form-field {
        display: flex;
        flex-direction: column;
        gap: ${this.theme.spacing.xs};
      }

      .raycast-form-textfield,
      .raycast-form-textarea,
      .raycast-form-dropdown {
        padding: ${this.theme.spacing.sm};
        border: 1px solid ${this.theme.colors.border};
        border-radius: ${this.theme.borderRadius.md};
        background-color: ${this.theme.colors.background};
        color: ${this.theme.colors.text};
        font-size: ${this.theme.typography.fontSize.sm};
      }

      .raycast-form-textfield:focus,
      .raycast-form-textarea:focus,
      .raycast-form-dropdown:focus {
        outline: 2px solid ${this.theme.colors.accent};
        outline-offset: -2px;
        border-color: ${this.theme.colors.accent};
      }

      /* Raycast Grid Styles */
      .raycast-grid {
        display: grid;
        gap: ${this.theme.spacing.md};
        padding: ${this.theme.spacing.md};
        overflow-y: auto;
      }

      .raycast-grid-item {
        background-color: ${this.theme.colors.surface};
        border-radius: ${this.theme.borderRadius.lg};
        padding: ${this.theme.spacing.md};
        cursor: pointer;
        transition: all 0.15s ease;
      }

      .raycast-grid-item:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
      }

      /* Raycast Action Styles */
      .raycast-action,
      .raycast-action-push,
      .raycast-action-copy,
      .raycast-action-browser {
        display: inline-flex;
        align-items: center;
        padding: ${this.theme.spacing.xs} ${this.theme.spacing.sm};
        border: none;
        border-radius: ${this.theme.borderRadius.md};
        font-size: ${this.theme.typography.fontSize.sm};
        font-weight: ${this.theme.typography.fontWeight.medium};
        cursor: pointer;
        transition: all 0.15s ease;
      }

      .raycast-action:hover,
      .raycast-action-push:hover,
      .raycast-action-copy:hover,
      .raycast-action-browser:hover {
        transform: translateY(-1px);
      }

      .raycast-action-panel {
        background-color: ${this.theme.colors.surface};
        border-top: 1px solid ${this.theme.colors.border};
        padding: ${this.theme.spacing.sm};
      }

      /* Utility classes */
      .raycast-icon {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }

      .raycast-loading {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: ${this.theme.spacing.xl};
      }

      .raycast-empty {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: ${this.theme.spacing.xl};
        text-align: center;
        color: ${this.theme.colors.textSecondary};
      }

      /* Dark mode support */
      @media (prefers-color-scheme: dark) {
        :host {
          color-scheme: dark;
        }
      }

      /* Animation utilities */
      @keyframes raycast-fade-in {
        from { opacity: 0; transform: translateY(4px); }
        to { opacity: 1; transform: translateY(0); }
      }

      .raycast-animate-in {
        animation: raycast-fade-in 0.2s ease-out;
      }

      /* Focus management */
      .raycast-focus-visible:focus-visible {
        outline: 2px solid ${this.theme.colors.accent};
        outline-offset: 2px;
      }

      /* Responsive design */
      @media (max-width: 768px) {
        .raycast-grid {
          grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
        }
        
        .raycast-detail {
          flex-direction: column;
        }
        
        .raycast-detail-metadata {
          border-left: none;
          border-top: 1px solid ${this.theme.colors.border};
        }
      }
    `;
  }

  private createDefaultTheme(overrides?: Partial<RaycastTheme>): RaycastTheme {
    const defaultTheme: RaycastTheme = {
      colors: {
        primary: '#007AFF',
        secondary: '#5856D6',
        background: '#FFFFFF',
        surface: '#F2F2F7',
        text: '#000000',
        textSecondary: '#6D6D70',
        border: '#C6C6C8',
        accent: '#007AFF'
      },
      spacing: {
        xs: '0.25rem',
        sm: '0.5rem',
        md: '1rem',
        lg: '1.5rem',
        xl: '2rem'
      },
      borderRadius: {
        sm: '0.25rem',
        md: '0.5rem',
        lg: '0.75rem'
      },
      typography: {
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        fontSize: {
          xs: '0.75rem',
          sm: '0.875rem',
          md: '1rem',
          lg: '1.125rem',
          xl: '1.25rem'
        },
        fontWeight: {
          normal: '400',
          medium: '500',
          semibold: '600',
          bold: '700'
        }
      }
    };

    return overrides ? { ...defaultTheme, ...overrides } : defaultTheme;
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createSolidComponentRenderer(theme?: Partial<RaycastTheme>): ComponentRenderer {
  return new SolidComponentRenderer(theme);
}

// ============================================================================
// Theme Utilities
// ============================================================================

export class ThemeManager {
  private static instance: ThemeManager;
  private currentTheme: RaycastTheme;
  private listeners: Set<(theme: RaycastTheme) => void> = new Set();

  private constructor() {
    this.currentTheme = this.createDefaultTheme();
    this.setupThemeDetection();
  }

  static getInstance(): ThemeManager {
    if (!ThemeManager.instance) {
      ThemeManager.instance = new ThemeManager();
    }
    return ThemeManager.instance;
  }

  getCurrentTheme(): RaycastTheme {
    return this.currentTheme;
  }

  updateTheme(updates: Partial<RaycastTheme>): void {
    this.currentTheme = { ...this.currentTheme, ...updates };
    this.notifyListeners();
  }

  onThemeChange(listener: (theme: RaycastTheme) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private setupThemeDetection(): void {
    // Listen for system theme changes
    if (window.matchMedia) {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      mediaQuery.addEventListener('change', () => {
        this.updateThemeForColorScheme();
      });
    }
  }

  private updateThemeForColorScheme(): void {
    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    if (isDark) {
      this.updateTheme({
        colors: {
          ...this.currentTheme.colors,
          background: '#1C1C1E',
          surface: '#2C2C2E',
          text: '#FFFFFF',
          textSecondary: '#8E8E93',
          border: '#38383A'
        }
      });
    } else {
      this.updateTheme({
        colors: {
          ...this.currentTheme.colors,
          background: '#FFFFFF',
          surface: '#F2F2F7',
          text: '#000000',
          textSecondary: '#6D6D70',
          border: '#C6C6C8'
        }
      });
    }
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => listener(this.currentTheme));
  }

  private createDefaultTheme(): RaycastTheme {
    return {
      colors: {
        primary: '#007AFF',
        secondary: '#5856D6',
        background: '#FFFFFF',
        surface: '#F2F2F7',
        text: '#000000',
        textSecondary: '#6D6D70',
        border: '#C6C6C8',
        accent: '#007AFF'
      },
      spacing: {
        xs: '0.25rem',
        sm: '0.5rem',
        md: '1rem',
        lg: '1.5rem',
        xl: '2rem'
      },
      borderRadius: {
        sm: '0.25rem',
        md: '0.5rem',
        lg: '0.75rem'
      },
      typography: {
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        fontSize: {
          xs: '0.75rem',
          sm: '0.875rem',
          md: '1rem',
          lg: '1.125rem',
          xl: '1.25rem'
        },
        fontWeight: {
          normal: '400',
          medium: '500',
          semibold: '600',
          bold: '700'
        }
      }
    };
  }
}