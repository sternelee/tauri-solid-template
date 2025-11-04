# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **Raycast-inspired application launcher** built with **Tauri** and **SolidJS**. It features a command palette interface with intelligent search, AI chat capabilities, and extensive plugin system. The application combines desktop app discovery with advanced AI integration through a dual-mode interface (Command/Chat).

## Key Technologies

- **Frontend**: SolidJS + TypeScript + Tailwind CSS
- **Backend**: Rust + Tauri v2
- **AI Integration**: Rig Core with multiple providers (OpenAI, Anthropic, etc.)
- **Database**: LibSQL/SQLite for conversation persistence
- **Search**: Ripgrep integration for file search
- **Build**: Vinxi (SolidStart framework) with Vite

## Development Commands

### Frontend Development
```bash
# Start development server
pnpm dev

# Build for production
pnpm build

# Format code
pnpm format

# Install dependencies
pnpm install
```

### Tauri Development
```bash
# Run Tauri in development mode
pnpm tauri dev

# Build Tauri application
pnpm tauri build

# Build with verbose output
pnpm tauri build --verbose
```

### Rust Backend
```bash
# Navigate to Rust source directory
cd src-tauri

# Build Rust code
cargo build

# Run tests
cargo test

# Run with logging
RUST_LOG=debug cargo run

# Check code
cargo check

# Generate documentation
cargo doc
```

## Architecture Overview

### Frontend Architecture
- **SolidJS Signals**: Reactive state management throughout the application
- **Component Structure**: Modular components in `src/components/`
- **Routes**: File-based routing in `src/routes/`
- **Plugin System**: Comprehensive plugin architecture in `src/plugins/`

### Backend Architecture (Rust)

#### Core Modules
- **`lib.rs`**: Main Tauri application entry point with command registration (51 commands total)
- **`apps.rs`**: System application discovery and management
- **`search.rs`**: File search functionality with ripgrep integration
- **`database.rs`**: LibSQL database operations for conversation persistence
- **`settings.rs`**: Application settings management
- **`text_selection.rs`**: Text selection and toolbar functionality

#### AI System (`rig_agent/`)

**Core Architecture**:
- **`mod.rs`**: Main entry point with `AgentManager` - unified interface for all AI operations
- **`core/`**: Unified agent system with provider management
  - `agent.rs`: `UnifiedAgent` for chat, streaming, embeddings, image generation
  - `provider.rs`: Multi-provider management (OpenAI, Anthropic, Google, Groq, etc.)
  - `config.rs`: Type-safe configuration with feature toggles
  - `types.rs`: Multi-modal messages, conversations, streaming events
- **`capabilities/`**: AI capabilities (chat, embedding, image generation, streaming)
- **`commands/`**: 20 Tauri command handlers for AI operations
- **`tools/`**: Tool execution system with registry and management
- **`events/`**: Event system for AI operations with history and filtering
- **`mcp_approval.rs` & `mcp_approval_manager.rs`**: MCP approval system for secure tool execution

#### MCP Integration (`mcp/`)
- **`client.rs`**: MCP client implementation
- **`commands.rs`**: MCP-related Tauri commands
- **`state.rs`**: MCP state management
- **`helpers.rs`**: MCP utility functions

### Key Components

#### Frontend Components
- **`CommandPalette.tsx`**: Main interface component, manages Command/Chat mode switching
- **`AIChatInterface.tsx`**: AI chat interface with @app and #file context support
- **`ConversationHistory.tsx`**: Chat history management with search
- **`McpManager.tsx`**: MCP server management interface
- **`MultiProviderAIChatInterface.tsx`**: Multi-provider chat interface
- **`ProviderConfigPanel.tsx`**: AI provider configuration panel

#### Backend Command Categories (51 total commands)
1. **Demo Commands** (2): `greet`, `execute_command`
2. **System Commands** (8): Window management, system info, plugin windows
3. **Apps Commands** (6): Application discovery, icon management, usage tracking
4. **Search Commands** (3): File search, screenshot search, directory management
5. **MCP Commands** (9): Server management, tool execution, configuration
6. **rig_agent Commands** (20): AI chat, tool execution, configuration, ReAct mode, MCP approval
7. **Settings & UI Commands** (3): Settings management, text selection

## Development Patterns

### State Management
- Use SolidJS `createSignal` for reactive state
- Store complex state in objects with multiple signals
- Maintain separation between UI state and business logic

### Component Patterns
- Components are self-contained with their own state
- Use TypeScript interfaces for props and state
- Implement keyboard navigation and accessibility
- Follow Raycast design patterns (dark theme, minimal UI)
- Use `cmdk-solid` for command palette functionality

### Tauri Command Patterns
- All commands must be annotated with `#[tauri::command]` and `#[specta::specta]`
- Use `Result<T, String>` for error handling
- Register commands in `lib.rs`'s single `invoke_handler` macro
- Export TypeScript bindings automatically in debug mode

### Database Operations
- Use sqlx for type-safe database operations
- Implement proper error handling and connection pooling
- Use transactions for multi-step operations
- Handle database migrations in `migrations/` directory

## Configuration

### Tauri Configuration (`src-tauri/tauri.conf.json`)
- Frontend runs on `http://localhost:3000` in development
- Uses static preset for SSR
- Configured for all target platforms (desktop, mobile)
- External binaries include ripgrep (`binaries/rg`)

### Rust Configuration (`src-tauri/Cargo.toml`)
- Optimized for binary size in release builds (`opt-level = "s"`)
- Comprehensive feature set for AI, database, and system integration
- Uses `libsql` and `sqlx` for database operations
- Includes Rig Core, RMCP, and extensive Tauri plugins

### Frontend Configuration (`app.config.ts`)
- Vite configuration with Tailwind CSS
- HMR support with mobile detection
- Internal IP detection for mobile testing
- Mobile platform detection for different behaviors

## AI Integration

### Provider Configuration
The system supports multiple AI providers through a unified interface:
- **OpenAI**: GPT models (gpt-3.5-turbo, gpt-4, gpt-4-turbo, gpt-4o)
- **Anthropic**: Claude models (claude-3-haiku, claude-3-sonnet, claude-3-opus)
- **Google**: Gemini models
- **Groq**: High-speed inference
- **Other providers**: Through Rig Core

### Tool System
- **Tool Registry**: Dynamic tool registration and discovery
- **Execution Context**: Permission-based tool execution (Safe, Restricted, Dangerous)
- **MCP Integration**: Model Context Protocol for external tools
- **Approval System**: User approval required for sensitive operations
- **Performance Metrics**: Execution time tracking and success rates

### Chat Features
- **Conversation Persistence**: All chats saved to local database
- **Context Awareness**: @app and #file references automatically processed
- **Streaming**: Real-time streaming responses
- **History Management**: Search and manage conversation history
- **Multi-modal Support**: Text, images, audio, video content

### ReAct Mode
- **Reasoning + Acting**: AI can reason and take actions in loops
- **Tool Discovery**: Dynamic tool finding based on context
- **State Management**: Track reasoning, observations, and actions
- **Configurable**: Adjustable max iterations and system prompts

## MCP Integration

### Model Context Protocol
- **Server Management**: Add, configure, and manage MCP servers
- **Tool Discovery**: Automatic tool discovery from MCP servers
- **Approval System**: User approval for tool execution
- **Status Monitoring**: Real-time server status and health checks

### MCP Commands
- **Server Management**: `activate_mcp_server`, `deactivate_mcp_server`, `restart_mcp_servers`
- **Tool Management**: `get_tools`, `call_tool`, `cancel_tool_call`
- **Configuration**: `get_mcp_configs`, `save_mcp_configs`
- **Approval System**: `initialize_mcp_approval_manager`, `approve_tool_request`, `reject_tool_request`

## Testing

### Frontend Testing
```bash
# Run tests (when implemented)
pnpm test
```

### Backend Testing
```bash
# Run Rust tests
cd src-tauri && cargo test

# Run specific test module
cargo test test_module_name

# Run with output
cargo test -- --nocapture

# Run rig_agent tests
cargo test rig_agent::tests
```

## Development Tips

### Common Issues
1. **Command Not Found**: Ensure commands are registered in single `invoke_handler` in `lib.rs`
2. **MCP Server Connection**: Ensure servers are properly configured and running
3. **Database Initialization**: Check database file permissions and migration status
4. **AI Provider Keys**: Verify API keys are properly configured in settings
5. **Frontend Routing**: Use SolidStart conventions for route handling

### Debugging
- Use Tauri devtools in development (automatically enabled)
- Check browser console for frontend errors
- Monitor Rust logs with `RUST_LOG=debug cargo run`
- Use `cargo doc --open` to view documentation
- Check MCP server status in application

### Performance Considerations
- Database operations are async and use connection pooling
- Tool results are cached when appropriate
- Frontend uses SolidJS signals for efficient reactivity
- Ripgrep integration is optimized for performance
- Rig agents are cached globally for reuse

## Plugin System

The application includes a comprehensive plugin system compatible with Raycast plugins:
- **Location**: `src/plugins/`
- **Raycast Compatibility**: Full API compatibility layer
- **Tauri Integration**: Native Tauri bridge for system access
- **Component Mapping**: Automatic component transformation
- **Plugin Manager**: Dynamic plugin loading and lifecycle management

## Security Considerations

- All data stored locally (no cloud sync)
- API keys stored securely using Tauri Store
- Tool execution requires user approval for sensitive operations
- File system access follows Tauri permission model
- MCP server connections are sandboxed
- Permission levels: Safe, Restricted, Dangerous

## Mobile Support

The application supports iOS and Android through Tauri mobile:
- **Responsive Design**: Tailwind CSS with mobile-first approach
- **Platform Detection**: Conditional features based on platform
- **Performance**: Optimized for mobile hardware constraints
- **Touch Interface**: Mobile-friendly UI interactions

## Build and Deployment

### Development Build
```bash
pnpm tauri dev
```

### Production Build
```bash
pnpm tauri build
```

### Platform-Specific Builds
```bash
# macOS
pnpm tauri build --target universal-apple-darwin

# Windows
pnpm tauri build --target x86_64-pc-windows-msvc

# Linux
pnpm tauri build --target x86_64-unknown-linux-gnu
```

## Key Files and Locations

### Configuration Files
- `package.json`: Frontend dependencies and scripts
- `src-tauri/Cargo.toml`: Rust dependencies and build configuration
- `src-tauri/tauri.conf.json`: Tauri application configuration
- `app.config.ts`: Frontend build configuration

### Core Source Files
- `src-tauri/src/lib.rs`: Main Tauri application with command registration
- `src-tauri/src/rig_agent/mod.rs`: AI system entry point
- `src/components/CommandPalette.tsx`: Main UI component
- `src/components/AIChatInterface.tsx`: Chat interface component

### Database
- **Location**: `~/.config/app/database.db` (Linux), `~/Library/Application Support/app/database.db` (macOS)
- **Migrations**: `src-tauri/migrations/`
- **Schema**: Conversations, messages, settings, MCP configurations

### External Binaries
- `src-tauri/binaries/rg`: Ripgrep binary for file search

## Event System

The application uses a comprehensive event system:
- **AI Events**: Chat started/completed, tool called, errors
- **MCP Events**: Server status changes, tool discoveries
- **UI Events**: Window visibility, plugin actions
- **History**: Configurable event history with filtering
- **Export**: JSON/CSV event export capabilities