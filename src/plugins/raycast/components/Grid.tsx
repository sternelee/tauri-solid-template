import { createSignal, createEffect, For, Show, JSX } from 'solid-js';
import { 
  GridProps,
  GridItemProps,
  GridSectionProps,
  GridEmptyViewProps,
  ImageLike,
  Accessory
} from '../types';

// ============================================================================
// Grid Component
// ============================================================================

export function Grid(props: GridProps): JSX.Element {
  const [searchText, setSearchText] = createSignal('');
  const [filteredChildren, setFilteredChildren] = createSignal<any[]>([]);

  // Grid configuration
  const columns = () => props.columns || 5;
  const inset = () => props.inset || 'medium';
  const fit = () => props.fit || 'contain';

  createEffect(() => {
    if (props.filtering !== false && searchText()) {
      // Filter children based on search text
      const filtered = filterGridItems(props.children, searchText());
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

  const getGridClasses = () => {
    const baseClasses = 'raycast-grid grid gap-4 p-4 bg-white dark:bg-gray-900 overflow-y-auto';
    const columnClasses = getGridColumnClass(columns());
    const insetClasses = getInsetClass(inset());
    
    return `${baseClasses} ${columnClasses} ${insetClasses}`;
  };

  return (
    <div class="raycast-grid-container flex flex-col h-full bg-white dark:bg-gray-900">
      {/* Search Bar */}
      <Show when={props.searchBarAccessory || props.onSearchTextChange}>
        <div class="raycast-grid-search-bar flex items-center p-4 border-b border-gray-200 dark:border-gray-700">
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
      </Show>

      {/* Navigation Title */}
      <Show when={props.navigationTitle}>
        <div class="raycast-grid-header px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <h1 class="text-xl font-semibold text-gray-900 dark:text-gray-100">
            {props.navigationTitle}
          </h1>
        </div>
      </Show>

      {/* Grid Content */}
      <div class="raycast-grid-content flex-1 overflow-hidden">
        <Show 
          when={filteredChildren().length > 0}
          fallback={
            <GridEmptyView 
              title="No items found" 
              description="Try adjusting your search or add some items"
              icon="📭"
            />
          }
        >
          <div 
            class={getGridClasses()}
            style={{
              '--grid-columns': columns(),
              '--grid-inset': getInsetValue(inset()),
              '--grid-fit': fit()
            }}
          >
            <For each={filteredChildren()}>
              {(child) => child}
            </For>
          </div>
        </Show>
      </div>
    </div>
  );
}

// ============================================================================
// Grid Item Component
// ============================================================================

export function GridItem(props: GridItemProps): JSX.Element {
  const [isSelected, setIsSelected] = createSignal(false);
  const [isHovered, setIsHovered] = createSignal(false);

  const handleClick = () => {
    setIsSelected(true);
    console.log('Grid item selected:', props.title);
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
  };

  return (
    <div
      class={`
        raycast-grid-item bg-white dark:bg-gray-800 rounded-lg p-4 cursor-pointer 
        border border-gray-200 dark:border-gray-700 transition-all duration-200
        hover:shadow-md hover:border-gray-300 dark:hover:border-gray-600
        focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50
        ${isSelected() ? 'ring-2 ring-blue-500 ring-opacity-50 bg-blue-50 dark:bg-blue-900/20' : ''}
        ${isHovered() ? 'transform -translate-y-1' : ''}
      `}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      tabIndex={0}
      role="button"
      data-item-id={props.id}
      data-keywords={props.keywords?.join(',') || ''}
    >
      {/* Content */}
      <Show when={props.content}>
        <div class="raycast-grid-item-content mb-3 flex items-center justify-center">
          <ContentRenderer content={props.content!} />
        </div>
      </Show>

      {/* Title and Subtitle */}
      <div class="raycast-grid-item-text text-center">
        <Show when={props.title}>
          <h3 class="font-medium text-gray-900 dark:text-gray-100 text-sm truncate mb-1">
            {props.title}
          </h3>
        </Show>
        
        <Show when={props.subtitle}>
          <p class="text-xs text-gray-500 dark:text-gray-400 truncate">
            {props.subtitle}
          </p>
        </Show>
      </div>

      {/* Accessory */}
      <Show when={props.accessory}>
        <div class="raycast-grid-item-accessory mt-2 flex justify-center">
          <AccessoryComponent accessory={props.accessory!} />
        </div>
      </Show>

      {/* Actions (shown on hover) */}
      <Show when={props.actions && isHovered()}>
        <div class="raycast-grid-item-actions absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
          {props.actions}
        </div>
      </Show>
    </div>
  );
}

// ============================================================================
// Grid Section Component
// ============================================================================

export function GridSection(props: GridSectionProps): JSX.Element {
  return (
    <div class="raycast-grid-section col-span-full">
      {/* Section Header */}
      <Show when={props.title || props.subtitle}>
        <div class="raycast-grid-section-header mb-4 px-2">
          <Show when={props.title}>
            <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {props.title}
            </h2>
          </Show>
          <Show when={props.subtitle}>
            <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {props.subtitle}
            </p>
          </Show>
        </div>
      </Show>

      {/* Section Content */}
      <div class="raycast-grid-section-content grid gap-4 grid-cols-subgrid col-span-full">
        {props.children}
      </div>
    </div>
  );
}

// ============================================================================
// Grid Empty View Component
// ============================================================================

export function GridEmptyView(props: GridEmptyViewProps): JSX.Element {
  return (
    <div class="raycast-grid-empty flex flex-col items-center justify-center h-full p-8 text-center">
      <Show when={props.icon}>
        <div class="raycast-grid-empty-icon mb-6">
          <ImageComponent image={props.icon!} class="w-20 h-20 text-gray-400" />
        </div>
      </Show>
      
      <Show when={props.title}>
        <h3 class="raycast-grid-empty-title text-xl font-medium text-gray-900 dark:text-gray-100 mb-3">
          {props.title}
        </h3>
      </Show>
      
      <Show when={props.description}>
        <p class="raycast-grid-empty-description text-sm text-gray-500 dark:text-gray-400 mb-6 max-w-md leading-relaxed">
          {props.description}
        </p>
      </Show>
      
      <Show when={props.actions}>
        <div class="raycast-grid-empty-actions">
          {props.actions}
        </div>
      </Show>
    </div>
  );
}

// ============================================================================
// Helper Components
// ============================================================================

function ContentRenderer(props: { content: any }): JSX.Element {
  // Handle different types of content
  if (typeof props.content === 'string') {
    // Check if it's an image URL
    if (isImageUrl(props.content)) {
      return (
        <img
          src={props.content}
          alt=""
          class="raycast-grid-content-image w-full h-24 object-cover rounded-md"
        />
      );
    }
    
    // Check if it's an emoji
    if (isEmoji(props.content)) {
      return (
        <span class="raycast-grid-content-emoji text-4xl">
          {props.content}
        </span>
      );
    }
    
    // Regular text content
    return (
      <div class="raycast-grid-content-text text-2xl font-medium text-gray-600 dark:text-gray-400">
        {props.content}
      </div>
    );
  }
  
  // Handle ImageLike objects
  if (typeof props.content === 'object' && props.content !== null) {
    return <ImageComponent image={props.content as ImageLike} class="w-full h-24 object-cover rounded-md" />;
  }
  
  // Handle JSX elements
  return props.content;
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
      <span class={`raycast-icon-emoji text-4xl ${props.class || ''}`}>
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
    <div class="raycast-grid-accessory flex items-center justify-center text-xs text-gray-500 dark:text-gray-400">
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

function getGridColumnClass(columns: number): string {
  const columnMap: Record<number, string> = {
    1: 'grid-cols-1',
    2: 'grid-cols-2',
    3: 'grid-cols-3',
    4: 'grid-cols-4',
    5: 'grid-cols-5',
    6: 'grid-cols-6',
    7: 'grid-cols-7',
    8: 'grid-cols-8',
    9: 'grid-cols-9',
    10: 'grid-cols-10',
    11: 'grid-cols-11',
    12: 'grid-cols-12'
  };
  
  return columnMap[columns] || 'grid-cols-5';
}

function getInsetClass(inset: string): string {
  switch (inset) {
    case 'small':
      return 'p-2';
    case 'medium':
      return 'p-4';
    case 'large':
      return 'p-6';
    default:
      return 'p-4';
  }
}

function getInsetValue(inset: string): string {
  switch (inset) {
    case 'small':
      return '0.5rem';
    case 'medium':
      return '1rem';
    case 'large':
      return '1.5rem';
    default:
      return '1rem';
  }
}

function filterGridItems(children: any, searchText: string): any[] {
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

function isImageUrl(str: string): boolean {
  const imageExtensions = /\.(jpg|jpeg|png|gif|svg|webp|bmp|ico)$/i;
  return imageExtensions.test(str) || str.startsWith('data:image/') || str.startsWith('http');
}

function isEmoji(str: string): boolean {
  const emojiRegex = /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/u;
  return emojiRegex.test(str) && str.length <= 4;
}

function getFileIcon(filePath: string): string {
  const extension = filePath.split('.').pop()?.toLowerCase();
  
  const iconMap: Record<string, string> = {
    // Documents
    pdf: '📄',
    doc: '📝',
    docx: '📝',
    txt: '📄',
    rtf: '📄',
    
    // Spreadsheets
    xls: '📊',
    xlsx: '📊',
    csv: '📊',
    
    // Presentations
    ppt: '📽️',
    pptx: '📽️',
    
    // Images
    jpg: '🖼️',
    jpeg: '🖼️',
    png: '🖼️',
    gif: '🖼️',
    svg: '🖼️',
    webp: '🖼️',
    bmp: '🖼️',
    ico: '🖼️',
    
    // Videos
    mp4: '🎬',
    mov: '🎬',
    avi: '🎬',
    mkv: '🎬',
    wmv: '🎬',
    flv: '🎬',
    webm: '🎬',
    
    // Audio
    mp3: '🎵',
    wav: '🎵',
    flac: '🎵',
    aac: '🎵',
    ogg: '🎵',
    m4a: '🎵',
    
    // Archives
    zip: '🗜️',
    rar: '🗜️',
    '7z': '🗜️',
    tar: '🗜️',
    gz: '🗜️',
    bz2: '🗜️',
    
    // Code files
    js: '📜',
    ts: '📜',
    jsx: '📜',
    tsx: '📜',
    html: '🌐',
    css: '🎨',
    scss: '🎨',
    sass: '🎨',
    less: '🎨',
    json: '📋',
    xml: '📋',
    yaml: '📋',
    yml: '📋',
    md: '📝',
    py: '🐍',
    java: '☕',
    cpp: '⚙️',
    c: '⚙️',
    h: '⚙️',
    go: '🐹',
    rs: '🦀',
    php: '🐘',
    rb: '💎',
    swift: '🦉',
    kt: '🎯',
    scala: '🎭',
    clj: '🔗',
    sh: '🐚',
    bash: '🐚',
    zsh: '🐚',
    fish: '🐚'
  };
  
  return iconMap[extension || ''] || '📄';
}

// ============================================================================
// Grid Layout Variants
// ============================================================================

export function GridWithSidebar(props: GridProps & { sidebarContent?: JSX.Element; sidebarWidth?: number }): JSX.Element {
  const sidebarWidth = props.sidebarWidth || 280;
  
  return (
    <div class="raycast-grid-with-sidebar flex h-full">
      <div class="raycast-grid-main flex-1">
        <Grid {...props} />
      </div>
      <Show when={props.sidebarContent}>
        <div 
          class="raycast-grid-sidebar flex-shrink-0 bg-gray-50 dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 overflow-y-auto"
          style={{ width: `${sidebarWidth}px` }}
        >
          <div class="p-4">
            {props.sidebarContent}
          </div>
        </div>
      </Show>
    </div>
  );
}

export function ResponsiveGrid(props: GridProps): JSX.Element {
  return (
    <div class="raycast-responsive-grid">
      <style>{`
        .raycast-responsive-grid .raycast-grid {
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        }
        
        @media (max-width: 640px) {
          .raycast-responsive-grid .raycast-grid {
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 0.75rem;
            padding: 0.75rem;
          }
        }
        
        @media (max-width: 480px) {
          .raycast-responsive-grid .raycast-grid {
            grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
            gap: 0.5rem;
            padding: 0.5rem;
          }
        }
      `}</style>
      <Grid {...props} />
    </div>
  );
}