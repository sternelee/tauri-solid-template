// Plugin system entry point
export { pluginManager } from "./PluginManager";
export { definePlugin, usePluginContext } from "./PluginSDK";
export { windowManager } from "./WindowManager";
export * from "./types";

// Auto-load built-in plugins
import "./example-screenshot/index";
