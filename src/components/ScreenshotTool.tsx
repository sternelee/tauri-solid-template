import { createSignal, onMount, For, Show, batch } from "solid-js";
import { invoke } from "@tauri-apps/api/core";
import { save, ask } from "@tauri-apps/plugin-dialog";

interface MonitorInfo {
  id: number;
  name: string;
  width: number;
  height: number;
  scale_factor: number;
  is_primary: boolean;
}

interface ScreenshotOptions {
  monitor_id?: number;
  region?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  format: "PNG" | "JPEG" | "BMP";
  quality?: number;
  save_to_file: boolean;
  output_path?: string;
}

interface ScreenshotResult {
  success: boolean;
  data?: string; // Base64 encoded image data
  file_path?: string;
  width: number;
  height: number;
  file_size?: number;
  error?: string;
}

interface RegionSelection {
  start_x: number;
  start_y: number;
  end_x: number;
  end_y: number;
}

export default function ScreenshotTool() {
  const [monitors, setMonitors] = createSignal<MonitorInfo[]>([]);
  const [selectedMonitor, setSelectedMonitor] = createSignal<
    number | undefined
  >();
  const [selectedFormat, setSelectedFormat] = createSignal<
    "PNG" | "JPEG" | "BMP"
  >("PNG");
  const [quality, setQuality] = createSignal<number>(90);
  const [saveToFile, setSaveToFile] = createSignal<boolean>(false);
  const [isCapturing, setIsCapturing] = createSignal<boolean>(false);
  const [lastScreenshot, setLastScreenshot] =
    createSignal<ScreenshotResult | null>(null);
  const [isSelectingRegion, setIsSelectingRegion] =
    createSignal<boolean>(false);
  const [selectedRegion, setSelectedRegion] = createSignal<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);

  onMount(async () => {
    await loadMonitors();
  });

  const loadMonitors = async () => {
    try {
      const monitorList = await invoke<MonitorInfo[]>("get_monitors");
      setMonitors(monitorList);

      // Select primary monitor by default
      const primaryMonitor = monitorList.find((m) => m.is_primary);
      if (primaryMonitor) {
        setSelectedMonitor(primaryMonitor.id);
      }
    } catch (error) {
      console.error("Failed to load monitors:", error);
    }
  };

  const captureFullScreen = async () => {
    setIsCapturing(true);
    try {
      const options: ScreenshotOptions = {
        monitor_id: selectedMonitor(),
        format: selectedFormat(),
        quality: selectedFormat() === "JPEG" ? quality() : undefined,
        save_to_file: saveToFile(),
      };

      if (saveToFile()) {
        const filePath = await save({
          defaultPath: `screenshot_${new Date().toISOString().replace(/[:.]/g, "-")}.${selectedFormat().toLowerCase()}`,
          filters: [
            {
              name: "Image files",
              extensions: [selectedFormat().toLowerCase()],
            },
          ],
        });

        if (filePath) {
          options.output_path = filePath;
        } else {
          setIsCapturing(false);
          return;
        }
      }

      const result = await invoke<ScreenshotResult>("take_screenshot", {
        options,
      });
      setLastScreenshot(result);

      if (result.success && result.data) {
        // Copy to clipboard
        await navigator.clipboard.writeText(result.data);

        // Show success notification
        if (saveToFile() && result.file_path) {
          showNotification(
            `Screenshot saved to ${result.file_path}`,
            "success",
          );
        } else {
          showNotification(
            "Screenshot captured and copied to clipboard",
            "success",
          );
        }
      } else {
        showNotification(
          result.error || "Failed to capture screenshot",
          "error",
        );
      }
    } catch (error) {
      console.error("Failed to capture screenshot:", error);
      showNotification("Failed to capture screenshot", "error");
    } finally {
      setIsCapturing(false);
    }
  };

  const startRegionSelection = async () => {
    setIsSelectingRegion(true);
    try {
      // Minimize the current window to allow region selection
      const selection = await invoke<RegionSelection>("start_region_selection");

      if (selection) {
        const region = {
          x: Math.min(selection.start_x, selection.end_x),
          y: Math.min(selection.start_y, selection.end_y),
          width: Math.abs(selection.end_x - selection.start_x),
          height: Math.abs(selection.end_y - selection.start_y),
        };

        setSelectedRegion(region);
        await captureRegion(region);
      }
    } catch (error) {
      console.error("Failed to start region selection:", error);
      showNotification("Failed to start region selection", "error");
    } finally {
      setIsSelectingRegion(false);
    }
  };

  const captureRegion = async (region: {
    x: number;
    y: number;
    width: number;
    height: number;
  }) => {
    setIsCapturing(true);
    try {
      const options: ScreenshotOptions = {
        region,
        format: selectedFormat(),
        quality: selectedFormat() === "JPEG" ? quality() : undefined,
        save_to_file: saveToFile(),
      };

      if (saveToFile()) {
        const filePath = await save({
          defaultPath: `screenshot_region_${new Date().toISOString().replace(/[:.]/g, "-")}.${selectedFormat().toLowerCase()}`,
          filters: [
            {
              name: "Image files",
              extensions: [selectedFormat().toLowerCase()],
            },
          ],
        });

        if (filePath) {
          options.output_path = filePath;
        } else {
          setIsCapturing(false);
          return;
        }
      }

      const result = await invoke<ScreenshotResult>("take_region_screenshot", {
        region,
        format: selectedFormat(),
        save_to_file: saveToFile(),
        output_path: options.output_path,
      });

      setLastScreenshot(result);

      if (result.success && result.data) {
        await navigator.clipboard.writeText(result.data);

        if (saveToFile() && result.file_path) {
          showNotification(
            `Region screenshot saved to ${result.file_path}`,
            "success",
          );
        } else {
          showNotification(
            "Region screenshot captured and copied to clipboard",
            "success",
          );
        }
      } else {
        showNotification(result.error || "Failed to capture region", "error");
      }
    } catch (error) {
      console.error("Failed to capture region:", error);
      showNotification("Failed to capture region", "error");
    } finally {
      setIsCapturing(false);
    }
  };

  const showNotification = (
    message: string,
    type: "success" | "error" | "info",
  ) => {
    // Create a simple notification (in a real app, you might want to use a proper notification library)
    const notification = document.createElement("div");
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 12px 20px;
      background: ${type === "success" ? "#10b981" : type === "error" ? "#ef4444" : "#3b82f6"};
      color: white;
      border-radius: 8px;
      font-family: system-ui, -apple-system, sans-serif;
      font-size: 14px;
      z-index: 10000;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      animation: slideIn 0.3s ease;
    `;
    notification.textContent = message;

    document.body.appendChild(notification);

    setTimeout(() => {
      notification.style.animation = "slideOut 0.3s ease";
      setTimeout(() => {
        document.body.removeChild(notification);
      }, 300);
    }, 3000);
  };

  const saveScreenshot = async () => {
    if (!lastScreenshot()?.data) return;

    try {
      const filePath = await save({
        defaultPath: `screenshot_${new Date().toISOString().replace(/[:.]/g, "-")}.${selectedFormat().toLowerCase()}`,
        filters: [
          {
            name: "Image files",
            extensions: [selectedFormat().toLowerCase()],
          },
        ],
      });

      if (filePath) {
        const success = await invoke<boolean>("save_screenshot_to_file", {
          imageData: lastScreenshot()!.data!.split(",")[1], // Remove data URL prefix
          filePath,
          format: selectedFormat(),
        });

        if (success) {
          showNotification(`Screenshot saved to ${filePath}`, "success");
        } else {
          showNotification("Failed to save screenshot", "error");
        }
      }
    } catch (error) {
      console.error("Failed to save screenshot:", error);
      showNotification("Failed to save screenshot", "error");
    }
  };

  return (
    <div
      style={{
        padding: "24px",
        "max-width": "800px",
        margin: "0 auto",
        "font-family":
          "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
      }}
    >
      <style>{`
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideOut {
          from { transform: translateX(0); opacity: 1; }
          to { transform: translateX(100%); opacity: 0; }
        }
      `}</style>

      <div style={{ "margin-bottom": "24px" }}>
        <h2
          style={{
            margin: "0 0 8px 0",
            "font-size": "24px",
            "font-weight": "600",
            color: "#1f2937",
          }}
        >
          📸 Screenshot Tool
        </h2>
        <p style={{ margin: 0, color: "#6b7280", "font-size": "14px" }}>
          Capture screenshots of your entire screen or selected regions
        </p>
      </div>

      {/* Monitor Selection */}
      <div style={{ "margin-bottom": "20px" }}>
        <label
          style={{
            display: "block",
            "font-weight": "500",
            "margin-bottom": "8px",
            color: "#374151",
          }}
        >
          Monitor:
        </label>
        <select
          value={selectedMonitor()}
          onChange={(e) => setSelectedMonitor(parseInt(e.target.value))}
          style={{
            width: "100%",
            padding: "8px 12px",
            border: "1px solid #d1d5db",
            "border-radius": "6px",
            "font-size": "14px",
            background: "white",
          }}
        >
          <For each={monitors()}>
            {(monitor) => (
              <option value={monitor.id}>
                {monitor.name} ({monitor.width}×{monitor.height}){" "}
                {monitor.is_primary ? "[Primary]" : ""}
              </option>
            )}
          </For>
        </select>
      </div>

      {/* Format Selection */}
      <div style={{ "margin-bottom": "20px" }}>
        <label
          style={{
            display: "block",
            "font-weight": "500",
            "margin-bottom": "8px",
            color: "#374151",
          }}
        >
          Format:
        </label>
        <div style={{ display: "flex", gap: "8px" }}>
          {(["PNG", "JPEG", "BMP"] as const).map((format) => (
            <button
              key={format}
              onClick={() => setSelectedFormat(format)}
              style={{
                padding: "8px 16px",
                border:
                  selectedFormat() === format
                    ? "2px solid #3b82f6"
                    : "1px solid #d1d5db",
                "border-radius": "6px",
                background: selectedFormat() === format ? "#eff6ff" : "white",
                color: selectedFormat() === format ? "#3b82f6" : "#374151",
                cursor: "pointer",
                "font-size": "14px",
                "font-weight": selectedFormat() === format ? "500" : "400",
                transition: "all 0.15s ease",
              }}
            >
              {format}
            </button>
          ))}
        </div>
      </div>

      {/* Quality Setting (for JPEG) */}
      <Show when={selectedFormat() === "JPEG"}>
        <div style={{ "margin-bottom": "20px" }}>
          <label
            style={{
              display: "block",
              "font-weight": "500",
              "margin-bottom": "8px",
              color: "#374151",
            }}
          >
            Quality: {quality()}%
          </label>
          <input
            type="range"
            min="10"
            max="100"
            value={quality()}
            onInput={(e) => setQuality(parseInt(e.target.value))}
            style={{
              width: "100%",
              height: "4px",
              "border-radius": "2px",
              background: "#e5e7eb",
              outline: "none",
              "-webkit-appearance": "none",
            }}
          />
        </div>
      </Show>

      {/* Save to File Option */}
      <div style={{ "margin-bottom": "24px" }}>
        <label
          style={{
            display: "flex",
            "align-items": "center",
            gap: "8px",
            cursor: "pointer",
          }}
        >
          <input
            type="checkbox"
            checked={saveToFile()}
            onChange={(e) => setSaveToFile(e.target.checked)}
            style={{ margin: 0 }}
          />
          <span style={{ "font-weight": "500", color: "#374151" }}>
            Save to file (in addition to clipboard)
          </span>
        </label>
      </div>

      {/* Action Buttons */}
      <div style={{ display: "flex", gap: "12px", "margin-bottom": "24px" }}>
        <button
          onClick={captureFullScreen}
          disabled={isCapturing()}
          style={{
            flex: 1,
            padding: "12px 20px",
            background: isCapturing() ? "#9ca3af" : "#3b82f6",
            color: "white",
            border: "none",
            "border-radius": "8px",
            "font-size": "14px",
            "font-weight": "500",
            cursor: isCapturing() ? "not-allowed" : "pointer",
            transition: "all 0.15s ease",
          }}
        >
          {isCapturing() ? "⏳ Capturing..." : "📷 Full Screen"}
        </button>

        <button
          onClick={startRegionSelection}
          disabled={isCapturing() || isSelectingRegion()}
          style={{
            flex: 1,
            padding: "12px 20px",
            background:
              isCapturing() || isSelectingRegion() ? "#9ca3af" : "#10b981",
            color: "white",
            border: "none",
            "border-radius": "8px",
            "font-size": "14px",
            "font-weight": "500",
            cursor:
              isCapturing() || isSelectingRegion() ? "not-allowed" : "pointer",
            transition: "all 0.15s ease",
          }}
        >
          {isSelectingRegion() ? "🎯 Selecting..." : "📐 Select Region"}
        </button>
      </div>

      {/* Selected Region Display */}
      <Show when={selectedRegion()}>
        <div
          style={{
            padding: "12px",
            background: "#f3f4f6",
            "border-radius": "6px",
            "margin-bottom": "20px",
            "font-size": "14px",
            color: "#374151",
          }}
        >
          <strong>Selected Region:</strong> {selectedRegion()?.x},{" "}
          {selectedRegion()?.y}({selectedRegion()?.width}×
          {selectedRegion()?.height}px)
        </div>
      </Show>

      {/* Last Screenshot Preview */}
      <Show when={lastScreenshot() && lastScreenshot()?.success}>
        <div
          style={{
            "margin-top": "24px",
            padding: "20px",
            background: "#f9fafb",
            border: "1px solid #e5e7eb",
            "border-radius": "8px",
          }}
        >
          <h3
            style={{
              margin: "0 0 12px 0",
              "font-size": "16px",
              "font-weight": "600",
              color: "#1f2937",
            }}
          >
            Last Screenshot
          </h3>

          <div
            style={{
              display: "flex",
              gap: "12px",
              "align-items": "center",
              "margin-bottom": "12px",
            }}
          >
            <span style={{ "font-size": "14px", color: "#6b7280" }}>
              Dimensions: {lastScreenshot()?.width}×{lastScreenshot()?.height}px
            </span>
            <Show when={lastScreenshot()?.file_size}>
              <span style={{ "font-size": "14px", color: "#6b7280" }}>
                • Size: {Math.round((lastScreenshot()?.file_size || 0) / 1024)}
                KB
              </span>
            </Show>
          </div>

          <Show when={lastScreenshot()?.data}>
            <img
              src={lastScreenshot()?.data}
              alt="Screenshot"
              style={{
                width: "100%",
                "max-width": "600px",
                height: "auto",
                border: "1px solid #d1d5db",
                "border-radius": "4px",
                "margin-bottom": "12px",
              }}
            />
          </Show>

          <Show when={!saveToFile() && lastScreenshot()?.data}>
            <button
              onClick={saveScreenshot}
              style={{
                padding: "8px 16px",
                background: "#6366f1",
                color: "white",
                border: "none",
                "border-radius": "6px",
                "font-size": "14px",
                "font-weight": "500",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              💾 Save to File
            </button>
          </Show>
        </div>
      </Show>

      {/* Error Display */}
      <Show when={lastScreenshot() && !lastScreenshot()?.success}>
        <div
          style={{
            "margin-top": "24px",
            padding: "16px",
            background: "#fef2f2",
            border: "1px solid #fecaca",
            "border-radius": "6px",
            color: "#dc2626",
            "font-size": "14px",
          }}
        >
          <strong>Error:</strong> {lastScreenshot()?.error}
        </div>
      </Show>
    </div>
  );
}
