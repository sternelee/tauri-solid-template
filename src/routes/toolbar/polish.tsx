import { createSignal, onMount, Show } from 'solid-js';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { commands } from '../../bindings';
import type { TextSelection } from '../../bindings';
import EnhancedAIChatInterface from '../../components/EnhancedAIChatInterface';

export default function PolishPage() {
  const [selection, setSelection] = createSignal<TextSelection | undefined>();
  const [polishedText, setPolishedText] = createSignal('');
  const [loading, setLoading] = createSignal(false);
  const [polishStyle, setPolishStyle] = createSignal('professional');
  const [showAIChat, setShowAIChat] = createSignal(false);

  const polishStyles = [
    { id: 'professional', name: '专业润色', description: '使文本更加正式和专业' },
    { id: 'casual', name: '口语化', description: '使文本更加自然流畅' },
    { id: 'concise', name: '简洁化', description: '删除冗余，突出重点' },
    { id: 'detailed', name: '详细化', description: '增加细节，丰富内容' },
    { id: 'creative', name: '创意改写', description: '增加创意和表现力' },
  ];

  const polish = async () => {
    if (!selection()) return;

    setLoading(true);
    try {
      // 模拟润色过程
      await new Promise(resolve => setTimeout(resolve, 1500));

      const originalText = selection()?.selected_text || '';
      const mockPolishedText = getMockPolishedText(originalText, polishStyle());
      setPolishedText(mockPolishedText);
    } catch (error) {
      console.error('Polish failed:', error);
      setPolishedText('润色失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  const getMockPolishedText = (text: string, style: string): string => {
    const polishedTexts: Record<string, Record<string, string>> = {
      'professional': {
        'This is a test.': 'This document serves as an evaluation of the system functionality.',
        'Hello, how are you?': 'Greetings, I hope this message finds you well.',
        'I think this is good.': 'Upon careful consideration, I believe this demonstrates excellent quality.',
        'Thanks for your help.': 'I would like to express my sincere gratitude for your valuable assistance.',
      },
      'casual': {
        'This is a test.': "Just giving this a quick try to see how it works!",
        'Hello, how are you?': "Hey! How's everything going?",
        'I think this is good.': "Yeah, this looks pretty nice to me!",
        'Thanks for your help.': "Really appreciate you helping me out with this!",
      },
      'concise': {
        'This is a test.': 'Test.',
        'Hello, how are you?': 'How are you?',
        'I think this is good.': 'This is good.',
        'Thanks for your help.': 'Thanks for the help.',
      },
      'detailed': {
        'This is a test.': 'This comprehensive evaluation serves as a thorough assessment of our system\'s capabilities and performance metrics.',
        'Hello, how are you?': 'I wanted to reach out and inquire about your current well-being and overall condition.',
        'I think this is good.': 'After careful analysis and consideration, I have concluded that this demonstrates exemplary characteristics and meets our quality standards.',
        'Thanks for your help.': 'I want to express my deepest appreciation for your generous support and valuable contributions to this endeavor.',
      },
      'creative': {
        'This is a test.': 'Embarking on this experimental journey, we uncover the hidden potentials that lie within.',
        'Hello, how are you?': 'As the sun of curiosity rises, I find myself wondering about the tapestry of your current experience.',
        'I think this is good.': 'Like a master sculptor finding the perfect angle, I see the brilliance that emerges from this creation.',
        'Thanks for your help.': 'Your support has been the gentle wind beneath our wings, lifting us to new heights of possibility.',
      },
    };

    return polishedTexts[style]?.[text] || `[${style} 润色] ${text}`;
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(polishedText());
      const button = document.getElementById('copy-button');
      if (button) {
        const originalText = button.textContent;
        button.textContent = '已复制!';
        setTimeout(() => {
          button.textContent = originalText;
        }, 2000);
      }
    } catch (error) {
      console.error('Failed to copy text:', error);
    }
  };

  const openAIChat = () => {
    setShowAIChat(true);
  };

  const closeAIChat = () => {
    setShowAIChat(false);
  };

  const closeWindow = () => {
    getCurrentWindow().close();
  };

  onMount(async () => {
    try {
      const mockSelection: TextSelection = {
        text: "This is a test.",
        selected_text: "This is a test.",
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
      await polish();
    } catch (error) {
      console.error('Failed to initialize polish page:', error);
    }
  });

  return (
    <div class="polish-page" style={{
      padding: '20px',
      'min-height': '100vh',
      background: '#f8fafc',
      'font-family': 'system-ui, -apple-system, sans-serif',
    }}>
      <Show when={!showAIChat()}>
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
            ✨ 文本润色
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

        {/* Style selector */}
        <div style={{
          'margin-bottom': '16px',
        }}>
          <label style={{
            display: 'block',
            'font-size': '14px',
            'font-weight': '500',
            color: '#374151',
            'margin-bottom': '6px',
          }}>
            润色风格:
          </label>
          <div style={{
            display: 'grid',
            gap: '8px',
          }}>
            {polishStyles.map((style) => (
              <label
                style={{
                  display: 'flex',
                  'align-items': 'start',
                  gap: '8px',
                  padding: '8px',
                  background: polishStyle() === style.id ? '#eff6ff' : 'white',
                  border: `1px solid ${polishStyle() === style.id ? '#3b82f6' : '#e5e7eb'}`,
                  'border-radius': '6px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <input
                  type="radio"
                  name="polishStyle"
                  value={style.id}
                  checked={polishStyle() === style.id}
                  onChange={() => setPolishStyle(style.id)}
                  style={{
                    margin: '2px 0 0 0',
                  }}
                />
                <div>
                  <div style={{
                    'font-size': '14px',
                    'font-weight': '500',
                    color: '#1f2937',
                  }}>
                    {style.name}
                  </div>
                  <div style={{
                    'font-size': '12px',
                    color: '#6b7280',
                    'margin-top': '2px',
                  }}>
                    {style.description}
                  </div>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Original text */}
        <div style={{
          'margin-bottom': '16px',
        }}>
          <label style={{
            display: 'block',
            'font-size': '14px',
            'font-weight': '500',
            color: '#374151',
            'margin-bottom': '6px',
          }}>
            原文:
          </label>
          <div style={{
            padding: '12px',
            background: 'white',
            border: '1px solid #e5e7eb',
            'border-radius': '8px',
            'font-size': '14px',
            color: '#1f2937',
            'line-height': '1.5',
            'min-height': '60px',
          }}>
            {selection()?.selected_text}
          </div>
        </div>

        {/* Action buttons */}
        <div style={{
          display: 'flex',
          gap: '8px',
          'margin-bottom': '16px',
        }}>
          <button
            onClick={polish}
            disabled={loading()}
            style={{
              padding: '8px 16px',
              background: '#8b5cf6',
              color: 'white',
              border: 'none',
              'border-radius': '6px',
              'font-size': '14px',
              cursor: loading() ? 'not-allowed' : 'pointer',
              opacity: loading() ? 0.6 : 1,
            }}
          >
            {loading() ? '润色中...' : '开始润色'}
          </button>
          <button
            id="copy-button"
            onClick={copyToClipboard}
            disabled={!polishedText()}
            style={{
              padding: '8px 16px',
              background: '#10b981',
              color: 'white',
              border: 'none',
              'border-radius': '6px',
              'font-size': '14px',
              cursor: polishedText() ? 'pointer' : 'not-allowed',
              opacity: polishedText() ? 1 : 0.6,
            }}
          >
            复制结果
          </button>
          <Show when={polishedText() && !loading()}>
            <button
              onClick={openAIChat}
              style={{
                padding: '8px 16px',
                background: '#3b82f6',
                color: 'white',
                border: 'none',
                'border-radius': '6px',
                'font-size': '14px',
                cursor: 'pointer',
                display: 'flex',
                'align-items': 'center',
                gap: '4px',
              }}
            >
              💬 继续对话
            </button>
          </Show>
        </div>

        {/* Polished text */}
        <div>
          <label style={{
            display: 'block',
            'font-size': '14px',
            'font-weight': '500',
            color: '#374151',
            'margin-bottom': '6px',
          }}>
            润色结果:
          </label>
          <div style={{
            padding: '12px',
            background: 'white',
            border: '1px solid #e5e7eb',
            'border-radius': '8px',
            'font-size': '14px',
            color: '#1f2937',
            'line-height': '1.5',
            'min-height': '60px',
            position: 'relative',
          }}>
            {loading() ? (
              <div style={{
                display: 'flex',
                'align-items': 'center',
                gap: '8px',
                color: '#6b7280',
              }}>
                <div style={{
                  width: '16px',
                  height: '16px',
                  border: '2px solid #e5e7eb',
                  'border-top': '2px solid #8b5cf6',
                  'border-radius': '50%',
                  animation: 'spin 1s linear infinite',
                }} />
                正在润色文本...
              </div>
            ) : (
              polishedText() || '点击开始润色按钮开始润色'
            )}
          </div>
        </div>

        <style jsx>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </Show>

      {/* AI Chat Interface */}
      <Show when={showAIChat()}>
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.1)',
          'z-index': 1000,
        }}>
          <div style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            background: 'white',
            'border-radius': '12px',
            'box-shadow': '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            width: '600px',
            height: '500px',
            display: 'flex',
            'flex-direction': 'column',
            overflow: 'hidden',
          }}>
            {/* Chat Header */}
            <div style={{
              padding: '16px 20px',
              background: '#8b5cf6',
              color: 'white',
              display: 'flex',
              'align-items': 'center',
              'justify-content': 'space-between',
            }}>
              <div style={{
                'font-size': '16px',
                'font-weight': '600',
              }}>
                💬 AI 对话助手
              </div>
              <button
                onClick={closeAIChat}
                style={{
                  width: '24px',
                  height: '24px',
                  'border-radius': '50%',
                  border: 'none',
                  background: 'rgba(255, 255, 255, 0.2)',
                  color: 'white',
                  cursor: 'pointer',
                  display: 'flex',
                  'align-items': 'center',
                  'justify-content': 'center',
                  'font-size': '14px',
                }}
              >
                ×
              </button>
            </div>

            {/* Chat Context */}
            <div style={{
              padding: '12px 20px',
              background: '#f3f4f6',
              'font-size': '12px',
              color: '#6b7280',
              'border-bottom': '1px solid #e5e7eb',
            }}>
              上下文: 原文 "{selection()?.selected_text}" → 润色为 "{polishedText()}"
            </div>

            {/* Chat Content */}
            <div style={{
              flex: 1,
              overflow: 'hidden',
            }}>
              <EnhancedAIChatInterface />
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
}