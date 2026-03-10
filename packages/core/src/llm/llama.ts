import { generateText, ModelMessage, stepCountIs, streamText, ToolSet } from "ai";
import { createOpenAI, OpenAILanguageModelResponsesOptions } from "@ai-sdk/openai";
import { LLMOptions, LLMProvider, StreamChunk } from "./types.js";

export class LlamaProvider implements LLMProvider {
    private readonly model: string;
    private readonly openai;

    constructor(options: LLMOptions) {
        this.model = options.model;
        const baseURL = process.env.LLAMA_BASE_URL || 'http://localhost:8080';
        this.openai = createOpenAI({
            baseURL,
            apiKey: process.env.LLAMA_API_KEY || 'default',
        });
    }

    async generate(messages: ModelMessage[], tools?: ToolSet): Promise<string> {
        const result = await generateText({
            model: this.openai.chat(this.model),
            messages: messages,
            tools: tools,
            providerOptions: {
              openai: {
                parallelToolCalls: true,
              } satisfies OpenAILanguageModelResponsesOptions 
            },
            stopWhen: stepCountIs(5),
        });
        return result.text;
    }

    async *generateStream(messages: ModelMessage[], tools?: ToolSet): AsyncIterable<StreamChunk> {
        const result = streamText({
            model: this.openai.chat(this.model),
            messages: messages,
            tools: tools,
            stopWhen: stepCountIs(5),
        });

        for await (const part of result.fullStream) {
            if (part.type === "text-delta") {
                yield {
                    type: "content",
                    content: part.text,
                };
            }

            if (part.type === "tool-call") {
                yield {
                    type: "tool_start",
                    name: part.toolName,
                    args: part.input ?? {},
                };
            }

            if (part.type === "tool-result") {
                yield {
                    type: "tool_end",
                    name: part.toolName,
                };
            }

            if (part.type === "reasoning-delta") {
                yield {
                    type: "content",
                    content: (part as any).text,
                };
            }
        }

        const finalResponse = await result.response;
        yield {
            type: "history_update",
            newMessages: finalResponse.messages,
        };
    }
}