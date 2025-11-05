<script lang="ts">
import { onMount, onDestroy, createEventDispatcher } from "svelte";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { Suggestion } from "@tiptap/suggestion";
import CharacterCount from "@tiptap/extension-character-count";
import Placeholder from "@tiptap/extension-placeholder";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import Table from "@tiptap/extension-table";
import TableHeader from "@tiptap/extension-table-header";
import TableCell from "@tiptap/extension-table-cell";
import TableRow from "@tiptap/extension-table-row";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import HorizontalRule from "@tiptap/extension-horizontal-rule";
import BubbleMenu from "@tiptap/extension-bubble-menu";
import FloatingMenu from "@tiptap/extension-floating-menu";
import Youtube from "@tiptap/extension-youtube";
import { MathExtension } from "@aarkue/tiptap-math-extension";
import { createLowlight } from "lowlight";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { ChatMessage, AIProvider } from "$lib/types";

const dispatch = createEventDispatcher();

let {
  content = $bindable(""),
  placeholder = "Start writing...",
  aiSuggestions = [],
  onContentChange = () => {},
  onSendToAI = () => {},
} = $props();

// Editor state
let editor: Editor | null = $state(null);
let editorElement: HTMLDivElement;
let bubbleMenuElement: HTMLDivElement;
let floatingMenuElement: HTMLDivElement;
let isEditorReady = $state(false);

// Create lowlight instance
const lowlight = createLowlight();

// Slash Command suggestions
const slashCommands = [
  {
    title: "Heading 1",
    description: "大标题",
    icon: "H1",
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setHeading({ level: 1 }).run();
    },
  },
  {
    title: "Heading 2",
    description: "中标题",
    icon: "H2",
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setHeading({ level: 2 }).run();
    },
  },
  {
    title: "Heading 3",
    description: "小标题",
    icon: "H3",
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setHeading({ level: 3 }).run();
    },
  },
  {
    title: "文本",
    description: "普通文本",
    icon: "P",
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setParagraph().run();
    },
  },
  {
    title: "无序列表",
    description: "创建无序列表",
    icon: "•",
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleBulletList().run();
    },
  },
  {
    title: "有序列表",
    description: "创建有序列表",
    icon: "1.",
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleOrderedList().run();
    },
  },
  {
    title: "任务列表",
    description: "创建任务清单",
    icon: "☐",
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleTaskList().run();
    },
  },
  {
    title: "代码块",
    description: "插入代码块",
    icon: "</>",
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleCodeBlock().run();
    },
  },
  {
    title: "引用",
    description: "添加引用块",
    icon: ">",
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleBlockquote().run();
    },
  },
  {
    title: "分割线",
    description: "插入分割线",
    icon: "---",
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setHorizontalRule().run();
    },
  },
  {
    title: "表格",
    description: "插入表格",
    icon: "⊞",
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
    },
  },
  {
    title: "图片",
    description: "插入图片",
    icon: "🖼️",
    command: ({ editor, range }) => {
      const url = prompt("请输入图片 URL:");
      if (url) {
        editor.chain().focus().deleteRange(range).setImage({ src: url }).run();
      }
    },
  },
  {
    title: "链接",
    description: "插入链接",
    icon: "🔗",
    command: ({ editor, range }) => {
      const url = prompt("请输入链接 URL:");
      if (url) {
        editor.chain().focus().deleteRange(range).setLink({ href: url }).run();
      }
    },
  },
  {
    title: "YouTube",
    description: "插入YouTube视频",
    icon: "📺",
    command: ({ editor, range }) => {
      const url = prompt("请输入YouTube视频URL:");
      if (url) {
        editor.chain().focus().deleteRange(range).setYouTubeVideo({ src: url }).run();
      }
    },
  },
  {
    title: "数学公式",
    description: "插入LaTeX数学公式",
    icon: "∑",
    command: ({ editor, range }) => {
      const formula = prompt("请输入LaTeX数学公式:");
      if (formula) {
        editor.chain().focus().deleteRange(range).setMath({ latex: formula }).run();
      }
    },
  },
];

// Simple Slash Menu Renderer
class SlashMenuRenderer {
  constructor() {
    this.suggestion = null;
    this.index = 0;
    this.element = document.createElement("div");
    this.element.className = "slash-menu";
    this.element.style.cssText = `
      position: absolute;
      background: white;
      border: 1px solid #e5e5e5;
      border-radius: 8px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      max-width: 300px;
      z-index: 1000;
      padding: 8px 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
    `;
  }

  update() {
    if (!this.props || !this.props.items || this.props.items.length === 0) {
      this.element.style.display = "none";
      return;
    }

    this.element.style.display = "block";
    this.element.innerHTML = "";

    this.props.items.forEach((item, index) => {
      const itemEl = document.createElement("div");
      itemEl.className = "slash-menu-item";
      itemEl.style.cssText = `
        padding: 8px 16px;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 12px;
        transition: background-color 0.15s;
      `;

      if (index === this.index) {
        itemEl.style.backgroundColor = "#f3f4f6";
      }

      const iconEl = document.createElement("span");
      iconEl.textContent = item.icon;
      iconEl.style.cssText = `
        font-weight: bold;
        font-size: 12px;
        width: 20px;
        text-align: center;
      `;

      const contentEl = document.createElement("div");
      contentEl.style.cssText = `
        flex: 1;
      `;

      const titleEl = document.createElement("div");
      titleEl.textContent = item.title;
      titleEl.style.cssText = `
        font-weight: 500;
        color: #1f2937;
      `;

      const descEl = document.createElement("div");
      descEl.textContent = item.description;
      descEl.style.cssText = `
        font-size: 12px;
        color: #6b7280;
        margin-top: 2px;
      `;

      contentEl.appendChild(titleEl);
      contentEl.appendChild(descEl);
      itemEl.appendChild(iconEl);
      itemEl.appendChild(contentEl);

      itemEl.addEventListener("mouseenter", () => {
        this.index = index;
        this.update();
      });

      itemEl.addEventListener("click", () => {
        this.select();
      });

      this.element.appendChild(itemEl);
    });

    // Position the menu
    const coords = this.props.clientRect();
    this.element.style.left = `${coords.left}px`;
    this.element.style.top = `${coords.bottom + window.scrollY}px`;
  }

  up() {
    this.index = Math.max(0, this.index - 1);
    this.update();
  }

  down() {
    this.index = Math.min(this.props.items.length - 1, this.index + 1);
    this.update();
  }

  select() {
    if (this.props.items[this.index]) {
      this.props.items[this.index].command({
        editor: this.props.editor,
        range: this.props.range,
      });
    }
  }
}

// Native UI state
let isFocused = $state(false);
let isMac = $state(false);
let selectionInfo = $state({ from: 0, to: 0, text: "" });
let showCharacterCount = $state(false);
let isDarkMode = $state(false);

// File drag state
let isDraggingOver = $state(false);
let draggedFiles: File[] = $state([]);
let dragCounter = $state(0);

// AI suggestions state
let showAISuggestions = $state(false);
let currentSuggestions: any[] = $state([]);
let selectedSuggestionIndex = $state(0);

// Command palette state
let showCommandPalette = $state(false);
let commandPaletteQuery = $state("");
let filteredCommands = $state([]);

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

// Command palette commands
const commands = [
  {
    title: "Bold",
    icon: "B",
    shortcut: "⌘B",
    action: () => formatText("bold"),
  },
  {
    title: "Italic",
    icon: "I",
    shortcut: "⌘I",
    action: () => formatText("italic"),
  },
  {
    title: "Heading 1",
    icon: "H1",
    shortcut: "⌘⌥1",
    action: () => formatText("heading", { level: 1 }),
  },
  {
    title: "Heading 2",
    icon: "H2",
    shortcut: "⌘⌥2",
    action: () => formatText("heading", { level: 2 }),
  },
  {
    title: "Bullet List",
    icon: "•",
    shortcut: "⌘⇧8",
    action: () => formatText("bulletList"),
  },
  {
    title: "Numbered List",
    icon: "1.",
    shortcut: "⌘⇧7",
    action: () => formatText("orderedList"),
  },
  {
    title: "Code Block",
    icon: "</>",
    shortcut: "⌘⌥C",
    action: () => formatText("codeBlock"),
  },
  {
    title: "Insert Link",
    icon: "🔗",
    shortcut: "⌘K",
    action: () => insertLink(),
  },
  {
    title: "Insert Table",
    icon: "⊞",
    shortcut: "⌘⌥T",
    action: () => formatText("table"),
  },
  {
    title: "AI Assistant",
    icon: "🤖",
    shortcut: "⌘⌥A",
    action: () => onSendToAI(editor?.getHTML() || "", extractContext()),
  },
  {
    title: "Export Markdown",
    icon: "📄",
    shortcut: "⌘⌥E",
    action: () => copyMarkdown(),
  },
  {
    title: "Toggle Focus Mode",
    icon: "🎯",
    shortcut: "⌘⌥F",
    action: () => toggleFocusMode(),
  },
];

onMount(async () => {
  // Detect platform
  isMac = navigator.userAgent.includes("Mac");

  // Initialize editor
  initializeEditor();
  setupFileDragDrop();
  setupKeyboardShortcuts();

  // Listen for system theme changes
  if (window.matchMedia) {
    const darkModeQuery = window.matchMedia("(prefers-color-scheme: dark)");
    isDarkMode = darkModeQuery.matches;
    darkModeQuery.addEventListener("change", (e) => {
      isDarkMode = e.matches;
    });
  }

  // Listen for native menu events
  await setupNativeMenuListeners();
});

onDestroy(() => {
  editor?.destroy();
});

function initializeEditor() {
  try {
    editor = new Editor({
      element: editorElement,
      extensions: [
        StarterKit,
        Link.configure({
          openOnClick: false,
          autolink: true,
          linkOnPaste: true,
          HTMLAttributes: {
            class: "text-blue-600 hover:text-blue-800 underline",
          },
        }),
        Image.configure({
          HTMLAttributes: {
            class: "max-w-full h-auto rounded-lg shadow-sm",
          },
        }),
        Table.configure({
          resizable: true,
          allowTableNodeSelection: true,
          HTMLAttributes: {
            class: "border-collapse border border-gray-300 rounded-lg overflow-hidden",
          },
        }),
        TableHeader,
        TableCell.configure({
          HTMLAttributes: {
            class: "border border-gray-300 px-4 py-3 text-left",
          },
        }),
        TableRow.configure({
          HTMLAttributes: {
            class: "border-b border-gray-300",
          },
        }),
        TaskList,
        TaskItem.configure({
          HTMLAttributes: {
            class: "flex items-start my-1",
          },
        }),
        CodeBlockLowlight.configure({
          lowlight,
          defaultLanguage: "plaintext",
          HTMLAttributes: {
            class: "bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto font-mono text-sm",
          },
        }),
        HorizontalRule.configure({
          HTMLAttributes: {
            class: "border-t border-gray-300 my-8",
          },
        }),
        Placeholder.configure({
          placeholder: () => {
            if (isFocused) return "";
            return placeholder;
          },
        }),
        CharacterCount.configure({
          limit: 10000,
        }),
        Youtube.configure({
          controls: false,
          nocookie: true,
          HTMLAttributes: {
            class: "aspect-video w-full rounded-lg",
          },
        }),
        MathExtension,
        // Slash command suggestion
        Suggestion.configure({
          char: "/",
          command: ({ editor, range, props }) => {
            props.command({ editor, range });
          },
          items: ({ query }) => {
            return slashCommands
              .filter(item => item.title.toLowerCase().includes(query.toLowerCase()))
              .slice(0, 10);
          },
          render: () => {
            let component;
            let popup;

            return {
              onStart: props => {
                component = new SlashMenuRenderer();
                component.props = props;
                popup = props.editor.view.dom.appendChild(component.element);
              },
              onUpdate(props) {
                component.props = props;
                component.update();
              },
              onKeyDown(props) {
                if (props.event.key === 'Escape') {
                  popup.remove();
                  return true;
                }
                if (!component.suggestion) {
                  return false;
                }
                const navigationKeys = ["ArrowUp", "ArrowDown", "Enter"];
                if (navigationKeys.includes(props.event.key)) {
                  props.event.preventDefault();
                  if (props.event.key === "ArrowUp") {
                    component.up();
                  } else if (props.event.key === "ArrowDown") {
                    component.down();
                  } else if (props.event.key === "Enter") {
                    component.select();
                  }
                  return true;
                }
                return false;
              },
              onExit() {
                popup.remove();
              },
            };
          },
        }),
        // Bubble menu
        BubbleMenu.configure({
          element: bubbleMenuElement,
          shouldShow: ({ state }) => {
            const { selection } = state;
            const { empty } = selection;
            return !empty;
          },
        }),
        // Floating menu
        FloatingMenu.configure({
          element: floatingMenuElement,
          shouldShow: ({ state }) => {
            const { selection } = state;
            const { empty } = selection;
            return empty;
          },
        }),
      ],
      content: content || "<p>Start typing...</p>",
      editable: true,
      autofocus: false,
    });

    // Set up event listeners
    editor.on('update', () => {
      const newContent = editor.getHTML();
      content = newContent;
      onContentChange(newContent);
      dispatch("change", newContent);
    });

    editor.on('focus', () => {
      isFocused = true;
    });

    editor.on('blur', () => {
      isFocused = false;
    });

    isEditorReady = true;
    console.log('Editor initialized successfully');
  } catch (error) {
    console.error('Failed to initialize editor:', error);
  }
}

function updateSelectionInfo() {
  if (!editor) return;
  const { selection } = editor.state;
  selectionInfo = {
    from: selection.from,
    to: selection.to,
    text: editor.state.doc.textBetween(selection.from, selection.to),
  };
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

        // Handle command palette
        if (
          text === "/" &&
          (from === 0 ||
            view.state.doc.textBetween(from - 1, from).match(/\n|$/))
        ) {
          showCommandPalette = true;
          commandPaletteQuery = "";
          filteredCommands = commands;
          // Don't return false here, let the "/" be inserted normally
        }

        // Return false to let default handler process all other text input
        return false;
      },
    },
  };
}

function showMentionMenu(type: "app" | "file", from: number, to: number) {
  // This would integrate with your existing mention system
  return false;
}

function setupFileDragDrop() {
  if (!editorElement) return;

  editorElement.addEventListener("dragenter", handleDragEnter);
  editorElement.addEventListener("dragover", handleDragOver);
  editorElement.addEventListener("dragleave", handleDragLeave);
  editorElement.addEventListener("drop", handleDrop);
}

function handleDragEnter(e: DragEvent) {
  e.preventDefault();
  dragCounter++;
  isDraggingOver = true;
}

function handleDragOver(e: DragEvent) {
  e.preventDefault();
}

function handleDragLeave(e: DragEvent) {
  e.preventDefault();
  dragCounter--;
  if (dragCounter === 0) {
    isDraggingOver = false;
  }
}

async function handleDrop(e: DragEvent) {
  e.preventDefault();
  dragCounter = 0;
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

  // Handle video files
  if (fileType.startsWith("video/")) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      if (editor) {
        editor
          .chain()
          .focus()
          .insertContentAt(
            editor.state.selection.to,
            `<video src="${dataUrl}" controls class="w-full rounded-lg"></video>\n\n`,
          )
          .run();
      }
    };
    reader.readAsDataURL(file);
    return;
  }

  // Handle audio files
  if (fileType.startsWith("audio/")) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      if (editor) {
        editor
          .chain()
          .focus()
          .insertContentAt(
            editor.state.selection.to,
            `<audio src="${dataUrl}" controls class="w-full"></audio>\n\n`,
          )
          .run();
      }
    };
    reader.readAsDataURL(file);
    return;
  }

  // Handle text files
  if (
    fileType.startsWith("text/") ||
    fileName.endsWith(".md") ||
    fileName.endsWith(".txt") ||
    fileName.endsWith(".js") ||
    fileName.endsWith(".ts") ||
    fileName.endsWith(".py") ||
    fileName.endsWith(".java") ||
    fileName.endsWith(".cpp") ||
    fileName.endsWith(".c") ||
    fileName.endsWith(".go") ||
    fileName.endsWith(".rs") ||
    fileName.endsWith(".html") ||
    fileName.endsWith(".css") ||
    fileName.endsWith(".json") ||
    fileName.endsWith(".yaml") ||
    fileName.endsWith(".yml")
  ) {
    const text = await file.text();
    const language = getLanguageFromFileName(fileName);
    if (editor) {
      editor
        .chain()
        .focus()
        .insertContentAt(
          editor.state.selection.to,
          `\n\n### ${fileName}\n\n\`\`\`${language}\n${text}\n\`\`\`\n\n`,
        )
        .run();
    }
    return;
  }

  // Handle PDF files
  if (fileType === "application/pdf") {
    if (editor) {
      editor
        .chain()
        .focus()
        .insertContentAt(
          editor.state.selection.to,
          `\n\n📄 **PDF:** ${fileName} (${formatFileSize(file.size)})\n\n*PDF files cannot be displayed directly. Please use a PDF viewer.*\n\n`,
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
  // Temporarily disabled
  // markdownSerializer = new MarkdownSerializer();
}

function setupKeyboardShortcuts() {
  // Native keyboard shortcuts
  document.addEventListener("keydown", handleGlobalKeydown);
}

function handleGlobalKeydown(e: KeyboardEvent) {
  const isCmd = isMac ? e.metaKey : e.ctrlKey;
  const isAlt = e.altKey;
  const isShift = e.shiftKey;

  // Only handle shortcuts when editor is focused or when explicitly needed
  if (!isFocused && document.activeElement !== editorElement) return;

  // Basic text formatting shortcuts
  if (isCmd && !isAlt && !isShift) {
    switch (e.key) {
      case "b":
        e.preventDefault();
        formatText("bold");
        return;
      case "i":
        e.preventDefault();
        formatText("italic");
        return;
      case "k":
        e.preventDefault();
        insertLink();
        return;
      case "z":
        e.preventDefault();
        formatText("undo");
        return;
      case "y":
        e.preventDefault();
        formatText("redo");
        return;
    }
  }

  // Extended formatting with Alt
  if (isCmd && isAlt && !isShift) {
    switch (e.key) {
      case "1":
        e.preventDefault();
        formatText("heading", { level: 1 });
        return;
      case "2":
        e.preventDefault();
        formatText("heading", { level: 2 });
        return;
      case "3":
        e.preventDefault();
        formatText("heading", { level: 3 });
        return;
      case "c":
        e.preventDefault();
        formatText("codeBlock");
        return;
      case "t":
        e.preventDefault();
        formatText("table");
        return;
      case "a":
        e.preventDefault();
        onSendToAI(editor?.getHTML() || "", extractContext());
        return;
      case "e":
        e.preventDefault();
        copyMarkdown();
        return;
      case "f":
        e.preventDefault();
        toggleFocusMode();
        return;
      case "p":
        e.preventDefault();
        showCommandPalette = true;
        commandPaletteQuery = "";
        filteredCommands = commands;
        return;
    }
  }

  // List shortcuts with Shift
  if (isCmd && isShift && !isAlt) {
    switch (e.key) {
      case "8":
        e.preventDefault();
        formatText("bulletList");
        return;
      case "7":
        e.preventDefault();
        formatText("orderedList");
        return;
      case "9":
        e.preventDefault();
        formatText("taskList");
        return;
      case "z":
        e.preventDefault();
        formatText("redo");
        return;
    }
  }

  // Undo/Redo handling
  if (isCmd && !isAlt && isShift && e.key === "z") {
    e.preventDefault();
    formatText("redo");
    return;
  }
}

async function setupNativeMenuListeners() {
  // Listen for native menu events from Tauri
  if (window.__TAURI__) {
    await listen("menu-new", () => {
      if (confirm("Create a new document? Current changes will be lost.")) {
        editor?.commands.clearContent();
      }
    });

    await listen("menu-save", () => {
      const markdown = exportAsMarkdown();
      // This would trigger a save dialog
      console.log("Saving content:", markdown);
    });

    await listen("menu-export", () => {
      copyMarkdown();
    });
  }
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
  console.log("Improving text:", text);
}

async function summarizeText(text: string) {
  console.log("Summarizing text:", text);
}

async function expandText(text: string) {
  console.log("Expanding text:", text);
}

async function continueWriting(text: string) {
  console.log("Continuing text:", text);
}

async function translateText(text: string) {
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

function insertLink() {
  if (!editor) return;

  const url = prompt("Enter URL:");
  if (url) {
    editor.chain().focus().setLink({ href: url }).run();
  }
}

function copyMarkdown() {
  const markdown = exportAsMarkdown();
  navigator.clipboard.writeText(markdown);
  // Show native notification if available
  if (window.__TAURI__) {
    // Would show native notification
    console.log("Markdown copied to clipboard");
  }
}

function toggleFocusMode() {
  // This would implement a focus mode with minimal UI
  showCharacterCount = !showCharacterCount;
}

// Export/Import functions
function exportAsMarkdown(): string {
  if (!editor) return "";
  // Simplified HTML to markdown conversion
  return editor
    .getHTML()
    .replace(/<h1[^>]*>(.*?)<\/h1>/g, "# $1\n\n")
    .replace(/<h2[^>]*>(.*?)<\/h2>/g, "## $1\n\n")
    .replace(/<strong[^>]*>(.*?)<\/strong>/g, "**$1**")
    .replace(/<p[^>]*>(.*?)<\/p>/g, "$1\n\n")
    .replace(/<br[^>]*>/g, "\n")
    .replace(/<[^>]*>/g, "");
}

function exportAsHTML(): string {
  if (!editor) return "";
  return editor.getHTML();
}

function exportAsJSON(): string {
  if (!editor) return "";
  return JSON.stringify(editor.getJSON(), null, 2);
}

// Command palette
function handleCommandPaletteKeydown(e: KeyboardEvent) {
  if (!showCommandPalette) return;

  switch (e.key) {
    case "ArrowDown":
      e.preventDefault();
      // Navigate down
      break;
    case "ArrowUp":
      e.preventDefault();
      // Navigate up
      break;
    case "Enter":
      e.preventDefault();
      if (filteredCommands.length > 0) {
        filteredCommands[0].action();
      }
      showCommandPalette = false;
      break;
    case "Escape":
      e.preventDefault();
      showCommandPalette = false;
      break;
  }
}


// Command palette filtering
$effect(() => {
  if (commandPaletteQuery) {
    filteredCommands = commands.filter((cmd) =>
      cmd.title.toLowerCase().includes(commandPaletteQuery.toLowerCase()),
    );
  } else {
    filteredCommands = commands;
  }
});

// Character count derived values
const characterCount = $derived(
  () => editor?.storage.characterCount.words() || 0,
);
const characterCountTotal = $derived(
  () => editor?.storage.characterCount.characters() || 0,
);
</script>

<svelte:window on:keydown={handleCommandPaletteKeydown} />

<div
  class="native-editor-wrapper"
  class:dark-mode={isDarkMode}
  class:focused={isFocused}
>
  <!-- Main Editor -->
  <div class="editor-container" class:dragging={isDraggingOver}>
    <!-- Drag overlay -->
    {#if isDraggingOver}
      <div class="drag-overlay">
        <div class="drag-content">
          <div class="drag-icon">📁</div>
          <div class="drag-title">Drop files here</div>
          <div class="drag-subtitle">
            Images, text files, and documents supported
          </div>
        </div>
      </div>
    {/if}

    <!-- Editor -->
    <div
      class="editor-content"
      bind:this={editorElement}
      class:focused={isFocused}
    ></div>

    <!-- Bubble Menu (will be positioned by Tiptap) -->
    <div class="bubble-menu" bind:this={bubbleMenuElement}></div>

    <!-- Floating Menu (will be positioned by Tiptap) -->
    <div class="floating-menu" bind:this={floatingMenuElement}></div>

    <!-- Floating Status Bar -->
    {#if showCharacterCount || isFocused}
      <div class="floating-status-bar">
        <div class="status-content">
          {#if showCharacterCount}
            <span class="status-item">
              {characterCount} words
            </span>
            <span class="status-item">
              {characterCountTotal} chars
            </span>
          {/if}
          {#if isFocused}
            <button
              onclick={() => onSendToAI(editor?.getHTML() || '', extractContext())}
              class="ai-assist-btn"
              title="AI Assistant (⌘⌥A)"
            >
              🤖
            </button>
          {/if}
        </div>
      </div>
    {/if}
  </div>

  <!-- Command Palette -->
  {#if showCommandPalette}
    <div
      class="command-palette-overlay"
      onclick={() => showCommandPalette = false}
    >
      <div class="command-palette" onclick={(e) => e.stopPropagation()}>
        <div class="command-palette-search">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            bind:value={commandPaletteQuery}
            placeholder="Type a command..."
            class="command-palette-input"
          />
        </div>
        <div class="command-palette-list">
          {#each filteredCommands as command}
            <button
              class="command-palette-item"
              onclick={() => { command.action(); showCommandPalette = false; }}
            >
              <span class="command-icon">{command.icon}</span>
              <span class="command-title">{command.title}</span>
              <span class="command-shortcut">{command.shortcut}</span>
            </button>
          {/each}
        </div>
      </div>
    </div>
  {/if}

  </div>

<style>
@reference "tailwindcss";
/* Native macOS styling */
.native-editor-wrapper {
  @apply flex h-full flex-col bg-[#f8f9fa];
  font-family:
    -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
}

.native-editor-wrapper.dark-mode {
  @apply bg-gray-900;
}

.editor-container {
  @apply relative flex-1 overflow-hidden;
}

.editor-content {
  @apply h-full w-full p-8 focus:outline-none;
  background: transparent;
  transition: all 0.3s ease;
  max-width: none;
  margin: 0 auto;
}

.editor-content.focused {
  @apply bg-white;
  box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.1);
}

/* Floating Status Bar */
.floating-status-bar {
  @apply fixed bottom-6 right-6 z-40;
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  animation: slideUp 0.3s ease;
}

.status-content {
  @apply flex items-center gap-3 rounded-lg bg-white/80 px-4 py-2 shadow-lg border border-gray-200/50;
}

.status-item {
  @apply rounded bg-gray-100/50 px-2 py-1 text-xs font-medium text-gray-600;
}

.ai-assist-btn {
  @apply flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-r from-blue-500 to-purple-500 text-white transition-all hover:from-blue-600 hover:to-purple-600;
  box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3);
}

.drag-overlay {
  @apply absolute inset-0 z-20 flex items-center justify-center rounded-lg border-2 border-dashed border-blue-300 bg-blue-50/80 backdrop-blur-sm;
  animation: fadeIn 0.2s ease;
}

.drag-content {
  @apply text-center;
}

.drag-icon {
  @apply mb-3 text-4xl opacity-70;
}

.drag-title {
  @apply mb-1 text-lg font-medium text-blue-900;
}

.drag-subtitle {
  @apply text-sm text-blue-700 opacity-80;
}

/* Command Palette */
.command-palette-overlay {
  @apply fixed inset-0 z-50 flex items-start justify-center bg-black/20 pt-[20vh] backdrop-blur-sm;
  animation: fadeIn 0.2s ease;
}

.command-palette {
  @apply w-full max-w-lg overflow-hidden rounded-xl bg-white shadow-2xl;
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  animation: scaleIn 0.3s cubic-bezier(0.2, 0, 0, 1);
  transform-origin: top center;
}

.command-palette-search {
  @apply flex items-center gap-3 border-b border-gray-200 px-4 py-3;
}

.command-palette-input {
  @apply flex-1 bg-transparent text-gray-900 placeholder-gray-500 outline-none;
}

.command-palette-list {
  @apply max-h-80 overflow-y-auto;
}

.command-palette-item {
  @apply flex w-full items-center gap-3 px-4 py-2 text-left transition-colors hover:bg-[#f8f9fa];
}

.command-palette-item:hover {
  @apply bg-blue-50 text-blue-700;
}

.command-icon {
  @apply flex h-6 w-6 items-center justify-center rounded bg-gray-100 text-sm font-medium;
}

.command-title {
  @apply flex-1 font-medium;
}

.command-shortcut {
  @apply font-mono text-xs text-gray-500;
}


/* ProseMirror styling - Notion-like */
:global(.ProseMirror) {
  @apply focus:outline-none;
  line-height: 1.75;
  font-size: 16px;
  color: #374151;
  padding: 0 !important;
  max-width: 100%;
}

:global(.ProseMirror p) {
  @apply mb-3 leading-relaxed;
  margin-bottom: 0.75rem;
}

:global(.ProseMirror h1) {
  @apply mt-8 mb-4 text-4xl leading-tight font-bold text-gray-900;
  margin-top: 2rem;
  line-height: 1.2;
}

:global(.ProseMirror h2) {
  @apply mt-6 mb-3 text-3xl leading-tight font-semibold text-gray-900;
  margin-top: 1.5rem;
  line-height: 1.3;
}

:global(.ProseMirror h3) {
  @apply mt-5 mb-3 text-2xl leading-tight font-semibold text-gray-900;
  margin-top: 1.25rem;
  line-height: 1.4;
}

:global(.ProseMirror h4) {
  @apply mt-4 mb-2 text-xl leading-tight font-medium text-gray-900;
  margin-top: 1rem;
}

:global(.ProseMirror h5) {
  @apply mt-3 mb-2 text-lg leading-tight font-medium text-gray-700;
}

:global(.ProseMirror h6) {
  @apply mt-3 mb-2 text-base leading-tight font-medium text-gray-600;
}

:global(.ProseMirror ul, .ProseMirror ol) {
  @apply mb-4 pl-6;
}

:global(.ProseMirror li) {
  @apply mb-2 leading-relaxed;
}

:global(.ProseMirror[data-type="taskList"] li[data-checked="true"]) {
  @apply text-gray-500 line-through;
}

:global(.ProseMirror pre) {
  @apply mb-6 overflow-x-auto rounded-xl bg-gray-900 p-4 text-gray-100 text-sm;
  font-family:
    "SF Mono", Monaco, "Cascadia Code", "Roboto Mono", Consolas, "Courier New",
    monospace;
  line-height: 1.5;
}

:global(.ProseMirror code) {
  @apply rounded-md bg-gray-100 px-1.5 py-0.5 text-sm text-gray-800 font-medium;
  font-family:
    "SF Mono", Monaco, "Cascadia Code", "Roboto Mono", Consolas, "Courier New",
    monospace;
}

:global(.ProseMirror blockquote) {
  @apply mb-4 border-l-2 border-gray-300 pl-4 text-gray-600 italic;
  background: linear-gradient(to right, rgba(156, 163, 175, 0.05), transparent);
}

:global(.ProseMirror hr) {
  @apply my-8 border-t border-gray-300;
  border-width: 1px;
}

:global(.ProseMirror table) {
  @apply mb-4 w-full border-collapse border border-gray-200 rounded-lg overflow-hidden;
}

:global(.ProseMirror th, .ProseMirror td) {
  @apply border border-gray-200 px-4 py-3 text-left;
}

:global(.ProseMirror th) {
  @apply bg-gray-50 font-semibold text-gray-900;
}

:global(.ProseMirror a) {
  @apply text-blue-600 underline transition-colors hover:text-blue-800;
  text-decoration-thickness: 1px;
  text-underline-offset: 2px;
}

/* Mention styling */
:global([data-mention-type="app"]) {
  @apply rounded-md bg-blue-100 px-1.5 py-0.5 text-sm font-medium text-blue-800;
}

:global([data-mention-type="file"]) {
  @apply rounded-md bg-green-100 px-1.5 py-0.5 text-sm font-medium text-green-800;
}

/* Dark mode */
.dark-mode :global(.ProseMirror) {
  @apply text-gray-100;
}

.dark-mode :global(.ProseMirror h1),
.dark-mode :global(.ProseMirror h2),
.dark-mode :global(.ProseMirror h3),
.dark-mode :global(.ProseMirror h4),
.dark-mode :global(.ProseMirror h5),
.dark-mode :global(.ProseMirror h6) {
  @apply text-gray-100;
}

.dark-mode :global(.ProseMirror code) {
  @apply bg-gray-800 text-gray-200;
}

.dark-mode :global(.ProseMirror blockquote) {
  @apply border-gray-600 text-gray-400;
  background: linear-gradient(to right, rgba(75, 85, 99, 0.2), transparent);
}

.dark-mode .status-content {
  @apply bg-gray-800/80 border-gray-700/50;
}

.dark-mode .status-item {
  @apply bg-gray-700/50 text-gray-300;
}

/* Enhanced Floating Elements Animations */
.ai-assist-btn {
  transition: all 0.15s cubic-bezier(0.2, 0, 0, 1);
  position: relative;
  overflow: hidden;
}

.ai-assist-btn::before {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: radial-gradient(
    circle,
    rgba(255, 255, 255, 0.2) 0%,
    transparent 70%
  );
  opacity: 0;
  transition: opacity 0.15s ease;
}

.ai-assist-btn:hover::before {
  opacity: 1;
}

.ai-assist-btn:active {
  transform: scale(0.95);
  transition: transform 0.08s cubic-bezier(0.2, 0, 0, 1);
}

.command-palette-item {
  transition: all 0.1s cubic-bezier(0.2, 0, 0, 1);
  position: relative;
  overflow: hidden;
}

.command-palette-item::before {
  content: "";
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(
    90deg,
    transparent,
    rgba(59, 130, 246, 0.1),
    transparent
  );
  transition: left 0.3s ease;
}

.command-palette-item:hover::before {
  left: 100%;
}

/* Enhanced focus states */
.editor-content:global(.ProseMirror-focused) {
  outline: none;
  box-shadow: inset 0 0 0 2px rgba(59, 130, 246, 0.3);
  border-radius: 8px;
  transition: box-shadow 0.2s ease;
}

/* Improved link interactions */
:global(.ProseMirror a) {
  position: relative;
  transition: all 0.15s ease;
}

:global(.ProseMirror a:hover) {
  color: #1d4ed8;
  text-decoration: underline;
  text-decoration-thickness: 1px;
  text-underline-offset: 3px;
}


/* Animations */
@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes bounce {
  0%,
  20%,
  50%,
  80%,
  100% {
    transform: translateY(0);
  }
  40% {
    transform: translateY(-8px);
  }
  60% {
    transform: translateY(-4px);
  }
}

@keyframes scaleIn {
  from {
    opacity: 0;
    transform: scale(0.95) translateY(-10px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.7;
  }
}

/* Custom scrollbar for dark mode */
.dark-mode .overflow-y-auto::-webkit-scrollbar {
  width: 8px;
}

.dark-mode .overflow-y-auto::-webkit-scrollbar-track {
  background: transparent;
}

.dark-mode .overflow-y-auto::-webkit-scrollbar-thumb {
  background-color: rgba(156, 163, 175, 0.3);
  border-radius: 4px;
}

.dark-mode .overflow-y-auto::-webkit-scrollbar-thumb:hover {
  background-color: rgba(156, 163, 175, 0.5);
}
</style>
