import chalk from 'chalk';
import * as readline from 'readline';
import crypto from 'crypto';
import { PFX_USER, PFX_AGENT, PFX_BUDDY, printBanner } from '../ui/theme.js';
import { createSpinner } from '../ui/spinner.js';
import { createClient, WSMessageChunk } from '../api/client.js';

export async function startInteractiveSession(
    systemPrompt?: string,
    provider?: string,
    model?: string,
    buddyMode?: boolean,
    contextPatterns?: string[]
): Promise<void> {
    printBanner(provider || '', model || '', contextPatterns || []);

    const sessionId = crypto.randomUUID();
    const spinner = createSpinner('Agent thinking...');

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        prompt: PFX_USER // Injected User Prefix
    });

    const state = { gen: false, buddyGen: false, buddyWait: false, taskActive: false };
    let buddyTimeout: NodeJS.Timeout | null = null;

    const stopSpinner = () => spinner.stop();
    const clearBuddy = () => { if (state.buddyGen) { console.log(); state.buddyGen = false; } };
    const doPrompt = () => { if (!state.gen && !spinner.isSpinning) rl.prompt(true); };
    const resetTask = () => { stopSpinner(); state.gen = false; state.taskActive = false; doPrompt(); };

    const client = createClient({
        onOpen: () => {
            rl.prompt();

            rl.on('line', (input) => {
                const trimmed = input.trim();
                const lowerInput = trimmed.toLowerCase();

                if (lowerInput === 'exit' || lowerInput === 'quit') {
                    client.close();
                    rl.close();
                    process.exit(0);
                }

                if (!trimmed) return rl.prompt();

                if (trimmed.startsWith('!buddy ')) {
                    state.buddyWait = true;
                    process.stdout.write(`${PFX_BUDDY}` + chalk.dim('typing...\n'));

                    client.send({
                        action: 'buddy_chat',
                        prompt: trimmed.replace('!buddy ', '')
                    });
                } else {
                    if (state.taskActive) {
                        console.log(chalk.yellow('\n⚠ Please wait for the current task to finish before sending another prompt.'));
                        return rl.prompt(true);
                    }

                    state.gen = false;
                    state.taskActive = true;
                    spinner.start('Agent thinking...');

                    client.send({
                        action: 'main_task', prompt: trimmed, cwd: process.cwd(),
                        sessionId, provider, model, systemPrompt, buddyMode
                    });
                }
            });
        },
        onMessage: (chunk: WSMessageChunk) => {
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
                    spinner.start('Analyzing...');
                    state.gen = false;
                    break;

                case 'reasoning':
                    spinner.start('Agent is reasoning...');
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
        },
        onError: (err: Error) => {
            stopSpinner();
            console.log(`\n${chalk.red('✖ Connection Error: ' + err.message)}\n`);
            rl.setPrompt(PFX_USER);
            rl.prompt(true);
        },
        onClose: () => {
            stopSpinner();
            console.log(`\n${chalk.red('✖ Connection to core server lost. Exiting...')}\n`);
            process.exit(1);
        }
    });
}
