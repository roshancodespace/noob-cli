import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { LanguageModel } from "ai";
import { LLMOptions } from "./types.js";
import { BaseProvider } from "./base.js";

export class GeminiProvider extends BaseProvider {
    private readonly modelInstance: LanguageModel;

    constructor(options: LLMOptions) {
        super();
        const google = createGoogleGenerativeAI({
            apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
        });
        
        this.modelInstance = google(options.model || 'gemini-2.5-flash');
    }

    protected getModel(): LanguageModel {
        return this.modelInstance;
    }
}