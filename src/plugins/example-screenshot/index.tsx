import { definePlugin, getCurrentPluginSDK } from "../PluginSDK";
import { tauriCommands } from "../../tauri-commands";

// Screenshot UI Component
function ScreenshotUI() {
  const sdk = getCurrentPluginSDK();

  const startScreenshot = async () => {
    if (!sdk) {
      console.error("SDK not available");
      return;
    }

    try {
      // Request permission first
      const hasPermission = await tauriCommands.requestScreenshotPermission();
      if (!hasPermission) {
        sdk.showHUD("Screenshot permission denied");
        return;
      }

      // Set window to fullscreen mode
      sdk.setWindowMode("fullscreen");
      sdk.showHUD("Screenshot mode activated. Press Esc to exit.");

      // In a real implementation, this would capture the screen
      // For demo purposes, we'll simulate it
      setTimeout(() => {
        sdk.showHUD("Screenshot captured!");
        sdk.setWindowMode("normal");
      }, 2000);
    } catch (error) {
      console.error("Screenshot failed:", error);
      sdk.showHUD("Screenshot failed");
    }
  };

  const cancelScreenshot = () => {
    if (!sdk) return;
    sdk.setWindowMode("normal");
    sdk.closeWindow();
  };

  return (
    <div class="screenshot-plugin">
      <div class="screenshot-header">
        <h3>Screenshot Tool</h3>
        <p>Capture your screen with ease</p>
      </div>

      <div class="screenshot-controls">
        <button class="screenshot-btn primary" onClick={startScreenshot}>
          📸 Take Screenshot
        </button>
        <button class="screenshot-btn secondary" onClick={cancelScreenshot}>
          Cancel
        </button>
      </div>

      <div class="screenshot-info">
        <p>
          💡 Tip: Press <kbd>Esc</kbd> anytime to exit screenshot mode
        </p>
      </div>

      <style jsx>{`
        .screenshot-plugin {
          padding: 20px;
          max-width: 400px;
          font-family:
            -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        }

        .screenshot-header {
          text-align: center;
          margin-bottom: 24px;
        }

        .screenshot-header h3 {
          margin: 0 0 8px 0;
          color: #1f2937;
          font-size: 18px;
          font-weight: 600;
        }

        .screenshot-header p {
          margin: 0;
          color: #6b7280;
          font-size: 14px;
        }

        .screenshot-controls {
          display: flex;
          gap: 12px;
          margin-bottom: 20px;
        }

        .screenshot-btn {
          flex: 1;
          padding: 12px 16px;
          border: none;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .screenshot-btn.primary {
          background: #3b82f6;
          color: white;
        }

        .screenshot-btn.primary:hover {
          background: #2563eb;
        }

        .screenshot-btn.secondary {
          background: #f3f4f6;
          color: #374151;
        }

        .screenshot-btn.secondary:hover {
          background: #e5e7eb;
        }

        .screenshot-info {
          padding: 12px;
          background: #f8fafc;
          border-radius: 6px;
          border-left: 3px solid #3b82f6;
        }

        .screenshot-info p {
          margin: 0;
          font-size: 13px;
          color: #475569;
        }

        kbd {
          background: #e2e8f0;
          border-radius: 3px;
          padding: 2px 6px;
          font-size: 11px;
          font-weight: 500;
          color: #475569;
        }
      `}</style>
    </div>
  );
}

// Plugin definition
export default definePlugin(
  {
    id: "screenshot",
    name: "Screenshot Tool",
    version: "1.0.0",
    description: "Capture screenshots with ease",
    author: "Raycast Team",
    permissions: [
      {
        type: "screen-capture" as const,
        description: "Access to capture screen content",
      },
    ],
  },
  [
    {
      id: "take-screenshot",
      title: "Take Screenshot",
      description: "Capture the current screen",
      keywords: ["screenshot", "capture", "screen"],
      shortcut: "Cmd+Shift+3",
      icon: "📸",
      action: async () => {
        console.log("Taking screenshot...");
        // Plugin activation will handle the UI mounting
      },
    },
    {
      id: "screenshot-area",
      title: "Screenshot Area",
      description: "Select and capture a specific area",
      keywords: ["screenshot", "area", "select"],
      shortcut: "Cmd+Shift+4",
      icon: "✂️",
      action: async () => {
        console.log("Selecting screenshot area...");
      },
    },
  ],
  ScreenshotUI,
);
