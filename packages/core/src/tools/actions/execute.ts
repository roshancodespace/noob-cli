import chalk from 'chalk';
import * as readline from 'readline';
import { validateCommand, SafetyResult } from '../../safety.js';
import { exec } from 'child_process';
import util from 'util';
import path from 'path';
import fs from 'fs/promises';
import { logger } from '../../utils/logger.js';

const execAsync = util.promisify(exec);
const IGNORED_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.next', 'coverage']);

export async function handleExecuteAction(
    args: { command: string }
): Promise<string> {
    const cmd = args.command?.trim();
    if (!cmd) return 'Failed: command argument missing.';

    logger.info(`[ACTION DETECTED] execute_command: ${cmd}`);

    if (/^cd\s+(.+)/.test(cmd)) {
        return handleCd(cmd);
    }

    if (cmd.includes('tree') || (cmd.match(/\bdir\b/i) && cmd.match(/\/[sS]\b/))) {
        return await handleDirectoryListing(cmd);
    }

    const safety = validateCommand(cmd);

    if (safety.status === 'rejected') {
        return await handleRejection(cmd, safety);
    }

    return await executeWithSafety(cmd, safety);
}

function handleCd(cmd: string): string {
    if (cmd.includes('&&') || cmd.includes(';') || cmd.includes('||')) {
        const errStr = "Failed: Do not chain 'cd' with other commands. Execute 'cd' standalone, wait for success, and then execute the next command.";
        console.log(chalk.yellow(`[BLOCKED] AI attempted to chain cd: ${cmd}`));
        logger.warn(`Blocked chained cd attempt: ${cmd}`);
        return errStr;
    }

    const target = cmd.match(/^cd\s+(.+)/)![1].trim().replace(/^["']|["']$/g, '');
    try {
        process.chdir(path.resolve(process.cwd(), target));
        const res = `Changed directory to: ${process.cwd()}`;
        console.log(chalk.green(`CWD: ${process.cwd()}`));
        logger.success(res);
        return res;
    } catch (err: any) {
        const errStr = `cd failed: ${err.message}`;
        console.log(chalk.red(errStr));
        logger.error(`Failed to change directory to ${target}`, err);
        return errStr;
    }
}

async function handleDirectoryListing(cmd: string): Promise<string> {
    console.log(chalk.dim(`Intercepting recursive listing command to safely ignore heavy folders...`));
    const isTree = cmd.includes('tree');

    try {
        const output = await generateListing(process.cwd(), '', isTree);
        const finalOutput = isTree ? `Folder PATH listing\nC:.\n${output}` : output;
        console.log(chalk.green('Directory listing generated successfully.'));
        return `Command: ${cmd}\nResult: Succeeded.\nStdout:\n${finalOutput}\nStderr:\n`;
    } catch (err: any) {
        console.log(chalk.red('Directory generation failed.'));
        return `Command: ${cmd}\nResult: Failed: ${err.message}\nStdout:\n\nStderr:\n${err.message}`;
    }
}

async function generateListing(dir: string, prefix: string, isTree: boolean): Promise<string> {
    let result = '';
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const filtered = entries.filter(e => !IGNORED_DIRS.has(e.name));

    for (let i = 0; i < filtered.length; i++) {
        const entry = filtered[i];
        const fullPath = path.join(dir, entry.name);

        if (isTree) {
            const isLast = i === filtered.length - 1;
            result += `${prefix}${isLast ? '└── ' : '├── '}${entry.name}\n`;
            if (entry.isDirectory()) {
                result += await generateListing(fullPath, prefix + (isLast ? '    ' : '│   '), isTree);
            }
        } else {
            result += `${fullPath}\n`;
            if (entry.isDirectory()) {
                result += await generateListing(fullPath, prefix, isTree);
            }
        }
    }
    return result;
}

async function handleRejection(cmd: string, safety: SafetyResult): Promise<string> {
    const fileReadMatch = cmd.replace(/\s+/g, '').match(/^(?:read|cat|open|show|type|view|get|print|display)?[-_]?(.+\.[a-zA-Z]{1,5})$/i);

    if (fileReadMatch) {
        const guessedPath = fileReadMatch[1];
        console.log(chalk.yellow(`[RECOVERED] Looks like a file read — trying: ${guessedPath}`));
        try {
            const content = await fs.readFile(path.resolve(process.cwd(), guessedPath), 'utf-8');
            console.log(chalk.green(`File read successfully.`));
            return `File contents of ${guessedPath}:\n${content}`;
        } catch (err: any) {
            console.log(chalk.red(`[REJECTED] ${safety.reason}`));
            return `Command execution REJECTED: ${safety.reason}. Recovery failed.`;
        }
    }

    console.log(chalk.red(`[REJECTED] ${safety.reason}`));
    return `Command execution REJECTED by safety layer: ${safety.reason}`;
}

async function executeWithSafety(cmd: string, safety: SafetyResult): Promise<string> {
    if (safety.status === 'warning') {
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
        const answer = await new Promise<string>(resolve =>
            rl.question(chalk.yellow(`\n[WARNING] ${safety.reason}\nAllow? (y/N): `), resolve)
        );
        rl.close();
        if (!answer.toLowerCase().startsWith('y')) {
            console.log(chalk.red('Aborted by user.'));
            return `Command '${cmd}' aborted by user.`;
        }
    }
    return await runShellCommand(cmd);
}

async function runShellCommand(cmd: string): Promise<string> {
    console.log(chalk.dim(`Executing...`));
    const shell = process.platform === 'win32' ? 'cmd.exe' : '/bin/bash';

    try {
        const { stdout, stderr } = await execAsync(cmd, { cwd: process.cwd(), shell });
        console.log(chalk.green('Command succeeded.'));
        return `Command: ${cmd}\nResult: Succeeded.\nStdout:\n${stdout}\nStderr:\n${stderr}`;
    } catch (err: any) {
        console.log(chalk.red('Command failed.'));
        const out = err.stdout || '';
        const errOut = err.stderr || '';
        return `Command: ${cmd}\nResult: Failed: ${err.message}\nStdout:\n${out}\nStderr:\n${errOut}`;
    }
}