import React, { useState, useMemo } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { RenderedView } from './RenderedView';
import { FileText, Code, Layout } from 'lucide-react';

interface PreviewPanelProps {
    prompt: string;
    jsonResult: string;
    status: string;
}

export const PreviewPanel: React.FC<PreviewPanelProps> = ({ prompt, jsonResult, status }) => {
    const [activeTab, setActiveTab] = useState<'prompt' | 'json' | 'render'>('prompt');

    const parsedData = useMemo(() => {
        try {
            // Sanitize: Remove Markdown code blocks if present
            let cleanJson = jsonResult.trim();
            if (cleanJson.startsWith('```json')) {
                cleanJson = cleanJson.replace(/^```json/, '').replace(/```$/, '');
            } else if (cleanJson.startsWith('```')) {
                cleanJson = cleanJson.replace(/^```/, '').replace(/```$/, '');
            }

            // Find start and end of JSON structure
            const firstSquare = cleanJson.indexOf('[');
            const firstCurly = cleanJson.indexOf('{');

            let startIndex = -1;
            let endIndex = -1;

            // Determine if it's likely an array or an object
            if (firstSquare !== -1 && (firstCurly === -1 || firstSquare < firstCurly)) {
                startIndex = firstSquare;
                endIndex = cleanJson.lastIndexOf(']');
            } else if (firstCurly !== -1) {
                startIndex = firstCurly;
                endIndex = cleanJson.lastIndexOf('}');
            }

            if (startIndex !== -1 && endIndex !== -1) {
                cleanJson = cleanJson.substring(startIndex, endIndex + 1);
            }

            return JSON.parse(cleanJson);
        } catch (e) {
            console.error("JSON Parse Error:", e);
            return [];
        }
    }, [jsonResult]);

    return (
        <div className="preview-panel">
            <div className="preview-tabs">
                <button
                    className={`tab-btn ${activeTab === 'prompt' ? 'active' : ''}`}
                    onClick={() => setActiveTab('prompt')}
                >
                    <FileText size={16} /> Prompt預覽
                </button>
                <button
                    className={`tab-btn ${activeTab === 'json' ? 'active' : ''}`}
                    onClick={() => setActiveTab('json')}
                >
                    <Code size={16} /> JSON預覽
                </button>
                <button
                    className={`tab-btn ${activeTab === 'render' ? 'active' : ''}`}
                    onClick={() => setActiveTab('render')}
                >
                    <Layout size={16} /> 顯示對話
                </button>
            </div>

            <div className="preview-content">
                {activeTab === 'prompt' && (
                    <div className="text-view">
                        <pre>{prompt}</pre>
                    </div>
                )}
                {activeTab === 'json' && (
                    <div className="code-view">
                        <SyntaxHighlighter language="json" style={vscDarkPlus} customStyle={{ margin: 0, height: '100%' }}>
                            {jsonResult || '// 還沒生成對話'}
                        </SyntaxHighlighter>
                    </div>
                )}
                {activeTab === 'render' && (
                    <RenderedView data={parsedData} />
                )}
            </div>

            <div className="status-bar">
                {status}
            </div>

            <style>{`
        .preview-panel {
          flex: 1;
          display: flex;
          flex-direction: column;
          background: var(--bg-app);
          height: 100%;
          overflow: hidden;
        }
        .preview-tabs {
          display: flex;
          background: var(--bg-panel);
          border-bottom: 1px solid var(--border-color);
        }
        .tab-btn {
          background: transparent;
          border: none;
          color: var(--text-secondary);
          padding: 12px 16px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 8px;
          border-bottom: 2px solid transparent;
          font-size: 13px;
        }
        .tab-btn:hover {
          color: var(--text-primary);
          background: rgba(255,255,255,0.02);
        }
        .tab-btn.active {
          color: var(--text-primary);
          border-bottom-color: var(--accent-color);
          background: rgba(255,255,255,0.05);
        }
        .preview-content {
          flex: 1;
          overflow: hidden;
          position: relative;
        }
        .text-view {
          padding: 20px;
          height: 100%;
          overflow: auto;
          font-family: monospace;
          white-space: pre-wrap;
          color: var(--text-primary);
          line-height: 1.5;
        }
        .code-view {
          height: 100%;
          overflow: auto;
        }
        .status-bar {
          height: 30px;
          background: var(--accent-color); /* Or just a dark bar */
          background: #0078d4; /* Teams blueish */
          color: white;
          display: flex;
          align-items: center;
          padding: 0 16px;
          font-size: 12px;
        }
      `}</style>
        </div>
    );
};
