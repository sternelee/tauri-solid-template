import { createSignal, onMount, onCleanup } from "solid-js";
import CommandPalette from "../components/CommandPalette";
import KeyboardShortcutsHelp from "../components/KeyboardShortcutsHelp";

export default function Home() {
  const [isCommandPaletteVisible, setIsCommandPaletteVisible] =
    createSignal(false);

  // Handle keyboard shortcuts
  const handleKeyDown = (event: KeyboardEvent) => {
    // Cmd+K or Ctrl+K to toggle command palette
    if ((event.metaKey || event.ctrlKey) && event.key === "k") {
      event.preventDefault();
      setIsCommandPaletteVisible(true);
    }
    // Escape to hide command palette
    if (event.key === "Escape") {
      setIsCommandPaletteVisible(false);
    }
  };

  onMount(() => {
    console.log("Raycast-style interface mounted");
    window.addEventListener("keydown", handleKeyDown);

    // Auto-hide command palette when it loses focus
    const handleBlur = () => {
      setTimeout(() => setIsCommandPaletteVisible(false), 200);
    };
    window.addEventListener("blur", handleBlur);

    onCleanup(() => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("blur", handleBlur);
    });
  });

  return (
    <div class="relative min-h-screen overflow-hidden bg-slate-900 text-white">
      {/* Welcome Screen - Visible when command palette is hidden */}
      {!isCommandPaletteVisible() && (
        <div class="animate-fade-in fixed inset-0 z-10 flex items-center justify-center bg-slate-900">
          <div class="max-w-md px-5 text-center">
            <div class="mb-6 flex justify-center text-indigo-400">
              <svg
                width="64"
                height="64"
                viewBox="0 0 24 24"
                fill="none"
                class="animate-pulse"
              >
                <path
                  d="M12 2L2 7L12 12L22 7L12 2Z"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M2 17L12 22L22 17"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M2 12L12 17L22 12"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <h1 class="mb-2 text-3xl font-bold tracking-tight text-white">
              Raycast Clone
            </h1>
            <p class="mb-8 text-base leading-relaxed text-slate-400">
              A powerful launcher for your desktop
            </p>
            <div class="flex items-center justify-center gap-3 rounded-xl border border-slate-700/50 bg-slate-800/50 px-6 py-4 backdrop-blur-sm">
              <kbd class="flex min-h-12 items-center gap-1 rounded-md border border-slate-600 bg-slate-700 px-3 py-2 text-sm">
                <span>⌘</span>
                <span>K</span>
              </kbd>
              <span class="text-sm font-medium text-slate-400">
                to get started
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Main Interface - Hidden by default, activated by Cmd+K */}
      <div class="relative h-screen w-full">
        <CommandPalette
          isVisible={isCommandPaletteVisible()}
          onHide={() => setIsCommandPaletteVisible(false)}
        />
      </div>

      {/* Keyboard Shortcuts Help */}
      <KeyboardShortcutsHelp />
    </div>
  );
}
