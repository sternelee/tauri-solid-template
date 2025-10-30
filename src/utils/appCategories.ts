/**
 * Application Categorization Utility
 * Categorizes applications based on bundle ID and name patterns
 */

export interface AppCategory {
  id: string;
  name: string;
  icon: string;
  color: string;
}

export const APP_CATEGORIES: Record<string, AppCategory> = {
  browsers: {
    id: 'browsers',
    name: 'Browsers',
    icon: '🌐',
    color: '#3b82f6',
  },
  development: {
    id: 'development',
    name: 'Development',
    icon: '💻',
    color: '#10b981',
  },
  design: {
    id: 'design',
    name: 'Design & Graphics',
    icon: '🎨',
    color: '#f59e0b',
  },
  communication: {
    id: 'communication',
    name: 'Communication',
    icon: '💬',
    color: '#8b5cf6',
  },
  productivity: {
    id: 'productivity',
    name: 'Productivity',
    icon: '📝',
    color: '#06b6d4',
  },
  media: {
    id: 'media',
    name: 'Media & Entertainment',
    icon: '🎬',
    color: '#ec4899',
  },
  utilities: {
    id: 'utilities',
    name: 'Utilities',
    icon: '🔧',
    color: '#64748b',
  },
  system: {
    id: 'system',
    name: 'System',
    icon: '⚙️',
    color: '#ef4444',
  },
  other: {
    id: 'other',
    name: 'Other',
    icon: '📦',
    color: '#6b7280',
  },
};

// Category detection patterns
const CATEGORY_PATTERNS: Record<string, RegExp[]> = {
  browsers: [
    /chrome|safari|firefox|edge|brave|opera|vivaldi|arc/i,
    /com\.google\.chrome|com\.apple\.safari|org\.mozilla\.firefox/i,
  ],
  development: [
    /vscode|code|visual studio|xcode|intellij|webstorm|pycharm|sublime|atom|vim|terminal|iterm/i,
    /com\.microsoft\.vscode|com\.apple\.dt\.xcode|com\.jetbrains/i,
    /com\.github\.|git|docker|postman|insomnia/i,
  ],
  design: [
    /figma|sketch|photoshop|illustrator|affinity|canva|pixelmator/i,
    /com\.adobe\.|com\.bohemiancoding\.sketch|com\.figma/i,
  ],
  communication: [
    /slack|discord|teams|zoom|skype|telegram|whatsapp|messages|mail|outlook/i,
    /com\.tinyspeck\.slackmacgap|com\.hnc\.discord|com\.microsoft\.teams/i,
  ],
  productivity: [
    /notion|obsidian|evernote|onenote|todoist|things|calendar|reminders|notes/i,
    /trello|asana|monday|jira|confluence/i,
  ],
  media: [
    /spotify|music|vlc|quicktime|itunes|netflix|youtube|plex/i,
    /com\.spotify\.|com\.apple\.music|org\.videolan\.vlc/i,
  ],
  utilities: [
    /finder|calculator|terminal|activity monitor|disk utility|1password|bitwarden/i,
    /alfred|raycast|spotlight|cleanmymac|bartender/i,
  ],
  system: [
    /system preferences|settings|control panel|task manager/i,
    /com\.apple\.systempreferences|com\.apple\.finder/i,
  ],
};

/**
 * Categorize an application based on its bundle ID and name
 */
export function categorizeApp(bundleId: string, name: string): AppCategory {
  const searchText = `${bundleId} ${name}`.toLowerCase();

  for (const [categoryId, patterns] of Object.entries(CATEGORY_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(searchText)) {
        return APP_CATEGORIES[categoryId];
      }
    }
  }

  return APP_CATEGORIES.other;
}

/**
 * Group applications by category
 */
export function groupAppsByCategory<T extends { bundleId?: string; title: string }>(
  apps: T[]
): Record<string, T[]> {
  const grouped: Record<string, T[]> = {};

  for (const app of apps) {
    const category = categorizeApp(app.bundleId || '', app.title);
    if (!grouped[category.id]) {
      grouped[category.id] = [];
    }
    grouped[category.id].push(app);
  }

  return grouped;
}

/**
 * Get sorted categories with app counts
 */
export function getCategoriesWithCounts<T extends { bundleId?: string; title: string }>(
  apps: T[]
): Array<{ category: AppCategory; count: number; apps: T[] }> {
  const grouped = groupAppsByCategory(apps);
  
  return Object.entries(grouped)
    .map(([categoryId, categoryApps]) => ({
      category: APP_CATEGORIES[categoryId],
      count: categoryApps.length,
      apps: categoryApps,
    }))
    .sort((a, b) => b.count - a.count); // Sort by count descending
}

/**
 * Get category for display with styling
 */
export function getCategoryBadge(bundleId: string, name: string): {
  category: AppCategory;
  style: Record<string, string>;
} {
  const category = categorizeApp(bundleId, name);
  
  // Return style object instead of string for type safety
  const style = {
    background: `${category.color}20`,
    borderColor: `${category.color}40`,
    color: category.color,
  };
  
  return { category, style };
}
