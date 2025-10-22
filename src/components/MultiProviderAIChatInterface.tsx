import {
  createSignal,
  createEffect,
  onMount,
  For,
  Show,
  Switch,
  Match,
} from "solid-js";
import { commands } from "../bindings";
import ProviderConfigPanel from "./ProviderConfigPanel";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  context?: {
    apps?: Array<{ name: string; bundleId: string }>;
    files?: Array<{ path: string; type: string }>;
  };
  toolCalls?: any[];
  images?: any[];
  embeddings?: any[];
  provider?: string;
  model?: string;
}

interface AIConfig {
  provider: any;
  model: string;
  api_key?: string;
  base_url?: string;
  temperature?: number;
  max_tokens?: number;
  preamble?: string;
  enable_vision?: boolean;
  enable_tools?: boolean;
  enable_embeddings?: boolean;
  azure_endpoint?: string;
  azure_deployment?: string;
  azure_api_version?: string;
  anthropic_version?: string;
  google_project_id?: string;
  google_location?: string;
  ollama_host?: string;
  ollama_port?: number;
}

export default function MultiProviderAIChatInterface() {
  const [messages, setMessages] = createSignal<ChatMessage[]>([]);
  const [inputValue, setInputValue] = createSignal("");
  const [isLoading, setIsLoading] = createSignal(false);
  const [conversationId, setConversationId] = createSignal<string>("");
  const [systemApps, setSystemApps] = createSignal<any[]>([]);
  const [showConfigPanel, setShowConfigPanel] = createSignal(false);
  const [agentConfig, setAgentConfig] = createSignal<AIConfig | null>(null);
  const [isAgentInitialized, setIsAgentInitialized] = createSignal(false);
  const [currentProvider, setCurrentProvider] = createSignal<string>("");
  const [currentModel, setCurrentModel] = createSignal<string>("");
  const [toolCallingEnabled, setToolCallingEnabled] = createSignal(true);
  const [imageGenerationEnabled, setImageGenerationEnabled] = createSignal(false);
  const [embeddingsEnabled, setEmbeddingsEnabled] = createSignal(false);

  let chatContainerRef: HTMLDivElement | undefined;
  let inputRef: HTMLTextAreaElement | undefined;

  // Initialize with default config
  onMount(async () => {
    const defaultConfig: AIConfig = {
      provider: null,
      model: "",
      temperature: 0.7,
      max_tokens: 1000,
      preamble: "You are a helpful AI assistant integrated into a desktop application with access to multiple AI providers.",
      enable_vision: false,
      enable_tools: true,
      enable_embeddings: false,
    };

    setAgentConfig(defaultConfig);
    await loadSystemApps();
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

  const initializeAgent = async (config: AIConfig) => {
    setIsLoading(true);
    try {
      const result = await commands.initializeAgentWithDb(config);

      if (result.status === "ok") {
        // Create new conversation
        const conversationResult = await commands.createConversationWithDb(
          null,
          config.model,
          format!("{:?}", config.provider)
        );

        if (conversationResult.status === "ok") {
          setConversationId(conversationResult.data);
          setIsAgentInitialized(true);
          setCurrentProvider(format!("{:?}", config.provider));
          setCurrentModel(config.model);
          setShowConfigPanel(false);

          // Add system message
          const systemMessage: ChatMessage = {
            id: Date.now().toString(),
            role: "assistant",
            content: `AI Agent initialized successfully!\n\nProvider: ${format!("{:?}", config.provider)}\nModel: ${config.model}\nVision: ${config.enable_vision ? "Enabled" : "Disabled"}\nTools: ${config.enable_tools ? "Enabled" : "Disabled"}\nEmbeddings: ${config.enable_embeddings ? "Enabled" : "Disabled"}`,
            timestamp: new Date(),
            provider: format!("{:?}", config.provider),
            model: config.model
          };

          setMessages(prev => [...prev, systemMessage]);
        }
      } else {
        throw new Error(result.error || "Failed to initialize agent");
      }
    } catch (error) {
      console.error("Failed to initialize agent:", error);
      alert(`Failed to initialize AI agent: ${error}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfigChange = (config: AIConfig) => {
    setAgentConfig(config);
    setToolCallingEnabled(config.enable_tools !== false);
    setImageGenerationEnabled(config.enable_vision || false);
    setEmbeddingsEnabled(config.enable_embeddings || false);
  };

  const sendMessage = async () => {
    const content = inputValue().trim();
    if (!content || isLoading() || !isAgentInitialized() || !conversationId()) return;

    setIsLoading(true);
    setInputValue("");

    // Add user message
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content,
      timestamp: new Date(),
      provider: currentProvider(),
      model: currentModel()
    };

    setMessages(prev => [...prev, userMessage]);

    try {
      // Extract context from message
      const context = extractContextFromMessage(content);

      // Send to AI
      const result = await commands.chatWithAgentDb(
        conversationId(),
        content,
        context.apps,
        context.files,
        agentConfig()?.enable_vision || false,
        agentConfig()?.enable_tools !== false
      );

      if (result.status === "ok") {
        const assistantMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: result.data.content,
          timestamp: new Date(),
          toolCalls: result.data.tool_calls || [],
          provider: currentProvider(),
          model: currentModel()
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
        content: `Sorry, I encountered an error while processing your request: ${error}`,
        timestamp: new Date(),
        provider: currentProvider(),
        model: currentModel()
      };

      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const extractContextFromMessage = (message: string) => {
    const context: any = {};

    // Extract @app mentions
    const appMatches = message.match(/@([^\s]+)/g);
    if (appMatches) {
      context.apps = appMatches.map(match => {
        const appName = match.slice(1);
        const app = systemApps().find(a =>
          a.name.toLowerCase() === appName.toLowerCase() ||
          a.bundle_id.toLowerCase() === appName.toLowerCase()
        );
        return app ? app.bundle_id : "";
      }).filter(Boolean);
    }

    // Extract #file mentions
    const fileMatches = message.match(/#([^\s]+)/g);
    if (fileMatches) {
      context.files = fileMatches.map(match => match.slice(1));
    }

    return context;
  };

  const switchProvider = () => {
    setShowConfigPanel(true);
  };

  const handleInputKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Auto-scroll to bottom
  createEffect(() => {
    if (chatContainerRef) {
      setTimeout(() => {
        if (chatContainerRef) {
          chatContainerRef.scrollTop = chatContainerRef.scrollHeight;
        }
      }, 100);
    }
  });

  return (
    <div class="multi-provider-ai-chat-interface">
      {/* Header */}
      <div class="chat-header">
        <div class="header-left">
          <h2>AI Chat</h2>
          <Show when={isAgentInitialized()}>
            <div class="current-provider">
              <span class="provider-info">
                {currentProvider()} - {currentModel()}
              </span>
              <button
                onClick={switchProvider}
                class="switch-provider-button"
              >
                Switch Provider
              </button>
            </div>
          </Show>
        </div>
        <div class="header-right">
          <Show when={!isAgentInitialized()}>
            <button
              onClick={() => setShowConfigPanel(true)}
              class="configure-button"
            >
              Configure AI
            </button>
          </Show>
        </div>
      </div>

      {/* Config Panel */}
      <Show when={showConfigPanel()}>
        <div class="config-panel-overlay">
          <div class="config-panel">
            <div class="config-panel-header">
              <h3>Configure AI Provider</h3>
              <button
                onClick={() => setShowConfigPanel(false)}
                class="close-button"
              >
                ✕
              </button>
            </div>
            <ProviderConfigPanel
              onConfigChange={handleConfigChange}
              initialConfig={agentConfig() || undefined}
            />
            <div class="config-panel-actions">
              <button
                onClick={() => setShowConfigPanel(false)}
                class="cancel-button"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (agentConfig()) {
                    initializeAgent(agentConfig()!);
                  }
                }}
                disabled={!agentConfig()?.provider || !agentConfig()?.model}
                class="initialize-button"
              >
                Initialize AI
              </button>
            </div>
          </div>
        </div>
      </Show>

      {/* Welcome Screen */}
      <Show when={!isAgentInitialized()}>
        <div class="welcome-screen">
          <div class="welcome-content">
            <h2>Welcome to Multi-Provider AI Chat</h2>
            <p>Choose from multiple AI providers including OpenAI, Anthropic, Google, Ollama, and more.</p>
            <div class="features">
              <div class="feature">
                <span class="feature-icon">🤖</span>
                <div>
                  <h4>Multiple Providers</h4>
                  <p>Support for 13+ AI providers</p>
                </div>
              </div>
              <div class="feature">
                <span class="feature-icon">🛠️</span>
                <div>
                  <h4>Tool Calling</h4>
                  <p>Advanced tool integration</p>
                </div>
              </div>
              <div class="feature">
                <span class="feature-icon">🎨</span>
                <div>
                  <h4>Image Generation</h4>
                  <p>DALL-E and vision models</p>
                </div>
              </div>
              <div class="feature">
                <span class="feature-icon">🔍</span>
                <div>
                  <h4>Semantic Search</h4>
                  <p>Vector embeddings support</p>
                </div>
              </div>
            </div>
            <button
              onClick={() => setShowConfigPanel(true)}
              class="get-started-button"
            >
              Get Started - Configure AI
            </button>
          </div>
        </div>
      </Show>

      {/* Chat Interface */}
      <Show when={isAgentInitialized()}>
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

                  {/* Provider and Model Info */}
                  <Show when={message.provider && message.model}>
                    <div class="message-provider">
                      {message.provider} - {message.model}
                    </div>
                  </Show>

                  {/* Tool Calls */}
                  <Show when={message.toolCalls && message.toolCalls.length > 0}>
                    <div class="tool-calls">
                      <div class="tool-calls-header">Tool Calls:</div>
                      <For each={message.toolCalls}>
                        {(toolCall) => (
                          <div class={`tool-call ${toolCall.status || "completed"}`}>
                            <div class="tool-name">{toolCall.name}</div>
                            <Show when={toolCall.result}>
                              <pre class="tool-result">
                                {JSON.stringify(toolCall.result, null, 2)}
                              </pre>
                            </Show>
                          </div>
                        )}
                      </For>
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
          <textarea
            ref={inputRef}
            value={inputValue()}
            onInput={(e) => setInputValue(e.currentTarget.value)}
            onKeyDown={handleInputKeyDown}
            placeholder="Ask AI anything... Supports @app mentions and #file references"
            class="chat-input"
            rows={2}
          />
          <button
            onClick={sendMessage}
            disabled={!inputValue().trim() || isLoading()}
            class="send-button"
          >
            {isLoading() ? "⏳" : "📤"}
          </button>
        </div>
      </Show>

      <style>{`
        .multi-provider-ai-chat-interface {
          display: flex;
          flex-direction: column;
          height: 100vh;
          background: rgba(23, 23, 23, 0.95);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
        }

        .chat-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 20px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
          flex-shrink: 0;
        }

        .header-left h2 {
          margin: 0;
          font-size: 20px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.9);
        }

        .current-provider {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-top: 4px;
        }

        .provider-info {
          font-size: 13px;
          color: rgba(255, 255, 255, 0.7);
          padding: 4px 8px;
          background: rgba(59, 130, 246, 0.1);
          border: 1px solid rgba(59, 130, 246, 0.2);
          border-radius: 6px;
        }

        .switch-provider-button,
        .configure-button {
          background: rgba(59, 130, 246, 0.2);
          border: 1px solid rgba(59, 130, 246, 0.3);
          color: #60a5fa;
          padding: 6px 12px;
          border-radius: 6px;
          font-size: 12px;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .switch-provider-button:hover,
        .configure-button:hover {
          background: rgba(59, 130, 246, 0.3);
        }

        .config-panel-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.8);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }

        .config-panel {
          background: rgba(30, 30, 30, 0.98);
          border-radius: 12px;
          max-width: 600px;
          max-height: 90vh;
          width: 90%;
          overflow-y: auto;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        }

        .config-panel-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 20px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }

        .config-panel-header h3 {
          margin: 0;
          font-size: 18px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.9);
        }

        .close-button {
          background: none;
          border: none;
          color: rgba(255, 255, 255, 0.7);
          font-size: 18px;
          cursor: pointer;
          padding: 4px;
          border-radius: 4px;
          transition: all 0.15s ease;
        }

        .close-button:hover {
          background: rgba(255, 255, 255, 0.1);
          color: rgba(255, 255, 255, 0.9);
        }

        .config-panel-actions {
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          padding: 20px;
          border-top: 1px solid rgba(255, 255, 255, 0.1);
        }

        .cancel-button {
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.2);
          color: rgba(255, 255, 255, 0.8);
          padding: 10px 20px;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .cancel-button:hover {
          background: rgba(255, 255, 255, 0.15);
        }

        .initialize-button {
          background: rgba(59, 130, 246, 0.2);
          border: 1px solid rgba(59, 130, 246, 0.3);
          color: #60a5fa;
          padding: 10px 20px;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .initialize-button:hover:not(:disabled) {
          background: rgba(59, 130, 246, 0.3);
        }

        .initialize-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .welcome-screen {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 40px;
        }

        .welcome-content {
          text-align: center;
          max-width: 500px;
        }

        .welcome-content h2 {
          margin: 0 0 16px 0;
          font-size: 32px;
          font-weight: 700;
          color: rgba(255, 255, 255, 0.9);
        }

        .welcome-content p {
          margin: 0 0 32px 0;
          font-size: 16px;
          color: rgba(255, 255, 255, 0.7);
          line-height: 1.6;
        }

        .features {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 24px;
          margin-bottom: 40px;
        }

        .feature {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          text-align: left;
        }

        .feature-icon {
          font-size: 24px;
          flex-shrink: 0;
        }

        .feature h4 {
          margin: 0 0 4px 0;
          font-size: 14px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.9);
        }

        .feature p {
          margin: 0;
          font-size: 13px;
          color: rgba(255, 255, 255, 0.6);
          line-height: 1.4;
        }

        .get-started-button {
          background: rgba(59, 130, 246, 0.2);
          border: 1px solid rgba(59, 130, 246, 0.3);
          color: #60a5fa;
          padding: 14px 28px;
          border-radius: 8px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .get-started-button:hover {
          background: rgba(59, 130, 246, 0.3);
          transform: translateY(-1px);
        }

        .chat-messages {
          flex: 1;
          overflow-y: auto;
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 16px;
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
          width: 36px;
          height: 36px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 18px;
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
          padding: 14px 18px;
          border-radius: 18px;
          font-size: 14px;
          line-height: 1.5;
          word-wrap: break-word;
          white-space: pre-wrap;
        }

        .chat-message.user .message-text {
          background: rgba(59, 130, 246, 0.2);
          border: 1px solid rgba(59, 130, 246, 0.3);
        }

        .message-provider {
          font-size: 11px;
          color: rgba(255, 255, 255, 0.5);
          margin-top: 6px;
          font-style: italic;
        }

        .chat-message.user .message-provider {
          text-align: right;
        }

        .tool-calls {
          margin-top: 8px;
          padding: 12px;
          background: rgba(34, 197, 94, 0.1);
          border: 1px solid rgba(34, 197, 94, 0.2);
          border-radius: 8px;
        }

        .tool-calls-header {
          color: #4ade80;
          font-size: 12px;
          font-weight: 600;
          margin-bottom: 8px;
        }

        .tool-name {
          color: rgba(255, 255, 255, 0.9);
          font-size: 12px;
          font-weight: 600;
          margin-bottom: 4px;
        }

        .tool-result {
          background: rgba(0, 0, 0, 0.3);
          padding: 6px 8px;
          border-radius: 4px;
          font-size: 11px;
          color: rgba(255, 255, 255, 0.8);
          overflow-x: auto;
          margin: 4px 0;
        }

        .message-time {
          font-size: 11px;
          color: rgba(255, 255, 255, 0.4);
          margin-top: 6px;
        }

        .typing-indicator {
          display: flex;
          gap: 4px;
          padding: 14px 18px;
        }

        .typing-indicator span {
          width: 8px;
          height: 8px;
          background: rgba(255, 255, 255, 0.6);
          border-radius: 50%;
          animation: typing 1.4s infinite ease-in-out;
        }

        .typing-indicator span:nth-child(1) { animation-delay: -0.32s; }
        .typing-indicator span:nth-child(2) { animation-delay: -0.16s; }

        @keyframes typing {
          0%, 80%, 100% { transform: scale(0.8); opacity: 0.5; }
          40% { transform: scale(1); opacity: 1; }
        }

        .chat-input-container {
          padding: 20px;
          border-top: 1px solid rgba(255, 255, 255, 0.1);
          display: flex;
          gap: 12px;
          align-items: flex-end;
          flex-shrink: 0;
        }

        .chat-input {
          flex: 1;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 18px;
          padding: 14px 18px;
          color: rgba(255, 255, 255, 0.9);
          font-size: 14px;
          resize: none;
          outline: none;
          min-height: 48px;
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

        .send-button {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          border: none;
          background: rgba(59, 130, 246, 0.2);
          border: 1px solid rgba(59, 130, 246, 0.3);
          color: #60a5fa;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 18px;
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

        @media (max-width: 768px) {
          .features {
            grid-template-columns: 1fr;
            gap: 16px;
          }

          .config-panel {
            width: 95%;
            max-height: 95vh;
          }
        }
      `}</style>
    </div>
  );
}