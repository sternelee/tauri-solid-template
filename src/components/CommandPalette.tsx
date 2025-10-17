import { createSignal, onMount, onCleanup, createEffect } from "solid-js";
import { Command } from "cmdk-solid";
import { pluginManager } from "../plugins/PluginManager";

interface CommandItem {
  id: string;
  title: string;
  subtitle?: string;
  icon?: string;
  keywords?: string[];
  action: () => void | Promise<void>;
}

interface CommandGroup {
  heading: string;
  items: CommandItem[];
}

export default function CommandPalette() {
const [open, setOpen] = createSignal(false);
const [search, setSearch] = createSignal("");
  const [pluginCommands, setPluginCommands] = createSignal<CommandItem[]>([]);

  // Initialize plugins on mount
  onMount(async () => {
    try {
      // Load example screenshot plugin
      await pluginManager.loadPlugin('./plugins/example-screenshot/index.tsx');

      // Update plugin commands
      updatePluginCommands();
    } catch (error) {
      console.error('Failed to load plugins:', error);
    }
  });

  const updatePluginCommands = () => {
    const commands = pluginManager.getAllCommands().map(cmd => ({
      id: `plugin-${cmd.id}`,
      title: cmd.title,
      subtitle: cmd.description,
      icon: cmd.icon,
      keywords: cmd.keywords,
      action: async () => {
        // Find the plugin that contains this command
        const plugins = pluginManager.getPlugins();
        const plugin = plugins.find(p => p.commands.some(c => c.id === cmd.id));

        if (plugin) {
          await pluginManager.activatePlugin(plugin.meta.id, cmd.id);
          setOpen(false);
          setSearch("");
        }
      }
    }));

    setPluginCommands(commands);
  };

  // Commands with real Tauri integration
  const commandGroups: CommandGroup[] = [
    {
      heading: "Applications",
      items: [
        {
          id: "app-calculator",
          title: "Calculator",
          subtitle: "Open calculator app",
          icon: "🧮",
          keywords: ["calc", "math"],
          action: async () => {
            try {
              const { tauriCommands } = await import("../tauri-commands");
              await tauriCommands.executeCommand("open", ["-na", "Calculator"]);
            } catch (error) {
              console.error("Failed to open calculator:", error);
            }
          }
        },
        {
          id: "app-terminal",
          title: "Terminal",
          subtitle: "Open command terminal",
          icon: "💻",
          keywords: ["terminal", "console", "cmd", "shell"],
          action: async () => {
            try {
              const { tauriCommands } = await import("../tauri-commands");
              if (navigator.platform.includes("Mac")) {
                await tauriCommands.executeCommand("open", ["-na", "Terminal"]);
              } else if (navigator.platform.includes("Win")) {
                await tauriCommands.executeCommand("cmd", ["/c", "start"]);
              } else {
                await tauriCommands.executeCommand("gnome-terminal", []);
              }
            } catch (error) {
              console.error("Failed to open terminal:", error);
            }
          }
        }
      ]
    },
    {
      heading: "Actions",
      items: [
        {
          id: "action-system-info",
          title: "System Information",
          subtitle: "View system details",
          icon: "ℹ️",
          keywords: ["system", "info", "details", "about"],
          action: async () => {
            try {
              const { tauriCommands } = await import("../tauri-commands");
              const info = await tauriCommands.getSystemInfo();
              alert(`System Information:\nOS: ${info.os}\nArchitecture: ${info.arch}`);
            } catch (error) {
              console.error("Failed to get system info:", error);
            }
          }
        },
        {
          id: "action-settings",
          title: "Settings",
          subtitle: "Open application settings",
          icon: "⚙️",
          keywords: ["preferences", "config"],
          action: async () => {
            console.log("Settings - feature coming soon...");
            // TODO: Open settings panel
          }
        },
        {
          id: "action-quit",
          title: "Quit Application",
          subtitle: "Close the launcher",
          icon: "❌",
          keywords: ["exit", "close", "quit"],
          action: async () => {
            if (confirm("Are you sure you want to quit the application?")) {
              try {
                const { tauriCommands } = await import("../tauri-commands");
                await tauriCommands.executeCommand("exit", []);
              } catch (error) {
                console.error("Failed to quit:", error);
              }
            }
          }
        }
      ]
    },
    {
      heading: "Web",
      items: [
        {
          id: "web-google",
          title: "Search Google",
          subtitle: "Open Google search",
          icon: "🌐",
          keywords: ["google", "search", "web"],
          action: async () => {
            try {
              const { tauriCommands } = await import("../tauri-commands");
              await tauriCommands.openUrl("https://www.google.com");
            } catch (error) {
              console.error("Failed to open Google:", error);
            }
          }
        },
        {
          id: "web-github",
          title: "Open GitHub",
          subtitle: "Go to GitHub",
          icon: "🐙",
          keywords: ["github", "code", "git"],
          action: async () => {
            try {
              const { tauriCommands } = await import("../tauri-commands");
              await tauriCommands.openUrl("https://github.com");
            } catch (error) {
              console.error("Failed to open GitHub:", error);
            }
          }
        },
        {
          id: "web-cmdk",
          title: "CMDK Solid Docs",
          subtitle: "View cmdk-solid documentation",
          icon: "📚",
          keywords: ["cmdk", "docs", "documentation"],
          action: async () => {
            try {
              const { tauriCommands } = await import("../tauri-commands");
              await tauriCommands.openUrl("https://cmdk-solid.vercel.app/");
            } catch (error) {
              console.error("Failed to open CMDK docs:", error);
            }
          }
        }
        ]
        },
          {
      heading: "Plugins",
      items: pluginCommands()
    }
  ];

  const handleKeyDown = (e: KeyboardEvent) => {
    // Cmd/Ctrl + K to open command palette
    if ((e.metaKey || e.ctrlKey) && e.key === "k") {
      e.preventDefault();
      setOpen(true);
    }
    // Escape to close
    if (e.key === "Escape" && open()) {
      setOpen(false);
      setSearch("");
    }
  };

  onMount(() => {
    document.addEventListener("keydown", handleKeyDown);
  });

  onCleanup(() => {
    document.removeEventListener("keydown", handleKeyDown);
  });

  const handleSelect = (item: CommandItem) => {
    item.action();
    setOpen(false);
    setSearch("");
  };

  return (
    <>
      {/* Plugin Container */}
      <div id="plugin-container" class="plugin-container"></div>

    <Command.Dialog
  open={open()}
  onOpenChange={setOpen}
  class="raycast-dialog"
  >
    {/* Backdrop */}
    <div class="raycast-backdrop" />

    {/* Command Palette */}
    <div class="raycast-container">
    <Command class="raycast-palette">
    {/* Search Input */}
    <div class="raycast-search">
    <div class="raycast-search-icon">
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M21 21L16.5 16.5M19 11C19 15.4183 15.4183 19 11 19C6.58172 19 3 15.4183 3 11C3 6.58172 6.58172 3 11 3C15.4183 3 19 6.58172 19 11Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  </div>
    <Command.Input
      value={search()}
    onValueChange={setSearch}
      placeholder="Search for apps and commands..."
        class="raycast-input"
              />
      <div class="raycast-shortcuts">
        <kbd class="raycast-kbd raycast-kbd-primary">
        <span>⌘</span>
        <span>K</span>
    </kbd>
      <span class="raycast-shortcut-separator">or</span>
                <kbd class="raycast-kbd">
        <span>ESC</span>
      </kbd>
  </div>
  </div>

  {/* Command List */}
  <Command.List class="raycast-list">
  {/* Empty State */}
  <Command.Empty class="raycast-empty">
  <div class="raycast-empty-icon">
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
  <path d="M9.75 9.75L14.25 14.25M14.25 9.75L9.75 14.25M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
  </div>
  <div class="raycast-empty-text">
  No results found
  </div>
  <div class="raycast-empty-subtitle">
  Try searching for something else
  </div>
  </Command.Empty>

  {/* Command Groups */}
  {commandGroups.map((group) => (
    <Command.Group key={group.heading} heading={group.heading}>
        <div class="raycast-group-header">
            {group.heading}
            </div>
            {group.items.map((item) => (
              <Command.Item
                      key={item.id}
              value={`${item.title} ${item.subtitle || ""} ${item.keywords?.join(" ") || ""}`}
                    onSelect={() => handleSelect(item)}
                  class="raycast-item"
              >
                <div class="raycast-item-icon">
                  {item.icon}
                </div>
                <div class="raycast-item-content">
                  <div class="raycast-item-title">
                    {item.title}
                    </div>
                        {item.subtitle && (
                      <div class="raycast-item-subtitle">
                      {item.subtitle}
                      </div>
                      )}
                    </div>
                      {item.shortcut && (
                        <div class="raycast-item-shortcut">
                          <kbd class="raycast-kbd raycast-kbd-small">
                            {item.shortcut.split('+').map((key, index) => (
                              <span key={index}>
                                {key === 'Cmd' ? '⌘' :
                                 key === 'Shift' ? '⇧' :
                                 key === 'Alt' ? '⌥' :
                                 key === 'Ctrl' ? '⌃' :
                                 key.toUpperCase()}
                              </span>
                            ))}
                          </kbd>
                        </div>
                      )}
                    </Command.Item>
                  ))}
                </Command.Group>
              ))}
            </Command.List>
          </Command>
        </div>
      </Command.Dialog>

      {/* Raycast-style CSS */}
      <style jsx global>{`
        /* Raycast-inspired styling */
        .raycast-dialog {
          position: fixed;
          inset: 0;
          z-index: 9999;
          display: flex;
          align-items: flex-start;
          justify-content: center;
          padding-top: 12vh;
        }

        .raycast-backdrop {
          position: absolute;
          inset: 0;
          background: rgba(0, 0, 0, 0.4);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
        }

        .raycast-container {
          position: relative;
          width: 100%;
          max-width: 640px;
          margin: 0 16px;
        }

        .raycast-palette {
          background: rgba(23, 23, 23, 0.95);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 16px;
          box-shadow:
            0 20px 25px -5px rgba(0, 0, 0, 0.1),
            0 10px 10px -5px rgba(0, 0, 0, 0.04),
            0 0 0 1px rgba(255, 255, 255, 0.05);
          overflow: hidden;
          animation: raycast-enter 0.15s ease-out;
        }

        @keyframes raycast-enter {
          from {
            opacity: 0;
            transform: scale(0.95) translateY(-10px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }

        .raycast-search {
          display: flex;
          align-items: center;
          padding: 16px 20px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
          gap: 12px;
        }

        .raycast-search-icon {
          color: rgba(255, 255, 255, 0.6);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .raycast-input {
          flex: 1;
          background: transparent;
          border: none;
          outline: none;
          color: rgba(255, 255, 255, 0.9);
          font-size: 16px;
          font-weight: 400;
          line-height: 1.5;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
        }

        .raycast-input::placeholder {
          color: rgba(255, 255, 255, 0.5);
        }

        .raycast-input:focus {
          outline: none;
        }

        .raycast-shortcuts {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-left: auto;
        }

        .raycast-shortcut-separator {
          color: rgba(255, 255, 255, 0.4);
          font-size: 12px;
          font-weight: 500;
        }

        .raycast-kbd {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 1px;
          padding: 2px 6px;
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 6px;
          font-size: 11px;
          font-weight: 500;
          color: rgba(255, 255, 255, 0.8);
          font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace;
          line-height: 1;
          user-select: none;
        }

        .raycast-kbd-primary {
          background: rgba(59, 130, 246, 0.2);
          border-color: rgba(59, 130, 246, 0.3);
          color: #60a5fa;
        }

        .raycast-kbd-small {
          padding: 1px 4px;
          font-size: 10px;
          min-height: 16px;
        }

        .raycast-list {
          max-height: 400px;
          overflow-y: auto;
          padding: 8px 0;
        }

        .raycast-list::-webkit-scrollbar {
          width: 6px;
        }

        .raycast-list::-webkit-scrollbar-track {
          background: transparent;
        }

        .raycast-list::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.2);
          border-radius: 3px;
        }

        .raycast-list::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.3);
        }

        .raycast-group-header {
          padding: 8px 20px 4px;
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: rgba(255, 255, 255, 0.5);
          user-select: none;
        }

        .raycast-item {
          display: flex;
          align-items: center;
          padding: 8px 20px;
          margin: 0 8px;
          border-radius: 8px;
          cursor: pointer;
          user-select: none;
          transition: all 0.15s ease;
          outline: none;
        }

        .raycast-item:hover,
        .raycast-item[aria-selected="true"] {
          background: rgba(255, 255, 255, 0.1);
        }

        .raycast-item-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
          margin-right: 12px;
          font-size: 16px;
          flex-shrink: 0;
        }

        .raycast-item-content {
          flex: 1;
          min-width: 0;
        }

        .raycast-item-title {
          font-size: 14px;
          font-weight: 500;
          color: rgba(255, 255, 255, 0.9);
          line-height: 1.4;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .raycast-item-subtitle {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.6);
          line-height: 1.3;
          margin-top: 1px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .raycast-item-shortcut {
          margin-left: 12px;
          flex-shrink: 0;
        }

        .raycast-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 48px 20px;
          text-align: center;
        }

        .raycast-empty-icon {
          color: rgba(255, 255, 255, 0.4);
          margin-bottom: 16px;
        }

        .raycast-empty-text {
          font-size: 16px;
          font-weight: 500;
          color: rgba(255, 255, 255, 0.8);
          margin-bottom: 4px;
        }

        .raycast-empty-subtitle {
          font-size: 13px;
          color: rgba(255, 255, 255, 0.5);
        }

        /* Plugin Container */
        .plugin-container {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          pointer-events: none;
          z-index: 10000;
        }

        .plugin-container plugin-host {
          pointer-events: auto;
        }

        /* Responsive adjustments */
        @media (max-width: 640px) {
          .raycast-dialog {
            padding-top: 8vh;
          }

          .raycast-container {
            margin: 0 12px;
          }

          .raycast-search {
            padding: 12px 16px;
          }

          .raycast-item {
            padding: 12px 16px;
            margin: 0 4px;
          }

          .raycast-group-header {
            padding: 8px 16px 4px;
          }
        }

        /* Focus states */
        .raycast-item:focus-visible {
          outline: 2px solid rgba(59, 130, 246, 0.5);
          outline-offset: 2px;
        }

        .raycast-input:focus-visible {
          outline: none;
        }
      `}</style>
    </>
  );
}