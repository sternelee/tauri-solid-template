// ============================================================================
// Raycast Environment API Implementation
// ============================================================================
// Based on Raycast API specification for environment constants
// Integrated with Tauri system APIs

import { LaunchType } from "../constants/launchType";
import { getVersion } from "@tauri-apps/api/app";
import { platform, arch, version } from "@tauri-apps/plugin-os";
import { invoke } from "@tauri-apps/api/core";

// Dynamic environment values
let cachedEnvironment: ReturnType<typeof createEnvironment> | null = null;

function createEnvironment() {
  return {
    // Appearance detection - could be enhanced with system theme detection
    get appearance(): "light" | "dark" {
      // For now, default to dark. Could be enhanced with Tauri plugin or system detection
      return "dark" as const;
    },

    // Assets path - use Tauri's resource directory
    get assetsPath(): string {
      // This would typically be resolved to the app's assets directory
      return "/assets";
    },

    // Command mode - determined by how the command was invoked
    get commandMode(): "view" | "no-view" {
      // This could be determined by command context
      return "view" as const;
    },

    // Current command name - should be dynamic based on active command
    get commandName(): string {
      // This would be set by the plugin system when a command is executed
      return "default";
    },

    // Extension name - could be read from package.json or manifest
    get extensionName(): string {
      return "Flare"; // Could be made configurable
    },

    // Development mode detection
    get isDevelopment(): boolean {
      return import.meta.env.DEV || true; // Default to true for development
    },

    // Launch type - how the extension was launched
    get launchType(): LaunchType {
      return LaunchType.UserInitiated;
    },

    // Author/owner information
    get ownerOrAuthorName(): string {
      return "Flare"; // Could be read from configuration
    },

    // Application version
    get raycastVersion(): string {
      // Use the actual application version
      try {
        return getVersion() || "1.0.0";
      } catch {
        return "1.0.0";
      }
    },

    // Support path - use app data directory
    get supportPath(): string {
      // This would resolve to the app's data/support directory
      return "/tmp/flare-support";
    },

    // Text size preference
    get textSize(): "small" | "medium" | "large" {
      return "medium" as const;
    },

    // Feature access control
    canAccess: (feature: { name: string }): boolean => {
      // Check if the feature is available and permitted
      const supportedFeatures = [
        "AI",
        "BrowserExtension",
        "Clipboard",
        "FileSystem",
        "Network",
        "Notifications",
        "GlobalShortcuts",
      ];

      // Additional checks could be added here based on permissions
      if (!supportedFeatures.includes(feature.name)) {
        console.warn(`Feature "${feature.name}" is not supported`);
        return false;
      }

      // Check for specific platform availability
      return checkPlatformAvailability(feature.name);
    },

    // System information
    get systemInfo() {
      return {
        platform: platform(),
        arch: arch(),
        osVersion: version(),
      };
    },

    // Application information
    get appInfo() {
      return {
        name: "Flare",
        version: this.raycastVersion,
        environment: this.isDevelopment ? "development" : "production",
      };
    },
  };
}

// Helper function to check platform-specific feature availability
function checkPlatformAvailability(feature: string): boolean {
  const currentPlatform = platform();

  // Platform-specific feature restrictions
  const platformRestrictions: Record<string, string[]> = {
    // Windows-only features
    windows: [],
    // macOS-only features
    macos: [],
    // Linux-only features
    linux: [],
  };

  // Check if feature is restricted on current platform
  const restrictedFeatures = platformRestrictions[currentPlatform] || [];
  return !restrictedFeatures.includes(feature);
}

// Export the environment object
export const environment = cachedEnvironment || createEnvironment();

// Function to refresh environment (useful for dynamic updates)
export function refreshEnvironment(): void {
  cachedEnvironment = createEnvironment();
}

// Function to get specific environment value with caching
export function getEnvironmentValue<
  K extends keyof ReturnType<typeof createEnvironment>,
>(key: K): ReturnType<typeof createEnvironment>[K] {
  if (!cachedEnvironment) {
    cachedEnvironment = createEnvironment();
  }
  return cachedEnvironment[key];
}

// Additional environment utilities
export const environmentUtils = {
  // Check if running in development mode
  isDevMode(): boolean {
    return environment.isDevelopment;
  },

  // Get current platform info
  async getPlatformInfo(): Promise<{
    platform: string;
    arch: string;
    version: string;
  }> {
    return {
      platform: platform(),
      arch: arch(),
      version: version(),
    };
  },

  // Check if specific feature is available
  isFeatureAvailable(feature: string): boolean {
    return environment.canAccess({ name: feature });
  },

  // Get application version
  async getAppVersion(): Promise<string> {
    try {
      return await getVersion();
    } catch {
      return environment.raycastVersion;
    }
  },
};
