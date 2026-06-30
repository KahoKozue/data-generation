import React, { useMemo, useState } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { RenderedView } from './RenderedView';
import { FileText, Code, Layout, CheckCircle2, Circle, Lock, AlertTriangle, Download } from 'lucide-react';
import type { AnalysisStructured } from '../utils/analysisParser';

// 五分法風險等級 → CSS class（避免直接用中文當 class 名）
const RISK5_CLASS: Record<string, string> = {
    '極高': 'crit',
    '中高': 'high',
    '中': 'med',
    '中低': 'low',
    '極低': 'min',
    'unknown': 'unknown',
};

interface PreviewPanelProps {
    prompt: string;
    onPromptChange: (value: string) => void;
    analysisPrompt: string;
    onAnalysisPromptChange: (value: string) => void;
    jsonResult: string;
    analysisResult: string;
    analysisStructured: AnalysisStructured | null;
    status: string;
    dataSource: { type: 'none' | 'generated' | 'imported'; label?: string; note?: string };
    activeTab: 'prompt' | 'json' | 'render' | 'analysis';
    onTabChange: (tab: 'prompt' | 'json' | 'render' | 'analysis') => void;
    onAnalyze: () => void;
    isAnalyzing: boolean;
    onImport: (content: string, meta?: { filename?: string; isMd?: boolean }) => void;
    onSave: (target: 'json' | 'analysis-md') => void | Promise<void>;
}

export const PreviewPanel: React.FC<PreviewPanelProps> = ({
    prompt,
    onPromptChange,
    analysisPrompt,
    onAnalysisPromptChange,
    jsonResult,
    analysisResult,
    analysisStructured,
    status,
    dataSource,
    activeTab,
    onTabChange,
    onAnalyze,
    isAnalyzing,
    onImport,
    onSave
}) => {
    const [saveMenuOpen, setSaveMenuOpen] = useState(false);

    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const content = e.target?.result as string;
            onImport(content, { filename: file.name, isMd: file.name.toLowerCase().endsWith('.md') });
        };
        reader.readAsText(file);
    };

    const parsedData = useMemo(() => {
        // 尚未生成 / 內容為空時不嘗試解析（避免 JSON.parse('') 噴 console error）
        if (!jsonResult.trim()) return [];
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

    const hasJson = jsonResult.trim().length > 0;
    const hasAnalysis = analysisResult.trim().length > 0;
    const steps = [
        { key: 'gen', label: 'Step 1 生成對話', done: hasJson, warning: !hasJson },
        { key: 'ana', label: 'Step 2 意圖分析', done: hasAnalysis, warning: hasJson && !hasAnalysis }
    ];

    return (
        <div className="preview-panel">
            <div className="flow-header">
                {steps.map((s) => (
                    <div key={s.key} className={`flow-step ${s.done ? 'done' : s.warning ? 'pending' : ''}`}>
                        {s.done ? <CheckCircle2 size={16} /> : <Circle size={16} />}
                        <span>{s.label}</span>
                    </div>
                ))}
            </div>

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
                    <div className="prompt-editor-container gen-zone">
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
                    <div className="code-view gen-zone">
                        <SyntaxHighlighter language="json" style={vscDarkPlus} customStyle={{ margin: 0, height: '100%' }}>
                            {jsonResult || '// 還沒生成對話'}
                        </SyntaxHighlighter>
                    </div>
                )}
                {activeTab === 'render' && (
                    <div className="render-view gen-zone">
                        <RenderedView data={parsedData} />
                    </div>
                )}
                {activeTab === 'analysis' && (
                    <div className="analysis-view analysis-zone">
                        <div className="analysis-toolbar">
                            <div className="toolbar-left">
                                <button className="action-btn primary" onClick={onAnalyze} disabled={isAnalyzing || !hasJson}>
                                    {isAnalyzing ? '分析中...' : hasJson ? '開始分析 (Analyze)' : '等待對話 JSON'}
                                </button>
                                {!hasJson && <span className="toolbar-hint"><Lock size={14} /> 需先生成或匯入對話</span>}
                                <div className="file-input-wrapper">
                                    <button className="action-btn secondary">匯入對話 (Import)</button>
                                    <input type="file" accept=".json,.md" onChange={handleFileUpload} />
                                </div>
                            </div>
                            <div className="toolbar-right">
                                <div className="save-dropdown">
                                    <button className="action-btn secondary" onClick={() => setSaveMenuOpen(!saveMenuOpen)}>
                                        <Download size={14} /> 另存新檔
                                    </button>
                                    {saveMenuOpen && (
                                        <div className="save-menu">
                                            <button onClick={() => { onSave('json'); setSaveMenuOpen(false); }}>匯出對話 JSON</button>
                                            <button onClick={() => { onSave('analysis-md'); setSaveMenuOpen(false); }}>匯出分析報告 (MD)</button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                        {dataSource.type !== 'none' && (
                            <div className={`source-card ${dataSource.type === 'imported' ? 'warn' : 'ok'}`}>
                                <div className="source-title">資料來源：{dataSource.label || (dataSource.type === 'generated' ? '本次生成' : '匯入')}</div>
                                <div className="source-meta">
                                    <span className="pill small">{dataSource.type === 'generated' ? 'Generated' : 'Imported'}</span>
                                    {dataSource.note && (
                                        <span className="note">
                                            <AlertTriangle size={14} /> {dataSource.note}
                                        </span>
                                    )}
                                </div>
                            </div>
                        )}
                        <div className="analysis-result">
                            {analysisStructured ? (
                                <div className="analysis-structured">
                                    <div className="pill-row">
                                        <span className={`pill verdict-${analysisStructured.verdict}`}>
                                            {analysisStructured.verdict === 'malicious' && '具惡意風險'}
                                            {analysisStructured.verdict === 'benign' && '良性'}
                                            {analysisStructured.verdict === 'uncertain' && '資訊不足'}
                                        </span>
                                        {analysisStructured.riskLevel && (
                                            <span className={`pill risk5-${RISK5_CLASS[analysisStructured.riskLevel] || 'unknown'}`}>
                                                風險等級: {analysisStructured.riskLevel}
                                            </span>
                                        )}
                                        {analysisStructured.primaryRisk && (
                                            <span className="pill subtle">主風險: {analysisStructured.primaryRisk}</span>
                                        )}
                                    </div>

                                    {analysisStructured.summary && (
                                        <div className="card-block">
                                            <div className="card-title">事件概述</div>
                                            <div className="card-body">{analysisStructured.summary}</div>
                                        </div>
                                    )}

                                    {!!analysisStructured.decisionPoints?.length && (
                                        <div className="card-block">
                                            <div className="card-title">關鍵決策點</div>
                                            <div className="stack">
                                                {analysisStructured.decisionPoints.map((d, idx) => (
                                                    <div key={idx} className="item">
                                                        <div className="item-header">
                                                            <span className="label">{d.label}</span>
                                                            {d.dimension && <span className="tag">{d.dimension}</span>}
                                                            {d.severity && <span className={`tag severity-${d.severity}`}>{d.severity}</span>}
                                                        </div>
                                                        {d.evidence && <div className="quote">「{d.evidence}」</div>}
                                                        {d.why && <div className="note">{d.why}</div>}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {!!analysisStructured.evidence?.length && (
                                        <div className="card-block">
                                            <div className="card-title">證據清單</div>
                                            <div className="stack">
                                                {analysisStructured.evidence.map((e, idx) => (
                                                    <div key={idx} className="item">
                                                        <div className="item-header">
                                                            {e.dimension && <span className="tag">{e.dimension}</span>}
                                                            {e.note && <span className="tag neutral">{e.note}</span>}
                                                        </div>
                                                        <div className="quote">「{e.quote}」</div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {analysisStructured.riskProfile && (
                                        <div className="card-block">
                                            <div className="card-title">事件分析</div>
                                            <div className="stack">
                                                {analysisStructured.riskProfile.persona && (
                                                    <div className="item">
                                                        <div className="item-header">
                                                            <span className="label">{analysisStructured.riskProfile.persona}</span>
                                                        </div>
                                                        {analysisStructured.riskProfile.why && (
                                                            <div className="note">{analysisStructured.riskProfile.why}</div>
                                                        )}
                                                    </div>
                                                )}
                                                {!!analysisStructured.riskProfile.vulnerabilities?.length && (
                                                    <ul className="bullet-list">
                                                        {analysisStructured.riskProfile.vulnerabilities.map((v, idx) => (
                                                            <li key={idx}>{v}</li>
                                                        ))}
                                                    </ul>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {!!analysisStructured.mitigations?.length && (
                                        <div className="card-block">
                                            <div className="card-title">緩解建議</div>
                                            <ul className="bullet-list">
                                                {analysisStructured.mitigations.map((m, idx) => (
                                                    <li key={idx}>{m}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}

                                    {!!analysisStructured.missingInfo?.length && (
                                        <div className="card-block">
                                            <div className="card-title">缺失資訊</div>
                                            <ul className="bullet-list">
                                                {analysisStructured.missingInfo.map((m, idx) => (
                                                    <li key={idx}>{m}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}

                                    <div className="card-block raw-block">
                                        <div className="card-title">模型回傳 JSON（稽核用）</div>
                                        <pre className="raw-json">
                                            {JSON.stringify(analysisStructured.raw ?? analysisStructured, null, 2)}
                                        </pre>
                                    </div>
                                </div>
                            ) : analysisResult ? (
                                <pre className="analysis-raw">{analysisResult}</pre>
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
        .preview-panel { flex: 1; display: flex; flex-direction: column; background: var(--bg-app); height: 100%; overflow: hidden; }
        .flow-header { display: grid; grid-template-columns: repeat(2, 1fr); background: linear-gradient(90deg, rgba(0,120,212,0.08), rgba(255,255,255,0.02)); border-bottom: 1px solid var(--border-color); }
        .flow-step { display: flex; align-items: center; gap: 8px; padding: 10px 12px; color: var(--text-secondary); font-size: 12px; }
        .flow-step.done { color: var(--accent-color); background: rgba(0,120,212,0.08); }
        .flow-step.pending { color: #d97706; }
        .preview-tabs { display: flex; background: var(--bg-panel); border-bottom: 1px solid var(--border-color); }
        .tab-btn { background: transparent; border: none; color: var(--text-secondary); padding: 12px 16px; cursor: pointer; display: flex; align-items: center; gap: 8px; border-bottom: 2px solid transparent; font-size: 13px; }
        .tab-btn:hover { color: var(--text-primary); background: rgba(255,255,255,0.02); }
        .tab-btn.active { color: var(--text-primary); border-bottom-color: var(--accent-color); background: rgba(255,255,255,0.05); }
        .preview-content { flex: 1; overflow: hidden; position: relative; }
        .gen-zone { background: linear-gradient(180deg, rgba(0,120,212,0.05), transparent); }
        .analysis-zone { background: linear-gradient(180deg, rgba(255,140,0,0.06), transparent); }
        .text-view { padding: 20px; height: 100%; overflow: auto; font-family: monospace; white-space: pre-wrap; color: var(--text-primary); line-height: 1.5; }
        .code-view { height: 100%; overflow: auto; }
        .status-bar { height: 30px; background: #0078d4; color: white; display: flex; align-items: center; padding: 0 16px; font-size: 12px; }
        .prompt-editor-container { display: flex; flex-direction: column; height: 100%; padding: 10px; gap: 10px; overflow-y: auto; }
        .prompt-section { flex: 1; display: flex; flex-direction: column; gap: 5px; }
        .prompt-section label { font-size: 12px; color: var(--text-secondary); font-weight: 600; }
        .prompt-textarea { flex: 1; background: var(--bg-input); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 4px; padding: 10px; font-family: monospace; resize: none; min-height: 150px; }
        .analysis-view { display: flex; flex-direction: column; height: 100%; }
        .analysis-toolbar { padding: 10px; border-bottom: 1px solid var(--border-color); display: flex; gap: 10px; background: var(--bg-panel); justify-content: space-between; }
        .toolbar-left, .toolbar-right { display: flex; align-items: center; gap: 10px; }
        .toolbar-hint { display: inline-flex; align-items: center; gap: 6px; color: var(--text-secondary); font-size: 12px; }
        .action-btn { padding: 6px 12px; border-radius: 4px; font-size: 13px; cursor: pointer; border: none; }
        .action-btn.primary { background: var(--accent-color); color: white; }
        .action-btn.primary:disabled { opacity: 0.7; cursor: not-allowed; }
        .action-btn.secondary { background: transparent; border: 1px solid var(--border-color); color: var(--text-primary); }
        .file-input-wrapper { position: relative; overflow: hidden; display: inline-block; }
        .file-input-wrapper input[type=file] { font-size: 100px; position: absolute; left: 0; top: 0; opacity: 0; cursor: pointer; }
        .analysis-result { flex: 1; padding: 20px; overflow-y: auto; white-space: pre-wrap; font-family: monospace; color: var(--text-primary); line-height: 1.5; }
        .render-view { height: 100%; overflow: auto; padding: 0; }
        .empty-state { display: flex; align-items: center; justify-content: center; height: 100%; color: var(--text-secondary); }
        .save-dropdown { position: relative; }
        .save-menu { position: absolute; right: 0; top: 36px; background: var(--bg-panel); border: 1px solid var(--border-color); border-radius: 6px; box-shadow: 0 6px 18px rgba(0,0,0,0.15); display: flex; flex-direction: column; min-width: 180px; z-index: 5; }
        .save-menu button { background: transparent; border: none; text-align: left; padding: 10px 12px; color: var(--text-primary); cursor: pointer; }
        .save-menu button:hover { background: rgba(255,255,255,0.05); }
        .analysis-structured { display: flex; flex-direction: column; gap: 16px; font-family: var(--font-family); white-space: normal; }
        .pill-row { display: flex; gap: 8px; flex-wrap: wrap; }
        .pill { padding: 4px 10px; border-radius: 20px; font-size: 12px; border: 1px solid var(--border-color); background: var(--bg-input); }
        .pill.neutral { background: rgba(98,100,167,0.1); border-color: rgba(98,100,167,0.2); }
        .pill.subtle { color: var(--text-secondary); }
        .pill.verdict-malicious { background: rgba(215,58,73,0.12); color: #b91c1c; border-color: rgba(215,58,73,0.4); }
        .pill.verdict-benign { background: rgba(34,197,94,0.12); color: #15803d; border-color: rgba(34,197,94,0.4); }
        .pill.verdict-uncertain { background: rgba(234,179,8,0.15); color: #92400e; border-color: rgba(234,179,8,0.4); }
        .pill.risk5-crit { background: rgba(185,28,28,0.14); color: #991b1b; border-color: rgba(185,28,28,0.4); font-weight: 700; }
        .pill.risk5-high { background: rgba(215,58,73,0.12); color: #b91c1c; border-color: rgba(215,58,73,0.35); }
        .pill.risk5-med { background: rgba(234,179,8,0.15); color: #92400e; border-color: rgba(234,179,8,0.4); }
        .pill.risk5-low { background: rgba(59,130,246,0.12); color: #1d4ed8; border-color: rgba(59,130,246,0.35); }
        .pill.risk5-min { background: rgba(34,197,94,0.12); color: #15803d; border-color: rgba(34,197,94,0.4); }
        .pill.risk5-unknown { background: var(--bg-input); color: var(--text-secondary); }
        .card-block { background: var(--bg-panel); border: 1px solid var(--border-color); border-radius: 8px; padding: 12px 14px; display: flex; flex-direction: column; gap: 10px; }
        .card-title { font-weight: 700; color: var(--text-primary); font-size: 13px; letter-spacing: 0.2px; }
        .card-body { color: var(--text-primary); font-size: 14px; }
        .stack { display: flex; flex-direction: column; gap: 12px; }
        .item { background: var(--bg-input); border: 1px solid var(--border-color); border-radius: 6px; padding: 10px; display: flex; flex-direction: column; gap: 6px; }
        .item-header { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
        .label { font-weight: 600; color: var(--text-primary); }
        .tag { padding: 2px 8px; border-radius: 12px; background: rgba(0,0,0,0.05); color: var(--text-secondary); font-size: 11px; }
        .tag.neutral { background: rgba(98,100,167,0.1); color: var(--accent-color); }
        .tag.severity-high { background: rgba(215,58,73,0.12); color: #b91c1c; }
        .tag.severity-medium { background: rgba(234,179,8,0.12); color: #92400e; }
        .tag.severity-low { background: rgba(34,197,94,0.12); color: #15803d; }
        .quote { color: var(--text-primary); font-style: italic; line-height: 1.5; }
        .note { color: var(--text-secondary); font-size: 13px; }
        .bullet-list { margin: 0; padding-left: 18px; color: var(--text-primary); display: flex; flex-direction: column; gap: 4px; }
        .raw-block .raw-json { background: #0f172a; color: #e2e8f0; border-radius: 6px; padding: 10px; max-height: 260px; overflow: auto; font-family: monospace; font-size: 12px; border: 1px solid #1e293b; }
        .analysis-raw { background: var(--bg-input); border: 1px solid var(--border-color); border-radius: 8px; padding: 12px; height: 100%; overflow: auto; }
        .source-card { margin: 10px 12px 0 12px; padding: 10px 12px; border-radius: 8px; border: 1px solid var(--border-color); background: rgba(0,0,0,0.1); display: flex; flex-direction: column; gap: 6px; }
        .source-card.ok { background: rgba(0,120,212,0.08); border-color: rgba(0,120,212,0.25); }
        .source-card.warn { background: rgba(234,179,8,0.12); border-color: rgba(234,179,8,0.35); }
        .source-title { font-weight: 600; color: var(--text-primary); font-size: 13px; }
        .source-meta { display: flex; align-items: center; gap: 8px; color: var(--text-secondary); font-size: 12px; }
        .pill.small { padding: 2px 8px; border-radius: 12px; font-size: 11px; }
        `}</style>
        </div>
    );
};
