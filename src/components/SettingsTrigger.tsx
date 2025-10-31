import { createSignal } from "solid-js";
import { useGlobalSettings } from "./SettingsManager";
import { open } from "@tauri-apps/api/shell";

export default function SettingsTrigger() {
  const [showTooltip, setShowTooltip] = createSignal(false);
  const settings = useGlobalSettings();

  const handleOpenSettings = async () => {
    const success = await settings.openSettingsWindow();
    if (!success) {
      console.error("Failed to open settings window");
    }
  };

  const handleOpenAIKeys = () => {
    open("https://platform.openai.com/api-keys");
  };

  const handleOpenClaudeKeys = () => {
    open("https://console.anthropic.com/");
  };

  const handleOpenGoogleKeys = () => {
    open("https://aistudio.google.com/app/apikey");
  };

  return (
    <div class="relative inline-block">
      {/* Settings Button */}
      <button
        class="flex cursor-pointer items-center gap-2 rounded-lg border border-white/10 bg-white/5 p-3 text-sm font-medium text-white/90 transition-all hover:border-white/20 hover:bg-white/10"
        onClick={handleOpenSettings}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <circle cx="12" cy="12" r="3"></circle>
          <path d="M12 1v6m0 6v6m4.22-13.22l4.24 4.24M1.54 1.54l4.24 4.24M1 12h6m6 0h6m-13.22 4.22l-4.24 4.24M16.24 16.24l4.24 4.24"></path>
        </svg>
        <span class="text-white/60 transition-colors hover:text-white/90">
          设置
        </span>
      </button>

      {/* Tooltip */}
      <Show when={showTooltip()}>
        <div class="animate-slide-up absolute top-full left-1/2 z-50 mt-2 min-w-[280px] -translate-x-1/2 transform">
          <div class="rounded-xl border border-white/10 bg-white/5 p-4 shadow-xl backdrop-blur-lg">
            <h4 class="m-0 mb-3 text-center text-sm font-semibold text-white/90">
              快速配置
            </h4>
            <div class="flex flex-col gap-2">
              <button
                class="flex cursor-pointer items-center gap-3 rounded-lg border border-white/10 bg-white/5 p-2.5 text-left text-xs text-white/90 transition-all hover:border-white/20 hover:bg-white/10"
                onClick={handleOpenAIKeys}
              >
                <span class="w-5 text-center text-base">🤖</span>
                <span>OpenAI API Keys</span>
              </button>
              <button
                class="flex cursor-pointer items-center gap-3 rounded-lg border border-white/10 bg-white/5 p-2.5 text-left text-xs text-white/90 transition-all hover:border-white/20 hover:bg-white/10"
                onClick={handleOpenClaudeKeys}
              >
                <span class="w-5 text-center text-base">🧠</span>
                <span>Claude API Keys</span>
              </button>
              <button
                class="flex cursor-pointer items-center gap-3 rounded-lg border border-white/10 bg-white/5 p-2.5 text-left text-xs text-white/90 transition-all hover:border-white/20 hover:bg-white/10"
                onClick={handleOpenGoogleKeys}
              >
                <span class="w-5 text-center text-base">🔍</span>
                <span>Google API Keys</span>
              </button>
              <button
                class="flex cursor-pointer items-center gap-3 rounded-lg border border-white/10 bg-white/5 p-2.5 text-left text-xs text-white/90 transition-all hover:border-white/20 hover:bg-white/10"
                onClick={handleOpenSettings}
              >
                <span class="w-5 text-center text-base">⚙️</span>
                <span>完整设置</span>
              </button>
            </div>
          </div>
          <div class="absolute top-[-6px] left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 transform border border-r-0 border-b-0 border-white/10 bg-white/5"></div>
        </div>
      </Show>
    </div>
  );
}

