import Anthropic from "@anthropic-ai/sdk";

// Claude Haiku 4.5（claude-haiku-4-5-20251001）。
// 擴展思考用 thinking:{type:"enabled",budget_tokens:N}（Haiku 4.5 支援手動擴展思考、
// 不可用 adaptive/effort）。開思考時不可設 temperature（固定預設 1）。
// 串流只取 text delta（stream.on("text") 不會帶 thinking），可見輸出就是訊息本體。
export class AnthropicService {
    private client: Anthropic | null = null;

    constructor(apiKey?: string) {
        if (apiKey) {
            this.setApiKey(apiKey);
        }
    }

    public setApiKey(apiKey: string) {
        this.client = new Anthropic({
            apiKey: apiKey,
            dangerouslyAllowBrowser: true, // 瀏覽器端使用所需
        });
    }

    public async generateStream(
        systemPrompt: string,
        onChunk: (chunk: string) => void,
        userContent: string = "Start simulation."
    ): Promise<string> {
        if (!this.client) {
            throw new Error("API Key not set");
        }

        try {
            console.log("[Anthropic] Starting generation with claude-haiku-4-5 (budget_tokens thinking)...");
            let fullText = "";

            const stream = this.client.messages.stream({
                model: "claude-haiku-4-5-20251001",
                max_tokens: 8192,
                thinking: { type: "enabled", budget_tokens: 2048 },
                system: systemPrompt,
                messages: [{ role: "user", content: userContent }],
            });

            // 只接 text delta（思考內容不進可見輸出）
            stream.on("text", (delta) => {
                if (delta) {
                    fullText += delta;
                    onChunk(delta);
                }
            });

            await stream.finalMessage();
            console.log("[Anthropic] Generation complete. Total length:", fullText.length);
            return fullText;
        } catch (error) {
            console.error("[Anthropic] API Error:", error);
            throw error;
        }
    }
}
