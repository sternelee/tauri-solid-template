/**
 * Recent Applications Manager
 * Tracks and manages recently used applications with persistence
 */

import { Store } from '@tauri-apps/plugin-store';

export interface RecentApp {
  id: string;
  name: string;
  bundleId: string;
  lastUsed: number;
  usageCount: number;
}

const RECENT_APPS_KEY = 'recent_apps';
const MAX_RECENT_APPS = 50;

let store: Store | null = null;

/**
 * Initialize the store
 */
async function getStore(): Promise<Store> {
  if (!store) {
    store = await Store.load('recent_apps.json');
  }
  return store;
}

/**
 * Get all recent applications, sorted by last used
 */
export async function getRecentApps(): Promise<RecentApp[]> {
  try {
    const st = await getStore();
    const apps = (await st.get<RecentApp[]>(RECENT_APPS_KEY)) || [];
    // Sort by last used (most recent first)
    return apps.sort((a, b) => b.lastUsed - a.lastUsed);
  } catch (error) {
    console.error('Failed to get recent apps:', error);
    return [];
  }
}

/**
 * Get frequently used applications (sorted by usage count)
 */
export async function getFrequentApps(limit: number = 10): Promise<RecentApp[]> {
  try {
    const apps = await getRecentApps();
    // Sort by usage count (most used first)
    return apps
      .sort((a, b) => b.usageCount - a.usageCount)
      .slice(0, limit);
  } catch (error) {
    console.error('Failed to get frequent apps:', error);
    return [];
  }
}

/**
 * Add or update a recent application
 */
export async function addRecentApp(
  id: string,
  name: string,
  bundleId: string
): Promise<void> {
  try {
    const st = await getStore();
    const apps = (await st.get<RecentApp[]>(RECENT_APPS_KEY)) || [];
    
    // Find existing app
    const existingIndex = apps.findIndex(app => app.id === id || app.bundleId === bundleId);
    
    if (existingIndex >= 0) {
      // Update existing app
      apps[existingIndex] = {
        ...apps[existingIndex],
        name, // Update name in case it changed
        lastUsed: Date.now(),
        usageCount: apps[existingIndex].usageCount + 1,
      };
    } else {
      // Add new app
      apps.push({
        id,
        name,
        bundleId,
        lastUsed: Date.now(),
        usageCount: 1,
      });
    }
    
    // Keep only the most recent MAX_RECENT_APPS
    const sortedApps = apps
      .sort((a, b) => b.lastUsed - a.lastUsed)
      .slice(0, MAX_RECENT_APPS);
    
    await st.set(RECENT_APPS_KEY, sortedApps);
    await st.save();
  } catch (error) {
    console.error('Failed to add recent app:', error);
  }
}

/**
 * Clear all recent applications
 */
export async function clearRecentApps(): Promise<void> {
  try {
    const st = await getStore();
    await st.set(RECENT_APPS_KEY, []);
    await st.save();
  } catch (error) {
    console.error('Failed to clear recent apps:', error);
  }
}

/**
 * Remove a specific app from recent apps
 */
export async function removeRecentApp(id: string): Promise<void> {
  try {
    const st = await getStore();
    const apps = (await st.get<RecentApp[]>(RECENT_APPS_KEY)) || [];
    const filteredApps = apps.filter(app => app.id !== id);
    await st.set(RECENT_APPS_KEY, filteredApps);
    await st.save();
  } catch (error) {
    console.error('Failed to remove recent app:', error);
  }
}
