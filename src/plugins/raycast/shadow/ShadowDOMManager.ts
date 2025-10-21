import { render } from "solid-js/web";
import { JSX } from "solid-js";

// ============================================================================
// Shadow DOM Manager
// ============================================================================

export interface ShadowContainerConfig {
  pluginId: string;
  theme?: "light" | "dark" | "auto";
  enableCSS?: boolean;
  enableEvents?: boolean;
  enableFocusManagement?: boolean;
}

export interface ShadowContainer {
  id: string;
  pluginId: string;
  hostElement: HTMLElement;
  shadowRoot: ShadowRoot;
  rootDispose?: () => void;
  config: ShadowContainerConfig;
  isActive: boolean;
}

export class ShadowDOMManager {
  private static instance: ShadowDOMManager;
  private containers: Map<string, ShadowContainer> = new Map();
  private activeContainer: ShadowContainer | null = null;
  private globalStyles: string = "";

  private constructor() {
    this.setupGlobalEventHandlers();
    this.setupThemeDetection();
  }

  static getInstance(): ShadowDOMManager {
    if (!ShadowDOMManager.instance) {
      ShadowDOMManager.instance = new ShadowDOMManager();
    }
    return ShadowDOMManager.instance;
  }

  // ========================================
  // Container Management
  // ========================================

  createContainer(config: ShadowContainerConfig): ShadowContainer {
    const containerId = `raycast-plugin-${config.pluginId}`;

    // Check if container already exists
    if (this.containers.has(containerId)) {
      const existing = this.containers.get(containerId)!;
      console.warn(
        `Shadow container for plugin "${config.pluginId}" already exists`,
      );
      return existing;
    }

    // Create host element
    const hostElement = document.createElement("div");
    hostElement.id = containerId;
    hostElement.className = "raycast-plugin-host";
    hostElement.setAttribute("data-plugin-id", config.pluginId);
    hostElement.setAttribute("data-raycast-container", "true");

    // Create shadow root
    const shadowRoot = hostElement.attachShadow({
      mode: "open",
      delegatesFocus: config.enableFocusManagement !== false,
    });

    // Create container object
    const container: ShadowContainer = {
      id: containerId,
      pluginId: config.pluginId,
      hostElement,
      shadowRoot,
      config,
      isActive: false,
    };

    // Initialize shadow DOM
    this.initializeShadowDOM(container);

    // Store container
    this.containers.set(containerId, container);

    console.log(`Created shadow container for plugin: ${config.pluginId}`);
    return container;
  }

  getContainer(pluginId: string): ShadowContainer | undefined {
    const containerId = `raycast-plugin-${pluginId}`;
    return this.containers.get(containerId);
  }

  destroyContainer(pluginId: string): void {
    const containerId = `raycast-plugin-${pluginId}`;
    const container = this.containers.get(containerId);

    if (!container) {
      console.warn(`No shadow container found for plugin: ${pluginId}`);
      return;
    }

    // Cleanup SolidJS root
    if (container.rootDispose) {
      container.rootDispose();
    }

    // Remove from DOM
    if (container.hostElement.parentNode) {
      container.hostElement.parentNode.removeChild(container.hostElement);
    }

    // Clear active container if this was active
    if (this.activeContainer === container) {
      this.activeContainer = null;
    }

    // Remove from registry
    this.containers.delete(containerId);

    console.log(`Destroyed shadow container for plugin: ${pluginId}`);
  }

  activateContainer(pluginId: string): void {
    const container = this.getContainer(pluginId);
    if (!container) {
      throw new Error(`No shadow container found for plugin: ${pluginId}`);
    }

    // Deactivate current container
    if (this.activeContainer && this.activeContainer !== container) {
      this.deactivateContainer(this.activeContainer.pluginId);
    }

    // Activate new container
    container.isActive = true;
    container.hostElement.style.display = "block";
    this.activeContainer = container;

    // Emit activation event
    this.emitContainerEvent("activated", container);
  }

  deactivateContainer(pluginId: string): void {
    const container = this.getContainer(pluginId);
    if (!container) return;

    container.isActive = false;
    container.hostElement.style.display = "none";

    if (this.activeContainer === container) {
      this.activeContainer = null;
    }

    // Emit deactivation event
    this.emitContainerEvent("deactivated", container);
  }

  // ========================================
  // Component Rendering
  // ========================================

  renderComponent(pluginId: string, component: JSX.Element): void {
    const container = this.getContainer(pluginId);
    if (!container) {
      throw new Error(`No shadow container found for plugin: ${pluginId}`);
    }

    // Clear existing content
    this.clearContainer(container);

    // Create SolidJS root and render
    const dispose = render(() => component, container.shadowRoot);
    container.rootDispose = dispose;

    console.log(`Rendered component for plugin: ${pluginId}`);
  }

  updateComponent(pluginId: string, component: JSX.Element): void {
    // For now, just re-render the entire component
    this.renderComponent(pluginId, component);
  }

  clearContainer(container: ShadowContainer): void {
    // Dispose existing SolidJS root
    if (container.rootDispose) {
      container.rootDispose();
      container.rootDispose = undefined;
    }

    // Clear shadow DOM content (keep styles)
    const styleElements = Array.from(
      container.shadowRoot.querySelectorAll("style"),
    );
    container.shadowRoot.innerHTML = "";

    // Re-add styles
    styleElements.forEach((style) => container.shadowRoot.appendChild(style));
  }

  // ========================================
  // Shadow DOM Initialization
  // ========================================

  private initializeShadowDOM(container: ShadowContainer): void {
    // Inject base styles
    if (container.config.enableCSS !== false) {
      this.injectBaseStyles(container);
    }

    // Setup event handling
    if (container.config.enableEvents !== false) {
      this.setupContainerEvents(container);
    }

    // Setup focus management
    if (container.config.enableFocusManagement !== false) {
      this.setupFocusManagement(container);
    }

    // Apply theme
    this.applyTheme(container, container.config.theme || "auto");
  }

  private injectBaseStyles(container: ShadowContainer): void {
    const style = document.createElement("style");
    style.setAttribute("data-raycast-styles", "base");
    style.textContent = this.generateBaseCSS(container);
    container.shadowRoot.appendChild(style);

    // Add global styles if any
    if (this.globalStyles) {
      const globalStyle = document.createElement("style");
      globalStyle.setAttribute("data-raycast-styles", "global");
      globalStyle.textContent = this.globalStyles;
      container.shadowRoot.appendChild(globalStyle);
    }
  }

  private generateBaseCSS(container: ShadowContainer): string {
    return `
      /* Raycast Plugin Base Styles */
      :host {
        display: block;
        width: 100%;
        height: 100%;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 14px;
        line-height: 1.5;
        color: var(--raycast-text-color, #000);
        background-color: var(--raycast-bg-color, #fff);
        box-sizing: border-box;
        overflow: hidden;
      }

      *, *::before, *::after {
        box-sizing: border-box;
      }

      /* Reset and normalize */
      button, input, select, textarea {
        font-family: inherit;
        font-size: inherit;
        line-height: inherit;
      }

      button {
        cursor: pointer;
      }

      button:disabled {
        cursor: not-allowed;
        opacity: 0.6;
      }

      /* Focus management */
      :focus {
        outline: 2px solid var(--raycast-focus-color, #007AFF);
        outline-offset: 2px;
      }

      :focus:not(:focus-visible) {
        outline: none;
      }

      /* Raycast component styles */
      .raycast-list {
        display: flex;
        flex-direction: column;
        height: 100%;
        overflow: hidden;
      }

      .raycast-list-item {
        display: flex;
        align-items: center;
        padding: 8px 16px;
        border-bottom: 1px solid var(--raycast-border-color, #e5e5e5);
        cursor: pointer;
        transition: background-color 0.15s ease;
      }

      .raycast-list-item:hover {
        background-color: var(--raycast-hover-color, #f5f5f5);
      }

      .raycast-detail {
        display: flex;
        height: 100%;
        overflow: hidden;
      }

      .raycast-form {
        padding: 16px;
        display: flex;
        flex-direction: column;
        gap: 16px;
        overflow-y: auto;
      }

      .raycast-grid {
        display: grid;
        gap: 16px;
        padding: 16px;
        overflow-y: auto;
      }

      .raycast-action-panel {
        background-color: var(--raycast-surface-color, #f8f9fa);
        border-top: 1px solid var(--raycast-border-color, #e5e5e5);
        padding: 12px;
      }

      /* Animation utilities */
      @keyframes raycast-fade-in {
        from { opacity: 0; transform: translateY(4px); }
        to { opacity: 1; transform: translateY(0); }
      }

      .raycast-animate-in {
        animation: raycast-fade-in 0.2s ease-out;
      }

      /* Loading states */
      .raycast-loading {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 32px;
      }

      .raycast-spinner {
        width: 24px;
        height: 24px;
        border: 2px solid var(--raycast-border-color, #e5e5e5);
        border-top: 2px solid var(--raycast-accent-color, #007AFF);
        border-radius: 50%;
        animation: raycast-spin 1s linear infinite;
      }

      @keyframes raycast-spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }

      /* Responsive design */
      @media (max-width: 768px) {
        :host {
          font-size: 16px;
        }

        .raycast-list-item {
          padding: 12px 16px;
        }

        .raycast-grid {
          grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
          gap: 12px;
          padding: 12px;
        }
      }

      /* Dark mode support */
      @media (prefers-color-scheme: dark) {
        :host {
          --raycast-text-color: #ffffff;
          --raycast-bg-color: #1c1c1e;
          --raycast-surface-color: #2c2c2e;
          --raycast-border-color: #38383a;
          --raycast-hover-color: #3a3a3c;
        }
      }

      /* Plugin-specific overrides */
      [data-plugin-id="${container.pluginId}"] {
        /* Plugin can override styles here */
      }
    `;
  }

  // ========================================
  // Event Handling
  // ========================================

  private setupContainerEvents(container: ShadowContainer): void {
    // Handle clicks outside to potentially close plugin
    container.shadowRoot.addEventListener("click", (e) => {
      e.stopPropagation();
    });

    // Handle keyboard events
    container.shadowRoot.addEventListener("keydown", (e) => {
      this.handleContainerKeydown(container, e);
    });

    // Handle focus events
    container.shadowRoot.addEventListener("focusin", (e) => {
      this.handleContainerFocusIn(container, e);
    });

    container.shadowRoot.addEventListener("focusout", (e) => {
      this.handleContainerFocusOut(container, e);
    });
  }

  private handleContainerKeydown(
    container: ShadowContainer,
    e: KeyboardEvent,
  ): void {
    // Handle Escape key to close plugin
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      this.emitContainerEvent("escape", container);
    }

    // Handle Tab navigation within shadow DOM
    if (e.key === "Tab") {
      this.handleTabNavigation(container, e);
    }
  }

  private handleTabNavigation(
    container: ShadowContainer,
    e: KeyboardEvent,
  ): void {
    const focusableElements = container.shadowRoot.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );

    if (focusableElements.length === 0) return;

    const firstElement = focusableElements[0] as HTMLElement;
    const lastElement = focusableElements[
      focusableElements.length - 1
    ] as HTMLElement;

    if (e.shiftKey) {
      // Shift+Tab - going backwards
      if (document.activeElement === firstElement) {
        e.preventDefault();
        lastElement.focus();
      }
    } else {
      // Tab - going forwards
      if (document.activeElement === lastElement) {
        e.preventDefault();
        firstElement.focus();
      }
    }
  }

  private handleContainerFocusIn(
    container: ShadowContainer,
    e: FocusEvent,
  ): void {
    // Emit focus event for plugin management
    this.emitContainerEvent("focus", container, { target: e.target });
  }

  private handleContainerFocusOut(
    container: ShadowContainer,
    e: FocusEvent,
  ): void {
    // Check if focus is leaving the shadow DOM entirely
    setTimeout(() => {
      const activeElement = container.shadowRoot.activeElement;
      if (!activeElement) {
        this.emitContainerEvent("blur", container, { target: e.target });
      }
    }, 0);
  }

  // ========================================
  // Focus Management
  // ========================================

  private setupFocusManagement(container: ShadowContainer): void {
    // Set up focus trap when container is active
    container.hostElement.addEventListener("focus", () => {
      if (container.isActive) {
        this.focusFirstElement(container);
      }
    });
  }

  focusFirstElement(container: ShadowContainer): void {
    const focusableElements = container.shadowRoot.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );

    if (focusableElements.length > 0) {
      (focusableElements[0] as HTMLElement).focus();
    }
  }

  focusContainer(pluginId: string): void {
    const container = this.getContainer(pluginId);
    if (container && container.isActive) {
      this.focusFirstElement(container);
    }
  }

  // ========================================
  // Theme Management
  // ========================================

  private setupThemeDetection(): void {
    if (window.matchMedia) {
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
      mediaQuery.addEventListener("change", () => {
        this.updateAllContainerThemes();
      });
    }
  }

  private applyTheme(
    container: ShadowContainer,
    theme: "light" | "dark" | "auto",
  ): void {
    const resolvedTheme =
      theme === "auto"
        ? window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light"
        : theme;

    container.hostElement.setAttribute("data-theme", resolvedTheme);

    // Update CSS custom properties
    const themeVars = this.getThemeVariables(resolvedTheme);
    Object.entries(themeVars).forEach(([property, value]) => {
      container.shadowRoot.host.style.setProperty(property, value);
    });
  }

  private getThemeVariables(theme: "light" | "dark"): Record<string, string> {
    if (theme === "dark") {
      return {
        "--raycast-text-color": "#ffffff",
        "--raycast-bg-color": "#1c1c1e",
        "--raycast-surface-color": "#2c2c2e",
        "--raycast-border-color": "#38383a",
        "--raycast-hover-color": "#3a3a3c",
        "--raycast-focus-color": "#0a84ff",
        "--raycast-accent-color": "#0a84ff",
      };
    } else {
      return {
        "--raycast-text-color": "#000000",
        "--raycast-bg-color": "#ffffff",
        "--raycast-surface-color": "#f8f9fa",
        "--raycast-border-color": "#e5e5e5",
        "--raycast-hover-color": "#f5f5f5",
        "--raycast-focus-color": "#007AFF",
        "--raycast-accent-color": "#007AFF",
      };
    }
  }

  private updateAllContainerThemes(): void {
    this.containers.forEach((container) => {
      this.applyTheme(container, container.config.theme || "auto");
    });
  }

  // ========================================
  // Global Event Handlers
  // ========================================

  private setupGlobalEventHandlers(): void {
    // Handle clicks outside shadow containers
    document.addEventListener("click", (e) => {
      if (
        this.activeContainer &&
        !this.isEventFromContainer(e, this.activeContainer)
      ) {
        this.emitContainerEvent("clickOutside", this.activeContainer);
      }
    });

    // Handle global keyboard shortcuts
    document.addEventListener("keydown", (e) => {
      if (this.activeContainer) {
        this.handleGlobalKeydown(e);
      }
    });
  }

  private isEventFromContainer(e: Event, container: ShadowContainer): boolean {
    const target = e.target as Node;
    return (
      container.hostElement.contains(target) ||
      container.shadowRoot.contains(target)
    );
  }

  private handleGlobalKeydown(e: KeyboardEvent): void {
    // Handle global shortcuts that should work even when focus is in shadow DOM
    if (e.metaKey || e.ctrlKey) {
      switch (e.key) {
        case "w":
          // Cmd/Ctrl+W - close active plugin
          e.preventDefault();
          if (this.activeContainer) {
            this.emitContainerEvent("close", this.activeContainer);
          }
          break;
      }
    }
  }

  // ========================================
  // Event System
  // ========================================

  private emitContainerEvent(
    eventType: string,
    container: ShadowContainer,
    detail?: any,
  ): void {
    const event = new CustomEvent(`raycast:container:${eventType}`, {
      detail: {
        pluginId: container.pluginId,
        containerId: container.id,
        ...detail,
      },
    });

    // Emit on both the container and globally
    container.hostElement.dispatchEvent(event);
    window.dispatchEvent(event);
  }

  // ========================================
  // Utility Methods
  // ========================================

  setGlobalStyles(css: string): void {
    this.globalStyles = css;

    // Update all existing containers
    this.containers.forEach((container) => {
      const existingGlobalStyle = container.shadowRoot.querySelector(
        'style[data-raycast-styles="global"]',
      );
      if (existingGlobalStyle) {
        existingGlobalStyle.textContent = css;
      } else if (css) {
        const globalStyle = document.createElement("style");
        globalStyle.setAttribute("data-raycast-styles", "global");
        globalStyle.textContent = css;
        container.shadowRoot.appendChild(globalStyle);
      }
    });
  }

  getAllContainers(): ShadowContainer[] {
    return Array.from(this.containers.values());
  }

  getActiveContainer(): ShadowContainer | null {
    return this.activeContainer;
  }

  cleanup(): void {
    // Destroy all containers
    const containerIds = Array.from(this.containers.keys());
    containerIds.forEach((id) => {
      const pluginId = id.replace("raycast-plugin-", "");
      this.destroyContainer(pluginId);
    });

    this.activeContainer = null;
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

export const shadowDOMManager = ShadowDOMManager.getInstance();

