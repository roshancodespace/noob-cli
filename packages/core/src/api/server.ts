import Fastify from 'fastify';
import fastifyWebsocket from '@fastify/websocket';

import { askHandler } from './handlers/ask.js';
import { wsHandler } from './handlers/ws.js';

const fastify = Fastify({ logger: false });
fastify.register(fastifyWebsocket);

fastify.get('/health', async () => {
    return { status: 'ok' };
});

fastify.post('/api/chat/ask', askHandler);

fastify.register(async (fastify) => {
    fastify.get('/api/chat/ws', { websocket: true }, wsHandler);
});

/**
 * Initializes and starts the Fastify server on port 4000.
 * Fails gracefully if the port is already in use (useful for client application auto-start mechanisms).
 */
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