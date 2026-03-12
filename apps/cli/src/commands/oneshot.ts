import chalk from 'chalk';
import crypto from 'crypto';
import * as readline from 'readline';
import { logger } from '@noob-cli/core';
import { PFX_AGENT, PFX_BUDDY, printOneShotHeader } from '../ui/theme.js';
import { createSpinner } from '../ui/spinner.js';
import { createClient, WSMessageChunk } from '../api/client.js';

export async function runOneShot(
    prompt: string,
    systemPrompt?: string,
    provider?: string,
    model?: string,
    contextPatterns?: string[]
): Promise<void> {
    printOneShotHeader(prompt);
    logger.info(`Running one-shot command: "${prompt}"`);

    return new Promise((resolve) => {
        const spinner = createSpinner('Agent thinking...');
        let isGen = false;
        let isBuddyGen = false;
        let isAwaitingApproval = false;

        const stopSpinner = () => spinner.stop();
        const clearBuddy = () => { if (isBuddyGen) { console.log(); isBuddyGen = false; } };

        const client = createClient({
            onOpen: () => {
                spinner.start();
                client.send({
                    action: 'main_task', prompt, systemPrompt, provider, model, contextPatterns,
                    cwd: process.cwd(), sessionId: crypto.randomUUID()
                });
            },
            onMessage: (chunk: WSMessageChunk) => {
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
                        if (!isAwaitingApproval) {
                            console.log(chalk.blue(`\n  ○ Running ${chalk.bold(chunk.name)}...`));
                            if (chunk.args) {
                                const summary = chunk.args.command || chunk.args.path || '';
                                if (summary) console.log(chalk.dim(`    $ ${summary}`));
                            }
                        }
                        isGen = false;
                        break;
                    case 'tool_result':
                        clearBuddy();
                        console.log(chalk.green(`  ✓ ${chunk.name} completed.`));
                        if (chunk.name === 'ask_main_agent' && chunk.result) {
                            const formattedResult = typeof chunk.result === 'string' ? chunk.result : JSON.stringify(chunk.result, null, 2);
                            console.log(`\n${PFX_AGENT}${chalk.blue(formattedResult)}\n`);
                        }
                        spinner.start('Analyzing result...');
                        isGen = false;
                        break;
                    case 'reasoning':
                        spinner.start('Agent is reasoning...');
                        break;
                    case 'action_approval':
                        isAwaitingApproval = true;
                        clearBuddy();
                        stopSpinner();
                        isGen = false;
                        
                        const rl = readline.createInterface({
                            input: process.stdin,
                            output: process.stdout
                        });

                        const warningText = chalk.yellow(`\n[WARNING] ${chunk.reason || 'Potentially unsafe command'}`);
                        const cmdText = chalk.cyan(chunk.cmd || 'Unknown command');
                        
                        rl.question(`${warningText}\nCommand: ${cmdText}\nAllow? (y/N): `, (answer) => {
                            isAwaitingApproval = false;
                            const approved = answer.toLowerCase().startsWith('y');
                            if (!approved) {
                                console.log(chalk.red('Aborted by user.'));
                            } else {
                                console.log(chalk.green('Approved.'));
                                spinner.start('Executing command...');
                            }
                            
                            rl.close();
                            client.send({
                                action: 'approval_response',
                                approved
                            });
                        });
                        break;
                    case 'task_complete':
                        console.log('\n');
                        stopSpinner();
                        client.close();
                        resolve();
                        break;
                    case 'server_error':
                    case 'error':
                        console.error(chalk.red(`\n✖ Server Error: ${chunk.message || 'Unknown error'}`));
                        stopSpinner();
                        client.close();
                        resolve();
                        break;
                }
            },
            onError: (err: Error) => {
                console.error(chalk.red(`\n✖ Connection Error: ${err.message}`));
                stopSpinner();
                client.close();
                resolve();
            },
            onClose: () => {
                stopSpinner();
                resolve();
            }
        });
    });
}
