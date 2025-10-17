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
        class="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]"
      >
      {/* Backdrop */}
      <div class="fixed inset-0 bg-black/20 backdrop-blur-sm" />

      {/* Command Palette */}
      <div class="relative w-full max-w-2xl mx-auto">
        <Command class="rounded-lg border border-gray-200 bg-white shadow-2xl overflow-hidden dark:border-gray-700 dark:bg-gray-900">
          {/* Search Input */}
          <div class="flex items-center border-b border-gray-200 px-4 py-3 dark:border-gray-700">
            <Command.Input
              value={search()}
              onValueChange={setSearch}
              placeholder="Type a command or search..."
              class="flex-1 bg-transparent outline-none text-gray-900 placeholder:text-gray-500 dark:text-white dark:placeholder:text-gray-400"
            />
            <kbd class="ml-2 rounded border border-gray-200 px-2 py-1 text-xs font-mono text-gray-500 dark:border-gray-600 dark:text-gray-400">
              ESC
            </kbd>
          </div>

          {/* Command List */}
          <Command.List class="max-h-[50vh] overflow-y-auto p-2">
            {/* Empty State */}
            <Command.Empty class="py-6 text-center text-sm text-gray-500 dark:text-gray-400">
              No results found.
            </Command.Empty>

            {/* Command Groups */}
            {commandGroups.map((group) => (
              <Command.Group key={group.heading} heading={group.heading}>
                <div class="px-2 py-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide dark:text-gray-400">
                  {group.heading}
                </div>
                {group.items.map((item) => (
                  <Command.Item
                    key={item.id}
                    value={`${item.title} ${item.subtitle || ""} ${item.keywords?.join(" ") || ""}`}
                    onSelect={() => handleSelect(item)}
                    class="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-2.5 text-sm text-gray-900 outline-none hover:bg-gray-100 aria-selected:bg-gray-100 dark:text-white dark:hover:bg-gray-800 dark:aria-selected:bg-gray-800"
                  >
                    <span class="mr-3 text-lg">{item.icon}</span>
                    <div class="flex-1">
                      <div class="font-medium">{item.title}</div>
                      {item.subtitle && (
                        <div class="text-xs text-gray-500 dark:text-gray-400">
                          {item.subtitle}
                        </div>
                      )}
                    </div>
                  </Command.Item>
                ))}
              </Command.Group>
            ))}
          </Command.List>
        </Command>
        </div>
        </Command.Dialog>

          {/* Plugin Container Styles */}
    <style jsx>{`
      .plugin-container {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        pointer-events: none;
        z-index: 100;
      }

      .plugin-container plugin-host {
        pointer-events: auto;
      }
    `}</style>
    </>
  );
}