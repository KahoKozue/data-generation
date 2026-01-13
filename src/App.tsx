import { useState, useMemo, useEffect } from 'react';
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

  const [apiKey, setApiKey] = useState(() => localStorage.getItem('openai_api_key') || '');
  const [geminiKey, setGeminiKey] = useState(() => localStorage.getItem('gemini_api_key') || '');
  const [selectedModel, setSelectedModel] = useState<'gpt' | 'gemini'>('gpt');

  const [jsonResult, setJsonResult] = useState("");
  const [status, setStatus] = useState("就緒");
  const [isGenerating, setIsGenerating] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  // Persist API Keys
  useEffect(() => {
    localStorage.setItem('openai_api_key', apiKey);
  }, [apiKey]);

  useEffect(() => {
    localStorage.setItem('gemini_api_key', geminiKey);
  }, [geminiKey]);

  const prompt = useMemo(() => {
    const builder = new PromptBuilder(parameters);
    return builder.buildSystemPrompt();
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

    try {
      const promptBuilder = new PromptBuilder(parameters);
      const systemPrompt = promptBuilder.buildSystemPrompt();

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

  // Mock "Open Folder" / Save functionality
  // Since we are in browser, we can't open a folder. We will download the file.
  // But the button says "Open Save Folder".
  // I'll implement a download function that simulates saving.
  const handleSave = async () => {
    if (!jsonResult) {
      alert("沒有可儲存的資料 (No data to save)");
      return;
    }

    const filename = generateFilename(parameters);

    try {
      // Try File System Access API first (Chrome/Edge)
      if ('showSaveFilePicker' in window) {
        const handle = await (window as any).showSaveFilePicker({
          suggestedName: filename,
          types: [{
            description: 'JSON File',
            accept: { 'application/json': ['.json'] },
          }],
        });
        const writable = await handle.createWritable();
        await writable.write(jsonResult);
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
      const blob = new Blob([jsonResult], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;

      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setStatus(`已下載: ${filename} (請檢查下載資料夾)`);
    } catch (e) {
      console.error("Save failed:", e);
      setStatus("儲存失敗 (Save Failed)");
      alert("儲存失敗，請嘗試使用「複製內容」按鈕");
    }
  };

  const handleCopy = async () => {
    if (!jsonResult) {
      alert("沒有可複製的資料");
      return;
    }
    try {
      await navigator.clipboard.writeText(jsonResult);
      setStatus("已複製到剪貼簿 (Copied to Clipboard)");
      alert("已複製到剪貼簿！");
    } catch (e) {
      setStatus("複製失敗 (Copy Failed)");
    }
  };

  const handleClear = () => {
    setJsonResult("");
    setStatus("就緒 (Ready)");
    setIsGenerating(false); // Force stop generating state
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
          setJsonResult(""); // Clear result when switching models
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
        prompt={prompt}
        jsonResult={jsonResult}
        status={status}
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
