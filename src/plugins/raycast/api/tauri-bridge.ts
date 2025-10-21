// ============================================================================
// Raycast Tauri Bridge
// ============================================================================
// Bridge between Raycast API and Tauri system capabilities

import { invoke } from "@tauri-apps/api/core";
import { platform } from "@tauri-apps/plugin-os";
import { openUrl } from "@tauri-apps/plugin-opener";
import { sendNotification } from "@tauri-apps/plugin-notification";
import {
  readText,
  writeText,
  clear as clearClipboard,
} from "@tauri-apps/plugin-clipboard-manager";

// ============================================================================
// System Information Bridge
// ============================================================================

export interface SystemInfo {
  platform: string;
  arch: string;
  version: string;
  hostname?: string;
  username?: string;
}

export interface ApplicationInfo {
  name: string;
  bundleId?: string;
  path: string;
  pid?: number;
}

export class SystemBridge {
  /**
   * Get system information
   */
  static async getSystemInfo(): Promise<SystemInfo> {
    try {
      const sysInfo = await invoke<SystemInfo>("get_system_info");
      return {
        platform: platform(),
        arch: sysInfo.arch || "unknown",
        version: sysInfo.version || "unknown",
        hostname: sysInfo.hostname,
        username: sysInfo.username,
      };
    } catch (error) {
      console.error("Failed to get system info:", error);
      return {
        platform: platform(),
        arch: "unknown",
        version: "unknown",
      };
    }
  }

  /**
   * Get running applications
   */
  static async getRunningApplications(): Promise<ApplicationInfo[]> {
    try {
      return await invoke<ApplicationInfo[]>("get_running_applications");
    } catch (error) {
      console.error("Failed to get running applications:", error);
      return [];
    }
  }

  /**
   * Get frontmost application
   */
  static async getFrontmostApplication(): Promise<ApplicationInfo | null> {
    try {
      return await invoke<ApplicationInfo>("get_frontmost_application");
    } catch (error) {
      console.error("Failed to get frontmost application:", error);
      return null;
    }
  }

  /**
   * Show application in Finder/Explorer
   */
  static async showInFinder(path: string): Promise<void> {
    try {
      await invoke("show_in_finder", { path });
    } catch (error) {
      console.error("Failed to show in finder:", error);
      throw new Error(`Failed to show ${path} in finder: ${error.message}`);
    }
  }

  /**
   * Move files/folders to trash
   */
  static async moveToTrash(paths: string | string[]): Promise<void> {
    try {
      await invoke("move_to_trash", {
        paths: Array.isArray(paths) ? paths : [paths],
      });
    } catch (error) {
      console.error("Failed to move to trash:", error);
      throw new Error(`Failed to move to trash: ${error.message}`);
    }
  }

  /**
   * Get selected text from frontmost application
   */
  static async getSelectedText(): Promise<string> {
    try {
      return await invoke<string>("get_selected_text");
    } catch (error) {
      console.error("Failed to get selected text:", error);
      return "";
    }
  }

  /**
   * Get selected finder items
   */
  static async getSelectedFinderItems(): Promise<string[]> {
    try {
      return await invoke<string[]>("get_selected_finder_items");
    } catch (error) {
      console.error("Failed to get selected finder items:", error);
      return [];
    }
  }
}

// ============================================================================
// Application Bridge
// ============================================================================

export interface OpenOptions {
  application?: string;
  waitFor?: boolean;
}

export class ApplicationBridge {
  /**
   * Open URL or file
   */
  static async open(target: string, options?: OpenOptions): Promise<void> {
    try {
      if (target.startsWith("http://") || target.startsWith("https://")) {
        await openUrl(target);
      } else {
        await invoke("open_with", {
          target,
          application: options?.application,
        });
      }
    } catch (error) {
      console.error("Failed to open:", target, error);
      throw new Error(`Failed to open ${target}: ${error.message}`);
    }
  }

  /**
   * Get applications by file extension
   */
  static async getApplicationsForExtension(
    extension: string,
  ): Promise<ApplicationInfo[]> {
    try {
      return await invoke<ApplicationInfo[]>("get_applications_for_extension", {
        extension,
      });
    } catch (error) {
      console.error("Failed to get applications for extension:", error);
      return [];
    }
  }

  /**
   * Get default application for file extension
   */
  static async getDefaultApplicationForExtension(
    extension: string,
  ): Promise<ApplicationInfo | null> {
    try {
      return await invoke<ApplicationInfo>(
        "get_default_application_for_extension",
        { extension },
      );
    } catch (error) {
      console.error("Failed to get default application for extension:", error);
      return null;
    }
  }
}

// ============================================================================
// Notification Bridge
// ============================================================================

export interface NotificationOptions {
  title: string;
  body?: string;
  icon?: string;
  sound?: string;
}

export class NotificationBridge {
  /**
   * Send system notification
   */
  static async send(options: NotificationOptions): Promise<void> {
    try {
      await sendNotification({
        title: options.title,
        body: options.body,
        icon: options.icon,
      });
    } catch (error) {
      console.error("Failed to send notification:", error);
      // Fallback to Tauri command
      try {
        await invoke("send_notification", options);
      } catch (fallbackError) {
        console.error("Fallback notification failed:", fallbackError);
      }
    }
  }

  /**
   * Request notification permissions
   */
  static async requestPermission(): Promise<boolean> {
    try {
      return await invoke<boolean>("request_notification_permission");
    } catch (error) {
      console.error("Failed to request notification permission:", error);
      return false;
    }
  }
}

// ============================================================================
// Clipboard Bridge
// ============================================================================

export class ClipboardBridge {
  /**
   * Write text to clipboard
   */
  static async writeText(text: string): Promise<void> {
    try {
      await writeText(text);
    } catch (error) {
      console.error("Failed to write to clipboard:", error);
      throw new Error(`Failed to write to clipboard: ${error.message}`);
    }
  }

  /**
   * Read text from clipboard
   */
  static async readText(): Promise<string> {
    try {
      return await readText();
    } catch (error) {
      console.error("Failed to read from clipboard:", error);
      return "";
    }
  }

  /**
   * Clear clipboard
   */
  static async clear(): Promise<void> {
    try {
      await clearClipboard();
    } catch (error) {
      console.error("Failed to clear clipboard:", error);
      throw new Error(`Failed to clear clipboard: ${error.message}`);
    }
  }

  /**
   * Write HTML to clipboard (requires custom command)
   */
  static async writeHTML(html: string): Promise<void> {
    try {
      await invoke("write_html_to_clipboard", { html });
    } catch (error) {
      console.error("Failed to write HTML to clipboard:", error);
      throw new Error(`Failed to write HTML to clipboard: ${error.message}`);
    }
  }

  /**
   * Read HTML from clipboard (requires custom command)
   */
  static async readHTML(): Promise<string> {
    try {
      return await invoke<string>("read_html_from_clipboard");
    } catch (error) {
      console.error("Failed to read HTML from clipboard:", error);
      return "";
    }
  }
}

// ============================================================================
// File System Bridge
// ============================================================================

export interface FileInfo {
  path: string;
  name: string;
  size: number;
  isDirectory: boolean;
  isFile: boolean;
  createdAt?: Date;
  modifiedAt?: Date;
}

export class FileSystemBridge {
  /**
   * Read file content
   */
  static async readFile(path: string): Promise<string> {
    try {
      return await invoke<string>("read_file", { path });
    } catch (error) {
      console.error("Failed to read file:", error);
      throw new Error(`Failed to read file ${path}: ${error.message}`);
    }
  }

  /**
   * Write file content
   */
  static async writeFile(path: string, content: string): Promise<void> {
    try {
      await invoke("write_file", { path, content });
    } catch (error) {
      console.error("Failed to write file:", error);
      throw new Error(`Failed to write file ${path}: ${error.message}`);
    }
  }

  /**
   * List directory contents
   */
  static async listDirectory(path: string): Promise<FileInfo[]> {
    try {
      return await invoke<FileInfo[]>("list_directory", { path });
    } catch (error) {
      console.error("Failed to list directory:", error);
      throw new Error(`Failed to list directory ${path}: ${error.message}`);
    }
  }

  /**
   * Check if path exists
   */
  static async exists(path: string): Promise<boolean> {
    try {
      return await invoke<boolean>("path_exists", { path });
    } catch (error) {
      console.error("Failed to check path existence:", error);
      return false;
    }
  }

  /**
   * Create directory
   */
  static async createDirectory(
    path: string,
    recursive?: boolean,
  ): Promise<void> {
    try {
      await invoke("create_directory", { path, recursive: recursive ?? false });
    } catch (error) {
      console.error("Failed to create directory:", error);
      throw new Error(`Failed to create directory ${path}: ${error.message}`);
    }
  }
}

// ============================================================================
// AI/Network Bridge
// ============================================================================

export interface AIRequest {
  prompt: string;
  model?: string;
  creativity?: number;
  stream?: boolean;
}

export interface AIResponse {
  content: string;
  model: string;
  tokensUsed?: number;
}

export class AIBridge {
  /**
   * Make AI request
   */
  static async ask(request: AIRequest): Promise<AIResponse> {
    try {
      return await invoke<AIResponse>("ai_ask", request);
    } catch (error) {
      console.error("Failed to make AI request:", error);
      throw new Error(`AI request failed: ${error.message}`);
    }
  }

  /**
   * Stream AI response
   */
  static async askStream(
    request: AIRequest,
    onChunk: (chunk: string) => void,
    onComplete: (fullText: string) => void,
    onError: (error: Error) => void,
  ): Promise<void> {
    try {
      await invoke("ai_ask_stream", {
        ...request,
        onSuccess: onChunk,
        onComplete,
        onError: onError.toString(),
      });
    } catch (error) {
      console.error("Failed to start AI stream:", error);
      onError(new Error(`AI stream failed: ${error.message}`));
    }
  }
}

// ============================================================================
// Utility Bridge
// ============================================================================

export class UtilityBridge {
  /**
   * Execute shell command
   */
  static async executeCommand(
    command: string,
    args?: string[],
  ): Promise<string> {
    try {
      return await invoke<string>("execute_command", {
        command,
        args: args || [],
      });
    } catch (error) {
      console.error("Failed to execute command:", error);
      throw new Error(`Command execution failed: ${error.message}`);
    }
  }

  /**
   * Get environment variable
   */
  static async getEnvVar(key: string): Promise<string | undefined> {
    try {
      return await invoke<string | undefined>("get_env_var", { key });
    } catch (error) {
      console.error("Failed to get environment variable:", error);
      return undefined;
    }
  }

  /**
   * Set environment variable
   */
  static async setEnvVar(key: string, value: string): Promise<void> {
    try {
      await invoke("set_env_var", { key, value });
    } catch (error) {
      console.error("Failed to set environment variable:", error);
      throw new Error(`Failed to set environment variable: ${error.message}`);
    }
  }
}

// ============================================================================
// Main Bridge Export
// ============================================================================

export const RaycastTauriBridge = {
  System: SystemBridge,
  Application: ApplicationBridge,
  Notification: NotificationBridge,
  Clipboard: ClipboardBridge,
  FileSystem: FileSystemBridge,
  AI: AIBridge,
  Utility: UtilityBridge,
};

export default RaycastTauriBridge;

