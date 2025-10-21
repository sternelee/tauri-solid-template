// ============================================================================
// Raycast Image Constants Implementation
// ============================================================================
// Based on Raycast API specification for image types

export enum ImageMask {
  Circle = "circle",
  RoundedRectangle = "roundedRectangle",
}

export interface ImageOptions {
  source: string;
  mask?: ImageMask;
  tintColor?: string;
  fallback?: string;
}

