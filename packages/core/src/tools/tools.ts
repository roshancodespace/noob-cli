import { type Tool } from 'ai';
import { z } from 'zod';
import { handleExecuteAction } from './actions/execute.js';
import { handleReadFileAction } from './actions/readFile.js';
import { handleWriteFileAction } from './actions/writeFile.js';
import { handleEditFileAction } from './actions/editFile.js';

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
        description: 'Applies a Unified Format Patch to an existing file. This is the BEST way to modify files. ALWAYS read the file first.',
        inputSchema: z.object({
            path: z.string().describe('The path to the file to edit.'),
            patch: z.string().describe('The unified diff patch to apply to the file. For example:\n--- target.txt\n+++ target.txt\n@@ -1,3 +1,3 @@\n-old line\n+new line')
        }),
        execute: async (args) => {
            return await handleEditFileAction(args);
        }
    },
};