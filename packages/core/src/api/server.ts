import Fastify from 'fastify';
import fastifyWebsocket from '@fastify/websocket';
import { Agent } from '../agent/index.js';
import { createProvider } from '../llm/factory.js';
import { loadContext } from '../context/index.js';
import { config } from '../config/index.js';
import { withBuddyMode } from '../agent/index.js';

const fastify = Fastify({ logger: false });
fastify.register(fastifyWebsocket);

type AgentEntry = {
    agent: Agent;
    lastAccessed: number;
};
const agents = new Map<string, AgentEntry>();

const AGENT_TTL = 1000 * 60 * 60; // 1 hour
setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of agents.entries()) {
        if (now - entry.lastAccessed > AGENT_TTL) {
            agents.delete(key);
            console.log(`[GC] Cleaned up inactive agent session: ${key}`);
        }
    }
}, 1000 * 60 * 5).unref(); // Run every 5 minutes

function getOrCreateAgent(sessionId: string, providerName: string, model: string) {
    const existing = agents.get(sessionId);
    if (existing) {
        existing.lastAccessed = Date.now();
        return existing.agent;
    }

    const apiKey = (providerName === "groq" ? config.providers.groq.apiKey : config.providers.gemini.apiKey) || '';
    const provider = createProvider({
        provider: providerName,
        apiKey: apiKey,
        model: model,
    });

    const agent = new Agent(provider);
    agents.set(sessionId, { agent, lastAccessed: Date.now() });
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

fastify.register(async (fastify) => {
    fastify.get('/api/chat/ws', { websocket: true }, (connection, req) => {
        connection.on('message', async (msg) => {
            const data = JSON.parse(msg.toString());
            const { action, sessionId, prompt, systemPrompt, provider, model, contextPatterns, cwd, buddyMode } = data;

            if (cwd) process.chdir(cwd);

            const prov = provider || config.llm.provider;
            const mod = model || config.llm.model;

            if (action === 'main_task') {
                const agent = getOrCreateAgent(sessionId || 'default', prov, mod);
                let finalSysPrompt = systemPrompt;

                if (contextPatterns && contextPatterns.length > 0) {
                    try {
                        const ctx = await loadContext(contextPatterns, { provider: prov, model: mod });
                        finalSysPrompt = finalSysPrompt ? `${finalSysPrompt}\n\n${ctx.systemPrompt}` : ctx.systemPrompt;
                    } catch (err: any) {
                        connection.send(JSON.stringify({ type: 'server_error', message: err.message }));
                        return;
                    }
                }

                try {
                    let stream = agent.askStream(prompt, finalSysPrompt);

                    if (buddyMode) {
                        const buddyProvider = "gemini";
                        const buddyModel = "gemini-2.5-flash";
                        const buddyAgent = getOrCreateAgent(`${sessionId || 'default'}-buddy-internal`, buddyProvider, buddyModel);

                        stream = withBuddyMode(prompt, stream, buddyAgent);
                    }

                    for await (const chunk of stream) {
                        connection.send(JSON.stringify(chunk));
                    }
                    connection.send(JSON.stringify({ type: 'task_complete' }));
                } catch (err: any) {
                    const errorMsg = err.message || String(err);
                    console.error('[Stream Error]', errorMsg);
                    
                    if (errorMsg.includes('Failed to parse input') || errorMsg.includes('JSON')) {
                        connection.send(JSON.stringify({ 
                            type: 'server_error', 
                            message: `AI Model generated invalid format: ${errorMsg}`
                        }));
                    } else {
                        connection.send(JSON.stringify({ 
                            type: 'server_error', 
                            message: errorMsg 
                        }));
                    }
                }
            }

            if (action === 'buddy_chat') {
                const buddyProvider = "gemini";
                const buddyModel = "gemini-2.5-flash";
                const buddyAgent = getOrCreateAgent(`${sessionId || 'default'}-buddy`, buddyProvider, buddyModel);

                try {
                    const buddyStream = buddyAgent.askStream(
                        prompt,
                        "You are Buddy, the witty CLI sidekick. Give a quick, 1-sentence funny reply.",
                        true
                    );
                    for await (const chunk of buddyStream) {
                        if (chunk.type === 'content') {
                            connection.send(JSON.stringify({ type: 'buddy_content', content: chunk.content }));
                        }
                    }
                } catch (e) {
                }
            }
        });
    });
});

const start = async () => {
    try {
        await fastify.listen({ port: 4000, host: '127.0.0.1' });
    } catch (err: any) {
        if (err.code === 'EADDRINUSE') {
            return;
        }
        console.error(err);
        process.exit(1);
    }
};

export { start, fastify };