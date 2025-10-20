import { ReactElement, ReactNode } from 'react';

// Generic element type that can work with both React and SolidJS
export type GenericElement = ReactElement | any;
import {
  ListProps,
  ListItemProps,
  ListSectionProps,
  ListEmptyViewProps,
  ListDropdownProps,
  ListDropdownItemProps,
  ListDropdownSectionProps,
  ListItemDetailProps,
  ListItemDetailMetadataProps,
  ListItemDetailMetadataLabelProps,
  ListItemDetailMetadataLinkProps,
  ListItemDetailMetadataTagListProps,
  ListItemDetailMetadataTagListItemProps,
  ListItemDetailMetadataSeparatorProps,
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
  FormDescriptionProps,
  FormLinkAccessoryProps,
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
  ListComponent,
  ListDropdownComponent,
  DetailComponent,
  DetailMetadataComponent,
  DetailMetadataTagListComponent,
  FormComponent,
  FormDropdownComponent,
  GridComponent,
  ActionComponent,
  ActionPanelComponent
} from './types';

// ============================================================================
// Component Renderer Interface
// ============================================================================

export interface ComponentRenderer {
  // Core rendering methods
  renderComponent(type: string, props: any, children?: ReactNode[]): GenericElement;
  createShadowContainer(pluginId: string): ShadowRoot;
  
  // Shadcn-solid integration
  createBaseComponent(shadcnComponent: any, raycastProps: any): GenericElement;
  applyRaycastStyling(component: GenericElement, theme: RaycastTheme): GenericElement;
  
  // Component mapping
  mapRaycastToShadcn(raycastType: string): any;
  
  // Lifecycle methods
  mountComponent(component: GenericElement, container: Element): void;
  unmountComponent(container: Element): void;
}

export interface RaycastTheme {
  colors: {
    primary: string;
    secondary: string;
    background: string;
    surface: string;
    text: string;
    textSecondary: string;
    border: string;
    accent: string;
  };
  spacing: {
    xs: string;
    sm: string;
    md: string;
    lg: string;
    xl: string;
  };
  borderRadius: {
    sm: string;
    md: string;
    lg: string;
  };
  typography: {
    fontFamily: string;
    fontSize: {
      xs: string;
      sm: string;
      md: string;
      lg: string;
      xl: string;
    };
    fontWeight: {
      normal: string;
      medium: string;
      semibold: string;
      bold: string;
    };
  };
}

// ============================================================================
// Component Mapping Configuration
// ============================================================================

export interface ComponentMapping {
  raycastType: string;
  shadcnComponent: string;
  propsTransform?: (raycastProps: any) => any;
  styleOverrides?: any; // React.CSSProperties
  customRenderer?: (props: any, renderer: ComponentRenderer) => ReactElement;
  childrenMapping?: Record<string, string>;
}

export interface ComponentMappingRegistry {
  register(mapping: ComponentMapping): void;
  get(raycastType: string): ComponentMapping | undefined;
  getAll(): ComponentMapping[];
  clear(): void;
}

export class ComponentMappingRegistryImpl implements ComponentMappingRegistry {
  private mappings: Map<string, ComponentMapping> = new Map();

  register(mapping: ComponentMapping): void {
    this.mappings.set(mapping.raycastType, mapping);
  }

  get(raycastType: string): ComponentMapping | undefined {
    return this.mappings.get(raycastType);
  }

  getAll(): ComponentMapping[] {
    return Array.from(this.mappings.values());
  }

  clear(): void {
    this.mappings.clear();
  }
}

// ============================================================================
// Component Factory Interface
// ============================================================================

export interface ComponentFactory {
  // List components
  createList(props: ListProps): GenericElement;
  createListItem(props: ListItemProps): GenericElement;
  createListSection(props: ListSectionProps): GenericElement;
  createListEmptyView(props: ListEmptyViewProps): GenericElement;
  createListDropdown(props: ListDropdownProps): GenericElement;
  createListDropdownItem(props: ListDropdownItemProps): GenericElement;
  createListDropdownSection(props: ListDropdownSectionProps): GenericElement;
  createListItemDetail(props: ListItemDetailProps): GenericElement;
  createListItemDetailMetadata(props: ListItemDetailMetadataProps): GenericElement;
  createListItemDetailMetadataLabel(props: ListItemDetailMetadataLabelProps): GenericElement;
  createListItemDetailMetadataLink(props: ListItemDetailMetadataLinkProps): GenericElement;
  createListItemDetailMetadataTagList(props: ListItemDetailMetadataTagListProps): GenericElement;
  createListItemDetailMetadataTagListItem(props: ListItemDetailMetadataTagListItemProps): GenericElement;
  createListItemDetailMetadataSeparator(props: ListItemDetailMetadataSeparatorProps): GenericElement;

  // Detail components
  createDetail(props: DetailProps): GenericElement;
  createDetailMetadata(props: DetailMetadataProps): GenericElement;
  createDetailMetadataLabel(props: DetailMetadataLabelProps): GenericElement;
  createDetailMetadataLink(props: DetailMetadataLinkProps): GenericElement;
  createDetailMetadataTagList(props: DetailMetadataTagListProps): GenericElement;
  createDetailMetadataTagListItem(props: DetailMetadataTagListItemProps): GenericElement;
  createDetailMetadataSeparator(props: DetailMetadataSeparatorProps): GenericElement;

  // Form components
  createForm(props: FormProps): GenericElement;
  createFormTextField(props: FormTextFieldProps): GenericElement;
  createFormTextArea(props: FormTextAreaProps): GenericElement;
  createFormDropdown(props: FormDropdownProps): GenericElement;
  createFormDropdownItem(props: FormDropdownItemProps): GenericElement;
  createFormDropdownSection(props: FormDropdownSectionProps): GenericElement;
  createFormDescription(props: FormDescriptionProps): GenericElement;
  createFormLinkAccessory(props: FormLinkAccessoryProps): GenericElement;

  // Grid components
  createGrid(props: GridProps): GenericElement;
  createGridItem(props: GridItemProps): GenericElement;
  createGridSection(props: GridSectionProps): GenericElement;
  createGridEmptyView(props: GridEmptyViewProps): GenericElement;

  // Action components
  createAction(props: ActionProps): GenericElement;
  createActionPanel(props: ActionPanelProps): GenericElement;
  createActionPanelSection(props: ActionPanelSectionProps): GenericElement;
  createActionPanelSubmenu(props: ActionPanelSubmenuProps): GenericElement;
  createActionPush(props: ActionPushProps): GenericElement;
  createActionCopyToClipboard(props: ActionCopyToClipboardProps): GenericElement;
  createActionPaste(props: ActionPasteProps): GenericElement;
  createActionOpenInBrowser(props: ActionOpenInBrowserProps): GenericElement;
  createActionSubmitForm(props: ActionSubmitFormProps): GenericElement;
}

// ============================================================================
// Component Validation
// ============================================================================

export interface ComponentValidator {
  validateProps(componentType: string, props: any): ValidationResult;
  validateChildren(componentType: string, children: ReactNode[]): ValidationResult;
  validateComponent(component: ReactElement): ValidationResult;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  code: string;
  message: string;
  path?: string;
  severity: 'error' | 'warning';
}

export interface ValidationWarning {
  code: string;
  message: string;
  path?: string;
}

export class ComponentValidatorImpl implements ComponentValidator {
  private validationRules: Map<string, ValidationRule[]> = new Map();

  validateProps(componentType: string, props: any): ValidationResult {
    const rules = this.validationRules.get(componentType) || [];
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    rules.forEach(rule => {
      const result = rule.validate(props);
      if (!result.isValid) {
        if (result.severity === 'error') {
          errors.push({
            code: rule.code,
            message: result.message,
            path: result.path,
            severity: 'error'
          });
        } else {
          warnings.push({
            code: rule.code,
            message: result.message,
            path: result.path
          });
        }
      }
    });

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  validateChildren(_componentType: string, _children: ReactNode[]): ValidationResult {
    // TODO: Implement children validation
    return {
      isValid: true,
      errors: [],
      warnings: []
    };
  }

  validateComponent(_component: ReactElement): ValidationResult {
    // TODO: Implement component validation
    return {
      isValid: true,
      errors: [],
      warnings: []
    };
  }

  addValidationRule(componentType: string, rule: ValidationRule): void {
    const rules = this.validationRules.get(componentType) || [];
    rules.push(rule);
    this.validationRules.set(componentType, rules);
  }
}

export interface ValidationRule {
  code: string;
  validate(props: any): {
    isValid: boolean;
    message: string;
    path?: string;
    severity: 'error' | 'warning';
  };
}

// ============================================================================
// Component Error Handling
// ============================================================================

export class ComponentError extends Error {
  constructor(
    message: string,
    public componentType: string,
    public props?: any,
    public cause?: Error
  ) {
    super(message);
    this.name = 'ComponentError';
  }
}

export class ComponentRenderError extends ComponentError {
  constructor(
    message: string,
    componentType: string,
    props?: any,
    cause?: Error
  ) {
    super(message, componentType, props, cause);
    this.name = 'ComponentRenderError';
  }
}

export class ComponentValidationError extends ComponentError {
  constructor(
    message: string,
    componentType: string,
    public validationErrors: ValidationError[],
    props?: any
  ) {
    super(message, componentType, props);
    this.name = 'ComponentValidationError';
  }
}

// ============================================================================
// Component Registry
// ============================================================================

export interface ComponentRegistry {
  register(name: string, component: any): void;
  get(name: string): any;
  has(name: string): boolean;
  unregister(name: string): void;
  clear(): void;
  getAll(): Record<string, any>;
}

export class ComponentRegistryImpl implements ComponentRegistry {
  private components: Map<string, any> = new Map();

  register(name: string, component: any): void {
    this.components.set(name, component);
  }

  get(name: string): any {
    return this.components.get(name);
  }

  has(name: string): boolean {
    return this.components.has(name);
  }

  unregister(name: string): void {
    this.components.delete(name);
  }

  clear(): void {
    this.components.clear();
  }

  getAll(): Record<string, any> {
    const result: Record<string, any> = {};
    this.components.forEach((component, name) => {
      result[name] = component;
    });
    return result;
  }
}

// ============================================================================
// Component Builder Pattern
// ============================================================================

export interface ComponentBuilder {
  setType(type: string): ComponentBuilder;
  setProps(props: any): ComponentBuilder;
  setChildren(children: ReactNode[]): ComponentBuilder;
  addChild(child: ReactNode): ComponentBuilder;
  setRenderer(renderer: ComponentRenderer): ComponentBuilder;
  build(): ReactElement;
  reset(): ComponentBuilder;
}

export class ComponentBuilderImpl implements ComponentBuilder {
  private type: string = '';
  private props: any = {};
  private children: ReactNode[] = [];
  private renderer?: ComponentRenderer;

  setType(type: string): ComponentBuilder {
    this.type = type;
    return this;
  }

  setProps(props: any): ComponentBuilder {
    this.props = { ...props };
    return this;
  }

  setChildren(children: ReactNode[]): ComponentBuilder {
    this.children = [...children];
    return this;
  }

  addChild(child: ReactNode): ComponentBuilder {
    this.children.push(child);
    return this;
  }

  setRenderer(renderer: ComponentRenderer): ComponentBuilder {
    this.renderer = renderer;
    return this;
  }

  build(): ReactElement {
    if (!this.type) {
      throw new ComponentError('Component type is required', '');
    }

    if (!this.renderer) {
      throw new ComponentError('Component renderer is required', this.type);
    }

    return this.renderer.renderComponent(this.type, this.props, this.children);
  }

  reset(): ComponentBuilder {
    this.type = '';
    this.props = {};
    this.children = [];
    this.renderer = undefined;
    return this;
  }
}

// ============================================================================
// Exports
// ============================================================================

export const componentMappingRegistry = new ComponentMappingRegistryImpl();
export const componentValidator = new ComponentValidatorImpl();
export const componentRegistry = new ComponentRegistryImpl();

export function createComponentBuilder(): ComponentBuilder {
  return new ComponentBuilderImpl();
}