<script lang="ts">
import { createEventDispatcher, onMount } from "svelte";
import { fly } from "svelte/transition";
import type { MentionItem } from "$lib/types";

export let suggestions: MentionItem[] = [];
export let query = "";
let selectedIndex = $state(0);

const dispatch = createEventDispatcher();

$: if (suggestions.length > 0 && selectedIndex >= suggestions.length) {
  selectedIndex = 0;
}

onMount(() => {
  selectedIndex = 0;
});

function selectItem(item: MentionItem) {
  dispatch("select", item);
}

function handleKeydown(e: KeyboardEvent) {
  switch (e.key) {
    case "ArrowDown":
      e.preventDefault();
      selectedIndex = (selectedIndex + 1) % suggestions.length;
      break;
    case "ArrowUp":
      e.preventDefault();
      selectedIndex =
        selectedIndex === 0 ? suggestions.length - 1 : selectedIndex - 1;
      break;
    case "Enter":
    case "Tab":
      e.preventDefault();
      if (suggestions[selectedIndex]) {
        selectItem(suggestions[selectedIndex]);
      }
      break;
    case "Escape":
      e.preventDefault();
      dispatch("close");
      break;
  }
}

function handleMouseEnter(index: number) {
  selectedIndex = index;
}

// Position the menu near cursor
let menuStyle = $state("");
let menuPosition = $state({ top: 0, left: 0 });

function updatePosition() {
  const selection = window.getSelection();
  if (selection && selection.rangeCount > 0) {
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    menuPosition = {
      top: rect.bottom + window.scrollY + 5,
      left: rect.left + window.scrollX,
    };
    menuStyle = `position: absolute; top: ${menuPosition.top}px; left: ${menuPosition.left}px; z-index: 1000;`;
  }
}

$: if (suggestions.length > 0) {
  updatePosition();
}
</script>

<svelte:window on:keydown={handleKeydown} />

{#if suggestions.length > 0}
  <div
    class="glass max-w-xs overflow-hidden rounded-lg border border-white/10 shadow-xl"
    style={menuStyle}
    transition:fly={{ y: -10, duration: 200 }}
  >
    <div class="p-1">
      {#each suggestions as item, index}
        <button
          class="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left transition-colors
						{index === selectedIndex ? 'bg-white/10 text-white' : 'text-white/70 hover:bg-white/5 hover:text-white/90'}"
          on:click={() => selectItem(item)}
          on:mouseenter={() => handleMouseEnter(index)}
        >
          <span class="text-lg">{item.icon}</span>
          <div class="min-w-0 flex-1">
            <div class="truncate text-sm font-medium">{item.title}</div>
            {#if item.subtitle}
              <div class="truncate text-xs text-white/50">{item.subtitle}</div>
            {/if}
          </div>
        </button>
      {/each}
    </div>

    {#if query}
      <div class="border-t border-white/10 px-3 py-2 text-xs text-white/50">
        Press <kbd class="rounded bg-white/10 px-1.5 py-0.5">↑</kbd>
        <kbd class="rounded bg-white/10 px-1.5 py-0.5">↓</kbd> to navigate,
        <kbd class="rounded bg-white/10 px-1.5 py-0.5">Enter</kbd> to select
      </div>
    {/if}
  </div>
{/if}
