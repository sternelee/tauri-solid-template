import { createSignal, onMount } from 'solid-js';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { commands } from '../../bindings';
import type { TextSelection } from '../../bindings';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export default function ChatWithFilePage() {
  const [selection, setSelection] = createSignal<TextSelection | undefined>();
  const [messages, setMessages] = createSignal<Message[]>([]);
  const [inputMessage, setInputMessage] = createSignal('');
  const [loading, setLoading] = createSignal(false);
  const [filePath, setFilePath] = createSignal('');

  const addMessage = (role: 'user' | 'assistant', content: string) => {
    const message: Message = {
      id: Date.now().toString(),
      role,
      content,
      timestamp: new Date().toISOString(),
    };
    setMessages(prev => [...prev, message]);
  };

  const sendMessage = async () => {
    const message = inputMessage().trim();
    if (!message && !filePath()) return;

    setLoading(true);

    // Add user message
    if (message) {
      addMessage('user', message);
    } else {
      addMessage('user', `请分析这个文件: ${filePath()}`);
    }

    setInputMessage('');

    try {
      // In a real implementation, this would call the AI chat with file functionality
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Mock AI response
      const mockResponse = getMockAIResponse(message, filePath());
      addMessage('assistant', mockResponse);
    } catch (error) {
      console.error('Failed to send message:', error);
      addMessage('assistant', '抱歉，处理您的请求时出现了错误。请重试。');
    } finally {
      setLoading(false);
    }
  };

  const getMockAIResponse = (userMessage: string, filePath: string): string => {
    if (!filePath) {
      return "我注意到您选择了文件路径。请告诉我您想要对这个文件做什么？我可以帮您：\n\n1. 📖 分析文件内容和结构\n2. 🔍 在文件中搜索特定信息\n3. 📝 总结文件要点\n4. 💡 提供改进建议\n5. 🔄 转换文件格式\n\n请选择一个操作或告诉我您的具体需求。";
    }

    const fileExtension = filePath.split('.').pop()?.toLowerCase() || '';

    switch (fileExtension) {
      case 'js':
      case 'ts':
      case 'jsx':
      case 'tsx':
        return `我分析了这个 JavaScript/TypeScript 文件。这是一段代码文件，包含了：

**主要功能：**
- 函数定义和组件结构
- 可能包含状态管理和事件处理

**代码特点：**
- 采用了现代 JavaScript/TypeScript 语法
- 可能使用了 React 或其他前端框架

**改进建议：**
- 考虑添加适当的错误处理
- 优化代码结构和可读性
- 添加必要的注释说明

有什么特定的代码问题或功能需要我帮助分析吗？`;

      case 'py':
        return `我分析了这个 Python 文件。这是一段 Python 代码，包含了：

**代码结构：**
- 可能包含函数定义和类
- 使用了 Python 的标准库或第三方库

**功能分析：**
- 涉及数据处理或算法实现
- 可能包含文件操作或网络请求

**最佳实践建议：**
- 遵循 PEP 8 代码规范
- 添加类型提示
- 考虑异常处理机制

有什么具体的 Python 代码问题需要我帮助解决吗？`;

      case 'md':
      case 'txt':
        return `我分析了这个文档文件。这是一个文本文档，内容概要如下：

**文档类型：** ${fileExtension === 'md' ? 'Markdown 文档' : '纯文本文档'}

**主要内容：**
- 包含结构化的文本内容
- 可能包含标题、列表和段落
- 文档逻辑清晰，层次分明

**内容特点：**
- 语言表达准确
- 结构组织合理
- 信息密度适中

有什么特定的文档问题或内容需要我帮助处理吗？`;

      default:
        return `我分析了这个文件：${filePath}

**文件信息：**
- 文件类型：${fileExtension || '未知'}
- 文件大小和创建时间等信息可进一步获取

**初步分析：**
这是一个 ${fileExtension} 格式的文件。我可以帮您：

1. **内容分析** - 深入理解文件内容
2. **格式转换** - 转换为其他格式
3. **信息提取** - 提取关键信息
4. **内容总结** - 生成文件摘要
5. **问题解答** - 回答关于文件的问题

请告诉我您希望我做什么？`;
    }
  };

  const handleKeyPress = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const closeWindow = () => {
    getCurrentWindow().close();
  };

  onMount(async () => {
    try {
      const mockSelection: TextSelection = {
        text: "/path/to/example.js",
        selected_text: "/path/to/example.js",
        rect: {
          x: 0,
          y: 0,
          width: 0,
          height: 0,
          screen: undefined,
        },
        timestamp: new Date().toISOString(),
        source_app: undefined,
        context_type: "FilePath",
      };

      setSelection(mockSelection);
      setFilePath(mockSelection.selected_text);

      // Auto-initialize conversation
      await sendMessage();
    } catch (error) {
      console.error('Failed to initialize chat with file page:', error);
    }
  });

  return (
    <div class="chat-with-file-page" style={{
      display: 'flex',
      'flex-direction': 'column',
      height: '100vh',
      background: '#f8fafc',
      'font-family': 'system-ui, -apple-system, sans-serif',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        'align-items': 'center',
        'justify-content': 'space-between',
        padding: '16px 20px',
        background: 'white',
        'border-bottom': '1px solid #e5e7eb',
      }}>
        <div style={{
          display: 'flex',
          'align-items': 'center',
          gap: '8px',
        }}>
          <span style={{ 'font-size': '18px' }}>💬</span>
          <h2 style={{
            margin: 0,
            'font-size': '16px',
            'font-weight': '600',
            color: '#1f2937',
          }}>
            Chat with File
          </h2>
        </div>
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

      {/* File info */}
      <Show when={filePath()}>
        <div style={{
          padding: '12px 20px',
          background: '#eff6ff',
          'border-bottom': '1px solid #dbeafe',
        }}>
          <div style={{
            display: 'flex',
            'align-items': 'center',
            gap: '8px',
          }}>
            <span style={{ 'font-size': '14px' }}>📄</span>
            <div style={{
              'font-size': '13px',
              color: '#1d4ed8',
              'font-weight': '500',
            }}>
              {filePath()}
            </div>
          </div>
        </div>
      </Show>

      {/* Messages */}
      <div style={{
        flex: 1,
        overflow: 'auto',
        padding: '20px',
        display: 'flex',
        'flex-direction': 'column',
        gap: '16px',
      }}>
        <For each={messages()}>
          {(message) => (
            <div
              style={{
                display: 'flex',
                'flex-direction': 'column',
                gap: '4px',
                'align-self': message.role === 'user' ? 'flex-end' : 'flex-start',
                'max-width': '80%',
              }}
            >
              <div style={{
                padding: '12px 16px',
                'border-radius': '12px',
                background: message.role === 'user' ? '#3b82f6' : 'white',
                color: message.role === 'user' ? 'white' : '#1f2937',
                'font-size': '14px',
                'line-height': '1.5',
                'box-shadow': '0 1px 3px rgba(0, 0, 0, 0.1)',
                'white-space': 'pre-wrap',
              }}>
                {message.content}
              </div>
              <div style={{
                'font-size': '11px',
                color: '#9ca3af',
                'align-self': message.role === 'user' ? 'flex-end' : 'flex-start',
              }}>
                {new Date(message.timestamp).toLocaleTimeString()}
              </div>
            </div>
          )}
        </For>

        {loading() && (
          <div style={{
            display: 'flex',
            'align-items': 'center',
            gap: '8px',
            padding: '12px 16px',
            background: 'white',
            'border-radius': '12px',
            'box-shadow': '0 1px 3px rgba(0, 0, 0, 0.1)',
            'align-self': 'flex-start',
          }}>
            <div style={{
              width: '16px',
              height: '16px',
              border: '2px solid #e5e7eb',
              'border-top': '2px solid #3b82f6',
              'border-radius': '50%',
              animation: 'spin 1s linear infinite',
            }} />
            <span style={{
              'font-size': '14px',
              color: '#6b7280',
            }}>
              正在思考...
            </span>
          </div>
        )}
      </div>

      {/* Input */}
      <div style={{
        padding: '16px 20px',
        background: 'white',
        'border-top': '1px solid #e5e7eb',
      }}>
        <div style={{
          display: 'flex',
          gap: '8px',
        }}>
          <textarea
            value={inputMessage()}
            onInput={(e) => setInputMessage(e.currentTarget.value)}
            onKeyDown={handleKeyPress}
            placeholder="输入您的问题..."
            disabled={loading()}
            style={{
              flex: 1,
              padding: '10px 12px',
              border: '1px solid #d1d5db',
              'border-radius': '8px',
              'font-size': '14px',
              resize: 'none',
              'min-height': '40px',
              'max-height': '120px',
              'font-family': 'inherit',
            }}
          />
          <button
            onClick={sendMessage}
            disabled={loading() || (!inputMessage().trim() && !filePath())}
            style={{
              padding: '10px 16px',
              background: '#3b82f6',
              color: 'white',
              border: 'none',
              'border-radius': '8px',
              'font-size': '14px',
              cursor: (loading() || (!inputMessage().trim() && !filePath())) ? 'not-allowed' : 'pointer',
              opacity: (loading() || (!inputMessage().trim() && !filePath())) ? 0.6 : 1,
              'align-self': 'flex-end',
            }}
          >
            发送
          </button>
        </div>
        <div style={{
          'font-size': '12px',
          color: '#6b7280',
          'margin-top': '4px',
        }}>
          按 Enter 发送，Shift+Enter 换行
        </div>
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