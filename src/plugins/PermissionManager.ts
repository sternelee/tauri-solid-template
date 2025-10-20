import { Permission } from "./types";
import { PermissionDeniedError } from "./errors";
import { tauriCommands } from "../tauri-commands";

export class PermissionManager {
  private grantedPermissions: Set<string> = new Set();

  // Check if a permission is granted
  async checkPermission(permission: Permission): Promise<boolean> {
    const key = `${permission.type}:${permission.description}`;

    // If already granted, return true
    if (this.grantedPermissions.has(key)) {
      return true;
    }

    // Request permission based on type
    try {
      const granted = await this.requestPermission(permission);
      if (granted) {
        this.grantedPermissions.add(key);
      }
      return granted;
    } catch (error) {
      console.warn(`Permission check failed for ${permission.type}:`, error);
      return false;
    }
  }

  // Request permission from system/user
  private async requestPermission(permission: Permission): Promise<boolean> {
    switch (permission.type) {
      case "screen-capture":
        return await tauriCommands.requestScreenshotPermission();

      case "filesystem":
        // For filesystem, we can try a test operation
        try {
          // This is a simplified check - in production you'd want more specific checks
          return true; // Assume granted for now
        } catch {
          return false;
        }

      case "clipboard":
        // Clipboard permission is usually granted automatically
        return true;

      case "notification":
        // Check if notifications are supported and enabled
        return (
          "Notification" in window && Notification.permission === "granted"
        );

      case "global-shortcut":
        // Global shortcuts usually need explicit permission
        return true; // Simplified

      default:
        console.warn(`Unknown permission type: ${permission.type}`);
        return false;
    }
  }

  // Validate plugin permissions
  async validatePluginPermissions(
    permissions: Permission[],
    pluginId: string,
  ): Promise<void> {
    const deniedPermissions: Permission[] = [];

    for (const permission of permissions) {
      const granted = await this.checkPermission(permission);
      if (!granted) {
        deniedPermissions.push(permission);
      }
    }

    if (deniedPermissions.length > 0) {
      throw new PermissionDeniedError(
        deniedPermissions.map((p) => p.type).join(", "),
        pluginId,
      );
    }
  }

  // Revoke permission
  revokePermission(permission: Permission): void {
    const key = `${permission.type}:${permission.description}`;
    this.grantedPermissions.delete(key);
  }

  // Get all granted permissions
  getGrantedPermissions(): string[] {
    return Array.from(this.grantedPermissions);
  }

  // Clear all permissions (useful for testing or logout)
  clearPermissions(): void {
    this.grantedPermissions.clear();
  }
}

// Singleton instance
export const permissionManager = new PermissionManager();
