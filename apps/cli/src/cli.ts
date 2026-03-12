import { Command } from 'commander';
import chalk from 'chalk';
import { ensureServer } from './api/client.js';
import { runOneShot } from './commands/oneshot.js';
import { startInteractiveSession } from './commands/interactive.js';

const program = new Command();

program
    .name('noob')
    .description('CLI AI Assistant')
    .version('1.0.0')
    .option('-p, --provider <provider>', 'AI provider')
    .option('-m, --model <model>', 'Model to use')
    .option('-b, --buddy', 'Enable Buddy Mode to keep you entertained during long tasks')
    .option('-s, --system <system>', 'System prompt')
    .option('-c, --context <pattern>', 'Context glob patterns')
    .argument('[prompt...]', 'Prompt')
    .action(async (promptArr: string[], options: any) => {
        try {
            await ensureServer();

            const prompt = promptArr.join(' ').trim();
            const patterns = options.context ? options.context.split(',').map((p: string) => p.trim()) : [];

            if (prompt) {
                await runOneShot(prompt, options.system, options.provider, options.model, patterns);
            } else {
                await startInteractiveSession(options.system, options.provider, options.model, options.buddy, patterns);
            }
        } catch (err: any) {
            console.error(chalk.red(`\n[Fatal Error]: ${err.message}`));
            process.exit(1);
        }
    });

program.parse();