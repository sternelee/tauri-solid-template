import { createSignal, Show, For, JSX } from 'solid-js';
import { 
  ActionProps,
  ActionPanelProps,
  ActionPanelSectionProps,
  ActionPanelSubmenuProps,
  ActionPushProps,
  ActionCopyToClipboardProps,
  ActionPasteProps,
  ActionOpenInBrowserProps,
  ActionSubmitFormProps,
  KeyboardShortcut,
  ImageLike,
  FormValues
} from '../types';

// ============================================================================
// Action Component
// ============================================================================

export function Action(props: ActionProps): JSX.Element {
  const [isPressed, setIsPressed] = createSignal(false);
  const [isLoading, setIsLoading] = createSignal(false);

  const handleClick = async () => {
    if (isLoading() || !props.onAction) return;

    setIsPressed(true);
    setIsLoading(true);

    try {
      await props.onAction();
    } catch (error) {
      console.error('Action execution failed:', error);
    } finally {
      setIsLoading(false);
      setTimeout(() => setIsPressed(false), 150);
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
  };

  const getActionClasses = () => {
    const baseClasses = 'raycast-action inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-md transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2';
    
    const styleClasses = props.style === 'destructive' 
      ? 'bg-red-600 hover:bg-red-700 text-white focus:ring-red-500'
      : 'bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-gray-100 focus:ring-blue-500';
    
    const stateClasses = isPressed() 
      ? 'transform scale-95' 
      : isLoading() 
        ? 'opacity-75 cursor-not-allowed' 
        : 'hover:transform hover:scale-105';

    return `${baseClasses} ${styleClasses} ${stateClasses}`;
  };

  return (
    <button
      type="button"
      class={getActionClasses()}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      disabled={isLoading()}
      title={props.shortcut ? formatShortcut(props.shortcut) : undefined}
    >
      {/* Loading Spinner */}
      <Show when={isLoading()}>
        <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
      </Show>

      {/* Icon */}
      <Show when={props.icon && !isLoading()}>
        <div class="mr-2">
          <ImageComponent image={props.icon!} class="w-4 h-4" />
        </div>
      </Show>

      {/* Title */}
      <span>{props.title}</span>

      {/* Keyboard Shortcut */}
      <Show when={props.shortcut}>
        <div class="ml-2 text-xs opacity-75">
          <KeyboardShortcutDisplay shortcut={props.shortcut!} />
        </div>
      </Show>
    </button>
  );
}

// ============================================================================
// Action Panel Component
// ============================================================================

export function ActionPanel(props: ActionPanelProps): JSX.Element {
  const [isVisible, setIsVisible] = createSignal(true);

  return (
    <Show when={isVisible()}>
      <div class="raycast-action-panel bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-3">
        <Show when={props.title}>
          <div class="raycast-action-panel-header mb-3">
            <h3 class="text-sm font-medium text-gray-900 dark:text-gray-100">
              {props.title}
            </h3>
          </div>
        </Show>
        
        <div class="raycast-action-panel-content flex flex-wrap gap-2">
          {props.children}
        </div>
      </div>
    </Show>
  );
}

// ============================================================================
// Action Panel Section Component
// ============================================================================

export function ActionPanelSection(props: ActionPanelSectionProps): JSX.Element {
  return (
    <div class="raycast-action-panel-section">
      <Show when={props.title}>
        <div class="raycast-action-panel-section-header mb-2">
          <h4 class="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">
            {props.title}
          </h4>
        </div>
      </Show>
      
      <div class="raycast-action-panel-section-content flex flex-wrap gap-2">
        {props.children}
      </div>
    </div>
  );
}

// ============================================================================
// Action Panel Submenu Component
// ============================================================================

export function ActionPanelSubmenu(props: ActionPanelSubmenuProps): JSX.Element {
  const [isOpen, setIsOpen] = createSignal(false);

  const handleToggle = () => {
    setIsOpen(!isOpen());
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleToggle();
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  return (
    <div class="raycast-action-panel-submenu relative">
      <button
        type="button"
        class="raycast-action-submenu-trigger inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-md bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
        onClick={handleToggle}
        onKeyDown={handleKeyDown}
        title={props.shortcut ? formatShortcut(props.shortcut) : undefined}
      >
        <Show when={props.icon}>
          <div class="mr-2">
            <ImageComponent image={props.icon!} class="w-4 h-4" />
          </div>
        </Show>
        
        <span>{props.title}</span>
        
        <svg 
          class={`ml-2 w-4 h-4 transition-transform ${isOpen() ? 'rotate-180' : ''}`}
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      <Show when={isOpen()}>
        <div class="raycast-action-submenu-content absolute bottom-full left-0 mb-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg p-2 min-w-48 z-10">
          <div class="space-y-1">
            {props.children}
          </div>
        </div>
      </Show>
    </div>
  );
}

// ============================================================================
// Action Push Component
// ============================================================================

export function ActionPush(props: ActionPushProps): JSX.Element {
  const [isNavigating, setIsNavigating] = createSignal(false);

  const handlePush = async () => {
    if (isNavigating()) return;

    setIsNavigating(true);
    
    try {
      // Call the onPush callback if provided
      props.onPush?.();
      
      // TODO: Integrate with navigation manager to push the target component
      console.log('Pushing navigation to:', props.target);
      
      // Simulate navigation delay
      await new Promise(resolve => setTimeout(resolve, 100));
      
    } catch (error) {
      console.error('Navigation push failed:', error);
    } finally {
      setIsNavigating(false);
    }
  };

  return (
    <button
      type="button"
      class="raycast-action-push inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-md bg-blue-600 hover:bg-blue-700 text-white transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
      onClick={handlePush}
      disabled={isNavigating()}
      title={props.shortcut ? formatShortcut(props.shortcut) : undefined}
    >
      <Show when={isNavigating()}>
        <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
      </Show>

      <Show when={props.icon && !isNavigating()}>
        <div class="mr-2">
          <ImageComponent image={props.icon!} class="w-4 h-4" />
        </div>
      </Show>

      <span>{props.title}</span>

      <Show when={!isNavigating()}>
        <svg class="ml-2 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
        </svg>
      </Show>
    </button>
  );
}

// ============================================================================
// Action Copy to Clipboard Component
// ============================================================================

export function ActionCopyToClipboard(props: ActionCopyToClipboardProps): JSX.Element {
  const [isCopying, setIsCopying] = createSignal(false);
  const [isCopied, setIsCopied] = createSignal(false);

  const handleCopy = async () => {
    if (isCopying()) return;

    setIsCopying(true);
    
    try {
      const textToCopy = String(props.content);
      
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(textToCopy);
      } else {
        // Fallback for non-secure contexts
        const textArea = document.createElement('textarea');
        textArea.value = textToCopy;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        textArea.remove();
      }
      
      setIsCopied(true);
      
      // Reset copied state after 2 seconds
      setTimeout(() => setIsCopied(false), 2000);
      
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    } finally {
      setIsCopying(false);
    }
  };

  const getButtonClasses = () => {
    const baseClasses = 'raycast-action-copy inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-md transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2';
    
    if (isCopied()) {
      return `${baseClasses} bg-green-600 text-white focus:ring-green-500`;
    }
    
    return `${baseClasses} bg-gray-600 hover:bg-gray-700 text-white focus:ring-gray-500`;
  };

  return (
    <button
      type="button"
      class={getButtonClasses()}
      onClick={handleCopy}
      disabled={isCopying()}
      title={`Copy ${props.concealed ? '[Hidden]' : String(props.content)} ${props.shortcut ? `(${formatShortcut(props.shortcut)})` : ''}`}
    >
      <Show when={isCopying()}>
        <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
      </Show>

      <Show when={!isCopying()}>
        <div class="mr-2">
          <Show 
            when={isCopied()}
            fallback={
              <Show 
                when={props.icon}
                fallback={
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                }
              >
                <ImageComponent image={props.icon!} class="w-4 h-4" />
              </Show>
            }
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>
          </Show>
        </div>
      </Show>

      <span>{isCopied() ? 'Copied!' : props.title}</span>
    </button>
  );
}

// ============================================================================
// Action Paste Component
// ============================================================================

export function ActionPaste(props: ActionPasteProps): JSX.Element {
  const [isPasting, setIsPasting] = createSignal(false);

  const handlePaste = async () => {
    if (isPasting()) return;

    setIsPasting(true);
    
    try {
      // Simulate paste action with the provided content
      console.log('Pasting content:', props.content);
      
      // In a real implementation, this would paste to the active input or trigger a paste event
      const event = new CustomEvent('raycast:paste', {
        detail: { content: props.content }
      });
      window.dispatchEvent(event);
      
    } catch (error) {
      console.error('Failed to paste:', error);
    } finally {
      setIsPasting(false);
    }
  };

  return (
    <button
      type="button"
      class="raycast-action-paste inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-md bg-purple-600 hover:bg-purple-700 text-white transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:opacity-50"
      onClick={handlePaste}
      disabled={isPasting()}
      title={props.shortcut ? formatShortcut(props.shortcut) : undefined}
    >
      <Show when={isPasting()}>
        <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
      </Show>

      <Show when={props.icon && !isPasting()}>
        <div class="mr-2">
          <ImageComponent image={props.icon!} class="w-4 h-4" />
        </div>
      </Show>

      <Show when={!props.icon && !isPasting()}>
        <div class="mr-2">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
        </div>
      </Show>

      <span>{props.title}</span>
    </button>
  );
}

// ============================================================================
// Action Open in Browser Component
// ============================================================================

export function ActionOpenInBrowser(props: ActionOpenInBrowserProps): JSX.Element {
  const [isOpening, setIsOpening] = createSignal(false);

  const handleOpen = async () => {
    if (isOpening()) return;

    setIsOpening(true);
    
    try {
      // Open URL in new tab/window
      window.open(props.url, '_blank', 'noopener,noreferrer');
      
      // Brief delay for visual feedback
      await new Promise(resolve => setTimeout(resolve, 200));
      
    } catch (error) {
      console.error('Failed to open URL:', error);
    } finally {
      setIsOpening(false);
    }
  };

  return (
    <button
      type="button"
      class="raycast-action-browser inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-md bg-green-600 hover:bg-green-700 text-white transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50"
      onClick={handleOpen}
      disabled={isOpening()}
      title={`Open ${props.url} ${props.shortcut ? `(${formatShortcut(props.shortcut)})` : ''}`}
    >
      <Show when={isOpening()}>
        <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
      </Show>

      <Show when={props.icon && !isOpening()}>
        <div class="mr-2">
          <ImageComponent image={props.icon!} class="w-4 h-4" />
        </div>
      </Show>

      <Show when={!props.icon && !isOpening()}>
        <div class="mr-2">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </div>
      </Show>

      <span>{props.title}</span>

      <Show when={!isOpening()}>
        <svg class="ml-1 w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
        </svg>
      </Show>
    </button>
  );
}

// ============================================================================
// Action Submit Form Component
// ============================================================================

export function ActionSubmitForm(props: ActionSubmitFormProps): JSX.Element {
  const [isSubmitting, setIsSubmitting] = createSignal(false);

  const handleSubmit = async () => {
    if (isSubmitting() || !props.onSubmit) return;

    setIsSubmitting(true);
    
    try {
      // Collect form data from the nearest form element
      const form = document.querySelector('form');
      const formData = new FormData(form || undefined);
      const values: FormValues = {};
      
      formData.forEach((value, key) => {
        values[key] = value;
      });
      
      await props.onSubmit(values);
      
    } catch (error) {
      console.error('Form submission failed:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <button
      type="submit"
      class="raycast-action-submit inline-flex items-center px-4 py-2 text-sm font-medium rounded-md bg-blue-600 hover:bg-blue-700 text-white transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
      onClick={handleSubmit}
      disabled={isSubmitting()}
      title={props.shortcut ? formatShortcut(props.shortcut) : undefined}
    >
      <Show when={isSubmitting()}>
        <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
      </Show>

      <Show when={props.icon && !isSubmitting()}>
        <div class="mr-2">
          <ImageComponent image={props.icon!} class="w-4 h-4" />
        </div>
      </Show>

      <span>{isSubmitting() ? 'Submitting...' : props.title}</span>
    </button>
  );
}

// ============================================================================
// Helper Components
// ============================================================================

function KeyboardShortcutDisplay(props: { shortcut: KeyboardShortcut }): JSX.Element {
  return (
    <div class="raycast-keyboard-shortcut inline-flex items-center space-x-1">
      <For each={props.shortcut.modifiers}>
        {(modifier) => (
          <kbd class="inline-flex items-center justify-center w-5 h-5 text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded border border-gray-300 dark:border-gray-600">
            {getModifierSymbol(modifier)}
          </kbd>
        )}
      </For>
      <kbd class="inline-flex items-center justify-center px-2 h-5 text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded border border-gray-300 dark:border-gray-600">
        {props.shortcut.key.toUpperCase()}
      </kbd>
    </div>
  );
}

function ImageComponent(props: { image: ImageLike; class?: string }): JSX.Element {
  const getImageSrc = (image: ImageLike): string => {
    if (typeof image === 'string') {
      return image;
    }
    
    if (typeof image === 'object' && image !== null) {
      if ('source' in image) {
        if (typeof image.source === 'string') {
          return image.source;
        }
        // Handle themeable source
        const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        return isDark ? (image.source as any).dark : (image.source as any).light;
      }
      
      if ('fileIcon' in image) {
        return getFileIcon(image.fileIcon);
      }
    }
    
    return '';
  };

  const src = getImageSrc(props.image);
  
  // Check if it's an emoji
  if (src.length <= 4 && /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]/u.test(src)) {
    return (
      <span class={`raycast-icon-emoji ${props.class || ''}`}>
        {src}
      </span>
    );
  }
  
  // Regular image
  return (
    <img
      src={src}
      alt=""
      class={`raycast-icon-image ${props.class || ''}`}
    />
  );
}

// ============================================================================
// Helper Functions
// ============================================================================

function getModifierSymbol(modifier: string): string {
  const symbolMap: Record<string, string> = {
    'cmd': '⌘',
    'ctrl': '⌃',
    'opt': '⌥',
    'shift': '⇧'
  };
  
  return symbolMap[modifier] || modifier;
}

function formatShortcut(shortcut: KeyboardShortcut): string {
  const modifiers = shortcut.modifiers.map(getModifierSymbol);
  return [...modifiers, shortcut.key.toUpperCase()].join('');
}

function getFileIcon(filePath: string): string {
  const extension = filePath.split('.').pop()?.toLowerCase();
  
  const iconMap: Record<string, string> = {
    pdf: '📄',
    doc: '📝',
    docx: '📝',
    xls: '📊',
    xlsx: '📊',
    ppt: '📽️',
    pptx: '📽️',
    jpg: '🖼️',
    jpeg: '🖼️',
    png: '🖼️',
    gif: '🖼️',
    mp4: '🎬',
    mov: '🎬',
    avi: '🎬',
    mp3: '🎵',
    wav: '🎵',
    flac: '🎵',
    zip: '🗜️',
    rar: '🗜️',
    '7z': '🗜️'
  };
  
  return iconMap[extension || ''] || '📄';
}

// ============================================================================
// Action Utilities
// ============================================================================

export class ActionUtils {
  static createActionGroup(actions: JSX.Element[]): JSX.Element {
    return (
      <div class="raycast-action-group flex flex-wrap gap-2">
        <For each={actions}>
          {(action) => action}
        </For>
      </div>
    );
  }

  static createPrimarySecondaryActions(
    primary: JSX.Element, 
    secondary: JSX.Element[]
  ): JSX.Element {
    return (
      <div class="raycast-primary-secondary-actions flex items-center gap-3">
        <div class="raycast-primary-action">
          {primary}
        </div>
        <Show when={secondary.length > 0}>
          <div class="raycast-secondary-actions flex gap-2">
            <For each={secondary}>
              {(action) => action}
            </For>
          </div>
        </Show>
      </div>
    );
  }

  static createContextualActions(
    context: 'list' | 'detail' | 'form' | 'grid',
    actions: JSX.Element[]
  ): JSX.Element {
    const contextClasses = {
      list: 'raycast-list-actions',
      detail: 'raycast-detail-actions', 
      form: 'raycast-form-actions',
      grid: 'raycast-grid-actions'
    };

    return (
      <div class={`raycast-contextual-actions ${contextClasses[context]} flex gap-2`}>
        <For each={actions}>
          {(action) => action}
        </For>
      </div>
    );
  }
}

// ============================================================================
// Action Constants
// ============================================================================

export const ActionStyle = {
  Regular: 'regular' as const,
  Destructive: 'destructive' as const
};

export const CommonShortcuts = {
  ENTER: { modifiers: [], key: 'Enter' } as KeyboardShortcut,
  CMD_ENTER: { modifiers: ['cmd'], key: 'Enter' } as KeyboardShortcut,
  CMD_C: { modifiers: ['cmd'], key: 'c' } as KeyboardShortcut,
  CMD_V: { modifiers: ['cmd'], key: 'v' } as KeyboardShortcut,
  CMD_O: { modifiers: ['cmd'], key: 'o' } as KeyboardShortcut,
  ESC: { modifiers: [], key: 'Escape' } as KeyboardShortcut
};