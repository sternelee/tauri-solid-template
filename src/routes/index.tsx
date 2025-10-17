import { createSignal, onMount, onCleanup, createResource } from "solid-js";
import { Command } from "cmdk-solid";
import { tauriCommands, type Application } from "../tauri-commands";

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

export default function Home() {
  const [search, setSearch] = createSignal("");
  const [mounted, setMounted] = createSignal(false);

  // Fetch system applications
  const [applications] = createResource(async () => {
    try {
      await tauriCommands.refreshApplicationsListInBackground();
      return await tauriCommands.getApplications();
    } catch (error) {
      console.error("Failed to load applications:", error);
      return [];
    }
  });

  // Convert system applications to command items
  const createApplicationCommands = (): CommandItem[] => {
    const apps = applications() || [];
    return apps.slice(0, 15).map((app: Application) => ({
      id: `app-${app.bundle_id}`,
      title: app.name,
      subtitle: `Launch ${app.name}`,
      icon: "📱", // Default icon, could be enhanced with actual app icons
      keywords: [app.name, app.bundle_id, "app", "launch"],
      action: async () => {
        try {
          if (navigator.platform.includes("Mac")) {
            await tauriCommands.executeCommand("open", ["-a", app.name]);
          } else {
            await tauriCommands.launchApplication(app.path);
          }
        } catch (error) {
          console.error(`Failed to launch ${app.name}:`, error);
        }
      }
    }));
  };

  // Static commands
  const staticCommandGroups: CommandGroup[] = [
    {
      heading: "Quick Actions",
      items: [
        {
          id: "action-terminal",
          title: "Terminal",
          subtitle: "Open command terminal",
          icon: "💻",
          keywords: ["terminal", "console", "cmd", "shell"],
          action: async () => {
            try {
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
          },
        },
        {
          id: "action-refresh-apps",
          title: "Refresh Applications",
          subtitle: "Reload system applications list",
          icon: "🔄",
          keywords: ["refresh", "reload", "apps"],
          action: async () => {
            try {
              await tauriCommands.refreshApplicationsList();
              // Optionally refetch applications
              window.location.reload();
            } catch (error) {
              console.error("Failed to refresh applications:", error);
            }
          },
        }
      ],
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
              const info = await tauriCommands.getSystemInfo();
              alert(
                `System Information:\nOS: ${info.os}\nArchitecture: ${info.arch}`,
              );
            } catch (error) {
              console.error("Failed to get system info:", error);
            }
          },
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
          },
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
                await tauriCommands.executeCommand("exit", []);
              } catch (error) {
                console.error("Failed to quit:", error);
              }
            }
          },
        },
      ],
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
              await tauriCommands.openUrl("https://www.google.com");
            } catch (error) {
              console.error("Failed to open Google:", error);
            }
          },
        },
        {
          id: "web-github",
          title: "Open GitHub",
          subtitle: "Go to GitHub",
          icon: "🐙",
          keywords: ["github", "code", "git"],
          action: async () => {
            try {
              await tauriCommands.openUrl("https://github.com");
            } catch (error) {
              console.error("Failed to open GitHub:", error);
            }
          },
        },
        {
          id: "web-cmdk",
          title: "CMDK Solid Docs",
          subtitle: "View cmdk-solid documentation",
          icon: "📚",
          keywords: ["cmdk", "docs", "documentation"],
          action: async () => {
            try {
              await tauriCommands.openUrl("https://cmdk-solid.vercel.app/");
            } catch (error) {
              console.error("Failed to open CMDK docs:", error);
            }
          },
        },
      ],
    },
  ];

  const handleKeyDown = (e: KeyboardEvent) => {
    // Escape to clear search
    if (e.key === "Escape") {
      setSearch("");
    }
  };

  onMount(() => {
    setMounted(true);
    document.addEventListener("keydown", handleKeyDown);
    // Auto focus input on mount
    const input = document.querySelector(
      'input[placeholder*="Type a command"]',
    );
    if (input instanceof HTMLElement) {
      input.focus();
    }
  });

  onCleanup(() => {
    document.removeEventListener("keydown", handleKeyDown);
  });

  const handleSelect = (item: CommandItem) => {
    item.action();
    setSearch("");
  };

  // Get all command groups (static + dynamic applications)
  const getAllCommandGroups = (): CommandGroup[] => {
    const appCommands = createApplicationCommands();
    const allGroups = [...staticCommandGroups];

    // Add applications group if we have apps
    if (appCommands.length > 0) {
      allGroups.unshift({
        heading: "Applications",
        items: appCommands
      });
    }

    return allGroups;
  };

  return (
    <div class="fixed inset-0 flex items-start justify-center bg-black/60 pt-10 backdrop-blur-xl">
      {/* Main Command Launcher */}
      <div class="relative mx-4 w-full max-w-2xl">
        {/* Command Interface */}
        <Command class="overflow-hidden rounded-xl border border-white/20 bg-white/10 shadow-2xl backdrop-blur-md">
          {/* Search Input */}
          <div class="flex items-center border-b border-white/10 px-4 py-3">
            <div class="relative flex-1">
              <div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <svg
                  class="h-4 w-4 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </div>
              <Command.Input
                value={search()}
                onValueChange={setSearch}
                placeholder="Type a command or search..."
                class="w-full bg-transparent pr-4 pl-9 text-sm text-white outline-none placeholder:text-gray-400"
              />
            </div>
            {search() && (
              <button
                onClick={() => setSearch("")}
                class="ml-2 rounded-md p-1 text-gray-400 transition-colors hover:text-white"
              >
                <svg
                  class="h-3 w-3"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            )}
          </div>

          {/* Command List */}
          <Command.List class="max-h-[60vh] overflow-y-auto">
            {/* Empty State */}
            <Command.Empty class="py-8 text-center">
              <div class="text-gray-400">
                <svg
                  class="mx-auto mb-3 h-8 w-8 opacity-50"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M9.172 16.172a4 4 0 015.656 0M9 12h6m-6-4h6m2 5.291A7.962 7.962 0 0112 15c-2.34 0-4.47-.881-6.08-2.33"
                  />
                </svg>
                <p class="text-sm font-medium text-gray-300">
                  No results found
                </p>
                <p class="mt-1 text-xs text-gray-500">
                  Try a different search term
                </p>
              </div>
            </Command.Empty>

            {/* Command Groups */}
            {getAllCommandGroups().map((group) => (
              <Command.Group key={group.heading} heading={group.heading}>
                <div class="px-3 py-1.5 text-xs font-medium tracking-wider text-gray-400 uppercase">
                  {group.heading}
                </div>
                {group.items.map((item) => (
                  <Command.Item
                    key={item.id}
                    value={`${item.title} ${item.subtitle || ""} ${item.keywords?.join(" ") || ""}`}
                    onSelect={() => handleSelect(item)}
                    class="group flex cursor-pointer items-center px-3 py-2 text-white transition-colors outline-none select-none hover:bg-white/5 aria-selected:bg-white/10"
                  >
                    <span class="mr-3 flex-shrink-0 text-lg">{item.icon}</span>
                    <div class="min-w-0 flex-1">
                      <div class="truncate text-sm font-medium text-white">
                        {item.title}
                      </div>
                      {item.subtitle && (
                        <div class="truncate text-xs text-gray-400">
                          {item.subtitle}
                        </div>
                      )}
                    </div>
                    <kbd class="ml-2 rounded border border-white/10 bg-white/5 px-1.5 py-0.5 font-mono text-[10px] text-gray-400">
                      ↵
                    </kbd>
                  </Command.Item>
                ))}
              </Command.Group>
            ))}
          </Command.List>
        </Command>

        {/* Footer hints */}
        <div class="mt-4 text-center">
          <div class="inline-flex items-center space-x-3 rounded-full bg-black/20 px-3 py-1.5 text-xs text-gray-400 backdrop-blur-sm">
            <div class="flex items-center space-x-1">
              <kbd class="rounded border border-white/20 bg-white/10 px-1.5 py-0.5 font-mono text-[10px]">
                ↑↓
              </kbd>
              <span>Navigate</span>
            </div>
            <div class="flex items-center space-x-1">
              <kbd class="rounded border border-white/20 bg-white/10 px-1.5 py-0.5 font-mono text-[10px]">
                ↵
              </kbd>
              <span>Select</span>
            </div>
            <div class="flex items-center space-x-1">
              <kbd class="rounded border border-white/20 bg-white/10 px-1.5 py-0.5 font-mono text-[10px]">
                ESC
              </kbd>
              <span>Clear</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

