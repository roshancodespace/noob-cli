import { logger } from '../utils/logger.js';
import { LLMProvider, StreamChunk } from '../llm/types.js';
import { AGENT_SYSTEM_INSTRUCTIONS } from '../data/instructions.js';
import { createTools } from '../tools/tools.js';
import { type Tool, type ModelMessage } from 'ai';

/**
 * Orchestrates LLM interactions, managing conversation history and tools.
 */
export class Agent {
    /** Session conversation history. */
    private messages: ModelMessage[] = [];

    /**
     * @param llm - The initialized LLM provider.
     */
    constructor(private readonly llm: LLMProvider) {
        logger.debug('Agent instantiated with LLM provider.');
    }

    /**
     * Executes a stateless, one-shot prompt without retaining history.
     * * @param input - The user's prompt.
     * @param systemPrompt - Optional system instructions.
     * @param customTools - Optional custom tools to override the global registry.
     */
    async ask(input: string, systemPrompt?: string, customTools?: Record<string, Tool>): Promise<string> {
        logger.info(`Executing one-shot prompt. Input length: ${input.length} chars`);

        const messages: ModelMessage[] = [
            { role: 'system', content: systemPrompt || 'You are a helpful AI assistant.' },
            { role: 'user', content: input },
        ];

        const response = await this.llm.generate(messages, customTools || createTools());
        logger.success('One-shot response generated successfully.');
        return response;
    }

    /**
     * Executes a stateful, streaming prompt, maintaining conversation history.
     * * @param input - The user's prompt.
     * @param systemPrompt - Optional system instructions (applied only on the first call).
     * @param options.chatOnly - If true, disables tools for a text-only response.
     * @param options.customTools - Optional custom tools to override the global registry.
     */
    async *askStream(input?: string, systemPrompt?: string, options?: { chatOnly?: boolean, customTools?: Record<string, Tool> }): AsyncIterable<StreamChunk> {
        if (this.messages.length === 0) {
            logger.info('Initializing new interactive streaming session.');
            this.messages.push({
                role: 'system',
                content: systemPrompt || AGENT_SYSTEM_INSTRUCTIONS
            });
        }

        if (input) {
            logger.debug(`Adding user input to history: ${input.substring(0, 50)}...`);
            this.messages.push({ role: 'user', content: input });
        }

        const tools = options?.chatOnly ? undefined : (options?.customTools || createTools());

        for await (const chunk of this.llm.generateStream(this.messages, tools)) {
            if (chunk.type === 'history_update') {
                this.messages = chunk.newMessages;
            } else {
                yield chunk;
            }
        }
    }
}