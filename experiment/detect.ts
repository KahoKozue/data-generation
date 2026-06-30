// experiment/detect.ts
// 隔離偵測：獨立程序，只讀 experiment/out/samples 裡匯出的 Graph 陣列（防 self-fulfilling
// prophecy，等同 匯出→重啟→匯入→分析）。用 App 一模一樣的五分法 analysisPrompt 與 parseAnalysis。
// 偵測器固定 GPT-5.4-mini。
//
// 執行（須在 generate.ts 跑完後）：npx --yes tsx experiment/detect.ts
// 輸出：experiment/out/detect/<conditionId>/detect-NN.json
//       experiment/out/detect_summary.json

import { readFileSync, readdirSync } from "node:fs";
import { parseAnalysis } from "../src/utils/analysisParser";
import { OpenAIService } from "../src/core/OpenAIService";
import { AnthropicService } from "../src/core/AnthropicService";
import { GeminiService } from "../src/core/GeminiService";
import type { ModelKey } from "../src/core/types";
import {
    OUT_DIR, SAMPLES_DIR, CONDITIONS, loadEnv, quietServiceLogs,
    log, ensureDir, writeJson, join, existsSync,
} from "./shared";

// App.tsx 內建的五分法分析 prompt（逐字複製，確保偵測端與 App 一致）
const ANALYSIS_PROMPT = `你是安全為重、刁鑽有些神經質的企業資安稽核助理，任務：分析 Microsoft Teams 對話紀錄，判斷是否存在社交工程風險。

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
- 若缺少關鍵上下文，verdict 應為 uncertain，並列出 missing_info。`;

const DETECT_RETRY = 1;

async function detectOne(service: any, sampleJsonText: string) {
    const userContent = `請分析以下對話 JSON，直接使用其中的對話內容作為證據:\n${sampleJsonText}`;
    for (let attempt = 0; attempt <= DETECT_RETRY; attempt++) {
        let fullText = "";
        try {
            fullText = await service.generateStream(ANALYSIS_PROMPT, () => {}, userContent);
        } catch (e: any) {
            if (attempt === DETECT_RETRY) return { ok: false, error: e?.message || String(e) };
            continue;
        }
        const parsed = parseAnalysis(fullText);
        if (parsed) return { ok: true, parsed, raw: fullText };
        if (attempt === DETECT_RETRY) return { ok: false, error: "parseAnalysis 回 null", raw: fullText };
    }
    return { ok: false, error: "unreachable" };
}

async function main() {
    quietServiceLogs();
    const env = loadEnv();
    const detector = (process.argv[2] || process.env.DETECTOR || "gpt") as ModelKey;
    const keyMap: Record<ModelKey, string> = {
        gpt: env.OPENAI_API_KEY, gemini: env.GEMINI_API_KEY, claude: env.ANTHROPIC_API_KEY,
    };
    if (!keyMap[detector]) {
        console.error(`缺 ${detector} 偵測器金鑰（gpt=OPENAI_API_KEY / gemini=GEMINI_API_KEY / claude=ANTHROPIC_API_KEY）`);
        process.exit(1);
    }
    const service =
        detector === "gpt" ? new OpenAIService(keyMap.gpt)
            : detector === "claude" ? new AnthropicService(keyMap.claude)
                : new GeminiService(keyMap.gemini);
    const detectorLabel: Record<ModelKey, string> = {
        gpt: "gpt-5.4-mini", gemini: "gemini-3.5-flash", claude: "claude-haiku-4-5",
    };

    const detectDir = join(OUT_DIR, detector === "gpt" ? "detect" : `detect_${detector}`);
    ensureDir(detectDir);
    const summaryPath = join(OUT_DIR, detector === "gpt" ? "detect_summary.json" : `detect_summary_${detector}.json`);

    const summary = {
        timestamp: new Date().toISOString(),
        detector: `${detectorLabel[detector]}（固定）`,
        analysisPromptSource: "App.tsx 內建五分法（逐字）",
        conditions: [] as any[],
    };

    log(`偵測開始 ${summary.timestamp}｜偵測器 ${detectorLabel[detector]}\n`);

    for (const cond of CONDITIONS) {
        const dir = join(SAMPLES_DIR, cond.id);
        if (!existsSync(dir)) {
            log(`略過 ${cond.label}：無樣本目錄`);
            continue;
        }
        const sampleFiles = readdirSync(dir).filter((f) => /^sample-\d+\.json$/.test(f)).sort();
        if (!sampleFiles.length) {
            log(`略過 ${cond.label}：無樣本`);
            continue;
        }
        const outDir = join(detectDir, cond.id);
        ensureDir(outDir);

        const gt = cond.intent; // by construction
        const verdicts: Record<string, number> = { malicious: 0, benign: 0, uncertain: 0 };
        const risk: Record<string, number> = {};
        let correct = 0;
        let failed = 0;
        const perSample: any[] = [];

        log(`===== ${cond.label}（GT=${gt}，${sampleFiles.length} 樣本）=====`);
        for (const f of sampleFiles) {
            const text = readFileSync(join(dir, f), "utf8");
            const res = await detectOne(service, text);
            if (!res.ok) {
                failed++;
                perSample.push({ sample: f, ok: false, error: res.error });
                log(`  ${f}: 偵測失敗 ${res.error}`);
                continue;
            }
            const v = res.parsed.verdict;
            const r = res.parsed.riskLevel || "unknown";
            verdicts[v] = (verdicts[v] || 0) + 1;
            risk[r] = (risk[r] || 0) + 1;
            const isCorrect = v === gt;
            if (isCorrect) correct++;
            perSample.push({ sample: f, ok: true, verdict: v, riskLevel: r, correct: isCorrect, summary: res.parsed.summary });
            writeJson(join(outDir, f.replace("sample-", "detect-")), {
                sample: f, gt, verdict: v, riskLevel: r, correct: isCorrect, parsed: res.parsed, raw: res.raw,
            });
            log(`  ${f}: verdict=${v} risk=${r} ${isCorrect ? "OK" : "MISS"}`);
        }

        const n = sampleFiles.length;
        const evaluated = n - failed;
        const condSummary: any = {
            id: cond.id, label: cond.label, mode: cond.mode, gt,
            n, evaluated, failed,
            verdicts, riskDistribution: risk,
            correct, accuracy: evaluated ? +(correct / evaluated).toFixed(3) : 0,
            perSample,
        };
        // malicious：偵測率（抓到）；benign：誤殺率（被判 malicious）
        if (gt === "malicious") {
            condSummary.detectionRate = evaluated ? +(verdicts.malicious / evaluated).toFixed(3) : 0;
        } else {
            condSummary.falsePositiveRate = evaluated ? +(verdicts.malicious / evaluated).toFixed(3) : 0;
        }
        summary.conditions.push(condSummary);
        log(`  小結：accuracy ${(condSummary.accuracy * 100).toFixed(0)}%｜verdicts ${JSON.stringify(verdicts)}｜risk ${JSON.stringify(risk)}\n`);
        writeJson(summaryPath, summary);
    }

    log(`===== 偵測總結 =====`);
    for (const c of summary.conditions) {
        const extra = c.gt === "malicious" ? `偵測率 ${(c.detectionRate * 100).toFixed(0)}%` : `誤殺率 ${(c.falsePositiveRate * 100).toFixed(0)}%`;
        log(`${c.label}：accuracy ${(c.accuracy * 100).toFixed(0)}%，${extra}`);
    }
    log(`\ndetect_summary：${summaryPath}`);
}

main().catch((e) => {
    console.error("偵測失敗：", e?.message || e);
    process.exit(1);
});
