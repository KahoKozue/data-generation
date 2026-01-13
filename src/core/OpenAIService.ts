
import OpenAI from "openai";

export class OpenAIService {
    private client: OpenAI | null = null;

    constructor(apiKey?: string) {
        if (apiKey) {
            this.setApiKey(apiKey);
        }
    }

    public setApiKey(apiKey: string) {
        this.client = new OpenAI({
            apiKey: apiKey,
            dangerouslyAllowBrowser: true, // Required for client-side usage
        });
    }

    public async generateStream(
        systemPrompt: string,
        onChunk: (chunk: string) => void
    ): Promise<string> {
        if (!this.client) {
            throw new Error("API Key not set");
        }

        try {
            console.log("[OpenAI] Starting generation with gpt5.1 using chat.completions API...");

            // Fallback: Use standard chat.completions API with gpt5.1 model
            const stream = await this.client.chat.completions.create({
                model: "gpt-5.1",
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: "Start simulation." }
                ],
                stream: true,
                max_completion_tokens: 128000
            });

            console.log("[OpenAI] Stream created, reading chunks...");
            let fullText = "";

            for await (const chunk of stream) {
                const content = chunk.choices[0]?.delta?.content || "";
                if (content) {
                    console.log("[OpenAI] Chunk received, length:", content.length);
                    fullText += content;
                    onChunk(content);
                }
            }

            console.log("[OpenAI] Generation complete. Total length:", fullText.length);
            return fullText;

        } catch (error) {
            console.error("[OpenAI] API Error:", error);
            throw error;
        }
    }
}
