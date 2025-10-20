// Plugin system types
import type { RaycastAPI, RaycastManifest } from './raycast';
export interface PluginMeta {
  id: string;
  name: string;
  version: string;
  description?: string;
  author?: string;
  permissions?: Permission[];
}

// Extended plugin meta for Raycast compatibility
export interface ExtendedPluginMeta extends PluginMeta {
  title?: string;
  icon?: string;
  owner?: string;
  categories?: string[];
  keywords?: string[];
  license?: string;
  changelog?: string;
  raycastCompatible?: boolean;
}

export interface Permission {
  type: 'filesystem' | 'clipboard' | 'notification' | 'global-shortcut' | 'screen-capture' | 'ai' | 'oauth' | 'browser-extension' | 'keyboard';
  description: string;
}

export interface Command {
  id: string;
  title: string;
  description?: string;
  keywords?: string[];
  shortcut?: string;
  icon?: string;
  action: (context?: any) => void | Promise<void>;
}

// Extended command for Raycast compatibility
export interface ExtendedCommand extends Command {
  mode?: 'view' | 'no-view' | 'menu-bar';
  preferences?: any[];
}

export interface PluginInstance {
  meta: PluginMeta;
  commands: Command[];
  ui?: () => JSX.Element;
  onMount?: () => void;
  onUnmount?: () => void;
  onExit?: () => void;
  onResume?: () => void;
  onSuspend?: () => void;
}

// Extended plugin instance for Raycast compatibility
export interface ExtendedPluginInstance extends PluginInstance {
  meta: ExtendedPluginMeta;
  commands: ExtendedCommand[];
  raycastManifest?: any; // Will be populated for Raycast plugins
  raycastAPI?: any; // Will be injected for Raycast plugins
}

export interface WindowConfig {
  mode: 'normal' | 'fullscreen' | 'floating';
  width?: number;
  height?: number;
  transparent?: boolean;
  undecorated?: boolean;
  alwaysOnTop?: boolean;
  resizable?: boolean;
}

export interface PluginContext {
  window: {
    setMode: (mode: WindowConfig['mode']) => void;
    close: () => void;
  };
  invoke: (command: string, args?: any) => Promise<any>;
  showHUD: (text: string) => void;
  onExit: (callback: () => void) => void;
}

// Extended plugin context for Raycast compatibility
export interface ExtendedPluginContext extends PluginContext {
  raycastAPI?: RaycastAPI;
  raycastManifest?: RaycastManifest;
}
