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

        logger.success(`Successfully wrote to file: ${fp}`);
        return `Successfully written to ${fp}.`;

    } catch (err: any) {
        logger.error(`Failed to write file: ${fp}`, err);
        return `Failed to write file ${fp}: ${err.message}`;
    }
}