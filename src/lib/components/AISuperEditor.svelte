<script lang="ts">
import { onMount, createEventDispatcher } from "svelte";
import { invoke } from "@tauri-apps/api/core";
import RichTextEditor from "./RichTextEditor.svelte";
import ChatSidebar from "./ChatSidebar.svelte";
import MentionMenu from "./MentionMenu.svelte";
import ProviderSelector from "./ProviderSelector.svelte";
import type { ChatMessage, AIProvider, MentionItem } from "$lib/types";

const dispatch = createEventDispatcher();

// Editor state
let editorRef: RichTextEditor;
let editorContent: string = $state("");

// Chat state
let messages: ChatMessage[] = $state([]);
let isLoading = $state(false);
let currentConversationId = $state<string>("");

// Mention system
let showMentionMenu = $state(false);
let mentionQuery = $state("");
let mentionType = $state<"app" | "file" | "provider">("app");
let mentionSuggestions: MentionItem[] = $state([]);

// AI Providers
let availableProviders: AIProvider[] = $state([
  {
    id: "openai",
    name: "OpenAI",
    models: ["gpt-4o", "gpt-4o-mini", "gpt-3.5-turbo"],
    icon: "🤖",
  },
  {
    id: "anthropic",
    name: "Anthropic",
    models: [
      "claude-3-5-sonnet-20241022",
      "claude-3-5-haiku-20241022",
      "claude-3-opus-20240229",
    ],
    icon: "🧠",
  },
  {
    id: "google",
    name: "Google",
    models: ["gemini-1.5-pro", "gemini-1.5-flash", "gemini-pro"],
    icon: "🔍",
  },
  {
    id: "groq",
    name: "Groq",
    models: ["mixtral-8x7b-32768", "llama3-70b-8192", "llama3-8b-8192"],
    icon: "⚡",
  },
]);
let selectedProvider = $state<AIProvider>(availableProviders[0]);
let selectedModel = $state(selectedProvider.models[0]);

// Apps and files for mentions
let systemApps: any[] = $state([]);
let recentFiles: any[] = $state([]);

onMount(async () => {
  try {
    await loadSystemData();
    await initializeAI();
  } catch (error) {
    console.error("Failed to initialize editor:", error);
  }
});

async function loadSystemData() {
  try {
    // Load system apps for @ mentions
    const appsResult = await invoke("getApplications");
    if (appsResult.status === "ok") {
      systemApps = appsResult.data;
    }

    // Load recent files for # mentions
    const filesResult = await invoke("getRecentFiles");
    if (filesResult.status === "ok") {
      recentFiles = filesResult.data;
    }
  } catch (error) {
    console.error("Failed to load system data:", error);
  }
}

async function initializeAI() {
  try {
    // Initialize agent with selected provider
    const initResult = await invoke("initializeAgentWithDb", {
      agentConfig: {
        provider: selectedProvider.id,
        model: selectedModel,
        preamble: `You are an AI assistant integrated into a rich text editor. You can help with writing, editing, summarizing, and providing creative suggestions. You have access to context from mentioned apps (@app) and files (#file).`,
        temperature: 0.7,
        max_tokens: 2000,
      },
    });

    if (initResult.status === "ok") {
      // Create conversation
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

function handleMentionQuery(query: string) {
  if (query.startsWith("@")) {
    mentionType = "app";
    mentionQuery = query.slice(1);
    updateMentionSuggestions(mentionQuery, "app");
    showMentionMenu = true;
  } else if (query.startsWith("#")) {
    mentionType = "file";
    mentionQuery = query.slice(1);
    updateMentionSuggestions(mentionQuery, "file");
    showMentionMenu = true;
  }
}

function clearMentions() {
  showMentionMenu = false;
  mentionSuggestions = [];
  mentionQuery = "";
}

function updateMentionSuggestions(
  query: string,
  type: "app" | "file" | "provider",
) {
  let suggestions: MentionItem[] = [];

  if (type === "app") {
    suggestions = systemApps
      .filter(
        (app) =>
          app.name.toLowerCase().includes(query.toLowerCase()) ||
          app.bundle_id.toLowerCase().includes(query.toLowerCase()),
      )
      .slice(0, 8)
      .map((app) => ({
        type: "app",
        id: app.bundle_id,
        title: app.name,
        subtitle: app.bundle_id,
        icon: "📱",
        data: app,
      }));
  } else if (type === "file") {
    suggestions = recentFiles
      .filter(
        (file) =>
          file.path.toLowerCase().includes(query.toLowerCase()) ||
          file.name.toLowerCase().includes(query.toLowerCase()),
      )
      .slice(0, 8)
      .map((file) => ({
        type: "file",
        id: file.path,
        title: file.name,
        subtitle: file.path,
        icon: getFileIcon(file.file_type),
        data: file,
      }));
  } else if (type === "provider") {
    suggestions = availableProviders
      .filter(
        (provider) =>
          provider.name.toLowerCase().includes(query.toLowerCase()) ||
          provider.id.toLowerCase().includes(query.toLowerCase()),
      )
      .map((provider) => ({
        type: "provider",
        id: provider.id,
        title: provider.name,
        subtitle: provider.models.join(", "),
        icon: provider.icon,
        data: provider,
      }));
  }

  mentionSuggestions = suggestions;
}

function getFileIcon(fileType: string): string {
  const iconMap: Record<string, string> = {
    rust: "🦀",
    javascript: "🟨",
    typescript: "🔷",
    python: "🐍",
    java: "☕",
    cpp: "🔧",
    c: "⚙️",
    go: "🐹",
    html: "🌐",
    css: "🎨",
    json: "📄",
    markdown: "📖",
    txt: "📄",
  };
  return iconMap[fileType.toLowerCase()] || "📄";
}

function selectMention(item: MentionItem) {
  if (!editorRef) return;

  if (item.type === "provider") {
    // Switch to this provider
    const provider = availableProviders.find((p) => p.id === item.id);
    if (provider) {
      selectedProvider = provider;
      selectedModel = provider.models[0];
      // Reinitialize AI with new provider
      initializeAI();
    }
    showMentionMenu = false;
    return;
  }

  // Insert the mention using the rich text editor
  editorRef.insertMention(item);
  showMentionMenu = false;
  mentionSuggestions = [];
}

function openAIChat(content?: string) {
  dispatch("openChat", { content });
}

async function summarizeText(text: string) {
  if (!text.trim()) return;

  isLoading = true;
  try {
    const result = await invoke("chatWithAgentDb", {
      conversationId: currentConversationId,
      message: `Please summarize the following text:\n\n${text}`,
      apps: [],
      files: [],
      useVision: false,
      enableToolCalling: false,
    });

    if (result.status === "ok") {
      const summary = result.data.content;
      const summaryHtml = `<h3>Summary</h3><p>${summary}</p>`;
      editorRef.insertHtml(summaryHtml);
    }
  } catch (error) {
    console.error("Failed to summarize text:", error);
  } finally {
    isLoading = false;
  }
}

async function sendMessage(message: string) {
  if (!message.trim() || isLoading) return;

  isLoading = true;
  const userMessage: ChatMessage = {
    id: Date.now().toString(),
    role: "user",
    content: message,
    timestamp: new Date(),
  };

  messages = [...messages, userMessage];

  try {
    if (!currentConversationId) {
      throw new Error("No active conversation");
    }

    // Extract context from editor content
    const editorText = editorContent.replace(/<[^>]*>/g, ""); // Strip HTML
    const context = extractContextFromText(editorText);

    const result = await invoke("chatWithAgentDb", {
      conversationId: currentConversationId,
      message,
      apps: context.apps,
      files: context.files,
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
          provider: selectedProvider.name,
          model: selectedModel,
        },
      };

      messages = [...messages, assistantMessage];
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
  }
}

function extractContextFromText(text: string) {
  const context: { apps: string[]; files: string[] } = { apps: [], files: [] };

  // Extract @app mentions
  const appMatches = text.match(/@([^\s]+)/g);
  if (appMatches) {
    context.apps = appMatches
      .map((match) => {
        const appName = match.slice(1);
        const app = systemApps.find(
          (a) =>
            a.name.toLowerCase() === appName.toLowerCase() ||
            a.bundle_id.toLowerCase() === appName.toLowerCase(),
        );
        return app ? app.bundle_id : appName;
      })
      .filter(Boolean);
  }

  // Extract #file mentions
  const fileMatches = text.match(/#([^\s]+)/g);
  if (fileMatches) {
    context.files = fileMatches.map((match) => match.slice(1));
  }

  return context;
}

function handleProviderChange(provider: AIProvider) {
  selectedProvider = provider;
  selectedModel = provider.models[0];
  initializeAI();
}

function handleModelChange(model: string) {
  selectedModel = model;
  initializeAI();
}
</script>

<div class="flex h-full">
  <!-- Main Editor Area -->
  <div class="flex flex-1 flex-col">
    <!-- Toolbar -->
    <div class="glass border-b border-white/10 px-4 py-2">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div
            class="h-6 w-6 rounded bg-gradient-to-br from-blue-500 to-purple-600"
          ></div>
          <h1 class="text-lg font-semibold text-white/90">AI Super Editor</h1>
        </div>

        <!-- Provider Selection -->
        <ProviderSelector
          availableProviders={availableProviders}
          bind:selectedProvider={selectedProvider}
          bind:selectedModel={selectedModel}
          on:providerChange={(e) => handleProviderChange(e.detail)}
          on:modelChange={(e) => handleModelChange(e.detail)}
        />
      </div>
    </div>

    <!-- Editor Container -->
    <div class="relative flex-1 overflow-hidden p-6">
      <RichTextEditor
        bind:this={editorRef}
        bind:content={editorContent}
        placeholder="Start typing... Use @ for apps, # for files, / for commands"
        mentionSuggestions={mentionSuggestions}
        on:change={(e) => editorContent = e.detail}
        on:mentionQuery={(e) => handleMentionQuery(e.detail)}
        on:fileQuery={(e) => handleMentionQuery('#' + e.detail)}
        on:clearMentions={clearMentions}
      />

      <!-- Mention Menu -->
      {#if showMentionMenu}
        <MentionMenu
          suggestions={mentionSuggestions}
          query={mentionQuery}
          on:select={(e) => selectMention(e.detail)}
          on:close={() => showMentionMenu = false}
        />
      {/if}
    </div>

    <!-- Quick Actions Bar -->
    <div class="glass border-t border-white/10 px-4 py-2">
      <div class="flex items-center gap-2 text-xs text-white/60">
        <span
          >Type <kbd class="rounded bg-white/10 px-1 py-0.5">@</kbd> for apps</span
        >
        <span class="text-white/30">•</span>
        <span
          >Type <kbd class="rounded bg-white/10 px-1 py-0.5">#</kbd> for files</span
        >
        <span class="text-white/30">•</span>
        <span>Ask AI for assistance anytime</span>
      </div>
    </div>
  </div>

  <!-- Chat Sidebar -->
  <ChatSidebar
    messages={messages}
    isLoading={isLoading}
    selectedProvider={selectedProvider}
    selectedModel={selectedModel}
    on:sendMessage={async (e) => {
			const message = e.detail;
			await sendMessage(message);
		}}
  />
</div>

