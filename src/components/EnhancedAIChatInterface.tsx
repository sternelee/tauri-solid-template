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

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  context?: {
    apps?: Array<{ name: string; bundleId: string }>;
    files?: Array<{ path: string; type: string }>;
  };
  toolCalls?: ToolCall[];
  images?: GeneratedImage[];
  embeddings?: EmbeddingData[];
}

interface ToolCall {
  name: string;
  parameters: any;
  result?: any;
  status: "pending" | "completed" | "failed";
  error?: string;
}

interface GeneratedImage {
  url?: string;
  base64?: string;
  revisedPrompt?: string;
  timestamp: Date;
}

interface EmbeddingData {
  text: string;
  vector: number[];
  model: string;
}

interface AvailableTool {
  name: string;
  description: string;
  parameters: any;
  enabled?: boolean;
}

export default function EnhancedAIChatInterface() {
  const [messages, setMessages] = createSignal<ChatMessage[]>([]);
  const [inputValue, setInputValue] = createSignal("");
  const [isLoading, setIsLoading] = createSignal(false);
  const [conversationId, setConversationId] = createSignal<string>("");
  const [systemApps, setSystemApps] = createSignal<any[]>([]);
  const [availableTools, setAvailableTools] = createSignal<AvailableTool[]>([]);
  const [toolCallingEnabled, setToolCallingEnabled] = createSignal(true);
  const [imageGenerationEnabled, setImageGenerationEnabled] = createSignal(false);
  const [embeddingsEnabled, setEmbeddingsEnabled] = createSignal(false);
  const [showToolPanel, setShowToolPanel] = createSignal(false);
  const [showImagePanel, setShowImagePanel] = createSignal(false);
  const [showEmbeddingPanel, setShowEmbeddingPanel] = createSignal(false);

  // Tool panel states
  const [selectedTool, setSelectedTool] = createSignal<string>("");
  const [toolParameters, setToolParameters] = createSignal<any>({});

  // Image generation states
  const [imagePrompt, setImagePrompt] = createSignal("");
  const [imageStyle, setImageStyle] = createSignal("vivid");
  const [imageSize, setImageSize] = createSignal("1024x1024");
  const [imageQuality, setImageQuality] = createSignal("standard");

  // Embedding states
  const [embeddingText, setEmbeddingText] = createSignal("");
  const [searchQuery, setSearchQuery] = createSignal("");

  let chatContainerRef: HTMLDivElement | undefined;
  let inputRef: HTMLTextAreaElement | undefined;

  // Initialize on mount
  onMount(async () => {
    try {
      // Initialize AI agent
      const initResult = await commands.initializeAgentWithDb({
        provider: "OpenAI",
        model: "gpt-4o-mini",
        preamble: "You are a helpful AI assistant with access to tools, image generation, and semantic search capabilities. Use tools when helpful, generate images when requested, and can perform semantic search.",
        temperature: 0.7,
        max_tokens: 1000,
        enable_tools: true,
        enable_vision: false,
        enable_embeddings: false
      }, null);

      if (initResult.status === "ok") {
        // Create conversation
        const conversationResult = await commands.createConversationWithDb(
          null,
          "gpt-4o-mini",
          "OpenAI"
        );

        if (conversationResult.status === "ok") {
          setConversationId(conversationResult.data);
        }
      }

      // Load system apps and tools
      await loadSystemApps();
      await loadAvailableTools();
    } catch (error) {
      console.error("Failed to initialize enhanced AI chat:", error);
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

  const loadAvailableTools = async () => {
    try {
      const result = await commands.getAvailableToolsCommand();
      if (result.status === "ok") {
        setAvailableTools(result.data);
      }
    } catch (error) {
      console.error("Failed to load available tools:", error);
    }
  };

  const sendMessage = async () => {
    const content = inputValue().trim();
    if (!content || isLoading() || !conversationId()) return;

    setIsLoading(true);
    setInputValue("");

    // Add user message
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);

    try {
      // Extract context from message (basic implementation)
      const context = extractContextFromMessage(content);

      // Send to AI with enhanced capabilities
      const result = await commands.chatWithAgentDb(
        conversationId(),
        content,
        context.apps,
        context.files,
        false, // use_vision
        toolCallingEnabled() // enable_tool_calling
      );

      if (result.status === "ok") {
        const assistantMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: result.data.content,
          timestamp: new Date(),
          toolCalls: result.data.tool_calls || []
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

  const executeTool = async () => {
    const toolName = selectedTool();
    if (!toolName || !conversationId()) return;

    setIsLoading(true);

    try {
      const result = await commands.executeToolCommand(
        toolName,
        toolParameters()
      );

      // Add tool execution message
      const toolMessage: ChatMessage = {
        id: Date.now().toString(),
        role: "assistant",
        content: `Executed tool: ${toolName}\n\nParameters: ${JSON.stringify(toolParameters(), null, 2)}\n\nResult: ${JSON.stringify(result, null, 2)}`,
        timestamp: new Date(),
        toolCalls: [{
          name: toolName,
          parameters: toolParameters(),
          result,
          status: "completed"
        }]
      };

      setMessages(prev => [...prev, toolMessage]);
      setShowToolPanel(false);
      setSelectedTool("");
      setToolParameters({});
    } catch (error) {
      console.error("Failed to execute tool:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const generateImage = async () => {
    const prompt = imagePrompt();
    if (!prompt.trim() || !conversationId()) return;

    setIsLoading(true);

    try {
      const result = await commands.generateImageEnhanced(
        conversationId(),
        prompt,
        imageStyle(),
        imageSize(),
        imageQuality(),
        true // save_to_database
      );

      if (result.status === "ok" && result.data.data.length > 0) {
        const imageData = result.data.data[0];

        // Add image generation message
        const imageMessage: ChatMessage = {
          id: Date.now().toString(),
          role: "assistant",
          content: `Generated image with prompt: "${prompt}"${imageData.revised_prompt ? `\n\nRevised prompt: "${imageData.revised_prompt}"` : ""}`,
          timestamp: new Date(),
          images: [{
            base64: imageData.b64_json,
            revisedPrompt: imageData.revised_prompt,
            timestamp: new Date()
          }]
        };

        setMessages(prev => [...prev, imageMessage]);
        setShowImagePanel(false);
        setImagePrompt("");
      }
    } catch (error) {
      console.error("Failed to generate image:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const createEmbedding = async () => {
    const text = embeddingText();
    if (!text.trim() || !conversationId()) return;

    setIsLoading(true);

    try {
      const result = await commands.createEmbeddingsForSearch(
        conversationId(),
        text
      );

      if (result.status === "ok") {
        // Add embedding message
        const embeddingMessage: ChatMessage = {
          id: Date.now().toString(),
          role: "assistant",
          content: `Created embeddings for text: "${text}"\n\nModel: ${result.data.model}\nDimensions: ${result.data.data[0].embedding.length}`,
          timestamp: new Date(),
          embeddings: [{
            text,
            vector: result.data.data[0].embedding,
            model: result.data.model
          }]
        };

        setMessages(prev => [...prev, embeddingMessage]);
        setEmbeddingText("");
      }
    } catch (error) {
      console.error("Failed to create embedding:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const performSemanticSearch = async () => {
    const query = searchQuery();
    if (!query.trim() || !conversationId()) return;

    setIsLoading(true);

    try {
      const result = await commands.semanticSearchConversation(
        conversationId(),
        query
      );

      if (result.status === "ok") {
        const results = result.data;
        const resultsText = results.map(([index, similarity, text]) =>
          `${index + 1}. (Similarity: ${(similarity * 100).toFixed(1)}%) ${text.substring(0, 200)}...`
        ).join('\n\n');

        // Add search results message
        const searchMessage: ChatMessage = {
          id: Date.now().toString(),
          role: "assistant",
          content: `Semantic search results for "${query}":\n\n${resultsText}`,
          timestamp: new Date()
        };

        setMessages(prev => [...prev, searchMessage]);
        setSearchQuery("");
      }
    } catch (error) {
      console.error("Failed to perform semantic search:", error);
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
    <div class="flex flex-col h-screen bg-gray-900/95 backdrop-blur-xl -webkit-backdrop-blur-xl">
      {/* Control Panel */}
      <div class="p-3 border-b border-white/10 flex justify-between items-center flex-shrink-0">
        <div class="flex gap-4">
          <label class="flex items-center gap-1.5 text-white/80 text-xs cursor-pointer">
            <input
              type="checkbox"
              checked={toolCallingEnabled()}
              onChange={(e) => setToolCallingEnabled(e.currentTarget.checked)}
              class="accent-blue-500"
            />
            Tool Calling
          </label>
          <label class="flex items-center gap-1.5 text-white/80 text-xs cursor-pointer">
            <input
              type="checkbox"
              checked={imageGenerationEnabled()}
              onChange={(e) => setImageGenerationEnabled(e.currentTarget.checked)}
              class="accent-blue-500"
            />
            Image Generation
          </label>
          <label class="flex items-center gap-1.5 text-white/80 text-xs cursor-pointer">
            <input
              type="checkbox"
              checked={embeddingsEnabled()}
              onChange={(e) => setEmbeddingsEnabled(e.currentTarget.checked)}
              class="accent-blue-500"
            />
            Semantic Search
          </label>
        </div>

        <div class="flex gap-2">
          <Show when={toolCallingEnabled()}>
            <button
              onClick={() => setShowToolPanel(!showToolPanel())}
              class="px-3 py-1.5 bg-blue-500/20 border border-blue-500/30 text-blue-400 rounded-lg text-xs cursor-pointer transition-all hover:bg-blue-500/30"
            >
              🛠️ Tools
            </button>
          </Show>

          <Show when={imageGenerationEnabled()}>
            <button
              onClick={() => setShowImagePanel(!showImagePanel())}
              class="px-3 py-1.5 bg-blue-500/20 border border-blue-500/30 text-blue-400 rounded-lg text-xs cursor-pointer transition-all hover:bg-blue-500/30"
            >
              🎨 Images
            </button>
          </Show>

          <Show when={embeddingsEnabled()}>
            <button
              onClick={() => setShowEmbeddingPanel(!showEmbeddingPanel())}
              class="px-3 py-1.5 bg-blue-500/20 border border-blue-500/30 text-blue-400 rounded-lg text-xs cursor-pointer transition-all hover:bg-blue-500/30"
            >
              🔍 Search
            </button>
          </Show>
        </div>
      </div>

      {/* Tool Panel */}
      <Show when={showToolPanel()}>
        <div class="bg-gray-800/95 border-b border-white/10 p-4 flex-shrink-0">
          <h3 class="m-0 mb-3 text-sm font-semibold text-white/90">Execute Tool</h3>
          <div class="flex flex-col gap-3">
            <select
              value={selectedTool()}
              onChange={(e) => setSelectedTool(e.currentTarget.value)}
              class="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white/90 text-sm focus:outline-none focus:border-blue-500/50"
            >
              <option value="">Select a tool...</option>
              <For each={availableTools()}>
                {(tool) => (
                  <option value={tool.name}>{tool.name}: {tool.description}</option>
                )}
              </For>
            </select>

            <Show when={selectedTool()}>
              <div class="flex flex-col gap-2">
                <textarea
                  placeholder="Enter tool parameters as JSON..."
                  value={JSON.stringify(toolParameters(), null, 2)}
                  onInput={(e) => {
                    try {
                      setToolParameters(JSON.parse(e.currentTarget.value));
                    } catch (error) {
                      // Invalid JSON, ignore
                    }
                  }}
                  rows={4}
                  class="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white/90 text-xs font-mono focus:outline-none focus:border-blue-500/50 resize-y"
                />
              </div>

              <button
                onClick={executeTool}
                disabled={isLoading()}
                class="px-4 py-2 bg-blue-500/20 border border-blue-500/30 text-blue-400 rounded-lg text-sm cursor-pointer transition-all hover:bg-blue-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Execute Tool
              </button>
            </Show>
          </div>
        </div>
      </Show>

      {/* Image Generation Panel */}
      <Show when={showImagePanel()}>
        <div class="bg-gray-800/95 border-b border-white/10 p-4 flex-shrink-0">
          <h3 class="m-0 mb-3 text-sm font-semibold text-white/90">Generate Image</h3>
          <div class="flex flex-col gap-3">
            <textarea
              placeholder="Describe the image you want to generate..."
              value={imagePrompt()}
              onInput={(e) => setImagePrompt(e.currentTarget.value)}
              rows={3}
              class="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white/90 text-sm focus:outline-none focus:border-blue-500/50 resize-y"
            />

            <div class="grid grid-cols-3 gap-3">
              <div class="flex flex-col gap-1">
                <label class="text-white/70 text-xs">Style:</label>
                <select
                  value={imageStyle()}
                  onChange={(e) => setImageStyle(e.currentTarget.value)}
                  class="px-2 py-1.5 bg-white/5 border border-white/10 rounded-md text-white/90 text-xs focus:outline-none focus:border-blue-500/50"
                >
                  <option value="vivid">Vivid</option>
                  <option value="natural">Natural</option>
                </select>
              </div>

              <div class="flex flex-col gap-1">
                <label class="text-white/70 text-xs">Size:</label>
                <select
                  value={imageSize()}
                  onChange={(e) => setImageSize(e.currentTarget.value)}
                  class="px-2 py-1.5 bg-white/5 border border-white/10 rounded-md text-white/90 text-xs focus:outline-none focus:border-blue-500/50"
                >
                  <option value="1024x1024">1024x1024</option>
                  <option value="1792x1024">1792x1024</option>
                  <option value="1024x1792">1024x1792</option>
                </select>
              </div>

              <div class="flex flex-col gap-1">
                <label class="text-white/70 text-xs">Quality:</label>
                <select
                  value={imageQuality()}
                  onChange={(e) => setImageQuality(e.currentTarget.value)}
                  class="px-2 py-1.5 bg-white/5 border border-white/10 rounded-md text-white/90 text-xs focus:outline-none focus:border-blue-500/50"
                >
                  <option value="standard">Standard</option>
                  <option value="hd">HD</option>
                </select>
              </div>
            </div>

            <button
              onClick={generateImage}
              disabled={isLoading() || !imagePrompt().trim()}
              class="px-4 py-2 bg-blue-500/20 border border-blue-500/30 text-blue-400 rounded-lg text-sm cursor-pointer transition-all hover:bg-blue-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Generate Image
            </button>
          </div>
        </div>
      </Show>

      {/* Embedding Panel */}
      <Show when={showEmbeddingPanel()}>
        <div class="bg-gray-800/95 border-b border-white/10 p-4 flex-shrink-0">
          <h3 class="m-0 mb-4 text-sm font-semibold text-white/90">Semantic Search & Embeddings</h3>

          <div class="mb-4">
            <h4 class="m-0 mb-2 text-xs font-medium text-white/80">Create Embedding</h4>
            <textarea
              placeholder="Enter text to create embeddings..."
              value={embeddingText()}
              onInput={(e) => setEmbeddingText(e.currentTarget.value)}
              rows={2}
              class="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white/90 text-sm mb-2 focus:outline-none focus:border-blue-500/50 resize-y"
            />
            <button
              onClick={createEmbedding}
              disabled={isLoading() || !embeddingText().trim()}
              class="px-4 py-2 bg-blue-500/20 border border-blue-500/30 text-blue-400 rounded-lg text-sm cursor-pointer transition-all hover:bg-blue-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Create Embedding
            </button>
          </div>

          <div>
            <h4 class="m-0 mb-2 text-xs font-medium text-white/80">Search Conversation</h4>
            <input
              type="text"
              placeholder="Search query..."
              value={searchQuery()}
              onInput={(e) => setSearchQuery(e.currentTarget.value)}
              class="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white/90 text-sm mb-2 focus:outline-none focus:border-blue-500/50"
            />
            <button
              onClick={performSemanticSearch}
              disabled={isLoading() || !searchQuery().trim()}
              class="px-4 py-2 bg-blue-500/20 border border-blue-500/30 text-blue-400 rounded-lg text-sm cursor-pointer transition-all hover:bg-blue-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Search
            </button>
          </div>
        </div>
      </Show>

      {/* Messages Container */}
      <div class="flex-1 overflow-y-auto p-4 flex flex-col gap-3" ref={chatContainerRef}>
        <For each={messages()}>
          {(message) => (
            <div class={`flex gap-3 max-w-full ${message.role === "user" ? "flex-row-reverse" : ""}`}>
              <div class="w-8 h-8 rounded-full flex items-center justify-center text-base flex-shrink-0">
                {message.role === "user" ? "👤" : "🤖"}
              </div>
              <div class="flex-1 min-w-0">
                <div class={`px-4 py-3 rounded-2xl text-sm leading-6 break-words whitespace-pre-wrap text-white/90 ${
                  message.role === "user"
                    ? "bg-blue-500/20 border border-blue-500/30 text-right"
                    : "bg-white/10"
                }`}>
                  {message.content}
                </div>

                {/* Tool Calls */}
                <Show when={message.toolCalls && message.toolCalls.length > 0}>
                  <div class="mt-2 p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                    <div class="text-green-400 text-xs font-semibold mb-2">Tool Calls:</div>
                    <For each={message.toolCalls}>
                      {(toolCall) => (
                        <div class={`mb-2 p-2 bg-white/5 rounded-md last:mb-0`}>
                          <div class="text-white/90 text-xs font-semibold mb-1">{toolCall.name}</div>
                          <Show when={toolCall.parameters}>
                            <pre class="bg-black/30 px-2 py-1 rounded text-white/80 text-xs overflow-x-auto mx-0 my-1">
                              {JSON.stringify(toolCall.parameters, null, 2)}
                            </pre>
                          </Show>
                          <Show when={toolCall.result}>
                            <pre class="bg-black/30 px-2 py-1 rounded text-white/80 text-xs overflow-x-auto mx-0 my-1">
                              {JSON.stringify(toolCall.result, null, 2)}
                            </pre>
                          </Show>
                        </div>
                      )}
                    </For>
                  </div>
                </Show>

                {/* Generated Images */}
                <Show when={message.images && message.images.length > 0}>
                  <div class="mt-2">
                    <div class="text-white/70 text-xs font-semibold mb-2">Generated Images:</div>
                    <For each={message.images}>
                      {(image) => (
                        <div class="mb-2 last:mb-0">
                          <Show when={image.base64}>
                            <img
                              src={`data:image/png;base64,${image.base64}`}
                              alt="Generated image"
                              class="max-w-[200px] max-h-[200px] rounded-lg mb-1"
                            />
                          </Show>
                          <Show when={image.revisedPrompt}>
                            <div class="text-white/70 text-xs italic">
                              <strong>Revised prompt:</strong> {image.revisedPrompt}
                            </div>
                          </Show>
                        </div>
                      )}
                    </For>
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
            <div class="w-8 h-8 rounded-full flex items-center justify-center text-base flex-shrink-0">
              🤖
            </div>
            <div class="flex-1">
              <div class="px-4 py-3 bg-white/10 rounded-2xl">
                <div class="flex gap-1">
                  <span class="w-2 h-2 bg-white/60 rounded-full animate-typing [animation-delay:-0.32s]"></span>
                  <span class="w-2 h-2 bg-white/60 rounded-full animate-typing [animation-delay:-0.16s]"></span>
                  <span class="w-2 h-2 bg-white/60 rounded-full animate-typing"></span>
                </div>
              </div>
            </div>
          </div>
        </Show>
      </div>

      {/* Input Area */}
      <div class="p-4 border-t border-white/10 flex gap-3 items-end flex-shrink-0">
        <textarea
          ref={inputRef}
          value={inputValue()}
          onInput={(e) => setInputValue(e.currentTarget.value)}
          onKeyDown={handleInputKeyDown}
          placeholder="Ask AI anything... Tools, images, and semantic search are available!"
          class="flex-1 bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white/90 text-sm resize-none outline-none min-h-[44px] max-h-[120px] leading-6 placeholder-white/50 focus:border-blue-500/30 focus:bg-white/8"
          rows={2}
        />
        <button
          onClick={sendMessage}
          disabled={!inputValue().trim() || isLoading()}
          class="w-11 h-11 rounded-full border-none bg-blue-500/20 border border-blue-500/30 text-blue-400 cursor-pointer flex items-center justify-center text-base transition-all hover:bg-blue-500/30 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex-shrink-0"
        >
          {isLoading() ? "⏳" : "📤"}
        </button>
      </div>
  );
}
