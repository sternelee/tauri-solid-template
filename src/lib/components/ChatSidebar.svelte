<script lang="ts">
import { createEventDispatcher } from "svelte";
import { fly } from "svelte/transition";
import type { ChatMessage, AIProvider } from "$lib/types";
import ChatMessageComponent from "./ChatMessage.svelte";

export let messages: ChatMessage[] = [];
export let isLoading = false;
export let selectedProvider: AIProvider;
export let selectedModel: string;
export let showSidebar = true;

const dispatch = createEventDispatcher();

let inputMessage = $state("");
let isMinimized = $state(false);
let chatContainer: HTMLElement;

function sendMessage() {
  const content = inputMessage.trim();
  if (!content || isLoading) return;

  dispatch("sendMessage", content);
  inputMessage = "";
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
}

function toggleMinimize() {
  isMinimized = !isMinimized;
}

function clearChat() {
  dispatch("clearChat");
}

// Auto-scroll to bottom on new messages
$: if (messages.length > 0 && chatContainer) {
  setTimeout(() => {
    if (chatContainer) {
      chatContainer.scrollTop = chatContainer.scrollHeight;
    }
  }, 100);
}
</script>

<div
  class="flex flex-col border-l border-white/10 bg-gray-800/50 transition-all duration-300"
  class:w-80={!isMinimized}
  class:w-12={isMinimized}
>
  <!-- Header -->
  <div class="flex items-center justify-between border-b border-white/10 p-3">
    {#if !isMinimized}
      <div class="flex items-center gap-2">
        <span class="text-lg">{selectedProvider.icon}</span>
        <div>
          <div class="text-sm font-medium text-white/90">AI Assistant</div>
          <div class="text-xs text-white/60">
            {selectedProvider.name} • {selectedModel}
          </div>
        </div>
      </div>
    {:else}
      <span class="text-lg">{selectedProvider.icon}</span>
    {/if}

    <div class="flex items-center gap-1">
      {#if !isMinimized && messages.length > 0}
        <button
          on:click={clearChat}
          class="flex h-6 w-6 items-center justify-center rounded transition-colors hover:bg-white/10"
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

      <button
        on:click={toggleMinimize}
        class="flex h-6 w-6 items-center justify-center rounded transition-colors hover:bg-white/10"
        title={isMinimized ? 'Expand chat' : 'Minimize chat'}
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
    <!-- Messages -->
    <div
      bind:this={chatContainer}
      class="custom-scrollbar flex-1 space-y-3 overflow-y-auto p-3"
    >
      {#each messages as message (message.id)}
        <ChatMessageComponent
          message={message}
          transition:fly={{ y: 20, duration: 300 }}
        />
      {/each}

      {#if isLoading}
        <div class="flex animate-pulse gap-3">
          <div
            class="flex h-8 w-8 items-center justify-center rounded-full bg-gray-700"
          >
            <span class="text-sm">{selectedProvider.icon}</span>
          </div>
          <div class="flex-1">
            <div class="rounded-2xl rounded-tl-none bg-gray-700/50 p-3">
              <div class="flex gap-1">
                <span
                  class="animate-typing h-2 w-2 rounded-full bg-white/60"
                  style="animation-delay: -0.32s"
                ></span>
                <span
                  class="animate-typing h-2 w-2 rounded-full bg-white/60"
                  style="animation-delay: -0.16s"
                ></span>
                <span class="animate-typing h-2 w-2 rounded-full bg-white/60"
                ></span>
              </div>
            </div>
          </div>
        </div>
      {/if}

      {#if messages.length === 0}
        <div
          class="flex h-full flex-col items-center justify-center text-center text-white/40"
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
    <div class="border-t border-white/10 p-3">
      <div class="relative">
        <textarea
          bind:value={inputMessage}
          on:keydown={handleKeydown}
          placeholder="Ask AI anything..."
          disabled={isLoading}
          class="w-full resize-none rounded-lg border border-white/10 bg-gray-700/50 px-3 py-2 pr-10 text-sm text-white/80 placeholder-white/40 focus:border-blue-500/30 focus:ring-2 focus:ring-blue-500/50 focus:outline-none disabled:opacity-50"
          rows="2"
          style="max-height: 120px; min-height: 40px;"
        ></textarea>

        <button
          on:click={sendMessage}
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

      <div class="mt-2 flex items-center justify-between">
        <div class="text-xs text-white/50">
          Press <kbd class="rounded bg-gray-700 px-1 py-0.5">Shift</kbd> +
          <kbd class="rounded bg-gray-700 px-1 py-0.5">Enter</kbd> for new line
        </div>
        <div class="text-xs text-white/50">
          {messages.length} messages
        </div>
      </div>
    </div>
  {/if}
</div>

