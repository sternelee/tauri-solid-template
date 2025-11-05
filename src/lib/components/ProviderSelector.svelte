<script lang="ts">
import { createEventDispatcher } from "svelte";
import type { AIProvider } from "$lib/types";

export let availableProviders: AIProvider[] = [];
export let selectedProvider: AIProvider;
export let selectedModel: string;

const dispatch = createEventDispatcher();

function handleProviderChange(provider: AIProvider) {
  selectedProvider = provider;
  selectedModel = provider.models[0];
  dispatch("providerChange", provider);
  dispatch("modelChange", selectedModel);
}

function handleModelChange(model: string) {
  selectedModel = model;
  dispatch("modelChange", model);
}
</script>

<div class="flex items-center gap-3">
  <!-- Provider Selector -->
  <div class="relative">
    <select
      bind:value={selectedProvider}
      on:change={(e) => handleProviderChange(e.target.value)}
      class="cursor-pointer appearance-none rounded-lg border border-white/10 bg-gray-800/50 px-3 py-1.5 pr-8 text-sm text-white/80 focus:border-blue-500/30 focus:ring-2 focus:ring-blue-500/50 focus:outline-none"
    >
      {#each availableProviders as provider}
        <option value={provider}>
          {provider.icon}
          {provider.name}
        </option>
      {/each}
    </select>

    <!-- Custom dropdown arrow -->
    <div
      class="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 transform"
    >
      <svg
        class="h-4 w-4 text-white/50"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M19 9l-7 7-7-7"
        />
      </svg>
    </div>
  </div>

  <!-- Model Selector -->
  <div class="relative">
    <select
      bind:value={selectedModel}
      on:change={(e) => handleModelChange(e.target.value)}
      class="cursor-pointer appearance-none rounded-lg border border-white/10 bg-gray-800/50 px-3 py-1.5 pr-8 text-sm text-white/80 focus:border-blue-500/30 focus:ring-2 focus:ring-blue-500/50 focus:outline-none"
    >
      {#each selectedProvider.models as model}
        <option value={model}>{model}</option>
      {/each}
    </select>

    <!-- Custom dropdown arrow -->
    <div
      class="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 transform"
    >
      <svg
        class="h-4 w-4 text-white/50"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M19 9l-7 7-7-7"
        />
      </svg>
    </div>
  </div>

  <!-- Provider Status Indicator -->
  <div class="flex items-center gap-2">
    <div class="h-2 w-2 animate-pulse rounded-full bg-green-500"></div>
    <span class="text-xs text-white/60">Connected</span>
  </div>
</div>

<style>
select {
  background-image: none;
  background-color: transparent;
}

select::-ms-expand {
  display: none;
}
</style>

