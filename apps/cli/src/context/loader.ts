import fs from 'fs/promises';
import path from 'path';
import chalk from 'chalk';
import ora from 'ora';
import { runCli, type CliOptions } from 'repomix';

interface LoadContextOptions {
    system?: string;
    [key: string]: any;
}

/**
 * Loads and injects local workspace files into the AI's system prompt using Repomix.
 * Automatically compresses code into structural "skeletons" (signatures/interfaces) to save tokens.
 */
export async function loadContext(
    contextPatterns: string[],
    options: LoadContextOptions
): Promise<{ systemPrompt: string }> {
    let systemPrompt = `${options.system || 'You are a helpful AI assistant.'}\n\nCurrent Working Directory: ${process.cwd()}`;

    if (!contextPatterns || contextPatterns.length === 0) return { systemPrompt };

    const spinner = ora('Packing repository context with Repomix...').start();
    const tempOutputFile = path.resolve(process.cwd(), '.noob-repomix-output.xml');

    try {
        const cliOptions = {
            output: tempOutputFile,
            include: contextPatterns.join(','), // Pass user-defined glob patterns
            style: 'xml',                       // XML is highly optimized for Claude/Gemini parsing
            compress: true,                     // Enforces AST skeleton extraction (removes implementation details)
            quiet: true,                        // Suppress Repomix's native console output
        } as CliOptions;

        const result = await runCli(['.'], process.cwd(), cliOptions) as any;
        const packedContent = await fs.readFile(tempOutputFile, 'utf-8');
        
        systemPrompt += `\n\n${packedContent}`;
        await fs.unlink(tempOutputFile).catch(() => {});

        const totalFiles = result?.packResult?.totalFiles ?? 'multiple';
        const totalTokens = result?.packResult?.totalTokens ?? 'unknown';

        spinner.succeed(chalk.dim(
            `Packed ${totalFiles} files (${totalTokens} tokens) using Repomix.`
        ));
    } catch (err: any) {
        await fs.unlink(tempOutputFile).catch(() => {});
        spinner.fail(`Context packing error: ${err.message}`);
    }

    return { systemPrompt };
}