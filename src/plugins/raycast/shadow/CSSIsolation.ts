import { RaycastTheme } from '../components';

// ============================================================================
// CSS Isolation and Theme Injection System
// ============================================================================

export interface CSSIsolationConfig {
  enableReset: boolean;
  enableThemeVariables: boolean;
  enableComponentStyles: boolean;
  enableAnimations: boolean;
  enableResponsive: boolean;
  customCSS?: string;
}

export class CSSIsolationManager {
  private static instance: CSSIsolationManager;
  private baseCSS: string = '';
  private themeCSS: Map<string, string> = new Map();
  private componentCSS: Map<string, string> = new Map();

  private constructor() {
    this.generateBaseCSS();
    this.generateComponentCSS();
  }

  static getInstance(): CSSIsolationManager {
    if (!CSSIsolationManager.instance) {
      CSSIsolationManager.instance = new CSSIsolationManager();
    }
    return CSSIsolationManager.instance;
  }

  // ========================================
  // CSS Generation
  // ========================================

  generateIsolatedCSS(
    theme: RaycastTheme,
    config: CSSIsolationConfig = this.getDefaultConfig()
  ): string {
    const cssBlocks: string[] = [];

    // Base reset and normalization
    if (config.enableReset) {
      cssBlocks.push(this.generateResetCSS());
    }

    // Theme variables
    if (config.enableThemeVariables) {
      cssBlocks.push(this.generateThemeVariables(theme));
    }

    // Component styles
    if (config.enableComponentStyles) {
      cssBlocks.push(this.generateComponentStyles());
    }

    // Animation styles
    if (config.enableAnimations) {
      cssBlocks.push(this.generateAnimationCSS());
    }

    // Responsive styles
    if (config.enableResponsive) {
      cssBlocks.push(this.generateResponsiveCSS());
    }

    // Custom CSS
    if (config.customCSS) {
      cssBlocks.push(config.customCSS);
    }

    return cssBlocks.join('\n\n');
  }

  private generateResetCSS(): string {
    return `
      /* Raycast Plugin CSS Reset */
      :host {
        all: initial;
        display: block;
        contain: layout style paint;
      }

      *, *::before, *::after {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
      }

      html, body, div, span, applet, object, iframe,
      h1, h2, h3, h4, h5, h6, p, blockquote, pre,
      a, abbr, acronym, address, big, cite, code,
      del, dfn, em, img, ins, kbd, q, s, samp,
      small, strike, strong, sub, sup, tt, var,
      b, u, i, center,
      dl, dt, dd, ol, ul, li,
      fieldset, form, label, legend,
      table, caption, tbody, tfoot, thead, tr, th, td,
      article, aside, canvas, details, embed, 
      figure, figcaption, footer, header, hgroup, 
      menu, nav, output, ruby, section, summary,
      time, mark, audio, video {
        margin: 0;
        padding: 0;
        border: 0;
        font-size: 100%;
        font: inherit;
        vertical-align: baseline;
      }

      button, input, select, textarea {
        font-family: inherit;
        font-size: inherit;
        line-height: inherit;
        color: inherit;
        background: transparent;
        border: none;
        outline: none;
      }

      button {
        cursor: pointer;
      }

      button:disabled {
        cursor: not-allowed;
      }

      a {
        color: inherit;
        text-decoration: none;
      }

      img {
        max-width: 100%;
        height: auto;
      }

      ul, ol {
        list-style: none;
      }

      table {
        border-collapse: collapse;
        border-spacing: 0;
      }
    `;
  }

  private generateThemeVariables(theme: RaycastTheme): string {
    return `
      /* Raycast Theme Variables */
      :host {
        /* Colors */
        --raycast-primary: ${theme.colors.primary};
        --raycast-secondary: ${theme.colors.secondary};
        --raycast-background: ${theme.colors.background};
        --raycast-surface: ${theme.colors.surface};
        --raycast-text: ${theme.colors.text};
        --raycast-text-secondary: ${theme.colors.textSecondary};
        --raycast-border: ${theme.colors.border};
        --raycast-accent: ${theme.colors.accent};

        /* Spacing */
        --raycast-spacing-xs: ${theme.spacing.xs};
        --raycast-spacing-sm: ${theme.spacing.sm};
        --raycast-spacing-md: ${theme.spacing.md};
        --raycast-spacing-lg: ${theme.spacing.lg};
        --raycast-spacing-xl: ${theme.spacing.xl};

        /* Border Radius */
        --raycast-border-radius-sm: ${theme.borderRadius.sm};
        --raycast-border-radius-md: ${theme.borderRadius.md};
        --raycast-border-radius-lg: ${theme.borderRadius.lg};

        /* Typography */
        --raycast-font-family: ${theme.typography.fontFamily};
        --raycast-font-size-xs: ${theme.typography.fontSize.xs};
        --raycast-font-size-sm: ${theme.typography.fontSize.sm};
        --raycast-font-size-md: ${theme.typography.fontSize.md};
        --raycast-font-size-lg: ${theme.typography.fontSize.lg};
        --raycast-font-size-xl: ${theme.typography.fontSize.xl};
        --raycast-font-weight-normal: ${theme.typography.fontWeight.normal};
        --raycast-font-weight-medium: ${theme.typography.fontWeight.medium};
        --raycast-font-weight-semibold: ${theme.typography.fontWeight.semibold};
        --raycast-font-weight-bold: ${theme.typography.fontWeight.bold};

        /* Base styles */
        font-family: var(--raycast-font-family);
        font-size: var(--raycast-font-size-md);
        color: var(--raycast-text);
        background-color: var(--raycast-background);
        width: 100%;
        height: 100%;
      }
    `;
  }

  private generateComponentStyles(): string {
    return `
      /* Raycast Component Styles */
      
      /* List Components */
      .raycast-list {
        display: flex;
        flex-direction: column;
        height: 100%;
        background-color: var(--raycast-background);
        overflow: hidden;
      }

      .raycast-list-item {
        display: flex;
        align-items: center;
        padding: var(--raycast-spacing-sm) var(--raycast-spacing-md);
        border-bottom: 1px solid var(--raycast-border);
        cursor: pointer;
        transition: background-color 0.15s ease, transform 0.1s ease;
        user-select: none;
      }

      .raycast-list-item:hover {
        background-color: var(--raycast-surface);
      }

      .raycast-list-item:active {
        transform: scale(0.98);
      }

      .raycast-list-item:focus {
        outline: 2px solid var(--raycast-accent);
        outline-offset: -2px;
      }

      /* Detail Components */
      .raycast-detail {
        display: flex;
        height: 100%;
        background-color: var(--raycast-background);
        overflow: hidden;
      }

      .raycast-detail-content {
        flex: 1;
        overflow-y: auto;
        padding: var(--raycast-spacing-lg);
      }

      .raycast-detail-sidebar {
        width: 320px;
        flex-shrink: 0;
        background-color: var(--raycast-surface);
        border-left: 1px solid var(--raycast-border);
        overflow-y: auto;
        padding: var(--raycast-spacing-md);
      }

      /* Form Components */
      .raycast-form {
        display: flex;
        flex-direction: column;
        gap: var(--raycast-spacing-md);
        padding: var(--raycast-spacing-lg);
        background-color: var(--raycast-background);
        overflow-y: auto;
      }

      .raycast-form-field {
        display: flex;
        flex-direction: column;
        gap: var(--raycast-spacing-xs);
      }

      .raycast-form-textfield,
      .raycast-form-textarea,
      .raycast-form-dropdown select {
        padding: var(--raycast-spacing-sm);
        border: 1px solid var(--raycast-border);
        border-radius: var(--raycast-border-radius-md);
        background-color: var(--raycast-background);
        color: var(--raycast-text);
        font-size: var(--raycast-font-size-sm);
        transition: border-color 0.15s ease, box-shadow 0.15s ease;
      }

      .raycast-form-textfield:focus,
      .raycast-form-textarea:focus,
      .raycast-form-dropdown select:focus {
        border-color: var(--raycast-accent);
        box-shadow: 0 0 0 3px rgba(0, 122, 255, 0.1);
      }

      /* Grid Components */
      .raycast-grid {
        display: grid;
        gap: var(--raycast-spacing-md);
        padding: var(--raycast-spacing-md);
        background-color: var(--raycast-background);
        overflow-y: auto;
      }

      .raycast-grid-item {
        background-color: var(--raycast-surface);
        border: 1px solid var(--raycast-border);
        border-radius: var(--raycast-border-radius-lg);
        padding: var(--raycast-spacing-md);
        cursor: pointer;
        transition: all 0.2s ease;
        user-select: none;
      }

      .raycast-grid-item:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        border-color: var(--raycast-accent);
      }

      .raycast-grid-item:active {
        transform: translateY(0);
      }

      /* Action Components */
      .raycast-action,
      .raycast-action-push,
      .raycast-action-copy,
      .raycast-action-browser,
      .raycast-action-submit {
        display: inline-flex;
        align-items: center;
        padding: var(--raycast-spacing-xs) var(--raycast-spacing-sm);
        border-radius: var(--raycast-border-radius-md);
        font-size: var(--raycast-font-size-sm);
        font-weight: var(--raycast-font-weight-medium);
        cursor: pointer;
        transition: all 0.15s ease;
        user-select: none;
        border: none;
        outline: none;
      }

      .raycast-action:hover,
      .raycast-action-push:hover,
      .raycast-action-copy:hover,
      .raycast-action-browser:hover,
      .raycast-action-submit:hover {
        transform: translateY(-1px);
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      }

      .raycast-action:active,
      .raycast-action-push:active,
      .raycast-action-copy:active,
      .raycast-action-browser:active,
      .raycast-action-submit:active {
        transform: translateY(0);
      }

      .raycast-action:focus,
      .raycast-action-push:focus,
      .raycast-action-copy:focus,
      .raycast-action-browser:focus,
      .raycast-action-submit:focus {
        box-shadow: 0 0 0 3px rgba(0, 122, 255, 0.3);
      }

      .raycast-action-panel {
        background-color: var(--raycast-surface);
        border-top: 1px solid var(--raycast-border);
        padding: var(--raycast-spacing-sm);
        display: flex;
        flex-wrap: wrap;
        gap: var(--raycast-spacing-xs);
      }

      /* Utility Classes */
      .raycast-loading {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: var(--raycast-spacing-xl);
      }

      .raycast-empty {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: var(--raycast-spacing-xl);
        text-align: center;
        color: var(--raycast-text-secondary);
      }

      .raycast-icon {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }

      .raycast-truncate {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .raycast-sr-only {
        position: absolute;
        width: 1px;
        height: 1px;
        padding: 0;
        margin: -1px;
        overflow: hidden;
        clip: rect(0, 0, 0, 0);
        white-space: nowrap;
        border: 0;
      }
    `;
  }

  private generateAnimationCSS(): string {
    return `
      /* Raycast Animations */
      @keyframes raycast-fade-in {
        from {
          opacity: 0;
          transform: translateY(8px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      @keyframes raycast-fade-out {
        from {
          opacity: 1;
          transform: translateY(0);
        }
        to {
          opacity: 0;
          transform: translateY(-8px);
        }
      }

      @keyframes raycast-slide-in-right {
        from {
          opacity: 0;
          transform: translateX(16px);
        }
        to {
          opacity: 1;
          transform: translateX(0);
        }
      }

      @keyframes raycast-slide-out-right {
        from {
          opacity: 1;
          transform: translateX(0);
        }
        to {
          opacity: 0;
          transform: translateX(16px);
        }
      }

      @keyframes raycast-scale-in {
        from {
          opacity: 0;
          transform: scale(0.95);
        }
        to {
          opacity: 1;
          transform: scale(1);
        }
      }

      @keyframes raycast-spin {
        from {
          transform: rotate(0deg);
        }
        to {
          transform: rotate(360deg);
        }
      }

      @keyframes raycast-pulse {
        0%, 100% {
          opacity: 1;
        }
        50% {
          opacity: 0.5;
        }
      }

      /* Animation Classes */
      .raycast-animate-in {
        animation: raycast-fade-in 0.2s ease-out;
      }

      .raycast-animate-out {
        animation: raycast-fade-out 0.15s ease-in;
      }

      .raycast-slide-in {
        animation: raycast-slide-in-right 0.25s ease-out;
      }

      .raycast-slide-out {
        animation: raycast-slide-out-right 0.2s ease-in;
      }

      .raycast-scale-in {
        animation: raycast-scale-in 0.15s ease-out;
      }

      .raycast-spin {
        animation: raycast-spin 1s linear infinite;
      }

      .raycast-pulse {
        animation: raycast-pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
      }

      /* Transition utilities */
      .raycast-transition {
        transition: all 0.15s ease;
      }

      .raycast-transition-colors {
        transition: color 0.15s ease, background-color 0.15s ease, border-color 0.15s ease;
      }

      .raycast-transition-transform {
        transition: transform 0.15s ease;
      }
    `;
  }

  private generateResponsiveCSS(): string {
    return `
      /* Raycast Responsive Styles */
      
      /* Mobile First Approach */
      @media (max-width: 640px) {
        :host {
          font-size: 16px; /* Prevent zoom on iOS */
        }

        .raycast-list-item {
          padding: var(--raycast-spacing-md) var(--raycast-spacing-md);
        }

        .raycast-detail {
          flex-direction: column;
        }

        .raycast-detail-sidebar {
          width: 100%;
          border-left: none;
          border-top: 1px solid var(--raycast-border);
          max-height: 40vh;
        }

        .raycast-grid {
          grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
          gap: var(--raycast-spacing-sm);
          padding: var(--raycast-spacing-sm);
        }

        .raycast-form {
          padding: var(--raycast-spacing-md);
        }

        .raycast-action-panel {
          flex-direction: column;
          gap: var(--raycast-spacing-sm);
        }
      }

      /* Tablet */
      @media (min-width: 641px) and (max-width: 1024px) {
        .raycast-grid {
          grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
        }

        .raycast-detail-sidebar {
          width: 280px;
        }
      }

      /* Desktop */
      @media (min-width: 1025px) {
        .raycast-grid {
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        }

        .raycast-detail-sidebar {
          width: 320px;
        }
      }

      /* High DPI displays */
      @media (-webkit-min-device-pixel-ratio: 2), (min-resolution: 192dpi) {
        .raycast-icon-image {
          image-rendering: -webkit-optimize-contrast;
          image-rendering: crisp-edges;
        }
      }

      /* Reduced motion */
      @media (prefers-reduced-motion: reduce) {
        *,
        *::before,
        *::after {
          animation-duration: 0.01ms !important;
          animation-iteration-count: 1 !important;
          transition-duration: 0.01ms !important;
        }
      }

      /* High contrast mode */
      @media (prefers-contrast: high) {
        :host {
          --raycast-border: #000000;
        }

        .raycast-list-item,
        .raycast-grid-item,
        .raycast-action {
          border: 2px solid var(--raycast-border);
        }
      }
    `;
  }

  private generateComponentCSS(): void {
    // Generate CSS for each component type
    this.componentCSS.set('List', this.generateListCSS());
    this.componentCSS.set('Detail', this.generateDetailCSS());
    this.componentCSS.set('Form', this.generateFormCSS());
    this.componentCSS.set('Grid', this.generateGridCSS());
    this.componentCSS.set('Action', this.generateActionCSS());
  }

  private generateListCSS(): string {
    return `
      /* Enhanced List Styles */
      .raycast-list-search-bar {
        padding: var(--raycast-spacing-md);
        border-bottom: 1px solid var(--raycast-border);
        background-color: var(--raycast-surface);
      }

      .raycast-list-search-bar input {
        width: 100%;
        padding: var(--raycast-spacing-sm) var(--raycast-spacing-sm) var(--raycast-spacing-sm) 2.5rem;
        border: 1px solid var(--raycast-border);
        border-radius: var(--raycast-border-radius-md);
        background-color: var(--raycast-background);
        color: var(--raycast-text);
        font-size: var(--raycast-font-size-sm);
      }

      .raycast-list-section-header {
        padding: var(--raycast-spacing-sm) var(--raycast-spacing-md);
        background-color: var(--raycast-surface);
        border-bottom: 1px solid var(--raycast-border);
        font-size: var(--raycast-font-size-xs);
        font-weight: var(--raycast-font-weight-semibold);
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: var(--raycast-text-secondary);
      }
    `;
  }

  private generateDetailCSS(): string {
    return `
      /* Enhanced Detail Styles */
      .raycast-detail-markdown {
        line-height: 1.6;
      }

      .raycast-detail-markdown h1,
      .raycast-detail-markdown h2,
      .raycast-detail-markdown h3 {
        margin-top: var(--raycast-spacing-lg);
        margin-bottom: var(--raycast-spacing-md);
        font-weight: var(--raycast-font-weight-semibold);
        color: var(--raycast-text);
      }

      .raycast-detail-markdown p {
        margin-bottom: var(--raycast-spacing-md);
        color: var(--raycast-text);
      }

      .raycast-detail-markdown code {
        background-color: var(--raycast-surface);
        padding: 0.125rem 0.25rem;
        border-radius: var(--raycast-border-radius-sm);
        font-size: 0.875em;
      }

      .raycast-detail-markdown pre {
        background-color: var(--raycast-surface);
        padding: var(--raycast-spacing-md);
        border-radius: var(--raycast-border-radius-md);
        overflow-x: auto;
        margin: var(--raycast-spacing-md) 0;
      }
    `;
  }

  private generateFormCSS(): string {
    return `
      /* Enhanced Form Styles */
      .raycast-form-field label {
        font-size: var(--raycast-font-size-sm);
        font-weight: var(--raycast-font-weight-medium);
        color: var(--raycast-text);
      }

      .raycast-form-field .raycast-form-error {
        color: #dc2626;
        font-size: var(--raycast-font-size-xs);
        margin-top: var(--raycast-spacing-xs);
      }

      .raycast-form-field .raycast-form-info {
        color: var(--raycast-text-secondary);
        font-size: var(--raycast-font-size-xs);
        margin-top: var(--raycast-spacing-xs);
      }

      .raycast-form-dropdown-menu {
        background-color: var(--raycast-background);
        border: 1px solid var(--raycast-border);
        border-radius: var(--raycast-border-radius-md);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        max-height: 240px;
        overflow-y: auto;
      }

      .raycast-form-dropdown-item {
        padding: var(--raycast-spacing-sm) var(--raycast-spacing-md);
        cursor: pointer;
        transition: background-color 0.15s ease;
      }

      .raycast-form-dropdown-item:hover {
        background-color: var(--raycast-surface);
      }
    `;
  }

  private generateGridCSS(): string {
    return `
      /* Enhanced Grid Styles */
      .raycast-grid-item-content {
        display: flex;
        align-items: center;
        justify-content: center;
        margin-bottom: var(--raycast-spacing-sm);
        min-height: 60px;
      }

      .raycast-grid-item-text {
        text-align: center;
      }

      .raycast-grid-item-text h3 {
        font-weight: var(--raycast-font-weight-medium);
        color: var(--raycast-text);
        margin-bottom: var(--raycast-spacing-xs);
      }

      .raycast-grid-item-text p {
        color: var(--raycast-text-secondary);
        font-size: var(--raycast-font-size-xs);
      }

      .raycast-grid-section-header {
        grid-column: 1 / -1;
        margin-bottom: var(--raycast-spacing-md);
      }

      .raycast-grid-section-header h2 {
        font-size: var(--raycast-font-size-lg);
        font-weight: var(--raycast-font-weight-semibold);
        color: var(--raycast-text);
        margin-bottom: var(--raycast-spacing-xs);
      }
    `;
  }

  private generateActionCSS(): string {
    return `
      /* Enhanced Action Styles */
      .raycast-action {
        background-color: var(--raycast-surface);
        color: var(--raycast-text);
        border: 1px solid var(--raycast-border);
      }

      .raycast-action:hover {
        background-color: var(--raycast-border);
      }

      .raycast-action[data-style="destructive"] {
        background-color: #dc2626;
        color: white;
        border-color: #dc2626;
      }

      .raycast-action[data-style="destructive"]:hover {
        background-color: #b91c1c;
        border-color: #b91c1c;
      }

      .raycast-action-push {
        background-color: var(--raycast-accent);
        color: white;
        border: 1px solid var(--raycast-accent);
      }

      .raycast-action-copy {
        background-color: #6b7280;
        color: white;
        border: 1px solid #6b7280;
      }

      .raycast-action-browser {
        background-color: #059669;
        color: white;
        border: 1px solid #059669;
      }

      .raycast-keyboard-shortcut {
        margin-left: var(--raycast-spacing-sm);
        opacity: 0.7;
      }

      .raycast-keyboard-shortcut kbd {
        background-color: var(--raycast-surface);
        border: 1px solid var(--raycast-border);
        border-radius: var(--raycast-border-radius-sm);
        padding: 0.125rem 0.25rem;
        font-size: var(--raycast-font-size-xs);
        font-family: ui-monospace, SFMono-Regular, monospace;
      }
    `;
  }

  // ========================================
  // Public API
  // ========================================

  injectCSS(shadowRoot: ShadowRoot, css: string, id?: string): void {
    const style = document.createElement('style');
    if (id) {
      style.setAttribute('data-raycast-styles', id);
    }
    style.textContent = css;
    shadowRoot.appendChild(style);
  }

  updateTheme(shadowRoot: ShadowRoot, theme: RaycastTheme): void {
    const existingThemeStyle = shadowRoot.querySelector('style[data-raycast-styles="theme"]');
    if (existingThemeStyle) {
      existingThemeStyle.textContent = this.generateThemeVariables(theme);
    } else {
      this.injectCSS(shadowRoot, this.generateThemeVariables(theme), 'theme');
    }
  }

  getComponentCSS(componentType: string): string {
    return this.componentCSS.get(componentType) || '';
  }

  private getDefaultConfig(): CSSIsolationConfig {
    return {
      enableReset: true,
      enableThemeVariables: true,
      enableComponentStyles: true,
      enableAnimations: true,
      enableResponsive: true
    };
  }
}

// ============================================================================
// CSS Utilities
// ============================================================================

export class CSSUtils {
  static sanitizeCSS(css: string): string {
    // Basic CSS sanitization to prevent XSS
    return css
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/expression\s*\(/gi, '')
      .replace(/behavior\s*:/gi, '')
      .replace(/@import/gi, '');
  }

  static minifyCSS(css: string): string {
    return css
      .replace(/\/\*[\s\S]*?\*\//g, '') // Remove comments
      .replace(/\s+/g, ' ') // Collapse whitespace
      .replace(/;\s*}/g, '}') // Remove last semicolon in blocks
      .replace(/\s*{\s*/g, '{') // Clean up braces
      .replace(/;\s*/g, ';') // Clean up semicolons
      .trim();
  }

  static extractCSSVariables(css: string): Record<string, string> {
    const variables: Record<string, string> = {};
    const variableRegex = /--([\w-]+):\s*([^;]+);/g;
    let match;

    while ((match = variableRegex.exec(css)) !== null) {
      variables[`--${match[1]}`] = match[2].trim();
    }

    return variables;
  }

  static applyCSSVariables(element: HTMLElement, variables: Record<string, string>): void {
    Object.entries(variables).forEach(([property, value]) => {
      element.style.setProperty(property, value);
    });
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

export const cssIsolationManager = CSSIsolationManager.getInstance();