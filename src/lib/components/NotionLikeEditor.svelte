<script lang="ts">
import { onMount, onDestroy, createEventDispatcher } from "svelte";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Document from "@tiptap/extension-document";
import Paragraph from "@tiptap/extension-paragraph";
import Heading from "@tiptap/extension-heading";
import TextStyle from "@tiptap/extension-text-style";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import Table from "@tiptap/extension-table";
import TableHeader from "@tiptap/extension-table-header";
import TableCell from "@tiptap/extension-table-cell";
import TableRow from "@tiptap/extension-table-row";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import CodeBlock from "@tiptap/extension-code-block";
import HorizontalRule from "@tiptap/extension-horizontal-rule";
import BubbleMenu from "@tiptap/extension-bubble-menu";
import FloatingMenu from "@tiptap/extension-floating-menu";
import Placeholder from "@tiptap/extension-placeholder";
import CharacterCount from "@tiptap/extension-character-count";
import { createMarkdownSerializer } from "tiptap-markdown";
import { lowlight } from "lowlight";
import { invoke } from "@tauri-apps/api/core";
import type { ChatMessage, AIProvider } from "$lib/types";

const dispatch = createEventDispatcher();

export let content = "";
export let placeholder = "Start writing...";
export let aiSuggestions: any[] = [];
export let onContentChange: (content: string) => void = () => {};
export let onSendToAI: (content: string, context: any) => void = () => {};

// Editor state
let editor: Editor | null = $state(null);
let editorElement: HTMLDivElement;
let bubbleMenuElement: HTMLDivElement;
let floatingMenuElement: HTMLDivElement;
let isEditorReady = $state(false);

// File drag state
let isDraggingOver = $state(false);
let draggedFiles: File[] = $state([]);

// AI suggestions state
let showAISuggestions = $state(false);
let currentSuggestions: any[] = $state([]);
let selectedSuggestionIndex = $state(0);

// Markdown serializer
let markdownSerializer = $state(null);

// AI Providers
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

onMount(() => {
  initializeEditor();
  setupFileDragDrop();
  initializeMarkdownSerializer();
});

onDestroy(() => {
  editor?.destroy();
});

function initializeEditor() {
  editor = new Editor({
    element: editorElement,
    extensions: [
      Document,
      Paragraph,
      Heading.configure({
        levels: [1, 2, 3, 4, 5, 6],
      }),
      TextStyle,
      BubbleMenu.configure({
        element: bubbleMenuElement,
        shouldShow: ({ state }) => {
          const { selection } = state;
          const { empty, $anchor } = selection;
          return !empty || $anchor.parent.name === "table";
        },
      }),
      FloatingMenu.configure({
        element: floatingMenuElement,
        shouldShow: ({ state }) => {
          const { selection } = state;
          const { empty } = selection;
          return empty;
        },
      }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        linkOnPaste: true,
      }),
      Image.configure({
        HTMLAttributes: {
          class: "max-w-full h-auto rounded-lg",
        },
      }),
      Table.configure({
        resizable: true,
        allowTableNodeSelection: true,
      }),
      TableHeader,
      TableCell,
      TableRow,
      TaskList,
      TaskItem,
      CodeBlockLowlight.configure({
        lowlight,
        defaultLanguage: "plaintext",
      }),
      CodeBlock,
      HorizontalRule,
      Placeholder.configure({
        placeholder,
      }),
      CharacterCount.configure({
        limit: 10000,
      }),
      // Custom extension for mentions
      {
        name: "mention",
        addGlobalAttributes() {
          return [
            {
              types: ["text"],
              attributes: {
                class: {
                  default: null,
                  parseHTML: (element: any) =>
                    element.getAttribute("data-mention-class"),
                },
                "mention-type": {
                  default: null,
                  parseHTML: (element: any) =>
                    element.getAttribute("data-mention-type"),
                },
                "mention-id": {
                  default: null,
                  parseHTML: (element: any) =>
                    element.getAttribute("data-mention-id"),
                },
              },
            },
          ];
        },
        addProseMirrorPlugins() {
          return [mentionPlugin()];
        },
      },
    ],
    onUpdate: ({ editor }) => {
      const newContent = editor.getHTML();
      content = newContent;
      onContentChange(newContent);
      dispatch("change", newContent);
    },
    onSelectionUpdate: ({ editor }) => {
      const { selection } = editor.state;
      const { empty, $from } = selection;

      // Check for AI trigger patterns
      if (!empty) {
        const textBeforeCursor = editor.state.doc.textBetween(0, $from);
        checkForAISuggestions(textBeforeCursor);
      }
    },
  });

  isEditorReady = true;
}

function mentionPlugin() {
  return {
    priority: 1000,
    props: {
      handleTextInput(view, from, to, text) {
        // Handle @mentions for apps
        if (
          text === "@" &&
          (from === 0 ||
            view.state.doc.textBetween(from - 1, from).match(/\s|$/))
        ) {
          return showMentionMenu("app", from, to);
        }

        // Handle #mentions for files
        if (
          text === "#" &&
          (from === 0 ||
            view.state.doc.textBetween(from - 1, from).match(/\s|$/))
        ) {
          return showMentionMenu("file", from, to);
        }

        // Handle AI suggestions
        if (
          text === "/" &&
          (from === 0 ||
            view.state.doc.textBetween(from - 1, from).match(/\n|$/))
        ) {
          return showAISuggestionMenu(from, to);
        }

        return false;
      },
    },
  };
}

function showMentionMenu(type: "app" | "file", from: number, to: number) {
  // This would integrate with your existing mention system
  // For now, just return false to let the default behavior continue
  return false;
}

function showAISuggestionMenu(from: number, to: number) {
  currentSuggestions = [
    {
      title: "Ask AI",
      description: "Get AI assistance",
      icon: "🤖",
      action: "ask-ai",
    },
    {
      title: "Improve Writing",
      description: "Enhance your text",
      icon: "✨",
      action: "improve",
    },
    {
      title: "Summarize",
      description: "Create a summary",
      icon: "📝",
      action: "summarize",
    },
    {
      title: "Expand",
      description: "Expand on this idea",
      icon: "📈",
      action: "expand",
    },
    {
      title: "Translate",
      description: "Translate to another language",
      icon: "🌐",
      action: "translate",
    },
  ];
  showAISuggestions = true;
  selectedSuggestionIndex = 0;
  return false;
}

function setupFileDragDrop() {
  if (!editorElement) return;

  editorElement.addEventListener("dragover", handleDragOver);
  editorElement.addEventListener("dragleave", handleDragLeave);
  editorElement.addEventListener("drop", handleDrop);
}

function handleDragOver(e: DragEvent) {
  e.preventDefault();
  isDraggingOver = true;
}

function handleDragLeave(e: DragEvent) {
  e.preventDefault();
  isDraggingOver = false;
}

async function handleDrop(e: DragEvent) {
  e.preventDefault();
  isDraggingOver = false;

  const files = Array.from(e.dataTransfer?.files || []);
  if (files.length === 0) return;

  draggedFiles = files;

  // Process each file
  for (const file of files) {
    await processFile(file);
  }

  draggedFiles = [];
}

async function processFile(file: File) {
  const fileType = file.type;
  const fileName = file.name;

  // Handle images
  if (fileType.startsWith("image/")) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      if (editor) {
        editor.chain().focus().setImage({ src: dataUrl, alt: fileName }).run();
      }
    };
    reader.readAsDataURL(file);
    return;
  }

  // Handle text files
  if (
    fileType.startsWith("text/") ||
    fileName.endsWith(".md") ||
    fileName.endsWith(".txt")
  ) {
    const text = await file.text();
    if (editor) {
      editor
        .chain()
        .focus()
        .insertContentAt(
          editor.state.selection.to,
          `\n\n### File: ${fileName}\n\n\`\`\`${getLanguageFromFileName(fileName)}\n${text}\n\`\`\`\n\n`,
        )
        .run();
    }
    return;
  }

  // Handle other files as attachments
  if (editor) {
    editor
      .chain()
      .focus()
      .insertContentAt(
        editor.state.selection.to,
        `\n\n📎 **File:** ${fileName} (${formatFileSize(file.size)})\n\n`,
      )
      .run();
  }
}

function getLanguageFromFileName(fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase();
  const languageMap: Record<string, string> = {
    js: "javascript",
    ts: "typescript",
    py: "python",
    rs: "rust",
    java: "java",
    cpp: "cpp",
    c: "c",
    go: "go",
    html: "html",
    css: "css",
    json: "json",
    md: "markdown",
    yaml: "yaml",
    yml: "yaml",
    sql: "sql",
  };
  return languageMap[ext || ""] || "plaintext";
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

function initializeMarkdownSerializer() {
  markdownSerializer = createMarkdownSerializer();
}

// AI functionality
function checkForAISuggestions(text: string) {
  const lastChars = text.slice(-10).trim();

  // Trigger suggestions for common patterns
  if (
    lastChars.endsWith("?") ||
    lastChars.endsWith(".") ||
    lastChars.endsWith(":")
  ) {
    generateContextualSuggestions(text);
  }
}

async function generateContextualSuggestions(text: string) {
  // This would integrate with your AI system
  // For now, provide some basic suggestions
  currentSuggestions = [
    {
      title: "Continue writing",
      description: "Continue this text",
      icon: "✍️",
      action: "continue",
    },
    {
      title: "Rewrite this",
      description: "Improve the phrasing",
      icon: "🔄",
      action: "rewrite",
    },
    {
      title: "Add more detail",
      description: "Expand with examples",
      icon: "🔍",
      action: "detail",
    },
  ];
  showAISuggestions = true;
  selectedSuggestionIndex = 0;
}

function selectAISuggestion(suggestion: any) {
  if (!editor) return;

  const selectedText = editor.state.doc.textBetween(
    editor.state.selection.from,
    editor.state.selection.to,
  );

  switch (suggestion.action) {
    case "ask-ai":
      onSendToAI(selectedText, extractContext());
      break;
    case "improve":
      improveText(selectedText);
      break;
    case "summarize":
      summarizeText(selectedText);
      break;
    case "expand":
      expandText(selectedText);
      break;
    case "continue":
      continueWriting(selectedText);
      break;
    case "translate":
      translateText(selectedText);
      break;
  }

  showAISuggestions = false;
}

function extractContext() {
  if (!editor) return {};

  const allText = editor.state.doc.textContent;
  const context: any = {
    apps: [],
    files: [],
    text: allText,
  };

  // Extract @app mentions
  const appMatches = allText.match(/@([^\s]+)/g);
  if (appMatches) {
    context.apps = appMatches.map((match) => match.slice(1));
  }

  // Extract #file mentions
  const fileMatches = allText.match(/#([^\s]+)/g);
  if (fileMatches) {
    context.files = fileMatches.map((match) => match.slice(1));
  }

  return context;
}

async function improveText(text: string) {
  // This would call your AI service
  console.log("Improving text:", text);
}

async function summarizeText(text: string) {
  // This would call your AI service
  console.log("Summarizing text:", text);
}

async function expandText(text: string) {
  // This would call your AI service
  console.log("Expanding text:", text);
}

async function continueWriting(text: string) {
  // This would call your AI service
  console.log("Continuing text:", text);
}

async function translateText(text: string) {
  // This would call your AI service
  console.log("Translating text:", text);
}

// Formatting commands
function formatText(command: string, attrs?: any) {
  if (!editor) return;

  switch (command) {
    case "bold":
      editor.chain().focus().toggleBold().run();
      break;
    case "italic":
      editor.chain().focus().toggleItalic().run();
      break;
    case "strike":
      editor.chain().focus().toggleStrike().run();
      break;
    case "code":
      editor.chain().focus().toggleCode().run();
      break;
    case "heading":
      editor
        .chain()
        .focus()
        .toggleHeading({ level: attrs?.level || 1 })
        .run();
      break;
    case "paragraph":
      editor.chain().focus().setParagraph().run();
      break;
    case "bulletList":
      editor.chain().focus().toggleBulletList().run();
      break;
    case "orderedList":
      editor.chain().focus().toggleOrderedList().run();
      break;
    case "taskList":
      editor.chain().focus().toggleTaskList().run();
      break;
    case "codeBlock":
      editor.chain().focus().toggleCodeBlock().run();
      break;
    case "blockquote":
      editor.chain().focus().toggleBlockquote().run();
      break;
    case "horizontalRule":
      editor.chain().focus().setHorizontalRule().run();
      break;
    case "table":
      editor
        .chain()
        .focus()
        .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
        .run();
      break;
    case "undo":
      editor.chain().focus().undo().run();
      break;
    case "redo":
      editor.chain().focus().redo().run();
      break;
  }
}

// Export/Import functions
function exportAsMarkdown(): string {
  if (!editor || !markdownSerializer) return "";
  return markdownSerializer.serialize(editor.state.doc);
}

function exportAsHTML(): string {
  if (!editor) return "";
  return editor.getHTML();
}

function exportAsJSON(): string {
  if (!editor) return "";
  return JSON.stringify(editor.getJSON(), null, 2);
}

// Expose methods
$: {
  if (editor && content !== editor.getHTML()) {
    editor.commands.setContent(content, false);
  }
}

// Keyboard navigation for suggestions
function handleSuggestionKeydown(e: KeyboardEvent) {
  if (!showAISuggestions) return;

  switch (e.key) {
    case "ArrowDown":
      e.preventDefault();
      selectedSuggestionIndex =
        (selectedSuggestionIndex + 1) % currentSuggestions.length;
      break;
    case "ArrowUp":
      e.preventDefault();
      selectedSuggestionIndex =
        selectedSuggestionIndex === 0
          ? currentSuggestions.length - 1
          : selectedSuggestionIndex - 1;
      break;
    case "Enter":
    case "Tab":
      e.preventDefault();
      if (currentSuggestions[selectedSuggestionIndex]) {
        selectAISuggestion(currentSuggestions[selectedSuggestionIndex]);
      }
      break;
    case "Escape":
      e.preventDefault();
      showAISuggestions = false;
      break;
  }
}

// Character count
$: characterCount = editor?.storage.characterCount.words() || 0;
let characterCount: number;
</script>

<svelte:window on:keydown={handleSuggestionKeydown} />

<div class="notion-editor-wrapper relative">
  <!-- Toolbar -->
  <div
    class="editor-toolbar sticky top-0 z-10 flex items-center gap-2 border-b border-gray-200 bg-white p-2"
  >
    <!-- Text formatting -->
    <div class="flex items-center gap-1 border-r border-gray-200 p-1">
      <button
        onclick={() => formatText('bold')}
        class="toolbar-btn"
        title="Bold"
      >
        <strong>B</strong>
      </button>
      <button
        onclick={() => formatText('italic')}
        class="toolbar-btn"
        title="Italic"
      >
        <em>I</em>
      </button>
      <button
        onclick={() => formatText('strike')}
        class="toolbar-btn"
        title="Strikethrough"
      >
        <s>S</s>
      </button>
      <button
        onclick={() => formatText('code')}
        class="toolbar-btn"
        title="Code"
      >
        <code>{"</>"}</code>
      </button>
    </div>

    <!-- Heading levels -->
    <div class="flex items-center gap-1 border-r border-gray-200 p-1">
      <button
        onclick={() => formatText('heading', { level: 1 })}
        class="toolbar-btn"
        title="Heading 1"
      >
        H1
      </button>
      <button
        onclick={() => formatText('heading', { level: 2 })}
        class="toolbar-btn"
        title="Heading 2"
      >
        H2
      </button>
      <button
        onclick={() => formatText('heading', { level: 3 })}
        class="toolbar-btn"
        title="Heading 3"
      >
        H3
      </button>
      <button
        onclick={() => formatText('paragraph')}
        class="toolbar-btn"
        title="Paragraph"
      >
        P
      </button>
    </div>

    <!-- Lists -->
    <div class="flex items-center gap-1 border-r border-gray-200 p-1">
      <button
        onclick={() => formatText('bulletList')}
        class="toolbar-btn"
        title="Bullet List"
      >
        •
      </button>
      <button
        onclick={() => formatText('orderedList')}
        class="toolbar-btn"
        title="Numbered List"
      >
        1.
      </button>
      <button
        onclick={() => formatText('taskList')}
        class="toolbar-btn"
        title="Task List"
      >
        ☐
      </button>
    </div>

    <!-- Insert -->
    <div class="flex items-center gap-1 border-r border-gray-200 p-1">
      <button
        onclick={() => formatText('codeBlock')}
        class="toolbar-btn"
        title="Code Block"
      >
        {"</>"}
      </button>
      <button
        onclick={() => formatText('blockquote')}
        class="toolbar-btn"
        title="Quote"
      >
        {"</quote>"}
      </button>
      <button
        onclick={() => formatText('horizontalRule')}
        class="toolbar-btn"
        title="Horizontal Rule"
      >
        —
      </button>
      <button
        onclick={() => formatText('table')}
        class="toolbar-btn"
        title="Table"
      >
        ⊞
      </button>
    </div>

    <!-- History -->
    <div class="flex items-center gap-1 p-1">
      <button
        onclick={() => formatText('undo')}
        class="toolbar-btn"
        title="Undo"
      >
        ↶
      </button>
      <button
        onclick={() => formatText('redo')}
        class="toolbar-btn"
        title="Redo"
      >
        ↷
      </button>
    </div>

    <!-- AI Assist -->
    <div class="ml-auto flex items-center gap-1 p-1">
      <button
        onclick={() => onSendToAI(editor?.getHTML() || '', extractContext())}
        class="toolbar-btn bg-blue-500 text-white hover:bg-blue-600"
        title="Send to AI"
      >
        🤖 AI Assist
      </button>
    </div>

    <!-- Character count -->
    <div class="ml-2 text-sm text-gray-500">
      {characterCount} words
    </div>
  </div>

  <!-- Main Editor -->
  <div class="editor-container relative">
    <!-- Drag overlay -->
    {#if isDraggingOver}
      <div
        class="drag-overlay absolute inset-0 z-20 flex items-center justify-center rounded-lg border-2 border-dashed border-blue-300 bg-blue-50"
      >
        <div class="text-center">
          <div class="mb-2 text-4xl">📁</div>
          <div class="text-lg font-medium text-blue-900">Drop files here</div>
          <div class="text-sm text-blue-700">
            Images, text files, and documents are supported
          </div>
        </div>
      </div>
    {/if}

    <!-- Editor -->
    <div
      class="editor-content min-h-[500px] p-6"
      bind:this={editorElement}
    ></div>

    <!-- Bubble Menu (will be positioned by Tiptap) -->
    <div
      class="bubble-menu"
      bind:this={bubbleMenuElement}
      style="position: absolute; display: none;"
    ></div>

    <!-- Floating Menu (will be positioned by Tiptap) -->
    <div
      class="floating-menu"
      bind:this={floatingMenuElement}
      style="position: absolute; display: none;"
    ></div>

    <!-- AI Suggestions -->
    {#if showAISuggestions}
      <div
        class="ai-suggestions absolute right-4 bottom-4 z-10 w-64 rounded-lg border border-gray-200 bg-white p-2 shadow-lg"
      >
        <div class="mb-2 text-sm font-medium text-gray-700">AI Suggestions</div>
        {#each currentSuggestions as suggestion, index}
          <button
            class="flex w-full items-center gap-2 rounded p-2 text-left hover:bg-gray-100 {index === selectedSuggestionIndex ? 'bg-blue-50 text-blue-700' : ''}"
            onclick={() => selectAISuggestion(suggestion)}
          >
            <span class="text-lg">{suggestion.icon}</span>
            <div class="flex-1">
              <div class="text-sm font-medium">{suggestion.title}</div>
              <div class="text-xs text-gray-500">{suggestion.description}</div>
            </div>
          </button>
        {/each}
        <div class="mt-2 px-2 text-xs text-gray-400">
          Use ↑↓ to navigate, Enter to select, Esc to close
        </div>
      </div>
    {/if}
  </div>

  <!-- Export options -->
  <div
    class="export-options flex gap-2 border-t border-gray-200 bg-gray-50 p-2"
  >
    <button
      onclick={() => navigator.clipboard.writeText(exportAsMarkdown())}
      class="rounded border border-gray-300 bg-white px-3 py-1 text-sm hover:bg-gray-50"
    >
      Copy Markdown
    </button>
    <button
      onclick={() => navigator.clipboard.writeText(exportAsHTML())}
      class="rounded border border-gray-300 bg-white px-3 py-1 text-sm hover:bg-gray-50"
    >
      Copy HTML
    </button>
    <button
      onclick={() => navigator.clipboard.writeText(exportAsJSON())}
      class="rounded border border-gray-300 bg-white px-3 py-1 text-sm hover:bg-gray-50"
    >
      Copy JSON
    </button>
  </div>
</div>

<style>
:global(.ProseMirror) {
  outline: none;
  padding: 0;
  line-height: 1.6;
  font-size: 16px;
  color: #374151;
}

:global(.ProseMirror h1) {
  font-size: 2.5em;
  font-weight: 700;
  margin: 0.5em 0;
  line-height: 1.2;
  color: #111827;
}

:global(.ProseMirror h2) {
  font-size: 2em;
  font-weight: 600;
  margin: 0.5em 0;
  line-height: 1.3;
  color: #111827;
}

:global(.ProseMirror h3) {
  font-size: 1.5em;
  font-weight: 600;
  margin: 0.5em 0;
  line-height: 1.4;
  color: #111827;
}

:global(.ProseMirror p) {
  margin: 0 0 1em 0;
}

:global(.ProseMirror ul, .ProseMirror ol) {
  margin: 0 0 1em 0;
  padding-left: 1.5em;
}

:global(.ProseMirror li) {
  margin: 0.25em 0;
}

:global(.ProseMirror[data-type="taskList"] li[data-checked="true"]) {
  text-decoration: line-through;
  color: #9ca3af;
}

:global(.ProseMirror pre) {
  background: #1e293b;
  color: #e2e8f0;
  border-radius: 0.5em;
  padding: 1em;
  margin: 1em 0;
  overflow-x: auto;
  font-family: "Monaco", "Menlo", "Ubuntu Mono", monospace;
}

:global(.ProseMirror code) {
  background: #f3f4f6;
  padding: 0.125em 0.25em;
  border-radius: 0.25em;
  font-family: "Monaco", "Menlo", "Ubuntu Mono", monospace;
  font-size: 0.875em;
}

:global(.ProseMirror blockquote) {
  border-left: 4px solid #e5e7eb;
  padding-left: 1em;
  margin: 1em 0;
  color: #6b7280;
}

:global(.ProseMirror hr) {
  border: none;
  border-top: 2px solid #e5e7eb;
  margin: 2em 0;
}

:global(.ProseMirror table) {
  border-collapse: collapse;
  margin: 1em 0;
  width: 100%;
}

:global(.ProseMirror th, .ProseMirror td) {
  border: 1px solid #e5e7eb;
  padding: 0.5em;
  text-align: left;
}

:global(.ProseMirror th) {
  background: #f9fafb;
  font-weight: 600;
}

:global(.ProseMirror a) {
  color: #3b82f6;
  text-decoration: underline;
}

:global(.ProseMirror a:hover) {
  color: #2563eb;
}

/* Mention styling */
:global([data-mention-type="app"]) {
  background: #dbeafe;
  color: #1e40af;
  padding: 0.125em 0.25em;
  border-radius: 0.25em;
  font-weight: 500;
}

:global([data-mention-type="file"]) {
  background: #d1fae5;
  color: #065f46;
  padding: 0.125em 0.25em;
  border-radius: 0.25em;
  font-weight: 500;
}

/* Bubble Menu */
:global(.bubble-menu) {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 0.5em;
  padding: 0.5em;
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1);
  display: flex;
  gap: 0.25em;
}

:global(.bubble-menu button) {
  background: transparent;
  border: none;
  padding: 0.5em;
  border-radius: 0.25em;
  cursor: pointer;
  transition: background-color 0.2s;
}

:global(.bubble-menu button:hover) {
  background: #f3f4f6;
}

/* Floating Menu */
:global(.floating-menu) {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 0.5em;
  padding: 0.5em;
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1);
  min-width: 200px;
}

:global(.floating-menu button) {
  background: transparent;
  border: none;
  padding: 0.5em;
  border-radius: 0.25em;
  cursor: pointer;
  transition: background-color 0.2s;
  text-align: left;
  width: 100%;
  display: flex;
  align-items: center;
  gap: 0.5em;
}

:global(.floating-menu button:hover) {
  background: #f3f4f6;
}

/* Toolbar */
.toolbar-btn {
  background: white;
  border: 1px solid #d1d5db;
  border-radius: 0.25rem;
  padding: 0.25rem 0.5rem;
  cursor: pointer;
  transition: all 0.2s;
  color: #374151;
  font-size: 0.875rem;
}

.toolbar-btn:hover {
  background: #f9fafb;
  border-color: #9ca3af;
}

.editor-content {
  position: relative;
  background: white;
  border-radius: 0.5rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.drag-overlay {
  background: rgba(59, 130, 246, 0.05);
  backdrop-filter: blur(2px);
}

.ai-suggestions {
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
}
</style>
