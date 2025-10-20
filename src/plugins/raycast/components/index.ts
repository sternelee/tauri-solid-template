// ============================================================================
// Raycast UI Components - Main Entry Point
// ============================================================================

// List Components
export {
  List,
  ListItem,
  ListSection,
  ListEmptyView,
  ListDropdown,
  ListDropdownItem,
  ListDropdownSection,
  ListItemDetail,
  ListItemDetailMetadata,
  ListItemDetailMetadataLabel,
  ListItemDetailMetadataLink,
  ListItemDetailMetadataTagList,
  ListItemDetailMetadataTagListItem,
  ListItemDetailMetadataSeparator
} from './List';

// Detail Components
export {
  Detail,
  DetailMetadata,
  DetailMetadataLabel,
  DetailMetadataLink,
  DetailMetadataTagList,
  DetailMetadataTagListItem,
  DetailMetadataSeparator,
  DetailWithSidebar,
  DetailFullWidth
} from './Detail';

// Form Components
export {
  Form,
  FormTextField,
  FormTextArea,
  FormDropdown,
  FormDropdownItem,
  FormDropdownSection,
  FormDescription,
  FormLinkAccessory,
  FormValidator
} from './Form';

// Grid Components
export {
  Grid,
  GridItem,
  GridSection,
  GridEmptyView,
  GridWithSidebar,
  ResponsiveGrid
} from './Grid';

// Action Components
export {
  Action,
  ActionPanel,
  ActionPanelSection,
  ActionPanelSubmenu,
  ActionPush,
  ActionCopyToClipboard,
  ActionPaste,
  ActionOpenInBrowser,
  ActionSubmitForm,
  ActionUtils,
  ActionStyle,
  CommonShortcuts
} from './Action';

// ============================================================================
// Component Factory for Raycast Components
// ============================================================================

import { JSX } from 'solid-js';
import { 
  ListProps, ListItemProps, ListSectionProps, ListEmptyViewProps,
  DetailProps, DetailMetadataProps, DetailMetadataLabelProps,
  FormProps, FormTextFieldProps, FormTextAreaProps, FormDropdownProps,
  GridProps, GridItemProps, GridSectionProps, GridEmptyViewProps,
  ActionProps, ActionPanelProps, ActionPanelSectionProps,
  ActionPushProps, ActionCopyToClipboardProps, ActionOpenInBrowserProps
} from '../types';
import { ActionSubmitForm } from './Action';
import { ActionOpenInBrowser } from './Action';
import { ActionPaste } from './Action';
import { ActionCopyToClipboard } from './Action';
import { ActionPush } from './Action';
import { ActionPanelSubmenu } from './Action';
import { ActionPanelSection } from './Action';
import { ActionPanel } from './Action';
import { Action } from './Action';
import { GridEmptyView } from './Grid';
import { GridSection } from './Grid';
import { GridItem } from './Grid';
import { Grid } from './Grid';
import { FormLinkAccessory } from './Form';
import { FormDescription } from './Form';
import { FormDropdownSection } from './Form';
import { FormDropdownItem } from './Form';
import { FormDropdown } from './Form';
import { FormTextArea } from './Form';
import { FormTextField } from './Form';
import { Form } from './Form';
import { DetailMetadataSeparator } from './Detail';
import { DetailMetadataTagListItem } from './Detail';
import { DetailMetadataTagList } from './Detail';
import { DetailMetadataLink } from './Detail';
import { DetailMetadataLabel } from './Detail';
import { DetailMetadata } from './Detail';
import { Detail } from './Detail';
import { ListDropdownSection } from './List';
import { ListDropdownItem } from './List';
import { ListDropdown } from './List';
import { ListEmptyView } from './List';
import { ListSection } from './List';
import { ListItem } from './List';
import { List } from './List';
import { ActionOpenInBrowser } from './Action';
import { ActionCopyToClipboard } from './Action';
import { ActionPush } from './Action';
import { ActionPanelSection } from './Action';
import { ActionPanel } from './Action';
import { Action } from './Action';
import { GridEmptyView } from './Grid';
import { GridSection } from './Grid';
import { GridItem } from './Grid';
import { Grid } from './Grid';
import { FormDropdown } from './Form';
import { FormTextArea } from './Form';
import { FormTextField } from './Form';
import { Form } from './Form';
import { DetailMetadataLabel } from './Detail';
import { DetailMetadata } from './Detail';
import { Detail } from './Detail';
import { ListEmptyView } from './List';
import { ListSection } from './List';
import { ListItem } from './List';
import { List } from './List';

export interface RaycastComponentFactory {
  // List components
  createList(props: ListProps): JSX.Element;
  createListItem(props: ListItemProps): JSX.Element;
  createListSection(props: ListSectionProps): JSX.Element;
  createListEmptyView(props: ListEmptyViewProps): JSX.Element;

  // Detail components
  createDetail(props: DetailProps): JSX.Element;
  createDetailMetadata(props: DetailMetadataProps): JSX.Element;
  createDetailMetadataLabel(props: DetailMetadataLabelProps): JSX.Element;

  // Form components
  createForm(props: FormProps): JSX.Element;
  createFormTextField(props: FormTextFieldProps): JSX.Element;
  createFormTextArea(props: FormTextAreaProps): JSX.Element;
  createFormDropdown(props: FormDropdownProps): JSX.Element;

  // Grid components
  createGrid(props: GridProps): JSX.Element;
  createGridItem(props: GridItemProps): JSX.Element;
  createGridSection(props: GridSectionProps): JSX.Element;
  createGridEmptyView(props: GridEmptyViewProps): JSX.Element;

  // Action components
  createAction(props: ActionProps): JSX.Element;
  createActionPanel(props: ActionPanelProps): JSX.Element;
  createActionPanelSection(props: ActionPanelSectionProps): JSX.Element;
  createActionPush(props: ActionPushProps): JSX.Element;
  createActionCopyToClipboard(props: ActionCopyToClipboardProps): JSX.Element;
  createActionOpenInBrowser(props: ActionOpenInBrowserProps): JSX.Element;
}

export class SolidRaycastComponentFactory implements RaycastComponentFactory {
  // List components
  createList(props: ListProps): JSX.Element {
    return List(props);
  }

  createListItem(props: ListItemProps): JSX.Element {
    return ListItem(props);
  }

  createListSection(props: ListSectionProps): JSX.Element {
    return ListSection(props);
  }

  createListEmptyView(props: ListEmptyViewProps): JSX.Element {
    return ListEmptyView(props);
  }

  // Detail components
  createDetail(props: DetailProps): JSX.Element {
    return Detail(props);
  }

  createDetailMetadata(props: DetailMetadataProps): JSX.Element {
    return DetailMetadata(props);
  }

  createDetailMetadataLabel(props: DetailMetadataLabelProps): JSX.Element {
    return DetailMetadataLabel(props);
  }

  // Form components
  createForm(props: FormProps): JSX.Element {
    return Form(props);
  }

  createFormTextField(props: FormTextFieldProps): JSX.Element {
    return FormTextField(props);
  }

  createFormTextArea(props: FormTextAreaProps): JSX.Element {
    return FormTextArea(props);
  }

  createFormDropdown(props: FormDropdownProps): JSX.Element {
    return FormDropdown(props);
  }

  // Grid components
  createGrid(props: GridProps): JSX.Element {
    return Grid(props);
  }

  createGridItem(props: GridItemProps): JSX.Element {
    return GridItem(props);
  }

  createGridSection(props: GridSectionProps): JSX.Element {
    return GridSection(props);
  }

  createGridEmptyView(props: GridEmptyViewProps): JSX.Element {
    return GridEmptyView(props);
  }

  // Action components
  createAction(props: ActionProps): JSX.Element {
    return Action(props);
  }

  createActionPanel(props: ActionPanelProps): JSX.Element {
    return ActionPanel(props);
  }

  createActionPanelSection(props: ActionPanelSectionProps): JSX.Element {
    return ActionPanelSection(props);
  }

  createActionPush(props: ActionPushProps): JSX.Element {
    return ActionPush(props);
  }

  createActionCopyToClipboard(props: ActionCopyToClipboardProps): JSX.Element {
    return ActionCopyToClipboard(props);
  }

  createActionOpenInBrowser(props: ActionOpenInBrowserProps): JSX.Element {
    return ActionOpenInBrowser(props);
  }
}

// ============================================================================
// Component Registry
// ============================================================================

export class RaycastComponentRegistry {
  private static instance: RaycastComponentRegistry;
  private components: Map<string, any> = new Map();

  private constructor() {
    this.registerDefaultComponents();
  }

  static getInstance(): RaycastComponentRegistry {
    if (!RaycastComponentRegistry.instance) {
      RaycastComponentRegistry.instance = new RaycastComponentRegistry();
    }
    return RaycastComponentRegistry.instance;
  }

  private registerDefaultComponents(): void {
    // List components
    this.components.set('List', List);
    this.components.set('List.Item', ListItem);
    this.components.set('List.Section', ListSection);
    this.components.set('List.EmptyView', ListEmptyView);
    this.components.set('List.Dropdown', ListDropdown);
    this.components.set('List.Dropdown.Item', ListDropdownItem);
    this.components.set('List.Dropdown.Section', ListDropdownSection);

    // Detail components
    this.components.set('Detail', Detail);
    this.components.set('Detail.Metadata', DetailMetadata);
    this.components.set('Detail.Metadata.Label', DetailMetadataLabel);
    this.components.set('Detail.Metadata.Link', DetailMetadataLink);
    this.components.set('Detail.Metadata.TagList', DetailMetadataTagList);
    this.components.set('Detail.Metadata.TagList.Item', DetailMetadataTagListItem);
    this.components.set('Detail.Metadata.Separator', DetailMetadataSeparator);

    // Form components
    this.components.set('Form', Form);
    this.components.set('Form.TextField', FormTextField);
    this.components.set('Form.TextArea', FormTextArea);
    this.components.set('Form.Dropdown', FormDropdown);
    this.components.set('Form.Dropdown.Item', FormDropdownItem);
    this.components.set('Form.Dropdown.Section', FormDropdownSection);
    this.components.set('Form.Description', FormDescription);
    this.components.set('Form.LinkAccessory', FormLinkAccessory);

    // Grid components
    this.components.set('Grid', Grid);
    this.components.set('Grid.Item', GridItem);
    this.components.set('Grid.Section', GridSection);
    this.components.set('Grid.EmptyView', GridEmptyView);

    // Action components
    this.components.set('Action', Action);
    this.components.set('ActionPanel', ActionPanel);
    this.components.set('ActionPanel.Section', ActionPanelSection);
    this.components.set('ActionPanel.Submenu', ActionPanelSubmenu);
    this.components.set('Action.Push', ActionPush);
    this.components.set('Action.CopyToClipboard', ActionCopyToClipboard);
    this.components.set('Action.Paste', ActionPaste);
    this.components.set('Action.OpenInBrowser', ActionOpenInBrowser);
    this.components.set('Action.SubmitForm', ActionSubmitForm);
  }

  getComponent(name: string): any {
    return this.components.get(name);
  }

  registerComponent(name: string, component: any): void {
    this.components.set(name, component);
  }

  getAllComponents(): Record<string, any> {
    const result: Record<string, any> = {};
    this.components.forEach((component, name) => {
      result[name] = component;
    });
    return result;
  }

  hasComponent(name: string): boolean {
    return this.components.has(name);
  }
}

// ============================================================================
// Component Utilities
// ============================================================================

export class ComponentUtils {
  static createComponentTree(type: string, props: any, children?: any[]): JSX.Element {
    const registry = RaycastComponentRegistry.getInstance();
    const Component = registry.getComponent(type);
    
    if (!Component) {
      throw new Error(`Component "${type}" not found in registry`);
    }
    
    return Component({ ...props, children });
  }

  static validateComponentProps(type: string, props: any): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    // Basic validation based on component type
    switch (type) {
      case 'List.Item':
        if (!props.title) {
          errors.push('List.Item requires a title prop');
        }
        break;
      
      case 'Form.TextField':
      case 'Form.TextArea':
      case 'Form.Dropdown':
        if (!props.id) {
          errors.push(`${type} requires an id prop`);
        }
        break;
      
      case 'Detail.Metadata.Label':
        if (!props.title) {
          errors.push('Detail.Metadata.Label requires a title prop');
        }
        break;
      
      case 'Grid.Item':
        if (!props.content && !props.title) {
          errors.push('Grid.Item requires either content or title prop');
        }
        break;
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  static getComponentHierarchy(): Record<string, string[]> {
    return {
      'List': ['List.Item', 'List.Section', 'List.EmptyView', 'List.Dropdown'],
      'List.Dropdown': ['List.Dropdown.Item', 'List.Dropdown.Section'],
      'Detail': ['Detail.Metadata'],
      'Detail.Metadata': [
        'Detail.Metadata.Label',
        'Detail.Metadata.Link',
        'Detail.Metadata.TagList',
        'Detail.Metadata.Separator'
      ],
      'Detail.Metadata.TagList': ['Detail.Metadata.TagList.Item'],
      'Form': [
        'Form.TextField',
        'Form.TextArea',
        'Form.Dropdown',
        'Form.Description',
        'Form.LinkAccessory'
      ],
      'Form.Dropdown': ['Form.Dropdown.Item', 'Form.Dropdown.Section'],
      'Grid': ['Grid.Item', 'Grid.Section', 'Grid.EmptyView'],
      'ActionPanel': ['ActionPanel.Section', 'ActionPanel.Submenu'],
      'Action': [
        'Action.Push',
        'Action.CopyToClipboard', 
        'Action.Paste',
        'Action.OpenInBrowser',
        'Action.SubmitForm'
      ]
    };
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createRaycastComponentFactory(): RaycastComponentFactory {
  return new SolidRaycastComponentFactory();
}

// ============================================================================
// Version Information
// ============================================================================

export const RAYCAST_COMPONENTS_VERSION = '1.0.0';
export const SUPPORTED_COMPONENTS = [
  'List', 'List.Item', 'List.Section', 'List.EmptyView',
  'Detail', 'Detail.Metadata', 'Detail.Metadata.Label',
  'Form', 'Form.TextField', 'Form.TextArea', 'Form.Dropdown',
  'Grid', 'Grid.Item', 'Grid.Section', 'Grid.EmptyView',
  'Action', 'ActionPanel', 'Action.Push', 'Action.CopyToClipboard'
];

console.log(`Raycast Components v${RAYCAST_COMPONENTS_VERSION} loaded`);
console.log(`Available components: ${SUPPORTED_COMPONENTS.length}`);