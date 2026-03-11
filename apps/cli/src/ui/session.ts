import chalk from 'chalk';
import * as readline from 'readline';
import crypto from 'crypto';
import WebSocket from 'ws';
import ora from 'ora';
import { logger, StreamChunk } from '@noob-cli/core';

const PFX_USER = `${chalk.bold.cyan('◆ User ')} ${chalk.dim('│')} `;
const PFX_AGENT = `${chalk.bold.blue('◇ Agent')} ${chalk.dim('│')} `;
const PFX_BUDDY = `${chalk.bold.magenta('✦ Buddy')} ${chalk.dim('│')} `;

export async function runOneShot(
    prompt: string,
    systemPrompt?: string,
    provider?: string,
    model?: string,
    contextPatterns?: string[]
): Promise<void> {
    console.log(chalk.dim('\n' + '━'.repeat(50)));
    console.log(`${PFX_USER}${prompt}`);
    console.log(chalk.dim('━'.repeat(50) + '\n'));

    logger.info(`Running one-shot command: "${prompt}"`);

    return new Promise((resolve) => {
        const ws = new WebSocket('ws://127.0.0.1:4000/api/chat/ws');
        const spinner = ora({ text: chalk.dim('Agent thinking...'), color: 'blue' });

        let isGen = false;
        let isBuddyGen = false;

        const stopSpinner = () => { if (spinner.isSpinning) spinner.stop(); };
        const clearBuddy = () => { if (isBuddyGen) { console.log(); isBuddyGen = false; } };
        const close = () => { stopSpinner(); ws.close(); resolve(); };

        ws.on('open', () => {
            spinner.start();
            ws.send(JSON.stringify({
                action: 'main_task', prompt, systemPrompt, provider, model, contextPatterns,
                cwd: process.cwd(), sessionId: crypto.randomUUID()
            }));
        });

        ws.on('message', (data) => {
            try {
                const chunk: StreamChunk & { message?: string } = JSON.parse(data.toString());

                switch (chunk.type) {
                    case 'content':
                        clearBuddy();
                        if (!isGen) {
                            stopSpinner();
                            process.stdout.write(`\r\x1b[K${PFX_AGENT}`);
                            isGen = true;
                        }
                        process.stdout.write(chalk.blue(chunk.content));
                        break;
                    case 'buddy_content':
                        if (!isBuddyGen) {
                            if (isGen) { console.log(); isGen = false; }
                            stopSpinner();
                            process.stdout.write(`\n${PFX_BUDDY}`);
                            isBuddyGen = true;
                        }
                        process.stdout.write(chalk.magenta(chunk.content));
                        if (chunk.content.endsWith('\n')) isBuddyGen = false;
                        break;
                    case 'tool_start':
                        clearBuddy();
                        stopSpinner();
                        console.log(chalk.blue(`\n  ○ Running ${chalk.bold(chunk.name)}...`));
                        isGen = false;
                        break;
                    case 'tool_result':
                        clearBuddy();
                        console.log(chalk.green(`  ✓ ${chunk.name} completed.`));
                        spinner.start(chalk.dim('Analyzing result...'));
                        isGen = false;
                        break;
                    case 'reasoning':
                        if (!spinner.isSpinning) spinner.start();
                        spinner.text = chalk.dim('Agent is reasoning...');
                        break;
                    case 'task_complete':
                        console.log('\n');
                        close();
                        break;
                    case 'server_error':
                    case 'error':
                        console.error(chalk.red(`\n✖ Server Error: ${chunk.message || 'Unknown error'}`));
                        close();
                        break;
                }
            } catch (e) { }
        });

        ws.on('error', (err) => {
            console.error(chalk.red(`\n✖ Connection Error: ${err.message}`));
            close();
        });

        ws.on('close', close);
    });
}

export async function startInteractiveSession(
    systemPrompt?: string,
    provider?: string,
    model?: string,
    buddyMode?: boolean,
    contextPatterns?: string[]
): Promise<void> {
    console.log(chalk.dim('━'.repeat(50)));
    console.log(`${chalk.bold.blue('◆ SESSION')} ${chalk.dim('│')} ${chalk.greenBright('ACTIVE')}`);
    console.log(chalk.dim('Type "!buddy [message]" to chat with your sidekick in the background.\n'));

    const sessionId = crypto.randomUUID();
    const ws = new WebSocket('ws://127.0.0.1:4000/api/chat/ws');
    const spinner = ora({ text: chalk.dim('Agent thinking...'), color: 'blue' });

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        prompt: PFX_USER // Injected User Prefix
    });

    const state = { gen: false, buddyGen: false, buddyWait: false, taskActive: false };
    let buddyTimeout: NodeJS.Timeout | null = null;

    const stopSpinner = () => { if (spinner.isSpinning) spinner.stop(); };
    const clearBuddy = () => { if (state.buddyGen) { console.log(); state.buddyGen = false; } };
    const doPrompt = () => { if (!state.gen && !spinner.isSpinning) rl.prompt(true); };
    const resetTask = () => { stopSpinner(); state.gen = false; state.taskActive = false; doPrompt(); };

    ws.on('message', (data) => {
        try {
            const chunk: StreamChunk & { message?: string; done?: boolean; isFinished?: boolean } = JSON.parse(data.toString());

            switch (chunk.type) {
                case 'content':
                    clearBuddy();
                    if (!state.gen) {
                        stopSpinner();
                        process.stdout.write(`\r\x1b[K${PFX_AGENT}`);
                        state.gen = true;
                    }
                    process.stdout.write(chalk.blue(chunk.content));
                    break;

                case 'buddy_content':
                    if (state.buddyWait) {
                        readline.moveCursor(process.stdout, 0, -1);
                        readline.clearLine(process.stdout, 0);
                        process.stdout.write(PFX_BUDDY);
                        state.buddyWait = false;
                        state.buddyGen = true;
                    } else if (!state.buddyGen) {
                        if (state.gen) { console.log(); state.gen = false; }
                        stopSpinner();
                        process.stdout.write(`\n${PFX_BUDDY}`);
                        state.buddyGen = true;
                    }

                    process.stdout.write(chalk.magenta(chunk.content));

                    if (buddyTimeout) clearTimeout(buddyTimeout);

                    if (chunk.done || chunk.isFinished) {
                        clearBuddy();
                        doPrompt();
                    } else {
                        buddyTimeout = setTimeout(() => { clearBuddy(); doPrompt(); }, 800);
                    }
                    break;

                case 'tool_start':
                    clearBuddy();
                    stopSpinner();
                    console.log(`\n${chalk.dim('⚙ Executing')} ${chalk.cyan(chunk.name)}${chalk.dim('...')}`);
                    state.gen = false;
                    break;

                case 'tool_result':
                    clearBuddy();
                    console.log(`${chalk.green('✔ Finished')} ${chalk.dim(chunk.name)}`);
                    spinner.start(chalk.dim('Analyzing...'));
                    state.gen = false;
                    break;

                case 'reasoning':
                    if (!spinner.isSpinning) spinner.start();
                    spinner.text = chalk.dim('Agent is reasoning...');
                    break;

                case 'task_complete':
                    console.log();
                    if (buddyTimeout) clearTimeout(buddyTimeout);
                    state.buddyGen = false;
                    resetTask();
                    break;

                case 'server_error':
                case 'error':
                    console.log(`\n${chalk.red('✖ Server Error: ' + (chunk.message || 'Unknown error'))}\n`);
                    resetTask();
                    break;
            }
        } catch (e) { }
    });

    ws.on('error', (err) => {
        stopSpinner();
        console.log(`\n${chalk.red('✖ Connection Error: ' + err.message)}\n`);
        rl.setPrompt(PFX_USER);
        rl.prompt(true);
    });

    ws.on('close', () => {
        stopSpinner();
        console.log(`\n${chalk.red('✖ Connection to core server lost. Exiting...')}\n`);
        process.exit(1);
    });

    ws.on('open', () => {
        rl.prompt();

        rl.on('line', (input) => {
            const trimmed = input.trim();
            const lowerInput = trimmed.toLowerCase();

            if (lowerInput === 'exit' || lowerInput === 'quit') {
                ws.close();
                rl.close();
                process.exit(0);
            }

            if (!trimmed) return rl.prompt();

            if (trimmed.startsWith('!buddy ')) {
                state.buddyWait = true;
                process.stdout.write(`${PFX_BUDDY}` + chalk.dim('typing...\n'));

                ws.send(JSON.stringify({
                    action: 'buddy_chat',
                    prompt: trimmed.replace('!buddy ', '')
                }));
            } else {
                if (state.taskActive) {
                    console.log(chalk.yellow('\n⚠ Please wait for the current task to finish before sending another prompt.'));
                    return rl.prompt(true);
                }

                state.gen = false;
                state.taskActive = true;
                spinner.text = chalk.dim('Agent thinking...');
                spinner.start();

                ws.send(JSON.stringify({
                    action: 'main_task', prompt: trimmed, cwd: process.cwd(),
                    sessionId, provider, model, systemPrompt, buddyMode
                }));
            }
        });
    });
}