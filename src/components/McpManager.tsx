import { createSignal, onMount, For, Show } from "solid-js";
import { commands } from "../bindings";

interface McpServer {
  name: string;
  transport: 'stdio' | 'sse' | 'http';
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
  const [saveStatus, setSaveStatus] = createSignal<'idle' | 'success' | 'error'>('idle');

  // Form state for new server
  const [newServer, setNewServer] = createSignal<Partial<McpServer>>({
    name: '',
    transport: 'stdio',
    command: '',
    args: [],
    env: {},
    url: '',
    headers: {},
    active: true,
  });

  const [newServerArgs, setNewServerArgs] = createSignal('');
  const [newServerEnv, setNewServerEnv] = createSignal('');
  const [newServerHeaders, setNewServerHeaders] = createSignal('');

  onMount(async () => {
    await loadServerConfig();
    await loadServerStatus();
    setIsLoading(false);
  });

  const loadServerConfig = async () => {
    try {
      const result = await commands.getMcpConfigs();
      if (result.status === 'ok' && result.data) {
        const config = JSON.parse(result.data);
        const serverList = Object.entries(config.mcpServers || {}).map(([name, serverConfig]: [string, any]) => ({
          name,
          transport: serverConfig.type || 'stdio',
          command: serverConfig.command || '',
          args: serverConfig.args || [],
          env: serverConfig.env || {},
          url: serverConfig.url || '',
          headers: serverConfig.headers || {},
          active: serverConfig.active !== false,
        }));
        setServers(serverList);
      }
    } catch (error) {
      console.error('Failed to load MCP configs:', error);
    }
  };

  const loadServerStatus = async () => {
    try {
      const result = await commands.getMcpServerStatus();
      if (result.status === 'ok' && result.data) {
        setServerStatus(result.data);
      }
    } catch (error) {
      console.error('Failed to load MCP server status:', error);
    }
  };

  const saveServerConfig = async () => {
    setIsSaving(true);
    setSaveStatus('idle');

    try {
      const config = {
        mcpServers: servers().reduce((acc, server) => {
          acc[server.name] = {
            type: server.transport,
            active: server.active,
            ...(server.transport === 'stdio' ? {
              command: server.command,
              args: server.args,
              env: server.env,
            } : {}),
            ...(server.transport === 'http' || server.transport === 'sse' ? {
              url: server.url,
              headers: server.headers,
            } : {}),
          };
          return acc;
        }, {} as Record<string, any>)
      };

      const result = await commands.saveMcpConfigs(JSON.stringify(config));
      if (result.status === 'ok') {
        setSaveStatus('success');
        setTimeout(() => setSaveStatus('idle'), 2000);
      } else {
        setSaveStatus('error');
        setTimeout(() => setSaveStatus('idle'), 3000);
      }
    } catch (error) {
      console.error('Failed to save MCP configs:', error);
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } finally {
      setIsSaving(false);
    }
  };

  const addServer = () => {
    const server = newServer();
    if (!server.name) return;

    // Parse args, env, and headers from text inputs
    const args = server.args || (newServerArgs() ? newServerArgs().split(' ').filter(arg => arg.trim()) : []);
    const env = server.env || (newServerEnv() ?
      Object.fromEntries(newServerEnv().split('\n').map(line => {
        const [key, value] = line.split('=').map(s => s.trim());
        return [key, value];
      }).filter(([key]) => key)) : {});
    const headers = server.headers || (newServerHeaders() ?
      Object.fromEntries(newServerHeaders().split('\n').map(line => {
        const [key, value] = line.split(':').map(s => s.trim());
        return [key, value];
      }).filter(([key]) => key)) : {});

    const fullServer: McpServer = {
      name: server.name!,
      transport: server.transport as 'stdio' | 'sse' | 'http',
      command: server.command || '',
      args,
      env,
      url: server.url || '',
      headers,
      active: server.active || true,
      connected: false,
      restart_count: 0,
    };

    setServers(prev => [...prev, fullServer]);
    setNewServer({
      name: '',
      transport: 'stdio',
      command: '',
      args: [],
      env: {},
      url: '',
      headers: {},
      active: true,
    });
    setNewServerArgs('');
    setNewServerEnv('');
    setNewServerHeaders('');
    setShowAddForm(false);
  };

  const removeServer = (name: string) => {
    setServers(prev => prev.filter(server => server.name !== name));
  };

  const toggleServerActive = (name: string) => {
    setServers(prev => prev.map(server =>
      server.name === name ? { ...server, active: !server.active } : server
    ));
  };

  const activateServer = async (name: string) => {
    try {
      const server = servers().find(s => s.name === name);
      if (!server) return;

      const config = {
        type: server.transport,
        active: true,
        ...(server.transport === 'stdio' ? {
          command: server.command,
          args: server.args,
          env: server.env,
        } : {}),
        ...(server.transport === 'http' || server.transport === 'sse' ? {
          url: server.url,
          headers: server.headers,
        } : {}),
      };

      const result = await commands.activateMcpServer(name, config);
      if (result.status === 'ok') {
        await loadServerStatus();
      }
    } catch (error) {
      console.error('Failed to activate server:', error);
    }
  };

  const deactivateServer = async (name: string) => {
    try {
      const result = await commands.deactivateMcpServer(name);
      if (result.status === 'ok') {
        await loadServerStatus();
      }
    } catch (error) {
      console.error('Failed to deactivate server:', error);
    }
  };

  const restartAllServers = async () => {
    try {
      const result = await commands.restartMcpServers();
      if (result.status === 'ok') {
        await loadServerStatus();
      }
    } catch (error) {
      console.error('Failed to restart servers:', error);
    }
  };

  const resetRestartCount = async (serverName: string) => {
    try {
      const result = await commands.resetMcpRestartCount(serverName);
      if (result.status === 'ok') {
        await loadServerStatus();
      }
    } catch (error) {
      console.error('Failed to reset restart count:', error);
    }
  };

  const getServerStatus = (name: string) => {
    return serverStatus().find(status => status.name === name);
  };

  return (
    <div class="mcp-manager">
      <div class="mcp-header">
        <h2>MCP 服务器管理</h2>
        <div class="mcp-actions">
          <button
            class="btn btn-secondary"
            onClick={restartAllServers}
          >
            🔄 重启所有服务器
          </button>
          <button
            class="btn btn-primary"
            onClick={saveServerConfig}
            disabled={isSaving()}
          >
            {isSaving() ? '保存中...' : '保存配置'}
          </button>
        </div>
      </div>

      {/* Save Status */}
      <Show when={saveStatus() !== 'idle'}>
        <div class={`save-status save-status-${saveStatus()}`}>
          {saveStatus() === 'success' ? '✅ 配置已保存' : '❌ 保存失败'}
        </div>
      </Show>

      {/* Add Server Form */}
      <Show when={showAddForm()}>
        <div class="add-server-form">
          <h3>添加新服务器</h3>

          <div class="form-grid">
            <div class="form-group">
              <label>服务器名称</label>
              <input
                type="text"
                value={newServer().name || ''}
                onChange={(e) => setNewServer(prev => ({ ...prev, name: e.target.value }))}
                placeholder="例如: exa"
              />
            </div>

            <div class="form-group">
              <label>传输类型</label>
              <select
                value={newServer().transport || 'stdio'}
                onChange={(e) => setNewServer(prev => ({ ...prev, transport: e.target.value as any }))}
              >
                <option value="stdio">STDIO (命令行)</option>
                <option value="http">HTTP</option>
                <option value="sse">SSE</option>
              </select>
            </div>

            <Show when={newServer().transport === 'stdio'}>
              <div class="form-group">
                <label>命令</label>
                <input
                  type="text"
                  value={newServer().command || ''}
                  onChange={(e) => setNewServer(prev => ({ ...prev, command: e.target.value }))}
                  placeholder="例如: npx"
                />
              </div>

              <div class="form-group">
                <label>参数 (空格分隔)</label>
                <input
                  type="text"
                  value={newServerArgs()}
                  onChange={(e) => setNewServerArgs(e.target.value)}
                  placeholder="例如: @exa/mcp-server"
                />
              </div>

              <div class="form-group">
                <label>环境变量 (每行一个，格式: KEY=VALUE)</label>
                <textarea
                  value={newServerEnv()}
                  onChange={(e) => setNewServerEnv(e.target.value)}
                  placeholder="例如: API_KEY=your_key_here"
                  rows="3"
                />
              </div>
            </Show>

            <Show when={newServer().transport === 'http' || newServer().transport === 'sse'}>
              <div class="form-group">
                <label>URL</label>
                <input
                  type="text"
                  value={newServer().url || ''}
                  onChange={(e) => setNewServer(prev => ({ ...prev, url: e.target.value }))}
                  placeholder="例如: https://mcp.exa.ai/mcp"
                />
              </div>

              <div class="form-group">
                <label>请求头 (每行一个，格式: KEY: VALUE)</label>
                <textarea
                  value={newServerHeaders()}
                  onChange={(e) => setNewServerHeaders(e.target.value)}
                  placeholder="例如: Authorization: Bearer your_token"
                  rows="3"
                />
              </div>
            </Show>

            <div class="form-group">
              <label class="checkbox-label">
                <input
                  type="checkbox"
                  checked={newServer().active || true}
                  onChange={(e) => setNewServer(prev => ({ ...prev, active: e.target.checked }))}
                />
                启用服务器
              </label>
            </div>
          </div>

          <div class="form-actions">
            <button
              class="btn btn-secondary"
              onClick={() => setShowAddForm(false)}
            >
              取消
            </button>
            <button
              class="btn btn-primary"
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
        <div class="list-header">
          <h3>已配置的服务器</h3>
          <button
            class="btn btn-ghost"
            onClick={() => setShowAddForm(true)}
          >
            ➕ 添加服务器
          </button>
        </div>

        <Show when={servers().length === 0 && !isLoading()}>
          <div class="empty-state">
            <p>还没有配置任何 MCP 服务器</p>
            <button
              class="btn btn-primary"
              onClick={() => setShowAddForm(true)}
            >
              添加第一个服务器
            </button>
          </div>
        </Show>

        <Show when={isLoading()}>
          <div class="loading-state">
            <p>加载中...</p>
          </div>
        </Show>

        <div class="servers-grid">
          <For each={servers()}>
            {server => {
              const status = getServerStatus(server.name);
              return (
                <div class="server-card">
                  <div class="server-header">
                    <h4>{server.name}</h4>
                    <div class="server-badges">
                      <span class={`status-badge ${server.active ? 'active' : 'inactive'}`}>
                        {server.active ? '启用' : '禁用'}
                      </span>
                      <Show when={status}>
                        <span class={`status-badge ${status?.connected ? 'connected' : 'disconnected'}`}>
                          {status?.connected ? '已连接' : '未连接'}
                        </span>
                      </Show>
                    </div>
                  </div>

                  <div class="server-details">
                    <div class="detail-item">
                      <span class="detail-label">传输:</span>
                      <span class="detail-value">{server.transport}</span>
                    </div>

                    <Show when={server.transport === 'stdio'}>
                      <div class="detail-item">
                        <span class="detail-label">命令:</span>
                        <span class="detail-value">{server.command} {server.args?.join(' ')}</span>
                      </div>
                    </Show>

                    <Show when={server.transport === 'http' || server.transport === 'sse'}>
                      <div class="detail-item">
                        <span class="detail-label">URL:</span>
                        <span class="detail-value">{server.url}</span>
                      </div>
                    </Show>

                    <Show when={status}>
                      <div class="detail-item">
                        <span class="detail-label">重启次数:</span>
                        <span class="detail-value">{status?.restart_count || 0}</span>
                      </div>
                    </Show>
                  </div>

                  <div class="server-actions">
                    <Show when={server.active}>
                      <Show when={status?.connected}>
                        <button
                          class="btn btn-sm btn-secondary"
                          onClick={() => deactivateServer(server.name)}
                        >
                          停用
                        </button>
                      </Show>
                      <Show when={!status?.connected}>
                        <button
                          class="btn btn-sm btn-primary"
                          onClick={() => activateServer(server.name)}
                        >
                          启用
                        </button>
                      </Show>
                    </Show>

                    <button
                      class="btn btn-sm btn-ghost"
                      onClick={() => toggleServerActive(server.name)}
                    >
                      {server.active ? '禁用' : '启用'}
                    </button>

                    <Show when={status && (status?.restart_count || 0) > 0}>
                      <button
                        class="btn btn-sm btn-ghost"
                        onClick={() => resetRestartCount(server.name)}
                      >
                        重置计数
                      </button>
                    </Show>

                    <button
                      class="btn btn-sm btn-danger"
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

      <style jsx>{`
        .mcp-manager {
          padding: 24px;
          max-width: 1200px;
          margin: 0 auto;
        }

        .mcp-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 24px;
          padding-bottom: 16px;
          border-bottom: 1px solid var(--raycast-border);
        }

        .mcp-header h2 {
          margin: 0;
          font-size: 24px;
          font-weight: 600;
          color: var(--raycast-foreground);
        }

        .mcp-actions {
          display: flex;
          gap: 12px;
        }

        .save-status {
          position: fixed;
          top: 20px;
          right: 20px;
          padding: 12px 16px;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 500;
          z-index: 1000;
          animation: slideIn 0.3s ease;
        }

        .save-status-success {
          background: var(--raycast-success);
          color: white;
        }

        .save-status-error {
          background: var(--raycast-destructive);
          color: white;
        }

        @keyframes slideIn {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }

        .add-server-form {
          background: var(--raycast-surface);
          border: 1px solid var(--raycast-border);
          border-radius: 12px;
          padding: 24px;
          margin-bottom: 24px;
        }

        .add-server-form h3 {
          margin: 0 0 20px 0;
          font-size: 18px;
          font-weight: 600;
          color: var(--raycast-foreground);
        }

        .form-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 16px;
          margin-bottom: 20px;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .form-group label {
          font-weight: 500;
          color: var(--raycast-foreground);
          font-size: 14px;
        }

        .form-group input,
        .form-group select,
        .form-group textarea {
          padding: 8px 12px;
          border: 1px solid var(--raycast-border);
          border-radius: 6px;
          background: var(--raycast-input);
          color: var(--raycast-foreground);
          font-size: 14px;
        }

        .form-group input:focus,
        .form-group select:focus,
        .form-group textarea:focus {
          outline: none;
          border-color: var(--raycast-accent-foreground);
        }

        .checkbox-label {
          display: flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
        }

        .checkbox-label input[type="checkbox"] {
          margin: 0;
        }

        .form-actions {
          display: flex;
          gap: 12px;
          justify-content: flex-end;
        }

        .list-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }

        .list-header h3 {
          margin: 0;
          font-size: 18px;
          font-weight: 600;
          color: var(--raycast-foreground);
        }

        .empty-state,
        .loading-state {
          text-align: center;
          padding: 40px;
          color: var(--raycast-muted);
        }

        .servers-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
          gap: 16px;
        }

        .server-card {
          background: var(--raycast-surface);
          border: 1px solid var(--raycast-border);
          border-radius: 12px;
          padding: 20px;
          transition: all 0.15s ease;
        }

        .server-card:hover {
          border-color: var(--raycast-accent-foreground);
        }

        .server-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        }

        .server-header h4 {
          margin: 0;
          font-size: 16px;
          font-weight: 600;
          color: var(--raycast-foreground);
        }

        .server-badges {
          display: flex;
          gap: 8px;
        }

        .status-badge {
          padding: 4px 8px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 500;
        }

        .status-badge.active {
          background: var(--raycast-success);
          color: white;
        }

        .status-badge.inactive {
          background: var(--raycast-muted);
          color: var(--raycast-foreground);
        }

        .status-badge.connected {
          background: var(--raycast-accent-foreground);
          color: var(--raycast-accent);
        }

        .status-badge.disconnected {
          background: var(--raycast-border);
          color: var(--raycast-muted);
        }

        .server-details {
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin-bottom: 16px;
        }

        .detail-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 13px;
        }

        .detail-label {
          color: var(--raycast-muted);
          font-weight: 500;
        }

        .detail-value {
          color: var(--raycast-foreground);
          font-family: monospace;
          font-size: 12px;
          word-break: break-all;
        }

        .server-actions {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .btn {
          padding: 8px 16px;
          border: none;
          border-radius: 6px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .btn-primary {
          background: var(--raycast-accent-foreground);
          color: var(--raycast-accent);
        }

        .btn-primary:hover:not(:disabled) {
          opacity: 0.9;
        }

        .btn-secondary {
          background: var(--raycast-accent);
          color: var(--raycast-accent-foreground);
        }

        .btn-secondary:hover {
          opacity: 0.8;
        }

        .btn-danger {
          background: var(--raycast-destructive);
          color: white;
        }

        .btn-danger:hover {
          opacity: 0.9;
        }

        .btn-ghost {
          background: transparent;
          color: var(--raycast-foreground);
          border: 1px solid var(--raycast-border);
        }

        .btn-ghost:hover {
          background: var(--raycast-accent);
        }

        .btn-sm {
          padding: 6px 12px;
          font-size: 12px;
        }

        @media (max-width: 768px) {
          .servers-grid {
            grid-template-columns: 1fr;
          }

          .form-grid {
            grid-template-columns: 1fr;
          }

          .mcp-header {
            flex-direction: column;
            gap: 16px;
            align-items: stretch;
          }

          .mcp-actions {
            justify-content: stretch;
          }

          .mcp-actions .btn {
            flex: 1;
          }
        }
      `}</style>
    </div>
  );
}