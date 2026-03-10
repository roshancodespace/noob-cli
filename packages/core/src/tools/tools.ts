import { type Tool } from 'ai';
import { z } from 'zod';
import { handleExecuteAction } from './actions/execute.js';
import { handleReadFileAction } from './actions/readFile.js';
import { handleWriteFileAction } from './actions/writeFile.js';
import { handleEditFileAction } from './actions/editFile.js';
import { perplexitySearch } from '@perplexity-ai/ai-sdk';

export const TOOLS: Record<string, Tool> = {
    execute_command: {
        type: 'function',
        description: 'Executes a command directly in the terminal/command line. Use this to run shell commands, interact with the system, or run scripts.',
        inputSchema: z.object({
            command: z.string().describe('The exact terminal command to run. Use appropriate Windows CMD syntax.')
        }),
        execute: async ({ command }) => {
            return await handleExecuteAction({ command });
        }
    },

    read_file: {
        type: 'function',
        description: 'Reads the contents of a specified file. ALWAYS use this to read a file before trying to edit or describe it.',
        inputSchema: z.object({
            path: z.string().describe('The absolute or relative path to the file to read.')
        }),
        execute: async ({ path }) => {
            return await handleReadFileAction({ path });
        }

    },

    write_file: {
        type: 'function',
        description: 'Creates a new file or completely overwrites an existing file with the provided content.',
        inputSchema: z.object({
            path: z.string().describe('The path where the file should be created or overwritten.'),
            content: z.string().describe('The full text content to write into the file.')
        }),
        execute: async ({ path, content }) => {
            return await handleWriteFileAction({ path, content });
        }
    },

    edit_file: {
        type: 'function',
        description: 'Replaces specific lines in an existing file. This is better for modifying large files without re-writing the entire file.',
        inputSchema: z.object({
            path: z.string().describe('The path to the file to edit.'),
            search_text: z.string().describe('The EXACT block of text existing in the file that you want to replace. Must match whitespace and indentation perfectly.'),
            replace_text: z.string().describe('The new text that will replace the search_text.')
        }),
        execute: async (args) => {
            return await handleEditFileAction(args);
        }
    },
};