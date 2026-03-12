import { FastifyRequest, FastifyReply } from 'fastify';
import { Agent } from '../../agent/index.js';
import { createProvider } from '../../llm/factory.js';
import { config } from '../../config/index.js';

/**
 * API handler for one-shot AI queries.
 * Processes a single prompt with optional file context and returns the response.
 */
export async function askHandler(request: FastifyRequest, reply: FastifyReply) {
    const { prompt, systemPrompt, provider, model, apiKey, cwd } = request.body as any;

    // Update working directory if provided
    if (cwd) process.chdir(cwd);

    // Setup LLM config, falling back to server defaults
    const prov = provider || config.llm.provider;
    const mod = model || config.llm.model;
    const key = apiKey || config.llm.apiKey;

    const agent = new Agent(createProvider({ provider: prov, apiKey: key, model: mod }));

    const response = await agent.ask(prompt, systemPrompt);
    return { response };
}