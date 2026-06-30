// experiment/generate.ts
// 全量生成：6 條件（單 AI×2、雙 AI×4 含對調），每條件目標 5 段有效樣本。
// 直接呼叫 App 真程式：雙 AI 走 DialogueEngine.runDialogue；單 AI 走 PromptBuilder + 服務。
// 過量生成補足 GPT 守門 abort；abort／重試次數全部記進 manifest（本身是研究發現）。
//
// 執行：npx --yes tsx experiment/generate.ts
// 輸出：experiment/out/samples/<conditionId>/sample-NN.json（Graph 陣列，供偵測匯入）
//       experiment/out/samples/<conditionId>/trace-NN.json（生成 trace）
//       experiment/out/manifest.json（全部統計）

import { readdirSync, rmSync } from "node:fs";
import { PromptBuilder } from "../src/core/PromptBuilder";
import { runDialogue } from "../src/core/DialogueEngine";
import type { GenerationService } from "../src/core/DialogueEngine";
import {
    ROUNDS, TARGET, HARNESS_VERSION, OUT_DIR, SAMPLES_DIR, CANONICAL_PARAMS,
    SINGLE_ONE_ON_ONE_SUFFIX, CONDITIONS, REFUSAL, extractJsonArray,
    loadEnv, makeServices, quietServiceLogs, log, ensureDir, writeJson, readJson, join, existsSync,
    type Condition, type SingleCondition, type DualCondition,
} from "./shared";
import type { ModelKey } from "../src/core/types";

type OutcomeKind = "valid" | "abort" | "refuse" | "parse_fail" | "too_many_speakers" | "too_short" | "error";

interface ConditionStat {
    id: string;
    label: string;
    mode: "single" | "dual";
    intent: "malicious" | "benign";
    attacker?: ModelKey;
    victim?: ModelKey;
    model?: ModelKey;
    attempts: number;
    valid: number;
    outcomes: Record<OutcomeKind, number>;
    abortReasons: string[];
    perValidTurnRetries: number[]; // 每段有效樣本內的總重試次數（雙 AI）或嘗試索引（單 AI）
    samples: string[];
    abortRate: number;
}

function newOutcomes(): Record<OutcomeKind, number> {
    return { valid: 0, abort: 0, refuse: 0, parse_fail: 0, too_many_speakers: 0, too_short: 0, error: 0 };
}

const pad = (n: number) => String(n).padStart(2, "0");

// ---------- 單 AI：產出 Graph 陣列 ----------
async function genSingle(cond: SingleCondition, services: Record<ModelKey, GenerationService>) {
    const builder = new PromptBuilder({ ...CANONICAL_PARAMS, intents: [cond.intent] });
    const systemPrompt = builder.buildSystemPrompt() + SINGLE_ONE_ON_ONE_SUFFIX;
    const service = services[cond.model];

    let raw = "";
    try {
        raw = await service.generateStream(systemPrompt, () => {});
    } catch (e: any) {
        return { outcome: "error" as OutcomeKind, reason: e?.message || String(e) };
    }
    if (REFUSAL.test(raw)) return { outcome: "refuse" as OutcomeKind, reason: "輸出含拒答語句" };
    const arr = extractJsonArray(raw);
    if (!arr) return { outcome: "parse_fail" as OutcomeKind, reason: "無法解析 JSON 陣列" };
    const valid = arr.filter((m) => (m?.from?.user?.displayName || m?.from?.displayName) && (m?.body?.content || m?.content));
    if (valid.length < 10) return { outcome: "too_short" as OutcomeKind, reason: `有效訊息僅 ${valid.length} 則` };
    const speakers = new Set(valid.map((m) => m?.from?.user?.displayName || m?.from?.displayName));
    if (speakers.size > 2) return { outcome: "too_many_speakers" as OutcomeKind, reason: `說話者 ${speakers.size} 人（要求一對一）` };

    const trace = {
        harnessVersion: HARNESS_VERSION,
        timestamp: new Date().toISOString(),
        mode: "single" as const,
        intent: cond.intent,
        groundTruth: cond.intent,
        model: cond.model,
        preset: CANONICAL_PARAMS.preset,
        knobs: { authority: CANONICAL_PARAMS.authority, urgency: CANONICAL_PARAMS.urgency, load: CANONICAL_PARAMS.load },
        timeSpan: CANONICAL_PARAMS.timeSpan,
        systemPrompt,
        messageCount: valid.length,
        distinctSpeakers: speakers.size,
    };
    return { outcome: "valid" as OutcomeKind, graph: valid, trace };
}

// ---------- 雙 AI：DialogueEngine ----------
async function genDual(cond: DualCondition, services: Record<ModelKey, GenerationService>) {
    try {
        const result = await runDialogue({
            parameters: CANONICAL_PARAMS,
            config: { attacker: cond.attacker, victim: cond.victim, rounds: ROUNDS, intent: cond.intent },
            services,
            onProgress: () => {},
        });
        const turnRetries = result.trace.turns.reduce((s, t) => s + (t.attempts - 1), 0);
        return { outcome: "valid" as OutcomeKind, graph: result.graphMessages, trace: result.trace, turnRetries };
    } catch (e: any) {
        const trace = e?.trace;
        const reason = trace?.abortReason || e?.message || String(e);
        return { outcome: "abort" as OutcomeKind, reason, partialTurns: trace?.turns?.length ?? 0 };
    }
}

async function runCondition(cond: Condition, services: Record<ModelKey, GenerationService>): Promise<ConditionStat> {
    const dir = join(SAMPLES_DIR, cond.id);
    ensureDir(dir);
    // 清掉殘留的部分檔（本函式只在條件「未完成」時被呼叫，重跑要從乾淨狀態開始，統計才一致）
    for (const f of readdirSync(dir)) if (/^(sample|trace)-\d+\.json$/.test(f)) rmSync(join(dir, f));
    const stat: ConditionStat = {
        id: cond.id, label: cond.label, mode: cond.mode, intent: cond.intent,
        attacker: cond.mode === "dual" ? cond.attacker : undefined,
        victim: cond.mode === "dual" ? cond.victim : undefined,
        model: cond.mode === "single" ? cond.model : undefined,
        attempts: 0, valid: 0, outcomes: newOutcomes(), abortReasons: [],
        perValidTurnRetries: [], samples: [], abortRate: 0,
    };

    log(`\n===== ${cond.label}（目標 ${TARGET} 段，上限 ${cond.maxAttempts} 次）=====`);
    for (let attempt = 1; attempt <= cond.maxAttempts && stat.valid < TARGET; attempt++) {
        stat.attempts++;
        const res = cond.mode === "single" ? await genSingle(cond, services) : await genDual(cond, services);
        stat.outcomes[res.outcome]++;
        if (res.outcome === "valid") {
            stat.valid++;
            const n = pad(stat.valid);
            writeJson(join(dir, `sample-${n}.json`), (res as any).graph);
            writeJson(join(dir, `trace-${n}.json`), (res as any).trace);
            stat.samples.push(`sample-${n}.json`);
            const retries = cond.mode === "dual" ? (res as any).turnRetries ?? 0 : attempt;
            stat.perValidTurnRetries.push(retries);
            log(`  [${attempt}] valid -> sample-${n}（${cond.mode === "dual" ? `turn 重試 ${retries}` : `第 ${attempt} 次成功`}）`);
        } else {
            if (res.outcome === "abort" || res.outcome === "error") stat.abortReasons.push((res as any).reason || "");
            log(`  [${attempt}] ${res.outcome}：${(res as any).reason || ""}`);
        }
    }
    stat.abortRate = stat.attempts ? +(1 - stat.valid / stat.attempts).toFixed(3) : 0;
    log(`  小結：${stat.valid}/${TARGET} 有效，共 ${stat.attempts} 次嘗試，abort 率 ${(stat.abortRate * 100).toFixed(0)}%`);
    log(`  outcomes：${JSON.stringify(stat.outcomes)}`);
    return stat;
}

async function main() {
    quietServiceLogs();
    const env = loadEnv();
    if (!env.OPENAI_API_KEY || !env.ANTHROPIC_API_KEY) {
        console.error("缺金鑰（需 OPENAI_API_KEY 與 ANTHROPIC_API_KEY）");
        process.exit(1);
    }
    const services = makeServices(env);

    const manifest = {
        harnessVersion: HARNESS_VERSION,
        timestamp: new Date().toISOString(),
        rounds: ROUNDS,
        target: TARGET,
        canonicalParams: CANONICAL_PARAMS,
        note: "單 AI 與偵測端固定用 GPT-5.4-mini；雙 AI 對戰＝GPT×Claude 含對調；temperature 因 reasoning/thinking 開啟不可設、採模型預設。",
        conditions: [] as ConditionStat[],
    };

    // 續跑支援：若已有 manifest，已完成（valid>=TARGET）的條件保留其統計、跳過重跑
    const manifestPath = join(OUT_DIR, "manifest.json");
    const prior: Record<string, ConditionStat> = {};
    if (existsSync(manifestPath)) {
        try {
            const m = readJson(manifestPath) as { conditions?: ConditionStat[] };
            for (const c of m.conditions || []) if (c.valid >= TARGET) prior[c.id] = c;
        } catch { /* 壞檔忽略，全部重跑 */ }
    }

    log(`生成開始 ${manifest.timestamp}｜${ROUNDS} 回合硬切｜每條件目標 ${TARGET} 段｜可續跑已完成 ${Object.keys(prior).length} 條件`);
    for (const cond of CONDITIONS) {
        if (prior[cond.id]) {
            log(`略過 ${cond.label}：先前已完成（${prior[cond.id].valid}/${TARGET}）`);
            manifest.conditions.push(prior[cond.id]);
            writeJson(manifestPath, manifest);
            continue;
        }
        const stat = await runCondition(cond, services);
        manifest.conditions.push(stat);
        writeJson(manifestPath, manifest); // 每條件後即時落檔，可隨時查
    }

    log(`\n===== 生成總結 =====`);
    for (const c of manifest.conditions) {
        log(`${c.label}：${c.valid}/${TARGET} 有效，abort 率 ${(c.abortRate * 100).toFixed(0)}%（嘗試 ${c.attempts}）`);
    }
    log(`\nmanifest：${join(OUT_DIR, "manifest.json")}`);
}

main().catch((e) => {
    console.error("生成失敗：", e?.message || e);
    process.exit(1);
});
