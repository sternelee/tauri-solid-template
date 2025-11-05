export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
  context?: {
    apps?: Array<{ name: string; bundleId: string }>;
    files?: Array<{ path: string; type: string }>;
  };
  metadata?: {
    provider?: string;
    model?: string;
    tokens?: number;
  };
}

export interface AIProvider {
  id: string;
  name: string;
  models: string[];
  icon: string;
  description?: string;
  apiKey?: string;
  enabled?: boolean;
}

export interface MentionItem {
  type: "app" | "file" | "provider";
  id: string;
  title: string;
  subtitle?: string;
  icon: string;
  data: any;
}

export interface EditorConfig {
  provider: AIProvider;
  model: string;
  theme: "dark" | "light";
  autosave: boolean;
  fontSize: number;
  fontFamily: string;
}

export interface ConversationContext {
  apps?: string[];
  files?: string[];
  provider?: string;
  model?: string;
}

export interface AISuggestion {
  type: "completion" | "edit" | "insert" | "format";
  content: string;
  range?: { from: number; to: number };
  description?: string;
}

export interface FileSearchResult {
  path: string;
  name: string;
  file_type: string;
  size: number;
  modified: Date;
  content_preview?: string;
}

export interface SystemApp {
  name: string;
  bundle_id: string;
  path: string;
  icon: string;
  last_used: Date;
  usage_count: number;
}

export interface Conversation {
  id: string;
  title?: string;
  provider: string;
  model: string;
  created_at: Date;
  updated_at: Date;
  message_count: number;
}

export interface ToolExecution {
  id: string;
  tool_name: string;
  inputs: any;
  output?: any;
  status: "pending" | "running" | "completed" | "failed";
  error?: string;
  start_time: Date;
  end_time?: Date;
}
