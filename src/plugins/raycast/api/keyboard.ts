// ============================================================================
// Raycast Keyboard API Implementation
// ============================================================================
// Based on Raycast API specification for keyboard interactions

export interface KeyboardShortcut {
  modifiers: Array<"cmd" | "ctrl" | "opt" | "shift">;
  key: string;
}

export class Keyboard {
  static Shortcut = {
    Common: {
      Copy: { modifiers: ["cmd", "shift"], key: "c" },
      CopyDeeplink: { modifiers: ["cmd", "shift"], key: "c" },
      CopyName: { modifiers: ["cmd", "shift"], key: "." },
      CopyPath: { modifiers: ["cmd", "shift"], key: "," },
      Duplicate: { modifiers: ["cmd"], key: "d" },
      Edit: { modifiers: ["cmd"], key: "e" },
      MoveDown: { modifiers: ["cmd", "shift"], key: "arrowDown" },
      MoveUp: { modifiers: ["cmd", "shift"], key: "arrowUp" },
      New: { modifiers: ["cmd"], key: "n" },
      Open: { modifiers: ["cmd"], key: "o" },
      OpenWith: { modifiers: ["cmd", "shift"], key: "o" },
      Pin: { modifiers: ["cmd", "shift"], key: "p" },
      Refresh: { modifiers: ["cmd"], key: "r" },
      Remove: { modifiers: ["cmd"], key: "x" },
      RemoveAll: { modifiers: ["cmd", "shift"], key: "x" },
      ToggleQuickLook: { modifiers: ["cmd"], key: "y" },
    } satisfies Record<string, KeyboardShortcut>,
  };
}

