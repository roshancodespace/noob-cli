import { createOpenAI } from "@ai-sdk/openai";
import { LanguageModel } from "ai";
import { LLMOptions } from "./types.js";
import { BaseProvider } from "./base.js";

export class OllamaProvider extends BaseProvider {
    private readonly modelInstance: LanguageModel;

    constructor(options: LLMOptions) {
        super();
        const baseURL = process.env.OLLAMA_BASE_URL || "http://localhost:11434/v1";
        const ollama = createOpenAI({
            baseURL,
            apiKey: "ollama",
        });
        
        this.modelInstance = ollama.chat(options.model);
    }

    protected getModel(): LanguageModel {
        return this.modelInstance;
    }
}