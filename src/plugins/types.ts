// Plugin system types
export interface PluginMeta {
  id: string;
  name: string;
  version: string;
  description?: string;
  author?: string;
  permissions?: Permission[];
}

export interface Permission {
  type: 'filesystem' | 'clipboard' | 'notification' | 'global-shortcut' | 'screen-capture';
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
