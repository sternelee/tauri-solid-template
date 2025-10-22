import { createSignal, createEffect, For, Show } from 'solid-js';
import { commands } from '../bindings';

interface SourceReference {
  id: string;
  source_type: 'file' | 'app' | 'url' | 'conversation';
  path: string;
  name?: string;
  description?: string;
  metadata?: Record<string, any>;
}

interface MessageSources {
  message: string;
  sources: SourceReference[];
}

export default function ContextualChatInput(props: {
  onSendMessage: (message: string, sources: SourceReference[]) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  const [inputValue, setInputValue] = createSignal('');
  const [showSuggestions, setShowSuggestions] = createSignal(false);
  const [suggestions, setSuggestions] = createSignal<string[]>([]);
  const [currentSources, setCurrentSources] = createSignal<SourceReference[]>([]);
  const [suggestionType, setSuggestionType] = createSignal<'file' | 'app'>('file');
  const [cursorPosition, setCursorPosition] = createSignal(0);

  let textareaRef: HTMLTextAreaElement | undefined;

  // Parse input for @ and # references
  const parseInput = (text: string, cursorPos: number) => {
    const beforeCursor = text.substring(0, cursorPos);
    const afterCursor = text.substring(cursorPos);

    // Find @file or #app patterns
    const fileMatch = beforeCursor.match(/@([^\s]*)$/);
    const appMatch = beforeCursor.match(/#([^\s]*)$/);

    if (fileMatch) {
      setSuggestionType('file');
      const query = fileMatch[1];
      if (query.length > 0) {
        searchFiles(query);
      }
      setShowSuggestions(true);
      return { trigger: '@', query: fileMatch[1], start: cursorPos - query.length - 1 };
    } else if (appMatch) {
      setSuggestionType('app');
      const query = appMatch[1];
      if (query.length > 0) {
        searchApps(query);
      }
      setShowSuggestions(true);
      return { trigger: '#', query: appMatch[1], start: cursorPos - query.length - 1 };
    } else {
      setShowSuggestions(false);
      return null;
    }
  };

  // Search files (mock implementation)
  const searchFiles = async (query: string) => {
    try {
      // In a real implementation, this would search the file system
      const mockFiles = [
        `/home/user/documents/${query}.md`,
        `/home/user/projects/${query}.txt`,
        `/home/user/code/${query}.rs`,
        `/home/user/config/${query}.json`,
        `/home/user/logs/${query}.log`,
      ].filter(path => path.includes(query));

      setSuggestions(mockFiles);
    } catch (error) {
      console.error('Error searching files:', error);
      setSuggestions([]);
    }
  };

  // Search apps (mock implementation)
  const searchApps = async (query: string) => {
    try {
      // In a real implementation, this would search installed applications
      const mockApps = [
        'Visual Studio Code',
        'Google Chrome',
        'Spotify',
        'Slack',
        'Terminal',
        'Finder',
        'System Settings',
        'Notes',
      ].filter(app => app.toLowerCase().includes(query.toLowerCase()));

      setSuggestions(mockApps);
    } catch (error) {
      console.error('Error searching apps:', error);
      setSuggestions([]);
    }
  };

  // Handle input changes
  const handleInput = (e: Event & {
    currentTarget: HTMLTextAreaElement;
    target: HTMLTextAreaElement;
  }) => {
    const value = e.target.value;
    const cursorPos = e.target.selectionStart;

    setInputValue(value);
    setCursorPosition(cursorPos);

    // Parse for context references
    parseInput(value, cursorPos);
  };

  // Handle suggestion selection
  const selectSuggestion = (suggestion: string) => {
    const currentMatch = parseInput(inputValue(), cursorPosition());
    if (currentMatch) {
      const { trigger, start } = currentMatch;

      // Replace the trigger and partial text with the full suggestion
      const beforeMatch = inputValue().substring(0, start);
      const afterMatch = inputValue().substring(cursorPosition());

      let newSource: SourceReference;

      if (trigger === '@') {
        // File reference
        newSource = {
          id: crypto.randomUUID(),
          source_type: 'file',
          path: suggestion,
          name: suggestion.split('/').pop(),
          description: `File: ${suggestion}`,
          metadata: {
            file_type: suggestion.split('.').pop()?.toLowerCase(),
          },
        };
      } else {
        // App reference
        newSource = {
          id: crypto.randomUUID(),
          source_type: 'app',
          path: suggestion,
          name: suggestion,
          description: `Application: ${suggestion}`,
          metadata: {
            search_query: suggestion,
          },
        };
      }

      setCurrentSources(prev => [...prev, newSource]);

      // Update input value
      const newValue = beforeMatch + trigger + suggestion + ' ' + afterMatch;
      setInputValue(newValue);
      setShowSuggestions(false);

      // Focus back on textarea
      if (textareaRef) {
        textareaRef.focus();
        const newCursorPos = beforeMatch.length + trigger.length + suggestion.length + 1;
        textareaRef.setSelectionRange(newCursorPos, newCursorPos);
      }
    }
  };

  // Handle send message
  const handleSend = () => {
    const message = inputValue().trim();
    if (message && !props.disabled) {
      props.onSendMessage(message, currentSources());
      setInputValue('');
      setCurrentSources([]);
      setShowSuggestions(false);
    }
  };

  // Handle keyboard shortcuts
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (showSuggestions() && suggestions().length > 0) {
        selectSuggestion(suggestions()[0]);
      } else {
        handleSend();
      }
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    } else if (e.key === 'ArrowDown' && showSuggestions()) {
      e.preventDefault();
      // Navigate suggestions
    } else if (e.key === 'ArrowUp' && showSuggestions()) {
      e.preventDefault();
      // Navigate suggestions
    }
  };

  // Handle textarea auto-resize
  createEffect(() => {
    if (textareaRef) {
      textareaRef.style.height = 'auto';
      textareaRef.style.height = textareaRef.scrollHeight + 'px';
    }
  });

  return (
    <div class="contextual-chat-input">
      {/* Current sources display */}
      <Show when={currentSources().length > 0}>
        <div class="sources-display">
          <div class="sources-label">Context Sources:</div>
          <div class="sources-list">
            <For each={currentSources()}>
              {(source) => (
                <div class={`source-badge source-${source.source_type}`}>
                  <span class="source-icon">
                    {source.source_type === 'file' ? '📄' : '🚀'}
                  </span>
                  <span class="source-name">
                    {source.name || source.path}
                  </span>
                  <button
                    class="source-remove"
                    onClick={() => {
                      setCurrentSources(prev =>
                        prev.filter(s => s.id !== source.id)
                      );
                    }}
                  >
                    ✕
                  </button>
                </div>
              )}
            </For>
          </div>
        </div>
      </Show>

      {/* Input area */}
      <div class="input-container">
        <textarea
          ref={textareaRef}
          class="chat-textarea"
          value={inputValue()}
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          placeholder={props.placeholder || "Type @filename for files, #appname for applications, or just type your message..."}
          disabled={props.disabled}
          rows={1}
        />

        <button
          class="send-button"
          onClick={handleSend}
          disabled={!inputValue().trim() || props.disabled}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M22 2L11 13M22 2l-7 20-4-9-9 4 20 7z"/>
            <path d="M22 2L15 9l-4 9"/>
          </svg>
        </button>
      </div>

      {/* Suggestions dropdown */}
      <Show when={showSuggestions() && suggestions().length > 0}>
        <div class="suggestions-dropdown">
          <div class="suggestions-header">
            {suggestionType() === 'file' ? '📄 Files' : '🚀 Applications'}
          </div>
          <div class="suggestions-list">
            <For each={suggestions()}>
              {(suggestion) => (
                <div
                  class="suggestion-item"
                  onClick={() => selectSuggestion(suggestion)}
                >
                  <span class="suggestion-icon">
                    {suggestionType() === 'file' ? '📄' : '🚀'}
                  </span>
                  <span class="suggestion-text">{suggestion}</span>
                </div>
              )}
            </For>
          </div>
        </div>
      </Show>

      <style jsx>{`
        .contextual-chat-input {
          position: relative;
          width: 100%;
          max-width: 800px;
          margin: 0 auto;
        }

        .sources-display {
          margin-bottom: 12px;
          padding: 8px 12px;
          background: var(--raycast-surface);
          border: 1px solid var(--raycast-border);
          border-radius: 8px;
        }

        .sources-label {
          font-size: 12px;
          font-weight: 600;
          color: var(--raycast-muted);
          margin-bottom: 6px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .sources-list {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }

        .source-badge {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 4px 8px;
          background: var(--raycast-accent);
          border-radius: 12px;
          font-size: 12px;
          font-weight: 500;
          color: var(--raycast-accent-foreground);
        }

        .source-file {
          background: rgba(59, 130, 246, 0.1);
          color: rgb(59, 130, 246);
        }

        .source-app {
          background: rgba(34, 197, 94, 0.1);
          color: rgb(34, 197, 94);
        }

        .source-icon {
          font-size: 10px;
        }

        .source-name {
          max-width: 150px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .source-remove {
          background: none;
          border: none;
          color: inherit;
          cursor: pointer;
          font-size: 10px;
          padding: 0;
          margin-left: 4px;
          opacity: 0.7;
          transition: opacity 0.15s ease;
        }

        .source-remove:hover {
          opacity: 1;
        }

        .input-container {
          position: relative;
          display: flex;
          align-items: flex-end;
          background: var(--raycast-surface);
          border: 1px solid var(--raycast-border);
          border-radius: 12px;
          padding: 12px;
          transition: border-color 0.15s ease;
        }

        .input-container:focus-within {
          border-color: var(--raycast-accent-foreground);
        }

        .chat-textarea {
          flex: 1;
          background: transparent;
          border: none;
          outline: none;
          resize: none;
          font-family: inherit;
          font-size: 14px;
          line-height: 1.5;
          color: var(--raycast-foreground);
          min-height: 20px;
          max-height: 120px;
          overflow-y: auto;
        }

        .chat-textarea::placeholder {
          color: var(--raycast-muted);
        }

        .chat-textarea:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .send-button {
          background: var(--raycast-accent-foreground);
          border: none;
          border-radius: 8px;
          padding: 8px;
          margin-left: 8px;
          color: var(--raycast-accent);
          cursor: pointer;
          transition: all 0.15s ease;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .send-button:hover:not(:disabled) {
          opacity: 0.9;
          transform: translateY(-1px);
        }

        .send-button:disabled {
          opacity: 0.3;
          cursor: not-allowed;
          transform: none;
        }

        .suggestions-dropdown {
          position: absolute;
          bottom: 100%;
          left: 0;
          right: 0;
          margin-bottom: 8px;
          background: var(--raycast-surface);
          border: 1px solid var(--raycast-border);
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
          z-index: 1000;
          max-height: 200px;
          overflow: hidden;
        }

        .suggestions-header {
          padding: 8px 12px;
          font-size: 12px;
          font-weight: 600;
          color: var(--raycast-muted);
          background: var(--raycast-input);
          border-bottom: 1px solid var(--raycast-border);
        }

        .suggestions-list {
          max-height: 160px;
          overflow-y: auto;
        }

        .suggestion-item {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          cursor: pointer;
          transition: background-color 0.15s ease;
          font-size: 14px;
        }

        .suggestion-item:hover {
          background: var(--raycast-accent);
        }

        .suggestion-icon {
          font-size: 14px;
          width: 16px;
          text-align: center;
        }

        .suggestion-text {
          flex: 1;
          color: var(--raycast-foreground);
        }

        /* Custom scrollbar for suggestions */
        .suggestions-list::-webkit-scrollbar {
          width: 4px;
        }

        .suggestions-list::-webkit-scrollbar-track {
          background: transparent;
        }

        .suggestions-list::-webkit-scrollbar-thumb {
          background: var(--raycast-border);
          border-radius: 2px;
        }

        .suggestions-list::-webkit-scrollbar-thumb:hover {
          background: var(--raycast-muted);
        }
      `}</style>
    </div>
  );
}