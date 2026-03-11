import { generateText, ModelMessage, stepCountIs, streamText, ToolSet } from "ai";
import { createGroq } from "@ai-sdk/groq";

import {
    LLMProvider,
    LLMOptions,
    LLMError,
    StreamChunk,
} from "./types.js";

export class GroqProvider implements LLMProvider {
    private readonly model: string;
    private readonly groq;

    constructor(options: LLMOptions) {
        if (!options.apiKey) {
            throw new LLMError("Groq config error", "Missing Groq API key");
        }

        this.model = options.model;

        this.groq = createGroq({
            apiKey: options.apiKey,
        });
    }

    async generate(messages: ModelMessage[], tools?: ToolSet): Promise<string> {
        try {
            const result = await generateText({
                model: this.groq(this.model),
                messages: messages,
                tools: tools,
                temperature: 0.7,
                stopWhen: stepCountIs(5),
            });

            return result.text || "";
        } catch (err: any) {
            throw new LLMError("Groq error", err.message || "Unknown error");
        }
    }

    async *generateStream(
        messages: ModelMessage[],
        tools?: ToolSet
    ): AsyncIterable<StreamChunk> {
        try {
            const result = streamText({
                model: this.groq(this.model),
                messages: messages,
                tools: tools,
                temperature: 0.7,
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
                        type: "tool_result",
                        name: part.toolName,
                        result: part.output,
                    }
                }

                if (part.type === "reasoning-delta") {
                    yield {
                        type: "reasoning",
                        content: (part as any).text,
                    };
                }
            }

            const finalResponse = await result.response;
            yield {
                type: "history_update",
                newMessages: finalResponse.messages,
            };
        } catch (err: any) {
            throw new LLMError("Groq stream error", err.message || "Unknown error");
        }
    }
}