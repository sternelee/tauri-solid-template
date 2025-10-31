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
    const bgColors = {
      success: "bg-green-500",
      error: "bg-red-500",
      info: "bg-blue-500",
    };

    notification.className = `fixed top-5 right-5 px-5 py-3 ${bgColors[type]} text-white rounded-lg font-sans text-sm z-[10000] shadow-lg animate-slide-in`;
    notification.textContent = message;

    document.body.appendChild(notification);

    setTimeout(() => {
      notification.classList.remove("animate-slide-in");
      notification.classList.add("animate-slide-out");
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
    <div class="mx-auto max-w-2xl p-6 font-sans">
      <div class="mb-6">
        <h2 class="m-0 mb-2 text-2xl font-semibold text-gray-800">
          📸 Screenshot Tool
        </h2>
        <p class="m-0 text-sm text-gray-500">
          Capture screenshots of your entire screen or selected regions
        </p>
      </div>

      {/* Monitor Selection */}
      <div class="mb-5">
        <label class="mb-2 block font-medium text-gray-700">Monitor:</label>
        <select
          value={selectedMonitor()}
          onChange={(e) => setSelectedMonitor(parseInt(e.target.value))}
          class="w-full rounded-md border border-gray-300 bg-white p-2 text-sm"
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
      <div class="mb-5">
        <label class="mb-2 block font-medium text-gray-700">Format:</label>
        <div class="flex gap-2">
          {(["PNG", "JPEG", "BMP"] as const).map((format) => (
            <button
              key={format}
              onClick={() => setSelectedFormat(format)}
              class={`cursor-pointer rounded-md border px-4 py-2 text-sm transition-all ${
                selectedFormat() === format
                  ? "border-2 border-blue-500 bg-blue-50 font-medium text-blue-500"
                  : "border border-gray-300 bg-white font-normal text-gray-700"
              }`}
            >
              {format}
            </button>
          ))}
        </div>
      </div>

      {/* Quality Setting (for JPEG) */}
      <Show when={selectedFormat() === "JPEG"}>
        <div class="mb-5">
          <label class="mb-2 block font-medium text-gray-700">
            Quality: {quality()}%
          </label>
          <input
            type="range"
            min="10"
            max="100"
            value={quality()}
            onInput={(e) => setQuality(parseInt(e.target.value))}
            class="h-1 w-full appearance-none rounded-md bg-gray-200 outline-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-blue-500"
          />
        </div>
      </Show>

      {/* Save to File Option */}
      <div class="mb-6">
        <label class="flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={saveToFile()}
            onChange={(e) => setSaveToFile(e.target.checked)}
            class="m-0"
          />
          <span class="font-medium text-gray-700">
            Save to file (in addition to clipboard)
          </span>
        </label>
      </div>

      {/* Action Buttons */}
      <div class="mb-6 flex gap-3">
        <button
          onClick={captureFullScreen}
          disabled={isCapturing()}
          class={`flex-1 rounded-lg border-none px-5 py-3 text-sm font-medium transition-all ${
            isCapturing()
              ? "cursor-not-allowed bg-gray-400 text-white"
              : "cursor-pointer bg-blue-500 text-white hover:bg-blue-600"
          }`}
        >
          {isCapturing() ? "⏳ Capturing..." : "📷 Full Screen"}
        </button>

        <button
          onClick={startRegionSelection}
          disabled={isCapturing() || isSelectingRegion()}
          class={`flex-1 rounded-lg border-none px-5 py-3 text-sm font-medium transition-all ${
            isCapturing() || isSelectingRegion()
              ? "cursor-not-allowed bg-gray-400 text-white"
              : "cursor-pointer bg-green-500 text-white hover:bg-green-600"
          }`}
        >
          {isSelectingRegion() ? "🎯 Selecting..." : "📐 Select Region"}
        </button>
      </div>

      {/* Selected Region Display */}
      <Show when={selectedRegion()}>
        <div class="mb-5 rounded-md bg-gray-100 p-3 text-sm text-gray-700">
          <strong>Selected Region:</strong> {selectedRegion()?.x},{" "}
          {selectedRegion()?.y}({selectedRegion()?.width}×
          {selectedRegion()?.height}px)
        </div>
      </Show>

      {/* Last Screenshot Preview */}
      <Show when={lastScreenshot() && lastScreenshot()?.success}>
        <div class="mt-6 rounded-lg border border-gray-200 bg-gray-50 p-5">
          <h3 class="m-0 mb-3 text-base font-semibold text-gray-800">
            Last Screenshot
          </h3>

          <div class="mb-3 flex items-center gap-3">
            <span class="text-sm text-gray-500">
              Dimensions: {lastScreenshot()?.width}×{lastScreenshot()?.height}px
            </span>
            <Show when={lastScreenshot()?.file_size}>
              <span class="text-sm text-gray-500">
                • Size: {Math.round((lastScreenshot()?.file_size || 0) / 1024)}
                KB
              </span>
            </Show>
          </div>

          <Show when={lastScreenshot()?.data}>
            <img
              src={lastScreenshot()?.data}
              alt="Screenshot"
              class="mb-3 h-auto w-full max-w-[600px] rounded border border-gray-300"
            />
          </Show>

          <Show when={!saveToFile() && lastScreenshot()?.data}>
            <button
              onClick={saveScreenshot}
              class="cursor-pointer rounded-md border-none bg-indigo-500 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-indigo-600"
            >
              💾 Save to File
            </button>
          </Show>
        </div>
      </Show>

      {/* Error Display */}
      <Show when={lastScreenshot() && !lastScreenshot()?.success}>
        <div class="mt-6 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-600">
          <strong>Error:</strong> {lastScreenshot()?.error}
        </div>
      </Show>
    </div>
  );
}
