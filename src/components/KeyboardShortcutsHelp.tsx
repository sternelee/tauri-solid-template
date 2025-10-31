/**
 * Keyboard Shortcuts Help Component
 * Displays available keyboard shortcuts in Raycast style
 */

import { createSignal, Show } from "solid-js";

export interface KeyboardShortcut {
  keys: string[];
  description: string;
  category: string;
}

const shortcuts: KeyboardShortcut[] = [
  // Navigation
  {
    keys: ["⌘", "K"],
    description: "Open/Close Command Palette",
    category: "Navigation",
  },
  {
    keys: ["Alt", "K"],
    description: "Show Command Palette (Global)",
    category: "Navigation",
  },
  {
    keys: ["Alt", "P"],
    description: "Toggle Window Visibility (Global)",
    category: "Navigation",
  },
  {
    keys: ["Alt", "C"],
    description: "Open AI Chat (Global)",
    category: "Navigation",
  },
  { keys: ["ESC"], description: "Close/Back", category: "Navigation" },
  {
    keys: ["Tab"],
    description: "Switch Mode (Command ↔ Chat)",
    category: "Navigation",
  },

  // Search
  { keys: ["#"], description: "Search Files", category: "Search" },
  { keys: ["↑", "↓"], description: "Navigate Results", category: "Search" },
  { keys: ["Enter"], description: "Execute Selected Item", category: "Search" },

  // Actions
  {
    keys: ["⌘", "R"],
    description: "Refresh Applications",
    category: "Actions",
  },
  { keys: ["⌘", "Q"], description: "Quit Application", category: "Actions" },
];

export default function KeyboardShortcutsHelp() {
  const [open, setOpen] = createSignal(false);

  const groupedShortcuts = () => {
    const groups: Record<string, KeyboardShortcut[]> = {};
    shortcuts.forEach((shortcut) => {
      if (!groups[shortcut.category]) {
        groups[shortcut.category] = [];
      }
      groups[shortcut.category].push(shortcut);
    });
    return groups;
  };

  return (
    <>
      <button
        class="fixed right-5 bottom-5 z-50 flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-blue-500/30 bg-blue-500/20 text-lg font-bold text-blue-400 transition-all hover:scale-110 hover:bg-blue-500/30"
        onClick={() => setOpen(!open())}
        title="Keyboard Shortcuts"
      >
        <span>?</span>
      </button>

      <Show when={open()}>
        <div
          class="animate-fade-in fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <div
            class="animate-slide-up flex max-h-[80vh] w-[90%] max-w-2xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-gray-900/98"
            onClick={(e) => e.stopPropagation()}
          >
            <div class="flex items-center justify-between border-b border-white/10 p-5">
              <h2 class="m-0 text-xl font-semibold text-white/90">
                Keyboard Shortcuts
              </h2>
              <button
                class="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border-none bg-transparent text-lg text-white/60 transition-all hover:bg-white/10 hover:text-white/90"
                onClick={() => setOpen(false)}
              >
                ✕
              </button>
            </div>

            <div class="overflow-y-auto p-5 pb-6 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded [&::-webkit-scrollbar-thumb]:bg-white/20 [&::-webkit-scrollbar-thumb:hover]:bg-white/30 [&::-webkit-scrollbar-track]:bg-transparent">
              {Object.entries(groupedShortcuts()).map(([category, items]) => (
                <div class="mb-8 last:mb-0">
                  <h3 class="m-0 mb-3 text-xs font-semibold tracking-wide text-white/50 uppercase">
                    {category}
                  </h3>
                  <div class="flex flex-col gap-2">
                    {items.map((shortcut, shortcutIndex) => (
                      <div class="flex items-center justify-between rounded-lg border border-white/8 bg-white/3 p-3 transition-all hover:border-white/15 hover:bg-white/5">
                        <span class="text-sm font-medium text-white/80">
                          {shortcut.description}
                        </span>
                        <div class="flex items-center gap-1">
                          {shortcut.keys.map((key, index) => (
                            <>
                              <kbd class="inline-flex min-w-7 items-center justify-center rounded-lg border border-white/20 bg-white/10 px-2 py-1 font-mono text-xs font-semibold text-white/90">
                                {key}
                              </kbd>
                              {index < shortcut.keys.length - 1 && (
                                <span class="mx-0.5 text-xs font-semibold text-white/40">
                                  +
                                </span>
                              )}
                            </>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Show>
    </>
  );
}
