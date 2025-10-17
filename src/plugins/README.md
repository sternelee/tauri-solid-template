# Plugin System Architecture

This is a comprehensive plugin system for the Raycast-like Tauri application, providing a unified way to extend functionality with Shadow DOM isolation, permission management, and consistent UX patterns.

## Architecture Overview

### Core Components

1. **PluginManager** - Central plugin registry and lifecycle management
2. **PluginSDK** - Unified API for plugin developers
3. **WindowManager** - Handles different window modes (normal, fullscreen, floating)
4. **Plugin Types** - TypeScript interfaces for type safety

### Key Features

- **Shadow DOM Isolation**: Each plugin runs in its own Shadow DOM for security and style isolation
- **Unified Interactions**: Consistent keyboard shortcuts (Esc to exit, etc.)
- **Permission System**: Granular permissions for system operations
- **Window Management**: Support for normal, fullscreen, and floating window modes
- **Hot Reloading**: Plugins can be loaded dynamically

## Plugin Development

### Basic Plugin Structure

```typescript
import { definePlugin } from "../PluginSDK";

export default definePlugin(
  {
    id: "my-plugin",
    name: "My Plugin",
    version: "1.0.0",
    description: "A sample plugin",
    permissions: [
      {
        type: "filesystem",
        description: "Access to read/write files",
      },
    ],
  },
  [
    {
      id: "my-command",
      title: "My Command",
      description: "Does something useful",
      keywords: ["useful", "command"],
      shortcut: "Cmd+Shift+X",
      icon: "🔧",
      action: async () => {
        // Command implementation
      },
    },
  ],
  MyPluginUI, // Optional React component
);
```

### Plugin Context

Plugins have access to a unified context:

```typescript
import { usePluginContext } from '../PluginSDK';

function MyPluginComponent() {
  const context = usePluginContext();

  const handleAction = () => {
    // Window management
    context.window.setMode('fullscreen');
    context.window.close();

    // Tauri commands
    context.invoke('some-tauri-command');

    // UI feedback
    context.showHUD('Action completed!');
  };

  return <div>My Plugin UI</div>;
}
```

### Window Modes

Plugins can operate in different window modes:

- **Normal**: Standard window with decorations
- **Fullscreen**: Takes entire screen (for screenshots, etc.)
- **Floating**: Transparent, always-on-top window

## Permission System

Plugins must declare required permissions:

```typescript
permissions: [
  {
    type: "screen-capture",
    description: "Access to capture screen content",
  },
  {
    type: "filesystem",
    description: "Read/write access to files",
  },
  {
    type: "clipboard",
    description: "Access to clipboard content",
  },
  {
    type: "notification",
    description: "Send system notifications",
  },
  {
    type: "global-shortcut",
    description: "Register global keyboard shortcuts",
  },
];
```

## Example: Screenshot Plugin

The included screenshot plugin demonstrates:

- Permission requests for screen capture
- Fullscreen mode switching
- Unified Esc key handling
- Shadow DOM styling
- React component integration

## Integration with Command Palette

Plugins automatically appear in the command palette under the "Plugins" section. Commands are searchable and executable through the unified interface.

## Development Workflow

1. Create plugin in `src/plugins/your-plugin/`
2. Implement using the PluginSDK
3. Load plugin in CommandPalette component
4. Commands appear in search results
5. Plugin UI mounts in Shadow DOM when activated

## Security Considerations

- Plugins run in Shadow DOM for style isolation
- Permission system prevents unauthorized access
- Dynamic imports ensure plugins are loaded on-demand
- Context API provides controlled access to system features

## Future Enhancements

- Plugin marketplace/store
- Plugin update mechanism
- Advanced permission management
- Cross-platform compatibility
- Plugin analytics and metrics
