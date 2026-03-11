import chalk from 'chalk';
import fs from 'fs/promises';
import path from 'path';
import { logger } from '../../utils/logger.js';
import { applyPatch } from 'diff';

export async function handleEditFileAction(args: { path: string, patch: string }): Promise<string> {
    const fp = args.path?.trim();
    if (!fp) return "Failed: target path is required.";

    logger.info(`[ACTION DETECTED] edit_file Path: ${fp}`);

    try {
        const fullPath = path.resolve(process.cwd(), fp);

        if (!fullPath.startsWith(process.cwd())) {
            const errMsg = `Failed: Access denied. Cannot edit outside the current working directory.`;
            console.log(chalk.red(`[BLOCKED] Path traversal attempt: ${fullPath}`));
            logger.warn(`Blocked edit outside CWD: ${fullPath}`);
            return errMsg;
        }

        const rawContent = await fs.readFile(fullPath, 'utf-8');
        const fileContent = rawContent.replace(/\r\n/g, '\n');

        const patchStr = args.patch;
        if (!patchStr) {
            return "Failed: patch is required.";
        }

        const patchedContent = applyPatch(fileContent, patchStr);
        
        if (patchedContent === false) {
            logger.warn(`Failed to apply patch to ${fp}`);
            return `Failed: The diff patch could not be applied. This usually happens if the -lines in the patch do not exactly match the original file. Try reading the file again and providing an accurate patch.`;
        }

        await fs.writeFile(fullPath, patchedContent, 'utf-8');

        console.log(chalk.green('File edited successfully.'));
        logger.success(`Successfully replaced text in: ${fp}`);
        return `Successfully edited ${fp}.`;

    } catch (err: any) {
        const msg = err.code === 'ENOENT' ? 'File does not exist. Use write_file to create it.' : err.message;
        console.log(chalk.red(`File edit failed: ${msg}`));
        logger.error(`Failed to edit file: ${fp}`, err);
        return `Failed to edit ${fp}: ${msg}`;
    }
}