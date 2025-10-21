// ============================================================================
// Raycast Components Library - Main Entry Point
// ============================================================================
// Shadow DOM compatible Raycast UI components for Tauri applications

// Core exports
export * from './components';
export * from './types';
export * from './shadow-dom-adapter';

// API integration
export { RaycastTauriBridge } from '../api/tauri-bridge';
export { Clipboard, AI, Cache, environment } from '../api';

// Version and metadata
export const VERSION = '1.0.0';
export const BUILD_DATE = new Date().toISOString();
export const SUPPORTED_COMPONENTS = [
  'List',
  'List.Item',
  'List.Section',
  'List.EmptyView',
  'Detail',
  'Detail.Metadata',
  'Form',
  'Form.TextField',
  'Form.TextArea',
  'Grid',
  'Grid.Item',
  'Action',
  'ActionPanel',
] as const;

// Compatibility information
export const RAYCAST_COMPATIBILITY = {
  minVersion: '1.0.0',
  supportedFeatures: [
    'shadow-dom',
    'css-isolation',
    'api-injection',
    'component-registry',
    'plugin-sandboxing',
  ] as const,
};

// Development helpers
export const isDevelopment = import.meta.env.DEV;
export const debug = (...args: any[]) => {
  if (isDevelopment) {
    console.log('[Raycast Components]', ...args);
  }
};

// Initialize library
debug(`Raycast Components v${VERSION} loaded`);
debug(`Supported components: ${SUPPORTED_COMPONENTS.length}`);
debug(`Build date: ${BUILD_DATE}`);
debug(`Raycast compatibility: ${RAYCAST_COMPATIBILITY.minVersion}+`);