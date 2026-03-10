import chalk from 'chalk';
import * as readline from 'readline/promises';
import crypto from 'crypto';
import { streamResponse, fetchStream } from './stream.js';
import { logger } from '@noob-cli/core';

export async function runOneShot(
    prompt: string,
    systemPrompt?: string,
    provider?: string,
    model?: string,
    contextPatterns?: string[]
): Promise<void> {
    console.log(chalk.dim('\n─'.repeat(30)));
    console.log(`${chalk.bold('USER')} ${chalk.dim('›')} ${prompt}`);
    console.log(chalk.dim('─'.repeat(30)));

    logger.info(`Running one-shot command: "${prompt}"`);

    try {
        await streamResponse(fetchStream('/api/chat/stream', {
            prompt,
            systemPrompt,
            provider,
            model,
            contextPatterns,
            cwd: process.cwd(),
            sessionId: crypto.randomUUID()
        }));
        logger.success('One-shot command completed successfully.');
    } catch (err: any) {
        console.error(chalk.red(`\nError: ${err.message || err}`));
        logger.error('Failed during one-shot execution', err);
    }
}

export async function startInteractiveSession(
    systemPrompt?: string,
    provider?: string,
    model?: string,
    contextPatterns?: string[]
): Promise<void> {
    console.log(chalk.dim('─'.repeat(50)));
    console.log(
        `${chalk.bold.blue('SESSION')} ${chalk.dim('›')} ` +
        `${chalk.cyan(process.cwd())} ${chalk.dim('›')} ` +
        `${chalk.greenBright('ACTIVE')}`
    );
    console.log(chalk.dim('Type "exit" to terminate\n'));

    logger.info(`--- NEW INTERACTIVE SESSION STARTED | Provider: ${provider} | Model: ${model} ---`);

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        terminal: true,
        historySize: 100,
    });

    const sessionId = crypto.randomUUID();
    let isFirstTurn = true;
    let isActive = true;

    rl.on('SIGINT', () => {
        isActive = false;
        rl.close();
        console.log(chalk.dim('\nSession aborted.'));
        process.exit(0);
    });

    while (isActive) {
        try {
            const input = await rl.question(chalk.cyan('? '));
            const trimmed = input.trim();

            if (/^(exit|quit)$/i.test(trimmed)) {
                isActive = false;
                console.log(chalk.dim('\nTerminating session...'));
                rl.close();
                break;
            }

            if (!trimmed) continue;

            logger.info(`User Input: "${trimmed}"`);

            const sysPromptToPass = isFirstTurn ? systemPrompt : undefined;
            const ctxPatternsToPass = isFirstTurn ? contextPatterns : undefined;
            isFirstTurn = false;

            await streamResponse(fetchStream('/api/chat/stream', {
                prompt: trimmed,
                systemPrompt: sysPromptToPass,
                provider,
                model,
                contextPatterns: ctxPatternsToPass,
                cwd: process.cwd(),
                sessionId
            }));
        } catch (err: any) {
            if (isActive) {
                console.error(chalk.red(`\n[Session Error]: ${err.message || err}\n`));
                logger.error(`Error occurred during session turn`, err);
            }
        }
    }

    process.exit(0);
}