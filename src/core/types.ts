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

export const OPTIONS = {
  preset: [
    "Preset 1 技術挫折 影子 IT",
    "Preset 2 通知焦慮 急迫性服從",
    "Preset 3 流程混亂 連結釣魚",
    "Preset 4 文化常規 冷頻道異常社交"
  ],
  timeSpan: ["T+0 (即時密集)", "T+3 (短期潛伏)", "T+7 (長期潛伏)"],
} as const;
