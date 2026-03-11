import chalk from 'chalk';
import fs from 'fs/promises';
import path from 'path';
import { logger } from '../../utils/logger.js';

export async function handleReadFileAction(args: { path: string }): Promise<string> {
    const fp = args.path?.trim();
    if (!fp) return "Failed: path is required";

    logger.info(`[ACTION DETECTED] read_file Path: ${fp}`);

    try {
        const fullPath = path.resolve(process.cwd(), fp);

        const content = await fs.readFile(fullPath, 'utf-8');
        console.log(chalk.green('File read successfully.'));
        logger.success(`Successfully read file: ${fp}`);
        return `File contents of ${fp}:\n${content}`;
    } catch (err: any) {
        console.log(chalk.red(`File read failed: ${err.message}`));
        logger.error(`Failed to read file: ${fp}`, err);
        return `Failed to read file ${fp}: ${err.message}`;
    }
}