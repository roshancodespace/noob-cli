import { generateText, stepCountIs, streamText, ToolSet, LanguageModel, ModelMessage } from "ai";
import { LLMProvider, StreamChunk, LLMError } from "./types.js";

/**
 * Abstract base class for all LLM providers.
 * Centralizes the Vercel AI SDK generation and stream parsing logic.
 */
export abstract class BaseProvider implements LLMProvider {
    /** * Must be implemented by child classes to return the initialized Vercel AI SDK model. 
     */
    protected abstract getModel(): LanguageModel;

    /**
     * Optional override for provider-specific generation settings (like temperature).
     */
    protected getOptions(): any {
        return { temperature: 0.7, stopWhen: stepCountIs(5) };
    }

    /**
     * Executes a one-shot prompt.
     */
    async generate(messages: ModelMessage[], tools?: ToolSet): Promise<string> {
        try {
            const result = await generateText({
                model: this.getModel(),
                messages,
                tools,
                ...this.getOptions()
            });
            return result.text || "";
        } catch (err: any) {
            throw new LLMError("Provider Error", err.message || "Unknown error during generation");
        }
    }

    /**
     * Executes a streaming prompt and standardizes the output chunks.
     */
    async *generateStream(messages: ModelMessage[], tools?: ToolSet): AsyncIterable<StreamChunk> {
        try {
            const result = streamText({
                model: this.getModel(),
                messages,
                tools,
                ...this.getOptions()
            });

            for await (const part of result.fullStream) {
                if (part.type === "text-delta") {
                    yield { type: "content", content: part.text };
                } else if (part.type === "tool-call") {
                    yield { type: "tool_start", name: part.toolName, args: part.input ?? {} };
                } else if (part.type === "tool-result") {
                    yield { type: "tool_result", name: part.toolName, result: part.output };
                } else if (part.type === "reasoning-delta") {
                    yield { type: "reasoning", content: (part as any).text };
                }
            }

            const finalResponse = await result.response;
            yield { type: "history_update", newMessages: finalResponse.messages };
        } catch (err: any) {
            throw new LLMError("Provider Stream Error", err.message || "Unknown error during streaming");
        }
    }
}