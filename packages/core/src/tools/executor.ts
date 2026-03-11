import { ToolCall } from '../llm/types.js';
import { handleExecuteAction } from './actions/execute.js';
import { handleReadFileAction } from './actions/readFile.js';
import { handleWriteFileAction } from './actions/writeFile.js';
import { handleEditFileAction } from './actions/editFile.js';
import chalk from 'chalk';

/**
 * Dispatches a list of ToolCalls to their respective handlers.
 * Returns the results of the executions for testing or manual injection.
 */
export async function executeToolCalls(
    toolCalls: ToolCall[]
): Promise<string[]> {
    const executedResults: string[] = [];

    for (const call of toolCalls) {
        let result = "";
        const name = call.function.name;

        try {
            const args = JSON.parse(call.function.arguments);

            switch (name) {
                case 'execute_command':
                    result = await handleExecuteAction(args);
                    break;
                case 'read_file':
                    result = await handleReadFileAction(args);
                    break;
                case 'write_file':
                    result = await handleWriteFileAction(args);
                    break;
                case 'edit_file':
                    result = await handleEditFileAction(args);
                    break;
                default:
                    result = `Error: Unknown tool function "${name}"`;
                    console.log(chalk.red(result));
            }
            executedResults.push(result);
        } catch (err: any) {
            result = `Error parsing arguments or executing tool ${name}: ${err.message}`;
            console.log(chalk.red(result));
            executedResults.push(result);
        }
    }
    
    return executedResults;
}