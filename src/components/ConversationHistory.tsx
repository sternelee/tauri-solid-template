import { createSignal, onMount, For, Show } from "solid-js";
import { commands } from "../bindings";

interface ConversationHistoryProps {
  onSelectConversation: (id: string) => void;
  onNewConversation: () => void;
  currentConversationId?: string;
}

export default function ConversationHistory(props: ConversationHistoryProps) {
  const [conversations, setConversations] = createSignal<any[]>([]);
  const [isLoading, setIsLoading] = createSignal(false);
  const [searchQuery, setSearchQuery] = createSignal("");
  const [isSearching, setIsSearching] = createSignal(false);
  const [searchResults, setSearchResults] = createSignal<any[]>([]);

  // Load conversations on mount
  onMount(async () => {
    await loadConversations();
  });

  const loadConversations = async () => {
    setIsLoading(true);
    try {
      const result = await commands.listConversationsDb(50);
      if (result.status === "ok") {
        setConversations(result.data);
      }
    } catch (error) {
      console.error("Failed to load conversations:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = async (query: string) => {
    setSearchQuery(query);

    if (!query.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    try {
      const result = await commands.searchConversationsDb(query);
      if (result.status === "ok") {
        setSearchResults(result.data);
      }
    } catch (error) {
      console.error("Failed to search conversations:", error);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectConversation = (conversationId: string) => {
    props.onSelectConversation(conversationId);
  };

  const handleDeleteConversation = async (
    conversationId: string,
    event: MouseEvent,
  ) => {
    event.stopPropagation();

    if (confirm("Are you sure you want to delete this conversation?")) {
      try {
        const result = await commands.deleteConversationDb(conversationId);
        if (result.status === "ok") {
          await loadConversations();
          if (props.currentConversationId === conversationId) {
            props.onNewConversation();
          }
        }
      } catch (error) {
        console.error("Failed to delete conversation:", error);
      }
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffHours < 1) {
      return "Just now";
    } else if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else if (diffDays < 7) {
      return `${diffDays}d ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  const displayConversations = () => {
    return searchQuery() ? searchResults() : conversations();
  };

  return (
    <div class="flex h-full w-[300px] flex-col overflow-hidden border-l border-white/10 bg-gray-900/95 backdrop-blur-xl">
      {/* Search Bar */}
      <div class="border-b border-white/10 p-4">
        <div class="relative">
          <input
            type="text"
            value={searchQuery()}
            onInput={(e) => handleSearch(e.currentTarget.value)}
            placeholder="Search conversations..."
            class="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 pl-9 text-sm text-white/90 placeholder-white/50 transition-all outline-none focus:border-blue-500/30 focus:bg-white/8"
          />
          <div class="absolute top-1/2 left-3 -translate-y-1/2 transform text-sm text-white/50">
            🔍
          </div>
        </div>
      </div>

      {/* New Conversation Button */}
      <button
        onClick={() => props.onNewConversation()}
        class="mx-4 mb-4 flex cursor-pointer items-center gap-2 rounded-lg border border-blue-500/30 bg-blue-500/20 p-3 text-sm font-medium text-blue-400 transition-all hover:-translate-y-px hover:bg-blue-500/30"
      >
        <span class="text-base">➕</span>
        <span>New Conversation</span>
      </button>

      {/* Conversation List */}
      <div class="flex-1 overflow-y-auto px-4 pb-4 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:rounded-sm [&::-webkit-scrollbar-thumb]:bg-white/20 [&::-webkit-scrollbar-track]:bg-transparent">
        <Show when={isLoading()}>
          <div class="p-5 text-center text-sm text-white/60">
            Loading conversations...
          </div>
        </Show>

        <Show when={!isLoading() && displayConversations().length === 0}>
          <div class="px-4 py-8 text-center text-white/60">
            <div class="mb-4 text-5xl opacity-50">💬</div>
            <div class="mb-2 text-base font-medium">
              {searchQuery()
                ? "No conversations found"
                : "No conversations yet"}
            </div>
            <div class="text-sm text-white/40">
              {searchQuery()
                ? "Try a different search term"
                : "Start your first conversation"}
            </div>
          </div>
        </Show>

        <For each={displayConversations()}>
          {(conversation) => (
            <div
              class={`group relative mb-2 cursor-pointer rounded-lg border border-white/10 bg-white/5 p-3 transition-all hover:-translate-y-px hover:bg-white/8 ${
                props.currentConversationId === conversation.id
                  ? "border-blue-500/30 bg-blue-500/20"
                  : ""
              }`}
              onClick={() => handleSelectConversation(conversation.id)}
            >
              <div class="mb-2">
                <div class="mb-1 truncate text-sm font-medium text-white/90">
                  {conversation.title}
                </div>
                <div class="flex items-center gap-2 text-xs text-white/50">
                  <span class="rounded bg-white/10 px-1.5 py-0.5 font-medium">
                    {conversation.model}
                  </span>
                  <span class="flex-1 text-right">
                    {formatDate(conversation.updated_at)}
                  </span>
                </div>
              </div>

              <div class="flex items-center justify-between text-xs text-white/40">
                <span class="font-medium">
                  {conversation.message_count} messages
                </span>
                <span class="capitalize">{conversation.provider}</span>
              </div>

              <button
                class="absolute top-2 right-2 cursor-pointer rounded border-none bg-transparent p-1 text-xs text-white/30 opacity-0 transition-all group-hover:opacity-100 hover:bg-red-500/20 hover:text-red-400"
                onClick={(e) => handleDeleteConversation(conversation.id, e)}
                title="Delete conversation"
              >
                🗑️
              </button>
            </div>
          )}
        </For>
      </div>
    </div>
  );
}

