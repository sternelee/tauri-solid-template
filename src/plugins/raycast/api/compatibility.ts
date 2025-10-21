// ============================================================================
// Raycast API Compatibility Layer Implementation
// ============================================================================
// Based on design.md requirements for backward compatibility and plugin migration

import * as React from "react";
import type { RaycastAPI, RaycastManifest, RaycastCommand } from "../types";
import type { APIContextManager } from "./context";
import type { APIValidator } from "./validator";

// ============================================================================
// Compatibility Layer Interface
// ============================================================================

export interface CompatibilityLayer {
  migratePlugin(pluginCode: string, manifest: RaycastManifest): MigratedPlugin;
  wrapPluginFunction(pluginFunction: Function, api: RaycastAPI): Function;
  handleLegacyAPI(legacyAPI: any): RaycastAPI;
  validateCompatibility(manifest: RaycastManifest): CompatibilityReport;
  generateMigrationGuide(manifest: RaycastManifest): MigrationGuide;
}

// ============================================================================
// Migration Types
// ============================================================================

export interface MigratedPlugin {
  code: string;
  manifest: RaycastManifest;
  migrations: AppliedMigration[];
  warnings: string[];
  errors: string[];
}

export interface AppliedMigration {
  type: MigrationType;
  description: string;
  originalCode: string;
  newCode: string;
  line?: number;
}

export enum MigrationType {
  API_REPLACEMENT = "api_replacement",
  COMPONENT_REPLACEMENT = "component_replacement",
  PROP_UPDATE = "prop_update",
  IMPORT_UPDATE = "import_update",
  HOOK_UPDATE = "hook_update",
}

export interface CompatibilityReport {
  isCompatible: boolean;
  compatibilityScore: number;
  issues: CompatibilityIssue[];
  recommendations: string[];
}

export interface CompatibilityIssue {
  type: "error" | "warning" | "info";
  code: string;
  message: string;
  line?: number;
  fix?: string;
}

export interface MigrationGuide {
  steps: MigrationStep[];
  examples: MigrationExample[];
  notes: string[];
}

export interface MigrationStep {
  title: string;
  description: string;
  code?: string;
  automated: boolean;
}

export interface MigrationExample {
  title: string;
  before: string;
  after: string;
  explanation: string;
}

// ============================================================================
// Compatibility Layer Implementation
// ============================================================================

export class CompatibilityLayerImpl implements CompatibilityLayer {
  private apiMigrations: Map<string, APIMigration>;
  private componentMigrations: Map<string, ComponentMigration>;
  private deprecatedAPIs: Set<string>;

  constructor() {
    this.initializeMigrations();
  }

  // ============================================================================
  // Plugin Migration
  // ============================================================================

  migratePlugin(pluginCode: string, manifest: RaycastManifest): MigratedPlugin {
    const migrations: AppliedMigration[] = [];
    const warnings: string[] = [];
    const errors: string[] = [];

    let migratedCode = pluginCode;

    // Apply API migrations
    for (const [api, migration] of this.apiMigrations) {
      if (migratedCode.includes(api)) {
        const result = migration.transform(migratedCode);
        if (result.changed) {
          migrations.push({
            type: MigrationType.API_REPLACEMENT,
            description: migration.description,
            originalCode: result.original,
            newCode: result.transformed,
          });
          migratedCode = result.transformed;
        }
      }
    }

    // Apply component migrations
    for (const [component, migration] of this.componentMigrations) {
      if (migratedCode.includes(component)) {
        const result = migration.transform(migratedCode);
        if (result.changed) {
          migrations.push({
            type: MigrationType.COMPONENT_REPLACEMENT,
            description: migration.description,
            originalCode: result.original,
            newCode: result.transformed,
          });
          migratedCode = result.transformed;
        }
      }
    }

    // Check for deprecated APIs
    for (const deprecatedAPI of this.deprecatedAPIs) {
      if (migratedCode.includes(deprecatedAPI)) {
        warnings.push(
          `Deprecated API used: ${deprecatedAPI}. Consider updating to the new API.`,
        );
      }
    }

    return {
      code: migratedCode,
      manifest,
      migrations,
      warnings,
      errors,
    };
  }

  wrapPluginFunction(pluginFunction: Function, api: RaycastAPI): Function {
    return function (...args: any[]) {
      // Inject API into the function context
      const context = {
        ...api,
        // Global variables that might be expected by legacy plugins
        console: console,
        process: typeof process !== "undefined" ? process : undefined,
      };

      // Execute the plugin function with the API context
      return pluginFunction.apply(context, args);
    };
  }

  handleLegacyAPI(legacyAPI: any): RaycastAPI {
    // Transform legacy API calls to new API format
    const transformedAPI: Partial<RaycastAPI> = {};

    // Handle common legacy API patterns
    if (legacyAPI.showHUD) {
      transformedAPI.showHUD = legacyAPI.showHUD;
    }

    if (legacyAPI.showToast) {
      transformedAPI.showToast = legacyAPI.showToast;
    }

    if (legacyAPI.Clipboard) {
      transformedAPI.Clipboard = this.transformLegacyClipboardAPI(
        legacyAPI.Clipboard,
      );
    }

    if (legacyAPI.useNavigation) {
      transformedAPI.useNavigation = this.transformLegacyNavigationHook(
        legacyAPI.useNavigation,
      );
    }

    return transformedAPI as RaycastAPI;
  }

  // ============================================================================
  // Compatibility Validation
  // ============================================================================

  validateCompatibility(manifest: RaycastManifest): CompatibilityReport {
    const issues: CompatibilityIssue[] = [];
    let compatibilityScore = 100;

    // Check manifest version compatibility
    const versionIssue = this.checkManifestVersion(manifest);
    if (versionIssue) {
      issues.push(versionIssue);
      compatibilityScore -= 20;
    }

    // Check command compatibility
    const commandIssues = this.checkCommandCompatibility(manifest.commands);
    issues.push(...commandIssues);
    compatibilityScore -= commandIssues.length * 5;

    // Check preference compatibility
    if (manifest.preferences) {
      const preferenceIssues = this.checkPreferenceCompatibility(
        manifest.preferences,
      );
      issues.push(...preferenceIssues);
      compatibilityScore -= preferenceIssues.length * 3;
    }

    // Generate recommendations
    const recommendations = this.generateRecommendations(issues);

    return {
      isCompatible: compatibilityScore >= 70,
      compatibilityScore: Math.max(0, compatibilityScore),
      issues,
      recommendations,
    };
  }

  // ============================================================================
  // Migration Guide Generation
  // ============================================================================

  generateMigrationGuide(manifest: RaycastManifest): MigrationGuide {
    const steps: MigrationStep[] = [];
    const examples: MigrationExample[] = [];
    const notes: string[] = [];

    // General migration steps
    steps.push(
      {
        title: "Update Imports",
        description: "Update your imports to use the new Raycast API structure",
        code: 'import { List, Action, showToast } from "@raycast/api";',
        automated: true,
      },
      {
        title: "Replace Legacy Components",
        description: "Update component usage to match new API patterns",
        automated: true,
      },
      {
        title: "Update Hook Usage",
        description: "Migrate to the new hook system for state and navigation",
        automated: false,
      },
      {
        title: "Test Plugin Functionality",
        description: "Test all plugin functionality to ensure compatibility",
        automated: false,
      },
    );

    // Add specific examples based on manifest
    if (manifest.commands.some((cmd) => cmd.mode === "view")) {
      examples.push({
        title: "List Component Migration",
        before: `
<List>
  {items.map(item => (
    <List.Item key={item.id} title={item.name} />
  ))}
</List>`,
        after: `
<List>
  {items.map(item => (
    <List.Item key={item.id} title={item.name} />
  ))}
</List>`,
        explanation:
          "List component usage remains the same, but now uses shadcn-solid under the hood",
      });
    }

    // Add notes
    notes.push(
      "The new API provides better performance through shadcn-solid integration",
      "Shadow DOM rendering ensures better isolation between plugins",
      "TypeScript support has been improved with stricter type checking",
      "New permission system provides better security controls",
    );

    return {
      steps,
      examples,
      notes,
    };
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  private initializeMigrations(): void {
    this.apiMigrations = new Map();
    this.componentMigrations = new Map();
    this.deprecatedAPIs = new Set();

    // Initialize API migrations
    this.apiMigrations.set("LaunchAction", {
      description: "Replace LaunchAction with Action.OpenInBrowser",
      transform: (code: string) => {
        const regex = /LaunchAction\s*\(\s*{\s*target\s*:\s*([^}]+)\s*}\s*\)/g;
        const transformed = code.replace(
          regex,
          "Action.OpenInBrowser({ url: $1 })",
        );
        return {
          changed: transformed !== code,
          original: code,
          transformed,
        };
      },
    });

    this.apiMigrations.set("CopyToClipboard", {
      description: "Replace CopyToClipboard with Action.CopyToClipboard",
      transform: (code: string) => {
        const regex =
          /CopyToClipboard\s*\(\s*{\s*content\s*:\s*([^}]+)\s*}\s*\)/g;
        const transformed = code.replace(
          regex,
          "Action.CopyToClipboard({ content: $1 })",
        );
        return {
          changed: transformed !== code,
          original: code,
          transformed,
        };
      },
    });

    // Initialize component migrations
    this.componentMigrations.set("Detail.Metadata.Separator", {
      description: "Update Detail.Metadata.Separator usage",
      transform: (code: string) => {
        const regex = /Detail\.Metadata\.Separator\s*\(\s*\)/g;
        const transformed = code.replace(regex, "Detail.Metadata.Separator");
        return {
          changed: transformed !== code,
          original: code,
          transformed,
        };
      },
    });

    // Initialize deprecated APIs
    this.deprecatedAPIs.add("getApplications");
    this.deprecatedAPIs.add("getDefaultApplication");
    this.deprecatedAPIs.add("getFrontmostApplication");
  }

  private transformLegacyClipboardAPI(legacyClipboard: any): any {
    return {
      copy:
        legacyClipboard.copy ||
        ((text: string) => legacyClipboard.writeText(text)),
      paste: legacyClipboard.paste || (() => legacyClipboard.readText()),
      clear: legacyClipboard.clear,
      read: legacyClipboard.read,
      readText: legacyClipboard.readText,
    };
  }

  private transformLegacyNavigationHook(legacyHook: any): any {
    return () => ({
      push:
        legacyHook.push ||
        ((component: React.ReactElement) => legacyHook(component)),
      pop: legacyHook.pop,
      popToRoot: legacyHook.popToRoot,
    });
  }

  private checkManifestVersion(
    manifest: RaycastManifest,
  ): CompatibilityIssue | null {
    // In a real implementation, this would check against supported versions
    return null; // Placeholder
  }

  private checkCommandCompatibility(
    commands: RaycastCommand[],
  ): CompatibilityIssue[] {
    const issues: CompatibilityIssue[] = [];

    commands.forEach((command, index) => {
      if (!command.mode) {
        issues.push({
          type: "warning",
          code: "MISSING_COMMAND_MODE",
          message: `Command '${command.name}' should specify a mode (view, no-view, menu-bar)`,
          line: index + 1,
          fix: "Add mode property to command definition",
        });
      }
    });

    return issues;
  }

  private checkPreferenceCompatibility(
    preferences: any[],
  ): CompatibilityIssue[] {
    const issues: CompatibilityIssue[] = [];

    preferences.forEach((pref, index) => {
      if (pref.type === "dropdown" && !pref.data) {
        issues.push({
          type: "warning",
          code: "DROPDOWN_WITHOUT_DATA",
          message: `Preference '${pref.name}' of type dropdown should include data field`,
          line: index + 1,
          fix: "Add data array with dropdown options",
        });
      }
    });

    return issues;
  }

  private generateRecommendations(issues: CompatibilityIssue[]): string[] {
    const recommendations: string[] = [];

    if (issues.some((issue) => issue.code === "MISSING_COMMAND_MODE")) {
      recommendations.push(
        "Add mode property to all command definitions for better compatibility",
      );
    }

    if (issues.some((issue) => issue.code === "DROPDOWN_WITHOUT_DATA")) {
      recommendations.push("Provide data arrays for all dropdown preferences");
    }

    recommendations.push(
      "Test your plugin with the new API before releasing",
      "Update your TypeScript types to match the new API",
      "Consider using the new shadcn-solid based components for better performance",
    );

    return recommendations;
  }
}

// ============================================================================
// Migration Types
// ============================================================================

interface APIMigration {
  description: string;
  transform: (code: string) => {
    changed: boolean;
    original: string;
    transformed: string;
  };
}

interface ComponentMigration {
  description: string;
  transform: (code: string) => {
    changed: boolean;
    original: string;
    transformed: string;
  };
}

// ============================================================================
// Factory Function
// ============================================================================

export function createCompatibilityLayer(): CompatibilityLayer {
  return new CompatibilityLayerImpl();
}

// ============================================================================
// Utility Functions
// ============================================================================

export function detectLegacyPatterns(code: string): string[] {
  const patterns: string[] = [];

  // Check for legacy import patterns
  if (code.includes("import { LaunchAction }")) {
    patterns.push("Legacy LaunchAction import");
  }

  if (code.includes("import { CopyToClipboard }")) {
    patterns.push("Legacy CopyToClipboard import");
  }

  // Check for legacy component usage
  if (code.includes("Detail.Metadata.Separator()")) {
    patterns.push("Legacy Detail.Metadata.Separator usage");
  }

  // Check for deprecated APIs
  const deprecatedAPIs = [
    "getApplications",
    "getDefaultApplication",
    "getFrontmostApplication",
  ];
  deprecatedAPIs.forEach((api) => {
    if (code.includes(api)) {
      patterns.push(`Deprecated API: ${api}`);
    }
  });

  return patterns;
}

export function estimateMigrationEffort(
  code: string,
  manifest: RaycastManifest,
): {
  timeEstimate: string;
  complexity: "low" | "medium" | "high";
  automatedPercentage: number;
} {
  const legacyPatterns = detectLegacyPatterns(code);
  const commandCount = manifest.commands.length;
  const preferenceCount = manifest.preferences?.length || 0;

  let complexity: "low" | "medium" | "high" = "low";
  let timeEstimate = "5-15 minutes";
  let automatedPercentage = 90;

  if (legacyPatterns.length > 5 || commandCount > 10 || preferenceCount > 10) {
    complexity = "high";
    timeEstimate = "30-60 minutes";
    automatedPercentage = 70;
  } else if (
    legacyPatterns.length > 2 ||
    commandCount > 5 ||
    preferenceCount > 5
  ) {
    complexity = "medium";
    timeEstimate = "15-30 minutes";
    automatedPercentage = 80;
  }

  return {
    timeEstimate,
    complexity,
    automatedPercentage,
  };
}
