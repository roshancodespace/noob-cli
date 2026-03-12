import { validateCommand, SafetyResult } from '../../safety.js';
import { exec } from 'child_process';
import util from 'util';
import path from 'path';
import fs from 'fs/promises';
import { logger } from '../../utils/logger.js';

const execAsync = util.promisify(exec);
const IGNORED_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.next', 'coverage']);

export interface ToolCallbacks {
    onSafetyWarning?: (cmd: string, reason: string) => Promise<boolean>;
}

export async function handleExecuteAction(
    args: { command: string },
    callbacks?: ToolCallbacks
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

    return await executeWithSafety(cmd, safety, callbacks);
}

function handleCd(cmd: string): string {
    if (cmd.includes('&&') || cmd.includes(';') || cmd.includes('||')) {
        const errStr = "Failed: Do not chain 'cd' with other commands. Execute 'cd' standalone, wait for success, and then execute the next command.";
        logger.warn(`Blocked chained cd attempt: ${cmd}`);
        return errStr;
    }

    const target = cmd.match(/^cd\s+(.+)/)![1].trim().replace(/^["']|["']$/g, '');
    try {
        process.chdir(path.resolve(process.cwd(), target));
        const res = `Changed directory to: ${process.cwd()}`;
        logger.success(res);
        return res;
    } catch (err: any) {
        const errStr = `cd failed: ${err.message}`;
        logger.error(`Failed to change directory to ${target}`, err);
        return errStr;
    }
}

async function handleDirectoryListing(cmd: string): Promise<string> {
    const isTree = cmd.includes('tree');

    try {
        const output = await generateListing(process.cwd(), '', isTree);
        const finalOutput = isTree ? `Folder PATH listing\nC:.\n${output}` : output;
        return `Command: ${cmd}\nResult: Succeeded.\nStdout:\n${finalOutput}\nStderr:\n`;
    } catch (err: any) {
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
        try {
            const content = await fs.readFile(path.resolve(process.cwd(), guessedPath), 'utf-8');
            return `File contents of ${guessedPath}:\n${content}`;
        } catch (err: any) {
            return `Command execution REJECTED: ${safety.reason}. Recovery failed.`;
        }
    }

    return `Command execution REJECTED by safety layer: ${safety.reason}`;
}

async function executeWithSafety(cmd: string, safety: SafetyResult, callbacks?: ToolCallbacks): Promise<string> {
    if (safety.status === 'warning') {
        if (!callbacks?.onSafetyWarning) {
           return `Command execution REJECTED: Unsafe command requires interactive approval, which is disabled in this mode.`;
        }

        const isApproved = await callbacks.onSafetyWarning(cmd, safety.reason || 'Potentially unsafe command.');
        if (!isApproved) {
            return `Command '${cmd}' aborted by user.`;
        }
    }
    return await runShellCommand(cmd);
}

async function runShellCommand(cmd: string): Promise<string> {
    const shell = process.platform === 'win32' ? 'cmd.exe' : '/bin/bash';

    try {
        const { stdout, stderr } = await execAsync(cmd, { cwd: process.cwd(), shell });
        return `Command: ${cmd}\nResult: Succeeded.\nStdout:\n${stdout}\nStderr:\n${stderr}`;
    } catch (err: any) {
        const out = err.stdout || '';
        const errOut = err.stderr || '';
        return `Command: ${cmd}\nResult: Failed: ${err.message}\nStdout:\n${out}\nStderr:\n${errOut}`;
    }
}