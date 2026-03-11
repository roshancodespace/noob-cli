import path from 'node:path';

export interface SafetyResult {
    status: 'approved' | 'warning' | 'rejected';
    reason?: string;
}

const FATAL_PATTERNS = [
    'rm -rf /', 'rm -rf /*', 'mkfs', 'dd ', 'format ', ':(){ :|:& };:', '> /dev/sda', 'rd /s /q c:'
];

const RISKY_PATTERNS = [
    'rm ', 'del ', 'pnpm publish', 'npm publish', 'git push --force',
    'chmod -R 777', 'chown -R', 'wget ', 'curl ', 'rd /s', 'rmdir /s'
];

const ALLOWED_EXECUTABLES = new Set([
    'ls', 'dir', 'cat', 'type', 'cp', 'copy', 'xcopy', 'mv', 'move', 'mkdir', 'md',
    'touch', 'rm', 'del', 'rmdir', 'rd', 'find', 'where', 'which', 'echo', 'pwd', 'cd',
    'git', 'node', 'npm', 'npx', 'pnpm', 'yarn', 'bun', 'tsx', 'ts-node',
    'tsc', 'vite', 'esbuild', 'rollup', 'webpack', 'grep', 'powershell', 'cmd', 'wc'
]);

export function validateCommand(command: string): SafetyResult {
    const trimmed = command.trim();
    const normalized = trimmed.toLowerCase().replace(/\s+/g, ' ');
    const parts = normalized.split(' ');
    const exe = parts[0].replace(/^.\//, '').replace(/\.exe$/, '');

    if (trimmed.includes('..') || path.isAbsolute(trimmed)) {
        const resolved = path.resolve(process.cwd(), trimmed.match(/[\/\\]|[a-zA-Z]:/ ) ? parts[parts.length -1] : '');
        if (!resolved.startsWith(process.cwd())) {
            return { status: 'rejected', reason: 'Access outside of project root is forbidden.' };
        }
    }

    const fatalMatch = FATAL_PATTERNS.find(f => normalized.includes(f));
    if (fatalMatch) return { status: 'rejected', reason: `Destructive command detected: '${fatalMatch}'` };

    if (!ALLOWED_EXECUTABLES.has(exe)) {
        return { status: 'rejected', reason: `Unknown or restricted executable: '${exe}'.` };
    }

    const riskyMatch = RISKY_PATTERNS.find(r => normalized.includes(r));
    if (riskyMatch) return { status: 'warning', reason: `Potentially risky action: '${riskyMatch}'` };

    return { status: 'approved' };
}