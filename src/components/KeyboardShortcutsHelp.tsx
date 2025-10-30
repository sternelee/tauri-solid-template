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
  { keys: ["⌘", "K"], description: "Open/Close Command Palette", category: "Navigation" },
  { keys: ["Alt", "K"], description: "Show Command Palette (Global)", category: "Navigation" },
  { keys: ["Alt", "P"], description: "Toggle Window Visibility (Global)", category: "Navigation" },
  { keys: ["Alt", "C"], description: "Open AI Chat (Global)", category: "Navigation" },
  { keys: ["ESC"], description: "Close/Back", category: "Navigation" },
  { keys: ["Tab"], description: "Switch Mode (Command ↔ Chat)", category: "Navigation" },
  
  // Search
  { keys: ["#"], description: "Search Files", category: "Search" },
  { keys: ["↑", "↓"], description: "Navigate Results", category: "Search" },
  { keys: ["Enter"], description: "Execute Selected Item", category: "Search" },
  
  // Actions
  { keys: ["⌘", "R"], description: "Refresh Applications", category: "Actions" },
  { keys: ["⌘", "Q"], description: "Quit Application", category: "Actions" },
];

export default function KeyboardShortcutsHelp() {
  const [open, setOpen] = createSignal(false);

  const groupedShortcuts = () => {
    const groups: Record<string, KeyboardShortcut[]> = {};
    shortcuts.forEach(shortcut => {
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
        class="help-trigger"
        onClick={() => setOpen(!open())}
        title="Keyboard Shortcuts"
      >
        <span>?</span>
      </button>

      <Show when={open()}>
        <div class="help-overlay" onClick={() => setOpen(false)}>
          <div class="help-dialog" onClick={(e) => e.stopPropagation()}>
            <div class="help-header">
              <h2 class="help-title">Keyboard Shortcuts</h2>
              <button class="help-close" onClick={() => setOpen(false)}>
                ✕
              </button>
            </div>
            
            <div class="help-content">
              {Object.entries(groupedShortcuts()).map(([category, items]) => (
                <div class="help-section">
                  <h3 class="help-category">{category}</h3>
                  <div class="help-shortcuts">
                    {items.map(shortcut => (
                      <div class="help-shortcut-item">
                        <span class="help-description">{shortcut.description}</span>
                        <div class="help-keys">
                          {shortcut.keys.map((key, index) => (
                            <>
                              <kbd class="help-key">{key}</kbd>
                              {index < shortcut.keys.length - 1 && (
                                <span class="help-key-separator">+</span>
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

      <style jsx>{`
        .help-trigger {
          position: fixed;
          bottom: 20px;
          right: 20px;
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: rgba(59, 130, 246, 0.2);
          border: 1px solid rgba(59, 130, 246, 0.3);
          color: #60a5fa;
          font-size: 18px;
          font-weight: 700;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s ease;
          z-index: 1000;
        }

        .help-trigger:hover {
          background: rgba(59, 130, 246, 0.3);
          transform: scale(1.1);
        }

        .help-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.6);
          backdrop-filter: blur(8px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10000;
          animation: fade-in 0.2s ease;
        }

        .help-dialog {
          background: rgba(23, 23, 23, 0.98);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 16px;
          width: 90%;
          max-width: 600px;
          max-height: 80vh;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          animation: slide-up 0.3s ease;
        }

        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes slide-up {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .help-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 20px 24px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }

        .help-title {
          margin: 0;
          font-size: 20px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.9);
        }

        .help-close {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          background: transparent;
          border: none;
          color: rgba(255, 255, 255, 0.6);
          font-size: 18px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s ease;
        }

        .help-close:hover {
          background: rgba(255, 255, 255, 0.1);
          color: rgba(255, 255, 255, 0.9);
        }

        .help-content {
          overflow-y: auto;
          padding: 20px 24px;
        }

        .help-section {
          margin-bottom: 32px;
        }

        .help-section:last-child {
          margin-bottom: 0;
        }

        .help-category {
          font-size: 13px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: rgba(255, 255, 255, 0.5);
          margin: 0 0 12px 0;
        }

        .help-shortcuts {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .help-shortcut-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 16px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 8px;
          transition: all 0.2s ease;
        }

        .help-shortcut-item:hover {
          background: rgba(255, 255, 255, 0.05);
          border-color: rgba(255, 255, 255, 0.15);
        }

        .help-description {
          font-size: 14px;
          color: rgba(255, 255, 255, 0.8);
          font-weight: 500;
        }

        .help-keys {
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .help-key {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 28px;
          padding: 4px 8px;
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 6px;
          font-size: 12px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.9);
          font-family: "SF Mono", Monaco, "Cascadia Code", monospace;
        }

        .help-key-separator {
          color: rgba(255, 255, 255, 0.4);
          font-size: 12px;
          font-weight: 600;
          margin: 0 2px;
        }

        /* Scrollbar styles */
        .help-content::-webkit-scrollbar {
          width: 6px;
        }

        .help-content::-webkit-scrollbar-track {
          background: transparent;
        }

        .help-content::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.2);
          border-radius: 3px;
        }

        .help-content::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.3);
        }
      `}</style>
    </>
  );
}
