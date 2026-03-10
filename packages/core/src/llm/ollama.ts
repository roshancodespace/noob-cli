import { generateText, ModelMessage, stepCountIs, streamText, ToolSet } from "ai";
import { createOpenAI } from "@ai-sdk/openai";

import {
    LLMProvider,
    LLMOptions,
    LLMError,
    StreamChunk,
} from "./types.js";

export class OllamaProvider implements LLMProvider {
    private readonly model: string;
    private readonly ollama;

    constructor(options: LLMOptions) {
        this.model = options.model;

        const baseURL =
            process.env.OLLAMA_BASE_URL || "http://localhost:11434/v1";

        this.ollama = createOpenAI({
            baseURL,
            apiKey: "ollama",
        });
    }

    async generate(messages: ModelMessage[], tools?: ToolSet): Promise<string> {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 60000);

        try {
            const result = await generateText({
                model: this.ollama.chat(this.model),
                messages: messages,
                tools: tools,
                temperature: 0.7,
                abortSignal: controller.signal,
                stopWhen: stepCountIs(5),
            });

            return result.text || "";
        } catch (err: any) {
            if (err.name === "AbortError") {
                throw new LLMError(
                    "Ollama timeout",
                    "Request timed out after 60 seconds."
                );
            }

            throw new LLMError("Ollama error", err.message || "Unknown error");
        } finally {
            clearTimeout(timeout);
        }
    }

    async *generateStream(
        messages: ModelMessage[],
        tools?: ToolSet
    ): AsyncIterable<StreamChunk> {
        try {
            const result = streamText({
                model: this.ollama.chat(this.model),
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
                        result: part.output
                    }
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
        } catch (err: any) {
            throw new LLMError(
                "Ollama stream error",
                err.message || "Unknown error"
            );
        }
    }
}