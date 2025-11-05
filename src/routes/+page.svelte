<script lang="ts">
import NativeNotionEditor from "$lib/components/NativeNotionEditor.svelte";
import NativeAIAssistant from "$lib/components/NativeAIAssistant.svelte";
import { onMount, setContext } from "svelte";
import { listen } from "@tauri-apps/api/event";
import type { AIProvider } from "$lib/types";

// Application state
let editorContent = $state("");
let selectedText = $state("");
let context = $state({ apps: [], files: [], text: "" });
let isAssistantMinimized = $state(false);
let isDarkMode = $state(false);
let isMac = $state(false);
let showWelcome = $state(true);
let isLoading = $state(false);

onMount(async () => {
  // Set context for child components
  setContext("editorContent", editorContent);
  setContext("selectedText", selectedText);
  setContext("context", context);
  // Detect platform
  isMac = navigator.userAgent.includes("Mac");

  // Initialize theme
  if (window.matchMedia) {
    const darkModeQuery = window.matchMedia("(prefers-color-scheme: dark)");
    isDarkMode = darkModeQuery.matches;
    darkModeQuery.addEventListener("change", (e) => {
      isDarkMode = e.matches;
      document.documentElement.classList.toggle("dark", e.matches);
    });
  }

  // Setup native event listeners
  await setupNativeEventListeners();

  // Initialize with sample content if empty
  if (!editorContent.trim()) {
    setTimeout(() => {
      showWelcome = false;
    }, 2000);
  }

  // Apply theme to document
  document.documentElement.classList.toggle("dark", isDarkMode);
});

async function setupNativeEventListeners() {
  if (window.__TAURI__) {
    // Listen for native menu events
    await listen("menu-new", () => {
      if (confirm("Create a new document? Current changes will be lost.")) {
        editorContent = "";
        showWelcome = true;
      }
    });

    await listen("menu-save", () => {
      saveDocument();
    });

    await listen("menu-export", () => {
      exportDocument();
    });

    await listen("menu-toggle-theme", () => {
      isDarkMode = !isDarkMode;
      document.documentElement.classList.toggle("dark", isDarkMode);
    });

    await listen("menu-focus-mode", () => {
      isAssistantMinimized = !isAssistantMinimized;
    });

    await listen("menu-about", () => {
      alert(
        "AI Notion Editor\nVersion 1.0.0\nA native AI-powered writing assistant",
      );
    });
  }
}

function handleContentChange(content: string) {
  editorContent = content;
  updateContext();
}

function handleSelectionChange(text: string) {
  selectedText = text;
}

function updateContext() {
  // Extract @app mentions
  const appMatches = editorContent.match(/@([^\s]+)/g) || [];
  const apps = appMatches.map((match) => match.slice(1));

  // Extract #file mentions
  const fileMatches = editorContent.match(/#([^\s]+)/g) || [];
  const files = fileMatches.map((match) => match.slice(1));

  context = {
    apps,
    files,
    text: editorContent,
  };
}

function extractContext() {
  return context;
}

async function saveDocument() {
  // This would open a native save dialog
  console.log("Saving document:", editorContent.slice(0, 100) + "...");

  // Simulate save operation
  isLoading = true;
  await new Promise((resolve) => setTimeout(resolve, 1000));
  isLoading = false;

  // Show success feedback
  if (window.__TAURI__) {
    // Would show native notification
    console.log("Document saved successfully");
  }
}

async function exportDocument() {
  const markdownContent = convertToMarkdown();

  try {
    await navigator.clipboard.writeText(markdownContent);

    // Show success feedback
    if (window.__TAURI__) {
      console.log("Markdown copied to clipboard");
    }
  } catch (error) {
    console.error("Failed to copy to clipboard:", error);
  }
}

function convertToMarkdown(): string {
  // This is a simple HTML to Markdown conversion
  // In a real app, you'd use a proper library
  let markdown = editorContent
    .replace(/<h1[^>]*>(.*?)<\/h1>/g, "# $1\n\n")
    .replace(/<h2[^>]*>(.*?)<\/h2>/g, "## $1\n\n")
    .replace(/<h3[^>]*>(.*?)<\/h3>/g, "### $1\n\n")
    .replace(/<strong[^>]*>(.*?)<\/strong>/g, "**$1**")
    .replace(/<em[^>]*>(.*?)<\/em>/g, "*$1*")
    .replace(/<p[^>]*>(.*?)<\/p>/g, "$1\n\n")
    .replace(/<br[^>]*>/g, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();

  return markdown;
}

function insertContent(content: string) {
  editorContent = editorContent + "\n\n" + content;
  updateContext();
}

function replaceContent(content: string) {
  if (selectedText) {
    editorContent = editorContent.replace(selectedText, content);
  } else {
    editorContent = content;
  }
  updateContext();
}

function sendToAI(content: string, ctx: any) {
  console.log("Sending to AI:", { content, context: ctx });
  // The AI assistant will handle this
}

function toggleAssistantMinimized() {
  isAssistantMinimized = !isAssistantMinimized;
}

function toggleDarkMode() {
  isDarkMode = !isDarkMode;
  document.documentElement.classList.toggle("dark", isDarkMode);
}

// Enhanced Global keyboard shortcuts
function handleGlobalKeydown(e: KeyboardEvent) {
  const isCmd = isMac ? e.metaKey : e.ctrlKey;
  const isAlt = e.altKey;
  const isShift = e.shiftKey;

  // Enhanced input field detection
  const isInInputField =
    e.target instanceof HTMLInputElement ||
    e.target instanceof HTMLTextAreaElement ||
    e.target?.getAttribute("contenteditable") === "true";

  // Allow basic shortcuts even in input fields
  if (isInInputField) {
    // Allow these shortcuts even when typing
    if (isCmd && isAlt && e.key === "a") {
      e.preventDefault();
      toggleAssistantMinimized();
      return;
    }
    if (isCmd && isAlt && e.key === "t") {
      e.preventDefault();
      toggleDarkMode();
      return;
    }
    // Don't handle other shortcuts while in input fields
    return;
  }

  // File operations
  if (isCmd && e.key === "n") {
    e.preventDefault();
    if (confirm("Create a new document? Current changes will be lost.")) {
      editorContent = "";
      showWelcome = true;
    }
  }

  if (isCmd && e.key === "s") {
    e.preventDefault();
    saveDocument();
  }

  if (isCmd && e.key === "e") {
    e.preventDefault();
    exportDocument();
  }

  // Enhanced UI shortcuts with accessibility
  if (isCmd && isAlt && e.key === "t") {
    e.preventDefault();
    toggleDarkMode();
  }

  if (isCmd && isAlt && e.key === "f") {
    e.preventDefault();
    toggleAssistantMinimized();
  }

  // Focus management shortcuts
  if (isCmd && e.key === "0") {
    e.preventDefault();
    // Reset focus to main editor
    document
      .querySelector(".native-editor-wrapper")
      ?.querySelector('div[contenteditable="true"]')
      ?.focus();
  }

  // Accessibility shortcuts
  if (isAlt && e.key === "Escape") {
    e.preventDefault();
    // Exit any modals or overlays
    showWelcome = false;
  }

  // Help shortcut
  if (isCmd && e.key === "/") {
    e.preventDefault();
    // Show keyboard shortcuts help
    alert(`Keyboard Shortcuts:

Document:
⌘N - New document
⌘S - Save document
⌘E - Export document

UI:
⌘⌥T - Toggle dark mode
⌘⌥F - Toggle AI assistant
⌘0 - Focus editor
Alt+Esc - Close overlays

Editor:
/ - Command palette
⌘B - Bold
⌘I - Italic
⌘K - Insert link
⌘⌥C - Code block`);
  }
}
</script>

<svelte:window on:keydown={handleGlobalKeydown} class:dark={isDarkMode} />

<div
  class="app-container"
  class:dark-mode={isDarkMode}
  class:loading={isLoading}
>
  <!-- Loading overlay -->
  {#if isLoading}
    <div class="loading-overlay">
      <div class="loading-content">
        <div class="loading-spinner"></div>
        <div class="loading-text">Saving...</div>
      </div>
    </div>
  {/if}

  <!-- Welcome overlay -->
  {#if showWelcome && !editorContent.trim()}
    <div class="welcome-overlay">
      <div class="welcome-content">
        <div class="welcome-icon">✨</div>
        <h1 class="welcome-title">AI Notion Editor</h1>
        <p class="welcome-description">
          A native AI-powered writing assistant with rich text editing
          capabilities
        </p>
        <div class="welcome-features">
          <div class="feature-item">
            <span class="feature-icon">🤖</span>
            <span class="feature-text">AI-powered writing assistance</span>
          </div>
          <div class="feature-item">
            <span class="feature-icon">📝</span>
            <span class="feature-text"
              >Rich text editing with Markdown support</span
            >
          </div>
          <div class="feature-item">
            <span class="feature-icon">🎨</span>
            <span class="feature-text">Native macOS design</span>
          </div>
          <div class="feature-item">
            <span class="feature-icon">⚡</span>
            <span class="feature-text"
              >Keyboard shortcuts & productivity features</span
            >
          </div>
        </div>
        <button onclick={() => showWelcome = false} class="welcome-button">
          Start Writing
        </button>
        <div class="welcome-shortcuts">
          <div class="shortcut-item">
            <kbd class="shortcut-key">⌘N</kbd>
            <span class="shortcut-desc">New Document</span>
          </div>
          <div class="shortcut-item">
            <kbd class="shortcut-key">⌘S</kbd>
            <span class="shortcut-desc">Save</span>
          </div>
          <div class="shortcut-item">
            <kbd class="shortcut-key">⌘⌥A</kbd>
            <span class="shortcut-desc">AI Assistant</span>
          </div>
        </div>
      </div>
    </div>
  {/if}

  <!-- Main application layout -->
  <div class="main-layout" class:welcome-visible={showWelcome}>
    <!-- Editor section -->
    <div class="editor-section">
      <NativeNotionEditor
        bind:content={editorContent}
        onContentChange={handleContentChange}
        onSendToAI={sendToAI}
        placeholder="Start writing or type '/' for commands..."
      />
    </div>

    <!-- AI Assistant section -->
    <NativeAIAssistant
      editorContent={editorContent}
      onInsertContent={insertContent}
      onReplaceContent={replaceContent}
      selectedText={selectedText}
      context={context}
      isAssistantMinimized={isAssistantMinimized}
      onToggleMinimize={toggleAssistantMinimized}
    />
  </div>

  <!-- Status bar -->
  <div class="status-bar">
    <div class="status-left">
      <span class="status-item">
        {isMac ? '⌘' : 'Ctrl'}+S to save • {isMac ? '⌘' : 'Ctrl'}+E to export
      </span>
    </div>
    <div class="status-right">
      <span class="status-item">
        {editorContent ? `${Math.round(editorContent.length / 5)} words` : '0 words'}
      </span>
      {#if selectedText}
        <span class="status-item">
          {selectedText.length} chars selected
        </span>
      {/if}
    </div>
  </div>
</div>

<style>
@reference "tailwindcss";
/* Global styles */
:global(html, body) {
  @apply m-0 h-full;
  font-family:
    -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
}

:global(#svelte) {
  @apply h-full;
}

/* App container */
.app-container {
  @apply flex h-screen flex-col bg-[#f8f9fa] text-gray-900;
  transition: all 0.3s ease;
}

.app-container.dark-mode {
  @apply bg-gray-900 text-gray-100;
}

.app-container.loading {
  @apply pointer-events-none;
}

/* Loading overlay */
.loading-overlay {
  @apply fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm;
}

.loading-content {
  @apply flex flex-col items-center rounded-xl bg-white p-6 shadow-2xl;
}

.dark-mode .loading-content {
  @apply bg-gray-800;
}

.loading-spinner {
  @apply mb-3 h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent;
}

.loading-text {
  @apply text-sm font-medium text-gray-700;
}

.dark-mode .loading-text {
  @apply text-gray-300;
}

/* Welcome overlay */
.welcome-overlay {
  @apply fixed inset-0 z-40 flex items-center justify-center bg-white;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.dark-mode .welcome-overlay {
  background: linear-gradient(135deg, #1e3a8a 0%, #312e81 100%);
}

.welcome-content {
  @apply mx-auto max-w-md p-8 text-center;
}

.welcome-icon {
  @apply mb-6 text-6xl;
}

.welcome-title {
  @apply mb-4 text-4xl font-bold text-white;
}

.welcome-description {
  @apply mb-8 text-lg leading-relaxed text-white/80;
}

.welcome-features {
  @apply mb-8 grid grid-cols-1 gap-4;
}

.feature-item {
  @apply flex items-center gap-3 text-left text-white/90;
}

.feature-icon {
  @apply text-xl;
}

.feature-text {
  @apply font-medium;
}

.welcome-button {
  @apply mb-6 rounded-xl bg-white px-8 py-3 font-semibold text-gray-900 shadow-lg transition-all duration-200 hover:scale-105 hover:bg-gray-100;
}

.welcome-shortcuts {
  @apply flex justify-center gap-6 text-sm text-white/60;
}

.shortcut-item {
  @apply flex items-center gap-2;
}

.shortcut-key {
  @apply rounded bg-white/20 px-2 py-1 font-mono text-xs text-white;
}

.shortcut-desc {
  @apply text-white/70;
}

/* Main layout */
.main-layout {
  @apply relative flex flex-1 overflow-hidden;
  transition:
    opacity 0.3s ease,
    filter 0.3s ease;
}

.main-layout.welcome-visible {
  @apply opacity-50 blur-sm;
}

.editor-section {
  @apply flex flex-1 flex-col;
}

/* Status bar */
.status-bar {
  @apply flex items-center justify-between border-t border-gray-200 bg-white px-4 py-2 text-xs text-gray-600;
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
}

.dark-mode .status-bar {
  @apply border-gray-700 bg-gray-800 text-gray-400;
}

.status-left,
.status-right {
  @apply flex items-center gap-4;
}

.status-item {
  @apply flex items-center gap-1;
}

/* Responsive design */
@media (max-width: 768px) {
  .welcome-content {
    @apply p-6;
  }

  .welcome-title {
    @apply text-3xl;
  }

  .welcome-features {
    @apply grid grid-cols-1 gap-3;
  }

  .welcome-shortcuts {
    @apply flex-col gap-2 text-center;
  }

  .status-bar {
    @apply px-3 py-1;
  }

  .status-left,
  .status-right {
    @apply gap-2;
  }
}

/* Dark mode adjustments */
.dark-mode .welcome-overlay {
  @apply bg-gray-900;
}

.dark-mode .welcome-button {
  @apply bg-gray-800 text-gray-100 hover:bg-gray-700;
}

.dark-mode .shortcut-key {
  @apply bg-gray-700 text-gray-300;
}

/* Animations */
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateX(-20px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

.welcome-content {
  animation: fadeIn 0.6s ease;
}

.main-layout {
  animation: slideIn 0.4s ease;
}

/* Focus states */
.main-layout:focus-within {
  @apply outline-none;
}

/* Print styles */
@media print {
  .status-bar,
  .welcome-overlay,
  .loading-overlay {
    @apply hidden;
  }

  .main-layout {
    @apply opacity-100 blur-none;
  }
}
</style>

