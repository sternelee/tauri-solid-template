import { createSignal, onMount } from 'solid-js';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { commands } from '../../bindings';
import type { TextSelection } from '../../bindings';

export default function TranslatePage() {
  const [selection, setSelection] = createSignal<TextSelection | undefined>();
  const [translatedText, setTranslatedText] = createSignal('');
  const [loading, setLoading] = createSignal(false);
  const [targetLanguage, setTargetLanguage] = createSignal('zh-CN');

  const targetLanguages = [
    { code: 'zh-CN', name: '简体中文' },
    { code: 'en', name: 'English' },
    { code: 'ja', name: '日本語' },
    { code: 'ko', name: '한국어' },
    { code: 'fr', name: 'Français' },
    { code: 'de', name: 'Deutsch' },
    { code: 'es', name: 'Español' },
    { code: 'ru', name: 'Русский' },
  ];

  const translate = async () => {
    if (!selection()) return;

    setLoading(true);
    try {
      // In a real implementation, this would call an AI service for translation
      // For now, we'll simulate a translation
      await new Promise(resolve => setTimeout(resolve, 1000));

      const originalText = selection()?.selected_text || '';
      const mockTranslation = getMockTranslation(originalText, targetLanguage());
      setTranslatedText(mockTranslation);
    } catch (error) {
      console.error('Translation failed:', error);
      setTranslatedText('翻译失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  const getMockTranslation = (text: string, targetLang: string): string => {
    // Mock translations for demonstration
    const translations: Record<string, Record<string, string>> = {
      'zh-CN': {
        'Hello, world!': '你好，世界！',
        'This is a test.': '这是一个测试。',
        'How are you?': '你好吗？',
        'Thank you very much.': '非常感谢。',
        'Goodbye!': '再见！',
      },
      'en': {
        '你好，世界！': 'Hello, world!',
        '这是一个测试。': 'This is a test.',
        '你好吗？': 'How are you?',
        '非常感谢。': 'Thank you very much.',
        '再见！': 'Goodbye!',
      },
    };

    return translations[targetLang]?.[text] || `[${targetLang}] ${text}`;
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(translatedText());
      // Show success feedback
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

  const replaceOriginalText = async () => {
    if (!selection() || !translatedText()) return;

    try {
      const result = await commands.replaceOriginalText(
        selection()?.selected_text || '',
        translatedText(),
      );

      // Show success message
      alert(result || '翻译结果已复制到剪贴板，请手动粘贴替换原文');
    } catch (error) {
      console.error('Failed to replace text:', error);
      alert('替换文本失败，请重试');
    }
  };

  const closeWindow = () => {
    getCurrentWindow().close();
  };

  onMount(async () => {
    // Get selection data (in real implementation, this would come from backend)
    try {
      const mockSelection: TextSelection = {
        text: "Hello, world!",
        selected_text: "Hello, world!",
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

      // Auto-translate on mount
      await translate();
    } catch (error) {
      console.error('Failed to initialize translate page:', error);
    }
  });

  return (
    <div class="translate-page" style={{
      padding: '20px',
      'min-height': '100vh',
      background: '#f8fafc',
      'font-family': 'system-ui, -apple-system, sans-serif',
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
          🌐 翻译
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

      {/* Language selector */}
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
          目标语言:
        </label>
        <select
          value={targetLanguage()}
          onChange={(e) => setTargetLanguage(e.target.value)}
          style={{
            width: '100%',
            padding: '8px 12px',
            border: '1px solid #d1d5db',
            'border-radius': '6px',
            'font-size': '14px',
            background: 'white',
          }}
        >
          <For each={targetLanguages}>
            {(lang) => (
              <option value={lang.code}>{lang.name}</option>
            )}
          </For>
        </select>
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
          onClick={translate}
          disabled={loading()}
          style={{
            padding: '8px 16px',
            background: '#3b82f6',
            color: 'white',
            border: 'none',
            'border-radius': '6px',
            'font-size': '14px',
            cursor: loading() ? 'not-allowed' : 'pointer',
            opacity: loading() ? 0.6 : 1,
          }}
        >
          {loading() ? '翻译中...' : '翻译'}
        </button>
        <button
          id="copy-button"
          onClick={copyToClipboard}
          disabled={!translatedText()}
          style={{
            padding: '8px 16px',
            background: '#10b981',
            color: 'white',
            border: 'none',
            'border-radius': '6px',
            'font-size': '14px',
            cursor: translatedText() ? 'pointer' : 'not-allowed',
            opacity: translatedText() ? 1 : 0.6,
          }}
        >
          复制结果
        </button>
        <button
          onClick={replaceOriginalText}
          disabled={!translatedText()}
          style={{
            padding: '8px 16px',
            background: '#f59e0b',
            color: 'white',
            border: 'none',
            'border-radius': '6px',
            'font-size': '14px',
            cursor: translatedText() ? 'pointer' : 'not-allowed',
            opacity: translatedText() ? 1 : 0.6,
            display: 'flex',
            'align-items': 'center',
            gap: '4px',
          }}
        >
          🔄 替换原文
        </button>
      </div>

      {/* Translated text */}
      <div>
        <label style={{
          display: 'block',
          'font-size': '14px',
          'font-weight': '500',
          color: '#374151',
          'margin-bottom': '6px',
        }}>
          翻译结果:
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
                'border-top': '2px solid #3b82f6',
                'border-radius': '50%',
                animation: 'spin 1s linear infinite',
              }} />
              翻译中...
            </div>
          ) : (
            translatedText() || '点击翻译按钮开始翻译'
          )}
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