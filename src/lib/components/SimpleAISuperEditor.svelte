<script lang="ts">
import { onMount } from "svelte";
import { invoke } from "@tauri-apps/api/core";

// AI Providers
const providers = [
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

let editorContent = $state("");
let messages = $state([]);
let isLoading = $state(false);
let selectedProvider = $state(providers[0]);
let selectedModel = $state(providers[0].models[0]);
let currentConversationId = $state("");
let inputMessage = $state("");

let editorElement: HTMLDivElement;

onMount(async () => {
  await initializeAI();
});

async function initializeAI() {
  try {
    const initResult = await invoke("initializeAgentWithDb", {
      agentConfig: {
        provider: selectedProvider.id,
        model: selectedModel,
        preamble:
          "You are an AI assistant integrated into a rich text editor. Help with writing, editing, summarizing, and providing creative suggestions.",
        temperature: 0.7,
        max_tokens: 2000,
      },
    });

    if (initResult.status === "ok") {
      const convResult = await invoke("createConversationWithDb", {
        title: null,
        model: selectedModel,
        provider: selectedProvider.id,
      });

      if (convResult.status === "ok") {
        currentConversationId = convResult.data;
      }
    }
  } catch (error) {
    console.error("Failed to initialize AI:", error);
  }
}

function handleEditorInput(e: Event) {
  const target = e.target as HTMLDivElement;
  editorContent = target.innerText;
}

function formatText(command: string, value?: string) {
  document.execCommand(command, false, value);
  editorElement?.focus();
}

async function sendMessage() {
  if (!inputMessage.trim() || isLoading) return;

  isLoading = true;
  const userMessage = {
    id: Date.now().toString(),
    role: "user",
    content: inputMessage,
    timestamp: new Date(),
  };

  messages = [...messages, userMessage];

  try {
    const result = await invoke("chatWithAgentDb", {
      conversationId: currentConversationId,
      message: inputMessage,
      apps: [],
      files: [],
      useVision: false,
      enableToolCalling: true,
    });

    if (result.status === "ok") {
      const assistantMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: result.data.content,
        timestamp: new Date(),
        metadata: {
          provider: selectedProvider.name,
          model: selectedModel,
        },
      };

      messages = [...messages, assistantMessage];
    }
  } catch (error) {
    console.error("Failed to send message:", error);
  } finally {
    isLoading = false;
    inputMessage = "";
  }
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
}
</script>

<div class="flex h-full bg-gray-900">
  <!-- Main Editor Area -->
  <div class="flex flex-1 flex-col">
    <!-- Toolbar -->
    <div class="border-b border-gray-700 bg-gray-800 px-4 py-2">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div
            class="h-6 w-6 rounded bg-gradient-to-br from-blue-500 to-purple-600"
          ></div>
          <h1 class="text-lg font-semibold text-white">AI Super Editor</h1>
        </div>

        <!-- Provider Selection -->
        <div class="flex items-center gap-3">
          <select
            bind:value={selectedProvider}
            onchange={() => selectedModel = selectedProvider.models[0]}
            class="rounded border border-gray-600 bg-gray-700 px-3 py-1 text-sm text-white"
          >
            {#each providers as provider}
              <option value={provider}>{provider.icon} {provider.name}</option>
            {/each}
          </select>

          <select
            bind:value={selectedModel}
            class="rounded border border-gray-600 bg-gray-700 px-3 py-1 text-sm text-white"
          >
            {#each selectedProvider.models as model}
              <option value={model}>{model}</option>
            {/each}
          </select>
        </div>
      </div>
    </div>

    <!-- Editor Toolbar -->
    <div class="border-b border-gray-700 bg-gray-800/50 px-4 py-2">
      <div class="flex items-center gap-2">
        <button
          onclick={() => formatText('bold')}
          class="rounded bg-gray-700 px-3 py-1 text-sm text-white hover:bg-gray-600"
        >
          <strong>B</strong>
        </button>

        <button
          onclick={() => formatText('italic')}
          class="rounded bg-gray-700 px-3 py-1 text-sm text-white hover:bg-gray-600"
        >
          <em>I</em>
        </button>

        <button
          onclick={() => formatText('underline')}
          class="rounded bg-gray-700 px-3 py-1 text-sm text-white hover:bg-gray-600"
        >
          <u>U</u>
        </button>

        <div class="h-6 w-px bg-gray-600"></div>

        <button
          onclick={() => formatText('insertUnorderedList')}
          class="rounded bg-gray-700 px-3 py-1 text-sm text-white hover:bg-gray-600"
        >
          •
        </button>

        <button
          onclick={() => formatText('insertOrderedList')}
          class="rounded bg-gray-700 px-3 py-1 text-sm text-white hover:bg-gray-600"
        >
          1.
        </button>
      </div>
    </div>

    <!-- Editor -->
    <div
      bind:this={editorElement}
      contenteditable="true"
      oninput={handleEditorInput}
      class="flex-1 overflow-y-auto p-6 text-white/80 outline-none"
      style="line-height: 1.6;"
      placeholder="Start typing your content here... Use @ to mention apps, # to mention files"
    ></div>

    <!-- Quick Actions -->
    <div class="border-t border-gray-700 bg-gray-800 px-4 py-2">
      <div class="text-xs text-gray-400">
        Type <kbd class="rounded bg-gray-700 px-1 py-0.5">@</kbd> for apps •
        Type <kbd class="rounded bg-gray-700 px-1 py-0.5">#</kbd> for files • Ask
        AI for assistance anytime
      </div>
    </div>
  </div>

  <!-- Chat Sidebar -->
  <div class="flex w-80 flex-col border-l border-gray-700 bg-gray-800/50">
    <!-- Header -->
    <div class="border-b border-gray-700 p-4">
      <div class="flex items-center gap-2">
        <span class="text-lg">{selectedProvider.icon}</span>
        <div>
          <div class="text-sm font-medium text-white">AI Assistant</div>
          <div class="text-xs text-gray-400">
            {selectedProvider.name} • {selectedModel}
          </div>
        </div>
      </div>
    </div>

    <!-- Messages -->
    <div class="flex-1 space-y-4 overflow-y-auto p-4">
      {#each messages as message}
        <div
          class="flex gap-3 {message.role === 'user' ? 'flex-row-reverse' : ''}"
        >
          <div
            class="flex h-8 w-8 items-center justify-center rounded-full text-sm {message.role === 'user' ? 'bg-blue-500' : 'bg-gray-700'}"
          >
            {message.role === 'user' ? '👤' : '🤖'}
          </div>
          <div class="flex-1">
            <div
              class="rounded-2xl p-3 text-sm {message.role === 'user' ? 'border border-blue-500/30 bg-blue-500/20' : 'bg-gray-700/50'} text-white"
            >
              {@html message.content.replace(/\n/g, '<br>')}
            </div>
            <div class="mt-1 text-xs text-gray-400">
              {message.timestamp.toLocaleTimeString()}
            </div>
          </div>
        </div>
      {/each}

      {#if isLoading}
        <div class="flex gap-3">
          <div
            class="flex h-8 w-8 items-center justify-center rounded-full bg-gray-700"
          >
            🤖
          </div>
          <div class="flex-1">
            <div class="rounded-2xl bg-gray-700/50 p-3">
              <div class="flex gap-1">
                <span class="h-2 w-2 animate-pulse rounded-full bg-white/60"
                ></span>
                <span
                  class="h-2 w-2 animate-pulse rounded-full bg-white/60"
                  style="animation-delay: 0.2s"
                ></span>
                <span
                  class="h-2 w-2 animate-pulse rounded-full bg-white/60"
                  style="animation-delay: 0.4s"
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
          <span class="mb-4 text-4xl">{selectedProvider.icon}</span>
          <div class="mb-1 text-sm font-medium">Start a conversation</div>
          <div class="text-xs">
            Ask questions, get help with your content, or start a creative
            discussion
          </div>
        </div>
      {/if}
    </div>

    <!-- Input -->
    <div class="border-t border-gray-700 p-4">
      <div class="relative">
        <textarea
          bind:value={inputMessage}
          onkeydown={handleKeydown}
          placeholder="Ask AI anything..."
          disabled={isLoading}
          class="w-full resize-none rounded-lg border border-gray-600 bg-gray-700/50 px-3 py-2 pr-10 text-sm text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500/50 focus:outline-none disabled:opacity-50"
          rows="2"
          style="max-height: 120px; min-height: 40px;"
        ></textarea>

        <button
          onclick={sendMessage}
          disabled={!inputMessage.trim() || isLoading}
          class="absolute right-2 bottom-2 flex h-6 w-6 items-center justify-center rounded bg-blue-500 text-white hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
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

      <div class="mt-2 text-xs text-gray-400">
        Press <kbd class="rounded bg-gray-700 px-1 py-0.5">Shift</kbd> +
        <kbd class="rounded bg-gray-700 px-1 py-0.5">Enter</kbd> for new line
      </div>
    </div>
  </div>
</div>

<style>
/* Editor placeholder */
[contenteditable]:empty:before {
  content: attr(placeholder);
  color: rgba(255, 255, 255, 0.4);
}

/* Custom scrollbar */
::-webkit-scrollbar {
  width: 6px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background-color: rgba(255, 255, 255, 0.2);
  border-radius: 3px;
}

::-webkit-scrollbar-thumb:hover {
  background-color: rgba(255, 255, 255, 0.3);
}
</style>

