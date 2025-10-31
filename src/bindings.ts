// Manual TypeScript bindings for Tauri commands
// This file provides type definitions for Tauri commands since automatic export is disabled

// Basic command types
export type SystemInfo = {
  os: string;
  arch: string;
};

export type CommandResult<T = any> = {
  status: "ok" | "error";
  data?: T;
  error?: string;
};

// Application types
export type Application = {
  name: string;
  bundle_id: string;
  path?: string;
  icon?: string;
};

// Search types
export type SearchOptions = {
  pattern: string;
  max_results: number;
  file_extensions: string[] | null;
  include_hidden: boolean;
};

export type SearchResult = {
  path: string;
  line_number?: number;
  content?: string;
  file_type: string;
};

// MCP types
export type McpServerConfig = {
  id: string;
  name: string;
  command: string;
  args: string[];
  env?: Record<string, string>;
  enabled: boolean;
};

export type McpTool = {
  name: string;
  description: string;
  input_schema: any;
  server_id: string;
};

// AI Agent types (simplified for BigInt compatibility)
export type ChatMessage = {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp?: number;
};

export type ChatRequest = {
  conversation_id: string;
  message: ChatMessage;
  stream?: boolean;
};

export type ChatResponse = {
  message: ChatMessage;
  conversation_id: string;
  finished: boolean;
};

// Tauri commands interface
export interface Commands {
  // System commands
  greet: (name: string) => Promise<string>;
  executeCommand: (command: string, args: string[]) => Promise<string>;
  getSystemInfo: () => Promise<SystemInfo>;

  // Window management
  toggleWindowVisibility: () => Promise<void>;
  hideWindow: () => Promise<void>;

  // Applications
  getApplications: () => Promise<CommandResult<Application[]>>;
  getFrontmostApp: () => Promise<CommandResult<Application>>;
  getAppIconDataUrl: (icon: string | null) => Promise<CommandResult<string>>;

  // Search
  searchFiles: (
    options: SearchOptions,
    windowId: string | null,
  ) => Promise<CommandResult<SearchResult[]>>;

  // AI System
  getAgentStatus: () => Promise<
    CommandResult<{ status: string; message: string }>
  >;
  initializeAiSystem: () => Promise<CommandResult<string>>;
  sendChatMessage: (
    request: ChatRequest,
  ) => Promise<CommandResult<ChatResponse>>;

  // Settings
  openSettingsWindow: () => Promise<CommandResult<void>>;
}

// Import the actual commands from Tauri API
import * as Tauri from "@tauri-apps/api/core";

// Create a proxy that forwards calls to Tauri commands
const commands = new Proxy({} as Commands, {
  get(_, prop: keyof Commands) {
    return async (...args: any[]) => {
      try {
        return await Tauri.invoke(prop, args);
      } catch (error) {
        console.error(`Command ${prop} failed:`, error);
        throw error;
      }
    };
  },
});

export default commands;

