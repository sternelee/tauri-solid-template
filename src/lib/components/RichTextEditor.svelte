<script lang="ts">
import { onMount, createEventDispatcher } from "svelte";
import type { MentionItem } from "$lib/types";

export let content = "";
export let placeholder = "Start typing...";
export let mentionSuggestions: MentionItem[] = [];

const dispatch = createEventDispatcher();
let editorRef: HTMLDivElement;
let isComposing = false;

onMount(() => {
  setupEditor();
});

function setupEditor() {
  if (!editorRef) return;

  // Handle input events
  editorRef.addEventListener("input", handleInput);
  editorRef.addEventListener("keydown", handleKeydown);
  editorRef.addEventListener("paste", handlePaste);

  // Handle selection changes for mentions
  document.addEventListener("selectionchange", handleSelectionChange);
}

function handleInput(e: Event) {
  const target = e.target as HTMLDivElement;
  content = target.innerHTML;
  dispatch("change", content);

  // Check for mentions
  checkForMentions(target);
}

function handleKeydown(e: KeyboardEvent) {
  const target = e.target as HTMLDivElement;

  // Handle Enter key
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    document.execCommand("insertLineBreak");
  }

  // Handle Tab key
  if (e.key === "Tab") {
    e.preventDefault();
    document.execCommand(e.shiftKey ? "outdent" : "indent");
  }

  // Handle @ for mentions
  if (e.key === "@") {
    // This will be handled by the input handler
  }
}

function handlePaste(e: ClipboardEvent) {
  e.preventDefault();
  const text = e.clipboardData?.getData("text/plain");
  if (text) {
    document.execCommand("insertText", false, text);
  }
}

function handleSelectionChange() {
  // Handle selection changes if needed
}

function checkForMentions(editor: HTMLDivElement) {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return;

  const range = selection.getRangeAt(0);
  const textContent = editor.textContent || "";
  const cursorPos = range.startOffset;

  // Look for @ mentions
  const atIndex = textContent.lastIndexOf("@", cursorPos);
  if (atIndex !== -1) {
    const spaceIndex = textContent.indexOf(" ", atIndex);
    if (spaceIndex === -1 || spaceIndex > cursorPos) {
      const query = textContent.slice(atIndex + 1, cursorPos);
      if (query.length > 0) {
        dispatch("mentionQuery", query);
        return;
      }
    }
  }

  // Look for # mentions
  const hashIndex = textContent.lastIndexOf("#", cursorPos);
  if (hashIndex !== -1) {
    const spaceIndex = textContent.indexOf(" ", hashIndex);
    if (spaceIndex === -1 || spaceIndex > cursorPos) {
      const query = textContent.slice(hashIndex + 1, cursorPos);
      if (query.length > 0) {
        dispatch("fileQuery", query);
        return;
      }
    }
  }

  dispatch("clearMentions");
}

function insertMention(item: MentionItem) {
  if (!editorRef) return;

  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return;

  const range = selection.getRangeAt(0);
  const textContent = editorRef.textContent || "";
  const cursorPos = range.startOffset;

  // Find the mention start
  const mentionChar = item.type === "app" ? "@" : "#";
  const mentionStart = textContent.lastIndexOf(mentionChar, cursorPos);

  if (mentionStart !== -1) {
    // Create mention HTML
    const mentionHtml = `<span class="mention mention-${item.type}" data-type="${item.type}" data-id="${item.id}">${item.icon} ${item.title}</span> `;

    // Remove the incomplete mention and insert the complete one
    const beforeMention = textContent.slice(0, mentionStart);
    const afterMention = textContent.slice(cursorPos);

    editorRef.innerHTML = beforeMention + mentionHtml + afterMention;
    content = editorRef.innerHTML;

    // Dispatch change event
    dispatch("change", content);
    dispatch("mentionInserted", item);
  }
}

function formatText(command: string, value?: string) {
  document.execCommand(command, false, value);
  editorRef?.focus();
}

function insertLink(url: string) {
  const selection = window.getSelection();
  const selectedText = selection?.toString() || "";
  const linkHtml = `<a href="${url}" target="_blank">${selectedText || url}</a>`;
  document.execCommand("insertHTML", false, linkHtml);
}

function insertImage(src: string, alt: string = "") {
  const imgHtml = `<img src="${src}" alt="${alt}" style="max-width: 100%; height: auto;">`;
  document.execCommand("insertHTML", false, imgHtml);
}

function getContent() {
  return editorRef?.innerHTML || "";
}

function setContent(html: string) {
  if (editorRef) {
    editorRef.innerHTML = html;
  }
}

function focus() {
  editorRef?.focus();
}

function insertHtml(html: string) {
  if (editorRef) {
    document.execCommand("insertHTML", false, html);
  }
}

// Expose methods to parent
$: {
  if (editorRef && content !== editorRef.innerHTML) {
    editorRef.innerHTML = content;
  }
}

// Expose functions via bind:this
export {
  insertMention,
  formatText,
  insertLink,
  insertImage,
  insertHtml,
  getContent,
  setContent,
  focus,
};

function execCommand(cmd: string, value?: string) {
  document.execCommand(cmd, false, value);
  editorRef?.focus();
}
</script>

<div class="rich-text-editor">
  <!-- Toolbar -->
  <div
    class="toolbar flex items-center gap-2 border-b border-white/10 bg-gray-800/50 p-2"
  >
    <button
      on:click={() => execCommand('bold')}
      class="toolbar-btn"
      title="Bold"
    >
      <strong>B</strong>
    </button>

    <button
      on:click={() => execCommand('italic')}
      class="toolbar-btn"
      title="Italic"
    >
      <em>I</em>
    </button>

    <button
      on:click={() => execCommand('underline')}
      class="toolbar-btn"
      title="Underline"
    >
      <u>U</u>
    </button>

    <div class="h-6 w-px bg-white/20"></div>

    <button
      on:click={() => execCommand('formatBlock', 'h1')}
      class="toolbar-btn"
      title="Heading 1"
    >
      H1
    </button>

    <button
      on:click={() => execCommand('formatBlock', 'h2')}
      class="toolbar-btn"
      title="Heading 2"
    >
      H2
    </button>

    <div class="h-6 w-px bg-white/20"></div>

    <button
      on:click={() => execCommand('insertUnorderedList')}
      class="toolbar-btn"
      title="Bullet List"
    >
      •
    </button>

    <button
      on:click={() => execCommand('insertOrderedList')}
      class="toolbar-btn"
      title="Numbered List"
    >
      1.
    </button>

    <div class="h-6 w-px bg-white/20"></div>

    <button
      on:click={() => execCommand('insertHorizontalRule')}
      class="toolbar-btn"
      title="Horizontal Rule"
    >
      —
    </button>
  </div>

  <!-- Editor -->
  <div
    bind:this={editorRef}
    contenteditable="true"
    class="editor-content"
    style="min-height: 400px; padding: 1rem; outline: none;"
    placeholder={placeholder}
    role="textbox"
    aria-multiline="true"
  ></div>
</div>

<style>
.rich-text-editor {
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 0.5rem;
  overflow: hidden;
  background: rgba(0, 0, 0, 0.2);
}

.toolbar-btn {
  padding: 0.25rem 0.5rem;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 0.25rem;
  color: rgba(255, 255, 255, 0.8);
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.2s;
}

.toolbar-btn:hover {
  background: rgba(255, 255, 255, 0.2);
  color: white;
}

.toolbar-btn:active {
  background: rgba(255, 255, 255, 0.3);
}

.editor-content {
  color: rgba(255, 255, 255, 0.8);
  line-height: 1.6;
}

.editor-content:empty:before {
  content: attr(placeholder);
  color: rgba(255, 255, 255, 0.4);
}

/* Mention styling */
:global(.mention) {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.125rem 0.5rem;
  border-radius: 9999px;
  font-size: 0.875rem;
  font-weight: 500;
  background: rgba(59, 130, 246, 0.2);
  border: 1px solid rgba(59, 130, 246, 0.3);
  color: rgb(147, 197, 253);
}

:global(.mention-app) {
  background: rgba(59, 130, 246, 0.2);
  border-color: rgba(59, 130, 246, 0.3);
  color: rgb(147, 197, 253);
}

:global(.mention-file) {
  background: rgba(34, 197, 94, 0.2);
  border-color: rgba(34, 197, 94, 0.3);
  color: rgb(134, 239, 172);
}

:global(.mention-provider) {
  background: rgba(168, 85, 247, 0.2);
  border-color: rgba(168, 85, 247, 0.3);
  color: rgb(196, 181, 253);
}

/* Basic text styling in editor */
:global(.editor-content h1) {
  font-size: 1.875rem;
  font-weight: bold;
  margin: 1rem 0;
  color: rgba(255, 255, 255, 0.9);
}

:global(.editor-content h2) {
  font-size: 1.5rem;
  font-weight: bold;
  margin: 0.75rem 0;
  color: rgba(255, 255, 255, 0.9);
}

:global(.editor-content ul) {
  margin-left: 1.5rem;
  list-style-type: disc;
}

:global(.editor-content ol) {
  margin-left: 1.5rem;
  list-style-type: decimal;
}

:global(.editor-content li) {
  margin: 0.25rem 0;
}

:global(.editor-content a) {
  color: rgb(96, 165, 250);
  text-decoration: underline;
}

:global(.editor-content a:hover) {
  color: rgb(147, 197, 253);
}

:global(.editor-content hr) {
  border: none;
  border-top: 1px solid rgba(255, 255, 255, 0.2);
  margin: 1rem 0;
}
</style>

