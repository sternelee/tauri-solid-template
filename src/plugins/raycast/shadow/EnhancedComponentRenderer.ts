import { JSX } from "solid-js";
import { ComponentRenderer, RaycastTheme } from "../components";
import { shadowDOMManager, ShadowContainerConfig } from "./ShadowDOMManager";
import { ThemeManager } from "../mapping/ComponentRenderer";

// ============================================================================
// Enhanced Component Renderer with Shadow DOM Support
// ============================================================================

export interface EnhancedRendererConfig {
  enableShadowDOM: boolean;
  enableThemeDetection: boolean;
  enableFocusManagement: boolean;
  enableEventHandling: boolean;
  defaultTheme?: "light" | "dark" | "auto";
  customCSS?: string;
}

export class EnhancedComponentRenderer implements ComponentRenderer {
  private config: EnhancedRendererConfig;
  private themeManager: ThemeManager;
  private componentCache: Map<string, JSX.Element> = new Map();

  constructor(config: Partial<EnhancedRendererConfig> = {}) {
    this.config = {
      enableShadowDOM: true,
      enableThemeDetection: true,
      enableFocusManagement: true,
      enableEventHandling: true,
      defaultTheme: "auto",
      ...config,
    };

    this.themeManager = ThemeManager.getInstance();
    this.setupThemeIntegration();
  }

  // ========================================
  // Core Rendering Methods
  // ========================================

  renderComponent(type: string, props: any, children?: any[]): any {
    try {
      // Create component element representation
      const component = this.createComponentElement(type, props, children);

      // Cache component for potential re-rendering
      const cacheKey = this.generateCacheKey(type, props);
      this.componentCache.set(cacheKey, component);

      return component;
    } catch (error) {
      console.error(`Failed to render component "${type}":`, error);
      return this.createErrorComponent(type, error);
    }
  }

  createShadowContainer(pluginId: string): ShadowRoot {
    if (!this.config.enableShadowDOM) {
      throw new Error("Shadow DOM is disabled in renderer configuration");
    }

    const containerConfig: ShadowContainerConfig = {
      pluginId,
      theme: this.config.defaultTheme,
      enableCSS: true,
      enableEvents: this.config.enableEventHandling,
      enableFocusManagement: this.config.enableFocusManagement,
    };

    const container = shadowDOMManager.createContainer(containerConfig);

    // Apply custom CSS if provided
    if (this.config.customCSS) {
      this.injectCustomCSS(container.shadowRoot, this.config.customCSS);
    }

    // Setup theme integration
    if (this.config.enableThemeDetection) {
      this.setupContainerThemeIntegration(pluginId);
    }

    return container.shadowRoot;
  }

  createBaseComponent(solidComponent: any, raycastProps: any): any {
    // Apply theme styling
    const themedProps = this.applyRaycastStyling(
      raycastProps,
      this.getCurrentTheme(),
    );

    // Create component with enhanced props
    return this.createComponentElement(solidComponent, themedProps);
  }

  applyRaycastStyling(component: any, theme: RaycastTheme): any {
    // Apply theme variables and styling
    const styledComponent = {
      ...component,
      style: {
        ...component.style,
        "--raycast-primary": theme.colors.primary,
        "--raycast-secondary": theme.colors.secondary,
        "--raycast-background": theme.colors.background,
        "--raycast-surface": theme.colors.surface,
        "--raycast-text": theme.colors.text,
        "--raycast-text-secondary": theme.colors.textSecondary,
        "--raycast-border": theme.colors.border,
        "--raycast-accent": theme.colors.accent,
        fontFamily: theme.typography.fontFamily,
      },
      class: this.enhanceClassNames(component.class, theme),
    };

    return styledComponent;
  }

  mapRaycastToShadcn(raycastType: string): any {
    // Map Raycast component types to implementation
    const componentMap: Record<string, string> = {
      List: "div",
      "List.Item": "div",
      Detail: "div",
      Form: "form",
      Grid: "div",
      Action: "button",
      ActionPanel: "div",
    };

    return componentMap[raycastType] || "div";
  }

  mountComponent(component: any, container: Element): void {
    try {
      // Check if container is a shadow root or regular element
      if (container instanceof ShadowRoot) {
        this.mountToShadowRoot(component, container);
      } else {
        this.mountToElement(component, container);
      }
    } catch (error) {
      console.error("Failed to mount component:", error);
    }
  }

  unmountComponent(container: Element): void {
    try {
      if (container instanceof ShadowRoot) {
        this.unmountFromShadowRoot(container);
      } else {
        this.unmountFromElement(container);
      }
    } catch (error) {
      console.error("Failed to unmount component:", error);
    }
  }

  // ========================================
  // Enhanced Shadow DOM Methods
  // ========================================

  renderToShadowDOM(pluginId: string, component: JSX.Element): void {
    const container = shadowDOMManager.getContainer(pluginId);
    if (!container) {
      throw new Error(`No shadow container found for plugin: ${pluginId}`);
    }

    // Render component to shadow DOM
    shadowDOMManager.renderComponent(pluginId, component);

    // Activate container
    shadowDOMManager.activateContainer(pluginId);
  }

  updateShadowDOMComponent(pluginId: string, component: JSX.Element): void {
    shadowDOMManager.updateComponent(pluginId, component);
  }

  destroyShadowContainer(pluginId: string): void {
    shadowDOMManager.destroyContainer(pluginId);
    this.cleanupContainerThemeIntegration(pluginId);
  }

  // ========================================
  // Component Creation Helpers
  // ========================================

  private createComponentElement(
    type: string,
    props: any,
    children?: any[],
  ): any {
    // Create a virtual element representation
    const element = {
      type: typeof type === "string" ? type : "component",
      props: {
        ...props,
        children: children || props.children,
      },
      key: props.key || null,
      ref: props.ref || null,
    };

    // Add Raycast-specific attributes
    if (element.props) {
      element.props["data-raycast-component"] = type;
      element.props["data-raycast-renderer"] = "enhanced";
    }

    return element;
  }

  private createErrorComponent(type: string, error: any): any {
    return this.createComponentElement("div", {
      class:
        "raycast-error-component bg-red-50 border border-red-200 rounded-md p-4 text-red-800",
      children: [
        this.createComponentElement("h3", {
          class: "font-medium text-red-900 mb-2",
          children: `Error rendering ${type}`,
        }),
        this.createComponentElement("p", {
          class: "text-sm",
          children: error.message || "Unknown error occurred",
        }),
      ],
    });
  }

  // ========================================
  // Mounting Helpers
  // ========================================

  private mountToShadowRoot(component: any, shadowRoot: ShadowRoot): void {
    // Find the plugin ID from the shadow root
    const hostElement = shadowRoot.host as HTMLElement;
    const pluginId = hostElement.getAttribute("data-plugin-id");

    if (pluginId) {
      shadowDOMManager.renderComponent(pluginId, component);
    } else {
      console.error("Cannot mount to shadow root: no plugin ID found");
    }
  }

  private mountToElement(component: any, container: Element): void {
    // For regular DOM mounting, create a simple representation
    const div = document.createElement("div");
    div.className = "raycast-component-mount";
    div.innerHTML = this.componentToHTML(component);

    container.appendChild(div);
  }

  private unmountFromShadowRoot(shadowRoot: ShadowRoot): void {
    const hostElement = shadowRoot.host as HTMLElement;
    const pluginId = hostElement.getAttribute("data-plugin-id");

    if (pluginId) {
      const container = shadowDOMManager.getContainer(pluginId);
      if (container) {
        shadowDOMManager.clearContainer(container);
      }
    }
  }

  private unmountFromElement(container: Element): void {
    const mountPoint = container.querySelector(".raycast-component-mount");
    if (mountPoint) {
      container.removeChild(mountPoint);
    }
  }

  // ========================================
  // Theme Integration
  // ========================================

  private setupThemeIntegration(): void {
    if (this.config.enableThemeDetection) {
      this.themeManager.onThemeChange((theme) => {
        this.handleThemeChange(theme);
      });
    }
  }

  private setupContainerThemeIntegration(pluginId: string): void {
    // Listen for theme changes and update container
    const handleThemeChange = (theme: RaycastTheme) => {
      const container = shadowDOMManager.getContainer(pluginId);
      if (container) {
        this.updateContainerTheme(container.shadowRoot, theme);
      }
    };

    // Store the handler for cleanup
    (window as any)[`__raycast_theme_handler_${pluginId}`] = handleThemeChange;
    this.themeManager.onThemeChange(handleThemeChange);
  }

  private cleanupContainerThemeIntegration(pluginId: string): void {
    const handler = (window as any)[`__raycast_theme_handler_${pluginId}`];
    if (handler) {
      // Note: ThemeManager doesn't expose removeListener, so we just clean up the reference
      delete (window as any)[`__raycast_theme_handler_${pluginId}`];
    }
  }

  private handleThemeChange(theme: RaycastTheme): void {
    // Update all shadow containers with new theme
    shadowDOMManager.getAllContainers().forEach((container) => {
      this.updateContainerTheme(container.shadowRoot, theme);
    });
  }

  private updateContainerTheme(
    shadowRoot: ShadowRoot,
    theme: RaycastTheme,
  ): void {
    // Update CSS custom properties
    const host = shadowRoot.host as HTMLElement;
    Object.entries(this.getThemeVariables(theme)).forEach(
      ([property, value]) => {
        host.style.setProperty(property, value);
      },
    );
  }

  private getThemeVariables(theme: RaycastTheme): Record<string, string> {
    return {
      "--raycast-primary": theme.colors.primary,
      "--raycast-secondary": theme.colors.secondary,
      "--raycast-background": theme.colors.background,
      "--raycast-surface": theme.colors.surface,
      "--raycast-text": theme.colors.text,
      "--raycast-text-secondary": theme.colors.textSecondary,
      "--raycast-border": theme.colors.border,
      "--raycast-accent": theme.colors.accent,
      "--raycast-font-family": theme.typography.fontFamily,
      "--raycast-font-size-sm": theme.typography.fontSize.sm,
      "--raycast-font-size-md": theme.typography.fontSize.md,
      "--raycast-font-size-lg": theme.typography.fontSize.lg,
      "--raycast-spacing-xs": theme.spacing.xs,
      "--raycast-spacing-sm": theme.spacing.sm,
      "--raycast-spacing-md": theme.spacing.md,
      "--raycast-spacing-lg": theme.spacing.lg,
      "--raycast-spacing-xl": theme.spacing.xl,
      "--raycast-border-radius-sm": theme.borderRadius.sm,
      "--raycast-border-radius-md": theme.borderRadius.md,
      "--raycast-border-radius-lg": theme.borderRadius.lg,
    };
  }

  private getCurrentTheme(): RaycastTheme {
    return this.themeManager.getCurrentTheme();
  }

  // ========================================
  // Utility Methods
  // ========================================

  private enhanceClassNames(
    existingClasses: string = "",
    theme: RaycastTheme,
  ): string {
    const themeClass = this.getThemeClass();
    const enhancedClasses =
      `${existingClasses} raycast-enhanced ${themeClass}`.trim();
    return enhancedClasses;
  }

  private getThemeClass(): string {
    const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    return isDark ? "raycast-dark" : "raycast-light";
  }

  private injectCustomCSS(shadowRoot: ShadowRoot, css: string): void {
    const style = document.createElement("style");
    style.setAttribute("data-raycast-styles", "custom");
    style.textContent = css;
    shadowRoot.appendChild(style);
  }

  private generateCacheKey(type: string, props: any): string {
    // Generate a simple cache key based on component type and key props
    const keyProps = ["id", "key", "title"];
    const keyValues = keyProps.map((prop) => props[prop]).filter(Boolean);
    return `${type}:${keyValues.join(":")}`;
  }

  private componentToHTML(component: any): string {
    // Simple component to HTML conversion for fallback mounting
    if (typeof component === "string") {
      return component;
    }

    if (component && typeof component === "object") {
      const tag = component.type || "div";
      const props = component.props || {};
      const children = props.children || "";

      const attributes = Object.entries(props)
        .filter(([key]) => key !== "children")
        .map(([key, value]) => `${key}="${String(value)}"`)
        .join(" ");

      return `<${tag} ${attributes}>${children}</${tag}>`;
    }

    return "";
  }

  // ========================================
  // Public API Extensions
  // ========================================

  setGlobalCSS(css: string): void {
    shadowDOMManager.setGlobalStyles(css);
  }

  focusPlugin(pluginId: string): void {
    shadowDOMManager.focusContainer(pluginId);
  }

  getActivePlugin(): string | null {
    const activeContainer = shadowDOMManager.getActiveContainer();
    return activeContainer ? activeContainer.pluginId : null;
  }

  getAllPluginContainers(): Array<{ pluginId: string; isActive: boolean }> {
    return shadowDOMManager.getAllContainers().map((container) => ({
      pluginId: container.pluginId,
      isActive: container.isActive,
    }));
  }

  cleanup(): void {
    shadowDOMManager.cleanup();
    this.componentCache.clear();
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createEnhancedComponentRenderer(
  config?: Partial<EnhancedRendererConfig>,
): EnhancedComponentRenderer {
  return new EnhancedComponentRenderer(config);
}

// ============================================================================
// Integration Helpers
// ============================================================================

export class ShadowDOMIntegration {
  static setupPluginContainer(
    pluginId: string,
    parentElement: Element,
    config?: Partial<EnhancedRendererConfig>,
  ): EnhancedComponentRenderer {
    const renderer = createEnhancedComponentRenderer(config);

    // Create shadow container
    const shadowRoot = renderer.createShadowContainer(pluginId);

    // Append host element to parent
    const hostElement = shadowRoot.host as HTMLElement;
    parentElement.appendChild(hostElement);

    return renderer;
  }

  static createIsolatedPlugin(
    pluginId: string,
    component: JSX.Element,
    config?: Partial<EnhancedRendererConfig>,
  ): { renderer: EnhancedComponentRenderer; hostElement: HTMLElement } {
    const renderer = createEnhancedComponentRenderer(config);

    // Create shadow container
    const shadowRoot = renderer.createShadowContainer(pluginId);
    const hostElement = shadowRoot.host as HTMLElement;

    // Render component
    renderer.renderToShadowDOM(pluginId, component);

    return { renderer, hostElement };
  }
}

