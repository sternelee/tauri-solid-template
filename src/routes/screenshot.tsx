import { createSignal, onMount, Show } from "solid-js";
import ScreenshotToolSimple from "../components/ScreenshotToolSimple";

export default function ScreenshotPage() {
  const [isLoading, setIsLoading] = createSignal(true);

  onMount(() => {
    // Simulate loading or initialization
    setTimeout(() => {
      setIsLoading(false);
    }, 500);
  });

  return (
    <div class="screenshot-page">
      <Show
        when={!isLoading()}
        fallback={
          <div
            style={{
              display: "flex",
              "align-items": "center",
              "justify-content": "center",
              height: "100vh",
              "font-family": "system-ui, -apple-system, sans-serif",
            }}
          >
            <div
              style={{
                "text-align": "center",
                color: "#6b7280",
              }}
            >
              <div
                style={{
                  width: "40px",
                  height: "40px",
                  border: "3px solid #e5e7eb",
                  "border-top": "3px solid #3b82f6",
                  "border-radius": "50%",
                  animation: "spin 1s linear infinite",
                  margin: "0 auto 16px auto",
                }}
              />
              <p>Loading screenshot tool...</p>
            </div>
          </div>
        }
      >
        <ScreenshotToolSimple />
      </Show>

      <style>{`
        .screenshot-page {
          min-height: 100vh;
          background: #ffffff;
          font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        /* Make the page window-like */
        @media (prefers-color-scheme: dark) {
          .screenshot-page {
            background: #1f2937;
            color: #f9fafb;
          }
        }
      `}</style>
    </div>
  );
}

