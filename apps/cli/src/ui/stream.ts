import chalk from 'chalk';
import ora from 'ora';
import type { StreamChunk } from '@noob-cli/core';

export async function* fetchStream(
    endpoint: string,
    payload: any
): AsyncIterable<StreamChunk> {
    const response = await fetch(`http://127.0.0.1:4000${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    if (!response.body) {
        throw new Error('No response body from server.');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');

        buffer = lines.pop() || '';

        for (const line of lines) {
            if (line.trim() === '') continue;
            try {
                yield JSON.parse(line) as StreamChunk;
            } catch (err) {
                console.error('Failed to parse NDJSON line:', line);
            }
        }
    }
}

export async function streamResponse(
    agentStream: AsyncIterable<StreamChunk>
): Promise<void> {
    const spinner = ora({
        text: chalk.dim('Agent thinking...'),
        color: 'blue'
    }).start();
    let fullContent = '';
    let hasStartedText = false;

    try {
        for await (const chunk of agentStream) {
            switch (chunk.type) {
                case 'content':
                    if (!hasStartedText) {
                        spinner.stop();
                        process.stdout.write(`\n`);
                        hasStartedText = true;
                    }
                    process.stdout.write(chunk.content);
                    fullContent += chunk.content;
                    break;

                case 'tool_start':
                    spinner.stop();
                    console.log(chalk.dim(`\n  ○ Running ${chunk.name}...`));
                    hasStartedText = false;
                    break;

                case 'tool_end':
                    spinner.start(chalk.dim('Processing...'));
                    break;
            }
        }
        spinner.stop();
    } catch (error: any) {
        spinner.stop();
        console.error(chalk.red(`\n! Error: ${error.message || error}`));
    } finally {
        if (spinner.isSpinning) spinner.stop();
        console.log('\n');
    }
}