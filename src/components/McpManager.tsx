import { createSignal, onMount, For, Show } from "solid-js";
import { commands } from "../bindings";

interface McpServer {
  name: string;
  transport: "stdio" | "sse" | "http";
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
  headers?: Record<string, string>;
  active: boolean;
  connected: boolean;
  restart_count: number;
}

interface McpServerStatus {
  name: string;
  connected: boolean;
  active: boolean;
  restart_count: number;
}

export default function McpManager() {
  const [servers, setServers] = createSignal<McpServer[]>([]);
  const [serverStatus, setServerStatus] = createSignal<McpServerStatus[]>([]);
  const [isLoading, setIsLoading] = createSignal(true);
  const [isSaving, setIsSaving] = createSignal(false);
  const [editingServer, setEditingServer] = createSignal<string | null>(null);
  const [showAddForm, setShowAddForm] = createSignal(false);
  const [saveStatus, setSaveStatus] = createSignal<
    "idle" | "success" | "error"
  >("idle");

  // Form state for new server
  const [newServer, setNewServer] = createSignal<Partial<McpServer>>({
    name: "",
    transport: "stdio",
    command: "",
    args: [],
    env: {},
    url: "",
    headers: {},
    active: true,
  });

  const [newServerArgs, setNewServerArgs] = createSignal("");
  const [newServerEnv, setNewServerEnv] = createSignal("");
  const [newServerHeaders, setNewServerHeaders] = createSignal("");

  onMount(async () => {
    await loadServerConfig();
    await loadServerStatus();
    setIsLoading(false);
  });

  const loadServerConfig = async () => {
    try {
      const result = await commands.getMcpConfigs();
      if (result.status === "ok" && result.data) {
        const config = JSON.parse(result.data);
        const serverList = Object.entries(config.mcpServers || {}).map(
          ([name, serverConfig]: [string, any]) => ({
            name,
            transport: serverConfig.type || "stdio",
            command: serverConfig.command || "",
            args: serverConfig.args || [],
            env: serverConfig.env || {},
            url: serverConfig.url || "",
            headers: serverConfig.headers || {},
            active: serverConfig.active !== false,
          }),
        );
        setServers(serverList);
      }
    } catch (error) {
      console.error("Failed to load MCP configs:", error);
    }
  };

  const loadServerStatus = async () => {
    try {
      const result = await commands.getMcpServerStatus();
      if (result.status === "ok" && result.data) {
        setServerStatus(result.data);
      }
    } catch (error) {
      console.error("Failed to load MCP server status:", error);
    }
  };

  const saveServerConfig = async () => {
    setIsSaving(true);
    setSaveStatus("idle");

    try {
      const config = {
        mcpServers: servers().reduce(
          (acc, server) => {
            acc[server.name] = {
              type: server.transport,
              active: server.active,
              ...(server.transport === "stdio"
                ? {
                    command: server.command,
                    args: server.args,
                    env: server.env,
                  }
                : {}),
              ...(server.transport === "http" || server.transport === "sse"
                ? {
                    url: server.url,
                    headers: server.headers,
                  }
                : {}),
            };
            return acc;
          },
          {} as Record<string, any>,
        ),
      };

      const result = await commands.saveMcpConfigs(JSON.stringify(config));
      if (result.status === "ok") {
        setSaveStatus("success");
        setTimeout(() => setSaveStatus("idle"), 2000);
      } else {
        setSaveStatus("error");
        setTimeout(() => setSaveStatus("idle"), 3000);
      }
    } catch (error) {
      console.error("Failed to save MCP configs:", error);
      setSaveStatus("error");
      setTimeout(() => setSaveStatus("idle"), 3000);
    } finally {
      setIsSaving(false);
    }
  };

  const addServer = () => {
    const server = newServer();
    if (!server.name) return;

    // Parse args, env, and headers from text inputs
    const args =
      server.args ||
      (newServerArgs()
        ? newServerArgs()
            .split(" ")
            .filter((arg) => arg.trim())
        : []);
    const env =
      server.env ||
      (newServerEnv()
        ? Object.fromEntries(
            newServerEnv()
              .split("\n")
              .map((line) => {
                const [key, value] = line.split("=").map((s) => s.trim());
                return [key, value];
              })
              .filter(([key]) => key),
          )
        : {});
    const headers =
      server.headers ||
      (newServerHeaders()
        ? Object.fromEntries(
            newServerHeaders()
              .split("\n")
              .map((line) => {
                const [key, value] = line.split(":").map((s) => s.trim());
                return [key, value];
              })
              .filter(([key]) => key),
          )
        : {});

    const fullServer: McpServer = {
      name: server.name!,
      transport: server.transport as "stdio" | "sse" | "http",
      command: server.command || "",
      args,
      env,
      url: server.url || "",
      headers,
      active: server.active || true,
      connected: false,
      restart_count: 0,
    };

    setServers((prev) => [...prev, fullServer]);
    setNewServer({
      name: "",
      transport: "stdio",
      command: "",
      args: [],
      env: {},
      url: "",
      headers: {},
      active: true,
    });
    setNewServerArgs("");
    setNewServerEnv("");
    setNewServerHeaders("");
    setShowAddForm(false);
  };

  const removeServer = (name: string) => {
    setServers((prev) => prev.filter((server) => server.name !== name));
  };

  const toggleServerActive = (name: string) => {
    setServers((prev) =>
      prev.map((server) =>
        server.name === name ? { ...server, active: !server.active } : server,
      ),
    );
  };

  const activateServer = async (name: string) => {
    try {
      const server = servers().find((s) => s.name === name);
      if (!server) return;

      const config = {
        type: server.transport,
        active: true,
        ...(server.transport === "stdio"
          ? {
              command: server.command,
              args: server.args,
              env: server.env,
            }
          : {}),
        ...(server.transport === "http" || server.transport === "sse"
          ? {
              url: server.url,
              headers: server.headers,
            }
          : {}),
      };

      const result = await commands.activateMcpServer(name, config);
      if (result.status === "ok") {
        await loadServerStatus();
      }
    } catch (error) {
      console.error("Failed to activate server:", error);
    }
  };

  const deactivateServer = async (name: string) => {
    try {
      const result = await commands.deactivateMcpServer(name);
      if (result.status === "ok") {
        await loadServerStatus();
      }
    } catch (error) {
      console.error("Failed to deactivate server:", error);
    }
  };

  const restartAllServers = async () => {
    try {
      const result = await commands.restartMcpServers();
      if (result.status === "ok") {
        await loadServerStatus();
      }
    } catch (error) {
      console.error("Failed to restart servers:", error);
    }
  };

  const resetRestartCount = async (serverName: string) => {
    try {
      const result = await commands.resetMcpRestartCount(serverName);
      if (result.status === "ok") {
        await loadServerStatus();
      }
    } catch (error) {
      console.error("Failed to reset restart count:", error);
    }
  };

  const getServerStatus = (name: string) => {
    return serverStatus().find((status) => status.name === name);
  };

  return (
    <div class="mx-auto max-w-6xl p-6">
      <div class="mb-6 flex flex-col items-center justify-between gap-4 border-b border-white/10 pb-4 md:flex-row md:items-center md:gap-0">
        <h2 class="m-0 text-2xl font-semibold text-white/90">MCP 服务器管理</h2>
        <div class="flex flex-col gap-3 md:flex-row">
          <button
            class="w-full cursor-pointer rounded-md border-none bg-blue-500 px-4 py-2 text-sm font-medium text-white transition-all hover:opacity-80 md:w-auto"
            onClick={restartAllServers}
          >
            🔄 重启所有服务器
          </button>
          <button
            class="w-full cursor-pointer rounded-md border-none bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 md:w-auto"
            onClick={saveServerConfig}
            disabled={isSaving()}
          >
            {isSaving() ? "保存中..." : "保存配置"}
          </button>
        </div>
      </div>

      {/* Save Status */}
      <Show when={saveStatus() !== "idle"}>
        <div
          class={`animate-slide-in fixed top-5 right-5 z-50 rounded-lg px-4 py-3 text-sm font-medium ${
            saveStatus() === "success"
              ? "bg-green-500 text-white"
              : "bg-red-500 text-white"
          }`}
        >
          {saveStatus() === "success" ? "✅ 配置已保存" : "❌ 保存失败"}
        </div>
      </Show>

      {/* Add Server Form */}
      <Show when={showAddForm()}>
        <div class="mb-6 rounded-xl border border-white/10 bg-white/5 p-6">
          <h3 class="m-0 mb-5 text-lg font-semibold text-white/90">
            添加新服务器
          </h3>

          <div class="mb-5 grid grid-cols-1 gap-4 md:grid-cols-[repeat(auto-fit,minmax(300px,1fr))]">
            <div class="flex flex-col gap-2">
              <label class="text-sm font-medium text-white/90">
                服务器名称
              </label>
              <input
                type="text"
                value={newServer().name || ""}
                onChange={(e) =>
                  setNewServer((prev) => ({ ...prev, name: e.target.value }))
                }
                placeholder="例如: exa"
                class="rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/90 focus:border-blue-500/50 focus:outline-none"
              />
            </div>

            <div class="flex flex-col gap-2">
              <label class="text-sm font-medium text-white/90">传输类型</label>
              <select
                value={newServer().transport || "stdio"}
                onChange={(e) =>
                  setNewServer((prev) => ({
                    ...prev,
                    transport: e.target.value as any,
                  }))
                }
                class="rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/90 focus:border-blue-500/50 focus:outline-none"
              >
                <option value="stdio">STDIO (命令行)</option>
                <option value="http">HTTP</option>
                <option value="sse">SSE</option>
              </select>
            </div>

            <Show when={newServer().transport === "stdio"}>
              <div class="flex flex-col gap-2">
                <label class="text-sm font-medium text-white/90">命令</label>
                <input
                  type="text"
                  value={newServer().command || ""}
                  onChange={(e) =>
                    setNewServer((prev) => ({
                      ...prev,
                      command: e.target.value,
                    }))
                  }
                  placeholder="例如: npx"
                  class="rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/90 focus:border-blue-500/50 focus:outline-none"
                />
              </div>

              <div class="flex flex-col gap-2">
                <label class="text-sm font-medium text-white/90">
                  参数 (空格分隔)
                </label>
                <input
                  type="text"
                  value={newServerArgs()}
                  onChange={(e) => setNewServerArgs(e.target.value)}
                  placeholder="例如: @exa/mcp-server"
                  class="rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/90 focus:border-blue-500/50 focus:outline-none"
                />
              </div>

              <div class="flex flex-col gap-2">
                <label class="text-sm font-medium text-white/90">
                  环境变量 (每行一个，格式: KEY=VALUE)
                </label>
                <textarea
                  value={newServerEnv()}
                  onChange={(e) => setNewServerEnv(e.target.value)}
                  placeholder="例如: API_KEY=your_key_here"
                  rows="3"
                  class="resize-y rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/90 focus:border-blue-500/50 focus:outline-none"
                />
              </div>
            </Show>

            <Show
              when={
                newServer().transport === "http" ||
                newServer().transport === "sse"
              }
            >
              <div class="flex flex-col gap-2">
                <label class="text-sm font-medium text-white/90">URL</label>
                <input
                  type="text"
                  value={newServer().url || ""}
                  onChange={(e) =>
                    setNewServer((prev) => ({ ...prev, url: e.target.value }))
                  }
                  placeholder="例如: https://mcp.exa.ai/mcp"
                  class="rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/90 focus:border-blue-500/50 focus:outline-none"
                />
              </div>

              <div class="flex flex-col gap-2">
                <label class="text-sm font-medium text-white/90">
                  请求头 (每行一个，格式: KEY: VALUE)
                </label>
                <textarea
                  value={newServerHeaders()}
                  onChange={(e) => setNewServerHeaders(e.target.value)}
                  placeholder="例如: Authorization: Bearer your_token"
                  rows="3"
                  class="resize-y rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/90 focus:border-blue-500/50 focus:outline-none"
                />
              </div>
            </Show>

            <div class="flex flex-col gap-2">
              <label class="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={newServer().active || true}
                  onChange={(e) =>
                    setNewServer((prev) => ({
                      ...prev,
                      active: e.target.checked,
                    }))
                  }
                  class="m-0"
                />
                <span class="text-sm font-medium text-white/90">
                  启用服务器
                </span>
              </label>
            </div>
          </div>

          <div class="flex justify-end gap-3">
            <button
              class="cursor-pointer rounded-md border-none bg-gray-600 px-4 py-2 text-sm font-medium text-white transition-all hover:opacity-80"
              onClick={() => setShowAddForm(false)}
            >
              取消
            </button>
            <button
              class="cursor-pointer rounded-md border-none bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={addServer}
              disabled={!newServer().name}
            >
              添加服务器
            </button>
          </div>
        </div>
      </Show>

      {/* Servers List */}
      <div class="servers-list">
        <div class="mb-5 flex items-center justify-between">
          <h3 class="m-0 text-lg font-semibold text-white/90">
            已配置的服务器
          </h3>
          <button
            class="cursor-pointer rounded-md border border-white/10 bg-transparent px-4 py-2 text-sm font-medium text-white/90 transition-all hover:bg-white/10"
            onClick={() => setShowAddForm(true)}
          >
            ➕ 添加服务器
          </button>
        </div>

        <Show when={servers().length === 0 && !isLoading()}>
          <div class="py-10 text-center text-white/60">
            <p class="mb-4">还没有配置任何 MCP 服务器</p>
            <button
              class="cursor-pointer rounded-md border-none bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-all hover:opacity-90"
              onClick={() => setShowAddForm(true)}
            >
              添加第一个服务器
            </button>
          </div>
        </Show>

        <Show when={isLoading()}>
          <div class="py-10 text-center text-white/60">
            <p>加载中...</p>
          </div>
        </Show>

        <div class="grid grid-cols-1 gap-4 md:grid-cols-[repeat(auto-fill,minmax(400px,1fr))]">
          <For each={servers()}>
            {(server) => {
              const status = getServerStatus(server.name);
              return (
                <div class="rounded-xl border border-white/10 bg-white/5 p-5 transition-all hover:border-white/20">
                  <div class="mb-4 flex items-center justify-between">
                    <h4 class="m-0 text-base font-semibold text-white/90">
                      {server.name}
                    </h4>
                    <div class="flex gap-2">
                      <span
                        class={`rounded-full px-2 py-1 text-xs font-medium ${
                          server.active
                            ? "bg-green-500 text-white"
                            : "bg-gray-500 text-white/80"
                        }`}
                      >
                        {server.active ? "启用" : "禁用"}
                      </span>
                      <Show when={status}>
                        <span
                          class={`rounded-full px-2 py-1 text-xs font-medium ${
                            status?.connected
                              ? "bg-blue-500 text-white"
                              : "bg-gray-600 text-white/60"
                          }`}
                        >
                          {status?.connected ? "已连接" : "未连接"}
                        </span>
                      </Show>
                    </div>
                  </div>

                  <div class="mb-4 flex flex-col gap-2">
                    <div class="flex items-center justify-between text-xs">
                      <span class="font-medium text-white/60">传输:</span>
                      <span class="text-white/90">{server.transport}</span>
                    </div>

                    <Show when={server.transport === "stdio"}>
                      <div class="flex items-center justify-between text-xs">
                        <span class="font-medium text-white/60">命令:</span>
                        <span class="font-mono break-all text-white/90">
                          {server.command} {server.args?.join(" ")}
                        </span>
                      </div>
                    </Show>

                    <Show
                      when={
                        server.transport === "http" ||
                        server.transport === "sse"
                      }
                    >
                      <div class="flex items-center justify-between text-xs">
                        <span class="font-medium text-white/60">URL:</span>
                        <span class="font-mono break-all text-white/90">
                          {server.url}
                        </span>
                      </div>
                    </Show>

                    <Show when={status}>
                      <div class="flex items-center justify-between text-xs">
                        <span class="font-medium text-white/60">重启次数:</span>
                        <span class="text-white/90">
                          {status?.restart_count || 0}
                        </span>
                      </div>
                    </Show>
                  </div>

                  <div class="flex flex-wrap gap-2">
                    <Show when={server.active}>
                      <Show when={status?.connected}>
                        <button
                          class="cursor-pointer rounded-md border-none bg-gray-600 px-3 py-1.5 text-xs font-medium text-white transition-all hover:opacity-80"
                          onClick={() => deactivateServer(server.name)}
                        >
                          停用
                        </button>
                      </Show>
                      <Show when={!status?.connected}>
                        <button
                          class="cursor-pointer rounded-md border-none bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition-all hover:opacity-90"
                          onClick={() => activateServer(server.name)}
                        >
                          启用
                        </button>
                      </Show>
                    </Show>

                    <button
                      class="cursor-pointer rounded-md border border-white/10 bg-transparent px-3 py-1.5 text-xs font-medium text-white/90 transition-all hover:bg-white/10"
                      onClick={() => toggleServerActive(server.name)}
                    >
                      {server.active ? "禁用" : "启用"}
                    </button>

                    <Show when={status && (status?.restart_count || 0) > 0}>
                      <button
                        class="cursor-pointer rounded-md border border-white/10 bg-transparent px-3 py-1.5 text-xs font-medium text-white/90 transition-all hover:bg-white/10"
                        onClick={() => resetRestartCount(server.name)}
                      >
                        重置计数
                      </button>
                    </Show>

                    <button
                      class="cursor-pointer rounded-md border-none bg-red-600 px-3 py-1.5 text-xs font-medium text-white transition-all hover:opacity-90"
                      onClick={() => removeServer(server.name)}
                    >
                      删除
                    </button>
                  </div>
                </div>
              );
            }}
          </For>
        </div>
      </div>
    </div>
  );
}

