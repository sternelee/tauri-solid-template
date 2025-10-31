import { createSignal, onCleanup, onMount, For, Show } from "solid-js";
import { commands } from "../bindings";
import type {
  TextSelection,
  ToolbarAction,
  SelectionContextType,
} from "../bindings";

interface TextSelectionToolbarProps {
  selection?: TextSelection;
  position?: { x: number; y: number };
  onAction: (actionId: string) => void;
  onClose: () => void;
}

interface ActionConfig {
  id: string;
  label: string;
  icon: string;
  shortcut?: string;
  category:
    | "translation"
    | "polish"
    | "knowledge"
    | "file"
    | "search"
    | "other";
}

const DEFAULT_ACTIONS: ActionConfig[] = [
  {
    id: "translate",
    label: "翻译",
    icon: "🌐",
    shortcut: "t",
    category: "translation",
  },
  {
    id: "polish",
    label: "润色",
    icon: "✨",
    shortcut: "p",
    category: "polish",
  },
  {
    id: "add_to_knowledge",
    label: "加入知识库",
    icon: "📚",
    shortcut: "k",
    category: "knowledge",
  },
  {
    id: "search",
    label: "搜索",
    icon: "🔍",
    shortcut: "s",
    category: "search",
  },
  {
    id: "chat_with_file",
    label: "Chat with file",
    icon: "💬",
    shortcut: "c",
    category: "file",
  },
  {
    id: "open_file",
    label: "打开文件",
    icon: "📂",
    shortcut: "o",
    category: "file",
  },
  {
    id: "screenshot",
    label: "截图工具",
    icon: "📸",
    shortcut: "r",
    category: "other",
  },
];

export default function TextSelectionToolbar(props: TextSelectionToolbarProps) {
  const [actions, setActions] = createSignal<ToolbarAction[]>([]);
  const [loading, setLoading] = createSignal(true);
  const [visible, setVisible] = createSignal(false);
  const [autoHideTimer, setAutoHideTimer] = createSignal<NodeJS.Timeout | null>(
    null,
  );

  // Get appropriate actions based on selection type
  const getContextualActions = (
    contextType: SelectionContextType,
  ): ActionConfig[] => {
    const baseActions = DEFAULT_ACTIONS.filter((action) => {
      switch (contextType) {
        case "FilePath":
          return [
            "translate",
            "polish",
            "add_to_knowledge",
            "search",
            "chat_with_file",
            "open_file",
          ].includes(action.id);
        case "Url":
          return ["translate", "polish", "add_to_knowledge", "search"];
        case "Email":
          return ["translate", "polish", "add_to_knowledge", "search"];
        case "PhoneNumber":
          return ["translate", "polish", "add_to_knowledge", "search"];
        case "Code":
          return ["translate", "polish", "add_to_knowledge", "search"];
        default:
          return !["chat_with_file", "open_file"].includes(action.id);
      }
    });

    return baseActions;
  };

  // Auto-hide timer management
  const startAutoHideTimer = () => {
    clearAutoHideTimer();
    const timer = setTimeout(() => {
      props.onClose();
    }, 5000); // Auto-hide after 5 seconds
    setAutoHideTimer(timer);
  };

  const clearAutoHideTimer = () => {
    if (autoHideTimer()) {
      clearTimeout(autoHideTimer());
      setAutoHideTimer(null);
    }
  };

  // Handle keyboard shortcuts
  const handleKeyDown = (event: KeyboardEvent) => {
    if (!visible()) return;

    const key = event.key.toLowerCase();
    const action = actions().find((a) => a.shortcut === key);

    if (action && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault();
      handleActionClick(action.id);
    }

    // Close on Escape
    if (key === "escape") {
      props.onClose();
    }
  };

  // Mouse enter/leave handlers for auto-hide
  const handleMouseEnter = () => {
    clearAutoHideTimer();
  };

  const handleMouseLeave = () => {
    startAutoHideTimer();
  };

  // Handle action click
  const handleActionClick = async (actionId: string) => {
    try {
      // Special handling for screenshot action
      if (actionId === "screenshot") {
        // Navigate to screenshot page
        window.location.href = "/screenshot";
        props.onClose();
        return;
      }

      await commands.executeToolbarAction(actionId, props.selection);
      props.onAction(actionId);
      props.onClose();
    } catch (error) {
      console.error("Failed to execute toolbar action:", error);
    }
  };

  // Calculate toolbar position
  const calculatePosition = () => {
    if (!props.position) return { top: "50%", left: "50%" };

    const { x, y } = props.position;
    const windowWidth = 320;
    const windowHeight = 240;

    // Ensure toolbar stays within viewport
    const adjustedX = Math.min(x, window.innerWidth - windowWidth - 20);
    const adjustedY = Math.min(y, window.innerHeight - windowHeight - 20);

    return {
      left: `${adjustedX}px`,
      top: `${adjustedY}px`,
    };
  };

  onMount(async () => {
    // Add keyboard listener
    document.addEventListener("keydown", handleKeyDown);

    // Load actions based on selection type
    if (props.selection) {
      try {
        const toolbarActions = await commands.getToolbarActions(
          props.selection.context_type,
        );
        setActions(toolbarActions);
      } catch (error) {
        console.error("Failed to load toolbar actions:", error);
        // Fallback to default actions
        const contextualActions = getContextualActions(
          props.selection.context_type,
        );
        setActions(
          contextualActions.map((action) => ({
            id: action.id,
            label: action.label,
            icon: action.icon,
            shortcut: action.shortcut,
            category: {
              translation: { Translation: null },
              polish: { Polish: null },
              knowledge: { KnowledgeBase: null },
              search: { Search: null },
              file: { FileAction: null },
              other: { Other: null },
            }[action.category] as any,
          })),
        );
      }
    }

    setLoading(false);
    setVisible(true);

    // Start auto-hide timer after showing
    startAutoHideTimer();
  });

  onCleanup(() => {
    document.removeEventListener("keydown", handleKeyDown);
    clearAutoHideTimer();
  });

  return (
    <div
      class="-webkit-backdrop-blur-xl fixed z-[9999] max-w-[400px] min-w-[220px] rounded-xl border border-white/30 bg-white/98 p-3 font-sans shadow-2xl backdrop-blur-xl transition-all duration-300 ease-out"
      classList={{
        "opacity-100 scale-100 translate-y-0": visible(),
        "opacity-0 scale-95 -translate-y-2.5": !visible(),
      }}
      style={calculatePosition()}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <Show
        when={!loading()}
        fallback={
          <div class="p-4 text-center">
            <div class="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-gray-200 border-t-blue-500" />
          </div>
        }
      >
        <div class="toolbar-actions">
          <For each={actions()}>
            {(action) => (
              <button
                class="toolbar-action relative flex w-full cursor-pointer items-center gap-2.5 overflow-hidden rounded-lg border-none bg-transparent p-2.5 text-left text-sm font-medium text-gray-700 transition-all duration-200 hover:translate-x-1 hover:bg-gradient-to-r hover:from-blue-50/50 hover:to-blue-50/20 hover:text-blue-500 hover:shadow-lg active:translate-x-0.5 active:scale-95"
                onClick={() => handleActionClick(action.id)}
              >
                <span class="text-base">{action.icon}</span>
                <span class="flex-1">{action.label}</span>
                <Show when={action.shortcut}>
                  <kbd class="rounded-md border border-gray-200 bg-gradient-to-br from-gray-50 to-gray-100 px-2 py-0.5 font-mono text-[11px] font-semibold text-gray-500 shadow-sm">
                    {action.shortcut?.toUpperCase()}
                  </kbd>
                </Show>
              </button>
            )}
          </For>
        </div>

        {/* Selection preview */}
        <Show when={props.selection}>
          <div
            class="relative mt-3 max-h-[60px] overflow-hidden rounded-lg border border-gray-100 bg-gradient-to-br from-gray-50 to-gray-50/50 p-2.5 text-xs text-ellipsis whitespace-nowrap text-gray-600"
            title={props.selection?.selected_text}
          >
            <div class="absolute top-1.5 left-2 text-[10px] font-semibold tracking-wide text-gray-400 uppercase">
              预览
            </div>
            <div class="pl-8 italic">
              "
              {props.selection?.selected_text.length > 50
                ? props.selection?.selected_text.substring(0, 50) + "..."
                : props.selection?.selected_text}
              "
            </div>
          </div>
        </Show>

        {/* Close button */}
        <button
          class="absolute top-1 right-1 flex h-5 w-5 cursor-pointer items-center justify-center rounded-full border-none bg-gray-100 text-xs text-gray-500 transition-all hover:bg-gray-200 hover:text-gray-700"
          onClick={props.onClose}
        >
          ×
        </button>
      </Show>
    </div>
  );
}

