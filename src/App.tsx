import { useState, useEffect } from 'react';
import { ControlPanel } from './components/ControlPanel';
import { PreviewPanel } from './components/PreviewPanel';
import { PromptBuilder } from './core/PromptBuilder';
import { OpenAIService } from './core/OpenAIService';
import { GeminiService } from './core/GeminiService';
import { AnthropicService } from './core/AnthropicService';
import { runDialogue, type GenerationService, type DialogueTrace } from './core/DialogueEngine';
import type { SimulationParameters, ModelKey, GenerationMode, DualAgentConfig } from './core/types';
import { generateFilename } from './utils/filenameUtils';
import { parseAnalysis, type AnalysisStructured } from './utils/analysisParser';

function App() {
  const [parameters, setParameters] = useState<SimulationParameters>({
    preset: "Preset 1 技術挫折 影子 IT",
    authority: 0,
    urgency: 0,
    load: 0,
    minMessages: 20,
    maxMessages: 30,
    timeSpan: "T+0 (即時密集)",
    intents: ["malicious"],
  });

  // State for Prompts
  const [generationPrompt, setGenerationPrompt] = useState("");
  const [analysisPrompt, setAnalysisPrompt] = useState(`你是安全為重、刁鑽有些神經質的企業資安稽核助理，任務：分析 Microsoft Teams 對話紀錄，判斷是否存在社交工程風險。

輸出規格（只輸出 JSON，不要 Markdown / 說明文字）：
{
  "verdict": "malicious | benign | uncertain",
  "risk_level": "極高 | 中高 | 中 | 中低 | 極低",
  "primary_risk": "authority | urgency | phishing | shadow_it | unknown",
  "incident_summary": "事件概述（一句話）",
  "decision_points": [
    {
      "label": "authority push / urgency pressure / bypass process / suspicious link ...",
      "evidence": "直接貼對話原句",
      "dimension": "語意目的 | 語用操縱策略 | 情境一致性 | 決策點",
      "why": "理由與判斷依據",
      "severity": "high | medium | low"
    }
  ],
  "evidence": [
    { "quote": "對話句子", "dimension": "語意目的|語用操縱策略|情境一致性|決策點", "note": "補充原因" }
  ],
  "incident_analysis": {
    "persona": "事件中的角色定位/行為模式",
    "why": "事件如何演變成風險或保持安全",
    "vulnerabilities": ["行為或環境弱點，或事件觀察"]
  },
  "mitigations": ["可立即採取的緩解/教育/即時警示建議"],
  "missing_info": ["無法判斷或需要補充的資訊"]
}

判斷維度（dimension 的值要用中文）：
- 語意目的：是否要求敏感資訊、繞過流程？
- 語用操縱策略：權威訴求、急迫施壓、認知負載？
- 情境一致性：角色/流程/關係是否合理？
- 決策點：最關鍵的風險句子或轉折。

風險等級（risk_level）採五分法，值只能用中文：極高 / 中高 / 中 / 中低 / 極低。
- 極高：已出現明確誘導點擊/登入/授權或索取憑證、且目標有配合跡象。
- 中高：明確攻擊話術（偽造連結、權威施壓），目標尚未交付。
- 中：有可疑操縱跡象但脈絡未明。
- 中低：輕微異常，多半為正常業務摩擦。
- 極低：未見社交工程跡象。

原則：
- 以語意/情境判斷，不可只憑關鍵字。
- 每個判斷必須引用句子作為證據。
- 若缺少關鍵上下文，verdict 應為 uncertain，並列出 missing_info。`);

  const [apiKey, setApiKey] = useState(() => localStorage.getItem('openai_api_key') || '');
  const [geminiKey, setGeminiKey] = useState(() => localStorage.getItem('gemini_api_key') || '');
  const [anthropicKey, setAnthropicKey] = useState(() => localStorage.getItem('anthropic_api_key') || '');
  const [selectedModel, setSelectedModel] = useState<ModelKey>('gpt');

  // 生成模式：單 AI 腳本（既有）或雙 AI 對話（並列的第二種資料模式）
  const [generationMode, setGenerationMode] = useState<GenerationMode>('single');
  const [dualConfig, setDualConfig] = useState<DualAgentConfig>({
    attacker: 'gpt',
    victim: 'claude',
    rounds: 15,
    intent: 'malicious',
  });
  const [lastTrace, setLastTrace] = useState<DialogueTrace | null>(null);

  const [jsonResult, setJsonResult] = useState("");
  const [analysisResult, setAnalysisResult] = useState("");
  const [analysisStructured, setAnalysisStructured] = useState<AnalysisStructured | null>(null);
  const [status, setStatus] = useState("就緒");
  const [dataSource, setDataSource] = useState<{ type: 'none' | 'generated' | 'imported'; label?: string; note?: string }>({ type: 'none' });

  const [isGenerating, setIsGenerating] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const [activePreviewTab, setActivePreviewTab] = useState<'prompt' | 'json' | 'render' | 'analysis'>('prompt');

  // Persist API Keys
  useEffect(() => {
    localStorage.setItem('openai_api_key', apiKey);
  }, [apiKey]);

  useEffect(() => {
    localStorage.setItem('gemini_api_key', geminiKey);
  }, [geminiKey]);

  useEffect(() => {
    localStorage.setItem('anthropic_api_key', anthropicKey);
  }, [anthropicKey]);

  // Sync Generation Prompt with Parameters (One-way sync on param change)
  useEffect(() => {
    const builder = new PromptBuilder(parameters);
    setGenerationPrompt(builder.buildSystemPrompt());
  }, [parameters]);

  const handleParamChange = (key: keyof SimulationParameters, value: any) => {
    setParameters(prev => ({ ...prev, [key]: value }));
  };

  const keyForModel = (model: ModelKey): string =>
    model === 'gpt' ? apiKey : model === 'gemini' ? geminiKey : anthropicKey;

  const keyLabel: Record<ModelKey, string> = {
    gpt: 'OpenAI API Key',
    gemini: 'Gemini API Key',
    claude: 'Anthropic API Key',
  };

  const makeService = (model: ModelKey): GenerationService => {
    const key = keyForModel(model);
    if (model === 'gpt') return new OpenAIService(key);
    if (model === 'gemini') return new GeminiService(key);
    return new AnthropicService(key);
  };

  const handleGenerate = async () => {
    if (generationMode === 'dual') {
      await handleGenerateDual();
      return;
    }
    if (!keyForModel(selectedModel)) {
      alert(`請輸入 ${keyLabel[selectedModel]}`);
      return;
    }

    setStatus("生成中...");
    setJsonResult(""); // 清除舊對話
    setLastTrace(null);
    setDataSource({ type: 'none' });
    setIsGenerating(true);
    setActivePreviewTab('json'); // 切成json預覽

    try {
      const systemPrompt = generationPrompt;
      const service = makeService(selectedModel);
      await service.generateStream(systemPrompt, (chunk) => {
        setJsonResult(prev => prev + chunk);
      });

      setStatus("生成完成");
      setDataSource({ type: 'generated', label: '本次生成（單 AI）' });
    } catch (error: any) {
      console.error(error);
      const errorMessage = error.message || "Unknown error";
      setStatus(`生成失敗: ${errorMessage}`);
      alert(`生成失敗 (Error): ${errorMessage}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateDual = async () => {
    const needed: ModelKey[] = [dualConfig.attacker, dualConfig.victim];
    for (const m of needed) {
      if (!keyForModel(m)) {
        alert(`雙 AI 模式需要 ${keyLabel[m]}`);
        return;
      }
    }

    setStatus("雙 AI 對話生成中...");
    setJsonResult("");
    setLastTrace(null);
    setDataSource({ type: 'none' });
    setIsGenerating(true);
    setActivePreviewTab('json');

    try {
      const services: Record<ModelKey, GenerationService> = {
        gpt: makeService('gpt'),
        gemini: makeService('gemini'),
        claude: makeService('claude'),
      };
      const result = await runDialogue({
        parameters,
        config: dualConfig,
        services,
        onProgress: (text) => setJsonResult(prev => prev + text),
      });

      // 組裝完成後，jsonResult 換成正式 Graph chatMessage JSON（偵測端原封不動沿用）
      setJsonResult(JSON.stringify(result.graphMessages, null, 2));
      setLastTrace(result.trace);
      setStatus(`雙 AI 生成完成（GT=${result.groundTruth}，${dualConfig.rounds} 回合）`);
      setDataSource({
        type: 'generated',
        label: `雙 AI 對話：${dualConfig.attacker} 攻 × ${dualConfig.victim} 守`,
        note: `GT=${result.groundTruth}（by construction）`,
      });
    } catch (error: any) {
      console.error(error);
      const errorMessage = error.message || "Unknown error";
      if (error.trace) setLastTrace(error.trace as DialogueTrace);
      setStatus(`雙 AI 生成失敗: ${errorMessage}`);
      alert(`雙 AI 生成失敗: ${errorMessage}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleExportTrace = () => {
    if (!lastTrace) return;
    const blob = new Blob([JSON.stringify(lastTrace, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dialogue_trace_${lastTrace.timestamp.replace(/[:.]/g, '-')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setStatus('已下載生成 trace');
  };

  const handleAnalyze = async () => {
    if (!jsonResult) {
      alert("無資料可分析，先生成或匯入");
      return;
    }

    if (!keyForModel(selectedModel)) {
      alert(`請輸入 ${keyLabel[selectedModel]}`);
      return;
    }

    setStatus("分析中...");
    setAnalysisResult("");
    setAnalysisStructured(null);
    setIsAnalyzing(true);

    try {
      const systemPrompt = analysisPrompt;
      const userContent = `請分析以下對話 JSON，直接使用其中的對話內容作為證據:\n${jsonResult}`;
      let fullText = "";
      const handleChunk = (chunk: string) => {
        fullText += chunk;
        setAnalysisResult(fullText);
      };

      const service = makeService(selectedModel);
      await service.generateStream(systemPrompt, handleChunk, userContent);

      const parsed = parseAnalysis(fullText);
      setAnalysisStructured(parsed);
      setStatus(parsed ? "分析完成 (已解析結構)" : "分析完成 (使用原始文字)");
      setActivePreviewTab('analysis');

    } catch (error: any) {
      console.error(error);
      setStatus(`分析失敗: ${error.message}`);
      alert(`分析失敗: ${error.message}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleImport = (fileContent: string, meta?: { filename?: string; isMd?: boolean }) => {
    setJsonResult(fileContent);
    setAnalysisResult(""); // 清掉前次結果
    setAnalysisStructured(null);
    setStatus("已匯入檔案");
    setDataSource({ type: 'imported', label: meta?.filename || '匯入檔案', note: meta?.isMd ? '來自 .md，請確認為純 JSON' : undefined });
    setActivePreviewTab('json');
  };

  const handleSave = async (target?: 'json' | 'analysis-md') => {
    // Context-sensitive save
    const isSavingAnalysis = target ? target === 'analysis-md' : activePreviewTab === 'analysis';
    const contentToSave = isSavingAnalysis ? analysisResult : jsonResult;
    const extension = isSavingAnalysis ? 'md' : 'json';
    const uiName = isSavingAnalysis ? '分析報告' : '對話資料';

    if (!contentToSave) {
      alert(`沒有可儲存的${uiName}`);
      return;
    }

    const baseFilename = generateFilename(parameters);
    const filename = isSavingAnalysis ? `${baseFilename}_report.${extension}` : `${baseFilename}.${extension}`;

    try {
      // Try File System Access API first (Chrome/Edge)
      if ('showSaveFilePicker' in window) {
        const handle = await (window as any).showSaveFilePicker({
          suggestedName: filename,
          types: [{
            description: isSavingAnalysis ? 'Markdown File' : 'JSON File',
            accept: isSavingAnalysis ? { 'text/markdown': ['.md'] } : { 'application/json': ['.json'] },
          }],
        });
        const writable = await handle.createWritable();
        await writable.write(contentToSave);
        await writable.close();
        setStatus(`已儲存: ${handle.name}`);
        return;
      }
    } catch (e: any) {
      if (e.name === 'AbortError') return; // User cancelled
      console.warn("File System Access API failed, falling back to download", e);
    }

    // Fallback to blob download
    try {
      const blob = new Blob([contentToSave], { type: isSavingAnalysis ? 'text/markdown' : 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;

      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setStatus(`已下載: ${filename}`);
    } catch (e) {
      console.error("Save failed:", e);
      setStatus("儲存失敗 (Save Failed)");
    }
  };

  const handleCopy = async () => {
    const isCopyingAnalysis = activePreviewTab === 'analysis';
    const contentToCopy = isCopyingAnalysis ? analysisResult : jsonResult;

    if (!contentToCopy) {
      alert("沒有可複製的資料");
      return;
    }
    try {
      await navigator.clipboard.writeText(contentToCopy);
      setStatus("已複製到剪貼簿");
      alert("已複製到剪貼簿！");
    } catch (e) {
      setStatus("複製失敗 (Copy Failed)");
    }
  };

  const handleClear = () => {
    // Context sensitive clear
    if (activePreviewTab === 'analysis') {
      setAnalysisResult("");
      setAnalysisStructured(null);
      setStatus("已清空分析結果");
    } else {
      setJsonResult("");
      setAnalysisResult(""); // Also clear analysis if dialogue is cleared, as it's dependent
      setAnalysisStructured(null);
      setStatus("已清空對話");
    }
    setDataSource({ type: 'none' });
    setIsGenerating(false);
    setIsAnalyzing(false);
  };

  return (
    <div className="app-container">
      <ControlPanel
        parameters={parameters}
        onParamChange={handleParamChange}
        apiKey={apiKey}
        onApiKeyChange={setApiKey}
        geminiKey={geminiKey}
        onGeminiKeyChange={setGeminiKey}
        anthropicKey={anthropicKey}
        onAnthropicKeyChange={setAnthropicKey}
        selectedModel={selectedModel}
        onModelChange={(model) => {
          setSelectedModel(model);
          setStatus("就緒 (Ready)");
        }}
        generationMode={generationMode}
        onGenerationModeChange={(mode) => {
          setGenerationMode(mode);
          setStatus(mode === 'dual' ? '雙 AI 對話模式' : '單 AI 腳本模式');
        }}
        dualConfig={dualConfig}
        onDualConfigChange={(cfg) => setDualConfig(cfg)}
        hasTrace={!!lastTrace}
        onExportTrace={handleExportTrace}
        onGenerate={handleGenerate}
        onSave={handleSave}
        onCopy={handleCopy}
        onClear={handleClear}
        isGenerating={isGenerating}
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed(!collapsed)}
      />
      <PreviewPanel
        prompt={generationPrompt}
        onPromptChange={setGenerationPrompt}
        analysisPrompt={analysisPrompt}
        onAnalysisPromptChange={setAnalysisPrompt}
        jsonResult={jsonResult}
        analysisResult={analysisResult}
        analysisStructured={analysisStructured}
      status={status}
      dataSource={dataSource}
      activeTab={activePreviewTab}
      onTabChange={setActivePreviewTab}
      onAnalyze={handleAnalyze}
      isAnalyzing={isAnalyzing}
      onImport={handleImport}
      onSave={handleSave}
    />
      <style>{`
        .app-container {
          display: flex;
          height: 100vh;
          width: 100vw;
          overflow: hidden;
        }
      `}</style>
    </div>
  );
}

export default App;
