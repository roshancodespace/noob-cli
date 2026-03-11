import { Command } from 'commander';
import chalk from 'chalk';
import boxen from 'boxen';
import { runOneShot, startInteractiveSession } from './ui/session.js';
import { start } from '@noob-cli/core';

const program = new Command();

async function ensureServer() {
    for (let i = 0; i < 5; i++) {
        try {
            const res = await fetch('http://127.0.0.1:4000/health');
            if (res.ok) return;
        } catch {
            if (i === 0) {
                console.log(chalk.yellow('Core server not running. Starting...'));
                start();
            }
            // Exponential-ish backoff: 200ms, 400ms, 600ms, 800ms...
            await new Promise(resolve => setTimeout(resolve, 200 * (i + 1)));
        }
    }
}

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
                console.clear();
                const banner = [
                    chalk.cyan('┳┓┏┓┏┓┳┓ ┏┓┓ ┳'),
                    chalk.cyan('┃┃┃┃┃┃┣┫ ┃ ┃ ┃'),
                    chalk.blue('┛┗┗┛┗┛┻┛ ┗┛┗┛┻')
                ].join('\n');
                console.log(`\n${banner}`);

                const statusLine = `${chalk.green('●')} ${chalk.bold('READY')} ${chalk.dim('|')} ${chalk.blue((options.provider || 'default').toUpperCase())} ${chalk.dim('›')} ${chalk.yellow(options.model || 'default')}`;
                const contextLine = chalk.dim(`Context: ${patterns.length > 0 ? chalk.cyan(patterns.join(', ')) : 'global'}`);

                console.log(boxen(`${statusLine}\n${contextLine}`, {
                    padding: { left: 2, right: 2, top: 0, bottom: 0 },
                    margin: { top: 1, bottom: 1 },
                    borderStyle: 'none'
                }));

                await startInteractiveSession(options.system, options.provider, options.model, options.buddy, patterns);
            }
        } catch (err: any) {
            console.error(chalk.red(`\n[Fatal Error]: ${err.message}`));
            process.exit(1);
        }
    });

program.parse();