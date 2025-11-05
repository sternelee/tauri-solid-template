<script lang="ts">
  import { onMount, createEventDispatcher } from "svelte";
  import { invoke } from "@tauri-apps/api/core";
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
  }

  let {
    editorContent,
    onInsertContent,
    onReplaceContent,
    selectedText = "",
    context = {},
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

  // Quick actions
  let showQuickActions = $state(true);
  let isMinimized = $state(false);

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
    },
    {
      title: "Summarize",
      description: "Create a concise summary",
      icon: "📝",
      command: "summarize",
      color: "green",
    },
    {
      title: "Expand",
      description: "Add more detail and examples",
      icon: "📈",
      command: "expand",
      color: "purple",
    },
    {
      title: "Continue Writing",
      description: "Continue where you left off",
      icon: "✍️",
      command: "continue",
      color: "orange",
    },
    {
      title: "Translate",
      description: "Translate to another language",
      icon: "🌐",
      command: "translate",
      color: "indigo",
    },
    {
      title: "Simplify",
      description: "Make it easier to understand",
      icon: "🔍",
      command: "simplify",
      color: "yellow",
    },
  ];

  onMount(async () => {
    await initializeAI();
  });

  async function initializeAI() {
    try {
      const initResult = await invoke("initializeAgentWithDb", {
        agentConfig: {
          provider: currentProvider.id,
          model: currentModel,
          preamble: `You are an AI writing assistant integrated into a rich text editor. You help users improve their writing, generate content, and provide suggestions. Always respond in markdown format for better readability. Be concise, helpful, and constructive.`,
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

    inputMessage =
      actionPrompts[action as keyof typeof actionPrompts] || action;
    await sendMessage();
  }

  async function sendMessage() {
    if (!inputMessage.trim() || isLoading) return;

    isLoading = true;
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: inputMessage,
      timestamp: new Date(),
      context: context,
    };

    messages = [...messages, userMessage];

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

  function toggleMinimize() {
    isMinimized = !isMinimized;
  }

  function getActionColor(color: string): string {
    const colorMap: Record<string, string> = {
      blue: "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100",
      green: "bg-green-50 text-green-700 border-green-200 hover:bg-green-100",
      purple:
        "bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100",
      orange:
        "bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100",
      indigo:
        "bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100",
      yellow:
        "bg-yellow-50 text-yellow-700 border-yellow-200 hover:bg-yellow-100",
    };
    return (
      colorMap[color] ||
      "bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100"
    );
  }

  function formatMarkdown(content: string): string {
    return (
      content
        // Bold text
        .replace(/\*\*(.*?)\*\*/g, '<strong class="text-gray-900">$1</strong>')
        // Italic text
        .replace(/\*(.*?)\*/g, '<em class="text-gray-700">$1</em>')
        // Code blocks
        .replace(
          /```(\w+)?\n([\s\S]*?)```/g,
          '<pre class="bg-gray-900 text-gray-100 p-3 rounded-lg overflow-x-auto"><code>$2</code></pre>',
        )
        // Inline code
        .replace(
          /`([^`]+)`/g,
          '<code class="bg-gray-100 text-gray-800 px-1 py-0.5 rounded text-sm">$1</code>',
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
        .replace(/^- (.+)/gm, '<li class="ml-4 text-gray-700">$1</li>')
        // Line breaks
        .replace(/\n/g, "<br>")
    );
  }
</script>

<div
  class="ai-assistant flex flex-col border-l border-gray-200 bg-white"
  class:w-80={!isMinimized}
  class:w-12={isMinimized}
>
  <!-- Header -->
  <div class="flex items-center justify-between border-b border-gray-200 p-4">
    {#if !isMinimized}
      <div class="flex items-center gap-2">
        <span class="text-xl">{currentProvider.icon}</span>
        <div>
          <div class="text-sm font-medium text-gray-900">AI Assistant</div>
          <div class="text-xs text-gray-500">
            {currentProvider.name} • {currentModel}
          </div>
        </div>
      </div>
    {:else}
      <span class="text-xl">{currentProvider.icon}</span>
    {/if}

    <div class="flex items-center gap-1">
      {#if !isMinimized && messages.length > 0}
        <button
          onclick={clearChat}
          class="flex h-6 w-6 items-center justify-center rounded transition-colors hover:bg-gray-100"
          title="Clear chat"
        >
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

      {#if !isMinimized}
        <!-- Provider Selector -->
        <div class="flex items-center gap-2">
          <select
            bind:value={currentProvider}
            onchange={() => handleProviderChange(currentProvider)}
            class="rounded border border-gray-300 px-2 py-1 text-xs"
          >
            {#each providers as provider}
              <option value={provider}>{provider.icon} {provider.name}</option>
            {/each}
          </select>
          <select
            bind:value={currentModel}
            onchange={() => handleModelChange(currentModel)}
            class="rounded border border-gray-300 px-2 py-1 text-xs"
          >
            {#each currentProvider.models as model}
              <option value={model}>{model}</option>
            {/each}
          </select>
        </div>
      {/if}

      <button
        onclick={toggleMinimize}
        class="flex h-6 w-6 items-center justify-center rounded transition-colors hover:bg-gray-100"
        title={isMinimized ? "Expand chat" : "Minimize chat"}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          class:rotate-180={isMinimized}
          style="transition: transform 0.2s"
        >
          <path d="M15 19l-7-7 7-7" />
        </svg>
      </button>
    </div>
  </div>

  {#if !isMinimized}
    <!-- Quick Actions -->
    {#if showQuickActions && selectedText.trim()}
      <div class="border-b border-gray-200 p-4">
        <div class="mb-3 text-sm font-medium text-gray-700">
          Quick Actions for Selection
        </div>
        <div class="grid grid-cols-2 gap-2">
          {#each quickActions as action}
            <button
              onclick={() => executeQuickAction(action.command)}
              class={`rounded-lg border p-3 text-left transition-colors ${getActionColor(action.color)}`}
            >
              <div class="mb-1 flex items-center gap-2">
                <span class="text-lg">{action.icon}</span>
                <span class="text-sm font-medium">{action.title}</span>
              </div>
              <div class="text-xs opacity-75">{action.description}</div>
            </button>
          {/each}
        </div>
      </div>
    {/if}

    <!-- Messages -->
    <div class="flex-1 space-y-4 overflow-y-auto p-4">
      {#each messages as message (message.id)}
        <div
          class="flex gap-3 {message.role === 'user' ? 'flex-row-reverse' : ''}"
        >
          <div
            class="flex h-8 w-8 items-center justify-center rounded-full text-sm {message.role ===
            'user'
              ? 'bg-blue-500 text-white'
              : 'bg-gray-200 text-gray-700'}"
          >
            {message.role === "user" ? "👤" : "🤖"}
          </div>
          <div class="min-w-0 flex-1">
            <div
              class="rounded-2xl p-3 text-sm leading-relaxed {message.role ===
              'user'
                ? 'border border-blue-200 bg-blue-50 text-blue-900'
                : 'border border-gray-200 bg-gray-50 text-gray-900'}"
            >
              {@html formatMarkdown(message.content)}
            </div>
            {#if message.metadata?.action}
              <div class="mt-2 flex gap-2">
                <button
                  onclick={() => applyAIResponse(message.content)}
                  class="rounded bg-blue-500 px-2 py-1 text-xs text-white transition-colors hover:bg-blue-600"
                >
                  Apply
                </button>
                <button
                  onclick={() => onInsertContent(message.content)}
                  class="rounded bg-green-500 px-2 py-1 text-xs text-white transition-colors hover:bg-green-600"
                >
                  Insert
                </button>
              </div>
            {/if}
            <div class="mt-1 text-xs text-gray-500">
              {message.timestamp.toLocaleTimeString()}
              {#if message.metadata?.provider}
                <span class="ml-2">• {message.metadata.provider}</span>
              {/if}
            </div>
          </div>
        </div>
      {/each}

      {#if isLoading}
        <div class="flex gap-3">
          <div
            class="flex h-8 w-8 items-center justify-center rounded-full bg-gray-200"
          >
            <span class="text-sm">🤖</span>
          </div>
          <div class="flex-1">
            <div class="rounded-2xl rounded-tl-none bg-gray-50 p-3">
              <div class="flex gap-1">
                <span
                  class="h-2 w-2 animate-pulse rounded-full bg-gray-400"
                  style="animation-delay: -0.32s"
                ></span>
                <span
                  class="h-2 w-2 animate-pulse rounded-full bg-gray-400"
                  style="animation-delay: -0.16s"
                ></span>
                <span class="h-2 w-2 animate-pulse rounded-full bg-gray-400"
                ></span>
              </div>
            </div>
          </div>
        </div>
      {/if}

      {#if messages.length === 0}
        <div
          class="flex h-full flex-col items-center justify-center text-center text-gray-400"
        >
          <span class="mb-4 text-4xl">{currentProvider.icon}</span>
          <div class="mb-1 text-sm font-medium">AI Writing Assistant</div>
          <div class="mb-4 text-xs">
            Select text for quick actions or start a conversation
          </div>

          <!-- Example prompts -->
          <div class="space-y-2 text-left">
            <div class="mb-2 text-xs text-gray-500">Try asking:</div>
            <button
              onclick={() => {
                inputMessage = "Help me improve my writing style";
              }}
              class="rounded border border-gray-200 p-2 text-left text-xs transition-colors hover:bg-gray-50"
            >
              "Help me improve my writing style"
            </button>
            <button
              onclick={() => {
                inputMessage = "Can you suggest better ways to phrase this?";
              }}
              class="rounded border border-gray-200 p-2 text-left text-xs transition-colors hover:bg-gray-50"
            >
              "Can you suggest better ways to phrase this?"
            </button>
            <button
              onclick={() => {
                inputMessage = "Generate some creative ideas for this topic";
              }}
              class="rounded border border-gray-200 p-2 text-left text-xs transition-colors hover:bg-gray-50"
            >
              "Generate some creative ideas for this topic"
            </button>
          </div>
        </div>
      {/if}
    </div>

    <!-- Input -->
    <div class="border-t border-gray-200 p-4">
      <div class="relative">
        <textarea
          bind:value={inputMessage}
          placeholder="Ask AI for help with your writing..."
          disabled={isLoading}
          class="w-full resize-none rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 pr-10 text-sm text-gray-900 placeholder-gray-500 focus:border-transparent focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:opacity-50"
          rows="2"
          style="max-height: 120px; min-height: 40px;"
        ></textarea>

        <button
          onclick={sendMessage}
          disabled={!inputMessage.trim() || isLoading}
          class="absolute right-2 bottom-2 flex h-6 w-6 items-center justify-center rounded bg-blue-500 text-white transition-colors hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
          </svg>
        </button>
      </div>

      <div class="mt-2 flex items-center justify-between text-xs text-gray-500">
        <span>Press Shift + Enter for new line</span>
        <span>{messages.length} messages</span>
      </div>
    </div>
  {/if}
</div>

<style>
  .animate-pulse {
    animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
  }

  @keyframes pulse {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.5;
    }
  }

  /* Custom scrollbar */
  .overflow-y-auto::-webkit-scrollbar {
    width: 6px;
  }

  .overflow-y-auto::-webkit-scrollbar-track {
    background: transparent;
  }

  .overflow-y-auto::-webkit-scrollbar-thumb {
    background-color: rgba(156, 163, 175, 0.5);
    border-radius: 3px;
  }

  .overflow-y-auto::-webkit-scrollbar-thumb:hover {
    background-color: rgba(156, 163, 175, 0.7);
  }
</style>
