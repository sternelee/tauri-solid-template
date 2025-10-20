import { createSignal, createEffect, For, Show, JSX } from 'solid-js';
import { 
  ListProps, 
  ListItemProps, 
  ListSectionProps, 
  ListEmptyViewProps,
  ListDropdownProps,
  ListDropdownItemProps,
  ListDropdownSectionProps,
  ListItemDetailProps,
  ListItemDetailMetadataProps,
  ListItemDetailMetadataLabelProps,
  ListItemDetailMetadataLinkProps,
  ListItemDetailMetadataTagListProps,
  ListItemDetailMetadataTagListItemProps,
  ListItemDetailMetadataSeparatorProps,
  ImageLike,
  Accessory
} from '../types';

// ============================================================================
// List Component
// ============================================================================

export function List(props: ListProps): JSX.Element {
  const [searchText, setSearchText] = createSignal('');
  const [filteredChildren, setFilteredChildren] = createSignal<any[]>([]);

  createEffect(() => {
    if (props.filtering !== false && searchText()) {
      // Filter children based on search text
      const filtered = filterListItems(props.children, searchText());
      setFilteredChildren(filtered);
    } else {
      setFilteredChildren(Array.isArray(props.children) ? props.children : [props.children]);
    }
  });

  const handleSearchChange = (value: string) => {
    setSearchText(value);
    if (props.onSearchTextChange) {
      if (props.throttle !== false) {
        // Simple throttling
        setTimeout(() => props.onSearchTextChange!(value), 100);
      } else {
        props.onSearchTextChange(value);
      }
    }
  };

  return (
    <div class="raycast-list flex flex-col h-full bg-white dark:bg-gray-900">
      {/* Search Bar */}
      <div class="raycast-list-search-bar flex items-center p-4 border-b border-gray-200 dark:border-gray-700">
        <div class="flex-1 relative">
          <input
            type="text"
            placeholder={props.searchBarPlaceholder || 'Search...'}
            value={searchText()}
            onInput={(e) => handleSearchChange(e.currentTarget.value)}
            class="w-full px-3 py-2 pl-10 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <div class="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
            🔍
          </div>
        </div>
        <Show when={props.searchBarAccessory}>
          <div class="ml-3">
            {props.searchBarAccessory}
          </div>
        </Show>
      </div>

      {/* List Content */}
      <div class="raycast-list-content flex-1 overflow-y-auto">
        <Show 
          when={filteredChildren().length > 0}
          fallback={<ListEmptyView title="No results found" description="Try adjusting your search" />}
        >
          <For each={filteredChildren()}>
            {(child) => child}
          </For>
        </Show>
      </div>
    </div>
  );
}

// ============================================================================
// List Item Component
// ============================================================================

export function ListItem(props: ListItemProps): JSX.Element {
  const [isSelected, setIsSelected] = createSignal(false);

  const handleClick = () => {
    setIsSelected(true);
    // Handle item selection logic
    console.log('List item selected:', props.title);
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
  };

  return (
    <div
      class={`raycast-list-item flex items-center px-4 py-3 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer border-b border-gray-200 dark:border-gray-700 transition-colors ${
        isSelected() ? 'bg-blue-50 dark:bg-blue-900/20' : ''
      }`}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="button"
      data-item-id={props.id}
      data-keywords={props.keywords?.join(',') || ''}
    >
      {/* Icon */}
      <Show when={props.icon}>
        <div class="raycast-list-item-icon mr-3 flex-shrink-0">
          <ImageComponent image={props.icon!} class="w-6 h-6" />
        </div>
      </Show>

      {/* Content */}
      <div class="raycast-list-item-content flex-1 min-w-0">
        <div class="raycast-list-item-title font-medium text-gray-900 dark:text-gray-100 truncate">
          {props.title}
        </div>
        <Show when={props.subtitle}>
          <div class="raycast-list-item-subtitle text-sm text-gray-500 dark:text-gray-400 truncate mt-1">
            {props.subtitle}
          </div>
        </Show>
      </div>

      {/* Accessories */}
      <Show when={props.accessories && props.accessories.length > 0}>
        <div class="raycast-list-item-accessories flex items-center space-x-2 ml-3">
          <For each={props.accessories}>
            {(accessory) => <AccessoryComponent accessory={accessory} />}
          </For>
        </div>
      </Show>

      {/* Actions (hidden by default, shown on hover/selection) */}
      <Show when={props.actions}>
        <div class="raycast-list-item-actions ml-3 opacity-0 group-hover:opacity-100 transition-opacity">
          {props.actions}
        </div>
      </Show>
    </div>
  );
}

// ============================================================================
// List Section Component
// ============================================================================

export function ListSection(props: ListSectionProps): JSX.Element {
  return (
    <div class="raycast-list-section">
      <Show when={props.title || props.subtitle}>
        <div class="raycast-list-section-header px-4 py-2 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
          <Show when={props.title}>
            <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100">
              {props.title}
            </h3>
          </Show>
          <Show when={props.subtitle}>
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {props.subtitle}
            </p>
          </Show>
        </div>
      </Show>
      <div class="raycast-list-section-content">
        {props.children}
      </div>
    </div>
  );
}

// ============================================================================
// List Empty View Component
// ============================================================================

export function ListEmptyView(props: ListEmptyViewProps): JSX.Element {
  return (
    <div class="raycast-list-empty flex flex-col items-center justify-center h-full p-8 text-center">
      <Show when={props.icon}>
        <div class="raycast-list-empty-icon mb-4">
          <ImageComponent image={props.icon!} class="w-16 h-16 text-gray-400" />
        </div>
      </Show>
      
      <Show when={props.title}>
        <h3 class="raycast-list-empty-title text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
          {props.title}
        </h3>
      </Show>
      
      <Show when={props.description}>
        <p class="raycast-list-empty-description text-sm text-gray-500 dark:text-gray-400 mb-4 max-w-md">
          {props.description}
        </p>
      </Show>
      
      <Show when={props.actions}>
        <div class="raycast-list-empty-actions">
          {props.actions}
        </div>
      </Show>
    </div>
  );
}

// ============================================================================
// List Dropdown Component
// ============================================================================

export function ListDropdown(props: ListDropdownProps): JSX.Element {
  const [selectedValue, setSelectedValue] = createSignal(props.value || '');
  const [isOpen, setIsOpen] = createSignal(false);

  createEffect(() => {
    if (props.value !== undefined) {
      setSelectedValue(props.value);
    }
  });

  const handleChange = (value: string) => {
    setSelectedValue(value);
    props.onChange?.(value);
    setIsOpen(false);
  };

  return (
    <div class="raycast-list-dropdown relative">
      <button
        type="button"
        class="raycast-list-dropdown-trigger w-full px-3 py-2 text-left border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
        onClick={() => setIsOpen(!isOpen())}
        title={props.tooltip}
      >
        <span class="block truncate">
          {selectedValue() || props.placeholder || 'Select...'}
        </span>
        <span class="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
          <svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
          </svg>
        </span>
      </button>

      <Show when={isOpen()}>
        <div class="raycast-list-dropdown-menu absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg max-h-60 overflow-auto">
          {props.children}
        </div>
      </Show>
    </div>
  );
}

export function ListDropdownItem(props: ListDropdownItemProps): JSX.Element {
  return (
    <button
      type="button"
      class="raycast-list-dropdown-item w-full px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center"
      onClick={() => {
        // This would be handled by the parent dropdown
        console.log('Dropdown item selected:', props.value);
      }}
    >
      <Show when={props.icon}>
        <div class="mr-3">
          <ImageComponent image={props.icon!} class="w-4 h-4" />
        </div>
      </Show>
      <span class="text-gray-900 dark:text-gray-100">{props.title}</span>
    </button>
  );
}

export function ListDropdownSection(props: ListDropdownSectionProps): JSX.Element {
  return (
    <div class="raycast-list-dropdown-section">
      <Show when={props.title}>
        <div class="px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider border-b border-gray-200 dark:border-gray-700">
          {props.title}
        </div>
      </Show>
      <div class="raycast-list-dropdown-section-content">
        {props.children}
      </div>
    </div>
  );
}

// ============================================================================
// List Item Detail Components
// ============================================================================

export function ListItemDetail(props: ListItemDetailProps): JSX.Element {
  return (
    <div class="raycast-list-item-detail bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-700">
      <Show when={props.isLoading}>
        <div class="flex items-center justify-center p-8">
          <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </Show>
      
      <Show when={!props.isLoading}>
        <div class="p-4">
          <Show when={props.markdown}>
            <div class="raycast-markdown prose dark:prose-invert max-w-none mb-4">
              {/* Simple markdown rendering - in production, use a proper markdown parser */}
              <div innerHTML={props.markdown!.replace(/\n/g, '<br>')} />
            </div>
          </Show>
          
          <Show when={props.metadata}>
            <div class="raycast-list-item-detail-metadata">
              {props.metadata}
            </div>
          </Show>
        </div>
      </Show>
    </div>
  );
}

export function ListItemDetailMetadata(props: ListItemDetailMetadataProps): JSX.Element {
  return (
    <div class="raycast-list-item-detail-metadata space-y-3">
      {props.children}
    </div>
  );
}

export function ListItemDetailMetadataLabel(props: ListItemDetailMetadataLabelProps): JSX.Element {
  return (
    <div class="raycast-metadata-label flex justify-between items-start py-1">
      <div class="flex items-center">
        <Show when={props.icon}>
          <div class="mr-2">
            <ImageComponent image={props.icon!} class="w-4 h-4" />
          </div>
        </Show>
        <span class="text-sm font-medium text-gray-600 dark:text-gray-400">
          {props.title}
        </span>
      </div>
      <Show when={props.text}>
        <span class="text-sm text-gray-900 dark:text-gray-100 text-right">
          {props.text}
        </span>
      </Show>
    </div>
  );
}

export function ListItemDetailMetadataLink(props: ListItemDetailMetadataLinkProps): JSX.Element {
  return (
    <div class="raycast-metadata-link py-1">
      <span class="text-sm font-medium text-gray-600 dark:text-gray-400 block mb-1">
        {props.title}
      </span>
      <a
        href={props.target}
        target="_blank"
        rel="noopener noreferrer"
        class="text-sm text-blue-600 dark:text-blue-400 hover:underline"
      >
        {props.text || props.target}
      </a>
    </div>
  );
}

export function ListItemDetailMetadataTagList(props: ListItemDetailMetadataTagListProps): JSX.Element {
  return (
    <div class="raycast-metadata-taglist py-1">
      <span class="text-sm font-medium text-gray-600 dark:text-gray-400 block mb-2">
        {props.title}
      </span>
      <div class="flex flex-wrap gap-1">
        {props.children}
      </div>
    </div>
  );
}

export function ListItemDetailMetadataTagListItem(props: ListItemDetailMetadataTagListItemProps): JSX.Element {
  return (
    <span 
      class="raycast-metadata-tag inline-block px-2 py-1 text-xs rounded-full bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200"
      style={{ 'background-color': props.color ? String(props.color) : undefined }}
    >
      {props.text}
    </span>
  );
}

export function ListItemDetailMetadataSeparator(_props: ListItemDetailMetadataSeparatorProps): JSX.Element {
  return (
    <hr class="raycast-metadata-separator border-gray-200 dark:border-gray-700 my-2" />
  );
}

// ============================================================================
// Helper Components
// ============================================================================

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
        // Return appropriate file icon
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

function AccessoryComponent(props: { accessory: Accessory }): JSX.Element {
  return (
    <div class="raycast-accessory flex items-center text-xs text-gray-500 dark:text-gray-400">
      <Show when={props.accessory.icon}>
        <div class="mr-1">
          <ImageComponent image={props.accessory.icon!} class="w-3 h-3" />
        </div>
      </Show>
      
      <Show when={props.accessory.text}>
        <span>{props.accessory.text}</span>
      </Show>
      
      <Show when={props.accessory.tag}>
        <span 
          class="px-1.5 py-0.5 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200"
          style={{ 'background-color': props.accessory.tag!.color ? String(props.accessory.tag!.color) : undefined }}
        >
          {props.accessory.tag!.value}
        </span>
      </Show>
    </div>
  );
}

// ============================================================================
// Helper Functions
// ============================================================================

function filterListItems(children: any, searchText: string): any[] {
  if (!children || !searchText) return Array.isArray(children) ? children : [children];
  
  const search = searchText.toLowerCase();
  
  const filterItem = (item: any): boolean => {
    if (!item || !item.props) return false;
    
    // Check title
    if (item.props.title && item.props.title.toLowerCase().includes(search)) {
      return true;
    }
    
    // Check subtitle
    if (item.props.subtitle && item.props.subtitle.toLowerCase().includes(search)) {
      return true;
    }
    
    // Check keywords
    if (item.props.keywords && Array.isArray(item.props.keywords)) {
      return item.props.keywords.some((keyword: string) => 
        keyword.toLowerCase().includes(search)
      );
    }
    
    return false;
  };
  
  const childArray = Array.isArray(children) ? children : [children];
  return childArray.filter(filterItem);
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