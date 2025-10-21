// ============================================================================
// Raycast Color Constants Implementation
// ============================================================================
// Based on Raycast API specification for color constants

export enum Color {
  Blue = "raycast-blue",
  Green = "raycast-green",
  Magenta = "raycast-magenta",
  Orange = "raycast-orange",
  Purple = "raycast-purple",
  Red = "raycast-red",
  Yellow = "raycast-yellow",
  PrimaryText = "raycast-primary-text",
  SecondaryText = "raycast-secondary-text",
}

// CSS color mappings for shadcn-solid integration
export const ColorCSS = {
  [Color.Blue]: "#007AFF",
  [Color.Green]: "#34C759",
  [Color.Magenta]: "#AF52DE",
  [Color.Orange]: "#FF9500",
  [Color.Purple]: "#5856D6",
  [Color.Red]: "#FF3B30",
  [Color.Yellow]: "#FFCC00",
  [Color.PrimaryText]: "#000000",
  [Color.SecondaryText]: "#6B7280",
} as const;

// Theme-aware color helpers
export function getColorValue(
  color: Color,
  theme: "light" | "dark" = "light",
): string {
  return ColorCSS[color];
}

