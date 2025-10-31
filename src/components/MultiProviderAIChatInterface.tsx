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
  const [imageGenerationEnabled, setImageGenerationEnabled] =
    createSignal(false);
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
      preamble:
        "You are a helpful AI assistant integrated into a desktop application with access to multiple AI providers.",
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
          format!("{:?}", config.provider),
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
            model: config.model,
          };

          setMessages((prev) => [...prev, systemMessage]);
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
    if (!content || isLoading() || !isAgentInitialized() || !conversationId())
      return;

    setIsLoading(true);
    setInputValue("");

    // Add user message
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content,
      timestamp: new Date(),
      provider: currentProvider(),
      model: currentModel(),
    };

    setMessages((prev) => [...prev, userMessage]);

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
        agentConfig()?.enable_tools !== false,
      );

      if (result.status === "ok") {
        const assistantMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: result.data.content,
          timestamp: new Date(),
          toolCalls: result.data.tool_calls || [],
          provider: currentProvider(),
          model: currentModel(),
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
        content: `Sorry, I encountered an error while processing your request: ${error}`,
        timestamp: new Date(),
        provider: currentProvider(),
        model: currentModel(),
      };

      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const extractContextFromMessage = (message: string) => {
    const context: any = {};

    // Extract @app mentions
    const appMatches = message.match(/@([^\s]+)/g);
    if (appMatches) {
      context.apps = appMatches
        .map((match) => {
          const appName = match.slice(1);
          const app = systemApps().find(
            (a) =>
              a.name.toLowerCase() === appName.toLowerCase() ||
              a.bundle_id.toLowerCase() === appName.toLowerCase(),
          );
          return app ? app.bundle_id : "";
        })
        .filter(Boolean);
    }

    // Extract #file mentions
    const fileMatches = message.match(/#([^\s]+)/g);
    if (fileMatches) {
      context.files = fileMatches.map((match) => match.slice(1));
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
    <div class="-webkit-backdrop-blur-xl flex h-screen flex-col bg-gray-900/95 backdrop-blur-xl">
      {/* Header */}
      <div class="flex flex-shrink-0 items-center justify-between border-b border-white/10 p-5">
        <div class="flex-1">
          <h2 class="m-0 text-xl font-semibold text-white/90">AI Chat</h2>
          <Show when={isAgentInitialized()}>
            <div class="mt-1 flex items-center gap-3">
              <span class="rounded-md border border-blue-500/20 bg-blue-500/10 px-2 py-1 text-xs text-white/70">
                {currentProvider()} - {currentModel()}
              </span>
              <button
                onClick={switchProvider}
                class="cursor-pointer rounded-md border border-blue-500/30 bg-blue-500/20 px-3 py-1.5 text-xs text-blue-400 transition-all hover:bg-blue-500/30"
              >
                Switch Provider
              </button>
            </div>
          </Show>
        </div>
        <div class="flex-shrink-0">
          <Show when={!isAgentInitialized()}>
            <button
              onClick={() => setShowConfigPanel(true)}
              class="cursor-pointer rounded-md border border-blue-500/30 bg-blue-500/20 px-3 py-1.5 text-xs text-blue-400 transition-all hover:bg-blue-500/30"
            >
              Configure AI
            </button>
          </Show>
        </div>
      </div>

      {/* Config Panel */}
      <Show when={showConfigPanel()}>
        <div class="fixed inset-0 z-[1000] flex items-center justify-center bg-black/80">
          <div class="max-h-[90vh] w-[90%] max-w-[600px] overflow-y-auto rounded-xl bg-gray-800/98 shadow-2xl">
            <div class="flex items-center justify-between border-b border-white/10 p-5">
              <h3 class="m-0 text-lg font-semibold text-white/90">
                Configure AI Provider
              </h3>
              <button
                onClick={() => setShowConfigPanel(false)}
                class="cursor-pointer rounded border-none bg-none p-1 text-lg text-white/70 transition-all hover:bg-white/10 hover:text-white/90"
              >
                ✕
              </button>
            </div>
            <ProviderConfigPanel
              onConfigChange={handleConfigChange}
              initialConfig={agentConfig() || undefined}
            />
            <div class="flex justify-end gap-3 border-t border-white/10 p-5">
              <button
                onClick={() => setShowConfigPanel(false)}
                class="cursor-pointer rounded-lg border border-white/20 bg-white/10 px-5 py-2.5 text-white/80 transition-all hover:bg-white/15"
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
                class="cursor-pointer rounded-lg border border-blue-500/30 bg-blue-500/20 px-5 py-2.5 text-blue-400 transition-all hover:bg-blue-500/30 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Initialize AI
              </button>
            </div>
          </div>
        </div>
      </Show>

      {/* Welcome Screen */}
      <Show when={!isAgentInitialized()}>
        <div class="flex flex-1 items-center justify-center p-10">
          <div class="max-w-[500px] text-center">
            <h2 class="m-0 mb-4 text-4xl font-bold text-white/90">
              Welcome to Multi-Provider AI Chat
            </h2>
            <p class="m-0 mb-8 text-base leading-relaxed text-white/70">
              Choose from multiple AI providers including OpenAI, Anthropic,
              Google, Ollama, and more.
            </p>
            <div class="mb-10 grid grid-cols-1 gap-6 md:grid-cols-2">
              <div class="flex items-start gap-3 text-left">
                <span class="flex-shrink-0 text-2xl">🤖</span>
                <div>
                  <h4 class="m-0 mb-1 text-sm font-semibold text-white/90">
                    Multiple Providers
                  </h4>
                  <p class="m-0 text-xs leading-relaxed text-white/60">
                    Support for 13+ AI providers
                  </p>
                </div>
              </div>
              <div class="flex items-start gap-3 text-left">
                <span class="flex-shrink-0 text-2xl">🛠️</span>
                <div>
                  <h4 class="m-0 mb-1 text-sm font-semibold text-white/90">
                    Tool Calling
                  </h4>
                  <p class="m-0 text-xs leading-relaxed text-white/60">
                    Advanced tool integration
                  </p>
                </div>
              </div>
              <div class="flex items-start gap-3 text-left">
                <span class="flex-shrink-0 text-2xl">🎨</span>
                <div>
                  <h4 class="m-0 mb-1 text-sm font-semibold text-white/90">
                    Image Generation
                  </h4>
                  <p class="m-0 text-xs leading-relaxed text-white/60">
                    DALL-E and vision models
                  </p>
                </div>
              </div>
              <div class="flex items-start gap-3 text-left">
                <span class="flex-shrink-0 text-2xl">🔍</span>
                <div>
                  <h4 class="m-0 mb-1 text-sm font-semibold text-white/90">
                    Semantic Search
                  </h4>
                  <p class="m-0 text-xs leading-relaxed text-white/60">
                    Vector embeddings support
                  </p>
                </div>
              </div>
            </div>
            <button
              onClick={() => setShowConfigPanel(true)}
              class="cursor-pointer rounded-lg border border-blue-500/30 bg-blue-500/20 px-7 py-3.5 text-base font-semibold text-blue-400 transition-all hover:-translate-y-px hover:bg-blue-500/30"
            >
              Get Started - Configure AI
            </button>
          </div>
        </div>
      </Show>

      {/* Chat Interface */}
      <Show when={isAgentInitialized()}>
        {/* Messages Container */}
        <div
          class="flex flex-1 flex-col gap-4 overflow-y-auto p-5"
          ref={chatContainerRef}
        >
          <For each={messages()}>
            {(message) => (
              <div
                class={`flex max-w-full gap-3 ${message.role === "user" ? "flex-row-reverse" : ""}`}
              >
                <div class="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-lg">
                  {message.role === "user" ? "👤" : "🤖"}
                </div>
                <div class="min-w-0 flex-1">
                  <div
                    class={`rounded-[18px] px-4.5 py-3.5 text-sm leading-6 break-words whitespace-pre-wrap text-white/90 ${
                      message.role === "user"
                        ? "border border-blue-500/30 bg-blue-500/20 text-right"
                        : "bg-white/10"
                    }`}
                  >
                    {message.content}
                  </div>

                  {/* Provider and Model Info */}
                  <Show when={message.provider && message.model}>
                    <div
                      class={`mt-1.5 text-xs text-white/50 italic ${
                        message.role === "user" ? "text-right" : ""
                      }`}
                    >
                      {message.provider} - {message.model}
                    </div>
                  </Show>

                  {/* Tool Calls */}
                  <Show
                    when={message.toolCalls && message.toolCalls.length > 0}
                  >
                    <div class="mt-2 rounded-lg border border-green-500/20 bg-green-500/10 p-3">
                      <div class="mb-2 text-xs font-semibold text-green-400">
                        Tool Calls:
                      </div>
                      <For each={message.toolCalls}>
                        {(toolCall) => (
                          <div class="mb-2 rounded-md bg-white/5 p-2 last:mb-0">
                            <div class="mb-1 text-xs font-semibold text-white/90">
                              {toolCall.name}
                            </div>
                            <Show when={toolCall.result}>
                              <pre class="mx-0 my-1 overflow-x-auto rounded bg-black/30 px-2 py-1 text-xs text-white/80">
                                {JSON.stringify(toolCall.result, null, 2)}
                              </pre>
                            </Show>
                          </div>
                        )}
                      </For>
                    </div>
                  </Show>

                  <div class="mt-1.5 text-[11px] text-white/40">
                    {message.timestamp.toLocaleTimeString()}
                  </div>
                </div>
              </div>
            )}
          </For>

          {/* Loading indicator */}
          <Show when={isLoading()}>
            <div class="flex gap-3">
              <div class="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-lg">
                🤖
              </div>
              <div class="flex-1">
                <div class="rounded-[18px] bg-white/10 px-4.5 py-3.5">
                  <div class="flex gap-1">
                    <span class="animate-typing h-2 w-2 rounded-full bg-white/60 [animation-delay:-0.32s]"></span>
                    <span class="animate-typing h-2 w-2 rounded-full bg-white/60 [animation-delay:-0.16s]"></span>
                    <span class="animate-typing h-2 w-2 rounded-full bg-white/60"></span>
                  </div>
                </div>
              </div>
            </div>
          </Show>
        </div>

        {/* Input Area */}
        <div class="flex flex-shrink-0 items-end gap-3 border-t border-white/10 p-5">
          <textarea
            ref={inputRef}
            value={inputValue()}
            onInput={(e) => setInputValue(e.currentTarget.value)}
            onKeyDown={handleInputKeyDown}
            placeholder="Ask AI anything... Supports @app mentions and #file references"
            class="max-h-[120px] min-h-[48px] flex-1 resize-none rounded-[18px] border border-white/10 bg-white/5 px-4.5 py-3.5 text-sm leading-6 text-white/90 placeholder-white/50 outline-none focus:border-blue-500/30 focus:bg-white/8"
            rows={2}
          />
          <button
            onClick={sendMessage}
            disabled={!inputValue().trim() || isLoading()}
            class="flex h-12 w-12 flex-shrink-0 cursor-pointer items-center justify-center rounded-full border border-none border-blue-500/30 bg-blue-500/20 text-lg text-blue-400 transition-all hover:scale-105 hover:bg-blue-500/30 disabled:transform-none disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLoading() ? "⏳" : "📤"}
          </button>
        </div>
      </Show>
    </div>
  );
}

