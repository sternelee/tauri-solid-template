import { createSignal, onMount } from "solid-js";
import {
  getScreenshotableWindows,
  getWindowScreenshot,
} from "tauri-plugin-screenshots-api";

interface WindowInfo {
  id: number;
  label: string;
}

export default function ScreenshotToolSimple() {
  const [windows, setWindows] = createSignal<WindowInfo[]>([]);
  const [selectedWindow, setSelectedWindow] = createSignal<number | null>(null);
  const [loading, setLoading] = createSignal(false);
  const [lastScreenshot, setLastScreenshot] = createSignal<string | null>(null);

  onMount(async () => {
    await loadWindows();
  });

  const loadWindows = async () => {
    try {
      setLoading(true);
      const availableWindows = await getScreenshotableWindows();
      setWindows(availableWindows);
    } catch (error) {
      console.error("Failed to load windows:", error);
    } finally {
      setLoading(false);
    }
  };

  const takeScreenshot = async () => {
    const windowId = selectedWindow();
    if (!windowId) {
      alert("Please select a window first");
      return;
    }

    try {
      setLoading(true);
      const screenshotPath = await getWindowScreenshot(windowId);
      setLastScreenshot(screenshotPath);

      // Create a file path preview
      const pathParts = screenshotPath.split("/");
      const fileName = pathParts[pathParts.length - 1];

      // Show success message
      alert(`Screenshot saved as: ${fileName}`);
    } catch (error) {
      console.error("Failed to take screenshot:", error);
      alert("Failed to take screenshot. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const refreshWindows = async () => {
    await loadWindows();
    setSelectedWindow(null);
  };

  return (
    <div class="screenshot-tool mx-auto max-w-md rounded-lg bg-white p-6 shadow-lg dark:bg-gray-800">
      <h2 class="mb-6 text-2xl font-bold text-gray-800 dark:text-white">
        📸 Screenshot Tool
      </h2>

      <div class="space-y-4">
        {/* Window Selection */}
        <div>
          <label class="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Select Window:
          </label>
          <select
            class="w-full rounded-md border border-gray-300 bg-white p-2 text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            value={selectedWindow() || ""}
            onChange={(e) => setSelectedWindow(Number(e.target.value))}
          >
            <option value="">-- Select a window --</option>
            {windows().map((window) => (
              <option value={window.id} key={window.id}>
                {window.label}
              </option>
            ))}
          </select>
        </div>

        {/* Action Buttons */}
        <div class="flex gap-2">
          <button
            onClick={refreshWindows}
            disabled={loading()}
            class="flex-1 rounded-md bg-gray-500 px-4 py-2 text-white hover:bg-gray-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            🔄 Refresh
          </button>
          <button
            onClick={takeScreenshot}
            disabled={loading() || !selectedWindow()}
            class="flex-1 rounded-md bg-blue-500 px-4 py-2 text-white hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading() ? "⏳ Capturing..." : "📸 Capture"}
          </button>
        </div>

        {/* Status Information */}
        {windows().length === 0 && !loading() && (
          <div class="py-4 text-center text-gray-500 dark:text-gray-400">
            No windows available for screenshot
          </div>
        )}

        {loading() && (
          <div class="py-4 text-center text-blue-500 dark:text-blue-400">
            Loading available windows...
          </div>
        )}

        {lastScreenshot() && (
          <div class="mt-4 rounded-md border border-green-200 bg-green-50 p-3 dark:border-green-800 dark:bg-green-900/20">
            <p class="text-sm text-green-800 dark:text-green-200">
              ✅ Last screenshot saved successfully!
            </p>
            <p class="mt-1 text-xs text-green-600 dark:text-green-400">
              Path: {lastScreenshot()}
            </p>
          </div>
        )}

        {/* Instructions */}
        <div class="mt-6 rounded-md border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/20">
          <h3 class="mb-2 text-sm font-semibold text-blue-800 dark:text-blue-200">
            How to use:
          </h3>
          <ol class="list-inside list-decimal space-y-1 text-sm text-blue-700 dark:text-blue-300">
            <li>Select a window from the dropdown</li>
            <li>Click "Capture" to take a screenshot</li>
            <li>The screenshot will be saved automatically</li>
            <li>Refresh to update the window list</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
