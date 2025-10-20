import { ComponentMapping } from '../components';

// ============================================================================
// Component Mapping Configuration
// ============================================================================

/**
 * Default component mappings from Raycast components to SolidJS/Tailwind implementations
 */
export const DEFAULT_COMPONENT_MAPPINGS: ComponentMapping[] = [
  // ========================================
  // List Components
  // ========================================
  {
    raycastType: 'List',
    shadcnComponent: 'div',
    propsTransform: (props) => ({
      class: 'raycast-list flex flex-col h-full bg-white dark:bg-gray-900',
      ...props
    }),
    styleOverrides: {
      display: 'flex',
      flexDirection: 'column',
      height: '100%'
    }
  },
  {
    raycastType: 'List.Item',
    shadcnComponent: 'div',
    propsTransform: (props) => ({
      class: `raycast-list-item flex items-center px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer border-b border-gray-200 dark:border-gray-700 ${props.class || ''}`,
      role: 'button',
      tabIndex: 0,
      ...props
    })
  },
  {
    raycastType: 'List.Section',
    shadcnComponent: 'div',
    propsTransform: (props) => ({
      class: `raycast-list-section ${props.class || ''}`,
      ...props
    })
  },
  {
    raycastType: 'List.EmptyView',
    shadcnComponent: 'div',
    propsTransform: (props) => ({
      class: `raycast-list-empty flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400 ${props.class || ''}`,
      ...props
    })
  },

  // ========================================
  // Detail Components
  // ========================================
  {
    raycastType: 'Detail',
    shadcnComponent: 'div',
    propsTransform: (props) => ({
      class: `raycast-detail flex flex-col h-full bg-white dark:bg-gray-900 ${props.class || ''}`,
      ...props
    })
  },
  {
    raycastType: 'Detail.Metadata',
    shadcnComponent: 'div',
    propsTransform: (props) => ({
      class: `raycast-detail-metadata bg-gray-50 dark:bg-gray-800 p-4 border-l border-gray-200 dark:border-gray-700 ${props.class || ''}`,
      ...props
    })
  },
  {
    raycastType: 'Detail.Metadata.Label',
    shadcnComponent: 'div',
    propsTransform: (props) => ({
      class: `raycast-metadata-label flex justify-between py-1 ${props.class || ''}`,
      ...props
    })
  },
  {
    raycastType: 'Detail.Metadata.Link',
    shadcnComponent: 'a',
    propsTransform: (props) => ({
      class: `raycast-metadata-link text-blue-600 dark:text-blue-400 hover:underline ${props.class || ''}`,
      href: props.target,
      target: '_blank',
      rel: 'noopener noreferrer',
      ...props
    })
  },
  {
    raycastType: 'Detail.Metadata.TagList',
    shadcnComponent: 'div',
    propsTransform: (props) => ({
      class: `raycast-metadata-taglist ${props.class || ''}`,
      ...props
    })
  },
  {
    raycastType: 'Detail.Metadata.TagList.Item',
    shadcnComponent: 'span',
    propsTransform: (props) => ({
      class: `raycast-metadata-tag inline-block px-2 py-1 text-xs rounded-full bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 mr-1 mb-1 ${props.class || ''}`,
      ...props
    })
  },
  {
    raycastType: 'Detail.Metadata.Separator',
    shadcnComponent: 'hr',
    propsTransform: (props) => ({
      class: `raycast-metadata-separator border-gray-200 dark:border-gray-700 my-2 ${props.class || ''}`,
      ...props
    })
  },

  // ========================================
  // Form Components
  // ========================================
  {
    raycastType: 'Form',
    shadcnComponent: 'form',
    propsTransform: (props) => ({
      class: `raycast-form flex flex-col space-y-4 p-4 bg-white dark:bg-gray-900 ${props.class || ''}`,
      ...props
    })
  },
  {
    raycastType: 'Form.TextField',
    shadcnComponent: 'input',
    propsTransform: (props) => ({
      type: 'text',
      class: `raycast-form-textfield w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 ${props.class || ''}`,
      placeholder: props.placeholder,
      value: props.value || props.defaultValue,
      ...props
    })
  },
  {
    raycastType: 'Form.TextArea',
    shadcnComponent: 'textarea',
    propsTransform: (props) => ({
      class: `raycast-form-textarea w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-vertical ${props.class || ''}`,
      placeholder: props.placeholder,
      value: props.value || props.defaultValue,
      rows: 4,
      ...props
    })
  },
  {
    raycastType: 'Form.Dropdown',
    shadcnComponent: 'select',
    propsTransform: (props) => ({
      class: `raycast-form-dropdown w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 ${props.class || ''}`,
      value: props.value || props.defaultValue,
      ...props
    })
  },
  {
    raycastType: 'Form.Dropdown.Item',
    shadcnComponent: 'option',
    propsTransform: (props) => ({
      value: props.value,
      ...props
    })
  },

  // ========================================
  // Grid Components
  // ========================================
  {
    raycastType: 'Grid',
    shadcnComponent: 'div',
    propsTransform: (props) => ({
      class: `raycast-grid grid gap-4 p-4 bg-white dark:bg-gray-900 ${getGridColumns(props.columns)} ${props.class || ''}`,
      ...props
    })
  },
  {
    raycastType: 'Grid.Item',
    shadcnComponent: 'div',
    propsTransform: (props) => ({
      class: `raycast-grid-item bg-gray-50 dark:bg-gray-800 rounded-lg p-4 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer transition-colors ${props.class || ''}`,
      role: 'button',
      tabIndex: 0,
      ...props
    })
  },
  {
    raycastType: 'Grid.Section',
    shadcnComponent: 'div',
    propsTransform: (props) => ({
      class: `raycast-grid-section ${props.class || ''}`,
      ...props
    })
  },
  {
    raycastType: 'Grid.EmptyView',
    shadcnComponent: 'div',
    propsTransform: (props) => ({
      class: `raycast-grid-empty flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400 ${props.class || ''}`,
      ...props
    })
  },

  // ========================================
  // Action Components
  // ========================================
  {
    raycastType: 'Action',
    shadcnComponent: 'button',
    propsTransform: (props) => ({
      class: `raycast-action px-3 py-1.5 text-sm rounded-md transition-colors ${getActionStyles(props.style)} ${props.class || ''}`,
      type: 'button',
      ...props
    })
  },
  {
    raycastType: 'ActionPanel',
    shadcnComponent: 'div',
    propsTransform: (props) => ({
      class: `raycast-action-panel bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-2 ${props.class || ''}`,
      ...props
    })
  },
  {
    raycastType: 'ActionPanel.Section',
    shadcnComponent: 'div',
    propsTransform: (props) => ({
      class: `raycast-action-section space-y-1 ${props.class || ''}`,
      ...props
    })
  },
  {
    raycastType: 'Action.Push',
    shadcnComponent: 'button',
    propsTransform: (props) => ({
      class: `raycast-action-push px-3 py-1.5 text-sm rounded-md transition-colors bg-blue-600 hover:bg-blue-700 text-white ${props.class || ''}`,
      type: 'button',
      ...props
    })
  },
  {
    raycastType: 'Action.CopyToClipboard',
    shadcnComponent: 'button',
    propsTransform: (props) => ({
      class: `raycast-action-copy px-3 py-1.5 text-sm rounded-md transition-colors bg-gray-600 hover:bg-gray-700 text-white ${props.class || ''}`,
      type: 'button',
      ...props
    })
  },
  {
    raycastType: 'Action.OpenInBrowser',
    shadcnComponent: 'button',
    propsTransform: (props) => ({
      class: `raycast-action-browser px-3 py-1.5 text-sm rounded-md transition-colors bg-green-600 hover:bg-green-700 text-white ${props.class || ''}`,
      type: 'button',
      ...props
    })
  }
];

// ============================================================================
// Helper Functions
// ============================================================================

function getGridColumns(columns?: number): string {
  switch (columns) {
    case 1: return 'grid-cols-1';
    case 2: return 'grid-cols-2';
    case 3: return 'grid-cols-3';
    case 4: return 'grid-cols-4';
    case 5: return 'grid-cols-5';
    case 6: return 'grid-cols-6';
    case 7: return 'grid-cols-7';
    case 8: return 'grid-cols-8';
    default: return 'grid-cols-5'; // Default Raycast grid
  }
}

function getActionStyles(style?: string): string {
  switch (style) {
    case 'destructive':
      return 'bg-red-600 hover:bg-red-700 text-white';
    case 'regular':
    default:
      return 'bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-gray-100';
  }
}

// ============================================================================
// Component Mapping Registry Configuration
// ============================================================================

export interface ComponentMappingConfig {
  mappings: ComponentMapping[];
  customMappings?: ComponentMapping[];
  overrides?: Partial<ComponentMapping>[];
}

export const DEFAULT_MAPPING_CONFIG: ComponentMappingConfig = {
  mappings: DEFAULT_COMPONENT_MAPPINGS,
  customMappings: [],
  overrides: []
};

// ============================================================================
// Mapping Utilities
// ============================================================================

export function createMappingConfig(
  customMappings: ComponentMapping[] = [],
  overrides: Partial<ComponentMapping>[] = []
): ComponentMappingConfig {
  return {
    mappings: DEFAULT_COMPONENT_MAPPINGS,
    customMappings,
    overrides
  };
}

export function mergeMappingConfigs(
  base: ComponentMappingConfig,
  override: Partial<ComponentMappingConfig>
): ComponentMappingConfig {
  return {
    mappings: override.mappings || base.mappings,
    customMappings: [
      ...(base.customMappings || []),
      ...(override.customMappings || [])
    ],
    overrides: [
      ...(base.overrides || []),
      ...(override.overrides || [])
    ]
  };
}

export function applyMappingOverrides(
  mappings: ComponentMapping[],
  overrides: Partial<ComponentMapping>[]
): ComponentMapping[] {
  return mappings.map(mapping => {
    const override = overrides.find(o => o.raycastType === mapping.raycastType);
    return override ? { ...mapping, ...override } : mapping;
  });
}