import type { SimulationParameters } from "./types";

export class PromptBuilder {
    private parameters: SimulationParameters;

    constructor(initialParams?: SimulationParameters) {
        this.parameters = initialParams || {
            preset: "Preset 1 技術挫折 影子 IT",
            authority: 0,
            urgency: 0,
            load: 0,
            minMessages: 20,
            maxMessages: 30,
            timeSpan: "T+0 (即時密集)",
            intents: ["malicious"],
        };
    }

    public setParameters(params: Partial<SimulationParameters>) {
        this.parameters = { ...this.parameters, ...params };
    }

    public getParameters(): SimulationParameters {
        return this.parameters;
    }

    private getAuthorityDescription(level: number): string {
        switch (level) {
            case 0: return "A0 同事平級 無明顯權威";
            case 1: return "A1 具職權或代理身分 會用指令式語氣 但仍可被質疑";
            case 2: return "A2 明確上級或稽核或資訊部門權威 對方更不敢拒絕";
            default: return "A0 同事平級 無明顯權威";
        }
    }

    private getUrgencyDescription(level: number): string {
        switch (level) {
            case 0: return "U0 沒有時間壓力";
            case 1: return "U1 有截止時間或交付壓力 用 30 分鐘內 今天下班前 等表述";
            case 2: return "U2 強烈急迫 伴隨威脅或後果 例如 不處理會被停權 會被追責";
            default: return "U0 沒有時間壓力";
        }
    }

    private getLoadDescription(level: number): string {
        switch (level) {
            case 0: return "L0 訊息量正常 可清楚交代";
            case 1: return "L1 多線並行 有插話 有找檔 有會議 雜訊偏多";
            case 2: return "L2 明顯混亂 大量斷裂訊息 多個人插話 易點連結 易求捷徑";
            default: return "L0 訊息量正常 可清楚交代";
        }
    }

    private getPresetDescription(preset: string): string {
        switch (preset) {
            case "Preset 1 技術挫折 影子 IT":
                return `Preset 1 技術挫折 影子 IT
核心摩擦 程式碼貼上格式跑版 或訊息吃掉 或 UI 問題
捷徑行為 找外掛 找替代工具 找繞過方法
攻擊入口 偽造修復插件 或最佳化工具 以技術誘餌引導點擊或下載`;
            case "Preset 2 通知焦慮 急迫性服從":
                return `Preset 2 通知焦慮 急迫性服從
核心摩擦 下班通知 已讀壓力 害怕被究責
捷徑行為 快速回覆短句 跳過查證 直接照做
攻擊入口 偽裝上級或代理權威 下短指令 要求敏感資訊或操作`;
            case "Preset 3 流程混亂 連結釣魚":
                return `Preset 3 流程混亂 連結釣魚
核心摩擦 會議簽到混亂 找檔困難 搜尋失效 外部看板連結滿天飛
捷徑行為 看到連結就點 不走內建流程
攻擊入口 混入偽造會議記錄或補檔連結 引導登入或授權`;
            case "Preset 4 文化常規 冷頻道異常社交":
                return `Preset 4 文化常規 冷頻道異常社交
核心摩擦 正式頻道極簡冷淡 私事外移
捷徑行為 對過度熱情訊息保持戒心 但新人或邊緣人可能被拉走
攻擊入口 以私下邀約 或私訊協助 或情感鋪陳導向外部溝通管道`;
            default:
                return "";
        }
    }

    public buildSystemPrompt(): string {
        const {
            preset,
            authority,
            urgency,
            load,
            minMessages,
            maxMessages,
            timeSpan,
            intents,
        } = this.parameters;

        const hasMalicious = intents.includes('malicious');
        const hasBenign = intents.includes('benign');
        const isPaired = hasMalicious && hasBenign;

        let intentInstructions = "";
        let outputStructure = "";

        if (isPaired) {
            intentInstructions = `
三 情境設定 (Paired Generation)
你必須同時生成兩組對話 兩組對話的人設 場景 脈絡必須高度相似
但關鍵在於「解決方案意圖」的差異：
- malicious (惡意意圖)：雖然表面合理，但包含繞過安控、影子IT、或潛在的攻擊行為 (如 Preset 描述)。
- benign (良性意圖)：面對同樣的業務壓力或技術困難，選擇符合規範、或至少是安全的替代方案，不包含惡意特徵。

兩組對話的差異點：
1. 觸發點相同 (例如都要趕報告、都遇到系統故障)。
2. 轉折點不同 (Malicious 選擇走捷徑/下載工具/信賴釣魚連結; Benign 選擇詢問 IT/等待/使用正規管道)。
`;
            outputStructure = `
六 最終輸出限制
1 輸出一個 JSON Object，包含兩個 Key：
{
  "malicious": [ ... malicious messages ... ],
  "benign": [ ... benign messages ... ]
}
2 每個陣列內部的格式與上述原本的 Microsoft Graph chatMessage 格式相同。
3 不得輸出任何說明文字 不得輸出 Markdown
`;
        } else if (hasBenign) {
            intentInstructions = `
三 情境設定 (Benign Only)
你必須生成一組「良性」的對話。
雖然有業務壓力 (Urgency) 或技術困難 (Preset 描述的摩擦)，但角色選擇的解決方案必須是「良性」的。
也就是：
- 沒有遭受攻擊
- 沒有違規繞過安控 (或僅是極輕微的抱怨但未實行)
- 最終導向安全的結果
`;
            outputStructure = `
六 最終輸出限制
1 輸出 JSON Array
2 不得輸出任何說明文字 不得輸出 Markdown
`;
        } else {
            // Default to malicious (legacy behavior) or if only malicious is selected
            intentInstructions = `
三 情境設定 (Malicious / Default)
這是一組包含潛在風險或攻擊跡象的對話。
請依照 Preset 描述的攻擊入口與捷徑行為進行演繹。
`;
            outputStructure = `
六 最終輸出限制
1 輸出 JSON Array
2 不得輸出任何說明文字 不得輸出 Markdown
`;
        }


        return `你是一個用於企業資安防禦研究的合成資料引擎
任務是生成 Microsoft Teams 的對話日誌 用於社交工程偵測研究
對話內容必須使用繁體中文 台灣職場語境

輸入參數
Org 產業 軟體/IT/高科技製造業
Preset 情境預設 ${preset}
Knobs 旋鈕 Authority {A} Urgency {U} Load {L}
Output 對話訊息數 ${minMessages} 到 ${maxMessages} 時間跨度 ${timeSpan}
Mode ${isPaired ? "Paired (Malicious vs Benign)" : (hasBenign ? "Benign Only" : "Malicious Only")}

一 共同輸出規格
1 JSON 元素符合 Microsoft Graph chatMessage 格式
2 欄位需求
createdDateTime 必須呈現時間推移
from.user.displayName 必須是具名人物 不可為空
body.content 使用 HTML p br b 等
chatId replyToId 要合理
3 語言風格
台灣職場口語 可少量英文縮寫 例如 ASAP FYI CC sync ping workaround LGTM
訊息長短不一 可有碎片化連發
避免過度禮貌或機械化

二 三個旋鈕的定義 你必須把它轉成可觀察的對話行為
Authority A 0 到 2
${this.getAuthorityDescription(authority)}

Urgency U 0 到 2
${this.getUrgencyDescription(urgency)}

Load L 0 到 2
${this.getLoadDescription(load)}

${intentInstructions}

四 Preset 情境預設 你只能從下列四個選 其餘不得自創
${this.getPresetDescription(preset)}

五 角色配置
角色 1 (主要行為者)
角色 2 (對話對象)
角色 3 (其他同事/雜訊)
使用真實中文姓名或常見英文名 需符合台灣職場

${outputStructure}`;
    }
}
