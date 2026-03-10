import Fastify from 'fastify';
import { Agent } from './agent.js';
import { createProvider } from './llm/factory.js';
import { loadContext } from './context/index.js';
import { config } from './config.js';

const fastify = Fastify({ logger: false });

const agents = new Map<string, Agent>();

function getOrCreateAgent(sessionId: string, providerName: string, model: string, apiKey: string) {
    if (agents.has(sessionId)) {
        return agents.get(sessionId)!;
    }
    const provider = createProvider({
        provider: providerName,
        apiKey: apiKey,
        model: model,
    });
    const agent = new Agent(provider);
    agents.set(sessionId, agent);
    return agent;
}

fastify.get('/health', async () => {
    return { status: 'ok' };
});

fastify.post('/api/chat/ask', async (request, reply) => {
    const { prompt, systemPrompt, provider, model, apiKey, contextPatterns, cwd } = request.body as any;

    if (cwd) process.chdir(cwd);

    const prov = provider || config.llm.provider;
    const mod = model || config.llm.model;
    const key = apiKey || config.llm.apiKey;

    const agent = new Agent(createProvider({ provider: prov, apiKey: key, model: mod }));

    let finalSysPrompt = systemPrompt;
    if (contextPatterns && contextPatterns.length > 0) {
        const { systemPrompt: loadedSysPrompt } = await loadContext(contextPatterns, { provider: prov, model: mod });
        finalSysPrompt = finalSysPrompt ? `${finalSysPrompt}\n\n${loadedSysPrompt}` : loadedSysPrompt;
    }

    const response = await agent.ask(prompt, finalSysPrompt);
    return { response };
});

fastify.post('/api/chat/stream', async (request, reply) => {
    const { sessionId, prompt, systemPrompt, provider, model, apiKey, contextPatterns, cwd } = request.body as any;

    if (cwd) process.chdir(cwd);

    const prov = provider || config.llm.provider;
    const mod = model || config.llm.model;
    const key = apiKey || config.llm.apiKey;

    const agent = getOrCreateAgent(sessionId || 'default', prov, mod, key);

    let finalSysPrompt = systemPrompt;
    if (contextPatterns && contextPatterns.length > 0) {
        const ctx = await loadContext(contextPatterns, { provider: prov, model: mod });
        finalSysPrompt = finalSysPrompt ? `${finalSysPrompt}\n\n${ctx.systemPrompt}` : ctx.systemPrompt;
    }

    reply.raw.setHeader('Content-Type', 'application/x-ndjson');
    reply.raw.setHeader('Transfer-Encoding', 'chunked');

    try {
        const stream = agent.askStream(prompt, finalSysPrompt);
        for await (const chunk of stream) {
            reply.raw.write(JSON.stringify(chunk) + '\n');
        }
        reply.raw.end();
    } catch (err: any) {
        if (reply.raw.headersSent) {
            reply.raw.write(JSON.stringify({ type: 'server_error', message: err.message, code: 500 }) + '\n');
            reply.raw.end();
        } else {
            return reply.code(500).send({ type: 'server_error', message: err.message, code: 500 });
        }
    }
    return reply
});

const start = async () => {
    try {
        await fastify.listen({ port: 4000, host: '127.0.0.1' });
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

export { start, fastify };
