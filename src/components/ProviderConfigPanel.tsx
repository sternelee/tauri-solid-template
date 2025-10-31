import { createSignal, createEffect, For, Show } from "solid-js";
import { commands } from "../bindings";

interface ProviderConfig {
  provider: any;
  name: string;
  description: string;
  requires_api_key: boolean;
  supports_vision: boolean;
  supports_tools: boolean;
  supports_embeddings: boolean;
  default_models: string[];
}

interface AIConfig {
  provider: any;
  model: string;
  api_key?: string;
  base_url?: string;
  temperature?: number;
  max_tokens?: number;
  preamble?: string;
  enable_vision?: boolean;
  enable_tools?: boolean;
  enable_embeddings?: boolean;
  // Provider-specific fields
  azure_endpoint?: string;
  azure_deployment?: string;
  azure_api_version?: string;
  anthropic_version?: string;
  google_project_id?: string;
  google_location?: string;
  ollama_host?: string;
  ollama_port?: number;
}

export default function ProviderConfigPanel(props: {
  onConfigChange: (config: AIConfig) => void;
  initialConfig?: AIConfig;
}) {
  const [availableProviders, setAvailableProviders] = createSignal<
    ProviderConfig[]
  >([]);
  const [selectedProvider, setSelectedProvider] = createSignal<any>(null);
  const [availableModels, setAvailableModels] = createSignal<string[]>([]);
  const [config, setConfig] = createSignal<AIConfig>(
    props.initialConfig || {
      provider: null,
      model: "",
      temperature: 0.7,
      max_tokens: 1000,
      preamble:
        "You are a helpful AI assistant integrated into a desktop application.",
      enable_vision: false,
      enable_tools: true,
      enable_embeddings: false,
    },
  );

  // Load available providers on mount
  createEffect(async () => {
    try {
      const result = await commands.getAvailableProviders();
      if (result.status === "ok") {
        setAvailableProviders(result.data);
        if (props.initialConfig?.provider) {
          setSelectedProvider(props.initialConfig.provider);
        }
      }
    } catch (error) {
      console.error("Failed to load providers:", error);
    }
  });

  // Update models when provider changes
  createEffect(async () => {
    const provider = selectedProvider();
    if (provider) {
      try {
        const result = await commands.getProviderModels(provider);
        if (result.status === "ok") {
          setAvailableModels(result.data);
        }
      } catch (error) {
        console.error("Failed to load models:", error);
      }
    }
  });

  const handleProviderChange = (provider: any) => {
    setSelectedProvider(provider);

    // Get provider info
    const providerInfo = availableProviders().find(
      (p) => JSON.stringify(p.provider) === JSON.stringify(provider),
    );

    if (providerInfo) {
      const newConfig = {
        ...config(),
        provider,
        model: providerInfo.default_models[0] || "",
        enable_vision: providerInfo.supports_vision,
        enable_tools: providerInfo.supports_tools,
        enable_embeddings: providerInfo.supports_embeddings,
      };
      setConfig(newConfig);
      props.onConfigChange(newConfig);
    }
  };

  const handleModelChange = (model: string) => {
    const newConfig = { ...config(), model };
    setConfig(newConfig);
    props.onConfigChange(newConfig);
  };

  const handleFieldChange = (field: keyof AIConfig, value: any) => {
    const newConfig = { ...config(), [field]: value };
    setConfig(newConfig);
    props.onConfigChange(newConfig);
  };

  const selectedProviderInfo = () => {
    return availableProviders().find(
      (p) => JSON.stringify(p.provider) === JSON.stringify(selectedProvider()),
    );
  };

  return (
    <div class="max-h-[80vh] overflow-y-auto rounded-xl bg-gray-800/95 p-5 text-white/90">
      <div class="config-section">
        <h3 class="m-0 mb-4 text-lg font-semibold text-white/95">
          AI Provider Configuration
        </h3>

        {/* Provider Selection */}
        <div class="mb-4">
          <label class="mb-1.5 block text-sm font-medium text-white/80">
            AI Provider
          </label>
          <select
            value={selectedProvider() ? JSON.stringify(selectedProvider()) : ""}
            onChange={(e) => {
              try {
                const provider = JSON.parse(e.currentTarget.value);
                handleProviderChange(provider);
              } catch (error) {
                console.error("Invalid provider selection:", error);
              }
            }}
            class="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white/90 transition-all focus:border-blue-500/50 focus:bg-white/8 focus:outline-none"
          >
            <option value="">Select a provider...</option>
            <For each={availableProviders()}>
              {(provider) => (
                <option value={JSON.stringify(provider.provider)}>
                  {provider.name}
                </option>
              )}
            </For>
          </select>
        </div>

        <Show when={selectedProviderInfo()}>
          {(providerInfo) => (
            <div class="mb-4 rounded-lg border border-blue-500/20 bg-blue-500/10 p-3">
              <p class="m-0 mb-2 text-xs text-white/80">
                {providerInfo.description}
              </p>
              <div class="flex flex-wrap gap-1.5">
                <Show when={providerInfo.supports_vision}>
                  <span class="rounded-full bg-blue-500/20 px-2 py-0.5 text-[11px] font-medium text-blue-400">
                    👁️ Vision
                  </span>
                </Show>
                <Show when={providerInfo.supports_tools}>
                  <span class="rounded-full bg-blue-500/20 px-2 py-0.5 text-[11px] font-medium text-blue-400">
                    🛠️ Tools
                  </span>
                </Show>
                <Show when={providerInfo.supports_embeddings}>
                  <span class="rounded-full bg-blue-500/20 px-2 py-0.5 text-[11px] font-medium text-blue-400">
                    🔍 Embeddings
                  </span>
                </Show>
              </div>
            </div>
          )}
        </Show>

        {/* Model Selection */}
        <Show when={availableModels().length > 0}>
          <div class="mb-4">
            <label class="mb-1.5 block text-sm font-medium text-white/80">
              Model
            </label>
            <select
              value={config().model}
              onChange={(e) => handleModelChange(e.currentTarget.value)}
              class="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white/90 transition-all focus:border-blue-500/50 focus:bg-white/8 focus:outline-none"
            >
              <For each={availableModels()}>
                {(model) => <option value={model}>{model}</option>}
              </For>
            </select>
          </div>
        </Show>

        {/* API Key */}
        <Show when={selectedProviderInfo()?.requires_api_key}>
          <div class="mb-4">
            <label class="mb-1.5 block text-sm font-medium text-white/80">
              API Key
            </label>
            <input
              type="password"
              value={config().api_key || ""}
              placeholder="Enter your API key..."
              onInput={(e) =>
                handleFieldChange("api_key", e.currentTarget.value)
              }
              class="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white/90 transition-all focus:border-blue-500/50 focus:bg-white/8 focus:outline-none"
            />
          </div>
        </Show>

        {/* Base URL */}
        <div class="mb-4">
          <label class="mb-1.5 block text-sm font-medium text-white/80">
            Base URL (Optional)
          </label>
          <input
            type="text"
            value={config().base_url || ""}
            placeholder="Custom base URL..."
            onInput={(e) =>
              handleFieldChange("base_url", e.currentTarget.value)
            }
            class="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white/90 transition-all focus:border-blue-500/50 focus:bg-white/8 focus:outline-none"
          />
        </div>

        {/* Provider-specific configurations */}
        <Show when={config().provider?.OpenAIAzure}>
          <div class="mb-4 rounded-lg border border-white/10 bg-white/3 p-4">
            <h4 class="m-0 mb-3 text-sm font-semibold text-white/90">
              Azure OpenAI Configuration
            </h4>
            <div class="mb-4">
              <label class="mb-1.5 block text-sm font-medium text-white/80">
                Azure Endpoint
              </label>
              <input
                type="text"
                value={config().azure_endpoint || ""}
                placeholder="https://your-resource.openai.azure.com"
                onInput={(e) =>
                  handleFieldChange("azure_endpoint", e.currentTarget.value)
                }
                class="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white/90 transition-all focus:border-blue-500/50 focus:bg-white/8 focus:outline-none"
              />
            </div>
            <div class="mb-4">
              <label class="mb-1.5 block text-sm font-medium text-white/80">
                Deployment Name
              </label>
              <input
                type="text"
                value={config().azure_deployment || ""}
                placeholder="Your deployment name"
                onInput={(e) =>
                  handleFieldChange("azure_deployment", e.currentTarget.value)
                }
                class="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white/90 transition-all focus:border-blue-500/50 focus:bg-white/8 focus:outline-none"
              />
            </div>
            <div class="mb-4">
              <label class="mb-1.5 block text-sm font-medium text-white/80">
                API Version
              </label>
              <input
                type="text"
                value={config().azure_api_version || "2023-12-01-preview"}
                onInput={(e) =>
                  handleFieldChange("azure_api_version", e.currentTarget.value)
                }
                class="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white/90 transition-all focus:border-blue-500/50 focus:bg-white/8 focus:outline-none"
              />
            </div>
          </div>
        </Show>

        <Show
          when={
            config().provider?.Anthropic || config().provider?.AnthropicVertex
          }
        >
          <div class="mb-4 rounded-lg border border-white/10 bg-white/3 p-4">
            <h4 class="m-0 mb-3 text-sm font-semibold text-white/90">
              Anthropic Configuration
            </h4>
            <div class="mb-4">
              <label class="mb-1.5 block text-sm font-medium text-white/80">
                API Version
              </label>
              <select
                value={config().anthropic_version || "2023-06-01"}
                onChange={(e) =>
                  handleFieldChange("anthropic_version", e.currentTarget.value)
                }
                class="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white/90 transition-all focus:border-blue-500/50 focus:bg-white/8 focus:outline-none"
              >
                <option value="2023-06-01">2023-06-01</option>
                <option value="2023-10-22">2023-10-22</option>
              </select>
            </div>
            <Show when={config().provider?.AnthropicVertex}>
              <div class="mb-4">
                <label class="mb-1.5 block text-sm font-medium text-white/80">
                  Google Project ID
                </label>
                <input
                  type="text"
                  value={config().google_project_id || ""}
                  placeholder="your-google-project-id"
                  onInput={(e) =>
                    handleFieldChange(
                      "google_project_id",
                      e.currentTarget.value,
                    )
                  }
                  class="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white/90 transition-all focus:border-blue-500/50 focus:bg-white/8 focus:outline-none"
                />
              </div>
              <div class="mb-4">
                <label class="mb-1.5 block text-sm font-medium text-white/80">
                  Location
                </label>
                <select
                  value={config().google_location || "us-central1"}
                  onChange={(e) =>
                    handleFieldChange("google_location", e.currentTarget.value)
                  }
                  class="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white/90 transition-all focus:border-blue-500/50 focus:bg-white/8 focus:outline-none"
                >
                  <option value="us-central1">us-central1</option>
                  <option value="us-east1">us-east1</option>
                  <option value="us-west1">us-west1</option>
                  <option value="europe-west1">europe-west1</option>
                </select>
              </div>
            </Show>
          </div>
        </Show>

        <Show when={config().provider?.Ollama}>
          <div class="mb-4 rounded-lg border border-white/10 bg-white/3 p-4">
            <h4 class="m-0 mb-3 text-sm font-semibold text-white/90">
              Ollama Configuration
            </h4>
            <div class="mb-4">
              <label class="mb-1.5 block text-sm font-medium text-white/80">
                Host
              </label>
              <input
                type="text"
                value={config().ollama_host || "localhost"}
                onInput={(e) =>
                  handleFieldChange("ollama_host", e.currentTarget.value)
                }
                class="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white/90 transition-all focus:border-blue-500/50 focus:bg-white/8 focus:outline-none"
              />
            </div>
            <div class="mb-4">
              <label class="mb-1.5 block text-sm font-medium text-white/80">
                Port
              </label>
              <input
                type="number"
                value={config().ollama_port || 11434}
                onInput={(e) =>
                  handleFieldChange(
                    "ollama_port",
                    parseInt(e.currentTarget.value),
                  )
                }
                class="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white/90 transition-all focus:border-blue-500/50 focus:bg-white/8 focus:outline-none"
              />
            </div>
          </div>
        </Show>

        {/* Basic Configuration */}
        <div class="mb-4">
          <label class="mb-1.5 block text-sm font-medium text-white/80">
            Temperature
          </label>
          <div class="flex items-center gap-2">
            <input
              type="range"
              min="0"
              max="2"
              step="0.1"
              value={config().temperature || 0.7}
              onInput={(e) =>
                handleFieldChange(
                  "temperature",
                  parseFloat(e.currentTarget.value),
                )
              }
              class="flex-1 accent-blue-500"
            />
            <span class="text-sm text-white/70">{config().temperature}</span>
          </div>
        </div>

        <div class="mb-4">
          <label class="mb-1.5 block text-sm font-medium text-white/80">
            Max Tokens
          </label>
          <input
            type="number"
            min="1"
            max="4096"
            value={config().max_tokens || 1000}
            onInput={(e) =>
              handleFieldChange("max_tokens", parseInt(e.currentTarget.value))
            }
            class="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white/90 transition-all focus:border-blue-500/50 focus:bg-white/8 focus:outline-none"
          />
        </div>

        <div class="mb-4">
          <label class="mb-1.5 block text-sm font-medium text-white/80">
            System Preamble
          </label>
          <textarea
            value={config().preamble || ""}
            rows={3}
            placeholder="Instructions for the AI assistant..."
            onInput={(e) =>
              handleFieldChange("preamble", e.currentTarget.value)
            }
            class="font-inherit min-h-20 w-full resize-y rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white/90 transition-all focus:border-blue-500/50 focus:bg-white/8 focus:outline-none"
          />
        </div>

        {/* Capabilities */}
        <div class="mb-4">
          <label class="mb-1.5 block text-sm font-medium text-white/80">
            Capabilities
          </label>
          <div class="flex flex-col gap-2">
            <Show when={selectedProviderInfo()?.supports_vision}>
              <label class="flex cursor-pointer items-center gap-2 text-sm text-white/80">
                <input
                  type="checkbox"
                  checked={config().enable_vision || false}
                  onChange={(e) =>
                    handleFieldChange("enable_vision", e.currentTarget.checked)
                  }
                  class="w-auto accent-blue-500"
                />
                Enable Vision
              </label>
            </Show>
            <Show when={selectedProviderInfo()?.supports_tools}>
              <label class="flex cursor-pointer items-center gap-2 text-sm text-white/80">
                <input
                  type="checkbox"
                  checked={config().enable_tools !== false}
                  onChange={(e) =>
                    handleFieldChange("enable_tools", e.currentTarget.checked)
                  }
                  class="w-auto accent-blue-500"
                />
                Enable Tools
              </label>
            </Show>
            <Show when={selectedProviderInfo()?.supports_embeddings}>
              <label class="flex cursor-pointer items-center gap-2 text-sm text-white/80">
                <input
                  type="checkbox"
                  checked={config().enable_embeddings || false}
                  onChange={(e) =>
                    handleFieldChange(
                      "enable_embeddings",
                      e.currentTarget.checked,
                    )
                  }
                  class="w-auto accent-blue-500"
                />
                Enable Embeddings
              </label>
            </Show>
          </div>
        </div>
      </div>
    </div>
  );
}

