// experiment/_smoke.ts
// 最小 headless 驗證：import 真正的 DialogueEngine + 服務，跑 1 段 2 回合的雙 AI 對話，
// 確認 (1) tsx 能 import .ts 模組與 SDK，(2) 服務在 Node 下可跑，(3) 產出 Graph。
// 執行：npx --yes tsx experiment/_smoke.ts

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { runDialogue, type GenerationService } from "../src/core/DialogueEngine";
import { OpenAIService } from "../src/core/OpenAIService";
import { AnthropicService } from "../src/core/AnthropicService";
import type { ModelKey, SimulationParameters } from "../src/core/types";

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnv() {
    const env: Record<string, string> = { ...process.env } as Record<string, string>;
    const p = join(__dirname, "..", "pilot", ".env.local");
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

async function main() {
    const env = loadEnv();
    if (!env.OPENAI_API_KEY || !env.ANTHROPIC_API_KEY) {
        console.error("缺金鑰，無法跑 smoke");
        process.exit(1);
    }

    const services: Record<ModelKey, GenerationService> = {
        gpt: new OpenAIService(env.OPENAI_API_KEY),
        gemini: new OpenAIService(env.OPENAI_API_KEY), // smoke 不用 gemini，佔位
        claude: new AnthropicService(env.ANTHROPIC_API_KEY),
    };

    const parameters: SimulationParameters = {
        preset: "Preset 3 流程混亂 連結釣魚",
        authority: 1,
        urgency: 2,
        load: 1,
        minMessages: 20,
        maxMessages: 30,
        timeSpan: "T+0 (即時密集)",
        intents: ["malicious"],
    };

    console.log("smoke: 跑 GPT 攻 × Claude 守, malicious, 2 回合 ...");
    const result = await runDialogue({
        parameters,
        config: { attacker: "gpt", victim: "claude", rounds: 2, intent: "malicious" },
        services,
        onProgress: () => {},
    });

    console.log("graphMessages 數量:", result.graphMessages.length);
    console.log("GT:", result.groundTruth, "| aborted:", result.trace.aborted);
    console.log("第一則:", result.graphMessages[0]?.from.user.displayName, "->", result.graphMessages[0]?.body.content.slice(0, 60));
    console.log("smoke OK");
}

main().catch((e) => {
    console.error("smoke 失敗:", e?.message || e);
    process.exit(1);
});
