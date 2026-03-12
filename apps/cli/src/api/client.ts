import WebSocket from 'ws';
import chalk from 'chalk';
import { start } from '@noob-cli/core';
import { StreamChunk } from '@noob-cli/core';

export async function ensureServer() {
    for (let i = 0; i < 5; i++) {
        try {
            const res = await fetch('http://127.0.0.1:4000/health');
            if (res.ok) return;
        } catch {
            if (i === 0) {
                console.log(chalk.yellow('Core server not running. Starting...'));
                start();
            }
            await new Promise(resolve => setTimeout(resolve, 200 * (i + 1)));
        }
    }
}

export type WSMessageChunk = StreamChunk & { message?: string; done?: boolean; isFinished?: boolean };

export interface ServerEvents {
    onMessage: (chunk: WSMessageChunk) => void;
    onError: (err: Error) => void;
    onClose: () => void;
    onOpen?: () => void;
}

export function createClient(events: ServerEvents) {
    const ws = new WebSocket('ws://127.0.0.1:4000/api/chat/ws');

    ws.on('open', () => {
        if (events.onOpen) events.onOpen();
    });

    ws.on('message', (data) => {
        try {
            const chunk: WSMessageChunk = JSON.parse(data.toString());
            events.onMessage(chunk);
        } catch (e) {
            // Ignore parse errors from raw messages
        }
    });

    ws.on('error', events.onError);
    ws.on('close', events.onClose);

    return {
        send: (payload: any) => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify(payload));
            }
        },
        close: () => {
            ws.close();
        }
    };
}
