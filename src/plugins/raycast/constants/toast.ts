// ============================================================================
// Raycast Toast Constants Implementation
// ============================================================================
// Based on Raycast API specification for toast styles

export enum Toast {
  Style = "SUCCESS",
  Success = "SUCCESS",
  Failure = "FAILURE",
  Animated = "ANIMATED",
}

export type ToastStyle = Toast.Style | "SUCCESS" | "FAILURE" | "ANIMATED";

