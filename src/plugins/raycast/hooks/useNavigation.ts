// ============================================================================
// Raycast useNavigation Hook Implementation
// ============================================================================
// Based on Raycast API specification for navigation hooks

import { useCallback } from "react";
import type { NavigationHook } from "../types";

let globalNavigationHook: NavigationHook | null = null;

export function setGlobalNavigationHook(hook: NavigationHook): void {
  globalNavigationHook = hook;
}

export function useNavigation(): NavigationHook {
  if (!globalNavigationHook) {
    throw new Error(
      "Navigation hook not initialized. Make sure the plugin system is properly set up.",
    );
  }

  return globalNavigationHook;
}

// Legacy compatibility - for plugins that might expect direct function calls
export function pushNavigation(
  component: React.ReactElement,
  title?: string,
): void {
  const hook = useNavigation();
  hook.push(component, title);
}

export function popNavigation(): void {
  const hook = useNavigation();
  hook.pop();
}

export function popToRootNavigation(): void {
  const hook = useNavigation();
  hook.popToRoot();
}

