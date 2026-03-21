import chalk from "chalk";

const isTest = process.env.NODE_ENV === "test" || process.argv[1]?.includes("bun");

function formatInfo(message: string): string {
	if (isTest) return message;
	return `ℹ ${message}`;
}

function formatWarn(message: string): string {
	if (isTest) return message;
	return `⚠ ${message}`;
}

function formatError(message: string): string {
	if (isTest) return message;
	return `✖ ${message}`;
}

function formatSuccess(message: string): string {
	if (isTest) return message;
	return `✔ ${message}`;
}

/**
 * Print an informational message to stderr.
 */
export function info(message: string): void {
	console.error(chalk.blue(formatInfo(message)));
}

/**
 * Print a warning message to stderr.
 */
export function warn(message: string): void {
	console.error(chalk.yellow(formatWarn(message)));
}

/**
 * Print an error message to stderr.
 */
export function error(message: string): void {
	console.error(chalk.red(formatError(message)));
}

/**
 * Print a success message to stderr.
 */
export function success(message: string): void {
	console.error(chalk.green(formatSuccess(message)));
}
