import fs from 'fs/promises';
import path from 'path';
import chalk from 'chalk';

export class Logger {
    private readonly logFilePath: string;

    constructor(filename: string = 'agent.log') {
        this.logFilePath = path.resolve(process.cwd(), filename);
    }

    private formatMessage(level: string, message: string): string {
        const timestamp = new Date().toISOString();
        return `[${timestamp}] [${level}] ${message}`;
    }

    private async writeToFile(message: string): Promise<void> {
        try {
            await fs.appendFile(this.logFilePath, message + '\n', 'utf-8');
        } catch (error) {
            console.error(chalk.bgRed.white(` [LOGGER ERROR] Failed to write to log file: ${error} `));
        }
    }

    public info(message: string): void {
        const formatted = this.formatMessage('INFO', message);
        this.writeToFile(formatted);
    }

    public success(message: string): void {
        const formatted = this.formatMessage('SUCCESS', message);
        this.writeToFile(formatted);
    }

    public warn(message: string): void {
        const formatted = this.formatMessage('WARN', message);
        console.log(chalk.yellow(formatted));
        this.writeToFile(formatted);
    }

    public error(message: string, error?: any): void {
        const errDetails = error ? `\n${error instanceof Error ? error.stack : JSON.stringify(error)}` : '';
        const formatted = this.formatMessage('ERROR', message + errDetails);
        console.log(chalk.red(formatted));
        this.writeToFile(formatted);
    }

    public debug(message: string): void {
        if (process.env.DEBUG) {
            const formatted = this.formatMessage('DEBUG', message);
            this.writeToFile(formatted);
        }
    }
}

export const logger = new Logger('agent-activity.log');