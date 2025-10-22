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
    <div class="enhanced-ai-chat-interface">
      {/* Control Panel */}
      <div class="control-panel">
        <div class="control-group">
          <label class="toggle-label">
            <input
              type="checkbox"
              checked={toolCallingEnabled()}
              onChange={(e) => setToolCallingEnabled(e.currentTarget.checked)}
            />
            Tool Calling
          </label>
          <label class="toggle-label">
            <input
              type="checkbox"
              checked={imageGenerationEnabled()}
              onChange={(e) => setImageGenerationEnabled(e.currentTarget.checked)}
            />
            Image Generation
          </label>
          <label class="toggle-label">
            <input
              type="checkbox"
              checked={embeddingsEnabled()}
              onChange={(e) => setEmbeddingsEnabled(e.currentTarget.checked)}
            />
            Semantic Search
          </label>
        </div>

        <div class="control-buttons">
          <Show when={toolCallingEnabled()}>
            <button
              onClick={() => setShowToolPanel(!showToolPanel())}
              class="control-button"
            >
              🛠️ Tools
            </button>
          </Show>

          <Show when={imageGenerationEnabled()}>
            <button
              onClick={() => setShowImagePanel(!showImagePanel())}
              class="control-button"
            >
              🎨 Images
            </button>
          </Show>

          <Show when={embeddingsEnabled()}>
            <button
              onClick={() => setShowEmbeddingPanel(!showEmbeddingPanel())}
              class="control-button"
            >
              🔍 Search
            </button>
          </Show>
        </div>
      </div>

      {/* Tool Panel */}
      <Show when={showToolPanel()}>
        <div class="tool-panel">
          <h3>Execute Tool</h3>
          <div class="tool-form">
            <select
              value={selectedTool()}
              onChange={(e) => setSelectedTool(e.currentTarget.value)}
            >
              <option value="">Select a tool...</option>
              <For each={availableTools()}>
                {(tool) => (
                  <option value={tool.name}>{tool.name}: {tool.description}</option>
                )}
              </For>
            </select>

            <Show when={selectedTool()}>
              <div class="tool-parameters">
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
                />
              </div>

              <button onClick={executeTool} disabled={isLoading()}>
                Execute Tool
              </button>
            </Show>
          </div>
        </div>
      </Show>

      {/* Image Generation Panel */}
      <Show when={showImagePanel()}>
        <div class="image-panel">
          <h3>Generate Image</h3>
          <div class="image-form">
            <textarea
              placeholder="Describe the image you want to generate..."
              value={imagePrompt()}
              onInput={(e) => setImagePrompt(e.currentTarget.value)}
              rows={3}
            />

            <div class="image-options">
              <div class="option-group">
                <label>Style:</label>
                <select
                  value={imageStyle()}
                  onChange={(e) => setImageStyle(e.currentTarget.value)}
                >
                  <option value="vivid">Vivid</option>
                  <option value="natural">Natural</option>
                </select>
              </div>

              <div class="option-group">
                <label>Size:</label>
                <select
                  value={imageSize()}
                  onChange={(e) => setImageSize(e.currentTarget.value)}
                >
                  <option value="1024x1024">1024x1024</option>
                  <option value="1792x1024">1792x1024</option>
                  <option value="1024x1792">1024x1792</option>
                </select>
              </div>

              <div class="option-group">
                <label>Quality:</label>
                <select
                  value={imageQuality()}
                  onChange={(e) => setImageQuality(e.currentTarget.value)}
                >
                  <option value="standard">Standard</option>
                  <option value="hd">HD</option>
                </select>
              </div>
            </div>

            <button onClick={generateImage} disabled={isLoading() || !imagePrompt().trim()}>
              Generate Image
            </button>
          </div>
        </div>
      </Show>

      {/* Embedding Panel */}
      <Show when={showEmbeddingPanel()}>
        <div class="embedding-panel">
          <h3>Semantic Search & Embeddings</h3>

          <div class="embedding-section">
            <h4>Create Embedding</h4>
            <textarea
              placeholder="Enter text to create embeddings..."
              value={embeddingText()}
              onInput={(e) => setEmbeddingText(e.currentTarget.value)}
              rows={2}
            />
            <button onClick={createEmbedding} disabled={isLoading() || !embeddingText().trim()}>
              Create Embedding
            </button>
          </div>

          <div class="embedding-section">
            <h4>Search Conversation</h4>
            <input
              type="text"
              placeholder="Search query..."
              value={searchQuery()}
              onInput={(e) => setSearchQuery(e.currentTarget.value)}
            />
            <button onClick={performSemanticSearch} disabled={isLoading() || !searchQuery().trim()}>
              Search
            </button>
          </div>
        </div>
      </Show>

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

                {/* Tool Calls */}
                <Show when={message.toolCalls && message.toolCalls.length > 0}>
                  <div class="tool-calls">
                    <div class="tool-calls-header">Tool Calls:</div>
                    <For each={message.toolCalls}>
                      {(toolCall) => (
                        <div class={`tool-call ${toolCall.status}`}>
                          <div class="tool-name">{toolCall.name}</div>
                          <Show when={toolCall.parameters}>
                            <pre class="tool-parameters">
                              {JSON.stringify(toolCall.parameters, null, 2)}
                            </pre>
                          </Show>
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

                {/* Generated Images */}
                <Show when={message.images && message.images.length > 0}>
                  <div class="generated-images">
                    <div class="images-header">Generated Images:</div>
                    <For each={message.images}>
                      {(image) => (
                        <div class="generated-image">
                          <Show when={image.base64}>
                            <img
                              src={`data:image/png;base64,${image.base64}`}
                              alt="Generated image"
                              class="image-preview"
                            />
                          </Show>
                          <Show when={image.revisedPrompt}>
                            <div class="revised-prompt">
                              <strong>Revised prompt:</strong> {image.revisedPrompt}
                            </div>
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
          placeholder="Ask AI anything... Tools, images, and semantic search are available!"
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

      <style>{`
        .enhanced-ai-chat-interface {
          display: flex;
          flex-direction: column;
          height: 100vh;
          background: rgba(23, 23, 23, 0.95);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
        }

        .control-panel {
          padding: 12px 16px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-shrink: 0;
        }

        .control-group {
          display: flex;
          gap: 16px;
        }

        .toggle-label {
          display: flex;
          align-items: center;
          gap: 6px;
          color: rgba(255, 255, 255, 0.8);
          font-size: 13px;
          cursor: pointer;
        }

        .toggle-label input[type="checkbox"] {
          accent-color: #3b82f6;
        }

        .control-buttons {
          display: flex;
          gap: 8px;
        }

        .control-button {
          background: rgba(59, 130, 246, 0.2);
          border: 1px solid rgba(59, 130, 246, 0.3);
          color: #60a5fa;
          padding: 6px 12px;
          border-radius: 8px;
          font-size: 12px;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .control-button:hover {
          background: rgba(59, 130, 246, 0.3);
        }

        .tool-panel, .image-panel, .embedding-panel {
          background: rgba(30, 30, 30, 0.95);
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
          padding: 16px;
          flex-shrink: 0;
        }

        .tool-panel h3, .image-panel h3, .embedding-panel h3 {
          color: rgba(255, 255, 255, 0.9);
          margin: 0 0 12px 0;
          font-size: 14px;
        }

        .tool-form, .image-form {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .tool-form select, .image-form textarea {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          padding: 8px 12px;
          color: rgba(255, 255, 255, 0.9);
          font-size: 13px;
        }

        .tool-parameters textarea {
          font-family: 'Monaco', 'Menlo', monospace;
          font-size: 11px;
        }

        .image-options {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
        }

        .option-group {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .option-group label {
          color: rgba(255, 255, 255, 0.7);
          font-size: 12px;
        }

        .option-group select {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 6px;
          padding: 6px 8px;
          color: rgba(255, 255, 255, 0.9);
          font-size: 12px;
        }

        .embedding-section {
          margin-bottom: 16px;
        }

        .embedding-section h4 {
          color: rgba(255, 255, 255, 0.8);
          margin: 0 0 8px 0;
          font-size: 13px;
        }

        .embedding-section textarea,
        .embedding-section input {
          width: 100%;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          padding: 8px 12px;
          color: rgba(255, 255, 255, 0.9);
          font-size: 13px;
          margin-bottom: 8px;
        }

        .chat-messages {
          flex: 1;
          overflow-y: auto;
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 12px;
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
          white-space: pre-wrap;
        }

        .chat-message.user .message-text {
          background: rgba(59, 130, 246, 0.2);
          border: 1px solid rgba(59, 130, 246, 0.3);
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

        .tool-call {
          margin-bottom: 8px;
          padding: 8px;
          background: rgba(255, 255, 255, 0.05);
          border-radius: 6px;
        }

        .tool-name {
          color: rgba(255, 255, 255, 0.9);
          font-size: 12px;
          font-weight: 600;
          margin-bottom: 4px;
        }

        .tool-parameters, .tool-result {
          background: rgba(0, 0, 0, 0.3);
          padding: 6px 8px;
          border-radius: 4px;
          font-size: 11px;
          color: rgba(255, 255, 255, 0.8);
          overflow-x: auto;
          margin: 4px 0;
        }

        .generated-images {
          margin-top: 8px;
        }

        .images-header {
          color: rgba(255, 255, 255, 0.7);
          font-size: 12px;
          font-weight: 600;
          margin-bottom: 8px;
        }

        .generated-image {
          margin-bottom: 8px;
        }

        .image-preview {
          max-width: 200px;
          max-height: 200px;
          border-radius: 8px;
          margin-bottom: 4px;
        }

        .revised-prompt {
          color: rgba(255, 255, 255, 0.7);
          font-size: 11px;
          font-style: italic;
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

        .typing-indicator span:nth-child(1) { animation-delay: -0.32s; }
        .typing-indicator span:nth-child(2) { animation-delay: -0.16s; }

        @keyframes typing {
          0%, 80%, 100% { transform: scale(0.8); opacity: 0.5; }
          40% { transform: scale(1); opacity: 1; }
        }

        .chat-input-container {
          padding: 16px;
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
          border-radius: 16px;
          padding: 12px 16px;
          color: rgba(255, 255, 255, 0.9);
          font-size: 14px;
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

        button {
          background: rgba(59, 130, 246, 0.2);
          border: 1px solid rgba(59, 130, 246, 0.3);
          color: #60a5fa;
          padding: 8px 16px;
          border-radius: 8px;
          font-size: 13px;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        button:hover:not(:disabled) {
          background: rgba(59, 130, 246, 0.3);
        }

        button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
}