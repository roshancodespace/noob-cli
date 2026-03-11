import { generateText, stepCountIs, streamText, ToolSet } from "ai";
import { createGoogleGenerativeAI, google } from "@ai-sdk/google";
import { LLMOptions, LLMProvider, StreamChunk } from "./types.js";

export class GeminiProvider implements LLMProvider {
    private readonly model: string;
    private readonly google;

    constructor(options: LLMOptions) {
        this.model = options.model || 'gemini-2.5-flash';
        this.google = createGoogleGenerativeAI({
            apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
        });
    }

    async generate(messages: any[], tools?: ToolSet): Promise<string> {
        const result = await generateText({
            model: this.google(this.model),
            messages,
            tools,
            stopWhen: stepCountIs(5),
        });
        return result.text;
    }

    async *generateStream(messages: any[], tools?: ToolSet): AsyncIterable<StreamChunk> {
        const result = streamText({
            model: this.google(this.model),
            messages,
            tools,
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
    }
}