import {
  createSignal,
  onMount,
  onCleanup,
  createEffect,
  createMemo,
} from "solid-js";
import { Command } from "cmdk-solid";
import { pluginManager } from "../plugins/PluginManager";
import { commands } from "../bindings";
import { openPath, openUrl } from "@tauri-apps/plugin-opener";
import { register, unregister } from "@tauri-apps/plugin-global-shortcut";

interface CommandItem {
  id: string;
  title: string;
  subtitle?: string;
  icon?: string;
  keywords?: string[];
  type: "app" | "action" | "web" | "plugin";
  action: () => void | Promise<void>;
}

interface CommandGroup {
  heading: string;
  items: CommandItem[];
}

export default function CommandPalette() {
  const [open, setOpen] = createSignal(true); // Auto-open on app start
  const [search, setSearch] = createSignal("");
  const [pluginCommands, setPluginCommands] = createSignal<CommandItem[]>([]);
  const [systemApps, setSystemApps] = createSignal<CommandItem[]>([]);
  const [appsLoading, setAppsLoading] = createSignal(false);
  const [appsLoaded, setAppsLoaded] = createSignal(false);
  const [iconCache, setIconCache] = createSignal<Map<string, string>>(new Map());
  const [globalShortcutsRegistered, setGlobalShortcutsRegistered] =
    createSignal(false);

  // Initialize plugins on mount
  onMount(async () => {
    console.log("CommandPalette mounting...");

    try {
      // Load example screenshot plugin
      // await pluginManager.loadPlugin('./plugins/example-screenshot/index.tsx');

      // Update plugin commands
      updatePluginCommands();

      // Register global shortcuts
      try {
        await register("alt+k", async () => {
          console.log("Alt+K global shortcut triggered");
          setOpen(true);
          // Auto-focus input after a short delay
          setTimeout(() => {
            const input = document.querySelector(
              ".raycast-input",
            ) as HTMLInputElement;
            if (input) {
              input.focus();
              input.select();
            }
          }, 100);
        });

        await register("alt+p", async () => {
          console.log("Alt+P global shortcut triggered - toggle window");
          try {
            await commands.toggleWindowVisibility();
          } catch (error) {
            console.error("Failed to toggle window visibility:", error);
          }
        });

        setGlobalShortcutsRegistered(true);
        console.log("Global shortcuts registered successfully");
      } catch (error) {
        console.error("Failed to register global shortcuts:", error);
        setGlobalShortcutsRegistered(false);
      }

      // Load system apps immediately after mount
      console.log("Loading system apps on mount...");
      await loadSystemApplications();
    } catch (error) {
      console.error("Failed to load plugins:", error);
    }
  });

  const updatePluginCommands = () => {
    const commands = pluginManager.getAllCommands().map((cmd) => ({
      id: `plugin-${cmd.id}`,
      title: cmd.title,
      subtitle: cmd.description,
      icon: cmd.icon,
      keywords: cmd.keywords,
      type: "plugin" as const,
      action: async () => {
        // Find the plugin that contains this command
        const plugins = pluginManager.getPlugins();
        const plugin = plugins.find((p) =>
          p.commands.some((c) => c.id === cmd.id),
        );

        if (plugin) {
          await pluginManager.activatePlugin(plugin.meta.id, cmd.id);
          setOpen(false);
          setSearch("");
        }
      },
    }));

    setPluginCommands(commands);
  };

  // Get application icon with caching
  const getAppIcon = async (app: any): Promise<string> => {
    // Check cache first
    const cache = iconCache();
    if (cache.has(app.bundle_id)) {
      return cache.get(app.bundle_id)!;
    }

    try {
      // Try to get the icon data URL
      const result = await commands.getAppIconDataUrl(app.icon || null);
      if (result.status === "ok" && result.data) {
        // Cache the result
        const newCache = new Map(cache);
        newCache.set(app.bundle_id, result.data);
        setIconCache(newCache);
        return result.data;
      }
    } catch (error) {
      console.warn(`Failed to get icon for ${app.name}:`, error);
    }

    // Fallback to emoji
    return "📱";
  };

  const loadSystemApplications = async () => {
    // Prevent multiple simultaneous loads
    if (appsLoading() || appsLoaded()) {
      console.log(
        `Skipping load - loading: ${appsLoading()}, loaded: ${appsLoaded()}`,
      );
      return;
    }

    console.log("Starting to load system applications...");
    setAppsLoading(true);
    try {
      const result = await commands.getApplications();
      console.log("getApplications result:", result);
      if (result.status === "ok") {
        console.log(`Processing ${result.data.length} applications`);
        const apps = result.data.map((app, index) => {
        const appItem: any = {
          id: `system-app-${index}`,
          title: app.name,
          subtitle: app.bundle_id,
          icon: "📱", // Default icon for apps (will be updated asynchronously)
          keywords: [app.name.toLowerCase(), app.bundle_id.toLowerCase()],
          type: "app" as const,
          action: async () => {
            try {
              // Use tauri-plugin-opener to open the application
              // Try different methods based on available information
              if (app.path) {
                // If we have a direct path, use it
                await openPath(app.path);
              } else if (app.bundle_id) {
                // For macOS, try opening with bundle ID using the applications scheme
                if (navigator.platform.includes("Mac")) {
                  // Try opening by bundle ID first
                  try {
                    await openPath(app.bundle_id);
                  } catch {
                    // Fallback to Applications folder path
                    await openPath(`file:///Applications/${app.name}.app`);
                  }
                } else {
                  // For other platforms, you might need different approaches
                  console.log(
                    `Opening app: ${app.name} (Bundle ID: ${app.bundle_id})`,
                  );
                  // Fallback: try using the bundle ID as a protocol
                  try {
                    await openPath(app.bundle_id);
                  } catch {
                    console.warn(`Could not open ${app.name} automatically`);
                  }
                }
              }
              setOpen(false);
              setSearch("");
            } catch (error) {
              console.error(`Failed to open ${app.name}:`, error);
            }
          },
        };

        // Load icon asynchronously
        getAppIcon(app).then((iconUrl) => {
          appItem.icon = iconUrl;
          // Update the apps signal to trigger re-render
          setSystemApps(prev => {
            const newApps = [...prev];
            const appIndex = newApps.findIndex(a => a.id === appItem.id);
            if (appIndex !== -1) {
              newApps[appIndex] = { ...newApps[appIndex], icon: iconUrl };
            }
            return newApps;
          });
        }).catch(() => {
          // Keep default emoji if icon loading fails
        });

        return appItem;
      });
        setSystemApps(apps);
        setAppsLoaded(true);
        console.log(`Successfully loaded ${apps.length} applications`);
      } else {
        console.error("Failed to load applications:", result.error);
      }
    } catch (error) {
      console.error("Error loading system applications:", error);
    } finally {
      setAppsLoading(false);
    }
  };

  // Commands with real Tauri integration - using createMemo for reactive updates
  const commandGroups = createMemo(() => {
    console.log(
      `Computing commandGroups - appsLoading: ${appsLoading()}, appsLoaded: ${appsLoaded()}, systemApps length: ${systemApps().length}`,
    );

    return [
      {
        heading: "System Applications",
        items: appsLoading()
          ? [
              {
                id: "loading-apps",
                title: "Loading applications...",
                icon: "⏳",
                type: "action" as const,
                action: () => {},
              },
            ]
          : systemApps().length > 0
            ? systemApps()
            : [
                {
                  id: "no-apps",
                  title: "No applications found",
                  icon: "🔍",
                  type: "action" as const,
                  action: () => {},
                },
              ],
      },
      {
        heading: "Actions",
        items: [
          {
            id: "action-debug-apps",
            title: "Debug Applications",
            subtitle: `Debug: loading=${appsLoading()}, loaded=${appsLoaded()}, count=${systemApps().length}`,
            icon: "🐛",
            keywords: ["debug", "test", "applications", "apps"],
            type: "action" as const,
            action: async () => {
              console.log("=== DEBUG INFO ===");
              console.log(`appsLoading: ${appsLoading()}`);
              console.log(`appsLoaded: ${appsLoaded()}`);
              console.log(`systemApps length: ${systemApps().length}`);
              console.log(`First few apps:`, systemApps().slice(0, 3));

              alert(
                `Debug Info:\n` +
                  `Loading: ${appsLoading()}\n` +
                  `Loaded: ${appsLoaded()}\n` +
                  `Apps count: ${systemApps().length}\n\n` +
                  `Check console for details`,
              );
            },
          },
          {
            id: "action-refresh-apps",
            title: "Refresh Applications",
            subtitle: "Reload system applications list",
            icon: "🔄",
            keywords: ["refresh", "reload", "applications", "apps"],
            type: "action" as const,
            action: async () => {
              setAppsLoaded(false); // Reset loading state to allow refresh
              await loadSystemApplications();
              // Keep command palette open after refresh so user can see the results
              setSearch("");
            },
          },
          {
            id: "action-frontmost-app",
            title: "Get Frontmost App",
            subtitle: "Show current active application",
            icon: "🎯",
            keywords: ["frontmost", "active", "current", "app"],
            type: "action" as const,
            action: async () => {
              try {
                const result = await commands.getFrontmostApp();
                if (result.status === "ok" && result.data) {
                  alert(
                    `Frontmost Application:\nName: ${result.data.name}\nBundle ID: ${result.data.bundle_id}`,
                  );
                } else {
                  alert("No frontmost application found");
                }
              } catch (error) {
                console.error("Failed to get frontmost app:", error);
              }
              setOpen(false);
              setSearch("");
            },
          },
          {
            id: "action-hide-apps",
            title: "Hide All Apps Except Frontmost",
            subtitle: "Minimize all background apps (macOS only)",
            icon: "👁️",
            keywords: ["hide", "minimize", "apps", "macos"],
            type: "action" as const,
            action: async () => {
              try {
                const result = await commands.hideAllAppsExceptFrontmost();
                if (result.status === "ok") {
                  console.log("Successfully hid background apps");
                } else {
                  console.error("Failed to hide apps:", result.error);
                }
              } catch (error) {
                console.error("Failed to hide apps:", error);
              }
              setOpen(false);
              setSearch("");
            },
          },
          {
            id: "action-shortcuts-status",
            title: "Global Shortcuts Status",
            subtitle: globalShortcutsRegistered()
              ? "Alt+K and Alt+P enabled"
              : "Global shortcuts disabled",
            icon: globalShortcutsRegistered() ? "✅" : "❌",
            keywords: ["shortcuts", "global", "status", "keyboard"],
            type: "action" as const,
            action: async () => {
              alert(
                `Global Shortcuts Status:\n\n` +
                  `Alt+K (Show Command Palette): ${globalShortcutsRegistered() ? "✅ Active" : "❌ Inactive"}\n` +
                  `Alt+P (Toggle Window): ${globalShortcutsRegistered() ? "✅ Active" : "❌ Inactive"}\n\n` +
                  `Local Shortcuts:\n` +
                  `Cmd/Ctrl+K: Show Command Palette\n` +
                  `ESC: Close/Hide Window`,
              );
            },
          },
          {
            id: "action-system-info",
            title: "System Information",
            subtitle: "View system details",
            icon: "ℹ️",
            keywords: ["system", "info", "details", "about"],
            type: "action" as const,
            action: async () => {
              try {
                const result = await commands.getSystemInfo();
                alert(
                  `System Information:\nOS: ${result.os}\nArchitecture: ${result.arch}`,
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
            type: "action" as const,
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
            type: "action" as const,
            action: async () => {
              if (confirm("Are you sure you want to quit the application?")) {
                try {
                  await commands.executeCommand("exit", []);
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
            type: "web" as const,
            action: async () => {
              try {
                await open("https://www.google.com");
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
            type: "web" as const,
            action: async () => {
              try {
                await open("https://github.com");
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
            type: "web" as const,
            action: async () => {
              try {
                await open("https://cmdk-solid.vercel.app/");
              } catch (error) {
                console.error("Failed to open CMDK docs:", error);
              }
            },
          },
        ],
      },
      {
        heading: "Plugins",
        items: pluginCommands(),
      },
    ];
  });

  const handleKeyDown = (e: KeyboardEvent) => {
    // Cmd/Ctrl + K to open command palette (local shortcut)
    if ((e.metaKey || e.ctrlKey) && e.key === "k") {
      e.preventDefault();
      setOpen(true);
    }
    // Escape to close or hide window
    if (e.key === "Escape") {
      e.preventDefault();
      if (open()) {
        // If command palette is open, just close it
        setOpen(false);
        setSearch("");
      } else {
        // If command palette is already closed, hide the window
        commands.hideWindow();
      }
    }
  };

  onMount(() => {
    document.addEventListener("keydown", handleKeyDown);
  });

  onCleanup(async () => {
    document.removeEventListener("keydown", handleKeyDown);

    // Unregister global shortcuts only if they were registered
    if (globalShortcutsRegistered()) {
      try {
        await unregister("alt+k");
        await unregister("alt+p");
        console.log("Global shortcuts unregistered");
      } catch (error) {
        console.error("Failed to unregister global shortcuts:", error);
      }
    }
  });

  // Load applications on mount and when command palette is first opened
  createEffect(() => {
    if (open() && !appsLoaded() && !appsLoading()) {
      console.log("Effect triggered - loading system apps");
      loadSystemApplications();
    }
  });

  // Also load apps immediately on component mount
  onMount(() => {
    console.log("Component mounted - checking if apps should load");
    if (!appsLoaded() && !appsLoading()) {
      console.log("Loading apps on mount");
      loadSystemApplications();
    }
  });

  // Auto-focus input when command palette opens
  createEffect(() => {
    if (open()) {
      // Small delay to ensure the input is rendered
      setTimeout(() => {
        const input = document.querySelector(
          ".raycast-input",
        ) as HTMLInputElement;
        if (input) {
          input.focus();
          input.select();
        }
      }, 100);
    }
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
                  <path
                    d="M21 21L16.5 16.5M19 11C19 15.4183 15.4183 19 11 19C6.58172 19 3 15.4183 3 11C3 6.58172 6.58172 3 11 3C15.4183 3 19 6.58172 19 11Z"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
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
                    <path
                      d="M9.75 9.75L14.25 14.25M14.25 9.75L9.75 14.25M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
                <div class="raycast-empty-text">No results found</div>
                <div class="raycast-empty-subtitle">
                  Try searching for something else
                </div>
              </Command.Empty>

              {/* Command Groups */}
              {commandGroups().map((group) => (
                <Command.Group key={group.heading} heading={group.heading}>
                  <div class="raycast-group-header">{group.heading}</div>
                  {group.items.map((item) => (
                    <Command.Item
                      key={item.id}
                      value={`${item.title} ${item.subtitle || ""} ${item.keywords?.join(" ") || ""}`}
                      onSelect={() => handleSelect(item)}
                      class="raycast-item"
                    >
                      <div class="raycast-item-icon">
                      {typeof item.icon === "string" && item.icon.startsWith("data:") ? (
                        <img src={item.icon} alt="" class="raycast-app-icon" />
                      ) : (
                        item.icon
                      )}
                    </div>
                      <div class="raycast-item-content">
                        <div class="raycast-item-title">{item.title}</div>
                        {item.subtitle && (
                          <div class="raycast-item-subtitle">
                            {item.subtitle}
                          </div>
                        )}
                      </div>
                      {item.shortcut && (
                        <div class="raycast-item-shortcut">
                          <kbd class="raycast-kbd raycast-kbd-small">
                            {item.shortcut.split("+").map((key, index) => (
                              <span key={index}>
                                {key === "Cmd"
                                  ? "⌘"
                                  : key === "Shift"
                                    ? "⇧"
                                    : key === "Alt"
                                      ? "⌥"
                                      : key === "Ctrl"
                                        ? "⌃"
                                        : key.toUpperCase()}
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
          max-width: 100%;
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
          font-family:
            -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
            "Helvetica Neue", Arial, sans-serif;
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
          font-family:
            "SF Mono", Monaco, "Cascadia Code", "Roboto Mono", Consolas,
            "Courier New", monospace;
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

        .raycast-app-icon {
          width: 24px;
          height: 24px;
          object-fit: contain;
          border-radius: 4px;
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
