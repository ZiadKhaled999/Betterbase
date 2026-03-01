/**
 * Webhook Commands for BetterBase CLI
 *
 * Provides commands for managing webhooks: create, list, test, and view logs.
 */

import { existsSync as fsExistsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { type BetterBaseConfig, parseConfig } from "@betterbase/core/config";
import { type WebhookDeliveryLog, WebhookDispatcher } from "@betterbase/core/webhooks";
import type { DBEventType } from "@betterbase/shared";
import inquirer from "inquirer";
import * as logger from "../utils/logger";
import { SchemaScanner } from "../utils/scanner";

/**
 * Webhook configuration from config file
 */
interface WebhookEntry {
	id: string;
	table: string;
	events: DBEventType[];
	url: string;
	secret: string;
	enabled: boolean;
}

/**
 * Find and load the BetterBase config file
 */
async function findConfigFile(projectRoot: string): Promise<string | null> {
	const configPaths = [
		path.join(projectRoot, "betterbase.config.ts"),
		path.join(projectRoot, "betterbase.config.js"),
		path.join(projectRoot, "betterbase.config.mts"),
	];

	for (const configPath of configPaths) {
		if (fsExistsSync(configPath)) {
			return configPath;
		}
	}

	return null;
}

/**
 * Load and parse the BetterBase config
 */
async function loadConfig(projectRoot: string): Promise<BetterBaseConfig | null> {
	const configPath = await findConfigFile(projectRoot);

	if (!configPath) {
		logger.error('No betterbase.config.ts found. Run "bb init" first.');
		return null;
	}

	try {
		// Dynamic import for ESM modules
		const configModule = await import(configPath);
		const config = configModule.default || configModule;

		if (config && typeof config === "object") {
			const parseResult = parseConfig(config);
			if (parseResult.success) {
				return parseResult.data;
			}
			logger.error(`Config validation failed: ${parseResult.error.message}`);
			return null;
		}

		return null;
	} catch (error) {
		logger.error(
			`Failed to load config: ${error instanceof Error ? error.message : String(error)}`,
		);
		return null;
	}
}

/**
 * Find database schema file
 */
function findSchemaFile(projectRoot: string): string | null {
	const schemaPaths = [
		path.join(projectRoot, "src/db/schema.ts"),
		path.join(projectRoot, "src/database/schema.ts"),
		path.join(projectRoot, "schema.ts"),
	];

	for (const schemaPath of schemaPaths) {
		if (fsExistsSync(schemaPath)) {
			return schemaPath;
		}
	}

	return null;
}

/**
 * Get list of tables from schema
 */
function getTablesFromSchema(projectRoot: string): string[] {
	const schemaPath = findSchemaFile(projectRoot);
	if (!schemaPath) {
		return [];
	}

	try {
		const scanner = new SchemaScanner(schemaPath);
		const tables = scanner.scan();
		return Object.keys(tables);
	} catch (error) {
		logger.warn(`Failed to scan schema: ${error instanceof Error ? error.message : String(error)}`);
		return [];
	}
}

/**
 * Read the raw config file content
 */
async function readConfigFile(projectRoot: string): Promise<{ content: string; path: string } | null> {
	const configPath = findConfigFile(projectRoot);
	const resolvedPath = await configPath;
	if (!resolvedPath) {
		return null;
	}

	try {
		const content = readFileSync(resolvedPath, "utf-8");
		return { content, path: resolvedPath };
	} catch (error) {
		return null;
	}
}

/**
 * Write updated config file
 */
function writeConfigFile(configPath: string, content: string): boolean {
	try {
		writeFileSync(configPath, content, "utf-8");
		return true;
	} catch (error) {
		logger.error(
			`Failed to write config: ${error instanceof Error ? error.message : String(error)}`,
		);
		return false;
	}
}

/**
 * Generate a unique webhook ID
 */
function generateWebhookId(): string {
	return `webhook-${Date.now().toString(36)}`;
}

/**
 * Run webhook create command
 */
export async function runWebhookCreateCommand(projectRoot: string): Promise<void> {
	// Load config to check existing webhooks
	const config = await loadConfig(projectRoot);

	if (!config) {
		logger.error("Could not load config. Please ensure betterbase.config.ts exists.");
		return;
	}

	// Get tables from schema
	const tables = getTablesFromSchema(projectRoot);

	if (tables.length === 0) {
		logger.error("No tables found in schema. Please define tables in src/db/schema.ts first.");
		return;
	}

	// Prompt for table name
	const tableNameResponse = await inquirer.prompt<{ tableName: string }>([
		{
			type: "list" as const,
			name: "tableName",
			message: "Select the table to trigger webhooks:",
			choices: tables,
		},
	]);
	const tableName = tableNameResponse.tableName;

	// Prompt for events
	const eventsResponse = await inquirer.prompt<{ events: string[] }>([
		{
			type: "checkbox" as const,
			name: "events",
			message: "Select events to trigger webhook:",
			choices: [
				{ name: "INSERT", value: "INSERT", checked: true },
				{ name: "UPDATE", value: "UPDATE", checked: true },
				{ name: "DELETE", value: "DELETE", checked: false },
			],
		},
	]);
	const events = eventsResponse.events;

	if (events.length === 0) {
		logger.error("You must select at least one event type.");
		return;
	}

	// Prompt for URL env var name
	const urlEnvResponse = await inquirer.prompt<{ urlEnvVar: string }>([
		{
			type: "input" as const,
			name: "urlEnvVar",
			message: "Enter the environment variable name for the webhook URL:",
			default: `WEBHOOK_${tableName.toUpperCase()}_URL`,
			validate: (answer: string) => {
				if (!answer.trim()) {
					return "Environment variable name is required.";
				}
				if (!/^[A-Z][A-Z0-9_]*$/.test(answer)) {
					return "Use uppercase letters and underscores (e.g., WEBHOOK_USERS_URL).";
				}
				return true;
			},
		},
	]);
	const urlEnvVar = urlEnvResponse.urlEnvVar;

	// Prompt for secret env var name
	const secretEnvResponse = await inquirer.prompt<{ secretEnvVar: string }>([
		{
			type: "input" as const,
			name: "secretEnvVar",
			message: "Enter the environment variable name for the webhook secret:",
			default: "WEBHOOK_SECRET",
			validate: (answer: string) => {
				if (!answer.trim()) {
					return "Environment variable name is required.";
				}
				if (!/^[A-Z][A-Z0-9_]*$/.test(answer)) {
					return "Use uppercase letters and underscores (e.g., WEBHOOK_SECRET).";
				}
				return true;
			},
		},
	]);
	const secretEnvVar = secretEnvResponse.secretEnvVar;

	// Generate webhook entry
	const webhookId = generateWebhookId();
	const webhookEntry: WebhookEntry = {
		id: webhookId,
		table: tableName,
		events: events as DBEventType[],
		url: `process.env.${urlEnvVar}`,
		secret: `process.env.${secretEnvVar}`,
		enabled: true,
	};

	// Update config file
	const configFile = await readConfigFile(projectRoot);
	if (!configFile) {
		logger.error("Could not read config file.");
		return;
	}

	let { content } = configFile;
	const webhookJson = JSON.stringify(webhookEntry, null, 2);

	// Check if webhooks array exists
	if (content.includes("webhooks:")) {
		// Find and update existing webhooks array
		const webhooksMatch = content.match(/webhooks:\s*\[([^\]]*)\]/s);
		if (webhooksMatch) {
			const existingWebhooks = webhooksMatch[1].trim();
			if (existingWebhooks) {
				// Add to existing array
				content = content.replace(
					/webhooks:\s*\[([^\]]*)\]/s,
					`webhooks: [${existingWebhooks}\n  ${webhookJson.replace(/\n/g, "\n  ")},`,
				);
			} else {
				// Empty array - just add the entry
				content = content.replace(/webhooks:\s*\[\s*\]/s, `webhooks: [\n  ${webhookJson}\n]`);
			}
		}
	} else {
		// Add webhooks section before graphql or at end
		const graphqlMatch = content.match(/graphql:/);
		if (graphqlMatch) {
			content = content.replace(/graphql:/, `webhooks: [\n  ${webhookJson}\n],\n\n  graphql:`);
		} else {
			// Add at end before final brace
			content = content.replace(/}\s*$/, `,\n  webhooks: [\n    ${webhookJson}\n  ]\n}`);
		}
	}

	// Write updated config
	if (!writeConfigFile(configFile.path, content)) {
		return;
	}

	logger.success(`Webhook created with ID: ${webhookId}`);

	// Update .env file with placeholder
	const envPath = path.join(projectRoot, ".env");
	let envContent = "";
	if (fsExistsSync(envPath)) {
		envContent = readFileSync(envPath, "utf-8");
	}

	const urlKey = `${urlEnvVar}=`;
	const secretKey = `${secretEnvVar}=`;

	if (!envContent.includes(urlKey)) {
		envContent += `\n${urlKey}\n`;
	}
	if (!envContent.includes(secretKey)) {
		envContent += `${secretKey}\n`;
	}

	if (fsExistsSync(envPath)) {
		writeFileSync(envPath, envContent, "utf-8");
	}

	logger.info("\nWebhook created successfully!");
	logger.info("Add your webhook URL to .env:");
	console.log(`  ${urlEnvVar}=https://your-endpoint.com/webhook`);
	console.log(`  ${secretEnvVar}=your-secret-here`);
}

/**
 * Run webhook list command
 */
export async function runWebhookListCommand(projectRoot: string): Promise<void> {
	const config = await loadConfig(projectRoot);

	if (!config) {
		return;
	}

	const webhooks = config.webhooks || [];

	if (webhooks.length === 0) {
		logger.info('No webhooks configured. Run "bb webhook create" to add one.');
		return;
	}

	// Print webhook table
	console.log("\n\x1b[1mWebhooks\x1b[0m");
	console.log("─".repeat(80));
	console.log(
		`\x1b[1m${"ID".padEnd(20)} ${"Table".padEnd(15)} ${"Events".padEnd(20)} ${"Status".padEnd(10)}\x1b[0m`,
	);
	console.log("─".repeat(80));

	for (const webhook of webhooks) {
		const id = webhook.id.substring(0, 18).padEnd(20);
		const table = webhook.table.padEnd(15);
		const events = webhook.events.join(", ").padEnd(20);
		const status = webhook.enabled ? "\x1b[32menabled\x1b[0m" : "\x1b[31mdisabled\x1b[0m";

		console.log(`${id} ${table} ${events} ${status}`);
	}

	console.log("─".repeat(80));
	console.log(`\nTotal: ${webhooks.length} webhook(s)\n`);
}

/**
 * Run webhook test command
 */
export async function runWebhookTestCommand(projectRoot: string, webhookId: string): Promise<void> {
	const config = await loadConfig(projectRoot);

	if (!config) {
		return;
	}

	const webhooks = config.webhooks || [];
	const webhook = webhooks.find((w) => w.id === webhookId);

	if (!webhook) {
		logger.error(`Webhook not found: ${webhookId}`);
		logger.info('Run "bb webhook list" to see available webhooks.');
		return;
	}

	// Extract env var names from process.env references
	const urlEnvMatch = webhook.url.match(/^process\.env\.(\w+)$/);
	const secretEnvMatch = webhook.secret.match(/^process\.env\.(\w+)$/);

	if (!urlEnvMatch || !secretEnvMatch) {
		logger.error("Webhook URL and secret must be environment variable references.");
		return;
	}

	const urlEnvVar = urlEnvMatch[1];
	const secretEnvVar = secretEnvMatch[1];

	// Get actual values from process.env
	const url = process.env[urlEnvVar];
	const secret = process.env[secretEnvVar];

	if (!url) {
		logger.error(`Environment variable not set: ${urlEnvVar}`);
		logger.info(`Add to .env: ${urlEnvVar}=https://your-endpoint.com/webhook`);
		return;
	}

	if (!secret) {
		logger.error(`Environment variable not set: ${secretEnvVar}`);
		logger.info(`Add to .env: ${secretEnvVar}=your-secret`);
		return;
	}

	// Create a temporary dispatcher for testing
	const testWebhookConfig = {
		...webhook,
		url,
		secret,
	};

	const dispatcher = new WebhookDispatcher([testWebhookConfig]);

	logger.info(`Testing webhook ${webhookId}...`);
	console.log(`  URL: ${url}`);
	console.log(`  Table: ${webhook.table}`);
	console.log(`  Events: ${webhook.events.join(", ")}\n`);

	try {
		const result = await dispatcher.testWebhook(testWebhookConfig.id);

		if (result.success) {
			logger.success("Webhook test succeeded!");
			console.log(`  Status: ${result.status_code}`);
			if (result.response_body) {
				console.log(`  Response: ${result.response_body.substring(0, 200)}`);
			}
		} else {
			logger.error("Webhook test failed!");
			if (result.status_code) {
				console.log(`  Status: ${result.status_code}`);
			}
			if (result.response_body) {
				console.log(`  Response: ${result.response_body.substring(0, 200)}`);
			}
			if (result.error) {
				console.log(`  Error: ${result.error}`);
			}
		}
	} catch (error) {
		logger.error(`Test failed: ${error instanceof Error ? error.message : String(error)}`);
	}
}

/**
 * Run webhook logs command
 */
export async function runWebhookLogsCommand(projectRoot: string, webhookId: string): Promise<void> {
	const config = await loadConfig(projectRoot);

	if (!config) {
		return;
	}

	const webhooks = config.webhooks || [];
	const webhook = webhooks.find((w) => w.id === webhookId);

	if (!webhook) {
		logger.error(`Webhook not found: ${webhookId}`);
		logger.info('Run "bb webhook list" to see available webhooks.');
		return;
	}

	// Note: In this implementation, delivery logs are stored in-memory in the dispatcher
	// For CLI, we need to either:
	// 1. Access logs from a running server (not implemented in v1)
	// 2. Show a message explaining this limitation

	logger.info(`Webhook: ${webhook.id}`);
	logger.info(`Table: ${webhook.table}`);
	logger.info(`Events: ${webhook.events.join(", ")}`);

	console.log("\n\x1b[1mDelivery Logs\x1b[0m");
	console.log("─".repeat(80));

	// In v1, logs are stored in-memory only and not persisted
	// The CLI cannot access server-side logs
	logger.info("Note: Delivery logs are stored in-memory on the server.");
	logger.info("To view logs, you would need to access the running server.");

	// Show a placeholder for demonstration
	console.log("\n  No delivery logs available in CLI mode.");
	console.log("  Logs are stored in-memory during server runtime.\n");

	console.log("─".repeat(80));
}

/**
 * Execute webhook command with subcommands
 */
export async function runWebhookCommand(args: string[], projectRoot: string): Promise<void> {
	const [subcommand, ...remainingArgs] = args;

	switch (subcommand) {
		case "create":
			await runWebhookCreateCommand(projectRoot);
			break;

		case "list":
			await runWebhookListCommand(projectRoot);
			break;

		case "test":
			if (remainingArgs.length === 0) {
				logger.error("Usage: bb webhook test <webhook-id>");
				logger.info('Run "bb webhook list" to see available webhooks.');
				return;
			}
			await runWebhookTestCommand(projectRoot, remainingArgs[0]);
			break;

		case "logs":
			if (remainingArgs.length === 0) {
				logger.error("Usage: bb webhook logs <webhook-id>");
				logger.info('Run "bb webhook list" to see available webhooks.');
				return;
			}
			await runWebhookLogsCommand(projectRoot, remainingArgs[0]);
			break;

		default:
			console.log(`
\x1b[1mBetterBase Webhook Commands\x1b[0m

\x1b[1mUsage:\x1b[0m
  bb webhook <command> [options]

\x1b[1mCommands:\x1b[0m
  create           Create a new webhook
  list             List all configured webhooks
  test <id>        Test a webhook by sending a synthetic payload
  logs <id>        Show delivery logs for a webhook

\x1b[1mExamples:\x1b[0m
  bb webhook create
  bb webhook list
  bb webhook test webhook-abc123
  bb webhook logs webhook-abc123
`);
	}
}
