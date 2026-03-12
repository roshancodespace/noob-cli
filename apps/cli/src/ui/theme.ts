import chalk from 'chalk';
import boxen from 'boxen';

export const PFX_USER = `${chalk.bold.cyan('◆ User ')} ${chalk.dim('│')} `;
export const PFX_AGENT = `${chalk.bold.blue('◇ Agent')} ${chalk.dim('│')} `;
export const PFX_BUDDY = `${chalk.bold.magenta('✦ Buddy')} ${chalk.dim('│')} `;

export function printBanner(provider: string, model: string, patterns: string[]) {
    console.clear();
    const banner = [
        chalk.cyan('┳┓┏┓┏┓┳┓ ┏┓┓ ┳'),
        chalk.cyan('┃┃┃┃┃┃┣┫ ┃ ┃ ┃'),
        chalk.blue('┛┗┗┛┗┛┻┛ ┗┛┗┛┻')
    ].join('\n');
    console.log(`\n${banner}`);

    const statusLine = `${chalk.green('●')} ${chalk.bold('READY')} ${chalk.dim('|')} ${chalk.blue((provider || 'default').toUpperCase())} ${chalk.dim('›')} ${chalk.yellow(model || 'default')}`;
    const contextLine = chalk.dim(`Context: ${patterns.length > 0 ? chalk.cyan(patterns.join(', ')) : 'global'}`);

    console.log(boxen(`${statusLine}\n${contextLine}`, {
        padding: { left: 2, right: 2, top: 0, bottom: 0 },
        margin: { top: 1, bottom: 1 },
        borderStyle: 'none'
    }));

    console.log(chalk.dim('━'.repeat(50)));
    console.log(`${chalk.bold.blue('◆ SESSION')} ${chalk.dim('│')} ${chalk.greenBright('ACTIVE')}`);
    console.log(chalk.dim('Type "!buddy [message]" to chat with your sidekick in the background.\n'));
}

export function printOneShotHeader(prompt: string) {
    console.log(chalk.dim('\n' + '━'.repeat(50)));
    console.log(`${PFX_USER}${prompt}`);
    console.log(chalk.dim('━'.repeat(50) + '\n'));
}
