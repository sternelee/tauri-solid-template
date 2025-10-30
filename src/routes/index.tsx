import { createSignal, onMount, onCleanup } from "solid-js";
import CommandPalette from "../components/CommandPalette";
import KeyboardShortcutsHelp from "../components/KeyboardShortcutsHelp";

export default function Home() {
  const [showWelcome, setShowWelcome] = createSignal(true);

  onMount(() => {
    // Hide welcome screen after a brief moment
    setTimeout(() => setShowWelcome(false), 1500);
  });

  return (
    <div class="raycast-main">
      {/* Welcome Screen */}
      {showWelcome() && (
        <div class="raycast-welcome animate-fade-in">
          <div class="raycast-welcome-content">
            <div class="raycast-logo">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none">
                <path
                  d="M12 2L2 7L12 12L22 7L12 2Z"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M2 17L12 22L22 17"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M2 12L12 17L22 12"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <h1 class="raycast-welcome-title">Raycast Clone</h1>
            <p class="raycast-welcome-subtitle">
              A powerful launcher for your desktop
            </p>
            <div class="raycast-welcome-shortcut">
              <kbd class="raycast-kbd raycast-kbd-large">
                <span>⌘</span>
                <span>K</span>
              </kbd>
              <span class="raycast-shortcut-text">to get started</span>
            </div>
          </div>
        </div>
      )}

      {/* Main Interface - Hidden by default, activated by Cmd+K */}
      <div class="raycast-main-content">
        <CommandPalette />
      </div>

      {/* Keyboard Shortcuts Help */}
      <KeyboardShortcutsHelp />

      {/* Raycast-style global styles */}
      <style jsx global>{`
        .raycast-main {
          min-height: 100vh;
          background: var(--raycast-background);
          position: relative;
          overflow: hidden;
        }

        .raycast-welcome {
          position: fixed;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--raycast-background);
          z-index: 10;
        }

        .raycast-welcome-content {
          text-align: center;
          max-width: 400px;
          padding: 0 20px;
        }

        .raycast-logo {
          color: var(--raycast-accent-foreground);
          margin-bottom: 24px;
          display: flex;
          justify-content: center;
        }

        .raycast-welcome-title {
          font-size: 32px;
          font-weight: 700;
          color: var(--raycast-foreground);
          margin: 0 0 8px 0;
          letter-spacing: -0.025em;
        }

        .raycast-welcome-subtitle {
          font-size: 16px;
          color: var(--raycast-muted);
          margin: 0 0 32px 0;
          line-height: 1.5;
        }

        .raycast-welcome-shortcut {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          padding: 16px 24px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          backdrop-filter: blur(10px);
        }

        .raycast-shortcut-text {
          color: var(--raycast-muted);
          font-size: 14px;
          font-weight: 500;
        }

        .raycast-kbd-large {
          padding: 8px 16px;
          font-size: 16px;
          min-height: 48px;
          gap: 4px;
        }

        .raycast-main-content {
          position: relative;
          width: 100%;
          height: 100vh;
        }

        /* Custom scrollbar for the entire app */
        ::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }

        ::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.05);
        }

        ::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.2);
          border-radius: 4px;
        }

        ::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.3);
        }

        /* Focus improvements */
        *:focus-visible {
          outline: 2px solid var(--raycast-accent-foreground);
          outline-offset: 2px;
          border-radius: 4px;
        }

        /* Smooth transitions */
        * {
          transition:
            background-color 0.15s ease,
            border-color 0.15s ease,
            color 0.15s ease;
        }
      `}</style>
    </div>
  );
}
