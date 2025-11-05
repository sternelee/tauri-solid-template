# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **SvelteKit-based AI-powered Notion-style rich text editor** built with **Tauri v2**. It features a native macOS design with comprehensive AI integration, rich text editing capabilities, and advanced productivity features. The application combines desktop-app functionality with AI writing assistance through an elegant native interface.

**Project Name**: ai-super-editor
**Description**: AI-powered conversational rich text super editor with multi-provider support

## Key Technologies

- **Frontend**: SvelteKit 2.9 + Svelte 5 + TypeScript + Tailwind CSS v4
- **Backend**: Rust + Tauri v2.8.5
- **Rich Text Editor**: TipTap 3.10.1 with extensive extensions
- **AI Integration**: Rig Core 0.22.0 with multi-provider support (OpenAI, Anthropic, Google, Groq)
- **Database**: LibSQL/SQLite for conversation persistence
- **Native Integration**: macOS-style UI with glassmorphism effects
- **Build**: Vite 6.0.3 with Tailwind CSS v4 plugin
- **UI Components**: Bits-UI, Lucide Svelte for icons
- **Additional**: Edra for state management, Lowlight for syntax highlighting

## Development Commands

### Frontend Development
```bash
# Start development server (runs on http://localhost:1420)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Type checking and linting
npm run check
npm run check:watch

# Format code
npx prettier --write src/
```

### Tauri Development
```bash
# Run Tauri in development mode
npm run tauri dev

# Build Tauri application
npm run tauri build

# Build with verbose output for debugging
npm run tauri build --verbose

# Platform-specific builds
npm run tauri build --target universal-apple-darwin  # macOS
npm run tauri build --target x86_64-pc-windows-msvc    # Windows
npm run tauri build --target x86_64-unknown-linux-gnu  # Linux
```

### Rust Backend
```bash
# Navigate to Rust source directory
cd src-tauri

# Build Rust code
cargo build

# Run tests
cargo test

# Run with logging for debugging
RUST_LOG=debug cargo run

# Check code without building
cargo check

# Generate documentation
cargo doc --open

# Test specific modules
cargo test rig_agent::tests

# Build with optimizations
cargo build --release
```

## Architecture Overview

### Frontend Architecture (SvelteKit)

**Core Components**:
- **`NativeNotionEditor.svelte`**: Main rich text editor with TipTap integration
  - Native macOS-style toolbar with glassmorphism effects
  - Command palette with search and keyboard shortcuts
  - Drag-and-drop file support
  - AI context extraction and suggestions
  - Native keyboard shortcuts (⌘B, ⌘I, ⌘K, etc.)

- **`NativeAIAssistant.svelte`**: AI chat assistant with resizable panel
  - Multi-provider support (OpenAI, Anthropic, Google, Groq)
  - Context-aware responses with @app and #file mentions
  - Native message bubbles with animations
  - Quick action buttons for common writing tasks
  - Resizable sidebar with smooth interactions

- **`+page.svelte`**: Main application layout
  - Welcome overlay with feature showcase
  - Dark mode support with system detection
  - Global keyboard shortcuts (⌘+/ for help)
  - Status bar with word count and shortcuts
  - Loading states and error handling

**Svelte 5 Runes Architecture**:
- `$state()` for reactive state management
- `$props()` for component properties
- `$effect()` for side effects and reactivity
- `$derived()` for computed values
- Event dispatching between components

### Backend Architecture (Rust)

**Core Modules**:
- **`lib.rs`**: Main Tauri entry point with 51 registered commands across 7 categories
- **`rig_agent/`**: Comprehensive AI system with unified agent management
  - `core/`: Unified agent with multi-provider support and streaming
  - `commands/`: 20+ Tauri command handlers for AI operations
  - `tools/`: Tool execution system with registry and permission management
  - `capabilities/`: Modular AI capabilities (chat, embedding, image generation)
  - `mcp_approval.rs`: MCP approval system for secure tool execution
  - `persistance.rs`: Conversation and message persistence with LibSQL

**AI System Features**:
- Multi-provider chat with streaming support
- Tool execution with permission levels (Safe, Restricted, Dangerous)
- MCP (Model Context Protocol) integration
- ReAct mode for reasoning + acting loops
- Conversation persistence with LibSQL database

**Key Command Categories**:
1. **Demo Commands** (2): Basic greeting and shell execution
2. **System Commands** (8): Window management, system info, plugin windows
3. **Apps Commands** (6): Application discovery and icon management
4. **Search Commands** (3): File search with ripgrep integration
5. **MCP Commands** (9): MCP server and tool management
6. **rig_agent Commands** (20+): AI chat, tools, ReAct mode, MCP approval
7. **Settings & UI Commands** (3): Configuration and text selection

### Native UI Features

**macOS-Style Design**:
- Glassmorphism effects with backdrop-blur
- Native keyboard shortcuts and hotkeys
- Smooth animations with cubic-bezier easing
- System theme detection (light/dark mode)
- Native scrollbars and focus states
- Resizable panels with drag handles

**Advanced Interactions**:
- Command palette with fuzzy search
- Context-aware AI suggestions
- Native drag-and-drop with visual feedback
- Keyboard navigation throughout
- Hover effects with micro-animations
- Ripple effects on button clicks

## Development Patterns

### Svelte 5 Runes Patterns
```typescript
// Component state
let editorContent = $state('');
let isDarkMode = $state(false);

// Component props with defaults
let {
  content = "",
  placeholder = "Start writing...",
  onContentChange = () => {}
} = $props();

// Effects for side effects
$effect(() => {
  // Handle side effects here
});

// Derived values
const wordCount = $derived(() => {
  return Math.round(editorContent.length / 5);
});
```

### TipTap Integration
```typescript
// Editor initialization with extensions
editor = new Editor({
  element: editorElement,
  extensions: [
    StarterKit,
    Heading.configure({ levels: [1, 2, 3, 4, 5, 6] }),
    Table.configure({ resizable: true }),
    CodeBlockLowlight.configure({ lowlight }),
    // Custom extensions for mentions and AI features
  ],
  onUpdate: ({ editor }) => {
    content = editor.getHTML();
    onContentChange(content);
  }
});
```

### Tauri Command Patterns
```rust
#[tauri::command]
#[specta::specta]
async fn send_chat_message(
    conversation_id: String,
    message: String,
    apps: Vec<String>,
    files: Vec<String>
) -> Result<ChatResponse, String> {
    // Command implementation
    Ok(response)
}
```

## Configuration

### SvelteKit Configuration (`svelte.config.js`)
- Uses `@sveltejs/adapter-static` for SPA mode with Tauri
- Vite preprocessing for Tailwind CSS
- Path aliases for cleaner imports (`@/*` → `./src/lib/*`)

### Tailwind CSS v4 Configuration
- Uses `@tailwindcss/vite` plugin for Vite integration
- Custom theme definitions in CSS with `@theme` directive using OKLCH color space
- Enhanced animations and keyframes with custom cubic-bezier easing
- Native macOS color palette and typography system
- Component variants and responsive utilities

### Tauri Configuration (`src-tauri/tauri.conf.json`)
- Frontend runs on `http://localhost:1420` in development
- Static preset for SPA compatibility
- External binaries: ripgrep for file search
- Cross-platform builds (desktop, mobile)

### Rust Dependencies (`src-tauri/Cargo.toml`)
- Rig Core 0.22.0 for AI integration with multiple providers
- LibSQL and SQLx for database operations with connection pooling
- Extensive Tauri plugins for native functionality (shell, fs, dialog, etc.)
- Specta for type-safe Tauri command bindings
- Optimized build settings for production with LTO and binary size optimization

## AI Integration

### Multi-Provider Support
```typescript
const providers: AIProvider[] = [
  {
    id: "openai",
    name: "OpenAI",
    models: ["gpt-4o", "gpt-4o-mini", "gpt-3.5-turbo"],
    icon: "🤖"
  },
  {
    id: "anthropic",
    name: "Anthropic",
    models: ["claude-3-5-sonnet-20241022", "claude-3-5-haiku-20241022"],
    icon: "🧠"
  }
  // ... more providers
];
```

### Context System
- **@app mentions**: Reference system applications
- **#file mentions**: Reference files and documents
- **Automatic extraction**: Context parsed from editor content
- **Smart suggestions**: AI suggestions based on text patterns

### Tool Execution
- Permission levels: Safe, Restricted, Dangerous
- MCP integration for external tools
- User approval for sensitive operations
- Real-time tool status monitoring

## Keyboard Shortcuts

### Editor Shortcuts
- `⌘B`: Toggle bold
- `⌘I`: Toggle italic
- `⌘K`: Insert link
- `⌘⌥1/2/3`: Heading levels
- `⌘⇧8/7`: Bullet/numbered lists
- `⌘⌥C`: Code block
- `⌘⌥T`: Insert table
- `⌘⌥A`: AI assistant
- `⌘⌥E`: Export markdown
- `/`: Command palette

### Application Shortcuts
- `⌘N`: New document
- `⌘S`: Save document
- `⌘E`: Export document
- `⌘0`: Focus editor
- `⌘+/`: Show keyboard shortcuts help
- `Alt+Esc`: Close overlays
- `⌘⌥T`: Toggle dark mode
- `⌘⌥F`: Toggle AI assistant

## Testing

### Frontend Testing
```bash
# Type checking
npm run check

# Watch mode for development
npm run check:watch

# Linting
npx prettier --check src/
```

### Backend Testing
```bash
# Run all tests
cd src-tauri && cargo test

# Run specific modules
cargo test rig_agent::tests

# Run with output for debugging
cargo test -- --nocapture
```

## Common Issues and Solutions

### Svelte 5 Runes Issues
- Use `$props()` instead of `export let` for component props
- Use `$state()` instead of `$:` for reactive state
- Use `$effect()` instead of reactive statements
- Use `$derived()` for computed values
- Use `$bindable()` for two-way binding props

### TipTap Integration
- Import extensions with named imports: `import { Document } from "@tiptap/extension-document"`
- Configure lowlight for syntax highlighting in code blocks
- Handle content updates in `onUpdate` callback
- Use proper content serialization between TipTap and Svelte state

### Tailwind CSS v4
- Use `@theme` directive in CSS for custom values
- No need for separate PostCSS config with Vite plugin
- Define custom animations in Tailwind config with `@keyframes` directive
- OKLCH color space provides better color consistency

### Tauri Development
- Commands must use `#[tauri::command]` and `#[specta::specta]` attributes
- Register all commands in single `invoke_handler` macro
- Use `Result<T, String>` for error handling
- Enable development features with `tauri-plugin-devtools` in debug builds

### AI Integration
- Ensure proper API keys are configured for each provider
- Handle streaming responses with proper backpressure
- Use conversation persistence for maintaining context
- Respect tool permission levels for security

## Performance Considerations

### Frontend Optimizations
- Svelte 5 runes for efficient reactivity
- TipTap lazy loading for editor features
- Virtualized components for large lists
- Optimized animations with CSS transforms

### Backend Performance
- Connection pooling for database operations
- Cached agent instances for reuse
- Async operations throughout
- Binary size optimization in release builds

### Memory Management
- Proper cleanup in `onDestroy` lifecycle
- Efficient state management with Svelte signals
- Garbage collection for AI conversation history
- File handle management for drag-and-drop

## Key File Locations

### Frontend Files
- `src/routes/+page.svelte`: Main application entry
- `src/routes/+layout.svelte`: Layout with CSS imports
- `src/lib/components/`: Svelte components
- `src/lib/types/`: TypeScript type definitions
- `src/app.css`: Global styles with Tailwind imports

### Backend Files
- `src-tauri/src/lib.rs`: Main Tauri entry with command registration
- `src-tauri/src/rig_agent/`: AI system implementation
- `src-tauri/migrations/`: Database migrations
- `src-tauri/Cargo.toml`: Rust dependencies and configuration

### Configuration Files
- `package.json`: Frontend dependencies and scripts
- `src-tauri/tauri.conf.json`: Tauri application configuration
- `svelte.config.js`: SvelteKit configuration
- `tailwind.config.js`: Tailwind CSS customization
- `vite.config.js`: Vite build configuration

## Database Schema

### Conversations Table
- `id`: Primary key
- `title`: Conversation title
- `provider`: AI provider used
- `model`: AI model used
- `created_at`, `updated_at`: Timestamps
- `message_count`: Number of messages

### Messages Table
- `id`: Primary key
- `conversation_id`: Foreign key to conversations
- `role`: 'user', 'assistant', or 'system'
- `content`: Message content
- `metadata`: Additional metadata (provider, model, tokens)
- `timestamp`: Message timestamp

This AI-powered Notion editor combines modern web technologies with native desktop capabilities to provide a professional writing experience with intelligent AI assistance.