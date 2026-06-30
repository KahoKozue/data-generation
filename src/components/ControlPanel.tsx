import React, { useState } from 'react';
import type { SimulationParameters, ModelKey, GenerationMode, DualAgentConfig } from '../core/types';
import { OPTIONS, MODEL_LABELS } from '../core/types';
import { ShieldAlert, Cpu, Play, FolderOpen, ChevronLeft, ChevronRight, Trash2, Copy, Users, ArrowLeftRight, Download } from 'lucide-react';

interface ControlPanelProps {
  parameters: SimulationParameters;
  onParamChange: (key: keyof SimulationParameters, value: any) => void;
  apiKey: string;
  onApiKeyChange: (key: string) => void;
  geminiKey: string;
  onGeminiKeyChange: (key: string) => void;
  anthropicKey: string;
  onAnthropicKeyChange: (key: string) => void;
  selectedModel: ModelKey;
  onModelChange: (model: ModelKey) => void;
  generationMode: GenerationMode;
  onGenerationModeChange: (mode: GenerationMode) => void;
  dualConfig: DualAgentConfig;
  onDualConfigChange: (cfg: DualAgentConfig) => void;
  hasTrace: boolean;
  onExportTrace: () => void;
  onGenerate: () => void;
  onSave: () => void | Promise<void>;
  onCopy: () => void;
  onClear: () => void;
  isGenerating: boolean;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

const MODEL_KEYS: ModelKey[] = ['gpt', 'gemini', 'claude'];
const KEY_LABEL: Record<ModelKey, string> = {
  gpt: 'OpenAI API Key',
  gemini: 'Gemini API Key',
  claude: 'Anthropic API Key',
};
const KEY_PLACEHOLDER: Record<ModelKey, string> = {
  gpt: 'sk-...',
  gemini: 'AIza...',
  claude: 'sk-ant-...',
};

export const ControlPanel: React.FC<ControlPanelProps> = ({
  parameters,
  onParamChange,
  apiKey,
  onApiKeyChange,
  geminiKey,
  onGeminiKeyChange,
  anthropicKey,
  onAnthropicKeyChange,
  selectedModel,
  onModelChange,
  generationMode,
  onGenerationModeChange,
  dualConfig,
  onDualConfigChange,
  hasTrace,
  onExportTrace,
  onGenerate,
  onSave,
  onCopy,
  onClear,
  isGenerating,
  collapsed,
  onToggleCollapse
}) => {
  const [activeTab, setActiveTab] = useState<'preset' | 'knobs' | 'output'>('preset');

  const keyValue: Record<ModelKey, string> = { gpt: apiKey, gemini: geminiKey, claude: anthropicKey };
  const keySetter: Record<ModelKey, (v: string) => void> = {
    gpt: onApiKeyChange,
    gemini: onGeminiKeyChange,
    claude: onAnthropicKeyChange,
  };

  const renderKeyInput = (model: ModelKey) => (
    <div className="api-input" key={model}>
      <label>{KEY_LABEL[model]}</label>
      <input
        type="password"
        value={keyValue[model]}
        onChange={(e) => keySetter[model](e.target.value)}
        placeholder={KEY_PLACEHOLDER[model]}
      />
    </div>
  );

  // 雙 AI 模式需要的金鑰（攻守兩模型，去重）
  const dualKeyModels = Array.from(new Set<ModelKey>([dualConfig.attacker, dualConfig.victim]));

  if (collapsed) {
    return (
      <div className="control-panel collapsed">
        <button className="icon-btn" onClick={onToggleCollapse}><ChevronRight /></button>
      </div>
    );
  }

  return (
    <div className="control-panel">
      <div className="panel-header">
        <h2>控制面板</h2>
        <button className="icon-btn" onClick={onToggleCollapse}><ChevronLeft /></button>
      </div>

      <div className="api-section">
        <div className="mode-toggle">
          <button
            className={`mode-btn ${generationMode === 'single' ? 'active' : ''}`}
            onClick={() => onGenerationModeChange('single')}
          >
            <Cpu size={14} /> 單 AI 腳本
          </button>
          <button
            className={`mode-btn ${generationMode === 'dual' ? 'active' : ''}`}
            onClick={() => onGenerationModeChange('dual')}
          >
            <Users size={14} /> 雙 AI 對話
          </button>
        </div>

        {generationMode === 'single' ? (
          <>
            <div className="model-selector">
              <label>模型選擇 (Model)</label>
              <select value={selectedModel} onChange={(e) => onModelChange(e.target.value as ModelKey)}>
                {MODEL_KEYS.map((m) => <option key={m} value={m}>{MODEL_LABELS[m]}</option>)}
              </select>
            </div>
            {renderKeyInput(selectedModel)}
          </>
        ) : (
          <>
            <div className="dual-grid">
              <div className="model-selector">
                <label>攻擊者 (Attacker)</label>
                <select value={dualConfig.attacker} onChange={(e) => onDualConfigChange({ ...dualConfig, attacker: e.target.value as ModelKey })}>
                  {MODEL_KEYS.map((m) => <option key={m} value={m}>{MODEL_LABELS[m]}</option>)}
                </select>
              </div>
              <button
                className="swap-btn"
                title="攻守對調 (counterbalance)"
                onClick={() => onDualConfigChange({ ...dualConfig, attacker: dualConfig.victim, victim: dualConfig.attacker })}
              >
                <ArrowLeftRight size={16} />
              </button>
              <div className="model-selector">
                <label>目標 (Victim)</label>
                <select value={dualConfig.victim} onChange={(e) => onDualConfigChange({ ...dualConfig, victim: e.target.value as ModelKey })}>
                  {MODEL_KEYS.map((m) => <option key={m} value={m}>{MODEL_LABELS[m]}</option>)}
                </select>
              </div>
            </div>

            <div className="dual-grid2">
              <div className="model-selector">
                <label>意圖 / GT</label>
                <select value={dualConfig.intent} onChange={(e) => onDualConfigChange({ ...dualConfig, intent: e.target.value as DualAgentConfig['intent'] })}>
                  <option value="malicious">malicious（惡意）</option>
                  <option value="benign">benign（良性對照）</option>
                </select>
              </div>
              <div className="model-selector">
                <label>回合數 (Rounds)</label>
                <input
                  type="number"
                  min={1}
                  max={40}
                  value={dualConfig.rounds}
                  onChange={(e) => onDualConfigChange({ ...dualConfig, rounds: Math.max(1, parseInt(e.target.value) || 1) })}
                />
              </div>
            </div>
            <div className="hint-text">一來一往＝1 回合＝2 則訊息；固定長度硬切（定版 15–20 回合）。</div>

            {dualKeyModels.map((m) => renderKeyInput(m))}
          </>
        )}
      </div>

      <div className="tabs">
        <button
          className={`tab-btn ${activeTab === 'preset' ? 'active' : ''}`}
          onClick={() => setActiveTab('preset')}
        >
          <ShieldAlert size={16} /> Preset
        </button>
        <button
          className={`tab-btn ${activeTab === 'knobs' ? 'active' : ''}`}
          onClick={() => setActiveTab('knobs')}
        >
          <Cpu size={16} /> Knobs
        </button>
        <button
          className={`tab-btn ${activeTab === 'output' ? 'active' : ''}`}
          onClick={() => setActiveTab('output')}
        >
          <FolderOpen size={16} /> Output
        </button>
      </div>

      <div className="tab-content">
        {activeTab === 'preset' && (
          <div className="form-group">
            <label>情境預設 (Preset)</label>
            <select value={parameters.preset} onChange={(e) => onParamChange('preset', e.target.value)}>
              {OPTIONS.preset.map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </select>

            <label style={{ marginTop: '10px' }}>意圖選擇 (Intents)</label>
            <div className="checkbox-group">
              <label>
                <input
                  type="checkbox"
                  checked={parameters.intents?.includes('malicious')}
                  onChange={(e) => {
                    const newIntents = e.target.checked
                      ? [...(parameters.intents || []), 'malicious']
                      : (parameters.intents || []).filter(i => i !== 'malicious');
                    onParamChange('intents', newIntents);
                  }}
                />
                惡意意圖 (Experimental)
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={parameters.intents?.includes('benign')}
                  onChange={(e) => {
                    const newIntents = e.target.checked
                      ? [...(parameters.intents || []), 'benign']
                      : (parameters.intents || []).filter(i => i !== 'benign');
                    onParamChange('intents', newIntents);
                  }}
                />
                良性意圖 (Control)
              </label>
            </div>
            <div className="hint-text">
              {parameters.intents?.length === 2
                ? "雙選模式：將同時生成兩組對照資料 (Paired Generation)"
                : "單選模式：僅生成指定意圖的資料"}
            </div>
          </div>
        )}

        {activeTab === 'knobs' && (
          <div className="form-group">
            <label>Authority (A): {parameters.authority}</label>
            <input
              type="range"
              min="0"
              max="2"
              step="1"
              value={parameters.authority}
              onChange={(e) => onParamChange('authority', parseInt(e.target.value))}
            />
            <div className="slider-labels">
              <span>0</span><span>1</span><span>2</span>
            </div>

            <label>Urgency (U): {parameters.urgency}</label>
            <input
              type="range"
              min="0"
              max="2"
              step="1"
              value={parameters.urgency}
              onChange={(e) => onParamChange('urgency', parseInt(e.target.value))}
            />
            <div className="slider-labels">
              <span>0</span><span>1</span><span>2</span>
            </div>

            <label>Load (L): {parameters.load}</label>
            <input
              type="range"
              min="0"
              max="2"
              step="1"
              value={parameters.load}
              onChange={(e) => onParamChange('load', parseInt(e.target.value))}
            />
            <div className="slider-labels">
              <span>0</span><span>1</span><span>2</span>
            </div>
          </div>
        )}

        {activeTab === 'output' && (
          <div className="form-group">
            <label>最小訊息數 (Min Messages)</label>
            <input
              type="number"
              value={parameters.minMessages}
              onChange={(e) => onParamChange('minMessages', parseInt(e.target.value))}
            />
            <label>最大訊息數 (Max Messages)</label>
            <input
              type="number"
              value={parameters.maxMessages}
              onChange={(e) => onParamChange('maxMessages', parseInt(e.target.value))}
            />
            <label>時間跨度 (Time Span)</label>
            <select value={parameters.timeSpan} onChange={(e) => onParamChange('timeSpan', e.target.value)}>
              {OPTIONS.timeSpan.map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </select>
          </div>
        )}
      </div>

      <div className="actions">
        <button className="btn-primary" onClick={onGenerate} disabled={isGenerating}>
          <Play size={16} /> {isGenerating ? '生成中...' : generationMode === 'dual' ? '雙 AI 生成 (Generate)' : '開始生成 (Generate)'}
        </button>
        <button className="btn-secondary" onClick={onSave}>
          <FolderOpen size={16} /> 另存新檔 (Save)
        </button>
        <button className="btn-secondary" onClick={onCopy}>
          <Copy size={16} /> 複製內容 (Copy)
        </button>
        {hasTrace && (
          <button className="btn-secondary" onClick={onExportTrace}>
            <Download size={16} /> 下載生成 trace
          </button>
        )}
        <button className="btn-danger" onClick={onClear} disabled={isGenerating}>
          <Trash2 size={16} /> 清空對話 (Clear)
        </button>
      </div>

      <style>{`
        .control-panel {
          width: var(--sidebar-width);
          background: var(--bg-panel);
          border-right: 1px solid var(--border-color);
          display: flex;
          flex-direction: column;
          height: 100%;
          transition: width 0.3s;
        }
        .control-panel.collapsed {
          width: 50px;
          align-items: center;
          padding-top: 10px;
        }
        .panel-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: var(--spacing-md);
          border-bottom: 1px solid var(--border-color);
        }
        .panel-header h2 {
          margin: 0;
          font-size: var(--font-size-lg);
          font-weight: 600;
        }
        .api-section {
          padding: var(--spacing-md);
          border-bottom: 1px solid var(--border-color);
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .model-selector select, .model-selector input, .api-input input {
          width: 100%;
          background: var(--bg-input);
          border: 1px solid var(--border-color);
          color: var(--text-primary);
          padding: 8px;
          margin-top: 4px;
          border-radius: 4px;
        }
        .mode-toggle {
          display: flex;
          gap: 6px;
          background: var(--hover-bg);
          padding: 4px;
          border-radius: 8px;
        }
        .mode-btn {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 8px;
          border: none;
          background: transparent;
          color: var(--text-secondary);
          border-radius: 6px;
          cursor: pointer;
          font-size: 13px;
          font-weight: 600;
        }
        .mode-btn.active {
          background: var(--accent-color);
          color: #fff;
        }
        .dual-grid {
          display: grid;
          grid-template-columns: 1fr auto 1fr;
          align-items: end;
          gap: 8px;
        }
        .dual-grid2 {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
        }
        .swap-btn {
          height: 36px;
          width: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1px solid var(--border-color);
          background: var(--bg-input);
          color: var(--accent-color);
          border-radius: 6px;
          cursor: pointer;
        }
        .swap-btn:hover { background: var(--hover-bg); }
        .model-selector label {
          font-size: 12px;
          color: var(--text-secondary);
        }
        .api-input label, .model-selector label {
            font-size: 12px;
            color: var(--text-secondary);
        }
        .tabs {
          display: flex;
          border-bottom: 1px solid var(--border-color);
        }
        .tab-btn {
          flex: 1;
          background: transparent;
          border: none;
          color: var(--text-secondary);
          padding: 10px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 4px;
          border-bottom: 2px solid transparent;
        }
        .tab-btn.active {
          color: var(--text-primary);
          border-bottom-color: var(--accent-color);
        }
        .tab-content {
          flex: 1;
          padding: var(--spacing-md);
          overflow-y: auto;
        }
        .form-group {
          display: flex;
          flex-direction: column;
          gap: var(--spacing-md);
        }
        .form-group label {
          color: var(--text-secondary);
          font-size: var(--font-size-sm);
        }
        .form-group select, .form-group input[type="number"] {
          background: var(--bg-input);
          border: 1px solid var(--border-color);
          color: var(--text-primary);
          padding: 8px;
          border-radius: 4px;
        }
        .slider-labels {
            display: flex;
            justify-content: space-between;
            font-size: 10px;
            color: var(--text-secondary);
            margin-top: -8px;
        }
        .checkbox-group {
            display: flex;
            flex-direction: column;
            gap: 8px;
            padding: 8px;
            background: var(--bg-input);
            border: 1px solid var(--border-color);
            border-radius: 4px;
        }
        .checkbox-group label {
            display: flex;
            align-items: center;
            gap: 8px;
            cursor: pointer;
            color: var(--text-primary);
        }
        .hint-text {
            font-size: 11px;
            color: var(--accent-color);
            margin-top: 4px;
        }
        .actions {
          padding: var(--spacing-md);
          border-top: 1px solid var(--border-color);
          display: flex;
          flex-direction: column;
          gap: var(--spacing-sm);
        }
        .btn-primary {
          background: var(--accent-color);
          color: white;
          border: none;
          padding: 10px;
          border-radius: 4px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          font-weight: 600;
        }
        .btn-primary:hover {
          background: var(--accent-hover);
        }
        .btn-primary:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }
        .btn-secondary {
          background: transparent;
          border: 1px solid var(--border-color);
          color: var(--text-primary);
          padding: 10px;
          border-radius: 4px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }
        .btn-secondary:hover {
          background: rgba(0,0,0,0.05);
        }
        .btn-danger {
          background: transparent;
          border: 1px solid var(--error-color);
          color: var(--error-color);
          padding: 10px;
          border-radius: 4px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }
        .btn-danger:hover {
          background: rgba(215, 58, 73, 0.1);
        }
        .icon-btn {
          background: transparent;
          border: none;
          color: var(--text-secondary);
          cursor: pointer;
        }
        .icon-btn:hover {
          color: var(--text-primary);
        }
      `}</style>
    </div>
  );
};
