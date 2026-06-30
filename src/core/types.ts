export type Preset =
  | "Preset 1 技術挫折 影子 IT"
  | "Preset 2 通知焦慮 急迫性服從"
  | "Preset 3 流程混亂 連結釣魚"
  | "Preset 4 文化常規 冷頻道異常社交";

export type TimeSpan = "T+0 (即時密集)" | "T+3 (短期潛伏)" | "T+7 (長期潛伏)";

export interface SimulationParameters {
  // Preset
  preset: Preset;

  // Knobs (0-2)
  authority: number;
  urgency: number;
  load: number;

  // Output
  minMessages: number;
  maxMessages: number;
  timeSpan: TimeSpan;
  intents: string[];
}

// 三模型選擇器共用的代號
export type ModelKey = "gpt" | "gemini" | "claude";

// 生成模式：單 AI 腳本（既有）或雙 AI 對話（第二種資料模式）
export type GenerationMode = "single" | "dual";

// 雙 agent 實驗設定。攻守模型即對戰方向（要對調就互換 attacker/victim）。
export interface DualAgentConfig {
  attacker: ModelKey; // 攻擊者（malicious 時帶惡意目標）
  victim: ModelKey; // 目標（台灣職場員工，不知道自己被攻擊）
  rounds: number; // 一來一往＝1 回合＝2 則訊息；固定長度硬切
  intent: "malicious" | "benign"; // GT by construction
}

export const MODEL_LABELS: Record<ModelKey, string> = {
  gpt: "GPT-5.4-mini",
  gemini: "Gemini 3.5 Flash",
  claude: "Claude Haiku 4.5",
};

export const OPTIONS = {
  preset: [
    "Preset 1 技術挫折 影子 IT",
    "Preset 2 通知焦慮 急迫性服從",
    "Preset 3 流程混亂 連結釣魚",
    "Preset 4 文化常規 冷頻道異常社交"
  ],
  timeSpan: ["T+0 (即時密集)", "T+3 (短期潛伏)", "T+7 (長期潛伏)"],
} as const;
