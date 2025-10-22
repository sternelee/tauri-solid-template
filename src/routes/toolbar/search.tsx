import { createSignal, onMount } from 'solid-js';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { commands } from '../../bindings';
import type { TextSelection } from '../../bindings';

interface SearchResult {
  id: string;
  title: string;
  url: string;
  snippet: string;
  source: 'web' | 'local' | 'knowledge';
}

export default function SearchPage() {
  const [selection, setSelection] = createSignal<TextSelection | undefined>();
  const [searchResults, setSearchResults] = createSignal<SearchResult[]>([]);
  const [loading, setLoading] = createSignal(false);
  const [searchQuery, setSearchQuery] = createSignal('');
  const [activeTab, setActiveTab] = createSignal<'web' | 'local' | 'knowledge'>('web');

  const searchTabs = [
    { id: 'web', name: '网络搜索', icon: '🌐' },
    { id: 'local', name: '本地搜索', icon: '💻' },
    { id: 'knowledge', name: '知识库', icon: '📚' },
  ];

  const performSearch = async () => {
    const query = searchQuery() || selection()?.selected_text || '';
    if (!query.trim()) return;

    setLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Mock search results based on tab
      const mockResults = getMockSearchResults(query, activeTab());
      setSearchResults(mockResults);
    } catch (error) {
      console.error('Search failed:', error);
      setSearchResults([]);
    } finally {
      setLoading(false);
    }
  };

  const getMockSearchResults = (query: string, source: 'web' | 'local' | 'knowledge'): SearchResult[] => {
    const baseResults: SearchResult[] = [
      {
        id: '1',
        title: `关于 "${query}" 的详细信息`,
        url: 'https://example.com/details',
        snippet: `这里是关于 ${query} 的详细描述和相关信息。`,
        source: source,
      },
      {
        id: '2',
        title: `${query} - 相关资源`,
        url: 'https://example.com/resources',
        snippet: `与 ${query} 相关的资源和工具集合。`,
        source: source,
      },
      {
        id: '3',
        title: `${query} 的最佳实践`,
        url: 'https://example.com/best-practices',
        snippet: `在使用 ${query} 时的最佳实践和建议。`,
        source: source,
      },
    ];

    if (source === 'local') {
      return baseResults.map(result => ({
        ...result,
        url: `file:///path/to/local/files/${result.id}`,
        snippet: `本地文件中关于 ${query} 的内容...`,
      }));
    }

    if (source === 'knowledge') {
      return baseResults.map(result => ({
        ...result,
        title: `[知识库] ${result.title}`,
        url: `knowledge://${result.id}`,
        snippet: `从知识库中找到的关于 ${query} 的内容...`,
      }));
    }

    return baseResults;
  };

  const openUrl = (url: string) => {
    if (url.startsWith('knowledge://')) {
      // Handle knowledge base links
      console.log('Open knowledge item:', url);
    } else if (url.startsWith('file://')) {
      // Handle local file links
      commands.executeCommand('open', [url.replace('file://', '')]);
    } else {
      // Handle web URLs
      commands.executeCommand('open', [url]);
    }
  };

  const closeWindow = () => {
    getCurrentWindow().close();
  };

  onMount(async () => {
    try {
      const mockSelection: TextSelection = {
        text: "SolidJS",
        selected_text: "SolidJS",
        rect: {
          x: 0,
          y: 0,
          width: 0,
          height: 0,
          screen: undefined,
        },
        timestamp: new Date().toISOString(),
        source_app: undefined,
        context_type: "Text",
      };

      setSelection(mockSelection);
      setSearchQuery(mockSelection.selected_text);
      await performSearch();
    } catch (error) {
      console.error('Failed to initialize search page:', error);
    }
  });

  return (
    <div class="search-page" style={{
      padding: '20px',
      'min-height': '100vh',
      background: '#f8fafc',
      'font-family': 'system-ui, -apple-system, sans-serif',
      'max-width': '800px',
      margin: '0 auto',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        'align-items': 'center',
        'justify-content': 'space-between',
        'margin-bottom': '20px',
      }}>
        <h2 style={{
          margin: 0,
          'font-size': '18px',
          'font-weight': '600',
          color: '#1f2937',
        }}>
          🔍 搜索
        </h2>
        <button
          onClick={closeWindow}
          style={{
            width: '24px',
            height: '24px',
            'border-radius': '50%',
            border: 'none',
            background: '#e5e7eb',
            cursor: 'pointer',
            display: 'flex',
            'align-items': 'center',
            'justify-content': 'center',
            'font-size': '14px',
            color: '#6b7280',
          }}
        >
          ×
        </button>
      </div>

      {/* Search input */}
      <div style={{
        'margin-bottom': '16px',
      }}>
        <div style={{
          display: 'flex',
          gap: '8px',
        }}>
          <input
            type="text"
            value={searchQuery()}
            onInput={(e) => setSearchQuery(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                performSearch();
              }
            }}
            placeholder="输入搜索内容..."
            style={{
              flex: 1,
              padding: '10px 12px',
              border: '1px solid #d1d5db',
              'border-radius': '6px',
              'font-size': '14px',
              background: 'white',
            }}
          />
          <button
            onClick={performSearch}
            disabled={loading()}
            style={{
              padding: '10px 16px',
              background: '#3b82f6',
              color: 'white',
              border: 'none',
              'border-radius': '6px',
              'font-size': '14px',
              cursor: loading() ? 'not-allowed' : 'pointer',
              opacity: loading() ? 0.6 : 1,
            }}
          >
            {loading() ? '搜索中...' : '搜索'}
          </button>
        </div>
        <Show when={selection()}>
          <div style={{
            'font-size': '12px',
            color: '#6b7280',
            'margin-top': '4px',
          }}>
            选中文本: "{selection()?.selected_text}"
          </div>
        </Show>
      </div>

      {/* Search tabs */}
      <div style={{
        display: 'flex',
        gap: '4px',
        'margin-bottom': '16px',
        background: '#f3f4f6',
        padding: '4px',
        'border-radius': '8px',
      }}>
        <For each={searchTabs}>
          {(tab) => (
            <button
              onClick={() => setActiveTab(tab.id as any)}
              style={{
                flex: 1,
                padding: '8px 12px',
                background: activeTab() === tab.id ? 'white' : 'transparent',
                border: 'none',
                'border-radius': '6px',
                'font-size': '14px',
                cursor: 'pointer',
                display: 'flex',
                'align-items': 'center',
                'justify-content': 'center',
                gap: '4px',
                color: activeTab() === tab.id ? '#1f2937' : '#6b7280',
                'font-weight': activeTab() === tab.id ? '500' : '400',
                'box-shadow': activeTab() === tab.id ? '0 1px 3px rgba(0, 0, 0, 0.1)' : 'none',
              }}
            >
              <span>{tab.icon}</span>
              <span>{tab.name}</span>
            </button>
          )}
        </For>
      </div>

      {/* Search results */}
      <div>
        <Show when={!loading() && searchResults().length === 0}>
          <div style={{
            'text-align': 'center',
            padding: '40px',
            color: '#6b7280',
            'font-size': '14px',
          }}>
            <div style={{
              'font-size': '48px',
              'margin-bottom': '8px',
            }}>
              🔍
            </div>
            {searchQuery() ? '未找到相关结果' : '输入内容开始搜索'}
          </div>
        </Show>

        <Show when={loading()}>
          <div style={{
            'text-align': 'center',
            padding: '40px',
            color: '#6b7280',
            'font-size': '14px',
          }}>
            <div style={{
              width: '24px',
              height: '24px',
              border: '2px solid #e5e7eb',
              'border-top': '2px solid #3b82f6',
              'border-radius': '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto 12px',
            }} />
            正在搜索...
          </div>
        </Show>

        <Show when={!loading() && searchResults().length > 0}>
          <div style={{
            display: 'flex',
            'flex-direction': 'column',
            gap: '12px',
          }}>
            <For each={searchResults()}>
              {(result) => (
                <div
                  style={{
                    background: 'white',
                    border: '1px solid #e5e7eb',
                    'border-radius': '8px',
                    padding: '16px',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  onClick={() => openUrl(result.url)}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.1)';
                    e.currentTarget.style.borderColor = '#3b82f6';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.boxShadow = 'none';
                    e.currentTarget.style.borderColor = '#e5e7eb';
                  }}
                >
                  <div style={{
                    display: 'flex',
                    'align-items': 'center',
                    gap: '8px',
                    'margin-bottom': '4px',
                  }}>
                    <span style={{
                      'font-size': '12px',
                      padding: '2px 6px',
                      background: result.source === 'web' ? '#eff6ff' :
                                   result.source === 'local' ? '#f0fdf4' : '#fef3c7',
                      'border-radius': '4px',
                      color: result.source === 'web' ? '#1d4ed8' :
                             result.source === 'local' ? '#15803d' : '#92400e',
                      'font-weight': '500',
                    }}>
                      {result.source === 'web' ? '网页' :
                       result.source === 'local' ? '本地' : '知识库'}
                    </span>
                    <h3 style={{
                      margin: 0,
                      'font-size': '14px',
                      'font-weight': '500',
                      color: '#1f2937',
                      flex: 1,
                    }}>
                      {result.title}
                    </h3>
                  </div>
                  <p style={{
                    margin: 0,
                    'font-size': '13px',
                    color: '#6b7280',
                    'line-height': '1.4',
                  }}>
                    {result.snippet}
                  </p>
                  <div style={{
                    'font-size': '12px',
                    color: '#9ca3af',
                    'margin-top': '8px',
                  }}>
                    {result.url}
                  </div>
                </div>
              )}
            </For>
          </div>
        </Show>
      </div>

      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}