import React, { useMemo } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { RenderedView } from './RenderedView';
import { FileText, Code, Layout } from 'lucide-react';

interface PreviewPanelProps {
    prompt: string;
    onPromptChange: (value: string) => void;
    analysisPrompt: string;
    onAnalysisPromptChange: (value: string) => void;
    jsonResult: string;
    analysisResult: string;
    status: string;
    activeTab: 'prompt' | 'json' | 'render' | 'analysis';
    onTabChange: (tab: 'prompt' | 'json' | 'render' | 'analysis') => void;
    onAnalyze: () => void;
    isAnalyzing: boolean;
    onImport: (content: string) => void;
}

export const PreviewPanel: React.FC<PreviewPanelProps> = ({
    prompt,
    onPromptChange,
    analysisPrompt,
    onAnalysisPromptChange,
    jsonResult,
    analysisResult,
    status,
    activeTab,
    onTabChange,
    onAnalyze,
    isAnalyzing,
    onImport
}) => {
    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const content = e.target?.result as string;
            onImport(content);
        };
        reader.readAsText(file);
    };

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
                    onClick={() => onTabChange('prompt')}
                >
                    <FileText size={16} /> Prompt設定
                </button>
                <button
                    className={`tab-btn ${activeTab === 'json' ? 'active' : ''}`}
                    onClick={() => onTabChange('json')}
                >
                    <Code size={16} /> JSON預覽
                </button>
                <button
                    className={`tab-btn ${activeTab === 'render' ? 'active' : ''}`}
                    onClick={() => onTabChange('render')}
                >
                    <Layout size={16} /> 顯示對話
                </button>
                <button
                    className={`tab-btn ${activeTab === 'analysis' ? 'active' : ''}`}
                    onClick={() => onTabChange('analysis')}
                >
                    <FileText size={16} /> 意圖判斷
                </button>
            </div>

            <div className="preview-content">
                {activeTab === 'prompt' && (
                    <div className="prompt-editor-container">
                        <div className="prompt-section">
                            <label>對話生成 Prompt</label>
                            <textarea
                                value={prompt}
                                onChange={(e) => onPromptChange(e.target.value)}
                                className="prompt-textarea"
                            />
                        </div>
                        <div className="prompt-section">
                            <label>意圖判斷 Prompt</label>
                            <textarea
                                value={analysisPrompt}
                                onChange={(e) => onAnalysisPromptChange(e.target.value)}
                                className="prompt-textarea"
                            />
                        </div>
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
                {activeTab === 'analysis' && (
                    <div className="analysis-view">
                        <div className="analysis-toolbar">
                            <button className="action-btn primary" onClick={onAnalyze} disabled={isAnalyzing}>
                                {isAnalyzing ? '分析中...' : '開始分析 (Analyze)'}
                            </button>
                            <div className="file-input-wrapper">
                                <button className="action-btn secondary">匯入對話 (Import)</button>
                                <input type="file" accept=".json" onChange={handleFileUpload} />
                            </div>
                        </div>
                        <div className="analysis-result">
                            {analysisResult ? (
                                <div
                                    className="markdown-body"
                                    dangerouslySetInnerHTML={{
                                        __html: analysisResult
                                            .replace(/^### (.*$)/gim, '<h3>$1</h3>')
                                            .replace(/^## (.*$)/gim, '<h2>$1</h2>')
                                            .replace(/^# (.*$)/gim, '<h1>$1</h1>')
                                            .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
                                            .replace(/^\- (.*$)/gim, '<li>$1</li>')
                                            .replace(/\n/gim, '<br />')
                                    }}
                                />
                            ) : (
                                <div className="empty-state">
                                    請點擊「開始分析」或匯入檔案
                                </div>
                            )}
                        </div>
                    </div>
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
        .prompt-editor-container {
            display: flex;
            flex-direction: column;
            height: 100%;
            padding: 10px;
            gap: 10px;
            overflow-y: auto;
        }
        .prompt-section {
            flex: 1;
            display: flex;
            flex-direction: column;
            gap: 5px;
        }
        .prompt-section label {
            font-size: 12px;
            color: var(--text-secondary);
            font-weight: 600;
        }
        .prompt-textarea {
            flex: 1;
            background: var(--bg-input);
            color: var(--text-primary);
            border: 1px solid var(--border-color);
            border-radius: 4px;
            padding: 10px;
            font-family: monospace;
            resize: none;
            min-height: 150px;
        }
        .analysis-view {
            display: flex;
            flex-direction: column;
            height: 100%;
        }
        .analysis-toolbar {
            padding: 10px;
            border-bottom: 1px solid var(--border-color);
            display: flex;
            gap: 10px;
            background: var(--bg-panel);
        }
        .action-btn {
            padding: 6px 12px;
            border-radius: 4px;
            font-size: 13px;
            cursor: pointer;
            border: none;
        }
        .action-btn.primary {
            background: var(--accent-color);
            color: white;
        }
        .action-btn.primary:disabled {
            opacity: 0.7;
            cursor: not-allowed;
        }
        .action-btn.secondary {
            background: transparent;
            border: 1px solid var(--border-color);
            color: var(--text-primary);
        }
        .file-input-wrapper {
            position: relative;
            overflow: hidden;
            display: inline-block;
        }
        .file-input-wrapper input[type=file] {
            font-size: 100px;
            position: absolute;
            left: 0;
            top: 0;
            opacity: 0;
            cursor: pointer;
        }
        .analysis-result {
            flex: 1;
            padding: 20px;
            overflow-y: auto;
            white-space: pre-wrap;
            font-family: monospace;
            color: var(--text-primary);
            line-height: 1.5;
        }
        .empty-state {
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100%;
            color: var(--text-secondary);
        }
        .markdown-body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            color: var(--text-primary);
            line-height: 1.6;
        }
        .markdown-body h1, .markdown-body h2, .markdown-body h3 {
            margin-top: 16px;
            margin-bottom: 8px;
            font-weight: 600;
            color: var(--text-primary);
        }
        .markdown-body h1 { font-size: 1.5em; border-bottom: 1px solid var(--border-color); padding-bottom: 0.3em; }
        .markdown-body h2 { font-size: 1.3em; }
        .markdown-body h3 { font-size: 1.1em; }


      `}</style>
        </div>
    );
};
