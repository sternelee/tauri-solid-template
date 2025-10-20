import { createSignal, createEffect } from 'solid-js';
import { ComponentMapping, ComponentRenderer, ComponentFactory as IComponentFactory } from '../components';
import { 
  ListProps, ListItemProps, ListSectionProps, ListEmptyViewProps,
  DetailProps, DetailMetadataProps, DetailMetadataLabelProps,
  FormProps, FormTextFieldProps, FormTextAreaProps, FormDropdownProps,
  GridProps, GridItemProps, GridSectionProps, GridEmptyViewProps,
  ActionProps, ActionPanelProps, ActionPanelSectionProps,
  ActionPushProps, ActionCopyToClipboardProps, ActionOpenInBrowserProps
} from '../types';
import { ComponentMappingRegistryImpl } from '../components';
import { DEFAULT_COMPONENT_MAPPINGS } from './ComponentMappingConfig';
import { JSX } from 'react';
import { JSX } from 'react';
import { JSX } from 'react';
import { JSX } from 'react';
import { JSX } from 'react';
import { JSX } from 'react';
import { JSX } from 'react';
import { JSX } from 'react';
import { JSX } from 'react';
import { JSX } from 'react';
import { JSX } from 'react';
import { JSX } from 'react';
import { JSX } from 'react';
import { JSX } from 'react';
import { JSX } from 'react';
import { JSX } from 'react';
import { JSX } from 'react';
import { JSX } from 'react';
import { JSX } from 'react';
import { JSX } from 'react';
import { JSX } from 'react';
import { JSX } from 'react';
import { JSX } from 'react';
import { JSX } from 'react';
import { JSX } from 'react';
import { JSX } from 'react';
import { JSX } from 'react';
import { JSX } from 'react';
import { JSX } from 'react';
import { JSX } from 'react';
import { JSX } from 'react';
import { JSX } from 'react';

// ============================================================================
// SolidJS Component Factory Implementation
// ============================================================================

export class SolidComponentFactory implements IComponentFactory {
  private mappingRegistry: ComponentMappingRegistryImpl;
  private renderer: ComponentRenderer;

  constructor(renderer: ComponentRenderer) {
    this.renderer = renderer;
    this.mappingRegistry = new ComponentMappingRegistryImpl();
    
    // Register default mappings
    DEFAULT_COMPONENT_MAPPINGS.forEach(mapping => {
      this.mappingRegistry.register(mapping);
    });
  }

  // ========================================
  // List Components
  // ========================================

  createList(props: ListProps): any {
    const mapping = this.mappingRegistry.get('List');
    if (!mapping) throw new Error('List mapping not found');

    const transformedProps = mapping.propsTransform ? mapping.propsTransform(props) : props;
    
    return this.createBaseComponent('div', {
      ...transformedProps,
      children: props.children
    });
  }

  createListItem(props: ListItemProps): any {
    const mapping = this.mappingRegistry.get('List.Item');
    if (!mapping) throw new Error('List.Item mapping not found');

    const transformedProps = mapping.propsTransform ? mapping.propsTransform(props) : props;
    
    return this.createBaseComponent('div', {
      ...transformedProps,
      onClick: () => {
        // Handle item selection
        console.log('List item clicked:', props.title);
      },
      children: [
        // Icon
        props.icon && this.createIcon(props.icon),
        // Content
        this.createBaseComponent('div', {
          class: 'flex-1 min-w-0',
          children: [
            // Title
            this.createBaseComponent('div', {
              class: 'font-medium text-gray-900 dark:text-gray-100 truncate',
              children: props.title
            }),
            // Subtitle
            props.subtitle && this.createBaseComponent('div', {
              class: 'text-sm text-gray-500 dark:text-gray-400 truncate',
              children: props.subtitle
            })
          ]
        }),
        // Accessories
        props.accessories && this.createAccessories(props.accessories)
      ]
    });
  }

  createListSection(props: ListSectionProps): JSX.Element {
    const mapping = this.mappingRegistry.get('List.Section');
    if (!mapping) throw new Error('List.Section mapping not found');

    const transformedProps = mapping.propsTransform ? mapping.propsTransform(props) : props;
    
    return this.createBaseComponent('div', {
      ...transformedProps,
      children: [
        // Section header
        (props.title || props.subtitle) && this.createBaseComponent('div', {
          class: 'px-4 py-2 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700',
          children: [
            props.title && this.createBaseComponent('h3', {
              class: 'text-sm font-semibold text-gray-900 dark:text-gray-100',
              children: props.title
            }),
            props.subtitle && this.createBaseComponent('p', {
              class: 'text-xs text-gray-500 dark:text-gray-400',
              children: props.subtitle
            })
          ]
        }),
        // Section content
        props.children
      ]
    });
  }

  createListEmptyView(props: ListEmptyViewProps): JSX.Element {
    const mapping = this.mappingRegistry.get('List.EmptyView');
    if (!mapping) throw new Error('List.EmptyView mapping not found');

    const transformedProps = mapping.propsTransform ? mapping.propsTransform(props) : props;
    
    return this.createBaseComponent('div', {
      ...transformedProps,
      children: [
        props.icon && this.createIcon(props.icon, 'w-16 h-16 mb-4 text-gray-400'),
        props.title && this.createBaseComponent('h3', {
          class: 'text-lg font-medium mb-2',
          children: props.title
        }),
        props.description && this.createBaseComponent('p', {
          class: 'text-sm mb-4',
          children: props.description
        }),
        props.actions
      ]
    });
  }

  // ========================================
  // Detail Components
  // ========================================

  createDetail(props: DetailProps): JSX.Element {
    const mapping = this.mappingRegistry.get('Detail');
    if (!mapping) throw new Error('Detail mapping not found');

    const transformedProps = mapping.propsTransform ? mapping.propsTransform(props) : props;
    
    return this.createBaseComponent('div', {
      ...transformedProps,
      children: [
        // Main content area
        this.createBaseComponent('div', {
          class: 'flex-1 overflow-auto',
          children: [
            // Loading state
            props.isLoading && this.createLoadingSpinner(),
            // Markdown content
            props.markdown && this.createMarkdownContent(props.markdown),
            // Custom children
            props.children
          ]
        }),
        // Metadata sidebar
        props.metadata && this.createBaseComponent('div', {
          class: 'w-80 flex-shrink-0',
          children: props.metadata
        }),
        // Actions
        props.actions
      ]
    });
  }

  createDetailMetadata(props: DetailMetadataProps): JSX.Element {
    const mapping = this.mappingRegistry.get('Detail.Metadata');
    if (!mapping) throw new Error('Detail.Metadata mapping not found');

    const transformedProps = mapping.propsTransform ? mapping.propsTransform(props) : props;
    
    return this.createBaseComponent('div', {
      ...transformedProps,
      children: props.children
    });
  }

  createDetailMetadataLabel(props: DetailMetadataLabelProps): JSX.Element {
    const mapping = this.mappingRegistry.get('Detail.Metadata.Label');
    if (!mapping) throw new Error('Detail.Metadata.Label mapping not found');

    const transformedProps = mapping.propsTransform ? mapping.propsTransform(props) : props;
    
    return this.createBaseComponent('div', {
      ...transformedProps,
      children: [
        this.createBaseComponent('span', {
          class: 'text-sm font-medium text-gray-600 dark:text-gray-400',
          children: props.title
        }),
        this.createBaseComponent('span', {
          class: 'text-sm text-gray-900 dark:text-gray-100',
          children: props.text || ''
        })
      ]
    });
  }

  // ========================================
  // Form Components
  // ========================================

  createForm(props: FormProps): JSX.Element {
    const mapping = this.mappingRegistry.get('Form');
    if (!mapping) throw new Error('Form mapping not found');

    const transformedProps = mapping.propsTransform ? mapping.propsTransform(props) : props;
    
    return this.createBaseComponent('form', {
      ...transformedProps,
      onSubmit: (e: Event) => {
        e.preventDefault();
        if (props.onSubmit) {
          // Collect form values
          const formData = new FormData(e.target as HTMLFormElement);
          const values: Record<string, any> = {};
          formData.forEach((value, key) => {
            values[key] = value;
          });
          props.onSubmit(values);
        }
      },
      children: [
        props.children,
        props.actions
      ]
    });
  }

  createFormTextField(props: FormTextFieldProps): JSX.Element {
    const mapping = this.mappingRegistry.get('Form.TextField');
    if (!mapping) throw new Error('Form.TextField mapping not found');

    const [value, setValue] = createSignal(props.value || props.defaultValue || '');
    
    createEffect(() => {
      if (props.value !== undefined) {
        setValue(props.value);
      }
    });

    const transformedProps = mapping.propsTransform ? mapping.propsTransform(props) : props;
    
    return this.createBaseComponent('div', {
      class: 'raycast-form-field',
      children: [
        // Label
        props.title && this.createBaseComponent('label', {
          class: 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1',
          for: props.id,
          children: props.title
        }),
        // Input
        this.createBaseComponent('input', {
          ...transformedProps,
          id: props.id,
          name: props.id,
          value: value(),
          onInput: (e: Event) => {
            const target = e.target as HTMLInputElement;
            setValue(target.value);
            props.onChange?.(target.value);
          },
          onBlur: props.onBlur,
          onFocus: props.onFocus
        }),
        // Error message
        props.error && this.createBaseComponent('p', {
          class: 'text-sm text-red-600 dark:text-red-400 mt-1',
          children: props.error
        }),
        // Info message
        props.info && this.createBaseComponent('p', {
          class: 'text-sm text-gray-500 dark:text-gray-400 mt-1',
          children: props.info
        })
      ]
    });
  }

  createFormTextArea(props: FormTextAreaProps): JSX.Element {
    const mapping = this.mappingRegistry.get('Form.TextArea');
    if (!mapping) throw new Error('Form.TextArea mapping not found');

    const [value, setValue] = createSignal(props.value || props.defaultValue || '');
    
    createEffect(() => {
      if (props.value !== undefined) {
        setValue(props.value);
      }
    });

    const transformedProps = mapping.propsTransform ? mapping.propsTransform(props) : props;
    
    return this.createBaseComponent('div', {
      class: 'raycast-form-field',
      children: [
        // Label
        props.title && this.createBaseComponent('label', {
          class: 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1',
          for: props.id,
          children: props.title
        }),
        // TextArea
        this.createBaseComponent('textarea', {
          ...transformedProps,
          id: props.id,
          name: props.id,
          value: value(),
          onInput: (e: Event) => {
            const target = e.target as HTMLTextAreaElement;
            setValue(target.value);
            props.onChange?.(target.value);
          },
          onBlur: props.onBlur,
          onFocus: props.onFocus
        }),
        // Error message
        props.error && this.createBaseComponent('p', {
          class: 'text-sm text-red-600 dark:text-red-400 mt-1',
          children: props.error
        }),
        // Info message
        props.info && this.createBaseComponent('p', {
          class: 'text-sm text-gray-500 dark:text-gray-400 mt-1',
          children: props.info
        })
      ]
    });
  }

  createFormDropdown(props: FormDropdownProps): JSX.Element {
    const mapping = this.mappingRegistry.get('Form.Dropdown');
    if (!mapping) throw new Error('Form.Dropdown mapping not found');

    const [value, setValue] = createSignal(props.value || props.defaultValue || '');
    
    createEffect(() => {
      if (props.value !== undefined) {
        setValue(props.value);
      }
    });

    const transformedProps = mapping.propsTransform ? mapping.propsTransform(props) : props;
    
    return this.createBaseComponent('div', {
      class: 'raycast-form-field',
      children: [
        // Label
        props.title && this.createBaseComponent('label', {
          class: 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1',
          for: props.id,
          children: props.title
        }),
        // Select
        this.createBaseComponent('select', {
          ...transformedProps,
          id: props.id,
          name: props.id,
          value: value(),
          onChange: (e: Event) => {
            const target = e.target as HTMLSelectElement;
            setValue(target.value);
            props.onChange?.(target.value);
          },
          children: [
            // Placeholder option
            props.placeholder && this.createBaseComponent('option', {
              value: '',
              disabled: true,
              children: props.placeholder
            }),
            // Options from children
            props.children
          ]
        }),
        // Error message
        props.error && this.createBaseComponent('p', {
          class: 'text-sm text-red-600 dark:text-red-400 mt-1',
          children: props.error
        }),
        // Info message
        props.info && this.createBaseComponent('p', {
          class: 'text-sm text-gray-500 dark:text-gray-400 mt-1',
          children: props.info
        })
      ]
    });
  }

  createFormDropdownItem(props: any): JSX.Element {
    const mapping = this.mappingRegistry.get('Form.Dropdown.Item');
    if (!mapping) throw new Error('Form.Dropdown.Item mapping not found');

    const transformedProps = mapping.propsTransform ? mapping.propsTransform(props) : props;
    
    return this.createBaseComponent('option', {
      ...transformedProps,
      children: props.title
    });
  }

  createFormDropdownSection(props: any): JSX.Element {
    return this.createBaseComponent('optgroup', {
      label: props.title,
      children: props.children
    });
  }

  createFormDescription(props: any): JSX.Element {
    return this.createBaseComponent('div', {
      class: 'raycast-form-description mb-4',
      children: [
        props.title && this.createBaseComponent('h3', {
          class: 'text-lg font-medium text-gray-900 dark:text-gray-100 mb-2',
          children: props.title
        }),
        this.createBaseComponent('p', {
          class: 'text-sm text-gray-600 dark:text-gray-400',
          children: props.text
        })
      ]
    });
  }

  createFormLinkAccessory(props: any): JSX.Element {
    return this.createBaseComponent('a', {
      href: props.target,
      target: '_blank',
      rel: 'noopener noreferrer',
      class: 'text-blue-600 dark:text-blue-400 hover:underline text-sm',
      children: props.text
    });
  }

  // ========================================
  // Grid Components
  // ========================================

  createGrid(props: GridProps): JSX.Element {
    const mapping = this.mappingRegistry.get('Grid');
    if (!mapping) throw new Error('Grid mapping not found');

    const transformedProps = mapping.propsTransform ? mapping.propsTransform(props) : props;
    
    return this.createBaseComponent('div', {
      ...transformedProps,
      children: props.children
    });
  }

  createGridItem(props: GridItemProps): JSX.Element {
    const mapping = this.mappingRegistry.get('Grid.Item');
    if (!mapping) throw new Error('Grid.Item mapping not found');

    const transformedProps = mapping.propsTransform ? mapping.propsTransform(props) : props;
    
    return this.createBaseComponent('div', {
      ...transformedProps,
      onClick: () => {
        console.log('Grid item clicked:', props.title);
      },
      children: [
        // Content (image or custom content)
        props.content && this.createBaseComponent('div', {
          class: 'mb-2',
          children: props.content
        }),
        // Title
        props.title && this.createBaseComponent('h3', {
          class: 'font-medium text-gray-900 dark:text-gray-100 text-sm truncate',
          children: props.title
        }),
        // Subtitle
        props.subtitle && this.createBaseComponent('p', {
          class: 'text-xs text-gray-500 dark:text-gray-400 truncate',
          children: props.subtitle
        }),
        // Accessory
        props.accessory && this.createAccessory(props.accessory)
      ]
    });
  }

  createGridSection(props: GridSectionProps): JSX.Element {
    const mapping = this.mappingRegistry.get('Grid.Section');
    if (!mapping) throw new Error('Grid.Section mapping not found');

    const transformedProps = mapping.propsTransform ? mapping.propsTransform(props) : props;
    
    return this.createBaseComponent('div', {
      ...transformedProps,
      children: [
        // Section header
        (props.title || props.subtitle) && this.createBaseComponent('div', {
          class: 'mb-4',
          children: [
            props.title && this.createBaseComponent('h2', {
              class: 'text-lg font-semibold text-gray-900 dark:text-gray-100',
              children: props.title
            }),
            props.subtitle && this.createBaseComponent('p', {
              class: 'text-sm text-gray-500 dark:text-gray-400',
              children: props.subtitle
            })
          ]
        }),
        // Section content
        props.children
      ]
    });
  }

  createGridEmptyView(props: GridEmptyViewProps): JSX.Element {
    const mapping = this.mappingRegistry.get('Grid.EmptyView');
    if (!mapping) throw new Error('Grid.EmptyView mapping not found');

    const transformedProps = mapping.propsTransform ? mapping.propsTransform(props) : props;
    
    return this.createBaseComponent('div', {
      ...transformedProps,
      children: [
        props.icon && this.createIcon(props.icon, 'w-16 h-16 mb-4 text-gray-400'),
        props.title && this.createBaseComponent('h3', {
          class: 'text-lg font-medium mb-2',
          children: props.title
        }),
        props.description && this.createBaseComponent('p', {
          class: 'text-sm mb-4',
          children: props.description
        }),
        props.actions
      ]
    });
  }

  // ========================================
  // Action Components
  // ========================================

  createAction(props: ActionProps): JSX.Element {
    const mapping = this.mappingRegistry.get('Action');
    if (!mapping) throw new Error('Action mapping not found');

    const transformedProps = mapping.propsTransform ? mapping.propsTransform(props) : props;
    
    return this.createBaseComponent('button', {
      ...transformedProps,
      onClick: props.onAction,
      children: [
        props.icon && this.createIcon(props.icon, 'w-4 h-4 mr-2'),
        props.title
      ]
    });
  }

  createActionPanel(props: ActionPanelProps): JSX.Element {
    const mapping = this.mappingRegistry.get('ActionPanel');
    if (!mapping) throw new Error('ActionPanel mapping not found');

    const transformedProps = mapping.propsTransform ? mapping.propsTransform(props) : props;
    
    return this.createBaseComponent('div', {
      ...transformedProps,
      children: [
        props.title && this.createBaseComponent('h3', {
          class: 'text-sm font-medium text-gray-900 dark:text-gray-100 mb-2',
          children: props.title
        }),
        props.children
      ]
    });
  }

  createActionPanelSection(props: ActionPanelSectionProps): JSX.Element {
    const mapping = this.mappingRegistry.get('ActionPanel.Section');
    if (!mapping) throw new Error('ActionPanel.Section mapping not found');

    const transformedProps = mapping.propsTransform ? mapping.propsTransform(props) : props;
    
    return this.createBaseComponent('div', {
      ...transformedProps,
      children: [
        props.title && this.createBaseComponent('h4', {
          class: 'text-xs font-medium text-gray-600 dark:text-gray-400 mb-1',
          children: props.title
        }),
        props.children
      ]
    });
  }

  createActionPanelSubmenu(props: any): JSX.Element {
    return this.createBaseComponent('div', {
      class: 'raycast-action-submenu',
      children: [
        this.createBaseComponent('button', {
          class: 'w-full text-left px-3 py-1.5 text-sm rounded-md transition-colors bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-gray-100',
          children: [
            props.icon && this.createIcon(props.icon, 'w-4 h-4 mr-2'),
            props.title
          ]
        }),
        // Submenu content would be shown on hover/click
        props.children
      ]
    });
  }

  createActionPush(props: ActionPushProps): JSX.Element {
    const mapping = this.mappingRegistry.get('Action.Push');
    if (!mapping) throw new Error('Action.Push mapping not found');

    const transformedProps = mapping.propsTransform ? mapping.propsTransform(props) : props;
    
    return this.createBaseComponent('button', {
      ...transformedProps,
      onClick: () => {
        // Handle navigation push
        props.onPush?.();
        // TODO: Integrate with navigation manager
        console.log('Push action:', props.title);
      },
      children: [
        props.icon && this.createIcon(props.icon, 'w-4 h-4 mr-2'),
        props.title
      ]
    });
  }

  createActionCopyToClipboard(props: ActionCopyToClipboardProps): JSX.Element {
    const mapping = this.mappingRegistry.get('Action.CopyToClipboard');
    if (!mapping) throw new Error('Action.CopyToClipboard mapping not found');

    const transformedProps = mapping.propsTransform ? mapping.propsTransform(props) : props;
    
    return this.createBaseComponent('button', {
      ...transformedProps,
      onClick: async () => {
        try {
          await navigator.clipboard.writeText(String(props.content));
          console.log('Copied to clipboard:', props.content);
        } catch (error) {
          console.error('Failed to copy to clipboard:', error);
        }
      },
      children: [
        props.icon && this.createIcon(props.icon, 'w-4 h-4 mr-2'),
        props.title
      ]
    });
  }

  createActionPaste(props: any): JSX.Element {
    return this.createBaseComponent('button', {
      class: 'raycast-action-paste px-3 py-1.5 text-sm rounded-md transition-colors bg-purple-600 hover:bg-purple-700 text-white',
      onClick: async () => {
        try {
          // Simulate paste action
          console.log('Paste action:', props.content);
        } catch (error) {
          console.error('Failed to paste:', error);
        }
      },
      children: [
        props.icon && this.createIcon(props.icon, 'w-4 h-4 mr-2'),
        props.title
      ]
    });
  }

  createActionOpenInBrowser(props: ActionOpenInBrowserProps): JSX.Element {
    const mapping = this.mappingRegistry.get('Action.OpenInBrowser');
    if (!mapping) throw new Error('Action.OpenInBrowser mapping not found');

    const transformedProps = mapping.propsTransform ? mapping.propsTransform(props) : props;
    
    return this.createBaseComponent('button', {
      ...transformedProps,
      onClick: () => {
        window.open(props.url, '_blank', 'noopener,noreferrer');
      },
      children: [
        props.icon && this.createIcon(props.icon, 'w-4 h-4 mr-2'),
        props.title
      ]
    });
  }

  createActionSubmitForm(props: any): JSX.Element {
    return this.createBaseComponent('button', {
      type: 'submit',
      class: 'raycast-action-submit px-3 py-1.5 text-sm rounded-md transition-colors bg-blue-600 hover:bg-blue-700 text-white',
      onClick: props.onSubmit,
      children: [
        props.icon && this.createIcon(props.icon, 'w-4 h-4 mr-2'),
        props.title
      ]
    });
  }

  // ========================================
  // Helper Methods
  // ========================================

  private createBaseComponent(tag: string, props: any): JSX.Element {
    return this.renderer.renderComponent(tag, props, props.children);
  }

  private createIcon(icon: any, className: string = 'w-5 h-5'): JSX.Element {
    if (typeof icon === 'string') {
      // Handle emoji or text icons
      return this.createBaseComponent('span', {
        class: `raycast-icon ${className}`,
        children: icon
      });
    }
    
    // Handle image icons
    if (icon.source) {
      return this.createBaseComponent('img', {
        src: icon.source,
        alt: '',
        class: `raycast-icon ${className}`
      });
    }
    
    return this.createBaseComponent('div', {
      class: `raycast-icon ${className} bg-gray-300 dark:bg-gray-600 rounded`
    });
  }

  private createAccessories(accessories: any[]): JSX.Element {
    return this.createBaseComponent('div', {
      class: 'flex items-center space-x-2',
      children: accessories.map(accessory => this.createAccessory(accessory))
    });
  }

  private createAccessory(accessory: any): JSX.Element {
    return this.createBaseComponent('div', {
      class: 'text-xs text-gray-500 dark:text-gray-400',
      children: accessory.text || accessory.tag?.value || ''
    });
  }

  private createLoadingSpinner(): JSX.Element {
    return this.createBaseComponent('div', {
      class: 'flex items-center justify-center p-8',
      children: this.createBaseComponent('div', {
        class: 'animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600'
      })
    });
  }

  private createMarkdownContent(markdown: string): JSX.Element {
    // Simple markdown rendering - in a real implementation, use a proper markdown parser
    return this.createBaseComponent('div', {
      class: 'prose dark:prose-invert max-w-none p-4',
      innerHTML: markdown.replace(/\n/g, '<br>')
    });
  }
}

// ============================================================================
// Factory Creation Function
// ============================================================================

export function createSolidComponentFactory(renderer: ComponentRenderer): SolidComponentFactory {
  return new SolidComponentFactory(renderer);
}