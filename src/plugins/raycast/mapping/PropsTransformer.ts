import { ComponentMapping } from '../components';
import { 
  ImageLike, 
  Accessory, 
  KeyboardShortcut,
  ColorLike,
  Themeable
} from '../types';

// ============================================================================
// Props Transformation System
// ============================================================================

export interface PropsTransformer {
  transform(raycastType: string, raycastProps: any): any;
  transformImage(image: ImageLike): string;
  transformColor(color: ColorLike): string;
  transformAccessories(accessories: Accessory[]): any[];
  transformShortcut(shortcut: KeyboardShortcut): string;
}

export class PropsTransformerImpl implements PropsTransformer {
  private mappings: Map<string, ComponentMapping> = new Map();

  constructor(mappings: ComponentMapping[]) {
    mappings.forEach(mapping => {
      this.mappings.set(mapping.raycastType, mapping);
    });
  }

  transform(raycastType: string, raycastProps: any): any {
    const mapping = this.mappings.get(raycastType);
    if (!mapping || !mapping.propsTransform) {
      return raycastProps;
    }

    // Apply base transformation
    let transformedProps = mapping.propsTransform(raycastProps);

    // Apply specific transformations for common prop types
    transformedProps = this.transformCommonProps(transformedProps, raycastProps);

    return transformedProps;
  }

  private transformCommonProps(transformedProps: any, originalProps: any): any {
    const result = { ...transformedProps };

    // Transform images
    if (originalProps.icon) {
      result.iconSrc = this.transformImage(originalProps.icon);
    }

    // Transform accessories
    if (originalProps.accessories) {
      result.transformedAccessories = this.transformAccessories(originalProps.accessories);
    }

    // Transform shortcuts
    if (originalProps.shortcut) {
      result.shortcutString = this.transformShortcut(originalProps.shortcut);
    }

    // Transform colors
    if (originalProps.tintColor) {
      result.tintColorValue = this.transformColor(originalProps.tintColor);
    }

    return result;
  }

  transformImage(image: ImageLike): string {
    if (typeof image === 'string') {
      // Handle emoji, URL, or file path
      if (this.isEmoji(image)) {
        return image;
      }
      if (this.isUrl(image)) {
        return image;
      }
      // Assume it's a file path
      return image;
    }

    if (typeof image === 'object' && image !== null) {
      // Handle Image object
      if ('source' in image) {
        const source = image.source;
        if (typeof source === 'string') {
          return source;
        }
        if (this.isThemeable(source)) {
          return this.resolveThemeableValue(source);
        }
      }

      // Handle FileIcon object
      if ('fileIcon' in image) {
        return this.getFileIconUrl(image.fileIcon);
      }
    }

    return '';
  }

  transformColor(color: ColorLike): string {
    if (typeof color === 'string') {
      return color;
    }

    if (this.isThemeable(color)) {
      return this.resolveThemeableValue(color);
    }

    return '#000000'; // Default color
  }

  transformAccessories(accessories: Accessory[]): any[] {
    return accessories.map(accessory => ({
      text: accessory.text,
      icon: accessory.icon ? this.transformImage(accessory.icon) : undefined,
      tooltip: accessory.tooltip,
      tag: accessory.tag ? {
        value: accessory.tag.value,
        color: accessory.tag.color ? this.transformColor(accessory.tag.color) : undefined
      } : undefined
    }));
  }

  transformShortcut(shortcut: KeyboardShortcut): string {
    const modifiers = shortcut.modifiers.map(mod => {
      switch (mod) {
        case 'cmd': return '⌘';
        case 'ctrl': return '⌃';
        case 'opt': return '⌥';
        case 'shift': return '⇧';
        default: return mod;
      }
    });

    return [...modifiers, shortcut.key].join('');
  }

  // ========================================
  // Helper Methods
  // ========================================

  private isEmoji(str: string): boolean {
    const emojiRegex = /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/u;
    return emojiRegex.test(str);
  }

  private isUrl(str: string): boolean {
    try {
      new URL(str);
      return true;
    } catch {
      return false;
    }
  }

  private isThemeable(value: any): value is Themeable {
    return typeof value === 'object' && value !== null && 'light' in value && 'dark' in value;
  }

  private resolveThemeableValue(themeable: Themeable): string {
    // Simple theme detection - in a real implementation, this would check the current theme
    const isDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    return isDark ? themeable.dark : themeable.light;
  }

  private getFileIconUrl(filePath: string): string {
    // In a real implementation, this would generate appropriate file icons
    // For now, return a placeholder or try to determine from file extension
    const extension = filePath.split('.').pop()?.toLowerCase();
    
    switch (extension) {
      case 'pdf':
        return '📄';
      case 'doc':
      case 'docx':
        return '📝';
      case 'xls':
      case 'xlsx':
        return '📊';
      case 'ppt':
      case 'pptx':
        return '📽️';
      case 'jpg':
      case 'jpeg':
      case 'png':
      case 'gif':
        return '🖼️';
      case 'mp4':
      case 'mov':
      case 'avi':
        return '🎬';
      case 'mp3':
      case 'wav':
      case 'flac':
        return '🎵';
      case 'zip':
      case 'rar':
      case '7z':
        return '🗜️';
      default:
        return '📄';
    }
  }
}

// ============================================================================
// Specialized Transformers
// ============================================================================

export class ListPropsTransformer {
  static transformListProps(props: any): any {
    return {
      ...props,
      class: `raycast-list ${props.class || ''}`,
      'data-raycast-component': 'List',
      'data-filtering': props.filtering !== false,
      'data-throttle': props.throttle !== false
    };
  }

  static transformListItemProps(props: any): any {
    return {
      ...props,
      class: `raycast-list-item ${props.class || ''}`,
      'data-raycast-component': 'List.Item',
      'data-item-id': props.id,
      'data-keywords': props.keywords?.join(',') || ''
    };
  }
}

export class FormPropsTransformer {
  static transformFormProps(props: any): any {
    return {
      ...props,
      class: `raycast-form ${props.class || ''}`,
      'data-raycast-component': 'Form',
      noValidate: true // Handle validation ourselves
    };
  }

  static transformFieldProps(props: any): any {
    return {
      ...props,
      'data-raycast-field': props.id,
      'data-required': props.required || false,
      'data-store-value': props.storeValue !== false
    };
  }
}

export class GridPropsTransformer {
  static transformGridProps(props: any): any {
    const columns = props.columns || 5;
    const inset = props.inset || 'medium';
    const fit = props.fit || 'contain';

    return {
      ...props,
      class: `raycast-grid ${props.class || ''}`,
      'data-raycast-component': 'Grid',
      'data-columns': columns,
      'data-inset': inset,
      'data-fit': fit,
      style: {
        ...props.style,
        '--grid-columns': columns,
        '--grid-inset': this.getInsetValue(inset),
        '--grid-fit': fit
      }
    };
  }

  static transformGridItemProps(props: any): any {
    return {
      ...props,
      class: `raycast-grid-item ${props.class || ''}`,
      'data-raycast-component': 'Grid.Item',
      'data-item-id': props.id,
      'data-keywords': props.keywords?.join(',') || ''
    };
  }

  private static getInsetValue(inset: string): string {
    switch (inset) {
      case 'small': return '0.5rem';
      case 'medium': return '1rem';
      case 'large': return '1.5rem';
      default: return '1rem';
    }
  }
}

export class ActionPropsTransformer {
  static transformActionProps(props: any): any {
    return {
      ...props,
      class: `raycast-action ${props.class || ''}`,
      'data-raycast-component': 'Action',
      'data-action-style': props.style || 'regular',
      'data-shortcut': props.shortcut ? JSON.stringify(props.shortcut) : undefined
    };
  }

  static transformActionPanelProps(props: any): any {
    return {
      ...props,
      class: `raycast-action-panel ${props.class || ''}`,
      'data-raycast-component': 'ActionPanel'
    };
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createPropsTransformer(mappings: ComponentMapping[]): PropsTransformer {
  return new PropsTransformerImpl(mappings);
}

// ============================================================================
// Transformation Utilities
// ============================================================================

export class TransformationUtils {
  static mergeClasses(...classes: (string | undefined)[]): string {
    return classes.filter(Boolean).join(' ');
  }

  static createDataAttributes(component: string, props: Record<string, any>): Record<string, string> {
    const dataAttrs: Record<string, string> = {
      'data-raycast-component': component
    };

    // Add common data attributes
    Object.entries(props).forEach(([key, value]) => {
      if (key.startsWith('data-') || ['id', 'role', 'aria-'].some(prefix => key.startsWith(prefix))) {
        dataAttrs[key] = String(value);
      }
    });

    return dataAttrs;
  }

  static normalizeEventHandlers(props: any): any {
    const normalized = { ...props };

    // Normalize common event handlers
    if (props.onAction && !props.onClick) {
      normalized.onClick = props.onAction;
    }

    if (props.onSearchTextChange && !props.onInput) {
      normalized.onInput = (e: Event) => {
        const target = e.target as HTMLInputElement;
        props.onSearchTextChange(target.value);
      };
    }

    return normalized;
  }

  static applyTheme(props: any, theme: 'light' | 'dark' | 'auto' = 'auto'): any {
    const resolvedTheme = theme === 'auto' 
      ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : theme;

    return {
      ...props,
      'data-theme': resolvedTheme,
      class: `${props.class || ''} ${resolvedTheme === 'dark' ? 'dark' : ''}`.trim()
    };
  }
}