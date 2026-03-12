import { logger } from '../utils/logger.js';
import { LLMProvider, StreamChunk } from '../llm/types.js';
import { AGENT_SYSTEM_INSTRUCTIONS } from '../data/instructions.js';
import { TOOLS } from '../tools/tools.js';
import type { ModelMessage } from 'ai';

export class Agent {
    private messages: ModelMessage[] = [];

    constructor(private readonly llm: LLMProvider) {
        logger.debug('Agent instantiated with LLM provider.');
    }

    /** One-shot question — no conversation history. */
    async ask(input: string, systemPrompt?: string): Promise<string> {
        logger.info(`Executing one-shot prompt. Input length: ${input.length} chars`);

        const messages: ModelMessage[] = [
            { role: 'system', content: systemPrompt || 'You are a helpful terminal AI assistant.' },
            { role: 'user', content: input },
        ];

        const response = await this.llm.generate(messages, TOOLS);
        logger.success('One-shot response generated successfully.');
        return response;
    }

    /**
     * Streaming question with full conversation history.
     * systemPrompt is used only on the very first call to initialize the conversation.
     * chatOnly skips tools for lightweight conversational use (e.g. buddy mode).
     */
    async *askStream(input?: string, systemPrompt?: string, chatOnly = false): AsyncIterable<StreamChunk> {
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

        const tools = chatOnly ? undefined : TOOLS;

        for await (const chunk of this.llm.generateStream(this.messages, tools)) {
            if (chunk.type === 'history_update') {
                this.messages = chunk.newMessages;
            } else {
                yield chunk;
            }
        }
    }
}