// ============================================================================
// Raycast Cache API Implementation
// ============================================================================
// Based on Raycast API specification for cache management
// Integrated with Tauri file system for persistence

import { readFile, writeFile, exists, mkdir } from "@tauri-apps/plugin-fs";
import { join, dirname } from "@tauri-apps/api/path";
import { invoke } from "@tauri-apps/api/core";

interface CacheOptions {
  capacity?: number;
  namespace?: string;
  directory?: string;
  persistent?: boolean;
  ttl?: number; // Time to live in milliseconds
}

interface CacheEntry {
  data: string;
  timestamp: number;
  size: number;
  expiresAt?: number;
}

interface CacheSubscriber {
  (key: string | undefined, data: string | undefined): void;
}

interface CacheSubscription {
  (): void;
}

export class Cache {
  private options: Required<CacheOptions>;
  private cache = new Map<string, CacheEntry>();
  private subscribers = new Set<CacheSubscriber>();
  private totalSize = 0;
  private capacityBytes: number;
  private filePath: string;
  private isLoaded = false;
  private saveTimer: number | null = null;

  constructor(options: CacheOptions = {}) {
    this.options = {
      capacity: options.capacity ?? 10 * 1024 * 1024, // 10MB default
      namespace: options.namespace ?? "default",
      directory: options.directory ?? "flare-cache",
      persistent: options.persistent ?? true,
      ttl: options.ttl ?? 24 * 60 * 60 * 1000, // 24 hours default
    };
    this.capacityBytes = this.options.capacity;
    this.filePath = `cache-${this.options.namespace}.json`;

    // Auto-save every 30 seconds
    this.setupAutoSave();

    // Load existing cache if persistent
    if (this.options.persistent) {
      this.loadFromFile().catch(console.error);
    }
  }

  private setupAutoSave(): void {
    // Save to file every 30 seconds
    this.saveTimer = setInterval(() => {
      if (this.options.persistent) {
        this.saveToFile().catch(console.error);
      }
    }, 30000) as unknown as number;
  }

  private async loadFromFile(): Promise<void> {
    if (!this.options.persistent || this.isLoaded) return;

    try {
      const fileExists = await exists(this.filePath);
      if (!fileExists) return;

      const data = await readFile(this.filePath);
      const jsonData = new TextDecoder().decode(data);
      const parsedCache = JSON.parse(jsonData) as Record<string, CacheEntry>;

      // Filter expired entries
      const now = Date.now();
      for (const [key, entry] of Object.entries(parsedCache)) {
        if (!entry.expiresAt || entry.expiresAt > now) {
          this.cache.set(key, entry);
          this.totalSize += entry.size;
        }
      }

      this.isLoaded = true;
      console.log(`Loaded ${this.cache.size} cache entries from file`);
    } catch (error) {
      console.error("Failed to load cache from file:", error);
      this.isLoaded = true;
    }
  }

  private async saveToFile(): Promise<void> {
    if (!this.options.persistent) return;

    try {
      // Ensure directory exists
      const dir = dirname(this.filePath);
      await mkdir(dir, { recursive: true });

      // Convert cache to JSON
      const cacheData: Record<string, CacheEntry> = {};
      for (const [key, entry] of this.cache) {
        cacheData[key] = entry;
      }

      const jsonData = JSON.stringify(cacheData, null, 2);
      const data = new TextEncoder().encode(jsonData);

      await writeFile(this.filePath, data);
      console.log(`Saved ${this.cache.size} cache entries to file`);
    } catch (error) {
      console.error("Failed to save cache to file:", error);
    }
  }

  get(key: string): string | undefined {
    const entry = this.cache.get(key);
    if (entry) {
      // Check if entry has expired
      if (entry.expiresAt && entry.expiresAt < Date.now()) {
        this.remove(key);
        return undefined;
      }

      // Update access time (LRU behavior)
      entry.timestamp = Date.now();
      return entry.data;
    }
    return undefined;
  }

  async set(key: string, data: string): Promise<void> {
    const size = new Blob([data]).size;
    const now = Date.now();

    // Calculate expiration time
    const expiresAt = this.options.ttl ? now + this.options.ttl : undefined;

    // Remove existing entry if present
    const existingEntry = this.cache.get(key);
    if (existingEntry) {
      this.totalSize -= existingEntry.size;
    }

    // Add new entry
    const entry: CacheEntry = {
      data,
      timestamp: now,
      size,
      expiresAt,
    };

    this.cache.set(key, entry);
    this.totalSize += size;

    // Enforce capacity
    await this.enforceCapacity();

    // Notify subscribers
    this.notifySubscribers(key, data);

    // Auto-save if persistent
    if (this.options.persistent) {
      this.saveToFile().catch(console.error);
    }
  }

  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (entry) {
      // Check if entry has expired
      if (entry.expiresAt && entry.expiresAt < Date.now()) {
        this.remove(key);
        return false;
      }
      return true;
    }
    return false;
  }

  remove(key: string): boolean {
    const entry = this.cache.get(key);
    if (entry) {
      this.totalSize -= entry.size;
      this.cache.delete(key);
      this.notifySubscribers(key, undefined);

      // Auto-save if persistent
      if (this.options.persistent) {
        this.saveToFile().catch(console.error);
      }
      return true;
    }
    return false;
  }

  async clear(): Promise<void> {
    this.cache.clear();
    this.totalSize = 0;
    this.notifySubscribers(undefined, undefined);

    // Auto-save if persistent
    if (this.options.persistent) {
      await this.saveToFile();
    }
  }

  subscribe(subscriber: CacheSubscriber): CacheSubscription {
    this.subscribers.add(subscriber);
    return () => {
      this.subscribers.delete(subscriber);
    };
  }

  get isEmpty(): boolean {
    return this.cache.size === 0;
  }

  get size(): number {
    return this.cache.size;
  }

  get usedSpace(): number {
    return this.totalSize;
  }

  get availableSpace(): number {
    return Math.max(0, this.capacityBytes - this.totalSize);
  }

  // Cleanup expired entries
  async cleanup(): Promise<number> {
    const now = Date.now();
    const expiredKeys: string[] = [];

    for (const [key, entry] of this.cache) {
      if (entry.expiresAt && entry.expiresAt < now) {
        expiredKeys.push(key);
      }
    }

    for (const key of expiredKeys) {
      this.remove(key);
    }

    if (expiredKeys.length > 0 && this.options.persistent) {
      await this.saveToFile();
    }

    return expiredKeys.length;
  }

  private async enforceCapacity(): Promise<void> {
    while (this.totalSize > this.capacityBytes && this.cache.size > 0) {
      // Find least recently used entry
      let lruKey: string | undefined;
      let lruTime = Date.now();

      for (const [key, entry] of this.cache) {
        if (entry.timestamp < lruTime) {
          lruTime = entry.timestamp;
          lruKey = key;
        }
      }

      if (lruKey) {
        const entry = this.cache.get(lruKey)!;
        this.totalSize -= entry.size;
        this.cache.delete(lruKey);
      }
    }
  }

  private notifySubscribers(
    key: string | undefined,
    data: string | undefined,
  ): void {
    for (const subscriber of this.subscribers) {
      try {
        subscriber(key, data);
      } catch (error) {
        console.error("Cache subscriber error:", error);
      }
    }
  }

  // Destroy the cache instance
  destroy(): void {
    if (this.saveTimer) {
      clearInterval(this.saveTimer);
      this.saveTimer = null;
    }

    // Final save
    if (this.options.persistent) {
      this.saveToFile().catch(console.error);
    }

    this.subscribers.clear();
  }
}

// Cache manager for multiple instances
export class CacheManager {
  private static instances = new Map<string, Cache>();

  static getInstance(options: CacheOptions = {}): Cache {
    const key = options.namespace ?? "default";

    if (!this.instances.has(key)) {
      const cache = new Cache(options);
      this.instances.set(key, cache);
    }

    return this.instances.get(key)!;
  }

  static destroyInstance(namespace: string = "default"): void {
    const cache = this.instances.get(namespace);
    if (cache) {
      cache.destroy();
      this.instances.delete(namespace);
    }
  }

  static async cleanupAll(): Promise<void> {
    for (const cache of this.instances.values()) {
      await cache.cleanup();
    }
  }

  static destroyAll(): void {
    for (const [namespace] of this.instances) {
      this.destroyInstance(namespace);
    }
  }
}
