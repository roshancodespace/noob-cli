import { OpenAILanguageModelResponsesOptions, createOpenAI } from "@ai-sdk/openai";
import { LanguageModel, stepCountIs } from "ai";
import { LLMOptions } from "./types.js";
import { BaseProvider } from "./base.js";

export class LlamaProvider extends BaseProvider {
    private readonly modelInstance: LanguageModel;

    constructor(options: LLMOptions) {
        super();
        const baseURL = process.env.LLAMA_BASE_URL || 'http://localhost:8080';
        const openai = createOpenAI({
            baseURL,
            apiKey: process.env.LLAMA_API_KEY || 'default',
        });
        
        this.modelInstance = openai.chat(options.model);
    }

    protected getModel(): LanguageModel {
        return this.modelInstance;
    }

    protected getOptions(): any {
        return {
            temperature: 0.7,
            stopWhen: stepCountIs(5),
            providerOptions: {
                openai: {
                    parallelToolCalls: true,
                } satisfies OpenAILanguageModelResponsesOptions
            }
        };
    }
}