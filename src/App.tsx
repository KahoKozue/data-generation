import { useState, useEffect } from 'react';
import { ControlPanel } from './components/ControlPanel';
import { PreviewPanel } from './components/PreviewPanel';
import { PromptBuilder } from './core/PromptBuilder';
import { OpenAIService } from './core/OpenAIService';
import { GeminiService } from './core/GeminiService';
import type { SimulationParameters } from './core/types';
import { generateFilename } from './utils/filenameUtils';

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
  const [analysisPrompt, setAnalysisPrompt] = useState(`你是安全為重、刁鑽有些神經質卻又認真負責的企業資安稽核助理，任務是分析 Microsoft Teams 對話紀錄，專門研究看似正常的內部惡意對話，判定是否存在社交工程風險。

核心原則（必須遵守）：
1) 本任務重點在「語意／情境」：你必須根據對話中的意圖、語用策略、角色關係、流程合理性與上下文一致性來判斷；不得用單一關鍵字或「有連結=惡意」等粗略規則下結論。
2) 證據可追溯：任何判斷都必須引用對話中的具體句子作為證據，並說明該句子觸發的判斷點。
3) 避免過度推論：若關鍵上下文缺失，必須輸出不確定，並列出需要補充的資訊。

你應採用以下「最小且可驗證」的判斷維度：

A. 語意目的 (是否要求敏感資訊、繞過流程？)
B. 語用操縱策略 (權威訴求、急迫施壓、認知負載？)
C. 情境一致性 (角色、流程、關係合理性？)
D. 決策點 (最關鍵的風險句子)

請輸出為 Markdown 格式 的分析報告，包含以下區塊：
1. 判定結果
(良性 / 具惡意風險 / 資訊不足不確定) - 並簡述主要風險類型。

2. 關鍵決策點
列出對話中最關鍵的句子與風險分析。

3. 詳細證據
列出支撐判斷的對話句子，並標註屬於 [A/B/C/D] 哪類維度。

4. 缺失資訊與建議
(可選) 還有什麼資訊需要確認？建議使用者採取什麼行動？

5. 總結
`);

  const [apiKey, setApiKey] = useState(() => localStorage.getItem('openai_api_key') || '');
  const [geminiKey, setGeminiKey] = useState(() => localStorage.getItem('gemini_api_key') || '');
  const [selectedModel, setSelectedModel] = useState<'gpt' | 'gemini'>('gpt');

  const [jsonResult, setJsonResult] = useState("");
  const [analysisResult, setAnalysisResult] = useState("");
  const [status, setStatus] = useState("就緒");

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

  // Sync Generation Prompt with Parameters (One-way sync on param change)
  useEffect(() => {
    const builder = new PromptBuilder(parameters);
    setGenerationPrompt(builder.buildSystemPrompt());
  }, [parameters]);

  const handleParamChange = (key: keyof SimulationParameters, value: any) => {
    setParameters(prev => ({ ...prev, [key]: value }));
  };

  const handleGenerate = async () => {
    if (selectedModel === 'gpt' && !apiKey) {
      alert("請輸入 OpenAI API Key");
      return;
    }
    if (selectedModel === 'gemini' && !geminiKey) {
      alert("請輸入 Gemini API Key");
      return;
    }

    setStatus("生成中...");
    setJsonResult(""); // Clear previous result
    setIsGenerating(true);
    setActivePreviewTab('json'); // Switch to JSON view on generate

    try {
      // Use the edited generationPrompt
      const systemPrompt = generationPrompt;

      if (selectedModel === 'gpt') {
        const openAIService = new OpenAIService(apiKey);
        await openAIService.generateStream(systemPrompt, (chunk) => {
          setJsonResult(prev => prev + chunk);
        });
      } else {
        const geminiService = new GeminiService(geminiKey);
        await geminiService.generateStream(systemPrompt, (chunk) => {
          setJsonResult(prev => prev + chunk);
        });
      }

      setStatus("生成完成");
    } catch (error: any) {
      console.error(error);
      const errorMessage = error.message || "Unknown error";
      setStatus(`生成失敗: ${errorMessage}`);
      alert(`生成失敗 (Error): ${errorMessage}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAnalyze = async () => {
    if (!jsonResult) {
      alert("無資料可分析，請先生成或匯入對話");
      return;
    }

    if (selectedModel === 'gpt' && !apiKey) {
      alert("請輸入 OpenAI API Key");
      return;
    }
    if (selectedModel === 'gemini' && !geminiKey) {
      alert("請輸入 Gemini API Key");
      return;
    }

    setStatus("分析中...");
    setAnalysisResult("");
    setIsAnalyzing(true);

    try {
      const systemPrompt = analysisPrompt;
      const userContent = `請分析以下資料:\n\n${jsonResult}`;

      // Re-use services but we need a non-streaming method or just use stream and accumulate
      if (selectedModel === 'gpt') {
        const openAIService = new OpenAIService(apiKey);
        // Quick hack: use generateStream but for analysis
        await openAIService.generateStream(systemPrompt + "\n\nUser Input:", (chunk) => {
          setAnalysisResult(prev => prev + chunk);
        }, userContent);
        // Note: generateStream signature in OpenAIService needs update or we need a new method.
        // Actually OpenAIService.generateStream hardcodes "Start simulation". We should update OpenAIService.
      } else {
        const geminiService = new GeminiService(geminiKey);
        await geminiService.generateStream(systemPrompt + "\n\n" + userContent, (chunk) => {
          setAnalysisResult(prev => prev + chunk);
        });
      }
      setStatus("分析完成");

    } catch (error: any) {
      console.error(error);
      setStatus(`分析失敗: ${error.message}`);
      alert(`分析失敗: ${error.message}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleImport = (fileContent: string) => {
    setJsonResult(fileContent);
    setAnalysisResult(""); // Clear previous analysis result to avoid confusion
    setStatus("已匯入檔案");
    setActivePreviewTab('json');
  };

  const handleSave = async () => {
    // Context-sensitive save
    const isSavingAnalysis = activePreviewTab === 'analysis';
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
      setStatus("已清空分析結果");
    } else {
      setJsonResult("");
      setAnalysisResult(""); // Also clear analysis if dialogue is cleared, as it's dependent
      setStatus("已清空對話");
    }
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
        selectedModel={selectedModel}
        onModelChange={(model) => {
          setSelectedModel(model);
          setStatus("就緒 (Ready)");
        }}
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
        status={status}
        activeTab={activePreviewTab}
        onTabChange={setActivePreviewTab}
        onAnalyze={handleAnalyze}
        isAnalyzing={isAnalyzing}
        onImport={handleImport}
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
