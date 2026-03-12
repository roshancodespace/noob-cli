import { createGroq } from "@ai-sdk/groq";
import { LanguageModel } from "ai";
import { LLMOptions, LLMError } from "./types.js";
import { BaseProvider } from "./base.js";

export class GroqProvider extends BaseProvider {
    private readonly modelInstance: LanguageModel;

    constructor(options: LLMOptions) {
        super();
        if (!options.apiKey) {
            throw new LLMError("Groq config error", "Missing Groq API key");
        }

        const groq = createGroq({ apiKey: options.apiKey });
        this.modelInstance = groq(options.model);
    }

    protected getModel(): LanguageModel {
        return this.modelInstance;
    }
}