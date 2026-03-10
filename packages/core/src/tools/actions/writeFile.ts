import chalk from 'chalk';
import fs from 'fs/promises';
import path from 'path';
import { logger } from '../../utils/logger.js';

export async function handleWriteFileAction(args: { path: string, content: string }): Promise<string> {
    const fp = args.path?.trim();
    const content = args.content || '';

    if (!fp) {
        return 'Failed: path is required.';
    }

    logger.info(`[ACTION DETECTED] write_file Path: ${fp}`);

    try {
        const fullPath = path.resolve(process.cwd(), fp);
        await fs.mkdir(path.dirname(fullPath), { recursive: true });
        await fs.writeFile(fullPath, content, 'utf-8');

        console.log(chalk.green(`File written successfully: ${fp}`));
        logger.success(`Successfully wrote file: ${fp}`);
        return `Successfully wrote file: ${fp}`;
    } catch (err: any) {
        console.log(chalk.red(`File write failed for ${fp}: ${err.message}`));
        logger.error(`Failed to write file: ${fp}`, err);
        return `Failed to write file ${fp}: ${err.message}`;
    }
}