import type { SimulationParameters } from "../core/types";

const SLUG_MAP: Record<string, string> = {
    // Industry
    "軟體/SaaS 新創": "saas",
    "傳統金融/銀行": "finance",
    "零售/製造業": "retail",
    "醫療服務": "healthcare",

    // Preset
    "Preset 1 技術挫折 影子 IT": "shadow_it",
    "Preset 2 通知焦慮 急迫性服從": "urgency",
    "Preset 3 流程混亂 連結釣魚": "phishing",
    "Preset 4 文化常規 冷頻道異常社交": "cold_channel",
};

export const generateFilename = (params: SimulationParameters): string => {
    const presetSlug = SLUG_MAP[params.preset] || "preset";

    // Format: teams_data_tech_[preset]_A[authority]U[urgency]L[load]_[timestamp].json
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    return `teams_data_tech_${presetSlug}_A${params.authority}U${params.urgency}L${params.load}_${timestamp}.json`;
};
