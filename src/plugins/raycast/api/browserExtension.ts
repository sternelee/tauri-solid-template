// ============================================================================
// Raycast Browser Extension API Implementation
// ============================================================================
// Based on Raycast API specification for browser extension interactions

export interface Tab {
  active: boolean;
  id: number;
  url: string;
  favicon?: string;
  title?: string;
}

export interface GetContentOptions {
  cssSelector?: string;
  tabId?: number;
  format?: "html" | "text" | "markdown";
}

export class BrowserExtension {
  static async getTabs(): Promise<Tab[]> {
    // Implementation would communicate with browser extension
    console.log("Getting browser tabs");
    return [
      {
        active: true,
        id: 1,
        url: "https://example.com",
        title: "Example Page",
        favicon: "https://example.com/favicon.ico",
      },
    ];
  }

  static async getContent(options?: GetContentOptions): Promise<string> {
    // Implementation would extract content from browser tab
    console.log(
      `Getting content from browser tab: ${options?.tabId || "active"}`,
    );
    return "<html><body>Example content</body></html>";
  }
}

