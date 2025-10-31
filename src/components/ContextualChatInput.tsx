import { createSignal, createEffect, For, Show } from "solid-js";
import { commands } from "../bindings";

interface SourceReference {
  id: string;
  source_type: "file" | "app" | "url" | "conversation";
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
  const [inputValue, setInputValue] = createSignal("");
  const [showSuggestions, setShowSuggestions] = createSignal(false);
  const [suggestions, setSuggestions] = createSignal<string[]>([]);
  const [currentSources, setCurrentSources] = createSignal<SourceReference[]>(
    [],
  );
  const [suggestionType, setSuggestionType] = createSignal<"file" | "app">(
    "file",
  );
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
      setSuggestionType("file");
      const query = fileMatch[1];
      if (query.length > 0) {
        searchFiles(query);
      }
      setShowSuggestions(true);
      return {
        trigger: "@",
        query: fileMatch[1],
        start: cursorPos - query.length - 1,
      };
    } else if (appMatch) {
      setSuggestionType("app");
      const query = appMatch[1];
      if (query.length > 0) {
        searchApps(query);
      }
      setShowSuggestions(true);
      return {
        trigger: "#",
        query: appMatch[1],
        start: cursorPos - query.length - 1,
      };
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
      ].filter((path) => path.includes(query));

      setSuggestions(mockFiles);
    } catch (error) {
      console.error("Error searching files:", error);
      setSuggestions([]);
    }
  };

  // Search apps (mock implementation)
  const searchApps = async (query: string) => {
    try {
      // In a real implementation, this would search installed applications
      const mockApps = [
        "Visual Studio Code",
        "Google Chrome",
        "Spotify",
        "Slack",
        "Terminal",
        "Finder",
        "System Settings",
        "Notes",
      ].filter((app) => app.toLowerCase().includes(query.toLowerCase()));

      setSuggestions(mockApps);
    } catch (error) {
      console.error("Error searching apps:", error);
      setSuggestions([]);
    }
  };

  // Handle input changes
  const handleInput = (
    e: Event & {
      currentTarget: HTMLTextAreaElement;
      target: HTMLTextAreaElement;
    },
  ) => {
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

      if (trigger === "@") {
        // File reference
        newSource = {
          id: crypto.randomUUID(),
          source_type: "file",
          path: suggestion,
          name: suggestion.split("/").pop(),
          description: `File: ${suggestion}`,
          metadata: {
            file_type: suggestion.split(".").pop()?.toLowerCase(),
          },
        };
      } else {
        // App reference
        newSource = {
          id: crypto.randomUUID(),
          source_type: "app",
          path: suggestion,
          name: suggestion,
          description: `Application: ${suggestion}`,
          metadata: {
            search_query: suggestion,
          },
        };
      }

      setCurrentSources((prev) => [...prev, newSource]);

      // Update input value
      const newValue = beforeMatch + trigger + suggestion + " " + afterMatch;
      setInputValue(newValue);
      setShowSuggestions(false);

      // Focus back on textarea
      if (textareaRef) {
        textareaRef.focus();
        const newCursorPos =
          beforeMatch.length + trigger.length + suggestion.length + 1;
        textareaRef.setSelectionRange(newCursorPos, newCursorPos);
      }
    }
  };

  // Handle send message
  const handleSend = () => {
    const message = inputValue().trim();
    if (message && !props.disabled) {
      props.onSendMessage(message, currentSources());
      setInputValue("");
      setCurrentSources([]);
      setShowSuggestions(false);
    }
  };

  // Handle keyboard shortcuts
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (showSuggestions() && suggestions().length > 0) {
        selectSuggestion(suggestions()[0]);
      } else {
        handleSend();
      }
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
    } else if (e.key === "ArrowDown" && showSuggestions()) {
      e.preventDefault();
      // Navigate suggestions
    } else if (e.key === "ArrowUp" && showSuggestions()) {
      e.preventDefault();
      // Navigate suggestions
    }
  };

  // Handle textarea auto-resize
  createEffect(() => {
    if (textareaRef) {
      textareaRef.style.height = "auto";
      textareaRef.style.height = textareaRef.scrollHeight + "px";
    }
  });

  return (
    <div class="relative mx-auto w-full max-w-2xl">
      {/* Current sources display */}
      <Show when={currentSources().length > 0}>
        <div class="mb-3 rounded-lg border border-white/10 bg-white/5 p-2">
          <div class="mb-1.5 text-xs font-semibold tracking-wide text-white/60 uppercase">
            Context Sources:
          </div>
          <div class="flex flex-wrap gap-1.5">
            <For each={currentSources()}>
              {(source) => (
                <div
                  class={`flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium ${
                    source.source_type === "file"
                      ? "bg-blue-500/20 text-blue-400"
                      : "bg-green-500/20 text-green-400"
                  }`}
                >
                  <span class="text-[10px]">
                    {source.source_type === "file" ? "📄" : "🚀"}
                  </span>
                  <span class="max-w-[150px] truncate">
                    {source.name || source.path}
                  </span>
                  <button
                    class="ml-1 cursor-pointer border-none bg-none p-0 text-[10px] text-inherit opacity-70 transition-opacity hover:opacity-100"
                    onClick={() => {
                      setCurrentSources((prev) =>
                        prev.filter((s) => s.id !== source.id),
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
      <div class="relative flex items-end rounded-xl border border-white/10 bg-white/5 p-3 transition-colors focus-within:border-white/30">
        <textarea
          ref={textareaRef}
          class="font-inherit min-[20px] max-h-[120px] flex-1 resize-none overflow-y-auto border-none bg-transparent text-sm leading-6 text-white placeholder-white/60 outline-none disabled:cursor-not-allowed disabled:opacity-50"
          value={inputValue()}
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          placeholder={
            props.placeholder ||
            "Type @filename for files, #appname for applications, or just type your message..."
          }
          disabled={props.disabled}
          rows={1}
        />

        <button
          class="ml-2 flex cursor-pointer items-center justify-center rounded-lg border-none bg-white p-2 text-black transition-all hover:-translate-y-px hover:transform hover:opacity-90 disabled:transform-none disabled:cursor-not-allowed disabled:opacity-30"
          onClick={handleSend}
          disabled={!inputValue().trim() || props.disabled}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path d="M22 2L11 13M22 2l-7 20-4-9-9 4 20 7z" />
            <path d="M22 2L15 9l-4 9" />
          </svg>
        </button>
      </div>

      {/* Suggestions dropdown */}
      <Show when={showSuggestions() && suggestions().length > 0}>
        <div class="absolute right-0 bottom-full left-0 z-50 mb-2 max-h-[200px] overflow-hidden rounded-lg border border-white/10 bg-white/5 shadow-lg">
          <div class="border-b border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-white/60">
            {suggestionType() === "file" ? "📄 Files" : "🚀 Applications"}
          </div>
          <div class="max-h-[160px] overflow-y-auto [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:rounded-sm [&::-webkit-scrollbar-thumb]:bg-white/20 [&::-webkit-scrollbar-thumb:hover]:bg-white/30 [&::-webkit-scrollbar-track]:bg-transparent">
            <For each={suggestions()}>
              {(suggestion) => (
                <div
                  class="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm transition-colors hover:bg-white/10"
                  onClick={() => selectSuggestion(suggestion)}
                >
                  <span class="w-4 text-center text-sm">
                    {suggestionType() === "file" ? "📄" : "🚀"}
                  </span>
                  <span class="flex-1 text-white/90">{suggestion}</span>
                </div>
              )}
            </For>
          </div>
        </div>
      </Show>
    </div>
  );
}

