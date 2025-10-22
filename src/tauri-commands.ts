import { invoke } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import { readDir, readFile, writeFile, exists } from "@tauri-apps/plugin-fs";
import { arch, platform, version } from "@tauri-apps/plugin-os";
import { sendNotification } from "@tauri-apps/plugin-notification";
import { Store } from "@tauri-apps/plugin-store";
import { register, unregister } from "@tauri-apps/plugin-global-shortcut";
import { readText, writeText } from "tauri-plugin-clipboard-x-api";

// Application types
export interface Application {
  name: string;
  bundle_id: string;
  path: string;
  url?: string;
  icon?: string;
}

// Manual Tauri command wrappers
export const tauriCommands = {
  // Open external URL using frontend opener plugin
  async openUrl(url: string): Promise<void> {
  return await openUrl(url);
  },

  // Execute shell command
  async executeCommand(command: string, args: string[]): Promise<string> {
    return await invoke("execute_command", { command, args });
  },

  // Get system info
  async getSystemInfo(): Promise<{ os: string; arch: string }> {
    return await invoke("get_system_info");
  },

  // Applications commands
  async getApplications(): Promise<Application[]> {
    return await invoke("get_applications");
  },

  async refreshApplicationsList(): Promise<void> {
    return await invoke("refresh_applications_list");
  },

  async refreshApplicationsListInBackground(): Promise<void> {
    return await invoke("refresh_applications_list_in_bg");
  },

  async getFrontmostApp(): Promise<Application> {
    return await invoke("get_frontmost_app");
  },

  async hideAllAppsExceptFrontmost(): Promise<void> {
    return await invoke("hide_all_apps_except_frontmost");
  },

  async getAppIconDataUrl(iconPath: string | null): Promise<string | null> {
    return await invoke("get_app_icon_data_url", { iconPath });
  },

  // Launch application using shell command
  async launchApplication(appPath: string): Promise<string> {
  if (navigator.platform.includes("Mac")) {
  return await this.executeCommand("open", ["-a", appPath]);
  } else if (navigator.platform.includes("Win")) {
  return await this.executeCommand("start", ["", appPath]);
  } else {
  return await this.executeCommand(appPath, []);
  }
  },

  // File system operations
  async readDirectory(path: string) {
    return await readDir(path);
  },

  async readFile(path: string) {
    return await readFile(path);
  },

  async writeFile(path: string, contents: Uint8Array) {
    return await writeFile(path, contents);
  },

  async fileExists(path: string) {
    return await exists(path);
  },

  // OS information
  async getArch() {
    return await arch();
  },

  async getPlatform() {
    return await platform();
  },

  async getOsVersion() {
    return await version();
  },

  // Notifications
  async sendNotification(options: { title: string; body?: string }) {
    return await sendNotification(options);
  },

  // Store operations
  async createStore(path: string) {
    return new Store(path);
  },

  // Global shortcuts
  async registerGlobalShortcut(shortcut: string, handler: () => void) {
    return await register(shortcut, handler);
  },

  async unregisterGlobalShortcut(shortcut: string) {
    return await unregister(shortcut);
  },

  // Clipboard operations
  async readClipboardText() {
    return await readText();
  },

  async writeClipboardText(text: string) {
    return await writeText(text);
  },

  // Plugin window management
  async createPluginWindow(windowId: string, config: any) {
    return await invoke("create_plugin_window", { windowId, config });
  },

  async updatePluginWindow(windowId: string, config: any) {
    return await invoke("update_plugin_window", { windowId, config });
  },

  async closePluginWindow(windowId: string) {
    return await invoke("close_plugin_window", { windowId });
  },

  async focusPluginWindow(windowId: string) {
    return await invoke("focus_plugin_window", { windowId });
  },

  async setWindowFullscreen(windowId: string, fullscreen: boolean) {
    return await invoke("set_window_fullscreen", { windowId, fullscreen });
  },

  // Permission management
  async requestScreenshotPermission() {
    return await invoke("request_screenshot_permission");
  },
};

export type SystemInfo = {
  os: string;
  arch: string;
};