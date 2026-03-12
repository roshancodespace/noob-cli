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

    const state = { gen: false, buddyGen: false, buddyWait: false, taskActive: false, buddyActive: false, isMultiLine: false, multiLineBuffer: '', awaitingApproval: false };

    const stopSpinner = () => spinner.stop();
    const clearBuddy = () => { if (state.buddyGen) { console.log(); state.buddyGen = false; } };
    const doPrompt = () => { if (!state.gen && !state.buddyActive && !spinner.isSpinning) rl.prompt(true); };
    const resetTask = () => { stopSpinner(); state.gen = false; state.taskActive = false; doPrompt(); };

    const submitPrompt = (text: string) => {
        if (text.startsWith('!buddy')) {
            state.buddyWait = true;
            state.buddyActive = true;
            process.stdout.write(`${PFX_BUDDY}` + chalk.dim('typing...\n'));

            client.send({
                action: 'buddy_chat',
                prompt: text.replace('!buddy ', '').trim()
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
                action: 'main_task', prompt: text, cwd: process.cwd(),
                sessionId, provider, model, systemPrompt, buddyMode, contextPatterns
            });
        }
    }

    const client = createClient({
        onOpen: () => {
            rl.prompt();
            rl.on('line', (input) => {
                const trimmed = input.trim();
                const lowerInput = trimmed.toLowerCase();

                if (state.isMultiLine) {
                    if (lowerInput === '!end') {
                        state.isMultiLine = false;
                        rl.setPrompt(PFX_USER);

                        const finalPrompt = state.multiLineBuffer.trim();
                        state.multiLineBuffer = '';

                        if (!finalPrompt) return rl.prompt();
                        submitPrompt(finalPrompt);
                    } else {
                        state.multiLineBuffer += input + '\n';
                        rl.prompt();
                    }
                    return;
                }

                if (lowerInput === '!multi') {
                    state.isMultiLine = true;
                    console.log(chalk.yellow('  [Multi-line mode active. Paste your text, then type !end on a new line to submit]'));
                    rl.setPrompt(chalk.dim('... '));
                    return rl.prompt();
                }

                if (lowerInput === 'exit' || lowerInput === 'quit') {
                    client.close();
                    rl.close();
                    process.exit(0);
                }

                if (!trimmed) {
                    if (!state.taskActive) rl.prompt();
                    return;
                }

                submitPrompt(trimmed);
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

                    if (chunk.done || chunk.isFinished) {
                        clearBuddy();
                        doPrompt();
                    }
                    break;

                case 'tool_start':
                    if (state.buddyWait) {
                        readline.moveCursor(process.stdout, 0, -1);
                        readline.clearLine(process.stdout, 0);
                        state.buddyWait = false;
                        state.buddyGen = true;
                    }
                    clearBuddy();
                    stopSpinner();
                    if (!state.awaitingApproval) {
                        console.log(`\n${chalk.dim('⚙ Executing')} ${chalk.cyan(chunk.name)}${chalk.dim('...')}`);
                        if (chunk.args) {
                            const summary = chunk.args.command || chunk.args.path || chunk.args.patch || chunk.args.path;
                            if (summary) console.log(chalk.dim(`  $ ${summary}`));
                        }
                    }
                    state.gen = false;
                    break;

                case 'tool_result':
                    clearBuddy();
                    console.log(`${chalk.green('✔ Finished')} ${chalk.dim(chunk.name)}`);
                    if (chunk.name === 'ask_main_agent' && chunk.result) {
                        const formattedResult = typeof chunk.result === 'string' ? chunk.result : JSON.stringify(chunk.result, null, 2);
                        console.log(`\n${PFX_AGENT}${chalk.blue(formattedResult)}\n`);
                    }
                    spinner.start('Analyzing...');
                    state.gen = false;
                    break;

                case 'reasoning':
                    spinner.start('Agent is reasoning...');
                    break;

                case 'action_approval':
                    state.awaitingApproval = true;
                    clearBuddy();
                    stopSpinner();
                    state.gen = false;

                    const warningText = chalk.yellow(`\n[WARNING] ${chunk.reason || 'Potentially unsafe command'}`);
                    const cmdText = chalk.cyan(chunk.cmd || 'Unknown command');

                    rl.question(`${warningText}\nCommand: ${cmdText}\nAllow? (y/N): `, (answer) => {
                        state.awaitingApproval = false;
                        const approved = answer.toLowerCase().startsWith('y');
                        if (!approved) {
                            console.log(chalk.red('Aborted by user.'));
                        } else {
                            console.log(chalk.green('Approved.'));
                            spinner.start('Executing command...');
                        }

                        client.send({
                            action: 'approval_response',
                            approved
                        });
                    });
                    break;

                case 'task_complete':
                    console.log();
                    if (chunk.source === 'buddy') {
                        state.buddyGen = false;
                        state.buddyActive = false;
                        doPrompt();
                    } else {
                        state.buddyGen = false;
                        resetTask();
                    }
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
