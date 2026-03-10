import chalk from 'chalk';
import fs from 'fs/promises';
import path from 'path';
import { logger } from '../../utils/logger.js';

export async function handleEditFileAction(args: { path: string, search_text: string, replace_text: string }): Promise<string> {
    const fp = args.path?.trim();
    if (!fp) return "Failed: target path is required.";

    console.log(chalk.yellow(`\nAgent is editing: `) + chalk.cyan(fp));
    logger.info(`[ACTION DETECTED] edit_file Path: ${fp}`);

    try {
        const fullPath = path.resolve(process.cwd(), fp);
        
        const rawContent = await fs.readFile(fullPath, 'utf-8');
        const fileContent = rawContent.replace(/\r\n/g, '\n');
        
        const searchText = (args.search_text || "").replace(/\r\n/g, '\n');
        const replaceText = (args.replace_text || "").replace(/\r\n/g, '\n');

        if (!searchText) {
            return "Failed: search_text cannot be empty.";
        }

        const occurrences = fileContent.split(searchText).length - 1;

        if (occurrences === 0) {
            logger.warn(`Search string not found in ${fp}`);
            return `Failed: The exact search_text was not found in the file. Did you hallucinate whitespace or indentation? Try reading the file again and copy-pasting the exact block.`;
        }

        if (occurrences > 1) {
            logger.warn(`Multiple occurrences found in ${fp}`);
            return `Failed: The search_text appears ${occurrences} times in the file. Please provide a LARGER block of search_text so it uniquely matches only one location.`;
        }

        const newContent = fileContent.replace(searchText, replaceText);
        
        await fs.writeFile(fullPath, newContent, 'utf-8');

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