import {
  createSignal,
  createEffect,
  For,
  Show,
} from "solid-js";
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
  const [availableProviders, setAvailableProviders] = createSignal<ProviderConfig[]>([]);
  const [selectedProvider, setSelectedProvider] = createSignal<any>(null);
  const [availableModels, setAvailableModels] = createSignal<string[]>([]);
  const [config, setConfig] = createSignal<AIConfig>(
    props.initialConfig || {
      provider: null,
      model: "",
      temperature: 0.7,
      max_tokens: 1000,
      preamble: "You are a helpful AI assistant integrated into a desktop application.",
      enable_vision: false,
      enable_tools: true,
      enable_embeddings: false,
    }
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
    const providerInfo = availableProviders().find(p =>
      JSON.stringify(p.provider) === JSON.stringify(provider)
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
    return availableProviders().find(p =>
      JSON.stringify(p.provider) === JSON.stringify(selectedProvider())
    );
  };

  return (
    <div class="provider-config-panel">
      <div class="config-section">
        <h3>AI Provider Configuration</h3>

        {/* Provider Selection */}
        <div class="form-group">
          <label>AI Provider</label>
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
            <div class="provider-info">
              <p>{providerInfo.description}</p>
              <div class="provider-capabilities">
                <Show when={providerInfo.supports_vision}>
                  <span class="capability-tag">👁️ Vision</span>
                </Show>
                <Show when={providerInfo.supports_tools}>
                  <span class="capability-tag">🛠️ Tools</span>
                </Show>
                <Show when={providerInfo.supports_embeddings}>
                  <span class="capability-tag">🔍 Embeddings</span>
                </Show>
              </div>
            </div>
          )}
        </Show>

        {/* Model Selection */}
        <Show when={availableModels().length > 0}>
          <div class="form-group">
            <label>Model</label>
            <select
              value={config().model}
              onChange={(e) => handleModelChange(e.currentTarget.value)}
            >
              <For each={availableModels()}>
                {(model) => (
                  <option value={model}>{model}</option>
                )}
              </For>
            </select>
          </div>
        </Show>

        {/* API Key */}
        <Show when={selectedProviderInfo()?.requires_api_key}>
          <div class="form-group">
            <label>API Key</label>
            <input
              type="password"
              value={config().api_key || ""}
              placeholder="Enter your API key..."
              onInput={(e) => handleFieldChange("api_key", e.currentTarget.value)}
            />
          </div>
        </Show>

        {/* Base URL */}
        <div class="form-group">
          <label>Base URL (Optional)</label>
          <input
            type="text"
            value={config().base_url || ""}
            placeholder="Custom base URL..."
            onInput={(e) => handleFieldChange("base_url", e.currentTarget.value)}
          />
        </div>

        {/* Provider-specific configurations */}
        <Show when={config().provider?.OpenAIAzure}>
          <div class="provider-specific-config">
            <h4>Azure OpenAI Configuration</h4>
            <div class="form-group">
              <label>Azure Endpoint</label>
              <input
                type="text"
                value={config().azure_endpoint || ""}
                placeholder="https://your-resource.openai.azure.com"
                onInput={(e) => handleFieldChange("azure_endpoint", e.currentTarget.value)}
              />
            </div>
            <div class="form-group">
              <label>Deployment Name</label>
              <input
                type="text"
                value={config().azure_deployment || ""}
                placeholder="Your deployment name"
                onInput={(e) => handleFieldChange("azure_deployment", e.currentTarget.value)}
              />
            </div>
            <div class="form-group">
              <label>API Version</label>
              <input
                type="text"
                value={config().azure_api_version || "2023-12-01-preview"}
                onInput={(e) => handleFieldChange("azure_api_version", e.currentTarget.value)}
              />
            </div>
          </div>
        </Show>

        <Show when={config().provider?.Anthropic || config().provider?.AnthropicVertex}>
          <div class="provider-specific-config">
            <h4>Anthropic Configuration</h4>
            <div class="form-group">
              <label>API Version</label>
              <select
                value={config().anthropic_version || "2023-06-01"}
                onChange={(e) => handleFieldChange("anthropic_version", e.currentTarget.value)}
              >
                <option value="2023-06-01">2023-06-01</option>
                <option value="2023-10-22">2023-10-22</option>
              </select>
            </div>
            <Show when={config().provider?.AnthropicVertex}>
              <div class="form-group">
                <label>Google Project ID</label>
                <input
                  type="text"
                  value={config().google_project_id || ""}
                  placeholder="your-google-project-id"
                  onInput={(e) => handleFieldChange("google_project_id", e.currentTarget.value)}
                />
              </div>
              <div class="form-group">
                <label>Location</label>
                <select
                  value={config().google_location || "us-central1"}
                  onChange={(e) => handleFieldChange("google_location", e.currentTarget.value)}
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
          <div class="provider-specific-config">
            <h4>Ollama Configuration</h4>
            <div class="form-group">
              <label>Host</label>
              <input
                type="text"
                value={config().ollama_host || "localhost"}
                onInput={(e) => handleFieldChange("ollama_host", e.currentTarget.value)}
              />
            </div>
            <div class="form-group">
              <label>Port</label>
              <input
                type="number"
                value={config().ollama_port || 11434}
                onInput={(e) => handleFieldChange("ollama_port", parseInt(e.currentTarget.value))}
              />
            </div>
          </div>
        </Show>

        {/* Basic Configuration */}
        <div class="form-group">
          <label>Temperature</label>
          <input
            type="range"
            min="0"
            max="2"
            step="0.1"
            value={config().temperature || 0.7}
            onInput={(e) => handleFieldChange("temperature", parseFloat(e.currentTarget.value))}
          />
          <span class="range-value">{config().temperature}</span>
        </div>

        <div class="form-group">
          <label>Max Tokens</label>
          <input
            type="number"
            min="1"
            max="4096"
            value={config().max_tokens || 1000}
            onInput={(e) => handleFieldChange("max_tokens", parseInt(e.currentTarget.value))}
          />
        </div>

        <div class="form-group">
          <label>System Preamble</label>
          <textarea
            value={config().preamble || ""}
            rows={3}
            placeholder="Instructions for the AI assistant..."
            onInput={(e) => handleFieldChange("preamble", e.currentTarget.value)}
          />
        </div>

        {/* Capabilities */}
        <div class="form-group">
          <label>Capabilities</label>
          <div class="checkbox-group">
            <Show when={selectedProviderInfo()?.supports_vision}>
              <label class="checkbox-label">
                <input
                  type="checkbox"
                  checked={config().enable_vision || false}
                  onChange={(e) => handleFieldChange("enable_vision", e.currentTarget.checked)}
                />
                Enable Vision
              </label>
            </Show>
            <Show when={selectedProviderInfo()?.supports_tools}>
              <label class="checkbox-label">
                <input
                  type="checkbox"
                  checked={config().enable_tools !== false}
                  onChange={(e) => handleFieldChange("enable_tools", e.currentTarget.checked)}
                />
                Enable Tools
              </label>
            </Show>
            <Show when={selectedProviderInfo()?.supports_embeddings}>
              <label class="checkbox-label">
                <input
                  type="checkbox"
                  checked={config().enable_embeddings || false}
                  onChange={(e) => handleFieldChange("enable_embeddings", e.currentTarget.checked)}
                />
                Enable Embeddings
              </label>
            </Show>
          </div>
        </div>
      </div>

      <style>{`
        .provider-config-panel {
          background: rgba(30, 30, 30, 0.95);
          border-radius: 12px;
          padding: 20px;
          color: rgba(255, 255, 255, 0.9);
          max-height: 80vh;
          overflow-y: auto;
        }

        .config-section h3 {
          margin: 0 0 16px 0;
          font-size: 18px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.95);
        }

        .form-group {
          margin-bottom: 16px;
        }

        .form-group label {
          display: block;
          margin-bottom: 6px;
          font-size: 14px;
          font-weight: 500;
          color: rgba(255, 255, 255, 0.8);
        }

        .form-group input,
        .form-group select,
        .form-group textarea {
          width: 100%;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          padding: 10px 12px;
          color: rgba(255, 255, 255, 0.9);
          font-size: 14px;
          transition: all 0.15s ease;
        }

        .form-group input:focus,
        .form-group select:focus,
        .form-group textarea:focus {
          outline: none;
          border-color: rgba(59, 130, 246, 0.5);
          background: rgba(255, 255, 255, 0.08);
        }

        .form-group textarea {
          resize: vertical;
          min-height: 80px;
          font-family: inherit;
        }

        .provider-info {
          background: rgba(59, 130, 246, 0.1);
          border: 1px solid rgba(59, 130, 246, 0.2);
          border-radius: 8px;
          padding: 12px;
          margin-bottom: 16px;
        }

        .provider-info p {
          margin: 0 0 8px 0;
          font-size: 13px;
          color: rgba(255, 255, 255, 0.8);
        }

        .provider-capabilities {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
        }

        .capability-tag {
          background: rgba(59, 130, 246, 0.2);
          color: #60a5fa;
          padding: 2px 8px;
          border-radius: 12px;
          font-size: 11px;
          font-weight: 500;
        }

        .provider-specific-config {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          padding: 16px;
          margin-bottom: 16px;
        }

        .provider-specific-config h4 {
          margin: 0 0 12px 0;
          font-size: 14px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.9);
        }

        .checkbox-group {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .checkbox-label {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 14px;
          color: rgba(255, 255, 255, 0.8);
          cursor: pointer;
        }

        .checkbox-label input[type="checkbox"] {
          width: auto;
          accent-color: #3b82f6;
        }

        .range-value {
          margin-left: 8px;
          font-size: 14px;
          color: rgba(255, 255, 255, 0.7);
        }

        input[type="range"] {
          width: calc(100% - 40px);
          accent-color: #3b82f6;
        }
      `}</style>
    </div>
  );
}