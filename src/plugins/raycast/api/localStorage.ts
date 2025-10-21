// ============================================================================
// Raycast LocalStorage API Implementation
// ============================================================================
// Based on Raycast API specification for local storage

export class LocalStorage {
  private prefix: string;

  constructor(pluginId: string) {
    this.prefix = `raycast-plugin-${pluginId}-`;
  }

  getItem(key: string): string | null {
    try {
      return localStorage.getItem(this.prefix + key);
    } catch (error) {
      console.error("LocalStorage.getItem error:", error);
      return null;
    }
  }

  setItem(key: string, value: string): void {
    try {
      localStorage.setItem(this.prefix + key, value);
    } catch (error) {
      console.error("LocalStorage.setItem error:", error);
      throw error;
    }
  }

  removeItem(key: string): void {
    try {
      localStorage.removeItem(this.prefix + key);
    } catch (error) {
      console.error("LocalStorage.removeItem error:", error);
    }
  }

  clear(): void {
    try {
      const keys = Object.keys(localStorage);
      keys.forEach((key) => {
        if (key.startsWith(this.prefix)) {
          localStorage.removeItem(key);
        }
      });
    } catch (error) {
      console.error("LocalStorage.clear error:", error);
    }
  }

  key(index: number): string | null {
    try {
      const keys = Object.keys(localStorage)
        .filter((key) => key.startsWith(this.prefix))
        .map((key) => key.slice(this.prefix.length));
      return keys[index] || null;
    } catch (error) {
      console.error("LocalStorage.key error:", error);
      return null;
    }
  }

  get length(): number {
    try {
      return Object.keys(localStorage).filter((key) =>
        key.startsWith(this.prefix),
      ).length;
    } catch (error) {
      console.error("LocalStorage.length error:", error);
      return 0;
    }
  }
}

