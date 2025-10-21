import { createSignal, Show, JSX } from "solid-js";
import {
  DetailProps,
  DetailMetadataProps,
  DetailMetadataLabelProps,
  DetailMetadataLinkProps,
  DetailMetadataTagListProps,
  DetailMetadataTagListItemProps,
  DetailMetadataSeparatorProps,
  ImageLike,
} from "../types";

// ============================================================================
// Detail Component
// ============================================================================

export function Detail(props: DetailProps): JSX.Element {
  const [isLoading, setIsLoading] = createSignal(props.isLoading || false);

  return (
    <div class="raycast-detail flex h-full bg-white dark:bg-gray-900">
      {/* Main Content Area */}
      <div class="raycast-detail-content flex-1 overflow-auto">
        <Show when={isLoading()}>
          <div class="flex h-full items-center justify-center">
            <div class="text-center">
              <div class="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600"></div>
              <p class="text-gray-500 dark:text-gray-400">Loading...</p>
            </div>
          </div>
        </Show>

        <Show when={!isLoading()}>
          <div class="raycast-detail-main p-6">
            {/* Navigation Title */}
            <Show when={props.navigationTitle}>
              <div class="raycast-detail-header mb-6">
                <h1 class="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {props.navigationTitle}
                </h1>
              </div>
            </Show>

            {/* Markdown Content */}
            <Show when={props.markdown}>
              <div class="raycast-detail-markdown prose dark:prose-invert mb-6 max-w-none">
                <MarkdownRenderer content={props.markdown!} />
              </div>
            </Show>

            {/* Custom Children */}
            <Show when={props.children}>
              <div class="raycast-detail-children">{props.children}</div>
            </Show>
          </div>
        </Show>
      </div>

      {/* Metadata Sidebar */}
      <Show when={props.metadata}>
        <div class="raycast-detail-sidebar w-80 flex-shrink-0 overflow-y-auto border-l border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800">
          <div class="p-4">{props.metadata}</div>
        </div>
      </Show>

      {/* Actions */}
      <Show when={props.actions}>
        <div class="raycast-detail-actions absolute right-0 bottom-0 left-0 border-t border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
          {props.actions}
        </div>
      </Show>
    </div>
  );
}

// ============================================================================
// Detail Metadata Component
// ============================================================================

export function DetailMetadata(props: DetailMetadataProps): JSX.Element {
  return (
    <div class="raycast-detail-metadata space-y-4">
      <div class="raycast-detail-metadata-header">
        <h3 class="mb-3 text-sm font-semibold tracking-wider text-gray-900 uppercase dark:text-gray-100">
          Details
        </h3>
      </div>
      <div class="raycast-detail-metadata-content space-y-3">
        {props.children}
      </div>
    </div>
  );
}

// ============================================================================
// Detail Metadata Label Component
// ============================================================================

export function DetailMetadataLabel(
  props: DetailMetadataLabelProps,
): JSX.Element {
  return (
    <div class="raycast-detail-metadata-label">
      <div class="flex items-start justify-between py-2">
        <div class="flex min-w-0 flex-1 items-center">
          <Show when={props.icon}>
            <div class="mr-2 flex-shrink-0">
              <ImageComponent
                image={props.icon!}
                class="h-4 w-4 text-gray-500"
              />
            </div>
          </Show>
          <span class="truncate text-sm font-medium text-gray-600 dark:text-gray-400">
            {props.title}
          </span>
        </div>
        <Show when={props.text}>
          <div class="ml-3 text-right">
            <span class="text-sm text-gray-900 dark:text-gray-100">
              {props.text}
            </span>
          </div>
        </Show>
      </div>
    </div>
  );
}

// ============================================================================
// Detail Metadata Link Component
// ============================================================================

export function DetailMetadataLink(
  props: DetailMetadataLinkProps,
): JSX.Element {
  return (
    <div class="raycast-detail-metadata-link py-2">
      <div class="mb-1 text-sm font-medium text-gray-600 dark:text-gray-400">
        {props.title}
      </div>
      <a
        href={props.target}
        target="_blank"
        rel="noopener noreferrer"
        class="text-sm break-all text-blue-600 hover:underline dark:text-blue-400"
      >
        {props.text || props.target}
      </a>
    </div>
  );
}

// ============================================================================
// Detail Metadata Tag List Component
// ============================================================================

export function DetailMetadataTagList(
  props: DetailMetadataTagListProps,
): JSX.Element {
  return (
    <div class="raycast-detail-metadata-taglist py-2">
      <div class="mb-2 text-sm font-medium text-gray-600 dark:text-gray-400">
        {props.title}
      </div>
      <div class="flex flex-wrap gap-2">{props.children}</div>
    </div>
  );
}

// ============================================================================
// Detail Metadata Tag List Item Component
// ============================================================================

export function DetailMetadataTagListItem(
  props: DetailMetadataTagListItemProps,
): JSX.Element {
  const getTagColor = () => {
    if (props.color) {
      if (typeof props.color === "string") {
        return props.color;
      }
      // Handle themeable colors
      const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      return isDark ? (props.color as any).dark : (props.color as any).light;
    }
    return undefined;
  };

  return (
    <span
      class="raycast-detail-metadata-tag inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-800 dark:bg-gray-700 dark:text-gray-200"
      style={{
        "background-color": getTagColor(),
        color: getTagColor() ? "white" : undefined,
      }}
    >
      {props.text}
    </span>
  );
}

// ============================================================================
// Detail Metadata Separator Component
// ============================================================================

export function DetailMetadataSeparator(
  _props: DetailMetadataSeparatorProps,
): JSX.Element {
  return (
    <hr class="raycast-detail-metadata-separator my-3 border-gray-200 dark:border-gray-700" />
  );
}

// ============================================================================
// Markdown Renderer Component
// ============================================================================

function MarkdownRenderer(props: { content: string }): JSX.Element {
  // Simple markdown parsing - in production, use a proper markdown library
  const parseMarkdown = (content: string): string => {
    return (
      content
        // Headers
        .replace(
          /^### (.*$)/gim,
          '<h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mt-6 mb-3">$1</h3>',
        )
        .replace(
          /^## (.*$)/gim,
          '<h2 class="text-xl font-semibold text-gray-900 dark:text-gray-100 mt-8 mb-4">$1</h2>',
        )
        .replace(
          /^# (.*$)/gim,
          '<h1 class="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-8 mb-4">$1</h1>',
        )

        // Bold and Italic
        .replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold">$1</strong>')
        .replace(/\*(.*?)\*/g, '<em class="italic">$1</em>')

        // Links
        .replace(
          /\[([^\]]+)\]\(([^)]+)\)/g,
          '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-blue-600 dark:text-blue-400 hover:underline">$1</a>',
        )

        // Code blocks
        .replace(
          /```([\s\S]*?)```/g,
          '<pre class="bg-gray-100 dark:bg-gray-800 rounded-md p-4 overflow-x-auto my-4"><code class="text-sm">$1</code></pre>',
        )
        .replace(
          /`([^`]+)`/g,
          '<code class="bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded text-sm font-mono">$1</code>',
        )

        // Lists
        .replace(/^\* (.*$)/gim, '<li class="ml-4 list-disc">$1</li>')
        .replace(/^- (.*$)/gim, '<li class="ml-4 list-disc">$1</li>')
        .replace(/^\d+\. (.*$)/gim, '<li class="ml-4 list-decimal">$1</li>')

        // Line breaks
        .replace(/\n\n/g, '</p><p class="mb-4">')
        .replace(/\n/g, "<br>")
    );
  };

  const parsedContent = parseMarkdown(props.content);

  return (
    <div
      class="raycast-markdown-content leading-relaxed text-gray-700 dark:text-gray-300"
      innerHTML={`<p class="mb-4">${parsedContent}</p>`}
    />
  );
}

// ============================================================================
// Image Component (Shared)
// ============================================================================

function ImageComponent(props: {
  image: ImageLike;
  class?: string;
}): JSX.Element {
  const getImageSrc = (image: ImageLike): string => {
    if (typeof image === "string") {
      return image;
    }

    if (typeof image === "object" && image !== null) {
      if ("source" in image) {
        if (typeof image.source === "string") {
          return image.source;
        }
        // Handle themeable source
        const isDark = window.matchMedia(
          "(prefers-color-scheme: dark)",
        ).matches;
        return isDark
          ? (image.source as any).dark
          : (image.source as any).light;
      }

      if ("fileIcon" in image) {
        return getFileIcon(image.fileIcon);
      }
    }

    return "";
  };

  const src = getImageSrc(props.image);

  // Check if it's an emoji
  if (
    src.length <= 4 &&
    /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]/u.test(
      src,
    )
  ) {
    return <span class={`raycast-icon-emoji ${props.class || ""}`}>{src}</span>;
  }

  // Regular image
  return (
    <img src={src} alt="" class={`raycast-icon-image ${props.class || ""}`} />
  );
}

// ============================================================================
// Helper Functions
// ============================================================================

function getFileIcon(filePath: string): string {
  const extension = filePath.split(".").pop()?.toLowerCase();

  const iconMap: Record<string, string> = {
    pdf: "📄",
    doc: "📝",
    docx: "📝",
    xls: "📊",
    xlsx: "📊",
    ppt: "📽️",
    pptx: "📽️",
    jpg: "🖼️",
    jpeg: "🖼️",
    png: "🖼️",
    gif: "🖼️",
    svg: "🖼️",
    mp4: "🎬",
    mov: "🎬",
    avi: "🎬",
    mkv: "🎬",
    mp3: "🎵",
    wav: "🎵",
    flac: "🎵",
    aac: "🎵",
    zip: "🗜️",
    rar: "🗜️",
    "7z": "🗜️",
    tar: "🗜️",
    gz: "🗜️",
    js: "📜",
    ts: "📜",
    jsx: "📜",
    tsx: "📜",
    html: "🌐",
    css: "🎨",
    json: "📋",
    xml: "📋",
    txt: "📄",
    md: "📝",
    py: "🐍",
    java: "☕",
    cpp: "⚙️",
    c: "⚙️",
    go: "🐹",
    rust: "🦀",
    php: "🐘",
    rb: "💎",
    swift: "🦉",
    kt: "🎯",
  };

  return iconMap[extension || ""] || "📄";
}

// ============================================================================
// Detail Layout Variants
// ============================================================================

export function DetailWithSidebar(
  props: DetailProps & { sidebarWidth?: number },
): JSX.Element {
  const sidebarWidth = props.sidebarWidth || 320;

  return (
    <div class="raycast-detail-with-sidebar flex h-full">
      <div class="raycast-detail-main flex-1 overflow-auto">
        <Detail {...props} metadata={undefined} />
      </div>
      <Show when={props.metadata}>
        <div
          class="raycast-detail-sidebar flex-shrink-0 overflow-y-auto border-l border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800"
          style={{ width: `${sidebarWidth}px` }}
        >
          <div class="p-4">{props.metadata}</div>
        </div>
      </Show>
    </div>
  );
}

export function DetailFullWidth(props: DetailProps): JSX.Element {
  return (
    <div class="raycast-detail-fullwidth h-full">
      <Detail {...props} metadata={undefined} />
      <Show when={props.metadata}>
        <div class="raycast-detail-metadata-bottom border-t border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800">
          {props.metadata}
        </div>
      </Show>
    </div>
  );
}

