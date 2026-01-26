# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Tauri desktop application built with SolidJS and Vinxi. The project uses:
- **Tauri v2** - Desktop app framework with Rust backend
- **SolidJS** - Reactive UI framework
- **Vinxi** - Build tool/server for SolidStart
- **Tailwind CSS v4** - Styling with DaisyUI components
- **TypeScript** - Type safety
- **tauri-specta** - Type-safe Rust-JS bindings (auto-generates `src/bindings.ts`)

## Commands

### Development
```bash
pnpm dev          # Start dev server (frontend on :3000, Tauri watches for changes)
pnpm tauri dev    # Run full Tauri app in development mode
```

### Building
```bash
pnpm build        # Build frontend to .output/public
pnpm tauri build  # Build complete desktop application
```

### Code Quality
```bash
pnpm format       # Format source files with Prettier
```

## Architecture

### Frontend Structure
- `src/app.tsx` - Root app with Router and FileRoutes
- `src/routes/` - File-based routing (SolidStart convention)
- `src/bindings.ts` - **AUTO-GENERATED** Rust-JS bindings via tauri-specta (do not edit manually)
- `src/entry-client.tsx` / `src/entry-server.tsx` - SSR entry points
- `app.config.ts` - Vinxi/Vite config with Tailwind plugin and Tauri dev server settings

### Backend Structure (Rust)
- `src-tauri/src/lib.rs` - Main Rust logic with Tauri commands and events (library crate: `app_lib`)
- `src-tauri/src/main.rs` - Entry point that calls `app_lib::run()`
- `src-tauri/Cargo.toml` - Rust dependencies (library name defined as `app_lib`)
- `src-tauri/tauri.conf.json` - Tauri app configuration

### Key Pattern: Tauri-Specta Bridge
The project uses tauri-specta for type-safe communication between Rust and TypeScript:

1. Define commands in Rust with `#[tauri::command]` and `#[specta::specta]` attributes
2. Define events with `#[derive(Event)]` attribute
3. In debug builds, TypeScript bindings are auto-exported to `src/bindings.ts`
4. Import `commands` and `events` from `~/bindings` in frontend code

Example from `src-tauri/src/lib.rs`:
```rust
#[tauri::command]
#[specta::specta]
fn greet(name: &str) -> String {
    format!("Hello, {}!", name)
}
```

Usage in frontend:
```ts
import { commands, events } from "~/bindings";
await commands.greet("World");
```

### Path Aliases
- `~/*` maps to `src/*` (configured in tsconfig.json)

### Build Output
- Frontend builds to `.output/public` (static preset, SSR disabled)
- Tauri loads frontend from this directory in production

## Development Notes

- The dev server runs on port 1420 (strict port required by Tauri)
- SSR is disabled (`ssr: false` in app.config.ts)
- Mobile detection via `TAURI_ENV_PLATFORM` env var for HMR configuration
- `src-tauri/` directory is ignored by Vite watch
