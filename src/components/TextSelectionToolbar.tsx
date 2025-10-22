import { createSignal, onCleanup, onMount, For, Show } from 'solid-js';
import { commands } from '../bindings';
import type {
  TextSelection,
  ToolbarAction,
  SelectionContextType
} from '../bindings';

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
  category: 'translation' | 'polish' | 'knowledge' | 'file' | 'search' | 'other';
}

const DEFAULT_ACTIONS: ActionConfig[] = [
  { id: 'translate', label: '翻译', icon: '🌐', shortcut: 't', category: 'translation' },
  { id: 'polish', label: '润色', icon: '✨', shortcut: 'p', category: 'polish' },
  { id: 'add_to_knowledge', label: '加入知识库', icon: '📚', shortcut: 'k', category: 'knowledge' },
  { id: 'search', label: '搜索', icon: '🔍', shortcut: 's', category: 'search' },
  { id: 'chat_with_file', label: 'Chat with file', icon: '💬', shortcut: 'c', category: 'file' },
  { id: 'open_file', label: '打开文件', icon: '📂', shortcut: 'o', category: 'file' },
  { id: 'screenshot', label: '截图工具', icon: '📸', shortcut: 'r', category: 'other' },
];

export default function TextSelectionToolbar(props: TextSelectionToolbarProps) {
  const [actions, setActions] = createSignal<ToolbarAction[]>([]);
  const [loading, setLoading] = createSignal(true);
  const [visible, setVisible] = createSignal(false);
  const [autoHideTimer, setAutoHideTimer] = createSignal<NodeJS.Timeout | null>(null);

  // Get appropriate actions based on selection type
  const getContextualActions = (contextType: SelectionContextType): ActionConfig[] => {
    const baseActions = DEFAULT_ACTIONS.filter(action => {
      switch (contextType) {
        case 'FilePath':
          return ['translate', 'polish', 'add_to_knowledge', 'search', 'chat_with_file', 'open_file'].includes(action.id);
        case 'Url':
          return ['translate', 'polish', 'add_to_knowledge', 'search'];
        case 'Email':
          return ['translate', 'polish', 'add_to_knowledge', 'search'];
        case 'PhoneNumber':
          return ['translate', 'polish', 'add_to_knowledge', 'search'];
        case 'Code':
          return ['translate', 'polish', 'add_to_knowledge', 'search'];
        default:
          return !['chat_with_file', 'open_file'].includes(action.id);
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
    const action = actions().find(a => a.shortcut === key);

    if (action && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault();
      handleActionClick(action.id);
    }

    // Close on Escape
    if (key === 'escape') {
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
      if (actionId === 'screenshot') {
        // Navigate to screenshot page
        window.location.href = '/screenshot';
        props.onClose();
        return;
      }

      await commands.executeToolbarAction(actionId, props.selection);
      props.onAction(actionId);
      props.onClose();
    } catch (error) {
      console.error('Failed to execute toolbar action:', error);
    }
  };

  // Calculate toolbar position
  const calculatePosition = () => {
    if (!props.position) return { top: '50%', left: '50%' };

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
    document.addEventListener('keydown', handleKeyDown);

    // Load actions based on selection type
    if (props.selection) {
      try {
        const toolbarActions = await commands.getToolbarActions(props.selection.context_type);
        setActions(toolbarActions);
      } catch (error) {
        console.error('Failed to load toolbar actions:', error);
        // Fallback to default actions
        const contextualActions = getContextualActions(props.selection.context_type);
        setActions(contextualActions.map(action => ({
          id: action.id,
          label: action.label,
          icon: action.icon,
          shortcut: action.shortcut,
          category: {
            'translation': { Translation: null },
            'polish': { Polish: null },
            'knowledge': { KnowledgeBase: null },
            'search': { Search: null },
            'file': { FileAction: null },
            'other': { Other: null },
          }[action.category] as any,
        })));
      }
    }

    setLoading(false);
    setVisible(true);

    // Start auto-hide timer after showing
    startAutoHideTimer();
  });

  onCleanup(() => {
    document.removeEventListener('keydown', handleKeyDown);
    clearAutoHideTimer();
  });

  return (
    <div
      class="text-selection-toolbar"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{
        position: 'fixed',
        ...calculatePosition(),
        'z-index': 9999,
        'background': 'rgba(255, 255, 255, 0.98)',
        'backdrop-filter': 'blur(20px)',
        '-webkit-backdrop-filter': 'blur(20px)',
        'border-radius': '12px',
        'box-shadow': '0 10px 40px rgba(0, 0, 0, 0.2), 0 6px 20px rgba(0, 0, 0, 0.1)',
        'border': '1px solid rgba(255, 255, 255, 0.3)',
        'padding': '12px',
        'min-width': '220px',
        'max-width': '400px',
        'opacity': visible() ? 1 : 0,
        'transform': visible() ? 'scale(1) translateY(0)' : 'scale(0.95) translateY(-10px)',
        'transition': 'all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)',
        'font-family': 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
    >
      <Show when={!loading()} fallback={
        <div style={{ padding: '16px', 'text-align': 'center' }}>
          <div style={{
            width: '24px',
            height: '24px',
            'border': '2px solid #e5e7eb',
            'border-top': '2px solid #3b82f6',
            'border-radius': '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto'
          }} />
        </div>
      }>
        <div class="toolbar-actions">
          <For each={actions()}>
            {(action) => (
              <button
                class="toolbar-action"
                onClick={() => handleActionClick(action.id)}
                style={{
                  display: 'flex',
                  'align-items': 'center',
                  gap: '10px',
                  padding: '10px 14px',
                  'border-radius': '8px',
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  'font-size': '14px',
                  color: '#374151',
                  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                  width: '100%',
                  'text-align': 'left',
                  position: 'relative',
                  overflow: 'hidden',
                  'font-weight': '500',
                  transform: 'translateX(0)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(59, 130, 246, 0.05) 100%)';
                  e.currentTarget.style.color = '#3b82f6';
                  e.currentTarget.style.transform = 'translateX(4px)';
                  e.currentTarget.style.boxShadow = '0 2px 8px rgba(59, 130, 246, 0.15)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = '#374151';
                  e.currentTarget.style.transform = 'translateX(0)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
                onMouseDown={(e) => {
                  e.currentTarget.style.transform = 'translateX(2px) scale(0.98)';
                }}
                onMouseUp={(e) => {
                  e.currentTarget.style.transform = 'translateX(4px) scale(1)';
                }}
              >
                <span style={{ 'font-size': '16px' }}>{action.icon}</span>
                <span style={{ flex: 1 }}>{action.label}</span>
                <Show when={action.shortcut}>
                  <kbd
                    style={{
                      'font-size': '11px',
                      padding: '3px 8px',
                      'background': 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
                      border: '1px solid #e2e8f0',
                      'border-radius': '6px',
                      color: '#64748b',
                      'font-family': 'ui-monospace, SF Mono, Monaco, "Cascadia Code", "Roboto Mono", Consolas, "Courier New", monospace',
                      'font-weight': '600',
                      'box-shadow': '0 1px 2px rgba(0, 0, 0, 0.05)',
                      transition: 'all 0.15s ease',
                    }}
                  >
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
            style={{
              'margin-top': '12px',
              padding: '10px 12px',
              'background': 'linear-gradient(135deg, #fafbfc 0%, #f8faf9 100%)',
              'border-radius': '8px',
              'font-size': '12px',
              color: '#6b7280',
              'max-height': '60px',
              overflow: 'hidden',
              'text-overflow': 'ellipsis',
              'white-space': 'nowrap',
              border: '1px solid #f1f3f4',
              position: 'relative',
            }}
            title={props.selection?.selected_text}
          >
            <div style={{
              position: 'absolute',
              top: '6px',
              left: '8px',
              'font-size': '10px',
              color: '#9ca3af',
              'font-weight': '600',
              'text-transform': 'uppercase',
              'letter-spacing': '0.5px',
            }}>
              预览
            </div>
            <div style={{
              'padding-left': '32px',
              'font-style': 'italic',
            }}>
              "{props.selection?.selected_text.length > 50
                ? props.selection?.selected_text.substring(0, 50) + '...'
                : props.selection?.selected_text}"
            </div>
          </div>
        </Show>

        {/* Close button */}
        <button
          onClick={props.onClose}
          style={{
            position: 'absolute',
            top: '4px',
            right: '4px',
            width: '20px',
            height: '20px',
            'border-radius': '50%',
            border: 'none',
            background: '#f3f4f6',
            cursor: 'pointer',
            display: 'flex',
            'align-items': 'center',
            'justify-content': 'center',
            'font-size': '12px',
            color: '#6b7280',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#e5e7eb';
            e.currentTarget.style.color = '#374151';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = '#f3f4f6';
            e.currentTarget.style.color = '#6b7280';
          }}
        >
          ×
        </button>
      </Show>

      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}