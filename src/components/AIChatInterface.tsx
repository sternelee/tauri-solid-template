import { createSignal, createEffect, onMount, For, Show } from "solid-js";
import { commands } from "../bindings";
import ContextualChatInput from "./ContextualChatInput";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  context?: {
    apps?: Array<{ name: string; bundleId: string }>;
    files?: Array<{ path: string; type: string }>;
  };
}

interface MentionItem {
  type: "app" | "file";
  id: string;
  title: string;
  subtitle?: string;
  icon?: string;
  data: any;
}

export default function AIChatInterface() {
  const [messages, setMessages] = createSignal<ChatMessage[]>([]);
  const [inputValue, setInputValue] = createSignal("");
  const [isLoading, setIsLoading] = createSignal(false);
  const [conversationId, setConversationId] = createSignal<string>("");
  const [mentionSuggestions, setMentionSuggestions] = createSignal<
    MentionItem[]
  >([]);
  const [showMentions, setShowMentions] = createSignal(false);
  const [mentionQuery, setMentionQuery] = createSignal("");
  const [selectedMentionIndex, setSelectedMentionIndex] = createSignal(0);
  const [systemApps, setSystemApps] = createSignal<any[]>([]);
  const [currentMentionStart, setCurrentMentionStart] = createSignal(0);

  let chatContainerRef: HTMLDivElement | undefined;
  let inputRef: HTMLTextAreaElement | undefined;

  // Initialize conversation on mount
  onMount(async () => {
    try {
      // Initialize AI agent with database integration
      const initResult = await commands.initializeAgentWithDb(
        {
          provider: "OpenAI",
          model: "gpt-4o-mini",
          preamble:
            "You are a helpful AI assistant integrated into a desktop application. Provide helpful, concise responses.",
          temperature: 0.7,
          max_tokens: 1000,
        },
        null,
      );

      if (initResult.status === "ok") {
        // Create a new conversation in database
        const conversationResult = await commands.createConversationWithDb(
          null, // title
          "gpt-4o-mini",
          "OpenAI",
        );

        if (conversationResult.status === "ok") {
          setConversationId(conversationResult.data);
        }
      }

      // Load system apps for @ mentions
      await loadSystemApps();
    } catch (error) {
      console.error("Failed to initialize AI chat:", error);
    }
  });

  const loadSystemApps = async () => {
    try {
      const result = await commands.getApplications();
      if (result.status === "ok") {
        setSystemApps(result.data);
      }
    } catch (error) {
      console.error("Failed to load system apps:", error);
    }
  };

  // Handle input changes and detect mentions
  const handleInputChange = (value: string) => {
    setInputValue(value);

    // Check for @ mentions (apps)
    const atIndex = value.lastIndexOf("@");
    if (
      atIndex !== -1 &&
      (atIndex === 0 ||
        value[atIndex - 1] === " " ||
        value[atIndex - 1] === "\n")
    ) {
      const query = value.slice(atIndex + 1);
      const spaceIndex = query.indexOf(" ");
      const actualQuery =
        spaceIndex !== -1 ? query.slice(0, spaceIndex) : query;

      setMentionQuery(actualQuery);
      setCurrentMentionStart(atIndex);
      setShowMentions(true);
      setSelectedMentionIndex(0);

      // Filter apps based on query
      const filteredApps = systemApps()
        .filter(
          (app) =>
            app.name.toLowerCase().includes(actualQuery.toLowerCase()) ||
            app.bundle_id.toLowerCase().includes(actualQuery.toLowerCase()),
        )
        .slice(0, 8)
        .map((app) => ({
          type: "app" as const,
          id: app.bundle_id,
          title: app.name,
          subtitle: app.bundle_id,
          icon: "📱",
          data: app,
        }));

      setMentionSuggestions(filteredApps);
      return;
    }

    // Check for # mentions (files)
    const hashIndex = value.lastIndexOf("#");
    if (
      hashIndex !== -1 &&
      (hashIndex === 0 ||
        value[hashIndex - 1] === " " ||
        value[hashIndex - 1] === "\n")
    ) {
      const query = value.slice(hashIndex + 1);
      const spaceIndex = query.indexOf(" ");
      const actualQuery =
        spaceIndex !== -1 ? query.slice(0, spaceIndex) : query;

      setMentionQuery(actualQuery);
      setCurrentMentionStart(hashIndex);
      setShowMentions(true);
      setSelectedMentionIndex(0);

      // Trigger file search
      performFileSearch(actualQuery);
      return;
    }

    // Hide mentions if no @ or # found
    setShowMentions(false);
    setMentionSuggestions([]);
  };

  const performFileSearch = async (query: string) => {
    if (!query.trim()) return;

    try {
      const result = await commands.searchFiles(
        {
          pattern: query,
          max_results: 8,
          file_extensions: null,
          include_hidden: false,
        },
        null,
      );

      if (result.status === "ok") {
        const fileSuggestions = result.data.map((file: any) => ({
          type: "file" as const,
          id: file.path,
          title: file.path.split("/").pop() || file.path,
          subtitle: file.path,
          icon: getFileIcon(file.file_type),
          data: file,
        }));

        setMentionSuggestions(fileSuggestions);
      }
    } catch (error) {
      console.error("File search failed:", error);
      setMentionSuggestions([]);
    }
  };

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
      HTML: "🌐",
      CSS: "🎨",
      JSON: "📄",
      Markdown: "📖",
      Text: "📄",
    };
    return iconMap[fileType] || "📄";
  };

  // Handle mention selection
  const selectMention = (mention: MentionItem) => {
    const currentInput = inputValue();
    const beforeMention = currentInput.slice(0, currentMentionStart());
    const afterMention = currentInput.slice(
      currentMentionStart() + mentionQuery.length + 1,
    );

    let mentionText = "";
    if (mention.type === "app") {
      mentionText = `@${mention.title}`;
    } else if (mention.type === "file") {
      mentionText = `#${mention.title}`;
    }

    const newInput = beforeMention + mentionText + " " + afterMention;
    setInputValue(newInput);
    setShowMentions(false);
    setMentionSuggestions([]);

    // Focus back to input
    if (inputRef) {
      inputRef.focus();
      // Set cursor to end of inserted mention
      const cursorPosition = beforeMention.length + mentionText.length + 1;
      inputRef.setSelectionRange(cursorPosition, cursorPosition);
    }
  };

  // Handle keyboard navigation in mentions
  const handleMentionKeyDown = (e: KeyboardEvent) => {
    if (!showMentions()) return;

    const suggestions = mentionSuggestions();
    const currentIndex = selectedMentionIndex();

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedMentionIndex((currentIndex + 1) % suggestions.length);
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedMentionIndex(
          currentIndex === 0 ? suggestions.length - 1 : currentIndex - 1,
        );
        break;
      case "Enter":
      case "Tab":
        e.preventDefault();
        if (suggestions[currentIndex]) {
          selectMention(suggestions[currentIndex]);
        }
        break;
      case "Escape":
        e.preventDefault();
        setShowMentions(false);
        setMentionSuggestions([]);
        break;
    }
  };

  // Extract context from input
  const extractContextFromInput = (input: string) => {
    const context: any = {};

    // Extract @app mentions
    const appMatches = input.match(/@([^\s]+)/g);
    if (appMatches) {
      context.apps = appMatches
        .map((match) => {
          const appName = match.slice(1);
          const app = systemApps().find(
            (a) =>
              a.name.toLowerCase() === appName.toLowerCase() ||
              a.bundle_id.toLowerCase() === appName.toLowerCase(),
          );
          return app ? app.bundle_id : ""; // Return bundle_id for database
        })
        .filter(Boolean); // Filter out empty strings
    }

    // Extract #file mentions
    const fileMatches = input.match(/#([^\s]+)/g);
    if (fileMatches) {
      context.files = fileMatches.map((match) => match.slice(1)); // Return file path
    }

    return context;
  };

  // Send message to AI
  const sendMessage = async (message?: string, sources?: any[]) => {
    const content = message || inputValue().trim();
    if (!content || isLoading()) return;

    setIsLoading(true);

    // Extract context for database and AI
    const context = extractContextFromInput(content);

    // Add user message to UI immediately for better UX
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content,
      timestamp: new Date(),
      context: {
        apps: context.apps?.map((bundleId: string) => {
          const app = systemApps().find((a) => a.bundle_id === bundleId);
          return app
            ? { name: app.name, bundleId }
            : { name: bundleId, bundleId };
        }),
        files: context.files?.map((path: string) => ({
          path,
          type: "unknown",
        })),
      },
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue("");
    setShowMentions(false);
    setMentionSuggestions([]);

    try {
      if (!conversationId()) {
        throw new Error("No active conversation");
      }

      // Convert sources to the format expected by the backend
      const backendSources =
        sources ||
        context.files?.map((file: string) => ({
          id: crypto.randomUUID(),
          source_type: {
            File: { file_type: file.split(".").pop()?.toLowerCase() },
          },
          path: file,
          name: file.split("/").pop(),
          description: `File: ${file}`,
          metadata: { file_type: file.split(".").pop()?.toLowerCase() },
        })) ||
        [];

      // Use enhanced database-integrated chat command with sources
      const result = await commands.chatWithAgentDb(
        conversationId(),
        content,
        context.apps, // app bundle IDs
        context.files, // file paths
        false, // use_vision
        true, // enable_tool_calling
        backendSources, // new sources array
      );

      if (result.status === "ok") {
        const assistantMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: result.data.content,
          timestamp: new Date(),
        };

        setMessages((prev) => [...prev, assistantMessage]);
      } else {
        throw new Error(result.error || "Failed to get AI response");
      }
    } catch (error) {
      console.error("Failed to send message:", error);

      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content:
          "Sorry, I encountered an error while processing your request. Please try again.",
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle input keydown
  const handleInputKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (showMentions()) {
        const suggestions = mentionSuggestions();
        if (suggestions[selectedMentionIndex()]) {
          selectMention(suggestions[selectedMentionIndex()]);
        }
      } else {
        sendMessage();
      }
    } else {
      handleMentionKeyDown(e);
    }
  };

  // Auto-scroll to bottom on new messages
  createEffect(() => {
    const messageCount = messages().length;
    if (messageCount > 0 && chatContainerRef) {
      setTimeout(() => {
        if (chatContainerRef) {
          chatContainerRef.scrollTop = chatContainerRef.scrollHeight;
        }
      }, 100);
    }
  });

  return (
    <div class="flex h-full flex-col bg-gray-900/95 backdrop-blur-xl">
      {/* Messages Container */}
      <div
        class="flex flex-1 flex-col gap-3 overflow-y-auto p-4 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-sm [&::-webkit-scrollbar-thumb]:bg-white/20 [&::-webkit-scrollbar-track]:bg-transparent"
        ref={chatContainerRef}
      >
        <For each={messages()}>
          {(message) => (
            <div
              class={`flex max-w-full gap-3 ${message.role === "user" ? "flex-row-reverse" : ""}`}
            >
              <div class="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-base">
                {message.role === "user" ? "👤" : "🤖"}
              </div>
              <div class="min-w-0 flex-1">
                <div
                  class={`rounded-2xl bg-white/10 p-3 text-sm leading-6 break-words text-white/90 ${message.role === "user" ? "border border-blue-500/30 bg-blue-500/20" : ""} ${message.role === "user" ? "text-right" : ""}`}
                >
                  {message.content}
                </div>
                <Show
                  when={
                    message.context &&
                    (message.context.apps?.length ||
                      message.context.files?.length)
                  }
                >
                  <div
                    class={`mt-2 flex flex-col gap-1 ${message.role === "user" ? "items-end" : ""}`}
                  >
                    <Show
                      when={
                        message.context &&
                        message.context.apps &&
                        message.context.apps.length > 0
                      }
                    >
                      <div class="flex flex-wrap items-center gap-2">
                        <span class="text-xs font-medium text-white/60">
                          Apps:
                        </span>
                        <For each={message.context.apps}>
                          {(app) => (
                            <span class="rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-medium text-white/80">
                              📱 {app.name}
                            </span>
                          )}
                        </For>
                      </div>
                    </Show>
                    <Show
                      when={
                        message.context &&
                        message.context.files &&
                        message.context.files.length > 0
                      }
                    >
                      <div class="flex flex-wrap items-center gap-2">
                        <span class="text-xs font-medium text-white/60">
                          Files:
                        </span>
                        <For each={message.context.files}>
                          {(file) => (
                            <span class="rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-medium text-white/80">
                              📄 {file.path.split("/").pop()}
                            </span>
                          )}
                        </For>
                      </div>
                    </Show>
                  </div>
                </Show>
                <div class="mt-1 text-[11px] text-white/40">
                  {message.timestamp.toLocaleTimeString()}
                </div>
              </div>
            </div>
          )}
        </For>

        {/* Loading indicator */}
        <Show when={isLoading()}>
          <div class="flex gap-3">
            <div class="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-base">
              🤖
            </div>
            <div class="min-w-0 flex-1">
              <div class="flex gap-1 p-3">
                <span class="animate-typing h-2 w-2 rounded-full bg-white/60 [animation-delay:-0.32s]"></span>
                <span class="animate-typing h-2 w-2 rounded-full bg-white/60 [animation-delay:-0.16s]"></span>
                <span class="animate-typing h-2 w-2 rounded-full bg-white/60"></span>
              </div>
            </div>
          </div>
        </Show>
      </div>

      {/* Input Area */}
      <div class="flex items-end gap-3 border-t border-white/10 p-4">
        <ContextualChatInput
          onSendMessage={sendMessage}
          placeholder="Ask AI anything... Use @filename for files, #appname for applications, or just type your message..."
          disabled={isLoading()}
        />
      </div>
    </div>
  );
}

