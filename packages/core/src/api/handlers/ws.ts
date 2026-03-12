import { FastifyRequest } from 'fastify';
import { WebSocket } from '@fastify/websocket';
import { Tool } from 'ai';
import { z } from 'zod';
import { loadContext } from '../../context/index.js';
import { config } from '../../config/index.js';
import { withBuddyMode } from '../../agent/index.js';
import { getOrCreateAgent } from '../agentManager.js';

/**
 * WebSocket handler for real-time AI sessions.
 * Routes messages to either the main technical agent or the conversational Buddy.
 */
export async function wsHandler(connection: WebSocket, req: FastifyRequest) {
    connection.on('message', async (msg: Buffer) => {
        const data = JSON.parse(msg.toString());
        const { action, sessionId, prompt, systemPrompt, provider, model, contextPatterns, cwd, buddyMode } = data;

        // Update working directory if provided
        if (cwd) process.chdir(cwd);

        // Setup LLM config, falling back to server defaults
        const prov = provider || config.llm.provider;
        const mod = model || config.llm.model;

        // Route: Main technical task
        if (action === 'main_task') {
            const agent = getOrCreateAgent(sessionId || 'default', prov, mod);
            let finalSysPrompt = systemPrompt;

            // Append loaded file context to the system prompt
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

                // Wrap stream in Buddy Mode if enabled
                if (buddyMode) {
                    const buddyProvider = "gemini";
                    const buddyModel = "gemini-2.5-flash";
                    const buddyAgent = getOrCreateAgent(`${sessionId || 'default'}-buddy-internal`, buddyProvider, buddyModel);

                    stream = withBuddyMode(prompt, stream, buddyAgent);
                }

                // Stream chunks to client
                for await (const chunk of stream) {
                    connection.send(JSON.stringify(chunk));
                }
                connection.send(JSON.stringify({ type: 'task_complete', source: 'main' }));
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

        // Route: Direct Buddy chat
        if (action === 'buddy_chat') {
            const buddyProvider = "gemini";
            const buddyModel = "gemini-2.5-flash";
            const buddyAgent = getOrCreateAgent(`${sessionId || 'default'}-buddy`, buddyProvider, buddyModel);

            try {
                const mainAgent = getOrCreateAgent(sessionId || 'default', prov, mod);

                // Custom tool: Allows Buddy to query the main technical agent
                const ask_main_agent: Tool = {
                    description: 'Ask the main technical AI agent a question about the project or to perform a system action.',
                    inputSchema: z.object({
                        question: z.string().describe('The prompt to ask the main agent.')
                    }),
                    execute: async ({ question }) => {
                        return await mainAgent.ask(question);
                    }
                };

                const buddyStream = buddyAgent.askStream(
                    prompt,
                    "You are Buddy, the witty CLI sidekick. Give a quick, 1-2 sentence funny reply. You have a tool called 'ask_main_agent' that you can use to ask the main AI agent to do things or answer questions for you.",
                    { customTools: { ask_main_agent } }
                );

                // Stream Buddy responses to client
                for await (const chunk of buddyStream) {
                    if (chunk.type === 'content') {
                        connection.send(JSON.stringify({ type: 'buddy_content', content: chunk.content }));
                    } else if (chunk.type === 'tool_start') {
                        connection.send(JSON.stringify({ type: 'tool_start', name: chunk.name, args: chunk.args }));
                    } else if (chunk.type === 'tool_result') {
                        connection.send(JSON.stringify({ type: 'tool_result', name: chunk.name, result: chunk.result }));
                    } else if (chunk.type === 'reasoning') {
                        connection.send(JSON.stringify({ type: 'reasoning', content: chunk.content }));
                    }
                }
                connection.send(JSON.stringify({ type: 'task_complete', source: 'buddy' }));
            } catch (e) {
                console.error('[Buddy Error]', e);
            }
        }
    });
}