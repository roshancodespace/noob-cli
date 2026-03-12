import { Agent } from '../agent/index.js';
import { createProvider } from '../llm/factory.js';
import { config } from '../config/index.js';

/**
 * Active AI agent session.
 */
type AgentEntry = {
    /** Agent instance. */
    agent: Agent;
    /** Last interaction timestamp. */
    lastAccessed: number;
};

/** Active sessions map. */
const agents = new Map<string, AgentEntry>();

const AGENT_TTL = 1000 * 60 * 60; // 1 hour

/**
 * Cleans up inactive agent sessions every 5 minutes.
 */
setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of agents.entries()) {
        if (now - entry.lastAccessed > AGENT_TTL) {
            agents.delete(key);
            console.log(`[GC] Cleaned up inactive agent session: ${key}`);
        }
    }
}, 1000 * 60 * 5).unref();

/**
 * Retrieves or creates an agent session to maintain conversation history.
 * * @param sessionId - Unique session ID.
 * @param providerName - LLM provider (e.g., 'groq', 'gemini').
 * @param model - Model name.
 */
export function getOrCreateAgent(sessionId: string, providerName: string, model: string) {
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