import fs from 'fs/promises';
import chalk from 'chalk';
import ora from 'ora';
import { globby } from 'globby';
import isBinaryPath from 'is-binary-path';

interface LoadContextOptions {
    system?: string;
    [key: string]: any;
}

export async function loadContext(
    contextPatterns: string[],
    options: LoadContextOptions
): Promise<{ systemPrompt: string }> {
    let systemPrompt = `${options.system || 'You are a helpful terminal AI assistant.'}\n\nCurrent Working Directory: ${process.cwd()}`;

    if (!contextPatterns?.length) return { systemPrompt };

    const spinner = ora('Gathering context...').start();

    try {
        const paths = await globby(contextPatterns, { gitignore: true, dot: true });

        if (!paths.length) {
            spinner.warn(chalk.yellow('No context matches'));
            return { systemPrompt };
        }

        let loaded = 0, skipped = 0;
        let contextBlock = '';

        for (const p of paths) {
            if (isBinaryPath(p)) { skipped++; continue; }

            try {
                const stats = await fs.stat(p);
                if (stats.size > 1048576) { skipped++; continue; }

                const content = await fs.readFile(p, 'utf-8');
                contextBlock += `<file path="${p}">\n${content}\n</file>\n`;
                loaded++;
            } catch {
                skipped++;
            }
        }

        if (contextBlock) {
            systemPrompt += `\n\n<project_context>\n${contextBlock}</project_context>`;
        }

        let msg = `Loaded ${loaded} context files`;
        if (skipped) msg += ` (${skipped} skipped)`;
        spinner.succeed(chalk.dim(msg));
    } catch (err: any) {
        spinner.fail(`Context error: ${err.message}`);
    }

    return { systemPrompt };
}
