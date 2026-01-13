import { GoogleGenerativeAI } from "@google/generative-ai";

export class GeminiService {
    private genAI: GoogleGenerativeAI;
    private model: any;

    constructor(apiKey: string) {
        this.genAI = new GoogleGenerativeAI(apiKey);
        // Mapping user's "Gemini 3.0 Pro" request to the actual latest model
        this.model = this.genAI.getGenerativeModel({ model: "gemini-3-pro-preview" });
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
