import ora from 'ora';
import chalk from 'chalk';

export function createSpinner(text = 'Agent thinking...') {
    const spinner = ora({ text: chalk.dim(text), color: 'blue' });

    return {
        start: (msg?: string) => {
            if (msg) spinner.text = chalk.dim(msg);
            if (!spinner.isSpinning) spinner.start();
        },
        stop: () => {
            if (spinner.isSpinning) spinner.stop();
        },
        updateText: (msg: string) => {
            spinner.text = chalk.dim(msg);
        },
        get isSpinning() {
            return spinner.isSpinning;
        }
    };
}
