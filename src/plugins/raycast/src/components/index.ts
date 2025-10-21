// ============================================================================
// Raycast Components Export
// ============================================================================
// Shadow DOM compatible Raycast UI components

// Re-export all components from the main components directory
export * from '../../components';

// Component utilities for Shadow DOM rendering
export {
  RaycastComponentRegistry,
  ComponentUtils,
  SolidRaycastComponentFactory,
  createRaycastComponentFactory,
  RAYCAST_COMPONENTS_VERSION,
  SUPPORTED_COMPONENTS
} from '../../components';

// Shadow DOM adapter
export {
  ShadowDOMRenderer,
  ShadowDOMRendererImpl,
  createShadowDOMFactory,
  createShadowDOMConfig,
  validateShadowDOMConfig,
  defaultShadowDOMConfig,
} from '../shadow-dom-adapter';

// Create a combined export for easier usage
export {
  createComponentRenderer,
  renderComponentInShadowDOM,
  createPluginComponentContext,
} from './utils';

// Re-export types for convenience
export type {
  ComponentType,
  ComponentMetadata,
  ComponentEvent,
  ComponentEventHandler,
  PluginComponentContext,
  ComponentRenderingOptions,
  ShadowDOMConfig,
  ShadowDOMRenderer as Renderer,
} from '../types';

export type {
  BaseComponentProps,
  ListProps,
  ListItemProps,
  ListSectionProps,
  ListEmptyViewProps,
  DetailProps,
  DetailMetadataProps,
  DetailMetadataLabelProps,
  DetailMetadataLinkProps,
  DetailMetadataTagListProps,
  DetailMetadataTagListItemProps,
  DetailMetadataSeparatorProps,
  FormProps,
  FormTextFieldProps,
  FormTextAreaProps,
  FormDropdownProps,
  FormDropdownItemProps,
  FormDropdownSectionProps,
  GridProps,
  GridItemProps,
  GridSectionProps,
  GridEmptyViewProps,
  ActionProps,
  ActionPanelProps,
  ActionPanelSectionProps,
  ActionPanelSubmenuProps,
  ActionPushProps,
  ActionCopyToClipboardProps,
  ActionPasteProps,
  ActionOpenInBrowserProps,
  ActionSubmitFormProps,
} from '../types';