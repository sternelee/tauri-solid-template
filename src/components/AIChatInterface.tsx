import {
  createSignal,
  createEffect,
  onMount,
  For,
  Show,
} from "solid-js";
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
  const [mentionSuggestions, setMentionSuggestions] = createSignal<MentionItem[]>([]);
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
      const initResult = await commands.initializeAgentWithDb({
        provider: "OpenAI",
        model: "gpt-4o-mini",
        preamble: "You are a helpful AI assistant integrated into a desktop application. Provide helpful, concise responses.",
        temperature: 0.7,
        max_tokens: 1000
      }, null);

      if (initResult.status === "ok") {
        // Create a new conversation in database
        const conversationResult = await commands.createConversationWithDb(
          null, // title
          "gpt-4o-mini",
          "OpenAI"
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
    const atIndex = value.lastIndexOf('@');
    if (atIndex !== -1 && (atIndex === 0 || value[atIndex - 1] === ' ' || value[atIndex - 1] === '\n')) {
      const query = value.slice(atIndex + 1);
      const spaceIndex = query.indexOf(' ');
      const actualQuery = spaceIndex !== -1 ? query.slice(0, spaceIndex) : query;

      setMentionQuery(actualQuery);
      setCurrentMentionStart(atIndex);
      setShowMentions(true);
      setSelectedMentionIndex(0);

      // Filter apps based on query
      const filteredApps = systemApps().filter(app =>
        app.name.toLowerCase().includes(actualQuery.toLowerCase()) ||
        app.bundle_id.toLowerCase().includes(actualQuery.toLowerCase())
      ).slice(0, 8).map(app => ({
        type: "app" as const,
        id: app.bundle_id,
        title: app.name,
        subtitle: app.bundle_id,
        icon: "📱",
        data: app
      }));

      setMentionSuggestions(filteredApps);
      return;
    }

    // Check for # mentions (files)
    const hashIndex = value.lastIndexOf('#');
    if (hashIndex !== -1 && (hashIndex === 0 || value[hashIndex - 1] === ' ' || value[hashIndex - 1] === '\n')) {
      const query = value.slice(hashIndex + 1);
      const spaceIndex = query.indexOf(' ');
      const actualQuery = spaceIndex !== -1 ? query.slice(0, spaceIndex) : query;

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
      const result = await commands.searchFiles({
        pattern: query,
        max_results: 8,
        file_extensions: null,
        include_hidden: false
      }, null);

      if (result.status === "ok") {
        const fileSuggestions = result.data.map((file: any) => ({
          type: "file" as const,
          id: file.path,
          title: file.path.split('/').pop() || file.path,
          subtitle: file.path,
          icon: getFileIcon(file.file_type),
          data: file
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
      "Rust": "🦀", "JavaScript": "🟨", "React": "⚛️", "TypeScript": "🔷",
      "Python": "🐍", "Java": "☕", "C++": "🔧", "C": "⚙️", "Go": "🐹",
      "HTML": "🌐", "CSS": "🎨", "JSON": "📄", "Markdown": "📖", "Text": "📄"
    };
    return iconMap[fileType] || "📄";
  };

  // Handle mention selection
  const selectMention = (mention: MentionItem) => {
    const currentInput = inputValue();
    const beforeMention = currentInput.slice(0, currentMentionStart());
    const afterMention = currentInput.slice(currentMentionStart() + mentionQuery.length + 1);

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
        setSelectedMentionIndex(currentIndex === 0 ? suggestions.length - 1 : currentIndex - 1);
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
      context.apps = appMatches.map(match => {
        const appName = match.slice(1);
        const app = systemApps().find(a =>
          a.name.toLowerCase() === appName.toLowerCase() ||
          a.bundle_id.toLowerCase() === appName.toLowerCase()
        );
        return app ? app.bundle_id : ""; // Return bundle_id for database
      }).filter(Boolean); // Filter out empty strings
    }

    // Extract #file mentions
    const fileMatches = input.match(/#([^\s]+)/g);
    if (fileMatches) {
      context.files = fileMatches.map(match => match.slice(1)); // Return file path
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
          const app = systemApps().find(a => a.bundle_id === bundleId);
          return app ? { name: app.name, bundleId } : { name: bundleId, bundleId };
        }),
        files: context.files?.map((path: string) => ({
          path,
          type: "unknown"
        }))
      }
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue("");
    setShowMentions(false);
    setMentionSuggestions([]);

    try {
      if (!conversationId()) {
        throw new Error("No active conversation");
      }

      // Convert sources to the format expected by the backend
      const backendSources = sources || context.files?.map((file: string) => ({
        id: crypto.randomUUID(),
        source_type: { "File": { file_type: file.split('.').pop()?.toLowerCase() } },
        path: file,
        name: file.split('/').pop(),
        description: `File: ${file}`,
        metadata: { file_type: file.split('.').pop()?.toLowerCase() }
      })) || [];

      // Use enhanced database-integrated chat command with sources
      const result = await commands.chatWithAgentDb(
        conversationId(),
        content,
        context.apps, // app bundle IDs
        context.files, // file paths
        false, // use_vision
        true, // enable_tool_calling
        backendSources // new sources array
      );

      if (result.status === "ok") {
        const assistantMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: result.data.content,
          timestamp: new Date()
        };

        setMessages(prev => [...prev, assistantMessage]);
      } else {
        throw new Error(result.error || "Failed to get AI response");
      }
    } catch (error) {
      console.error("Failed to send message:", error);

      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "Sorry, I encountered an error while processing your request. Please try again.",
        timestamp: new Date()
      };

      setMessages(prev => [...prev, errorMessage]);
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
    <div class="ai-chat-interface">
      {/* Messages Container */}
      <div class="chat-messages" ref={chatContainerRef}>
        <For each={messages()}>
          {(message) => (
            <div class={`chat-message ${message.role}`}>
              <div class="message-avatar">
                {message.role === "user" ? "👤" : "🤖"}
              </div>
              <div class="message-content">
                <div class="message-text">{message.content}</div>
                <Show when={message.context && (message.context.apps?.length || message.context.files?.length)}>
                  <div class="message-context">
                    <Show when={message.context && message.context.apps && message.context.apps.length > 0}>
                      <div class="context-section">
                        <span class="context-label">Apps:</span>
                        <For each={message.context.apps}>
                          {(app) => (
                            <span class="context-tag">
                              📱 {app.name}
                            </span>
                          )}
                        </For>
                      </div>
                    </Show>
                    <Show when={message.context && message.context.files && message.context.files.length > 0}>
                      <div class="context-section">
                        <span class="context-label">Files:</span>
                        <For each={message.context.files}>
                          {(file) => (
                            <span class="context-tag">
                              📄 {file.path.split('/').pop()}
                            </span>
                          )}
                        </For>
                      </div>
                    </Show>
                  </div>
                </Show>
                <div class="message-time">
                  {message.timestamp.toLocaleTimeString()}
                </div>
              </div>
            </div>
          )}
        </For>

        {/* Loading indicator */}
        <Show when={isLoading()}>
          <div class="chat-message assistant">
            <div class="message-avatar">🤖</div>
            <div class="message-content">
              <div class="typing-indicator">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          </div>
        </Show>
      </div>

      {/* Input Area */}
      <div class="chat-input-container">
        <ContextualChatInput
          onSendMessage={sendMessage}
          placeholder="Ask AI anything... Use @filename for files, #appname for applications, or just type your message..."
          disabled={isLoading()}
        />
      </div>

      <style>{`
        .ai-chat-interface {
          display: flex;
          flex-direction: column;
          height: 100%;
          background: rgba(23, 23, 23, 0.95);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
        }

        .chat-messages {
          flex: 1;
          overflow-y: auto;
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .chat-messages::-webkit-scrollbar {
          width: 6px;
        }

        .chat-messages::-webkit-scrollbar-track {
          background: transparent;
        }

        .chat-messages::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.2);
          border-radius: 3px;
        }

        .chat-message {
          display: flex;
          gap: 12px;
          max-width: 100%;
        }

        .chat-message.user {
          flex-direction: row-reverse;
        }

        .message-avatar {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
          flex-shrink: 0;
        }

        .message-content {
          flex: 1;
          min-width: 0;
        }

        .chat-message.user .message-content {
          text-align: right;
        }

        .message-text {
          background: rgba(255, 255, 255, 0.1);
          color: rgba(255, 255, 255, 0.9);
          padding: 12px 16px;
          border-radius: 16px;
          font-size: 14px;
          line-height: 1.5;
          word-wrap: break-word;
        }

        .chat-message.user .message-text {
          background: rgba(59, 130, 246, 0.2);
          border: 1px solid rgba(59, 130, 246, 0.3);
        }

        .message-context {
          margin-top: 8px;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .chat-message.user .message-context {
          align-items: flex-end;
        }

        .context-section {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }

        .context-label {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.6);
          font-weight: 500;
        }

        .context-tag {
          background: rgba(255, 255, 255, 0.1);
          color: rgba(255, 255, 255, 0.8);
          padding: 2px 8px;
          border-radius: 12px;
          font-size: 11px;
          font-weight: 500;
        }

        .message-time {
          font-size: 11px;
          color: rgba(255, 255, 255, 0.4);
          margin-top: 4px;
        }

        .typing-indicator {
          display: flex;
          gap: 4px;
          padding: 12px 16px;
        }

        .typing-indicator span {
          width: 8px;
          height: 8px;
          background: rgba(255, 255, 255, 0.6);
          border-radius: 50%;
          animation: typing 1.4s infinite ease-in-out;
        }

        .typing-indicator span:nth-child(1) {
          animation-delay: -0.32s;
        }

        .typing-indicator span:nth-child(2) {
          animation-delay: -0.16s;
        }

        @keyframes typing {
          0%, 80%, 100% {
            transform: scale(0.8);
            opacity: 0.5;
          }
          40% {
            transform: scale(1);
            opacity: 1;
          }
        }

        .chat-input-container {
          padding: 16px;
          border-top: 1px solid rgba(255, 255, 255, 0.1);
          display: flex;
          gap: 12px;
          align-items: flex-end;
        }

        .chat-input-wrapper {
          flex: 1;
          position: relative;
        }

        .chat-input {
          width: 100%;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 16px;
          padding: 12px 16px;
          color: rgba(255, 255, 255, 0.9);
          font-size: 14px;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          resize: none;
          outline: none;
          min-height: 44px;
          max-height: 120px;
          line-height: 1.5;
        }

        .chat-input::placeholder {
          color: rgba(255, 255, 255, 0.5);
        }

        .chat-input:focus {
          border-color: rgba(59, 130, 246, 0.3);
          background: rgba(255, 255, 255, 0.08);
        }

        .mention-suggestions {
          position: absolute;
          bottom: 100%;
          left: 0;
          right: 0;
          background: rgba(30, 30, 30, 0.98);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          margin-bottom: 8px;
          max-height: 200px;
          overflow-y: auto;
          z-index: 10;
        }

        .mention-suggestion {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 16px;
          cursor: pointer;
          transition: background-color 0.15s ease;
        }

        .mention-suggestion:hover,
        .mention-suggestion.selected {
          background: rgba(255, 255, 255, 0.1);
        }

        .mention-icon {
          width: 24px;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 14px;
          flex-shrink: 0;
        }

        .mention-content {
          flex: 1;
          min-width: 0;
        }

        .mention-title {
          font-size: 14px;
          font-weight: 500;
          color: rgba(255, 255, 255, 0.9);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .mention-subtitle {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.6);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          margin-top: 2px;
        }

        .send-button {
          width: 44px;
          height: 44px;
          border-radius: 50%;
          border: none;
          background: rgba(59, 130, 246, 0.2);
          border: 1px solid rgba(59, 130, 246, 0.3);
          color: #60a5fa;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
          transition: all 0.15s ease;
          flex-shrink: 0;
        }

        .send-button:hover:not(:disabled) {
          background: rgba(59, 130, 246, 0.3);
          transform: scale(1.05);
        }

        .send-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
          transform: none;
        }
      `}</style>
    </div>
  );
}