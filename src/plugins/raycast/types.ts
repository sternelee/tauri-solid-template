import { ReactElement, ReactNode, Dispatch, SetStateAction } from 'react';

// ============================================================================
// Core Raycast API Types
// ============================================================================

export type ImageLike = string | Image | FileIcon;

export interface Image {
  source: ImageSource;
  mask?: ImageMask;
  tintColor?: ColorLike;
  fallback?: ImageFallback;
}

export interface FileIcon {
  fileIcon: string;
}

export type ImageSource = string | Themeable;
export type ImageFallback = ImageSource;
export type ImageMask = 'circle' | 'roundedRectangle';

export interface Themeable {
  light: string;
  dark: string;
}

export type ColorLike = string | Themeable;

// ============================================================================
// Common Types
// ============================================================================

export interface KeyboardShortcut {
  modifiers: Array<'cmd' | 'ctrl' | 'opt' | 'shift'>;
  key: string;
}

export interface Accessory {
  text?: string;
  icon?: ImageLike;
  tooltip?: string;
  tag?: {
    value: string;
    color?: ColorLike;
  };
}

// ============================================================================
// List Component Types
// ============================================================================

export interface ListProps {
  children?: ReactNode;
  searchBarAccessory?: ReactElement;
  onSearchTextChange?: (text: string) => void;
  throttle?: boolean;
  searchBarPlaceholder?: string;
  filtering?: boolean;
  navigationTitle?: string;
}

export interface ListItemProps {
  id?: string;
  title: string;
  subtitle?: string;
  icon?: ImageLike;
  accessories?: Accessory[];
  actions?: ReactElement;
  detail?: ReactElement;
  keywords?: string[];
}

export interface ListSectionProps {
  title?: string;
  subtitle?: string;
  children?: ReactNode;
}

export interface ListEmptyViewProps {
  title?: string;
  description?: string;
  icon?: ImageLike;
  actions?: ReactElement;
}

export interface ListDropdownProps {
  tooltip?: string;
  placeholder?: string;
  storeValue?: boolean;
  onChange?: (newValue: string) => void;
  children?: ReactNode;
}

export interface ListDropdownItemProps {
  title: string;
  value: string;
  icon?: ImageLike;
}

export interface ListDropdownSectionProps {
  title?: string;
  children?: ReactNode;
}

export interface ListItemDetailProps {
  isLoading?: boolean;
  markdown?: string;
  metadata?: ReactElement;
}

export interface ListItemDetailMetadataProps {
  children?: ReactNode;
}

export interface ListItemDetailMetadataLabelProps {
  title: string;
  text?: string;
  icon?: ImageLike;
}

export interface ListItemDetailMetadataLinkProps {
  title: string;
  target: string;
  text?: string;
}

export interface ListItemDetailMetadataTagListProps {
  title: string;
  children?: ReactNode;
}

export interface ListItemDetailMetadataTagListItemProps {
  text: string;
  color?: ColorLike;
}

export interface ListItemDetailMetadataSeparatorProps {}

// ============================================================================
// Detail Component Types
// ============================================================================

export interface DetailProps {
  children?: ReactNode;
  markdown?: string;
  metadata?: ReactElement;
  actions?: ReactElement;
  navigationTitle?: string;
  isLoading?: boolean;
}

export interface DetailMetadataProps {
  children?: ReactNode;
}

export interface DetailMetadataLabelProps {
  title: string;
  text?: string;
  icon?: ImageLike;
}

export interface DetailMetadataLinkProps {
  title: string;
  target: string;
  text?: string;
}

export interface DetailMetadataTagListProps {
  title: string;
  children?: ReactNode;
}

export interface DetailMetadataTagListItemProps {
  text: string;
  color?: ColorLike;
}

export interface DetailMetadataSeparatorProps {}

// ============================================================================
// Form Component Types
// ============================================================================

export interface FormProps {
  children?: ReactNode;
  actions?: ReactElement;
  onSubmit?: (values: FormValues) => void;
  navigationTitle?: string;
}

export interface FormValues {
  [key: string]: any;
}

export interface FormTextFieldProps {
  id: string;
  title?: string;
  placeholder?: string;
  defaultValue?: string;
  value?: string;
  error?: string;
  info?: string;
  storeValue?: boolean;
  onChange?: (newValue: string) => void;
  onBlur?: (event: React.FocusEvent<HTMLInputElement>) => void;
  onFocus?: (event: React.FocusEvent<HTMLInputElement>) => void;
}

export interface FormTextAreaProps {
  id: string;
  title?: string;
  placeholder?: string;
  defaultValue?: string;
  value?: string;
  error?: string;
  info?: string;
  enableMarkdown?: boolean;
  onChange?: (newValue: string) => void;
  onBlur?: (event: React.FocusEvent<HTMLTextAreaElement>) => void;
  onFocus?: (event: React.FocusEvent<HTMLTextAreaElement>) => void;
}

export interface FormDropdownProps {
  id: string;
  title?: string;
  placeholder?: string;
  defaultValue?: string;
  value?: string;
  error?: string;
  info?: string;
  storeValue?: boolean;
  onChange?: (newValue: string) => void;
  children?: ReactNode;
}

export interface FormDropdownItemProps {
  title: string;
  value: string;
  icon?: ImageLike;
}

export interface FormDropdownSectionProps {
  title?: string;
  children?: ReactNode;
}

export interface FormDescriptionProps {
  title?: string;
  text: string;
}

export interface FormLinkAccessoryProps {
  target: string;
  text: string;
}

// ============================================================================
// Grid Component Types
// ============================================================================

export interface GridProps {
  children?: ReactNode;
  columns?: number;
  inset?: Grid.Inset;
  fit?: Grid.Fit;
  aspectRatio?: string;
  searchBarAccessory?: ReactElement;
  onSearchTextChange?: (text: string) => void;
  throttle?: boolean;
  searchBarPlaceholder?: string;
  filtering?: boolean;
  navigationTitle?: string;
}

export namespace Grid {
  export enum Inset {
    Small = 'small',
    Medium = 'medium',
    Large = 'large'
  }

  export enum Fit {
    Contain = 'contain',
    Fill = 'fill'
  }
}

export interface GridItemProps {
  id?: string;
  title?: string;
  subtitle?: string;
  content?: ReactElement | ImageLike;
  accessory?: Accessory;
  actions?: ReactElement;
  keywords?: string[];
}

export interface GridSectionProps {
  title?: string;
  subtitle?: string;
  children?: ReactNode;
}

export interface GridEmptyViewProps {
  title?: string;
  description?: string;
  icon?: ImageLike;
  actions?: ReactElement;
}

// ============================================================================
// Action Component Types
// ============================================================================

export interface ActionProps {
  title: string;
  icon?: ImageLike;
  shortcut?: KeyboardShortcut;
  onAction?: () => void | Promise<void>;
  style?: Action.Style;
}

export namespace Action {
  export enum Style {
    Regular = 'regular',
    Destructive = 'destructive'
  }
}

export interface ActionPanelProps {
  title?: string;
  children?: ReactNode;
}

export interface ActionPanelSectionProps {
  title?: string;
  children?: ReactNode;
}

export interface ActionPanelSubmenuProps {
  title: string;
  icon?: ImageLike;
  shortcut?: KeyboardShortcut;
  children?: ReactNode;
}

export interface ActionPushProps extends Omit<ActionProps, 'onAction'> {
  target: ReactElement;
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
  onSubmit?: (values: FormValues) => void | Promise<void>;
}

// ============================================================================
// Toast Types
// ============================================================================

export interface ToastOptions {
  style?: Toast.Style;
  title: string;
  message?: string;
  primaryAction?: ToastActionOptions;
  secondaryAction?: ToastActionOptions;
}

export interface ToastActionOptions {
  title: string;
  onAction: (toast: Toast) => void;
  shortcut?: KeyboardShortcut;
}

export namespace Toast {
  export enum Style {
    Success = 'SUCCESS',
    Failure = 'FAILURE',
    Animated = 'ANIMATED'
  }
}

export interface Toast {
  style: Toast.Style;
  title: string;
  message?: string;
  primaryAction?: ToastActionOptions;
  secondaryAction?: ToastActionOptions;
  show(): Promise<void>;
  hide(): Promise<void>;
}

// ============================================================================
// Navigation Types
// ============================================================================

export interface NavigationHook {
  push: (component: ReactElement, title?: string) => void;
  pop: () => void;
  popToRoot: () => void;
}

// ============================================================================
// Persistent State Types
// ============================================================================

export type PersistentStateHook<T> = (
  key: string,
  initialValue: T
) => [T, Dispatch<SetStateAction<T>>, boolean];

// ============================================================================
// AI Types
// ============================================================================

export type Creativity = 'none' | 'low' | 'medium' | 'high' | 'maximum' | number;

export enum Model {
  'OpenAI_GPT4.1' = 'OpenAI_GPT4.1',
  'OpenAI_GPT4.1-mini' = 'OpenAI_GPT4.1-mini',
  'OpenAI_GPT4.1-nano' = 'OpenAI_GPT4.1-nano',
  OpenAI_GPT4 = 'OpenAI_GPT4',
  'OpenAI_GPT4-turbo' = 'OpenAI_GPT4-turbo',
  OpenAI_GPT4o = 'OpenAI_GPT4o',
  'OpenAI_GPT4o-mini' = 'OpenAI_GPT4o-mini',
  OpenAI_o3 = 'OpenAI_o3',
  'OpenAI_o4-mini' = 'OpenAI_o4-mini',
  OpenAI_o1 = 'OpenAI_o1',
  'OpenAI_o3-mini' = 'OpenAI_o3-mini',
  Anthropic_Claude_Haiku = 'Anthropic_Claude_Haiku',
  Anthropic_Claude_Sonnet = 'Anthropic_Claude_Sonnet',
  'Anthropic_Claude_Sonnet_3.7' = 'Anthropic_Claude_Sonnet_3.7',
  Anthropic_Claude_Opus = 'Anthropic_Claude_Opus',
  Anthropic_Claude_4_Sonnet = 'Anthropic_Claude_4_Sonnet',
  Anthropic_Claude_4_Opus = 'Anthropic_Claude_4_Opus'
}

export interface AskOptions {
  creativity?: Creativity;
  model?: string;
  signal?: AbortSignal;
}

export interface AskResult extends Promise<string> {
  on(event: 'data', listener: (chunk: string) => void): this;
  on(event: 'end', listener: (fullText: string) => void): this;
  on(event: 'error', listener: (error: Error) => void): this;
  off(event: 'data', listener: (chunk: string) => void): this;
  off(event: 'end', listener: (fullText: string) => void): this;
  off(event: 'error', listener: (error: Error) => void): this;
}

export interface AIAPI {
  ask: (prompt: string, options?: AskOptions) => AskResult;
  Model: typeof Model;
  Creativity: {
    none: 'none';
    low: 'low';
    medium: 'medium';
    high: 'high';
    maximum: 'maximum';
  };
}

// ============================================================================
// Clipboard Types
// ============================================================================

export interface ClipboardAPI {
  readText(): Promise<string>;
  writeText(text: string): Promise<void>;
  clear(): Promise<void>;
}

// ============================================================================
// OAuth Types
// ============================================================================

export interface OAuthAPI {
  authorize(options: OAuthAuthorizeOptions): Promise<string>;
  getTokens(providerId: string): Promise<Record<string, unknown>>;
  setTokens(providerId: string, tokens: Record<string, unknown>): Promise<void>;
  removeTokens(providerId: string): Promise<void>;
}

export interface OAuthAuthorizeOptions {
  url: string;
  providerName: string;
  providerIcon?: ImageLike;
  description?: string;
}

// ============================================================================
// Browser Extension Types
// ============================================================================

export interface BrowserExtensionAPI {
  getTabs(): Promise<Tab[]>;
  getContent(options?: GetContentOptions): Promise<string>;
}

export interface Tab {
  active: boolean;
  id: number;
  url: string;
  favicon?: string;
  title?: string;
}

export interface GetContentOptions {
  cssSelector?: string;
  tabId?: number;
  format?: 'html' | 'text' | 'markdown';
}

// ============================================================================
// Keyboard Types
// ============================================================================

export interface KeyboardAPI {
  // Add keyboard-specific methods as needed
}

// ============================================================================
// Environment Types
// ============================================================================

export interface Environment {
  raycastVersion: string;
  extensionName: string;
  commandName: string;
  isDevelopment: boolean;
  supportPath: string;
  assetsPath: string;
}

// ============================================================================
// Preference Types
// ============================================================================

export interface PreferenceSchema {
  name: string;
  title?: string;
  description?: string;
  type: 'textfield' | 'password' | 'checkbox' | 'dropdown' | 'appPicker' | 'file' | 'directory';
  required?: boolean;
  default?: string | boolean;
  placeholder?: string;
  data?: Array<{
    title: string;
    value: string;
  }>;
}

// ============================================================================
// Plugin Execution Context Types
// ============================================================================

export interface PluginExecutionContext {
  pluginId: string;
  api: RaycastAPI;
  state: PluginStateContext;
  navigation: NavigationManager;
  shadowRoot: ShadowRoot;
  cleanup: () => void;
}

export interface PluginStateContext {
  reactState: Map<string, any>;
  persistentState: Map<string, any>;
  hooks: Map<string, any>;
}

export interface NavigationManager {
  push(component: ReactElement, title?: string): void;
  pop(): void;
  popToRoot(): void;
  getCurrentView(): ReactElement | null;
  getNavigationStack(): NavigationEntry[];
  createNavigationHook(pluginId: string): NavigationHook;
}

export interface NavigationEntry {
  component: ReactElement;
  title?: string;
  timestamp: number;
}

// ============================================================================
// Raycast Plugin Types
// ============================================================================

export interface RaycastManifest {
  name: string;
  title: string;
  description: string;
  icon: string;
  author: string | { name: string };
  owner?: string;
  commands: RaycastCommand[];
  preferences?: PreferenceSchema[];
  categories?: string[];
  keywords?: string[];
  license?: string;
  changelog?: string;
}

export interface RaycastCommand {
  name: string;
  title: string;
  description: string;
  mode: 'view' | 'no-view' | 'menu-bar';
  keywords?: string[];
  preferences?: PreferenceSchema[];
  icon?: string;
}

export interface RaycastPlugin {
  manifest: RaycastManifest;
  commands: Map<string, RaycastCommandHandler>;
  preferences?: PreferenceSchema[];
}

export interface RaycastCommandHandler {
  command: RaycastCommand;
  handler: () => ReactElement | Promise<ReactElement>;
}

// ============================================================================
// Complete Raycast API Interface
// ============================================================================

export interface RaycastAPI {
  // UI Components
  List: ListComponent;
  Detail: DetailComponent;
  Form: FormComponent;
  Grid: GridComponent;
  Action: ActionComponent;
  ActionPanel: ActionPanelComponent;
  
  // Utility Functions
  showToast: (options: ToastOptions) => Promise<Toast>;
  showHUD: (title: string) => Promise<void>;
  open: (target: string, application?: string) => Promise<void>;
  showInFinder: (path: string) => Promise<void>;
  trash: (paths: string | string[]) => Promise<void>;
  getPreferenceValues: () => Record<string, any>;
  getSelectedText: () => Promise<string>;
  getSelectedFinderItems: () => Promise<string[]>;
  getApplications: () => Promise<Application[]>;
  getDefaultApplication: (extension: string) => Promise<Application>;
  getFrontmostApplication: () => Promise<Application>;
  
  // Hooks
  useNavigation: () => NavigationHook;
  usePersistentState: <T>(key: string, initialValue: T) => [T, Dispatch<SetStateAction<T>>, boolean];
  
  // System APIs
  Clipboard: ClipboardAPI;
  AI: AIAPI;
  OAuth: OAuthAPI;
  BrowserExtension: BrowserExtensionAPI;
  Keyboard: KeyboardAPI;
  
  // Constants
  Color: typeof Color;
  Icon: typeof Icon;
  Image: typeof Image;
  Toast: typeof Toast;
  LaunchType: typeof LaunchType;
  
  // Environment
  environment: Environment;
  
  // Cache and Storage
  Cache: CacheAPI;
  LocalStorage: LocalStorageAPI;
}

// ============================================================================
// Component Interfaces
// ============================================================================

export interface ListComponent {
  (props: ListProps): ReactElement;
  Item: (props: ListItemProps) => ReactElement;
  Section: (props: ListSectionProps) => ReactElement;
  EmptyView: (props: ListEmptyViewProps) => ReactElement;
  Dropdown: ListDropdownComponent;
}

export interface ListDropdownComponent {
  (props: ListDropdownProps): ReactElement;
  Item: (props: ListDropdownItemProps) => ReactElement;
  Section: (props: ListDropdownSectionProps) => ReactElement;
}

export interface DetailComponent {
  (props: DetailProps): ReactElement;
  Metadata: DetailMetadataComponent;
}

export interface DetailMetadataComponent {
  (props: DetailMetadataProps): ReactElement;
  Label: (props: DetailMetadataLabelProps) => ReactElement;
  Link: (props: DetailMetadataLinkProps) => ReactElement;
  TagList: DetailMetadataTagListComponent;
  Separator: (props: DetailMetadataSeparatorProps) => ReactElement;
}

export interface DetailMetadataTagListComponent {
  (props: DetailMetadataTagListProps): ReactElement;
  Item: (props: DetailMetadataTagListItemProps) => ReactElement;
}

export interface FormComponent {
  (props: FormProps): ReactElement;
  TextField: (props: FormTextFieldProps) => ReactElement;
  TextArea: (props: FormTextAreaProps) => ReactElement;
  Dropdown: FormDropdownComponent;
  Description: (props: FormDescriptionProps) => ReactElement;
  LinkAccessory: (props: FormLinkAccessoryProps) => ReactElement;
}

export interface FormDropdownComponent {
  (props: FormDropdownProps): ReactElement;
  Item: (props: FormDropdownItemProps) => ReactElement;
  Section: (props: FormDropdownSectionProps) => ReactElement;
}

export interface GridComponent {
  (props: GridProps): ReactElement;
  Item: (props: GridItemProps) => ReactElement;
  Section: (props: GridSectionProps) => ReactElement;
  EmptyView: (props: GridEmptyViewProps) => ReactElement;
  Inset: typeof Grid.Inset;
  Fit: typeof Grid.Fit;
}

export interface ActionComponent {
  (props: ActionProps): ReactElement;
  Push: (props: ActionPushProps) => ReactElement;
  CopyToClipboard: (props: ActionCopyToClipboardProps) => ReactElement;
  Paste: (props: ActionPasteProps) => ReactElement;
  OpenInBrowser: (props: ActionOpenInBrowserProps) => ReactElement;
  SubmitForm: (props: ActionSubmitFormProps) => ReactElement;
  Style: typeof Action.Style;
}

export interface ActionPanelComponent {
  (props: ActionPanelProps): ReactElement;
  Section: (props: ActionPanelSectionProps) => ReactElement;
  Submenu: (props: ActionPanelSubmenuProps) => ReactElement;
}

// ============================================================================
// Additional Types
// ============================================================================

export interface Application {
  name: string;
  bundleId?: string;
  path: string;
}

export interface CacheAPI {
  // Add cache methods as needed
}

export interface LocalStorageAPI {
  // Add local storage methods as needed
}

// Constants that will be implemented
export const Color = {};
export const Icon = {};
export const LaunchType = {};

// API Factory and Manager interfaces (forward declarations)
export interface RaycastAPIFactory {
  createAPI(pluginId: string): RaycastAPI;
  destroyAPI(pluginId: string): void;
}

export interface APIContextManager {
  createContext(pluginId: string): RaycastAPI;
  getContext(pluginId: string): RaycastAPI | undefined;
  destroyContext(pluginId: string): void;
  hasContext(pluginId: string): boolean;
}