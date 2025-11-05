<script lang="ts">
import { onMount, createEventDispatcher } from "svelte";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { ChatMessage, AIProvider } from "$lib/types";

interface Props {
  editorContent: string;
  onInsertContent: (content: string) => void;
  onReplaceContent: (content: string) => void;
  selectedText?: string;
  context?: {
    apps?: string[];
    files?: string[];
    text?: string;
  };
  isMinimized?: boolean;
  onToggleMinimize?: () => void;
}

let {
  editorContent,
  onInsertContent,
  onReplaceContent,
  selectedText = "",
  context = {},
  isMinimized = false,
  onToggleMinimize = () => {},
}: Props = $props();

const dispatch = createEventDispatcher();

// AI State
let messages: ChatMessage[] = $state([]);
let isLoading = $state(false);
let currentConversationId = $state<string>("");
let inputMessage = $state("");
let currentProvider = $state<AIProvider>({
  id: "openai",
  name: "OpenAI",
  models: ["gpt-4o", "gpt-4o-mini", "gpt-3.5-turbo"],
  icon: "🤖",
});
let currentModel = $state("gpt-4o");

// Native UI state
let isMac = $state(false);
let isDarkMode = $state(false);
let showQuickActions = $state(true);
let showProviderSettings = $state(false);
let isResizing = $state(false);
let panelWidth = $state(320);
let startX = $state(0);
let startWidth = $state(0);

// Animation states
let isTyping = $state(false);
let lastMessageIndex = $state(0);

const providers: AIProvider[] = [
  {
    id: "openai",
    name: "OpenAI",
    models: ["gpt-4o", "gpt-4o-mini", "gpt-3.5-turbo"],
    icon: "🤖",
  },
  {
    id: "anthropic",
    name: "Anthropic",
    models: ["claude-3-5-sonnet-20241022", "claude-3-5-haiku-20241022"],
    icon: "🧠",
  },
  {
    id: "google",
    name: "Google",
    models: ["gemini-1.5-pro", "gemini-1.5-flash"],
    icon: "🔍",
  },
  {
    id: "groq",
    name: "Groq",
    models: ["mixtral-8x7b-32768", "llama3-70b-8192"],
    icon: "⚡",
  },
];

const quickActions = [
  {
    title: "Improve Writing",
    description: "Enhance clarity, grammar, and style",
    icon: "✨",
    command: "improve",
    color: "blue",
    gradient: "from-blue-500 to-blue-600",
  },
  {
    title: "Summarize",
    description: "Create a concise summary",
    icon: "📝",
    command: "summarize",
    color: "green",
    gradient: "from-green-500 to-green-600",
  },
  {
    title: "Expand",
    description: "Add more detail and examples",
    icon: "📈",
    command: "expand",
    color: "purple",
    gradient: "from-purple-500 to-purple-600",
  },
  {
    title: "Continue Writing",
    description: "Continue where you left off",
    icon: "✍️",
    command: "continue",
    color: "orange",
    gradient: "from-orange-500 to-orange-600",
  },
  {
    title: "Translate",
    description: "Translate to another language",
    icon: "🌐",
    command: "translate",
    color: "indigo",
    gradient: "from-indigo-500 to-indigo-600",
  },
  {
    title: "Simplify",
    description: "Make it easier to understand",
    icon: "🔍",
    command: "simplify",
    color: "yellow",
    gradient: "from-yellow-500 to-yellow-600",
  },
];

onMount(async () => {
  // Detect platform
  isMac = navigator.userAgent.includes("Mac");

  // Initialize theme
  if (window.matchMedia) {
    const darkModeQuery = window.matchMedia("(prefers-color-scheme: dark)");
    isDarkMode = darkModeQuery.matches;
    darkModeQuery.addEventListener("change", (e) => {
      isDarkMode = e.matches;
    });
  }

  await initializeAI();
  await setupNativeNotifications();
});

async function initializeAI() {
  try {
    const initResult = await invoke("initializeAgentWithDb", {
      agentConfig: {
        provider: currentProvider.id,
        model: currentModel,
        preamble: `You are an AI writing assistant integrated into a rich text editor. You help users improve their writing, generate content, and provide suggestions. Always respond in markdown format for better readability. Be concise, helpful, and constructive. When asked to improve text, focus on clarity, grammar, style, and flow while preserving the original meaning.`,
        temperature: 0.7,
        max_tokens: 2000,
      },
    });

    if (initResult.status === "ok") {
      const convResult = await invoke("createConversationWithDb", {
        title: "Editor Assistant",
        model: currentModel,
        provider: currentProvider.id,
      });

      if (convResult.status === "ok") {
        currentConversationId = convResult.data;
      }
    }
  } catch (error) {
    console.error("Failed to initialize AI:", error);
  }
}

async function setupNativeNotifications() {
  if (window.__TAURI__) {
    // Listen for notification events
    await listen("ai-response-complete", () => {
      // Could show native notification
      console.log("AI response completed");
    });
  }
}

async function executeQuickAction(action: string) {
  if (!selectedText.trim()) {
    // If no text is selected, ask for clarification
    inputMessage = `Please ${action} the following content: ${editorContent.slice(0, 200)}${editorContent.length > 200 ? "..." : ""}`;
    await sendMessage();
    return;
  }

  const actionPrompts = {
    improve: `Please improve the following text for clarity, grammar, and style while maintaining the original meaning:\n\n${selectedText}`,
    summarize: `Please provide a concise summary of the following text:\n\n${selectedText}`,
    expand: `Please expand on the following text with more detail, examples, and explanations:\n\n${selectedText}`,
    continue: `Please continue writing the following text, maintaining the same tone and style:\n\n${selectedText}`,
    translate: `Please translate the following text to English:\n\n${selectedText}`,
    simplify: `Please simplify the following text to make it easier to understand:\n\n${selectedText}`,
  };

  inputMessage = actionPrompts[action as keyof typeof actionPrompts] || action;
  await sendMessage();
}

async function sendMessage() {
  if (!inputMessage.trim() || isLoading) return;

  isLoading = true;
  isTyping = true;
  const userMessage: ChatMessage = {
    id: Date.now().toString(),
    role: "user",
    content: inputMessage,
    timestamp: new Date(),
    context: context,
  };

  messages = [...messages, userMessage];
  lastMessageIndex = messages.length;

  try {
    if (!currentConversationId) {
      throw new Error("No active conversation");
    }

    // Include context about the editor content
    const fullContext = {
      ...context,
      selectedText: selectedText,
      editorContent: editorContent,
    };

    const result = await invoke("chatWithAgentDb", {
      conversationId: currentConversationId,
      message: inputMessage,
      apps: context.apps || [],
      files: context.files || [],
      useVision: false,
      enableToolCalling: true,
    });

    if (result.status === "ok") {
      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: result.data.content,
        timestamp: new Date(),
        metadata: {
          provider: currentProvider.name,
          model: currentModel,
          action: inputMessage.includes("Please")
            ? extractAction(inputMessage)
            : undefined,
        },
      };

      messages = [...messages, assistantMessage];

      // Auto-apply AI suggestions for simple actions
      await autoApplyAISuggestion(
        result.data.content,
        extractAction(inputMessage),
      );
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

    messages = [...messages, errorMessage];
  } finally {
    isLoading = false;
    isTyping = false;
    inputMessage = "";
  }
}

function extractAction(message: string): string | undefined {
  if (message.includes("improve")) return "improve";
  if (message.includes("summarize")) return "summarize";
  if (message.includes("expand")) return "expand";
  if (message.includes("continue")) return "continue";
  if (message.includes("translate")) return "translate";
  if (message.includes("simplify")) return "simplify";
  return undefined;
}

async function autoApplyAISuggestion(content: string, action?: string) {
  if (!action) return;

  // For simple text operations, automatically apply the result
  switch (action) {
    case "improve":
    case "continue":
      if (selectedText) {
        onReplaceContent(content);
      } else {
        onInsertContent(content);
      }
      break;
    case "summarize":
      // Add summary as a new section
      onInsertContent(`\n\n## Summary\n\n${content}\n\n`);
      break;
    case "simplify":
      if (selectedText) {
        onReplaceContent(content);
      }
      break;
    default:
      // Don't auto-apply for other actions
      break;
  }
}

function applyAIResponse(content: string) {
  if (selectedText) {
    onReplaceContent(content);
  } else {
    onInsertContent(content);
  }
}

function handleProviderChange(provider: AIProvider) {
  currentProvider = provider;
  currentModel = provider.models[0];
  initializeAI();
}

function handleModelChange(model: string) {
  currentModel = model;
  initializeAI();
}

function clearChat() {
  messages = [];
}

function getActionColor(color: string): string {
  const colorMap: Record<string, string> = {
    blue: "hover:bg-blue-50 text-blue-700 border-blue-200",
    green: "hover:bg-green-50 text-green-700 border-green-200",
    purple: "hover:bg-purple-50 text-purple-700 border-purple-200",
    orange: "hover:bg-orange-50 text-orange-700 border-orange-200",
    indigo: "hover:bg-indigo-50 text-indigo-700 border-indigo-200",
    yellow: "hover:bg-yellow-50 text-yellow-700 border-yellow-200",
  };
  return colorMap[color] || "hover:bg-gray-50 text-gray-700 border-gray-200";
}

function getActionGradient(gradient: string): string {
  return gradient || "from-gray-500 to-gray-600";
}

function formatMarkdown(content: string): string {
  return (
    content
      // Bold text
      .replace(
        /\*\*(.*?)\*\*/g,
        '<strong class="font-semibold text-gray-900">$1</strong>',
      )
      // Italic text
      .replace(/\*(.*?)\*/g, '<em class="italic text-gray-700">$1</em>')
      // Code blocks
      .replace(
        /```(\w+)?\n([\s\S]*?)```/g,
        '<pre class="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto font-mono text-sm my-4"><code>$2</code></pre>',
      )
      // Inline code
      .replace(
        /`([^`]+)`/g,
        '<code class="bg-gray-100 text-gray-800 px-1.5 py-0.5 rounded text-sm font-mono">$1</code>',
      )
      // Headers
      .replace(
        /^### (.*$)/gm,
        '<h3 class="text-lg font-semibold text-gray-900 mt-4 mb-2">$1</h3>',
      )
      .replace(
        /^## (.*$)/gm,
        '<h2 class="text-xl font-semibold text-gray-900 mt-4 mb-2">$1</h2>',
      )
      .replace(
        /^# (.*$)/gm,
        '<h1 class="text-2xl font-bold text-gray-900 mt-4 mb-2">$1</h1>',
      )
      // Lists
      .replace(/^- (.+)/gm, '<li class="ml-4 text-gray-700 list-disc">$1</li>')
      // Line breaks
      .replace(/\n\n/g, '</p><p class="mb-4">')
      .replace(/\n/g, "<br>")
  );
}

// Resize handlers
function startResize(e: MouseEvent) {
  isResizing = true;
  startX = e.clientX;
  startWidth = panelWidth;
  document.addEventListener("mousemove", handleResize);
  document.addEventListener("mouseup", stopResize);
  e.preventDefault();
}

function handleResize(e: MouseEvent) {
  if (!isResizing) return;
  const deltaX = e.clientX - startX;
  panelWidth = Math.max(280, Math.min(600, startWidth - deltaX));
}

function stopResize() {
  isResizing = false;
  document.removeEventListener("mousemove", handleResize);
  document.removeEventListener("mouseup", stopResize);
}

// Keyboard shortcuts
function handleKeydown(e: KeyboardEvent) {
  if (
    e.target instanceof HTMLInputElement ||
    e.target instanceof HTMLTextAreaElement
  ) {
    // Send message with Enter (but allow Shift+Enter for new line)
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  // Global shortcuts
  const isCmd = isMac ? e.metaKey : e.ctrlKey;
  const isAlt = e.altKey;

  if (isCmd && isAlt && e.key === "m") {
    e.preventDefault();
    onToggleMinimize();
  }
}

// Typing animation
function simulateTyping(text: string): string {
  if (!isTyping) return text;
  // This would implement a typing animation
  return text;
}
</script>

<svelte:window on:keydown={handleKeydown} />

<div
  class="native-ai-assistant"
  class:dark-mode={isDarkMode}
  class:minimized={isMinimized}
  style="width: {isMinimized ? '48px' : panelWidth + 'px'}"
>
  <!-- Resize handle -->
  {#if !isMinimized}
    <div
      class="resize-handle"
      onmousedown={startResize}
      class:resizing={isResizing}
    ></div>
  {/if}

  <!-- Header -->
  <div class="assistant-header backdrop-blur-xl">
    {#if !isMinimized}
      <div class="header-content">
        <div class="provider-info">
          <div class="provider-icon">{currentProvider.icon}</div>
          <div class="provider-details">
            <div class="assistant-title">AI Assistant</div>
            <div class="provider-name">
              {currentProvider.name} • {currentModel}
            </div>
          </div>
        </div>

        <div class="header-actions">
          {#if messages.length > 0}
            <button onclick={clearChat} class="header-btn" title="Clear chat">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path
                  d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14zM10 11v6M14 11v6"
                />
              </svg>
            </button>
          {/if}

          <button
            onclick={() => showProviderSettings = !showProviderSettings}
            class="header-btn"
            title="Settings"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <circle cx="12" cy="12" r="3" />
              <path
                d="M12 1v6m0 6v6m4.22-13.22l4.24 4.24M1.54 1.54l4.24 4.24M20.46 20.46l-4.24-4.24M1.54 20.46l4.24-4.24"
              />
            </svg>
          </button>
        </div>
      </div>

      <!-- Provider Settings -->
      {#if showProviderSettings}
        <div class="provider-settings">
          <div class="settings-row">
            <label class="settings-label">Provider:</label>
            <select
              bind:value={currentProvider}
              onchange={() => handleProviderChange(currentProvider)}
              class="settings-select"
            >
              {#each providers as provider}
                <option value={provider}>{provider.icon} {provider.name}</option
                >
              {/each}
            </select>
          </div>
          <div class="settings-row">
            <label class="settings-label">Model:</label>
            <select
              bind:value={currentModel}
              onchange={() => handleModelChange(currentModel)}
              class="settings-select"
            >
              {#each currentProvider.models as model}
                <option value={model}>{model}</option>
              {/each}
            </select>
          </div>
        </div>
      {/if}
    {:else}
      <div class="minimized-header">
        <button
          onclick={onToggleMinimize}
          class="minimize-btn"
          title="Expand AI Assistant"
        >
          {currentProvider.icon}
        </button>
      </div>
    {/if}

    <!-- Minimize button -->
    {#if !isMinimized}
      <button
        onclick={onToggleMinimize}
        class="minimize-btn"
        title="Minimize chat (⌘⌥M)"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <path d="M15 19l-7-7 7-7" />
        </svg>
      </button>
    {/if}
  </div>

  {#if !isMinimized}
    <!-- Quick Actions -->
    {#if showQuickActions && selectedText.trim()}
      <div class="quick-actions">
        <div class="quick-actions-title">Quick Actions for Selection</div>
        <div class="quick-actions-grid">
          {#each quickActions as action}
            <button
              onclick={() => executeQuickAction(action.command)}
              class={`quick-action-btn ${getActionColor(action.color)}`}
            >
              <div
                class="action-gradient bg-gradient-to-r {getActionGradient(action.gradient)}"
              ></div>
              <div class="action-content">
                <div class="action-icon">{action.icon}</div>
                <div class="action-text">
                  <div class="action-title">{action.title}</div>
                  <div class="action-description">{action.description}</div>
                </div>
              </div>
            </button>
          {/each}
        </div>
      </div>
    {/if}

    <!-- Messages -->
    <div class="messages-container">
      {#each messages as message (message.id)}
        <div
          class="message-wrapper"
          class:user-message={message.role === 'user'}
          class:assistant-message={message.role === 'assistant'}
        >
          <div class="message-avatar">
            {#if message.role === 'user'}
              <div class="user-avatar">👤</div>
            {:else}
              <div class="assistant-avatar">
                {message.metadata?.provider === 'OpenAI' ? '🤖' :
								 message.metadata?.provider === 'Anthropic' ? '🧠' :
								 message.metadata?.provider === 'Google' ? '🔍' :
								 message.metadata?.provider === 'Groq' ? '⚡' : '🤖'}
              </div>
            {/if}
          </div>
          <div class="message-content">
            <div class="message-bubble">
              <div class="message-text">
                {@html formatMarkdown(message.content)}
              </div>
            </div>
            {#if message.role === 'assistant' && message.metadata?.action}
              <div class="message-actions">
                <button
                  onclick={() => applyAIResponse(message.content)}
                  class="action-btn primary"
                >
                  Apply
                </button>
                <button
                  onclick={() => onInsertContent(message.content)}
                  class="action-btn secondary"
                >
                  Insert
                </button>
              </div>
            {/if}
            <div class="message-meta">
              {message.timestamp.toLocaleTimeString()}
              {#if message.metadata?.provider}
                <span class="meta-provider">• {message.metadata.provider}</span>
              {/if}
            </div>
          </div>
        </div>
      {/each}

      {#if isLoading}
        <div class="message-wrapper assistant-message">
          <div class="message-avatar">
            <div class="assistant-avatar typing">
              <span class="typing-dots">
                <span></span>
                <span></span>
                <span></span>
              </span>
            </div>
          </div>
          <div class="message-content">
            <div class="message-bubble">
              <div class="typing-indicator">
                <span class="typing-dot"></span>
                <span class="typing-dot"></span>
                <span class="typing-dot"></span>
              </div>
            </div>
          </div>
        </div>
      {/if}

      {#if messages.length === 0}
        <div class="empty-state">
          <div class="empty-icon">{currentProvider.icon}</div>
          <div class="empty-title">AI Writing Assistant</div>
          <div class="empty-description">
            Select text for quick actions or start a conversation
          </div>

          <div class="example-prompts">
            <div class="prompts-title">Try asking:</div>
            {#each [
							'Help me improve my writing style',
							'Can you suggest better ways to phrase this?',
							'Generate some creative ideas for this topic',
							'Summarize this text for me'
						] as prompt}
              <button
                onclick={() => { inputMessage = prompt; }}
                class="prompt-btn"
              >
                "{prompt}"
              </button>
            {/each}
          </div>
        </div>
      {/if}
    </div>

    <!-- Input -->
    <div class="input-container">
      <div class="input-wrapper">
        <textarea
          bind:value={inputMessage}
          placeholder="Ask AI for help with your writing..."
          disabled={isLoading}
          class="message-input"
          rows="2"
        ></textarea>
        <button
          onclick={sendMessage}
          disabled={!inputMessage.trim() || isLoading}
          class="send-btn"
          class:loading={isLoading}
        >
          {#if isLoading}
            <div class="loading-spinner"></div>
          {:else}
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
            </svg>
          {/if}
        </button>
      </div>
      <div class="input-footer">
        <span class="input-hint">Press Shift + Enter for new line</span>
        <span class="message-count">{messages.length} messages</span>
      </div>
    </div>
  {/if}
</div>

<style>
@reference "tailwindcss";
/* Native macOS styling */
.native-ai-assistant {
  @apply relative flex h-full flex-col border-l border-gray-200 bg-white;
  font-family:
    -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.native-ai-assistant.dark-mode {
  @apply border-gray-700 bg-gray-900;
}

.native-ai-assistant.minimized {
  @apply border-l-0;
}

/* Resize handle */
.resize-handle {
  @apply absolute top-0 bottom-0 left-0 z-10 w-1 cursor-col-resize hover:w-1.5 hover:bg-blue-500;
  transition: all 0.2s ease;
}

.resize-handle.resizing {
  @apply w-1.5 bg-blue-500;
}

/* Header */
.assistant-header {
  @apply relative border-b border-gray-200 bg-white/80;
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
}

.dark-mode .assistant-header {
  @apply border-gray-700 bg-gray-800/80;
}

.header-content {
  @apply flex items-center justify-between p-4;
}

.provider-info {
  @apply flex items-center gap-3;
}

.provider-icon {
  @apply text-2xl;
}

.provider-details {
  @apply flex flex-col;
}

.assistant-title {
  @apply text-sm font-semibold text-gray-900;
}

.dark-mode .assistant-title {
  @apply text-gray-100;
}

.provider-name {
  @apply text-xs text-gray-500;
}

.dark-mode .provider-name {
  @apply text-gray-400;
}

.header-actions {
  @apply flex items-center gap-1;
}

.header-btn {
  @apply flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100;
}

.dark-mode .header-btn {
  @apply text-gray-400 hover:bg-gray-700;
}

/* Provider Settings */
.provider-settings {
  @apply border-b border-gray-200 px-4 pb-4;
}

.dark-mode .provider-settings {
  @apply border-gray-700;
}

.settings-row {
  @apply mb-2 flex items-center gap-2;
}

.settings-label {
  @apply w-16 text-xs font-medium text-gray-700;
}

.dark-mode .settings-label {
  @apply text-gray-300;
}

.settings-select {
  @apply flex-1 rounded-md border border-gray-300 bg-white px-2 py-1 text-xs text-gray-900;
}

.dark-mode .settings-select {
  @apply border-gray-600 bg-gray-800 text-gray-100;
}

/* Minimized state */
.minimized-header {
  @apply flex items-center justify-center p-3;
}

.minimize-btn {
  @apply flex h-10 w-10 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100;
}

.dark-mode .minimize-btn {
  @apply text-gray-400 hover:bg-gray-700;
}

/* Quick Actions */
.quick-actions {
  @apply border-b border-gray-200 p-4;
}

.dark-mode .quick-actions {
  @apply border-gray-700;
}

.quick-actions-title {
  @apply mb-3 text-sm font-medium text-gray-900;
}

.dark-mode .quick-actions-title {
  @apply text-gray-100;
}

.quick-actions-grid {
  @apply grid grid-cols-2 gap-2;
}

.quick-action-btn {
  @apply relative overflow-hidden rounded-lg border border-gray-200 p-3 text-left transition-all duration-200 hover:scale-105 hover:shadow-md;
}

.dark-mode .quick-action-btn {
  @apply border-gray-600;
}

.action-gradient {
  @apply absolute inset-0 opacity-10;
}

.action-content {
  @apply relative flex items-center gap-2;
}

.action-icon {
  @apply text-lg;
}

.action-text {
  @apply min-w-0 flex-1;
}

.action-title {
  @apply truncate text-sm font-medium text-gray-900;
}

.dark-mode .action-title {
  @apply text-gray-100;
}

.action-description {
  @apply truncate text-xs text-gray-500;
}

.dark-mode .action-description {
  @apply text-gray-400;
}

/* Messages */
.messages-container {
  @apply flex-1 space-y-4 overflow-y-auto p-4;
}

.message-wrapper {
  @apply flex gap-3;
}

.message-wrapper.user-message {
  @apply flex-row-reverse;
}

.message-avatar {
  @apply h-8 w-8 flex-shrink-0;
}

.user-avatar {
  @apply flex h-8 w-8 items-center justify-center rounded-full bg-blue-500 text-sm text-white;
}

.assistant-avatar {
  @apply flex h-8 w-8 items-center justify-center rounded-full bg-gray-200 text-sm text-gray-700;
}

.dark-mode .assistant-avatar {
  @apply bg-gray-700 text-gray-300;
}

.assistant-avatar.typing .typing-dots {
  @apply flex gap-0.5;
}

.assistant-avatar.typing .typing-dots span {
  @apply h-1.5 w-1.5 rounded-full bg-gray-500;
}

.message-content {
  @apply min-w-0 flex-1;
}

.message-bubble {
  @apply rounded-2xl p-3 text-sm leading-relaxed;
}

.user-message .message-bubble {
  @apply rounded-tr-md bg-blue-500 text-white;
}

.assistant-message .message-bubble {
  @apply rounded-tl-md border border-gray-200 bg-[#f8f9fa] text-gray-900;
}

.dark-mode .assistant-message .message-bubble {
  @apply border-gray-600 bg-gray-800 text-gray-100;
}

.message-text {
  @apply break-words;
}

.message-actions {
  @apply mt-2 flex gap-2;
}

.action-btn {
  @apply rounded-full px-3 py-1 text-xs font-medium transition-all duration-200 hover:scale-105;
}

.action-btn.primary {
  @apply bg-blue-500 text-white hover:bg-blue-600;
}

.action-btn.secondary {
  @apply bg-green-500 text-white hover:bg-green-600;
}

.message-meta {
  @apply mt-1 flex items-center gap-2 text-xs text-gray-500;
}

.dark-mode .message-meta {
  @apply text-gray-400;
}

.meta-provider {
  @apply font-medium;
}

/* Typing indicator */
.typing-indicator {
  @apply flex gap-1;
}

.typing-dot {
  @apply h-2 w-2 animate-pulse rounded-full bg-gray-400;
}

.typing-dot:nth-child(2) {
  animation-delay: 0.16s;
}

.typing-dot:nth-child(3) {
  animation-delay: 0.32s;
}

/* Empty state */
.empty-state {
  @apply flex h-full flex-col items-center justify-center text-center text-gray-500;
}

.empty-icon {
  @apply mb-4 text-4xl opacity-50;
}

.empty-title {
  @apply mb-1 text-sm font-medium text-gray-700;
}

.dark-mode .empty-title {
  @apply text-gray-300;
}

.empty-description {
  @apply mb-6 text-xs;
}

.example-prompts {
  @apply w-full max-w-xs space-y-2 text-left;
}

.prompts-title {
  @apply mb-2 text-xs text-gray-400;
}

.prompt-btn {
  @apply w-full rounded-lg border border-gray-200 p-2 text-left text-xs transition-colors hover:bg-[#f8f9fa];
}

.dark-mode .prompt-btn {
  @apply border-gray-600 text-gray-300 hover:bg-gray-700;
}

/* Input */
.input-container {
  @apply border-t border-gray-200 bg-[#f8f9fa]/50 p-4;
}

.dark-mode .input-container {
  @apply border-gray-700 bg-gray-800/50;
}

.input-wrapper {
  @apply relative;
}

.message-input {
  @apply w-full resize-none rounded-lg border border-gray-300 bg-white px-3 py-2 pr-10 text-sm text-gray-900 placeholder-gray-500 focus:border-transparent focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:opacity-50;
}

.dark-mode .message-input {
  @apply border-gray-600 bg-gray-700 text-gray-100 placeholder-gray-400;
}

.send-btn {
  @apply absolute right-2 bottom-2 flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500 text-white transition-all duration-200 hover:scale-105 hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-50;
}

.send-btn.loading {
  @apply bg-blue-400;
}

.loading-spinner {
  @apply h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent;
}

.input-footer {
  @apply mt-2 flex items-center justify-between text-xs text-gray-500;
}

.dark-mode .input-footer {
  @apply text-gray-400;
}

/* Custom scrollbar */
.messages-container::-webkit-scrollbar {
  width: 6px;
}

.messages-container::-webkit-scrollbar-track {
  background: transparent;
}

.messages-container::-webkit-scrollbar-thumb {
  background-color: rgba(156, 163, 175, 0.3);
  border-radius: 3px;
}

.messages-container::-webkit-scrollbar-thumb:hover {
  background-color: rgba(156, 163, 175, 0.5);
}

/* Enhanced Native macOS Animations */
.quick-action-btn {
  transition: all 0.2s cubic-bezier(0.2, 0, 0, 1);
  position: relative;
  overflow: hidden;
}

.quick-action-btn::before {
  content: "";
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(
    90deg,
    transparent,
    rgba(255, 255, 255, 0.2),
    transparent
  );
  transition: left 0.4s ease;
}

.quick-action-btn:hover::before {
  left: 100%;
}

.quick-action-btn:active {
  transform: scale(0.98);
  transition: transform 0.1s cubic-bezier(0.2, 0, 0, 1);
}

.message-bubble {
  transition: all 0.15s cubic-bezier(0.2, 0, 0, 1);
  position: relative;
}

.user-message .message-bubble:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
}

.assistant-message .message-bubble:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.action-btn {
  transition: all 0.15s cubic-bezier(0.2, 0, 0, 1);
  position: relative;
  overflow: hidden;
}

.action-btn::after {
  content: "";
  position: absolute;
  top: 50%;
  left: 50%;
  width: 0;
  height: 0;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.3);
  transform: translate(-50%, -50%);
  transition:
    width 0.3s ease,
    height 0.3s ease;
}

.action-btn:active::after {
  width: 100px;
  height: 100px;
}

.header-btn {
  transition: all 0.15s cubic-bezier(0.2, 0, 0, 1);
  position: relative;
  overflow: hidden;
}

.header-btn:hover {
  transform: scale(1.05);
}

.header-btn:active {
  transform: scale(0.95);
}

.send-btn {
  transition: all 0.2s cubic-bezier(0.2, 0, 0, 1);
}

.send-btn:not(:disabled):hover {
  transform: scale(1.1) rotate(5deg);
}

.send-btn:not(:disabled):active {
  transform: scale(0.95) rotate(-2deg);
}

.message-input {
  transition: all 0.2s ease;
}

.message-input:focus {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.15);
}

/* Enhanced typing animation */
.typing-indicator {
  @apply flex gap-1;
}

.typing-dot {
  @apply h-2 w-2 rounded-full bg-gray-400;
  animation: typingPulse 1.4s ease-in-out infinite;
}

.typing-dot:nth-child(1) {
  animation-delay: 0s;
}

.typing-dot:nth-child(2) {
  animation-delay: 0.2s;
}

.typing-dot:nth-child(3) {
  animation-delay: 0.4s;
}

@keyframes typingPulse {
  0%,
  60%,
  100% {
    transform: scale(1);
    opacity: 0.4;
  }
  30% {
    transform: scale(1.3);
    opacity: 1;
  }
}

/* Message appearance animations */
@keyframes slideInRight {
  from {
    opacity: 0;
    transform: translateX(20px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

@keyframes slideInLeft {
  from {
    opacity: 0;
    transform: translateX(-20px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

@keyframes bounceIn {
  0% {
    opacity: 0;
    transform: scale(0.3);
  }
  50% {
    opacity: 1;
    transform: scale(1.05);
  }
  70% {
    transform: scale(0.9);
  }
  100% {
    opacity: 1;
    transform: scale(1);
  }
}

.message-wrapper.user-message {
  animation: slideInRight 0.4s cubic-bezier(0.2, 0, 0, 1);
}

.message-wrapper.assistant-message {
  animation: slideInLeft 0.4s cubic-bezier(0.2, 0, 0, 1);
}

.empty-state {
  animation: fadeIn 0.6s ease;
}

.quick-actions {
  animation: slideInLeft 0.5s cubic-bezier(0.2, 0, 0, 1);
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes slideInLeft {
  from {
    opacity: 0;
    transform: translateX(-20px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}
</style>
