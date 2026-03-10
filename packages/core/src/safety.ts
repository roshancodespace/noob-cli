export interface SafetyResult {
    status: 'approved' | 'warning' | 'rejected';
    reason?: string;
}

const FATAL = [
    'rm -rf /', 'rm -rf /*', 'mkfs', 'dd ', 'format ', ':(){ :|:& };:', '> /dev/sda'
];

const WARNING = [
    'rm ', 'del ', 'pnpm publish', 'npm publish', 'git push --force', 
    'chmod -R 777', 'chown -R', 'wget ', 'curl '
];

const ALLOWED = new Set([
    'ls', 'dir', 'cat', 'type', 'cp', 'copy', 'xcopy', 'mv', 'move', 'mkdir', 'md',
    'touch', 'rm', 'del', 'rmdir', 'rd', 'find', 'where', 'which', 'echo', 'pwd', 'cd',
    'git', 'node', 'npm', 'npx', 'pnpm', 'yarn', 'bun', 'tsx', 'ts-node',
    'tsc', 'vite', 'esbuild', 'rollup', 'webpack',
    'grep', 'sed', 'awk', 'sort', 'head', 'tail', 'wc', 'tr', 'xargs',
    'powershell', 'cmd', 'attrib', 'icacls', 'robocopy',
    'curl', 'wget', 'ssh', 'scp', 'tar', 'zip', 'unzip', 'python', 'python3', 'pip'
]);

export function validateCommand(command: string): SafetyResult {
    const cmd = command.trim();
    const exe = cmd.split(/\s+/)[0].toLowerCase().replace(/^\.\//, '').replace(/\.exe$/, '');

    const fatalMatch = FATAL.find(f => cmd.includes(f));
    if (fatalMatch) return { status: 'rejected', reason: `Destructive pattern: '${fatalMatch}'` };

    if (exe && !ALLOWED.has(exe)) {
        return { status: 'rejected', reason: `Unknown executable: '${exe}'. Possible hallucination.` };
    }

    const warnMatch = WARNING.find(w => cmd.includes(w));
    if (warnMatch) return { status: 'warning', reason: `Risky pattern: '${warnMatch}'` };

    return { status: 'approved' };
}