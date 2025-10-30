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
  type RecentApp 
} from "../utils/recentApps";
import { 
  categorizeApp, 
  groupAppsByCategory, 
  getCategoriesWithCounts,
  APP_CATEGORIES,
  type AppCategory 
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

export default function CommandPalette() {
  const [open, setOpen] = createSignal(true); // Auto-open on app start
  const [search, setSearch] = createSignal("");
  const [pluginCommands, setPluginCommands] = createSignal<CommandItem[]>([]);
  const [systemApps, setSystemApps] = createSignal<CommandItem[]>([]);
  const [recentApps, setRecentApps] = createSignal<RecentApp[]>([]);
  const [frequentApps, setFrequentApps] = createSignal<RecentApp[]>([]);
  const [appsLoading, setAppsLoading] = createSignal(false);
  const [appsLoaded, setAppsLoaded] = createSignal(false);
  const [iconCache, setIconCache] = createSignal<Map<string, string>>(new Map());
  const [globalShortcutsRegistered, setGlobalShortcutsRegistered] =
    createSignal(false);
  const [fileSearchResults, setFileSearchResults] = createSignal<any[]>([]);
  const [fileSearchLoading, setFileSearchLoading] = createSignal(false);
  const [groupByCategory, setGroupByCategory] = createSignal(false); // Toggle for category grouping

  // New states for AI Chat integration
  const [currentMode, setCurrentMode] = createSignal<"command" | "chat">("command");
  const [isAIChatReady, setIsAIChatReady] = createSignal(false);

  // Initialize plugins on mount
  onMount(async () => {
    console.log("CommandPalette mounting...");

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
                app.bundle_id
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

  // File search function
  const performFileSearch = async (searchPattern: string) => {
    if (!searchPattern || fileSearchLoading()) return;

    setFileSearchLoading(true);
    try {
      const result = await commands.searchFiles({
        pattern: searchPattern,
        max_results: 20,
        file_extensions: null,
        include_hidden: false
      }, null);

      if (result.status === "ok") {
        const fileItems = result.data.map((file, index) => ({
          id: `file-search-${index}`,
          title: file.path.split('/').pop() || file.path,
          subtitle: `${file.path}${file.line_number ? `:${file.line_number}` : ''}`,
          icon: getFileIcon(file.file_type),
          keywords: [file.path, file.content || ''].join(' ').toLowerCase(),
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
      "Rust": "🦀",
      "JavaScript": "🟨",
      "React": "⚛️",
      "TypeScript": "🔷",
      "Python": "🐍",
      "Java": "☕",
      "C++": "🔧",
      "C": "⚙️",
      "Go": "🐹",
      "PHP": "🐘",
      "Ruby": "💎",
      "Swift": "🦉",
      "HTML": "🌐",
      "CSS": "🎨",
      "JSON": "📄",
      "YAML": "📝",
      "Markdown": "📖",
      "Text": "📄",
      "SQL": "🗃️",
      "Shell": "💻",
      "Docker": "🐳",
      "Git": "📦",
      "Unknown": "📄"
    };
    return iconMap[fileType] || "📄";
  };

  // Get recent apps as command items
  const recentAppsItems = createMemo(() => {
    const recent = recentApps();
    const allApps = systemApps();
    
    return recent.slice(0, 8).map(recentApp => {
      const appItem = allApps.find(app => app.bundleId === recentApp.bundleId);
      if (appItem) {
        return { ...appItem, score: recentApp.usageCount };
      }
      return null;
    }).filter(Boolean) as CommandItem[];
  });

  // Get frequent apps as command items
  const frequentAppsItems = createMemo(() => {
    const frequent = frequentApps();
    const allApps = systemApps();
    
    return frequent.map(freqApp => {
      const appItem = allApps.find(app => app.bundleId === freqApp.bundleId);
      if (appItem) {
        return { ...appItem, score: freqApp.usageCount };
      }
      return null;
    }).filter(Boolean) as CommandItem[];
  });

  // Optimized search with fuzzy matching
  const searchResults = createMemo(() => {
    const query = search();
    if (!query || query.startsWith('#')) {
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
    const hasSearch = searchQuery && !searchQuery.startsWith('#');

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
          ? Array(6).fill(null).map((_, i) => ({
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
            subtitle: isAIChatReady() ? "Chat with AI assistant" : "AI not available",
            icon: isAIChatReady() ? "🤖" : "❌",
            keywords: ["ai", "chat", "assistant", "gpt"],
            type: "action" as const,
            action: async () => {
              if (isAIChatReady()) {
                setCurrentMode("chat");
              } else {
                alert("AI Chat is not available. Please check your AI configuration.");
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
                  console.error("Failed to open settings window:", result.error);
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
      ...(search().startsWith('#') && fileSearchResults().length > 0 ? [{
        heading: "File Search Results",
        items: fileSearchResults(),
      }] : []),
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
          const chatInput = document.querySelector(".chat-input") as HTMLTextAreaElement;
          if (chatInput) {
            chatInput.focus();
          }
        }, 100);
      } else {
        setCurrentMode("command");
        // Focus command input after mode switch
        setTimeout(() => {
          const commandInput = document.querySelector(".raycast-input") as HTMLInputElement;
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
    if (searchValue.startsWith('#') && searchValue.length > 1) {
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
      <div id="plugin-container" class="plugin-container"></div>

      <div class={`raycast-dialog ${open() ? "open" : ""}`}>
        {/* Backdrop */}
        <div class="raycast-backdrop" onClick={() => setOpen(false)} />

        {/* Main Container */}
        <div class="raycast-container">
          {/* Mode Indicator and Switcher */}
          <div class="mode-switcher">
            <div class="mode-tabs">
              <button
                class={`mode-tab ${currentMode() === "command" ? "active" : ""}`}
                onClick={() => setCurrentMode("command")}
              >
                <span class="mode-icon">🔍</span>
                <span class="mode-label">Commands</span>
              </button>
              <Show when={isAIChatReady()}>
                <button
                  class={`mode-tab ${currentMode() === "chat" ? "active" : ""}`}
                  onClick={() => setCurrentMode("chat")}
                >
                  <span class="mode-icon">🤖</span>
                  <span class="mode-label">AI Chat</span>
                </button>
              </Show>
            </div>
            <div class="shortcuts-hint">
              <kbd class="raycast-kbd raycast-kbd-small">
                <span>Tab</span>
              </kbd>
              <span class="hint-text">to switch</span>
            </div>
          </div>

          {/* Content based on mode */}
          <Show when={currentMode() === "command"}>
            <Command class="raycast-palette">
              {/* Search Input */}
              <div class="raycast-search">
                <div class="raycast-search-icon">
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
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
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
                  <Command.Group heading={group.heading}>
                    <div class="raycast-group-header">
                      {group.heading}
                      {group.heading === "Recent Applications" && (
                        <span class="raycast-group-badge">⭐</span>
                      )}
                    </div>
                    {group.items.map((item, index) => (
                      <Command.Item
                        value={`${item.title} ${item.subtitle || ""} ${item.keywords?.join(" ") || ""}`}
                        onSelect={() => handleSelect(item)}
                        class="raycast-item"
                        style={{
                          "animation-delay": `${index * 20}ms`,
                        }}
                      >
                        <div class="raycast-item-icon">
                        {typeof item.icon === "string" && item.icon.startsWith("data:") ? (
                          <img 
                            src={item.icon} 
                            alt="" 
                            class="raycast-app-icon"
                            loading="lazy"
                          />
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
                        {!groupByCategory() && item.category && item.type === "app" && (
                          <div 
                            class="raycast-category-badge"
                            style={{
                              background: `${item.category.color}20`,
                              border: `1px solid ${item.category.color}40`,
                              color: item.category.color,
                            }}
                          >
                            <span class="category-icon">{item.category.icon}</span>
                            <span class="category-name">{item.category.name}</span>
                          </div>
                        )}
                        {item.score && item.score > 1 && (
                          <div class="raycast-item-badge">
                            <span class="badge-text">Used {item.score}x</span>
                          </div>
                        )}
                        {item.shortcut && (
                          <div class="raycast-item-shortcut">
                            <kbd class="raycast-kbd raycast-kbd-small">
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
            <AIChatInterface />
          </Show>

          <Show when={currentMode() === "chat" && !isAIChatReady()}>
            <div class="ai-unavailable">
              <div class="ai-unavailable-icon">⚠️</div>
              <div class="ai-unavailable-title">AI Chat Unavailable</div>
              <div class="ai-unavailable-subtitle">
                Please configure your AI provider settings to use this feature.
              </div>
              <button
                class="ai-unavailable-button"
                onClick={() => setCurrentMode("command")}
              >
                Back to Commands
              </button>
            </div>
          </Show>
        </div>
      </div>

      {/* Raycast-style CSS */}
      <style jsx global>{`
        /* Raycast-inspired styling */
        .raycast-dialog {
          position: fixed;
          inset: 0;
          z-index: 9999;
          display: flex;
          align-items: center;
          justify-content: center;
          opacity: 0;
          visibility: hidden;
          transition: opacity 0.15s ease, visibility 0.15s ease;
        }

        .raycast-dialog.open {
          opacity: 1;
          visibility: visible;
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
          max-width: 680px;
          max-height: 80vh;
          display: flex;
          flex-direction: column;
        }

        /* Mode Switcher */
        .mode-switcher {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 20px;
          background: rgba(23, 23, 23, 0.95);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-bottom: none;
          border-radius: 16px 16px 0 0;
        }

        .mode-tabs {
          display: flex;
          gap: 4px;
          background: rgba(255, 255, 255, 0.05);
          padding: 4px;
          border-radius: 8px;
        }

        .mode-tab {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          background: transparent;
          border: none;
          border-radius: 6px;
          color: rgba(255, 255, 255, 0.6);
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .mode-tab:hover {
          color: rgba(255, 255, 255, 0.8);
        }

        .mode-tab.active {
          background: rgba(59, 130, 246, 0.2);
          color: #60a5fa;
        }

        .mode-icon {
          font-size: 14px;
        }

        .mode-label {
          font-weight: 500;
        }

        .shortcuts-hint {
          display: flex;
          align-items: center;
          gap: 6px;
          color: rgba(255, 255, 255, 0.4);
          font-size: 12px;
        }

        .hint-text {
          font-weight: 400;
        }

        .raycast-palette {
          background: rgba(23, 23, 23, 0.95);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-top: none;
          border-radius: 0 0 16px 16px;
          box-shadow:
            0 20px 25px -5px rgba(0, 0, 0, 0.1),
            0 10px 10px -5px rgba(0, 0, 0, 0.04),
            0 0 0 1px rgba(255, 255, 255, 0.05);
          overflow: hidden;
          animation: raycast-enter 0.15s ease-out;
          display: flex;
          flex-direction: column;
          max-height: 60vh;
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

        @keyframes shimmer {
          0% {
            background-position: -1000px 0;
          }
          100% {
            background-position: 1000px 0;
          }
        }

        .loading-shimmer {
          background: linear-gradient(
            to right,
            rgba(255, 255, 255, 0.05) 0%,
            rgba(255, 255, 255, 0.1) 50%,
            rgba(255, 255, 255, 0.05) 100%
          );
          background-size: 1000px 100%;
          animation: shimmer 2s infinite linear;
        }

        .raycast-item[id^="loading-skeleton"] {
          pointer-events: none;
        }

        .raycast-item[id^="loading-skeleton"] .raycast-item-title,
        .raycast-item[id^="loading-skeleton"] .raycast-item-subtitle {
          background: linear-gradient(
            to right,
            rgba(255, 255, 255, 0.1) 0%,
            rgba(255, 255, 255, 0.2) 50%,
            rgba(255, 255, 255, 0.1) 100%
          );
          background-size: 1000px 100%;
          animation: shimmer 2s infinite linear;
          border-radius: 4px;
          color: transparent;
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
          transition: color 0.2s ease;
        }

        .raycast-search:focus-within .raycast-search-icon {
          color: rgba(59, 130, 246, 0.8);
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
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 8px 20px 4px;
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: rgba(255, 255, 255, 0.5);
          user-select: none;
        }

        .raycast-group-badge {
          font-size: 10px;
          margin-left: 6px;
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
          animation: item-slide-in 0.2s ease-out forwards;
          opacity: 0;
        }

        @keyframes item-slide-in {
          from {
            opacity: 0;
            transform: translateY(-4px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .raycast-item:hover {
          background: rgba(255, 255, 255, 0.08);
          transform: scale(1.01);
        }
        
        .raycast-item[aria-selected="true"] {
          background: rgba(59, 130, 246, 0.15);
          border: 1px solid rgba(59, 130, 246, 0.3);
          transform: scale(1.02);
          box-shadow: 0 0 20px rgba(59, 130, 246, 0.1);
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
          transition: transform 0.2s ease;
        }

        .raycast-item:hover .raycast-item-icon {
          transform: scale(1.1);
        }

        .raycast-app-icon {
          width: 24px;
          height: 24px;
          object-fit: contain;
          border-radius: 4px;
          transition: all 0.2s ease;
        }

        .raycast-app-icon:hover {
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
        }

        .raycast-item-content {
          flex: 1;
          min-width: 0;
        }

        .raycast-item-badge {
          display: flex;
          align-items: center;
          margin-left: 8px;
          padding: 2px 8px;
          background: rgba(59, 130, 246, 0.15);
          border: 1px solid rgba(59, 130, 246, 0.3);
          border-radius: 12px;
          font-size: 10px;
          color: #60a5fa;
          font-weight: 600;
        }

        .badge-text {
          white-space: nowrap;
        }

        .raycast-category-badge {
          display: flex;
          align-items: center;
          gap: 4px;
          margin-left: 8px;
          padding: 3px 8px;
          border-radius: 8px;
          font-size: 11px;
          font-weight: 600;
          transition: all 0.2s ease;
        }

        .category-icon {
          font-size: 10px;
        }

        .category-name {
          white-space: nowrap;
          font-weight: 500;
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

        /* AI Chat Unavailable State */
        .ai-unavailable {
          background: rgba(23, 23, 23, 0.95);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-top: none;
          border-radius: 0 0 16px 16px;
          padding: 48px 32px;
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 16px;
        }

        .ai-unavailable-icon {
          font-size: 48px;
          opacity: 0.6;
        }

        .ai-unavailable-title {
          font-size: 20px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.9);
          margin: 0;
        }

        .ai-unavailable-subtitle {
          font-size: 14px;
          color: rgba(255, 255, 255, 0.6);
          line-height: 1.5;
          max-width: 300px;
          margin: 0;
        }

        .ai-unavailable-button {
          background: rgba(59, 130, 246, 0.2);
          border: 1px solid rgba(59, 130, 246, 0.3);
          color: #60a5fa;
          padding: 8px 16px;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .ai-unavailable-button:hover {
          background: rgba(59, 130, 246, 0.3);
          transform: translateY(-1px);
        }

        /* Responsive adjustments */
        @media (max-width: 640px) {
          .raycast-dialog {
            padding-top: 8vh;
          }

          .raycast-container {
            margin: 0 12px;
            max-width: calc(100% - 24px);
          }

          .mode-switcher {
            padding: 10px 16px;
          }

          .mode-tab {
            padding: 5px 10px;
            font-size: 12px;
          }

          .mode-icon {
            font-size: 12px;
          }

          .shortcuts-hint {
            display: none;
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

          .ai-unavailable {
            padding: 32px 24px;
          }

          .ai-unavailable-title {
            font-size: 18px;
          }

          .ai-unavailable-subtitle {
            font-size: 13px;
          }
        }
      `}</style>
    </>
  );
}
