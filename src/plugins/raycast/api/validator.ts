// ============================================================================
// Raycast API Validator Implementation
// ============================================================================
// Based on design.md requirements for API validation and permission checking

import type { RaycastAPI, RaycastManifest, PreferenceSchema } from "../types";
import type { PermissionManager } from "./context";

// ============================================================================
// API Validator Interface
// ============================================================================

export interface APIValidator {
  validateManifest(manifest: RaycastManifest): ValidationResult;
  validateAPIUsage(
    pluginId: string,
    apiUsage: APIUsageRecord,
  ): ValidationResult;
  validateComponentUsage(
    pluginId: string,
    component: string,
    props: any,
  ): ValidationResult;
  validatePermissions(
    pluginId: string,
    requiredPermissions: string[],
  ): ValidationResult;
  validatePreferences(
    preferences: Record<string, any>,
    schema?: PreferenceSchema[],
  ): ValidationResult;
}

// ============================================================================
// Validation Result
// ============================================================================

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  code: string;
  message: string;
  severity: "error" | "warning" | "info";
  field?: string;
  context?: any;
}

export interface ValidationWarning {
  code: string;
  message: string;
  field?: string;
  context?: any;
}

// ============================================================================
// API Usage Record
// ============================================================================

export interface APIUsageRecord {
  pluginId: string;
  timestamp: number;
  apiCalls: APICall[];
  componentUsages: ComponentUsage[];
}

export interface APICall {
  method: string;
  args: any[];
  timestamp: number;
  result?: any;
  error?: Error;
}

export interface ComponentUsage {
  component: string;
  props: any;
  timestamp: number;
  renderResult?: any;
  error?: Error;
}

// ============================================================================
// API Validator Implementation
// ============================================================================

export class APIValidatorImpl implements APIValidator {
  private permissionManager: PermissionManager;

  constructor(permissionManager: PermissionManager) {
    this.permissionManager = permissionManager;
  }

  // ============================================================================
  // Manifest Validation
  // ============================================================================

  validateManifest(manifest: RaycastManifest): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Required fields validation
    this.validateRequiredFields(manifest, errors);

    // Command validation
    this.validateCommands(manifest, errors, warnings);

    // Preferences validation
    if (manifest.preferences) {
      this.validatePreferences(manifest.preferences, errors, warnings);
    }

    // Author validation
    this.validateAuthor(manifest, warnings);

    // Icon validation
    this.validateIcon(manifest, warnings);

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  private validateRequiredFields(
    manifest: RaycastManifest,
    errors: ValidationError[],
  ): void {
    const requiredFields = [
      "name",
      "title",
      "description",
      "author",
      "commands",
    ];

    requiredFields.forEach((field) => {
      if (!manifest[field as keyof RaycastManifest]) {
        errors.push({
          code: "MISSING_REQUIRED_FIELD",
          message: `Required field '${field}' is missing`,
          severity: "error",
          field,
        });
      }
    });

    // Validate name format
    if (manifest.name && !/^[a-z0-9-]+$/.test(manifest.name)) {
      errors.push({
        code: "INVALID_NAME_FORMAT",
        message:
          "Plugin name must contain only lowercase letters, numbers, and hyphens",
        severity: "error",
        field: "name",
      });
    }
  }

  private validateCommands(
    manifest: RaycastManifest,
    errors: ValidationError[],
    warnings: ValidationWarning[],
  ): void {
    if (!manifest.commands || manifest.commands.length === 0) {
      errors.push({
        code: "NO_COMMANDS",
        message: "Plugin must have at least one command",
        severity: "error",
        field: "commands",
      });
      return;
    }

    manifest.commands.forEach((command, index) => {
      this.validateCommand(command, index, errors, warnings);
    });
  }

  private validateCommand(
    command: any,
    index: number,
    errors: ValidationError[],
    warnings: ValidationWarning[],
  ): void {
    const prefix = `commands[${index}]`;

    // Required fields
    if (!command.name) {
      errors.push({
        code: "MISSING_COMMAND_NAME",
        message: `Command at index ${index} is missing required 'name' field`,
        severity: "error",
        field: `${prefix}.name`,
      });
    }

    if (!command.title) {
      errors.push({
        code: "MISSING_COMMAND_TITLE",
        message: `Command at index ${index} is missing required 'title' field`,
        severity: "error",
        field: `${prefix}.title`,
      });
    }

    if (!command.description) {
      errors.push({
        code: "MISSING_COMMAND_DESCRIPTION",
        message: `Command at index ${index} is missing required 'description' field`,
        severity: "error",
        field: `${prefix}.description`,
      });
    }

    // Mode validation
    if (
      command.mode &&
      !["view", "no-view", "menu-bar"].includes(command.mode)
    ) {
      errors.push({
        code: "INVALID_COMMAND_MODE",
        message: `Invalid command mode: ${command.mode}. Must be one of: view, no-view, menu-bar`,
        severity: "error",
        field: `${prefix}.mode`,
      });
    }

    // Name format validation
    if (command.name && !/^[a-z0-9-]+$/.test(command.name)) {
      errors.push({
        code: "INVALID_COMMAND_NAME_FORMAT",
        message:
          "Command name must contain only lowercase letters, numbers, and hyphens",
        severity: "error",
        field: `${prefix}.name`,
      });
    }
  }

  private validatePreferences(
    preferences: PreferenceSchema[],
    errors: ValidationError[],
    warnings: ValidationWarning[],
  ): void {
    preferences.forEach((pref, index) => {
      this.validatePreference(pref, index, errors, warnings);
    });
  }

  private validatePreference(
    pref: PreferenceSchema,
    index: number,
    errors: ValidationError[],
    warnings: ValidationWarning[],
  ): void {
    const prefix = `preferences[${index}]`;

    // Required fields
    if (!pref.name) {
      errors.push({
        code: "MISSING_PREFERENCE_NAME",
        message: `Preference at index ${index} is missing required 'name' field`,
        severity: "error",
        field: `${prefix}.name`,
      });
    }

    if (!pref.type) {
      errors.push({
        code: "MISSING_PREFERENCE_TYPE",
        message: `Preference at index ${index} is missing required 'type' field`,
        severity: "error",
        field: `${prefix}.type`,
      });
    }

    // Type validation
    const validTypes = [
      "textfield",
      "password",
      "checkbox",
      "dropdown",
      "appPicker",
      "file",
      "directory",
    ];
    if (pref.type && !validTypes.includes(pref.type)) {
      errors.push({
        code: "INVALID_PREFERENCE_TYPE",
        message: `Invalid preference type: ${pref.type}. Must be one of: ${validTypes.join(", ")}`,
        severity: "error",
        field: `${prefix}.type`,
      });
    }

    // Data validation for dropdown
    if (pref.type === "dropdown" && !pref.data) {
      warnings.push({
        code: "DROPDOWN_WITHOUT_DATA",
        message: `Dropdown preference at index ${index} should have 'data' field with options`,
        field: `${prefix}.data`,
      });
    }
  }

  private validateAuthor(
    manifest: RaycastManifest,
    warnings: ValidationWarning[],
  ): void {
    if (typeof manifest.author === "string" && !manifest.author.trim()) {
      warnings.push({
        code: "EMPTY_AUTHOR",
        message: "Author field should not be empty",
        field: "author",
      });
    }
  }

  private validateIcon(
    manifest: RaycastManifest,
    warnings: ValidationWarning[],
  ): void {
    if (!manifest.icon) {
      warnings.push({
        code: "MISSING_ICON",
        message: "Plugin should have an icon for better user experience",
        field: "icon",
      });
    }
  }

  // ============================================================================
  // API Usage Validation
  // ============================================================================

  validateAPIUsage(
    pluginId: string,
    apiUsage: APIUsageRecord,
  ): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Validate each API call
    apiUsage.apiCalls.forEach((call, index) => {
      this.validateAPICall(pluginId, call, index, errors, warnings);
    });

    // Validate component usage
    apiUsage.componentUsages.forEach((usage, index) => {
      this.validateComponentUsage(pluginId, usage.component, usage.props);
    });

    // Check for suspicious usage patterns
    this.validateUsagePatterns(pluginId, apiUsage, errors, warnings);

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  private validateAPICall(
    pluginId: string,
    call: APICall,
    index: number,
    errors: ValidationError[],
    warnings: ValidationWarning[],
  ): void {
    // Validate permission for API calls
    const requiredPermission = this.getPermissionForAPICall(call.method);
    if (
      requiredPermission &&
      !this.permissionManager.checkPermission(pluginId, requiredPermission)
    ) {
      errors.push({
        code: "INSUFFICIENT_PERMISSIONS",
        message: `Plugin ${pluginId} does not have permission for API call: ${call.method}`,
        severity: "error",
        context: { method: call.method, args: call.args },
      });
    }

    // Validate API call arguments
    this.validateAPICallArguments(call, errors, warnings);
  }

  private validateAPICallArguments(
    call: APICall,
    errors: ValidationError[],
    warnings: ValidationWarning[],
  ): void {
    // Implementation would validate specific API call arguments
    // This is a placeholder for argument validation logic
    switch (call.method) {
      case "open":
        if (call.args.length === 0 || typeof call.args[0] !== "string") {
          errors.push({
            code: "INVALID_ARGUMENTS",
            message: "open() method requires a string target as first argument",
            severity: "error",
            context: { method: call.method, args: call.args },
          });
        }
        break;

      case "showToast":
        if (call.args.length === 0 || typeof call.args[0] !== "object") {
          errors.push({
            code: "INVALID_ARGUMENTS",
            message:
              "showToast() method requires a ToastOptions object as first argument",
            severity: "error",
            context: { method: call.method, args: call.args },
          });
        }
        break;
    }
  }

  private getPermissionForAPICall(method: string): string | null {
    // Map API calls to required permissions
    const permissionMap: Record<string, string> = {
      open: "filesystem",
      showInFinder: "filesystem",
      trash: "filesystem",
      getSelectedText: "clipboard",
      getSelectedFinderItems: "filesystem",
      getApplications: "system",
      getDefaultApplication: "system",
      getFrontmostApplication: "system",
      "Clipboard.readText": "clipboard",
      "Clipboard.writeText": "clipboard",
      "AI.ask": "ai",
      "OAuth.authorize": "oauth",
      "BrowserExtension.getTabs": "browser-extension",
      "BrowserExtension.getContent": "browser-extension",
    };

    return permissionMap[method] || null;
  }

  private validateUsagePatterns(
    pluginId: string,
    apiUsage: APIUsageRecord,
    errors: ValidationError[],
    warnings: ValidationWarning[],
  ): void {
    // Check for excessive API calls
    if (apiUsage.apiCalls.length > 1000) {
      warnings.push({
        code: "EXCESSIVE_API_CALLS",
        message: `Plugin ${pluginId} made ${apiUsage.apiCalls.length} API calls, consider optimizing`,
        context: { callCount: apiUsage.apiCalls.length },
      });
    }

    // Check for API call failures
    const failedCalls = apiUsage.apiCalls.filter((call) => call.error);
    if (failedCalls.length > apiUsage.apiCalls.length * 0.1) {
      // More than 10% failure rate
      warnings.push({
        code: "HIGH_FAILURE_RATE",
        message: `Plugin ${pluginId} has a high API call failure rate: ${failedCalls.length}/${apiUsage.apiCalls.length}`,
        context: {
          failureCount: failedCalls.length,
          totalCalls: apiUsage.apiCalls.length,
        },
      });
    }
  }

  // ============================================================================
  // Component Usage Validation
  // ============================================================================

  validateComponentUsage(
    pluginId: string,
    component: string,
    props: any,
  ): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Validate component name
    if (!this.isValidComponent(component)) {
      errors.push({
        code: "INVALID_COMPONENT",
        message: `Unknown component: ${component}`,
        severity: "error",
        context: { component, props },
      });
    }

    // Validate component props
    this.validateComponentProps(component, props, errors, warnings);

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  private isValidComponent(component: string): boolean {
    const validComponents = [
      "List",
      "List.Item",
      "List.Section",
      "List.EmptyView",
      "List.Dropdown",
      "Detail",
      "Detail.Metadata",
      "Detail.Metadata.Label",
      "Detail.Metadata.Link",
      "Form",
      "Form.TextField",
      "Form.TextArea",
      "Form.Dropdown",
      "Form.Description",
      "Grid",
      "Grid.Item",
      "Grid.Section",
      "Grid.EmptyView",
      "Action",
      "ActionPanel",
      "ActionPanel.Section",
      "ActionPanel.Submenu",
    ];

    return validComponents.includes(component);
  }

  private validateComponentProps(
    component: string,
    props: any,
    errors: ValidationError[],
    warnings: ValidationWarning[],
  ): void {
    // Component-specific prop validation
    switch (component) {
      case "List.Item":
        if (!props.title) {
          errors.push({
            code: "MISSING_REQUIRED_PROP",
            message: "List.Item requires a title prop",
            severity: "error",
            context: { component, props },
          });
        }
        break;

      case "Form.TextField":
      case "Form.TextArea":
      case "Form.Dropdown":
        if (!props.id) {
          errors.push({
            code: "MISSING_REQUIRED_PROP",
            message: `${component} requires an id prop`,
            severity: "error",
            context: { component, props },
          });
        }
        break;
    }
  }

  // ============================================================================
  // Permission Validation
  // ============================================================================

  validatePermissions(
    pluginId: string,
    requiredPermissions: string[],
  ): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    requiredPermissions.forEach((permission) => {
      if (!this.permissionManager.checkPermission(pluginId, permission)) {
        errors.push({
          code: "MISSING_PERMISSION",
          message: `Plugin ${pluginId} is missing required permission: ${permission}`,
          severity: "error",
          context: { permission },
        });
      }
    });

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  // ============================================================================
  // Preferences Validation
  // ============================================================================

  validatePreferences(
    preferences: Record<string, any>,
    schema?: PreferenceSchema[],
  ): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    if (!schema) {
      return { isValid: true, errors: [], warnings: [] };
    }

    schema.forEach((prefSchema) => {
      const value = preferences[prefSchema.name];
      this.validatePreferenceValue(prefSchema, value, errors, warnings);
    });

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  private validatePreferenceValue(
    prefSchema: PreferenceSchema,
    value: any,
    errors: ValidationError[],
    warnings: ValidationWarning[],
  ): void {
    // Check required preferences
    if (
      prefSchema.required &&
      (value === undefined || value === null || value === "")
    ) {
      errors.push({
        code: "MISSING_REQUIRED_PREFERENCE",
        message: `Required preference '${prefSchema.name}' is missing or empty`,
        severity: "error",
        context: { preference: prefSchema.name, value },
      });
    }

    // Type validation
    if (value !== undefined && value !== null) {
      if (!this.validatePreferenceType(prefSchema.type, value)) {
        errors.push({
          code: "INVALID_PREFERENCE_TYPE",
          message: `Preference '${prefSchema.name}' has invalid type. Expected ${prefSchema.type}`,
          severity: "error",
          context: {
            preference: prefSchema.name,
            value,
            expectedType: prefSchema.type,
          },
        });
      }
    }
  }

  private validatePreferenceType(type: string, value: any): boolean {
    switch (type) {
      case "textfield":
      case "password":
      case "file":
      case "directory":
        return typeof value === "string";
      case "checkbox":
        return typeof value === "boolean";
      case "dropdown":
      case "appPicker":
        return typeof value === "string";
      default:
        return true; // Unknown type, allow it
    }
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createAPIValidator(
  permissionManager: PermissionManager,
): APIValidator {
  return new APIValidatorImpl(permissionManager);
}

