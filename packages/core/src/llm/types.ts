import type { ModelMessage, ToolSet } from 'ai';

export interface ToolCall {
    id: string;
    type: 'function';
    function: {
        name: string;
        arguments: string; // JSON string
    };
}

export type StreamChunk =
    | { type: 'content'; content: string }
    | { type: 'tool_start'; name: string; args: any }
    | { type: 'tool_result'; name: string; result: any }
    | { type: 'history_update'; newMessages: ModelMessage[] };

export interface LLMOptions {
    apiKey: string;
    model: string;
}

export class LLMError extends Error {
    constructor(name: string = "LLMError", message: string) {
        super(message);
        this.name = name;
    }
}

export interface LLMProvider {
    generate(messages: ModelMessage[], tools?: ToolSet): Promise<string>;
    generateStream(messages: ModelMessage[], tools?: ToolSet): AsyncIterable<StreamChunk>;
}
