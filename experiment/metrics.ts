// experiment/metrics.ts
// 加分量測（佐證雙 AI 較真實/多樣）：讀 experiment/out/samples，逐條件與逐模式（單/雙）算
//  - 訊息長度變異：每則字數的 mean / std / 變異係數 CV（CV 越高＝長短越不機械）
//  - 詞彙多樣性：TTR（字元）、root-TTR（Guiraud R，較不受長度影響）、bigram-TTR
//  - self-BLEU：條件內樣本互比的字元 n-gram BLEU（越低＝彼此越不像＝越多樣）
//
// 執行（須在 generate.ts 跑完後）：npx --yes tsx experiment/metrics.ts
// 輸出：experiment/out/metrics_summary.json

import { readFileSync, readdirSync } from "node:fs";
import {
    OUT_DIR, SAMPLES_DIR, CONDITIONS, messagesToTurns,
    log, writeJson, join, existsSync,
} from "./shared";

const chars = (s: string) => Array.from(s).filter((c) => c.trim() !== "");
const mean = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
const std = (a: number[]) => {
    if (a.length < 2) return 0;
    const m = mean(a);
    return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1));
};

function ngrams(tokens: string[], n: number): string[] {
    const out: string[] = [];
    for (let i = 0; i + n <= tokens.length; i++) out.push(tokens.slice(i, i + n).join(""));
    return out;
}

function counts(arr: string[]): Map<string, number> {
    const m = new Map<string, number>();
    for (const x of arr) m.set(x, (m.get(x) || 0) + 1);
    return m;
}

// 多參考 BLEU（hyp vs refs），字元 n-gram，n=1..4，加一平滑，含 brevity penalty
function bleu(hyp: string[], refs: string[][]): number {
    const N = 4;
    const logp: number[] = [];
    for (let n = 1; n <= N; n++) {
        const hg = ngrams(hyp, n);
        if (hg.length === 0) { logp.push(Math.log(1e-9)); continue; }
        const hc = counts(hg);
        const refMax = new Map<string, number>();
        for (const ref of refs) {
            const rc = counts(ngrams(ref, n));
            for (const [g, c] of rc) refMax.set(g, Math.max(refMax.get(g) || 0, c));
        }
        let match = 0;
        for (const [g, c] of hc) match += Math.min(c, refMax.get(g) || 0);
        // 加一平滑避免 log0
        const p = (match + 1) / (hg.length + 1);
        logp.push(Math.log(p));
    }
    const c = hyp.length;
    let r = Infinity;
    for (const ref of refs) if (Math.abs(ref.length - c) < Math.abs(r - c)) r = ref.length;
    const bp = c > r ? 1 : Math.exp(1 - r / c);
    return bp * Math.exp(mean(logp));
}

function loadCondition(condId: string): { perMsgLen: number[]; msgCounts: number[]; dialogues: string[][] } {
    const dir = join(SAMPLES_DIR, condId);
    const perMsgLen: number[] = [];
    const msgCounts: number[] = [];
    const dialogues: string[][] = []; // 每段對話的字元序列（全訊息串接）
    if (!existsSync(dir)) return { perMsgLen, msgCounts, dialogues };
    const files = readdirSync(dir).filter((f) => /^sample-\d+\.json$/.test(f)).sort();
    for (const f of files) {
        const graph = JSON.parse(readFileSync(join(dir, f), "utf8"));
        const turns = messagesToTurns(graph);
        msgCounts.push(turns.length);
        let allChars: string[] = [];
        for (const t of turns) {
            const cs = chars(t.text);
            perMsgLen.push(cs.length);
            allChars = allChars.concat(cs);
        }
        dialogues.push(allChars);
    }
    return { perMsgLen, msgCounts, dialogues };
}

function lexical(dialogues: string[][]) {
    // 逐段算 TTR / rootTTR / bigramTTR 後平均
    const ttr: number[] = [], root: number[] = [], big: number[] = [];
    for (const d of dialogues) {
        if (d.length === 0) continue;
        const uni = new Set(d).size;
        ttr.push(uni / d.length);
        root.push(uni / Math.sqrt(d.length));
        const bg = ngrams(d, 2);
        big.push(bg.length ? new Set(bg).size / bg.length : 0);
    }
    return { ttr: +mean(ttr).toFixed(4), rootTTR: +mean(root).toFixed(3), bigramTTR: +mean(big).toFixed(4) };
}

function selfBleu(dialogues: string[][]): number | null {
    if (dialogues.length < 2) return null;
    const scores: number[] = [];
    for (let i = 0; i < dialogues.length; i++) {
        const hyp = dialogues[i];
        const refs = dialogues.filter((_, j) => j !== i);
        scores.push(bleu(hyp, refs));
    }
    return +mean(scores).toFixed(4);
}

function summarize(perMsgLen: number[], msgCounts: number[], dialogues: string[][]) {
    const m = mean(perMsgLen), s = std(perMsgLen);
    return {
        nDialogues: dialogues.length,
        msgCountMean: +mean(msgCounts).toFixed(1),
        msgLenMean: +m.toFixed(1),
        msgLenStd: +s.toFixed(1),
        msgLenCV: m ? +(s / m).toFixed(3) : 0,
        lexical: lexical(dialogues),
        selfBLEU: selfBleu(dialogues),
    };
}

function main() {
    const summary: any = { timestamp: new Date().toISOString(), conditions: [], byMode: {} };
    const modeAgg: Record<string, { perMsgLen: number[]; msgCounts: number[]; dialogues: string[][] }> = {
        single: { perMsgLen: [], msgCounts: [], dialogues: [] },
        dual: { perMsgLen: [], msgCounts: [], dialogues: [] },
    };

    log(`多樣性指標 ${summary.timestamp}\n`);
    for (const cond of CONDITIONS) {
        const data = loadCondition(cond.id);
        if (data.dialogues.length === 0) { log(`略過 ${cond.label}：無樣本`); continue; }
        const stat = summarize(data.perMsgLen, data.msgCounts, data.dialogues);
        summary.conditions.push({ id: cond.id, label: cond.label, mode: cond.mode, intent: cond.intent, ...stat });
        const agg = modeAgg[cond.mode];
        agg.perMsgLen.push(...data.perMsgLen);
        agg.msgCounts.push(...data.msgCounts);
        agg.dialogues.push(...data.dialogues);
        log(`${cond.label}：n=${stat.nDialogues} 訊息數~${stat.msgCountMean} 長度 ${stat.msgLenMean}±${stat.msgLenStd}(CV ${stat.msgLenCV}) rootTTR ${stat.lexical.rootTTR} selfBLEU ${stat.selfBLEU}`);
    }

    // byMode：各條件指標等權平均（避免 pooling 與 self-BLEU 參考量不對等造成的偏誤）
    const avg = (xs: number[]) => (xs.length ? +(xs.reduce((s, x) => s + x, 0) / xs.length).toFixed(4) : null);
    for (const mode of ["single", "dual"]) {
        const cs = summary.conditions.filter((c: any) => c.mode === mode);
        if (!cs.length) continue;
        const sb = cs.map((c: any) => c.selfBLEU).filter((x: any) => x != null) as number[];
        summary.byMode[mode] = {
            nConditions: cs.length,
            nDialogues: cs.reduce((s: number, c: any) => s + c.nDialogues, 0),
            msgLenMean: +(avg(cs.map((c: any) => c.msgLenMean)) ?? 0).toFixed(1),
            msgLenCV: avg(cs.map((c: any) => c.msgLenCV)),
            rootTTR: avg(cs.map((c: any) => c.lexical.rootTTR)),
            bigramTTR: avg(cs.map((c: any) => c.lexical.bigramTTR)),
            selfBLEU_condAvg: avg(sb),
        };
    }
    summary.notes = {
        selfBLEU: "byMode 的 selfBLEU 為各條件內 5 篇互比後再逐條件平均，避免不同樣本數造成的參考量偏誤；mode 直接 pool（20 vs 10）會機械性抬高樣本多的一組，不可用。",
        lexical: "rootTTR/bigramTTR 受訊息長度影響；單 AI 每則約 30 字、雙 AI 約 140 字（差約 5 倍），故跨模式的詞彙多樣性比較不可靠，只在同模式內參考。",
        length: "訊息長度由 prompt 設計影響：單 AI 要求短碎 Teams 口語、雙 AI 每回合各寫完整一則，故長度差異含 prompt 設計成分，非純模式效應。",
    };

    log(`\n===== 單/雙 模式彙整（各條件等權平均）=====`);
    for (const mode of ["single", "dual"]) {
        const s = summary.byMode[mode];
        if (!s) continue;
        log(`${mode}：${s.nConditions} 條件/${s.nDialogues} 篇｜每則長度~${s.msgLenMean}字 長度CV ${s.msgLenCV}｜rootTTR ${s.rootTTR}(長度混淆) selfBLEU ${s.selfBLEU_condAvg}`);
    }
    writeJson(join(OUT_DIR, "metrics_summary.json"), summary);
    log(`\nmetrics_summary：${join(OUT_DIR, "metrics_summary.json")}`);
}

main();
