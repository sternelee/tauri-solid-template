<!-- Helper function for formatting message content -->
<script context="module">
function formatMessageContent(content: string): string {
  // Simple markdown-like formatting
  return (
    content
      // Bold text
      .replace(
        /\*\*(.*?)\*\*/g,
        '<strong class="text-white font-semibold">$1</strong>',
      )
      // Italic text
      .replace(/\*(.*?)\*/g, '<em class="text-white/80">$1</em>')
      // Code blocks
      .replace(
        /```(.*?)```/gs,
        '<pre class="bg-gray-800 rounded p-2 my-2 overflow-x-auto"><code class="text-xs font-mono text-white/90">$1</code></pre>',
      )
      // Inline code
      .replace(
        /`(.*?)`/g,
        '<code class="bg-gray-800 px-1 py-0.5 rounded text-xs font-mono text-white/90">$1</code>',
      )
      // Line breaks
      .replace(/\n/g, "<br>")
      // Links
      .replace(
        /(https?:\/\/[^\s]+)/g,
        '<a href="$1" target="_blank" rel="noopener noreferrer" class="text-blue-400 hover:text-blue-300 underline">$1</a>',
      )
      // Lists (simple)
      .replace(/^- (.+)$/gm, '<li class="ml-4">$1</li>')
      // Headers
      .replace(
        /^### (.*$)/gm,
        '<h3 class="text-sm font-semibold text-white/90 mt-3 mb-1">$1</h3>',
      )
      .replace(
        /^## (.*$)/gm,
        '<h2 class="text-base font-semibold text-white/90 mt-3 mb-1">$1</h2>',
      )
      .replace(
        /^# (.*$)/gm,
        '<h1 class="text-lg font-semibold text-white/90 mt-3 mb-1">$1</h1>',
      )
  );
}
</script>

<script lang="ts">
import type { ChatMessage } from "$lib/types";

export let message: ChatMessage;

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function getRoleIcon(role: string): string {
  switch (role) {
    case "user":
      return "👤";
    case "assistant":
      return "🤖";
    case "system":
      return "⚙️";
    default:
      return "💬";
  }
}

function getRoleColor(role: string): string {
  switch (role) {
    case "user":
      return "bg-blue-500/20 border-blue-500/30";
    case "assistant":
      return "bg-gray-700/50 border-gray-600/30";
    case "system":
      return "bg-yellow-500/20 border-yellow-500/30";
    default:
      return "bg-gray-700/50 border-gray-600/30";
  }
}
</script>

<div
  class="animate-fade-in flex gap-3 {message.role === 'user' ? 'flex-row-reverse' : ''}"
  class:text-right={message.role === 'user'}
>
  <!-- Avatar -->
  <div
    class="flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium
			{message.role === 'user' ? 'bg-blue-500 text-white' : 'bg-gray-700 text-white/80'}"
  >
    {getRoleIcon(message.role)}
  </div>

  <!-- Message Content -->
  <div class="max-w-[80%] min-w-0 flex-1">
    <!-- Message Bubble -->
    <div
      class="rounded-2xl p-3 text-sm leading-6 break-words
				{message.role === 'user' ? 'rounded-br-sm' : 'rounded-bl-sm'}
				{getRoleColor(message.role)}
				border text-white/90"
    >
      <!-- Render markdown-like content -->
      {@html formatMessageContent(message.content)}
    </div>

    <!-- Context Information -->
    {#if message.context && (message.context.apps?.length || message.context.files?.length)}
      <div
        class="mt-2 flex flex-wrap gap-2"
        class:justify-end={message.role === 'user'}
      >
        {#if message.context.apps && message.context.apps.length > 0}
          <div class="flex flex-wrap gap-1">
            <span class="text-xs font-medium text-white/60">Apps:</span>
            {#each message.context.apps as app}
              <span
                class="inline-flex items-center gap-1 rounded-full border border-blue-500/30 bg-blue-500/20 px-2 py-0.5 text-[11px] font-medium text-blue-300"
              >
                📱 {app.name}
              </span>
            {/each}
          </div>
        {/if}

        {#if message.context.files && message.context.files.length > 0}
          <div class="flex flex-wrap gap-1">
            <span class="text-xs font-medium text-white/60">Files:</span>
            {#each message.context.files as file}
              <span
                class="inline-flex items-center gap-1 rounded-full border border-green-500/30 bg-green-500/20 px-2 py-0.5 text-[11px] font-medium text-green-300"
              >
                📄 {file.path.split('/').pop()}
              </span>
            {/each}
          </div>
        {/if}
      </div>
    {/if}

    <!-- Metadata -->
    <div
      class="mt-1 flex items-center gap-2 text-[11px] text-white/40"
      class:justify-end={message.role === 'user'}
    >
      <span>{formatTime(message.timestamp)}</span>
      {#if message.metadata}
        {#if message.metadata.provider}
          <span class="text-white/30">•</span>
          <span>{message.metadata.provider}</span>
        {/if}
        {#if message.metadata.tokens}
          <span class="text-white/30">•</span>
          <span>{message.metadata.tokens} tokens</span>
        {/if}
      {/if}
    </div>
  </div>
</div>

