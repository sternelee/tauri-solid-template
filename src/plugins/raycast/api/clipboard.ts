// ============================================================================
// Raycast Clipboard API Implementation
// ============================================================================
// Based on Raycast API specification for clipboard operations
// Integrated with Tauri clipboard-manager plugin

import {
  readText,
  writeText,
  clear,
} from "@tauri-apps/plugin-clipboard-manager";

export interface ClipboardContent {
  text?: string;
  html?: string;
  file?: string;
}

export class Clipboard {
  static async copy(
    content: string | number | ClipboardContent,
  ): Promise<void> {
    let normalizedContent: ClipboardContent;

    if (typeof content === "string" || typeof content === "number") {
      normalizedContent = { text: String(content) };
    } else {
      normalizedContent = content;
    }

    // Use Tauri clipboard-manager plugin
    if (normalizedContent.text) {
      try {
        await writeText(normalizedContent.text);
        console.log(`Clipboard copied: ${normalizedContent.text}`);
      } catch (error) {
        console.error("Failed to copy to clipboard:", error);
        throw new Error(`Clipboard copy failed: ${error.message}`);
      }
    }
  }

  static async paste(
    content: string | number | ClipboardContent,
  ): Promise<void> {
    let normalizedContent: ClipboardContent;

    if (typeof content === "string" || typeof content === "number") {
      normalizedContent = { text: String(content) };
    } else {
      normalizedContent = content;
    }

    // For Raycast, paste typically means copy the content to clipboard
    // then the user can paste it wherever they want
    await this.copy(normalizedContent);
  }

  static async clear(): Promise<void> {
    try {
      await clear();
      console.log("Clipboard cleared");
    } catch (error) {
      console.error("Failed to clear clipboard:", error);
      throw new Error(`Clipboard clear failed: ${error.message}`);
    }
  }

  static async read(): Promise<ClipboardContent> {
    try {
      const text = await this.readText();
      return { text };
    } catch (error) {
      console.error("Failed to read clipboard:", error);
      return { text: "" };
    }
  }

  static async readText(): Promise<string> {
    try {
      const text = await readText();
      console.log(
        "Clipboard read text:",
        text.length > 0 ? `${text.length} characters` : "empty",
      );
      return text;
    } catch (error) {
      console.error("Failed to read clipboard text:", error);
      return "";
    }
  }

  // Additional Raycast-specific methods
  static async readHTML(): Promise<string> {
    // Note: Tauri clipboard-manager doesn't support HTML directly
    // This would require a custom Tauri command
    try {
      console.log("HTML clipboard reading not yet implemented");
      return "";
    } catch (error) {
      console.error("Failed to read clipboard HTML:", error);
      return "";
    }
  }

  static async copyHTML(html: string): Promise<void> {
    // Note: Tauri clipboard-manager doesn't support HTML directly
    // This would require a custom Tauri command
    try {
      console.log("HTML clipboard copying not yet implemented");
    } catch (error) {
      console.error("Failed to copy HTML to clipboard:", error);
      throw new Error(`HTML clipboard copy failed: ${error.message}`);
    }
  }
}
