import { createSignal, onMount, onCleanup } from 'solid-js';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { commands } from '../bindings';
import TextSelectionToolbar from '../components/TextSelectionToolbar';
import type { TextSelection } from '../bindings';

export default function ToolbarPage() {
  const [selection, setSelection] = createSignal<TextSelection | undefined>();
  const [position, setPosition] = createSignal<{ x: number; y: number }>({ x: 0, y: 0 });

  // Close window when clicking outside
  const handleClickOutside = (event: MouseEvent) => {
    const target = event.target as HTMLElement;
    if (!target.closest('.text-selection-toolbar')) {
      getCurrentWindow().close();
    }
  };

  // Handle action execution
  const handleAction = (actionId: string) => {
    console.log('Action executed:', actionId);
    // Window will be closed by the toolbar component
  };

  // Handle toolbar close
  const handleClose = () => {
    getCurrentWindow().close();
  };

  onMount(async () => {
    const window = getCurrentWindow();

    // Get selection and position from window state or global state
    try {
      // In a real implementation, this would get the selection from the backend
      // For now, we'll use mock data
      const mockSelection: TextSelection = {
        text: "Hello, world!",
        selected_text: "Hello, world!",
        rect: {
          x: 100,
          y: 100,
          width: 200,
          height: 30,
          screen: undefined,
        },
        timestamp: new Date().toISOString(),
        source_app: undefined,
        context_type: "Text",
      };

      setSelection(mockSelection);

      // Get window position for toolbar positioning
      const scaleFactor = await window.scaleFactor();
      const windowPos = await window.outerPosition();
      const windowSize = await window.outerSize();

      setPosition({
        x: 100,
        y: 100,
      });

      // Set window properties
      await window.setAlwaysOnTop(true);
      await window.setDecorations(false);
      await window.setResizable(false);
      await window.setFocus();

      // Add click listener
      document.addEventListener('click', handleClickOutside);
    } catch (error) {
      console.error('Failed to initialize toolbar:', error);
      window.close();
    }
  });

  onCleanup(() => {
    document.removeEventListener('click', handleClickOutside);
  });

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        background: 'transparent',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <Show when={selection()}>
        <TextSelectionToolbar
          selection={selection()}
          position={position()}
          onAction={handleAction}
          onClose={handleClose}
        />
      </Show>
    </div>
  );
}