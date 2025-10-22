import { createSignal } from 'solid-js';
import { useGlobalSettings } from './SettingsManager';
import { open } from '@tauri-apps/api/shell';

export default function SettingsTrigger() {
  const [showTooltip, setShowTooltip] = createSignal(false);
  const settings = useGlobalSettings();

  const handleOpenSettings = async () => {
    const success = await settings.openSettingsWindow();
    if (!success) {
      console.error('Failed to open settings window');
    }
  };

  const handleOpenAIKeys = () => {
    open('https://platform.openai.com/api-keys');
  };

  const handleOpenClaudeKeys = () => {
    open('https://console.anthropic.com/');
  };

  const handleOpenGoogleKeys = () => {
    open('https://aistudio.google.com/app/apikey');
  };

  return (
    <div class="settings-trigger-container">
      {/* Settings Button */}
      <button
        class="settings-trigger-btn"
        onClick={handleOpenSettings}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="3"></circle>
          <path d="M12 1v6m0 6v6m4.22-13.22l4.24 4.24M1.54 1.54l4.24 4.24M1 12h6m6 0h6m-13.22 4.22l-4.24 4.24M16.24 16.24l4.24 4.24"></path>
        </svg>
        <span class="settings-trigger-text">设置</span>
      </button>

      {/* Tooltip */}
      <Show when={showTooltip()}>
        <div class="settings-tooltip">
          <div class="tooltip-content">
            <h4>快速配置</h4>
            <div class="tooltip-actions">
              <button class="tooltip-action-btn" onClick={handleOpenAIKeys}>
                <span class="provider-icon">🤖</span>
                <span>OpenAI API Keys</span>
              </button>
              <button class="tooltip-action-btn" onClick={handleOpenClaudeKeys}>
                <span class="provider-icon">🧠</span>
                <span>Claude API Keys</span>
              </button>
              <button class="tooltip-action-btn" onClick={handleOpenGoogleKeys}>
                <span class="provider-icon">🔍</span>
                <span>Google API Keys</span>
              </button>
              <button class="tooltip-action-btn" onClick={handleOpenSettings}>
                <span class="provider-icon">⚙️</span>
                <span>完整设置</span>
              </button>
            </div>
          </div>
          <div class="tooltip-arrow"></div>
        </div>
      </Show>

      <style jsx>{`
        .settings-trigger-container {
          position: relative;
          display: inline-block;
        }

        .settings-trigger-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px 16px;
          background: var(--raycast-surface);
          border: 1px solid var(--raycast-border);
          border-radius: 8px;
          color: var(--raycast-foreground);
          cursor: pointer;
          transition: all 0.15s ease;
          font-size: 14px;
          font-weight: 500;
        }

        .settings-trigger-btn:hover {
          background: var(--raycast-accent);
          border-color: var(--raycast-accent-foreground);
        }

        .settings-trigger-text {
          color: var(--raycast-muted);
        }

        .settings-trigger-btn:hover .settings-trigger-text {
          color: var(--raycast-foreground);
        }

        .settings-tooltip {
          position: absolute;
          top: 100%;
          left: 50%;
          transform: translateX(-50%);
          margin-top: 8px;
          z-index: 1000;
          min-width: 280px;
        }

        .tooltip-content {
          background: var(--raycast-surface);
          border: 1px solid var(--raycast-border);
          border-radius: 12px;
          padding: 16px;
          box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
          backdrop-filter: blur(10px);
        }

        .tooltip-content h4 {
          margin: 0 0 12px 0;
          font-size: 14px;
          font-weight: 600;
          color: var(--raycast-foreground);
          text-align: center;
        }

        .tooltip-actions {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .tooltip-action-btn {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 12px;
          background: var(--raycast-input);
          border: 1px solid var(--raycast-border);
          border-radius: 8px;
          color: var(--raycast-foreground);
          cursor: pointer;
          transition: all 0.15s ease;
          font-size: 13px;
          text-align: left;
        }

        .tooltip-action-btn:hover {
          background: var(--raycast-accent);
          border-color: var(--raycast-accent-foreground);
        }

        .provider-icon {
          font-size: 16px;
          width: 20px;
          text-align: center;
        }

        .tooltip-arrow {
          position: absolute;
          top: -6px;
          left: 50%;
          transform: translateX(-50%);
          width: 12px;
          height: 12px;
          background: var(--raycast-surface);
          border: 1px solid var(--raycast-border);
          border-bottom: none;
          border-right: none;
          transform: translateX(-50%) rotate(45deg);
        }

        /* Animation */
        .settings-tooltip {
          animation: tooltipFadeIn 0.2s ease;
        }

        @keyframes tooltipFadeIn {
          from {
            opacity: 0;
            transform: translateX(-50%) translateY(-8px);
          }
          to {
            opacity: 1;
            transform: translateX(-50%) translateY(0);
          }
        }
      `}</style>
    </div>
  );
}