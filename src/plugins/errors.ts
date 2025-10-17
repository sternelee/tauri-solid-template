// Plugin system error types
export class PluginError extends Error {
  constructor(
    message: string,
    public code: string,
    public pluginId?: string,
    public details?: any
  ) {
    super(message);
    this.name = 'PluginError';
  }
}

export class PluginLoadError extends PluginError {
  constructor(pluginId: string, message: string, details?: any) {
    super(`Failed to load plugin "${pluginId}": ${message}`, 'PLUGIN_LOAD_FAILED', pluginId, details);
    this.name = 'PluginLoadError';
  }
}

export class PermissionDeniedError extends PluginError {
  constructor(permission: string, pluginId?: string) {
    super(`Permission denied: ${permission}`, 'PERMISSION_DENIED', pluginId, { permission });
    this.name = 'PermissionDeniedError';
  }
}

export class ShortcutConflictError extends PluginError {
  constructor(shortcut: string, existingPlugin: string, newPlugin: string) {
    super(
      `Shortcut "${shortcut}" already registered by plugin "${existingPlugin}", cannot register for "${newPlugin}"`,
      'SHORTCUT_CONFLICT',
      newPlugin,
      { shortcut, existingPlugin }
    );
    this.name = 'ShortcutConflictError';
  }
}

export class WindowOperationError extends PluginError {
  constructor(operation: string, windowId: string, details?: any) {
    super(
      `Window operation "${operation}" failed for window "${windowId}"`,
      'WINDOW_OPERATION_FAILED',
      undefined,
      { operation, windowId, ...details }
    );
    this.name = 'WindowOperationError';
  }
}
