import chalk from 'chalk';

/**
 * Print an informational message to stdout.
 */
export function info(message: string): void {
  console.log(chalk.blue(`ℹ ${message}`));
}

/**
 * Print a warning message to stdout.
 */
export function warn(message: string): void {
  console.log(chalk.yellow(`⚠ ${message}`));
}

/**
 * Print an error message to stderr.
 */
export function error(message: string): void {
  console.error(chalk.red(`✖ ${message}`));
}

/**
 * Print a success message to stdout.
 */
export function success(message: string): void {
  console.log(chalk.green(`✔ ${message}`));
}
