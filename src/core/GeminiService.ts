import { GoogleGenerativeAI } from "@google/generative-ai";

export class GeminiService {
    private genAI: GoogleGenerativeAI;
    private model: any;

    constructor(apiKey: string) {
        this.genAI = new GoogleGenerativeAI(apiKey);
        // Gemini 3.5 Flash：思考預設即 medium，Gemini 3.x 官方要求移除 temperature/top_p/top_k（此處不設）
        this.model = this.genAI.getGenerativeModel({ model: "gemini-3.5-flash" });
    }

    async generateStream(systemPrompt: string, onChunk: (chunk: string) => void, userContent: string = "Start simulation."): Promise<string> {
        try {
            const result = await this.model.generateContentStream({
                contents: [
                    { role: "user", parts: [{ text: systemPrompt + "\n\n" + userContent }] }
                ],
                generationConfig: {
                    maxOutputTokens: 65536,
                }
            });

            let fullText = "";
            for await (const chunk of result.stream) {
                const chunkText = chunk.text();
                fullText += chunkText;
                onChunk(chunkText);
            }
            return fullText;
        } catch (error) {
            console.error("Gemini API Error:", error);
            throw error;
        }
    }
}
