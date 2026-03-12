import fs from 'fs';
import path from 'path';

/**
 * Logger that pipes output to a persistent file stream 
 * and mirrors critical levels to the console.
 */
export class Logger {
    /** Persistent write stream to avoid opening/closing the file on every log. */
    private readonly stream: fs.WriteStream;

    /**
     * @param filename - Name of the log file, resolved against the current working directory.
     */
    constructor(filename: string = 'agent.log') {
        const logFilePath = path.resolve(process.cwd(), filename);
        
        this.stream = fs.createWriteStream(logFilePath, { flags: 'a', encoding: 'utf-8' });
        
        this.stream.on('error', (error) => {
            console.error(` [LOGGER ERROR] Stream failed: ${error} `);
        });
    }

    /**
     * Formats the log string with an ISO timestamp and severity level.
     */
    private formatMessage(level: string, message: string): string {
        const timestamp = new Date().toISOString();
        return `[${timestamp}] [${level}] ${message}\n`;
    }

    /**
     * Pipes the formatted string to the active file stream.
     */
    private writeToFile(formattedMessage: string): void {
        if (this.stream.writable) {
            this.stream.write(formattedMessage);
        }
    }

    /** Logs a standard informational event. */
    public info(message: string): void {
        this.writeToFile(this.formatMessage('INFO', message));
    }

    /** Logs a successful operation. */
    public success(message: string): void {
        this.writeToFile(this.formatMessage('SUCCESS', message));
    }

    /** Logs a warning to the log file. */
    public warn(message: string): void {
        this.writeToFile(this.formatMessage('WARN', message));
    }

    /** Logs an error (and optional stack trace) to the log file. */
    public error(message: string, error?: any): void {
        const errDetails = error ? `\n${error instanceof Error ? error.stack : JSON.stringify(error)}` : '';
        this.writeToFile(this.formatMessage('ERROR', message + errDetails));
    }

    /** Logs verbose details to the file, but only if the DEBUG env flag is truthy. */
    public debug(message: string): void {
        if (process.env.DEBUG) {
            this.writeToFile(this.formatMessage('DEBUG', message));
        }
    }
}

/** Global singleton instance for the core engine. */
export const logger = new Logger('agent-activity.log');