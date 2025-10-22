import {
  createSignal,
  onMount,
  For,
  Show,
} from "solid-js";
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

  const handleDeleteConversation = async (conversationId: string, event: MouseEvent) => {
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
    <div class="conversation-history">
      {/* Search Bar */}
      <div class="search-container">
        <div class="search-input-wrapper">
          <input
            type="text"
            value={searchQuery()}
            onInput={(e) => handleSearch(e.currentTarget.value)}
            placeholder="Search conversations..."
            class="search-input"
          />
          <div class="search-icon">🔍</div>
        </div>
      </div>

      {/* New Conversation Button */}
      <button
        onClick={() => props.onNewConversation()}
        class="new-conversation-btn"
      >
        <span class="new-conversation-icon">➕</span>
        <span>New Conversation</span>
      </button>

      {/* Conversation List */}
      <div class="conversation-list">
        <Show when={isLoading()}>
          <div class="loading-indicator">Loading conversations...</div>
        </Show>

        <Show when={!isLoading() && displayConversations().length === 0}>
          <div class="empty-state">
            <div class="empty-icon">💬</div>
            <div class="empty-text">
              {searchQuery() ? "No conversations found" : "No conversations yet"}
            </div>
            <div class="empty-subtitle">
              {searchQuery() ? "Try a different search term" : "Start your first conversation"}
            </div>
          </div>
        </Show>

        <For each={displayConversations()}>
          {(conversation) => (
            <div
              class={`conversation-item ${
                props.currentConversationId === conversation.id ? "active" : ""
              }`}
              onClick={() => handleSelectConversation(conversation.id)}
            >
              <div class="conversation-header">
                <div class="conversation-title">{conversation.title}</div>
                <div class="conversation-meta">
                  <span class="conversation-model">{conversation.model}</span>
                  <span class="conversation-date">
                    {formatDate(conversation.updated_at)}
                  </span>
                </div>
              </div>

              <div class="conversation-stats">
                <span class="message-count">
                  {conversation.message_count} messages
                </span>
                <span class="conversation-provider">
                  {conversation.provider}
                </span>
              </div>

              <button
                class="delete-btn"
                onClick={(e) => handleDeleteConversation(conversation.id, e)}
                title="Delete conversation"
              >
                🗑️
              </button>
            </div>
          )}
        </For>
      </div>

      <style>{`
        .conversation-history {
          width: 300px;
          height: 100%;
          background: rgba(23, 23, 23, 0.95);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border-left: 1px solid rgba(255, 255, 255, 0.1);
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .search-container {
          padding: 16px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }

        .search-input-wrapper {
          position: relative;
        }

        .search-input {
          width: 100%;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          padding: 8px 12px 8px 36px;
          color: rgba(255, 255, 255, 0.9);
          font-size: 14px;
          outline: none;
          transition: all 0.15s ease;
        }

        .search-input::placeholder {
          color: rgba(255, 255, 255, 0.5);
        }

        .search-input:focus {
          border-color: rgba(59, 130, 246, 0.3);
          background: rgba(255, 255, 255, 0.08);
        }

        .search-icon {
          position: absolute;
          left: 12px;
          top: 50%;
          transform: translateY(-50%);
          color: rgba(255, 255, 255, 0.5);
          font-size: 14px;
        }

        .new-conversation-btn {
          margin: 0 16px 16px;
          padding: 12px;
          background: rgba(59, 130, 246, 0.2);
          border: 1px solid rgba(59, 130, 246, 0.3);
          border-radius: 8px;
          color: #60a5fa;
          display: flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
          transition: all 0.15s ease;
          font-size: 14px;
          font-weight: 500;
        }

        .new-conversation-btn:hover {
          background: rgba(59, 130, 246, 0.3);
          transform: translateY(-1px);
        }

        .new-conversation-icon {
          font-size: 16px;
        }

        .conversation-list {
          flex: 1;
          overflow-y: auto;
          padding: 0 16px 16px;
        }

        .conversation-list::-webkit-scrollbar {
          width: 4px;
        }

        .conversation-list::-webkit-scrollbar-track {
          background: transparent;
        }

        .conversation-list::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.2);
          border-radius: 2px;
        }

        .loading-indicator {
          text-align: center;
          color: rgba(255, 255, 255, 0.6);
          padding: 20px;
          font-size: 14px;
        }

        .empty-state {
          text-align: center;
          padding: 32px 16px;
          color: rgba(255, 255, 255, 0.6);
        }

        .empty-icon {
          font-size: 48px;
          margin-bottom: 16px;
          opacity: 0.5;
        }

        .empty-text {
          font-size: 16px;
          font-weight: 500;
          margin-bottom: 8px;
        }

        .empty-subtitle {
          font-size: 14px;
          color: rgba(255, 255, 255, 0.4);
        }

        .conversation-item {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          padding: 12px;
          margin-bottom: 8px;
          cursor: pointer;
          transition: all 0.15s ease;
          position: relative;
        }

        .conversation-item:hover {
          background: rgba(255, 255, 255, 0.08);
          transform: translateY(-1px);
        }

        .conversation-item.active {
          background: rgba(59, 130, 246, 0.2);
          border-color: rgba(59, 130, 246, 0.3);
        }

        .conversation-header {
          margin-bottom: 8px;
        }

        .conversation-title {
          color: rgba(255, 255, 255, 0.9);
          font-size: 14px;
          font-weight: 500;
          margin-bottom: 4px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .conversation-meta {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 12px;
          color: rgba(255, 255, 255, 0.5);
        }

        .conversation-model {
          background: rgba(255, 255, 255, 0.1);
          padding: 2px 6px;
          border-radius: 4px;
          font-weight: 500;
        }

        .conversation-date {
          flex: 1;
          text-align: right;
        }

        .conversation-stats {
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 12px;
          color: rgba(255, 255, 255, 0.4);
        }

        .message-count {
          font-weight: 500;
        }

        .conversation-provider {
          text-transform: capitalize;
        }

        .delete-btn {
          position: absolute;
          top: 8px;
          right: 8px;
          background: transparent;
          border: none;
          color: rgba(255, 255, 255, 0.3);
          cursor: pointer;
          padding: 4px;
          border-radius: 4px;
          font-size: 12px;
          opacity: 0;
          transition: all 0.15s ease;
        }

        .conversation-item:hover .delete-btn {
          opacity: 1;
        }

        .delete-btn:hover {
          background: rgba(239, 68, 68, 0.2);
          color: #ef4444;
        }
      `}</style>
    </div>
  );
}