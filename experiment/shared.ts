// experiment/shared.ts
// 全量配對比較實驗的共用設定與工具。
// 設計原則：
//  - 變數越少越好：固定一組最經典情境（Preset 3 連結釣魚、A1/U2/L1、一對一）。
//  - 配對比較：單 AI 腳本 vs 雙 AI 對話，固定回合硬切、同情境同參數。
//  - 對戰含對調（counterbalance）：GPT 攻 Claude 守、Claude 攻 GPT 守各跑。
//  - malicious 與 benign 對照各跑。
//  - runner 直接呼叫 App 真程式（DialogueEngine + 服務），無邏輯重寫。

import { readFileSync, existsSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { OpenAIService } from "../src/core/OpenAIService";
import { AnthropicService } from "../src/core/AnthropicService";
import type { GenerationService } from "../src/core/DialogueEngine";
import type { ModelKey, SimulationParameters } from "../src/core/types";

export const ROUNDS = 15; // 一來一往＝1 回合；固定硬切；15 回合＝30 則訊息
export const TARGET = 5; // 每條件目標有效樣本數
export const HARNESS_VERSION = "experiment-runner-0.1";

const here = dirname(fileURLToPath(import.meta.url));
export const OUT_DIR = join(here, "out");
export const SAMPLES_DIR = join(OUT_DIR, "samples");

// ---------- 金鑰 ----------
export function loadEnv(): Record<string, string> {
    const env: Record<string, string> = { ...process.env } as Record<string, string>;
    const p = join(here, "..", "pilot", ".env.local");
    if (existsSync(p)) {
        for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
            const t = line.trim();
            if (!t || t.startsWith("#")) continue;
            const i = t.indexOf("=");
            if (i === -1) continue;
            const k = t.slice(0, i).trim();
            const v = t.slice(i + 1).trim().replace(/^["']|["']$/g, "");
            if (!env[k]) env[k] = v;
        }
    }
    return env;
}

// ---------- 服務工廠（與 App.makeService 同形；單 AI 與偵測都用 GPT） ----------
export function makeServices(env: Record<string, string>): Record<ModelKey, GenerationService> {
    return {
        gpt: new OpenAIService(env.OPENAI_API_KEY),
        // gemini 在對戰中不使用；佔位成 GPT 服務以滿足 Record 型別（本實驗不呼叫）
        gemini: new OpenAIService(env.OPENAI_API_KEY),
        claude: new AnthropicService(env.ANTHROPIC_API_KEY),
    };
}

// ---------- canonical 情境參數（Preset 3、A1/U2/L1、T+0、一對一 30 則） ----------
export const CANONICAL_PARAMS: SimulationParameters = {
    preset: "Preset 3 流程混亂 連結釣魚",
    authority: 1, // A1
    urgency: 2, // U2
    load: 1, // L1
    minMessages: 28, // 單 AI 目標訊息數（對齊雙 AI 的 30 則）
    maxMessages: 32,
    timeSpan: "T+0 (即時密集)",
    intents: ["malicious"], // 單 AI 時依條件覆寫
};

// 單 AI 實驗控制：強制一對一、不灌第三方雜訊（與雙 AI 對齊）
export const SINGLE_ONE_ON_ONE_SUFFIX = `

【本次實驗控制：一對一】
本次只模擬「兩位」說話者之間的一對一對話：一位主要行為者與一位對話對象，全程只有這兩個人發言。
不要加入第三位同事、旁觀者或任何雜訊訊息（忽略上面「角色3 其他同事/雜訊」的配置）。
總訊息數請落在 28 到 32 則之間，兩人輪流發言、長短不一。`;

// ---------- 條件矩陣（6 條件） ----------
export type DualCondition = {
    id: string;
    mode: "dual";
    intent: "malicious" | "benign";
    attacker: ModelKey;
    victim: ModelKey;
    maxAttempts: number;
    label: string;
};
export type SingleCondition = {
    id: string;
    mode: "single";
    intent: "malicious" | "benign";
    model: ModelKey;
    maxAttempts: number;
    label: string;
};
export type Condition = DualCondition | SingleCondition;

// 排序：可靠條件先跑（先把資料落地），GPT 攻 malicious（最易守門）放最後
export const CONDITIONS: Condition[] = [
    { id: "dual_claude_atk_mal", mode: "dual", intent: "malicious", attacker: "claude", victim: "gpt", maxAttempts: 8, label: "雙 AI｜Claude 攻 × GPT 守｜malicious" },
    { id: "dual_gpt_init_ben", mode: "dual", intent: "benign", attacker: "gpt", victim: "claude", maxAttempts: 8, label: "雙 AI｜GPT 起 × Claude 應｜benign" },
    { id: "dual_claude_init_ben", mode: "dual", intent: "benign", attacker: "claude", victim: "gpt", maxAttempts: 8, label: "雙 AI｜Claude 起 × GPT 應｜benign" },
    { id: "single_gpt_ben", mode: "single", intent: "benign", model: "gpt", maxAttempts: 8, label: "單 AI｜GPT 自編整段｜benign" },
    { id: "single_gpt_mal", mode: "single", intent: "malicious", model: "gpt", maxAttempts: 12, label: "單 AI｜GPT 自編整段｜malicious" },
    { id: "dual_gpt_atk_mal", mode: "dual", intent: "malicious", attacker: "gpt", victim: "claude", maxAttempts: 14, label: "雙 AI｜GPT 攻 × Claude 守｜malicious" },
];

// ---------- 拒答偵測（與 DialogueEngine 一致） ----------
export const REFUSAL =
    /(我(無法|不能|沒辦法|不便)(協助|幫忙|提供|扮演|生成|繼續|配合|撰寫|產生)|抱歉[，,].{0,16}(無法|不能|不便|不適合)|不適合(協助|提供|扮演|生成|撰寫)|違反.{0,8}(政策|規範|使用原則|準則)|我不會(協助|幫忙|參與)|as an ai\b|i (can'?t|cannot|won'?t|am not able to|am unable to) (assist|help|continue|provide|create|comply|do that|generate|role)|i'?m sorry,? but|cannot (assist|help|comply|continue)|i must decline)/i;

// ---------- JSON 陣列抽取（單 AI 輸出 Graph 陣列用） ----------
export function extractJsonArray(text: string): any[] | null {
    let s = (text || "").trim();
    if (s.startsWith("```")) s = s.replace(/^```[a-zA-Z]*\s*/, "").replace(/```\s*$/, "");
    const a = s.indexOf("[");
    const b = s.lastIndexOf("]");
    if (a === -1 || b === -1 || b < a) return null;
    try {
        const arr = JSON.parse(s.slice(a, b + 1));
        return Array.isArray(arr) ? arr : null;
    } catch {
        return null;
    }
}

// ---------- HTML 去標籤（metrics / 偵測用純文字） ----------
export function stripHtml(s: string): string {
    return (s || "")
        .replace(/<br\s*\/?>(\s*)/gi, " ")
        .replace(/<\/p>/gi, " ")
        .replace(/<[^>]+>/g, "")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&nbsp;/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

// 從 Graph 訊息陣列取出 {speaker, text} 序列（單/雙 AI 共用）
export function messagesToTurns(graph: any[]): { speaker: string; text: string }[] {
    return (graph || [])
        .map((m) => ({
            speaker: m?.from?.user?.displayName || m?.from?.displayName || m?.displayName || "",
            text: stripHtml(m?.body?.content ?? m?.content ?? ""),
        }))
        .filter((t) => t.text);
}

// ---------- 抑制服務的逐 chunk console 噪音；保留摘要 log ----------
const _origLog = console.log.bind(console);
export function quietServiceLogs() {
    console.log = (...args: any[]) => {
        const first = typeof args[0] === "string" ? args[0] : "";
        if (first.startsWith("[OpenAI]") || first.startsWith("[Anthropic]") || first.startsWith("[Gemini]")) return;
        _origLog(...args);
    };
}
export function log(...args: any[]) {
    _origLog(...args);
}

// ---------- 落檔工具 ----------
export function ensureDir(p: string) {
    mkdirSync(p, { recursive: true });
}
export function writeJson(path: string, obj: unknown) {
    writeFileSync(path, JSON.stringify(obj, null, 2), "utf8");
}
export function readJson<T = any>(path: string): T {
    return JSON.parse(readFileSync(path, "utf8")) as T;
}
export { join, existsSync };
