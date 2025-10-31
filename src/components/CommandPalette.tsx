import {
  createSignal,
  onMount,
  onCleanup,
  createEffect,
  createMemo,
  Show,
  For,
} from "solid-js";
import { Command } from "cmdk-solid";
import { pluginManager } from "../plugins/PluginManager";
import { commands } from "../bindings";
import { openPath } from "@tauri-apps/plugin-opener";
import { register, unregister } from "@tauri-apps/plugin-global-shortcut";
import AIChatInterface from "./AIChatInterface";
import { fuzzySearch } from "../utils/fuzzySearch";
import {
  getRecentApps,
  getFrequentApps,
  addRecentApp,
  type RecentApp,
} from "../utils/recentApps";
import {
  categorizeApp,
  groupAppsByCategory,
  getCategoriesWithCounts,
  APP_CATEGORIES,
  type AppCategory,
} from "../utils/appCategories";

interface CommandItem {
  id: string;
  title: string;
  subtitle?: string;
  icon?: string;
  keywords?: string[];
  type: "app" | "action" | "web" | "plugin";
  action: () => void | Promise<void>;
  score?: number; // For ranking search results
  bundleId?: string; // For app tracking
  category?: AppCategory; // For categorization
}

// UI Constants
const SKELETON_ITEMS_COUNT = 6;
const ANIMATION_DELAY_MS = 20;

interface CommandPaletteProps {
  isVisible?: boolean;
  onHide?: () => void;
}

export default function CommandPalette(props: CommandPaletteProps) {
  const [open, setOpen] = createSignal(props.isVisible ?? true); // Use props or default to true
  const [search, setSearch] = createSignal("");
  const [pluginCommands, setPluginCommands] = createSignal<CommandItem[]>([]);
  const [systemApps, setSystemApps] = createSignal<CommandItem[]>([]);
  const [recentApps, setRecentApps] = createSignal<RecentApp[]>([]);
  const [frequentApps, setFrequentApps] = createSignal<RecentApp[]>([]);
  const [appsLoading, setAppsLoading] = createSignal(false);
  const [appsLoaded, setAppsLoaded] = createSignal(false);
  const [iconCache, setIconCache] = createSignal<Map<string, string>>(
    new Map(),
  );
  const [globalShortcutsRegistered, setGlobalShortcutsRegistered] =
    createSignal(false);
  const [fileSearchResults, setFileSearchResults] = createSignal<any[]>([]);
  const [fileSearchLoading, setFileSearchLoading] = createSignal(false);
  const [groupByCategory, setGroupByCategory] = createSignal(false); // Toggle for category grouping

  // New states for AI Chat integration
  const [currentMode, setCurrentMode] = createSignal<"command" | "chat">(
    "command",
  );
  const [isAIChatReady, setIsAIChatReady] = createSignal(false);

  // Initialize plugins on mount
  onMount(async () => {
    console.log("CommandPalette mounting...", { open: open() });

    try {
      // Check if AI agent is available
      try {
        const agentStatus = await commands.getAgentStatus();
        setIsAIChatReady(agentStatus.status === "ok");
      } catch (error) {
        console.log("AI agent not available:", error);
        setIsAIChatReady(false);
      }

      // Load example screenshot plugin
      // await pluginManager.loadPlugin('./plugins/example-screenshot/index.tsx');

      // Update plugin commands
      updatePluginCommands();

      // Register global shortcuts
      try {
        await register("alt+k", async () => {
          console.log("Alt+K global shortcut triggered");
          setOpen(true);
          setCurrentMode("command");
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

        // Add Alt+C for AI Chat
        if (isAIChatReady()) {
          await register("alt+c", async () => {
            console.log("Alt+C global shortcut triggered - open AI Chat");
            setOpen(true);
            setCurrentMode("chat");
            setTimeout(() => {
              const input = document.querySelector(
                ".chat-input",
              ) as HTMLTextAreaElement;
              if (input) {
                input.focus();
              }
            }, 100);
          });
        }

        setGlobalShortcutsRegistered(true);
        console.log("Global shortcuts registered successfully");
      } catch (error) {
        console.error("Failed to register global shortcuts:", error);
        setGlobalShortcutsRegistered(false);
      }

      // Load system apps immediately after mount
      console.log("Loading system apps on mount...");
      await loadSystemApplications();

      // Load recent and frequent apps
      await loadRecentAndFrequentApps();
    } catch (error) {
      console.error("Failed to load plugins:", error);
    }
  });

  // Load recent and frequent apps
  const loadRecentAndFrequentApps = async () => {
    try {
      const [recent, frequent] = await Promise.all([
        getRecentApps(),
        getFrequentApps(15),
      ]);
      setRecentApps(recent);
      setFrequentApps(frequent);
    } catch (error) {
      console.error("Failed to load recent/frequent apps:", error);
    }
  };

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
            bundleId: app.bundle_id,
            category: categorizeApp(app.bundle_id, app.name), // Add category
            action: async () => {
              try {
                // Track this app as recently used
                await addRecentApp(
                  `system-app-${index}`,
                  app.name,
                  app.bundle_id,
                );

                // Refresh recent apps list
                await loadRecentAndFrequentApps();

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
          getAppIcon(app)
            .then((iconUrl) => {
              appItem.icon = iconUrl;
              // Update the apps signal to trigger re-render
              setSystemApps((prev) => {
                const newApps = [...prev];
                const appIndex = newApps.findIndex((a) => a.id === appItem.id);
                if (appIndex !== -1) {
                  newApps[appIndex] = { ...newApps[appIndex], icon: iconUrl };
                }
                return newApps;
              });
            })
            .catch(() => {
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

  // File search function
  const performFileSearch = async (searchPattern: string) => {
    if (!searchPattern || fileSearchLoading()) return;

    setFileSearchLoading(true);
    try {
      const result = await commands.searchFiles(
        {
          pattern: searchPattern,
          max_results: 20,
          file_extensions: null,
          include_hidden: false,
        },
        null,
      );

      if (result.status === "ok") {
        const fileItems = result.data.map((file, index) => ({
          id: `file-search-${index}`,
          title: file.path.split("/").pop() || file.path,
          subtitle: `${file.path}${file.line_number ? `:${file.line_number}` : ""}`,
          icon: getFileIcon(file.file_type),
          keywords: [file.path, file.content || ""].join(" ").toLowerCase(),
          type: "action" as const,
          action: async () => {
            try {
              // Open the file at the specific line number if available
              if (file.line_number) {
                await openPath(`${file.path}:${file.line_number}`);
              } else {
                await openPath(file.path);
              }
              setOpen(false);
              setSearch("");
            } catch (error) {
              console.error("Failed to open file:", error);
            }
          },
        }));
        setFileSearchResults(fileItems);
      } else {
        console.error("File search failed:", result.error);
        setFileSearchResults([]);
      }
    } catch (error) {
      console.error("File search error:", error);
      setFileSearchResults([]);
    } finally {
      setFileSearchLoading(false);
    }
  };

  // Get file icon based on file type
  const getFileIcon = (fileType: string): string => {
    const iconMap: Record<string, string> = {
      Rust: "🦀",
      JavaScript: "🟨",
      React: "⚛️",
      TypeScript: "🔷",
      Python: "🐍",
      Java: "☕",
      "C++": "🔧",
      C: "⚙️",
      Go: "🐹",
      PHP: "🐘",
      Ruby: "💎",
      Swift: "🦉",
      HTML: "🌐",
      CSS: "🎨",
      JSON: "📄",
      YAML: "📝",
      Markdown: "📖",
      Text: "📄",
      SQL: "🗃️",
      Shell: "💻",
      Docker: "🐳",
      Git: "📦",
      Unknown: "📄",
    };
    return iconMap[fileType] || "📄";
  };

  // Get recent apps as command items
  const recentAppsItems = createMemo(() => {
    const recent = recentApps();
    const allApps = systemApps();

    return recent
      .slice(0, 8)
      .map((recentApp) => {
        const appItem = allApps.find(
          (app) => app.bundleId === recentApp.bundleId,
        );
        if (appItem) {
          return { ...appItem, score: recentApp.usageCount };
        }
        return null;
      })
      .filter(Boolean) as CommandItem[];
  });

  // Get frequent apps as command items
  const frequentAppsItems = createMemo(() => {
    const frequent = frequentApps();
    const allApps = systemApps();

    return frequent
      .map((freqApp) => {
        const appItem = allApps.find(
          (app) => app.bundleId === freqApp.bundleId,
        );
        if (appItem) {
          return { ...appItem, score: freqApp.usageCount };
        }
        return null;
      })
      .filter(Boolean) as CommandItem[];
  });

  // Optimized search with fuzzy matching
  const searchResults = createMemo(() => {
    const query = search();
    if (!query || query.startsWith("#")) {
      return null; // No search active or file search
    }

    // Combine all searchable items
    const allItems = [
      ...systemApps(),
      ...pluginCommands(),
      // Add action items, web items etc.
    ];

    // Use fuzzy search
    const results = fuzzySearch(query, allItems);

    return results.slice(0, 50); // Limit results for performance
  });

  // Commands with real Tauri integration - using createMemo for reactive updates
  const commandGroups = createMemo(() => {
    console.log(
      `Computing commandGroups - appsLoading: ${appsLoading()}, appsLoaded: ${appsLoaded()}, systemApps length: ${systemApps().length}`,
    );

    const searchQuery = search();
    const hasSearch = searchQuery && !searchQuery.startsWith("#");

    // If searching, return search results
    if (hasSearch) {
      const results = searchResults();
      if (results && results.length > 0) {
        return [
          {
            heading: "Search Results",
            items: results,
          },
        ];
      } else {
        return [
          {
            heading: "No Results",
            items: [
              {
                id: "no-results",
                title: "No results found",
                icon: "🔍",
                type: "action" as const,
                action: () => {},
              },
            ],
          },
        ];
      }
    }

    // Default view with recent and all apps
    const groups: Array<{ heading: string; items: CommandItem[] }> = [];

    // Add recent apps group if available
    const recentItems = recentAppsItems();
    if (recentItems.length > 0) {
      groups.push({
        heading: "Recent Applications",
        items: recentItems,
      });
    }

    // Add system apps - either grouped by category or all together
    if (groupByCategory()) {
      // Group by category
      const categories = getCategoriesWithCounts(systemApps());
      categories.forEach(({ category, apps }) => {
        if (apps.length > 0) {
          groups.push({
            heading: `${category.icon} ${category.name}`,
            items: apps,
          });
        }
      });
    } else {
      // All apps in one group
      groups.push({
        heading: "System Applications",
        items: appsLoading()
          ? Array(SKELETON_ITEMS_COUNT)
              .fill(null)
              .map((_, i) => ({
                id: `loading-skeleton-${i}`,
                title: "Loading...",
                subtitle: "Please wait",
                icon: "⏳",
                type: "action" as const,
                action: () => {},
              }))
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
      });
    }

    return [
      ...groups,
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
            id: "action-toggle-categories",
            title: groupByCategory() ? "Show All Apps" : "Group by Category",
            subtitle: groupByCategory()
              ? "Display apps in a single list"
              : "Organize apps by type (Browsers, Development, etc.)",
            icon: groupByCategory() ? "📋" : "📁",
            keywords: ["categories", "group", "organize", "filter"],
            type: "action" as const,
            action: async () => {
              setGroupByCategory(!groupByCategory());
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
            id: "action-ai-chat",
            title: "AI Chat",
            subtitle: isAIChatReady()
              ? "Chat with AI assistant"
              : "AI not available",
            icon: isAIChatReady() ? "🤖" : "❌",
            keywords: ["ai", "chat", "assistant", "gpt"],
            type: "action" as const,
            action: async () => {
              if (isAIChatReady()) {
                setCurrentMode("chat");
              } else {
                alert(
                  "AI Chat is not available. Please check your AI configuration.",
                );
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
              try {
                const result = await commands.openSettingsWindow();
                if (result.status === "ok") {
                  console.log("Settings window opened successfully");
                } else {
                  console.error(
                    "Failed to open settings window:",
                    result.error,
                  );
                }
              } catch (error) {
                console.error("Failed to open settings:", error);
              }
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
                await openPath("https://www.google.com");
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
                await openPath("https://github.com");
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
                await openPath("https://cmdk-solid.vercel.app/");
              } catch (error) {
                console.error("Failed to open CMDK docs:", error);
              }
            },
          },
        ],
      },
      // Add file search results when searching with #
      ...(search().startsWith("#") && fileSearchResults().length > 0
        ? [
            {
              heading: "File Search Results",
              items: fileSearchResults(),
            },
          ]
        : []),
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
      setCurrentMode("command");
    }

    // Tab to switch between Command and Chat modes
    if (e.key === "Tab" && open()) {
      e.preventDefault();
      if (currentMode() === "command" && isAIChatReady()) {
        setCurrentMode("chat");
        // Focus chat input after mode switch
        setTimeout(() => {
          const chatInput = document.querySelector(
            ".chat-input",
          ) as HTMLTextAreaElement;
          if (chatInput) {
            chatInput.focus();
          }
        }, 100);
      } else {
        setCurrentMode("command");
        // Focus command input after mode switch
        setTimeout(() => {
          const commandInput = document.querySelector(
            ".raycast-input",
          ) as HTMLInputElement;
          if (commandInput) {
            commandInput.focus();
            commandInput.select();
          }
        }, 100);
      }
    }

    // Escape to close or hide window, or return to command mode
    if (e.key === "Escape") {
      e.preventDefault();
      if (open()) {
        if (currentMode() === "chat") {
          // Return to command mode instead of closing
          setCurrentMode("command");
          setSearch("");
        } else {
          // If in command mode, close the palette
          setOpen(false);
          setSearch("");
        }
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

  // File search effect - trigger when search starts with #
  createEffect(() => {
    const searchValue = search();
    if (searchValue.startsWith("#") && searchValue.length > 1) {
      const searchPattern = searchValue.slice(1); // Remove the # prefix
      performFileSearch(searchPattern);
    } else {
      // Clear file search results when not searching with #
      setFileSearchResults([]);
    }
  });

  const handleSelect = (item: CommandItem) => {
    item.action();
    // Don't close if switching to chat mode
    if (item.id !== "action-ai-chat") {
      setOpen(false);
      setSearch("");
    }
  };

  return (
    <>
      {/* Plugin Container */}
      <div
        id="plugin-container"
        class="pointer-events-none fixed top-0 right-0 bottom-0 left-0 z-[10000]"
      ></div>

      <div
        class={`fixed inset-0 z-[9999] flex items-center justify-center transition-all duration-300 ${open() ? "visible opacity-100" : "invisible opacity-0"}`}
      >
        {/* Backdrop */}
        <div
          class="absolute inset-0 bg-black/40 backdrop-blur-md"
          onClick={() => setOpen(false)}
        />

        {/* Main Container */}
        <div class="relative flex max-h-[80vh] w-full max-w-[680px] flex-col">
          {/* Mode Indicator and Switcher */}
          <div class="flex items-center justify-between rounded-t-2xl border border-b-0 border-white/10 bg-gray-900/95 p-3 backdrop-blur-xl sm:p-5">
            <div class="flex gap-1 rounded-lg bg-white/5 p-1">
              <button
                class={`flex cursor-pointer items-center gap-1.5 rounded-md border-0 bg-transparent px-3 py-1.5 text-sm font-medium text-white/60 transition-all duration-200 ${currentMode() === "command" ? "bg-blue-500/20 text-blue-400" : "hover:text-white/80"}`}
                onClick={() => setCurrentMode("command")}
              >
                <span class="text-sm">🔍</span>
                <span class="font-medium">Commands</span>
              </button>
              <Show when={isAIChatReady()}>
                <button
                  class={`flex cursor-pointer items-center gap-1.5 rounded-md border-0 bg-transparent px-3 py-1.5 text-sm font-medium text-white/60 transition-all duration-200 ${currentMode() === "chat" ? "bg-blue-500/20 text-blue-400" : "hover:text-white/80"}`}
                  onClick={() => setCurrentMode("chat")}
                >
                  <span class="text-sm">🤖</span>
                  <span class="font-medium">AI Chat</span>
                </button>
              </Show>
            </div>
            <div class="flex items-center gap-1.5 text-xs text-white/40">
              <kbd class="inline-flex min-h-4 items-center justify-center gap-px rounded border border-white/20 bg-white/10 px-1.5 py-0.5 font-mono text-[10px] leading-none font-medium text-white/80">
                <span>Tab</span>
              </kbd>
              <span class="font-normal">to switch</span>
            </div>
          </div>

          {/* Content based on mode */}
          <Show when={currentMode() === "command"}>
            <Command class="animate-fade-in flex max-h-[60vh] flex-col overflow-hidden rounded-b-2xl border border-t-0 border-white/10 bg-gray-900/95 shadow-2xl backdrop-blur-xl">
              {/* Search Input */}
              <div class="flex items-center gap-3 border-b border-white/10 p-4 sm:p-5">
                <div class="flex flex-shrink-0 items-center justify-center text-white/60 transition-colors duration-200 group-focus-within:text-blue-400/80">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M21 21L16.5 16.5M19 11C19 15.4183 15.4183 19 11 19C6.58172 19 3 15.4183 3 11C3 6.58172 6.58172 3 11 3C15.4183 3 19 6.58172 19 11Z"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    />
                  </svg>
                </div>
                <Command.Input
                  value={search()}
                  onValueChange={setSearch}
                  placeholder="Search for apps and commands... (use # to search files)"
                  class="flex-1 border-none bg-transparent text-base leading-6 font-normal text-white/90 outline-none placeholder:text-white/50 focus:outline-none"
                />
                <div class="ml-auto flex items-center gap-2">
                  <kbd class="inline-flex items-center justify-center gap-px rounded border border-blue-500/30 bg-blue-500/20 px-1.5 py-1 font-mono text-[11px] leading-none font-medium text-blue-400">
                    <span>⌘</span>
                    <span>K</span>
                  </kbd>
                  <span class="text-xs font-medium text-white/40">or</span>
                  <kbd class="inline-flex items-center justify-center gap-px rounded border border-white/20 bg-white/10 px-1.5 py-1 font-mono text-[11px] leading-none font-medium text-white/80">
                    <span>ESC</span>
                  </kbd>
                </div>
              </div>

              {/* Command List */}
              <Command.List class="max-h-[400px] overflow-y-auto py-2 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-sm [&::-webkit-scrollbar-thumb]:bg-white/20 [&::-webkit-scrollbar-thumb:hover]:bg-white/30 [&::-webkit-scrollbar-track]:bg-transparent">
                {/* Empty State */}
                <Command.Empty class="flex flex-col items-center justify-center p-12 text-center">
                  <div class="mb-4 text-white/40">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M9.75 9.75L14.25 14.25M14.25 9.75L9.75 14.25M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                      />
                    </svg>
                  </div>
                  <div class="mb-1 text-base font-medium text-white/80">
                    No results found
                  </div>
                  <div class="text-sm text-white/50">
                    Try searching for something else
                  </div>
                </Command.Empty>

                {/* Command Groups */}
                {commandGroups().map((group) => (
                  <Command.Group heading={group.heading}>
                    <div class="flex items-center justify-between px-5 py-2 pr-5 pl-5 text-[11px] font-semibold tracking-wide text-white/50 uppercase select-none">
                      {group.heading}
                      {group.heading === "Recent Applications" && (
                        <span class="ml-1.5 text-[10px]">⭐</span>
                      )}
                    </div>
                    {group.items.map((item, index) => (
                      <Command.Item
                        value={`${item.title} ${item.subtitle || ""} ${item.keywords?.join(" ") || ""}`}
                        onSelect={() => handleSelect(item)}
                        class={`animate-slide-up mx-2 flex cursor-pointer items-center rounded-lg px-5 py-2 opacity-0 transition-all duration-200 outline-none select-none hover:scale-[1.01] hover:bg-white/8 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500/50 aria-selected:scale-[1.02] aria-selected:border aria-selected:border-blue-500/30 aria-selected:bg-blue-500/15 aria-selected:shadow-[0_0_20px_rgba(59,130,246,0.1)]`}
                        style={{
                          "animation-delay": `${index * ANIMATION_DELAY_MS}ms`,
                        }}
                      >
                        <div class="mr-3 flex h-8 w-8 flex-shrink-0 items-center justify-center text-base transition-transform duration-200 group-hover:scale-110">
                          {typeof item.icon === "string" &&
                          item.icon.startsWith("data:") ? (
                            <img
                              src={item.icon}
                              alt=""
                              class="h-6 w-6 rounded-md object-cover transition-all duration-200 hover:shadow-lg"
                              loading="lazy"
                            />
                          ) : (
                            item.icon
                          )}
                        </div>
                        <div class="min-w-0 flex-1">
                          <div class="overflow-hidden text-sm leading-tight font-medium text-ellipsis whitespace-nowrap text-white/90">
                            {item.title}
                          </div>
                          {item.subtitle && (
                            <div class="mt-px overflow-hidden text-xs leading-tight text-ellipsis whitespace-nowrap text-white/60">
                              {item.subtitle}
                            </div>
                          )}
                        </div>
                        {!groupByCategory() &&
                          item.category &&
                          item.type === "app" && (
                            <div
                              class="ml-2 flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold transition-all duration-200"
                              style={{
                                background: `${item.category.color}20`,
                                border: `1px solid ${item.category.color}40`,
                                color: item.category.color,
                              }}
                            >
                              <span class="text-[10px]">
                                {item.category.icon}
                              </span>
                              <span class="font-medium whitespace-nowrap">
                                {item.category.name}
                              </span>
                            </div>
                          )}
                        {item.score && item.score > 1 && (
                          <div class="ml-2 flex items-center rounded-full border border-blue-500/30 bg-blue-500/15 px-2 py-0.5 text-[10px] font-semibold text-blue-400">
                            <span class="whitespace-nowrap">
                              Used {item.score}x
                            </span>
                          </div>
                        )}
                        {item.shortcut && (
                          <div class="ml-3 flex-shrink-0">
                            <kbd class="inline-flex min-h-4 items-center justify-center gap-px rounded border border-white/20 bg-white/10 px-1 py-0.5 font-mono text-[10px] leading-none font-medium text-white/80">
                              {item.shortcut.split("+").map((key: string) => (
                                <span>
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
          </Show>

          <Show when={currentMode() === "chat" && isAIChatReady()}>
            <div class="animate-fade-in overflow-hidden rounded-b-2xl border border-t-0 border-white/10 bg-gray-900/95 shadow-2xl backdrop-blur-xl">
              <AIChatInterface />
            </div>
          </Show>

          <Show when={currentMode() === "chat" && !isAIChatReady()}>
            <div class="flex flex-col items-center gap-4 rounded-b-2xl border border-t-0 border-white/10 bg-gray-900/95 p-12 text-center backdrop-blur-xl">
              <div class="text-5xl opacity-60">⚠️</div>
              <div class="text-xl font-semibold text-white/90">
                AI Chat Unavailable
              </div>
              <div class="max-w-[300px] text-sm leading-relaxed text-white/60">
                Please configure your AI provider settings to use this feature.
              </div>
              <button
                class="cursor-pointer rounded-lg border border-blue-500/30 bg-blue-500/20 px-4 py-2 text-sm font-medium text-blue-400 transition-all duration-200 hover:-translate-y-px hover:bg-blue-500/30"
                onClick={() => setCurrentMode("command")}
              >
                Back to Commands
              </button>
            </div>
          </Show>
        </div>
      </div>
    </>
  );
}
