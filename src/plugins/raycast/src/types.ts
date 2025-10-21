// ============================================================================
// Raycast Components Type Definitions
// ============================================================================
// Type definitions for Raycast UI components with Shadow DOM support

import type { Component, JSX } from 'solid-js';

// ============================================================================
// Component Props Types
// ============================================================================

// Base component props
export interface BaseComponentProps {
  className?: string;
  style?: JSX.CSSProperties;
  id?: string;
  'data-testid'?: string;
}

// List component types
export interface ListProps extends BaseComponentProps {
  children?: JSX.Element;
  searchBarAccessory?: JSX.Element;
  onSearchTextChange?: (text: string) => void;
  searchBarPlaceholder?: string;
  filtering?: boolean;
  navigationTitle?: string;
  throttle?: boolean;
}

export interface ListItemProps extends BaseComponentProps {
  title: string;
  subtitle?: string;
  icon?: string | JSX.Element;
  accessories?: Array<{
    text?: string;
    icon?: string | JSX.Element;
    tooltip?: string;
    tag?: {
      value: string;
      color?: string;
    };
  }>;
  actions?: JSX.Element;
  detail?: JSX.Element;
  keywords?: string[];
  onSelect?: () => void;
}

export interface ListSectionProps extends BaseComponentProps {
  title?: string;
  subtitle?: string;
  children?: JSX.Element;
}

export interface ListEmptyViewProps extends BaseComponentProps {
  title?: string;
  description?: string;
  icon?: string | JSX.Element;
  actions?: JSX.Element;
}

// Detail component types
export interface DetailProps extends BaseComponentProps {
  children?: JSX.Element;
  markdown?: string;
  metadata?: JSX.Element;
  actions?: JSX.Element;
  navigationTitle?: string;
  isLoading?: boolean;
}

export interface DetailMetadataProps extends BaseComponentProps {
  children?: JSX.Element;
}

export interface DetailMetadataLabelProps extends BaseComponentProps {
  title: string;
  text?: string;
  icon?: string | JSX.Element;
}

export interface DetailMetadataLinkProps extends BaseComponentProps {
  title: string;
  target: string;
  text?: string;
}

export interface DetailMetadataTagListProps extends BaseComponentProps {
  title: string;
  children?: JSX.Element;
}

export interface DetailMetadataTagListItemProps extends BaseComponentProps {
  text: string;
  color?: string;
}

export interface DetailMetadataSeparatorProps extends BaseComponentProps {}

// Form component types
export interface FormProps extends BaseComponentProps {
  children?: JSX.Element;
  actions?: JSX.Element;
  onSubmit?: (values: Record<string, any>) => void;
  navigationTitle?: string;
}

export interface FormTextFieldProps extends BaseComponentProps {
  id: string;
  title?: string;
  placeholder?: string;
  defaultValue?: string;
  value?: string;
  error?: string;
  info?: string;
  storeValue?: boolean;
  onChange?: (newValue: string) => void;
  onBlur?: (event: FocusEvent<HTMLInputElement>) => void;
  onFocus?: (event: FocusEvent<HTMLInputElement>) => void;
  required?: boolean;
  disabled?: boolean;
}

export interface FormTextAreaProps extends BaseComponentProps {
  id: string;
  title?: string;
  placeholder?: string;
  defaultValue?: string;
  value?: string;
  error?: string;
  info?: string;
  enableMarkdown?: boolean;
  rows?: number;
  onChange?: (newValue: string) => void;
  onBlur?: (event: FocusEvent<HTMLTextAreaElement>) => void;
  onFocus?: (event: FocusEvent<HTMLTextAreaElement>) => void;
  required?: boolean;
  disabled?: boolean;
}

export interface FormDropdownProps extends BaseComponentProps {
  id: string;
  title?: string;
  placeholder?: string;
  defaultValue?: string;
  value?: string;
  error?: string;
  info?: string;
  storeValue?: boolean;
  onChange?: (newValue: string) => void;
  children?: JSX.Element;
  required?: boolean;
  disabled?: boolean;
}

export interface FormDropdownItemProps extends BaseComponentProps {
  title: string;
  value: string;
  icon?: string | JSX.Element;
}

export interface FormDropdownSectionProps extends BaseComponentProps {
  title?: string;
  children?: JSX.Element;
}

// Grid component types
export interface GridProps extends BaseComponentProps {
  children?: JSX.Element;
  columns?: number;
  inset?: 'small' | 'medium' | 'large';
  fit?: 'contain' | 'fill';
  aspectRatio?: string;
  searchBarAccessory?: JSX.Element;
  onSearchTextChange?: (text: string) => void;
  searchBarPlaceholder?: string;
  filtering?: boolean;
  navigationTitle?: string;
  throttle?: boolean;
}

export interface GridItemProps extends BaseComponentProps {
  id?: string;
  title?: string;
  subtitle?: string;
  content?: JSX.Element | string;
  accessory?: {
    text?: string;
    icon?: string | JSX.Element;
    tooltip?: string;
    tag?: {
      value: string;
      color?: string;
    };
  };
  actions?: JSX.Element;
  keywords?: string[];
  onSelect?: () => void;
}

export interface GridSectionProps extends BaseComponentProps {
  title?: string;
  subtitle?: string;
  children?: JSX.Element;
}

export interface GridEmptyViewProps extends BaseComponentProps {
  title?: string;
  description?: string;
  icon?: string | JSX.Element;
  actions?: JSX.Element;
}

// Action component types
export interface ActionProps extends BaseComponentProps {
  title: string;
  icon?: string | JSX.Element;
  shortcut?: {
    modifiers: Array<'cmd' | 'ctrl' | 'opt' | 'shift'>;
    key: string;
  };
  onAction?: () => void | Promise<void>;
  style?: 'regular' | 'destructive';
}

export interface ActionPanelProps extends BaseComponentProps {
  title?: string;
  children?: JSX.Element;
}

export interface ActionPanelSectionProps extends BaseComponentProps {
  title?: string;
  children?: JSX.Element;
}

export interface ActionPanelSubmenuProps extends BaseComponentProps {
  title: string;
  icon?: string | JSX.Element;
  shortcut?: {
    modifiers: Array<'cmd' | 'ctrl' | 'opt' | 'shift'>;
    key: string;
  };
  children?: JSX.Element;
}

// Action convenience types
export interface ActionPushProps extends Omit<ActionProps, 'onAction'> {
  target: JSX.Element;
  onPush?: () => void;
}

export interface ActionCopyToClipboardProps extends Omit<ActionProps, 'onAction'> {
  content: string | number;
  concealed?: boolean;
}

export interface ActionPasteProps extends Omit<ActionProps, 'onAction'> {
  content: string | number;
}

export interface ActionOpenInBrowserProps extends Omit<ActionProps, 'onAction'> {
  url: string;
}

export interface ActionSubmitFormProps extends Omit<ActionProps, 'onAction'> {
  onSubmit?: (values: Record<string, any>) => void | Promise<void>;
}

// ============================================================================
// Shadow DOM Types
// ============================================================================

export interface ShadowDOMConfig {
  cssIsolation?: 'strict' | 'shared' | 'none';
  jsIsolation?: 'sandbox' | 'proxy' | 'none';
  eventMode?: 'bubble' | 'capture' | 'isolated';
  resourceMode?: 'blocked' | 'allowed' | 'sandbox';
  customStyles?: string[];
  cssVariables?: Record<string, string>;
  pluginId: string;
}

export interface ShadowDOMRenderer {
  container: HTMLElement;
  shadowRoot: ShadowRoot;
  render: (component: Component<any>) => void;
  destroy: () => void;
  updateStyles: (styles: string[]) => void;
  getRenderedElement: () => HTMLElement | null;
}

// ============================================================================
// Component Registry Types
// ============================================================================

export interface ComponentRegistry {
  getComponent(name: string): Component<any> | undefined;
  registerComponent(name: string, component: Component<any>): void;
  hasComponent(name: string): boolean;
  getAllComponents(): Record<string, Component<any>>;
}

export interface ComponentFactory {
  createList(props: ListProps): JSX.Element;
  createListItem(props: ListItemProps): JSX.Element;
  createListSection(props: ListSectionProps): JSX.Element;
  createListEmptyView(props: ListEmptyViewProps): JSX.Element;
  createDetail(props: DetailProps): JSX.Element;
  createDetailMetadata(props: DetailMetadataProps): JSX.Element;
  createDetailMetadataLabel(props: DetailMetadataLabelProps): JSX.Element;
  createForm(props: FormProps): JSX.Element;
  createFormTextField(props: FormTextFieldProps): JSX.Element;
  createFormTextArea(props: FormTextAreaProps): JSX.Element;
  createFormDropdown(props: FormDropdownProps): JSX.Element;
  createGrid(props: GridProps): JSX.Element;
  createGridItem(props: GridItemProps): JSX.Element;
  createGridSection(props: GridSectionProps): JSX.Element;
  createGridEmptyView(props: GridEmptyViewProps): JSX.Element;
  createAction(props: ActionProps): JSX.Element;
  createActionPanel(props: ActionPanelProps): JSX.Element;
  createActionPanelSection(props: ActionPanelSectionProps): JSX.Element;
  createActionPush(props: ActionPushProps): JSX.Element;
  createActionCopyToClipboard(props: ActionCopyToClipboardProps): JSX.Element;
  createActionOpenInBrowser(props: ActionOpenInBrowserProps): JSX.Element;
}

// ============================================================================
// Plugin Integration Types
// ============================================================================

export interface PluginComponentContext {
  pluginId: string;
  api: any; // RaycastAPI
  shadowRoot: ShadowRoot;
  renderComponent: (component: Component<any>, config?: Partial<ShadowDOMConfig>) => void;
  destroyComponent: () => void;
}

export interface ComponentRenderingOptions {
  container?: HTMLElement;
  shadowDOMConfig?: Partial<ShadowDOMConfig>;
  autoMount?: boolean;
  onRender?: (element: HTMLElement) => void;
  onDestroy?: () => void;
}

// ============================================================================
// Utility Types
// ============================================================================

export type ComponentType =
  | 'List'
  | 'List.Item'
  | 'List.Section'
  | 'List.EmptyView'
  | 'Detail'
  | 'Detail.Metadata'
  | 'Detail.Metadata.Label'
  | 'Form'
  | 'Form.TextField'
  | 'Form.TextArea'
  | 'Form.Dropdown'
  | 'Grid'
  | 'Grid.Item'
  | 'Grid.Section'
  | 'Grid.EmptyView'
  | 'Action'
  | 'ActionPanel'
  | 'ActionPanel.Section'
  | 'ActionPanel.Submenu'
  | 'Action.Push'
  | 'Action.CopyToClipboard'
  | 'Action.Paste'
  | 'Action.OpenInBrowser'
  | 'Action.SubmitForm';

export interface ComponentMetadata {
  type: ComponentType;
  name: string;
  description: string;
  props: string[];
  category: 'layout' | 'input' | 'action' | 'display';
  deprecated?: boolean;
  deprecationMessage?: string;
}

// ============================================================================
// Event Types
// ============================================================================

export interface ComponentEvent<T = any> {
  type: string;
  component: ComponentType;
  data?: T;
  timestamp: number;
  pluginId: string;
}

export interface ComponentEventHandler<T = any> {
  (event: ComponentEvent<T>): void;
}

// ============================================================================
// Error Types
// ============================================================================

export class ComponentError extends Error {
  constructor(
    message: string,
    public code: string,
    public componentType?: ComponentType,
    public pluginId?: string,
    public cause?: Error
  ) {
    super(message);
    this.name = 'ComponentError';
  }
}

export class RenderError extends ComponentError {
  constructor(
    message: string,
    componentType: ComponentType,
    pluginId: string,
    cause?: Error
  ) {
    super(message, 'RENDER_ERROR', componentType, pluginId, cause);
    this.name = 'RenderError';
  }
}

export class ValidationError extends ComponentError {
  constructor(
    message: string,
    componentType: ComponentType,
    pluginId: string,
    public validationErrors: string[]
  ) {
    super(message, 'VALIDATION_ERROR', componentType, pluginId);
    this.name = 'ValidationError';
  }
}