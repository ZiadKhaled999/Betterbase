/**
 * Branch CLI Commands
 *
 * CLI commands for managing preview environments (branches).
 * Provides commands to create, list, delete, sleep, and wake preview environments.
 */

import { readFile } from "fs/promises";
import { resolve } from "path";
import * as logger from "../utils/logger";
import { CONFIG_FILE_NAME } from "@betterbase/shared";
import type { BetterBaseConfig } from "@betterbase/core";
import {
	createBranchManager,
	getAllBranches,
	clearAllBranches,
	type BranchConfig,
	type BranchListResult,
	type BranchOperationResult,
	type CreateBranchOptions,
} from "@betterbase/core/branching";

/**
 * Load BetterBase configuration from project root
 * @param projectRoot - Path to the project root
 * @returns BetterBase configuration
 */
async function loadConfig(projectRoot: string): Promise<BetterBaseConfig | null> {
	const configPath = resolve(projectRoot, CONFIG_FILE_NAME);
	try {
		const configContent = await readFile(configPath, "utf-8");
		// Extract the config object from the file
		const configModule = await import(configPath);
		return configModule.default || configModule.config || null;
	} catch {
		return null;
	}
}

/**
 * Run the branch create command
 * @param args - Command arguments [name, projectRoot]
 */
export async function runBranchCreateCommand(
	args: string[],
	projectRoot: string = process.cwd(),
): Promise<void> {
	const name = args[0];

	if (!name) {
		logger.error("Branch name is required. Usage: bb branch create <name>");
		process.exit(1);
	}

	logger.info(`Creating preview environment: ${name}`);

	try {
		// Load configuration
		const config = await loadConfig(projectRoot);
		if (!config) {
			logger.error(
				`Could not load configuration from ${CONFIG_FILE_NAME}. Make sure you're in a BetterBase project directory.`,
			);
			process.exit(1);
		}

		// Create branch manager
		const branchManager = createBranchManager(config);

		// Create branch options
		const options: CreateBranchOptions = {
			name,
			sourceBranch: "main",
			copyDatabase: true,
			copyStorage: true,
		};

		// Create the branch
		const result = await branchManager.createBranch(options);

		if (!result.success) {
			logger.error(`Failed to create preview environment: ${result.error}`);
			process.exit(1);
		}

		const branch = result.branch!;
		logger.success(`Preview environment created successfully!`);
		logger.info(`  Name: ${branch.name}`);
		logger.info(`  Preview URL: ${branch.previewUrl}`);
		logger.info(`  Status: ${branch.status}`);

		if (result.warnings && result.warnings.length > 0) {
			logger.warn("Warnings:");
			result.warnings.forEach((warning: string) => logger.warn(`  - ${warning}`));
		}

		if (branch.databaseConnectionString) {
			logger.info(`  Database: Cloned from main`);
		}

		if (branch.storageBucket) {
			logger.info(`  Storage: ${branch.storageBucket}`);
		}
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		logger.error(`Error creating preview environment: ${message}`);
		process.exit(1);
	}
}

/**
 * Run the branch list command
 * @param args - Command arguments
 * @param projectRoot - Path to the project root
 */
export async function runBranchListCommand(
	args: string[] = [],
	projectRoot: string = process.cwd(),
): Promise<void> {
	try {
		// Load configuration
		const config = await loadConfig(projectRoot);
		if (!config) {
			logger.error(
				`Could not load configuration from ${CONFIG_FILE_NAME}. Make sure you're in a BetterBase project directory.`,
			);
			process.exit(1);
		}

		// Create branch manager
		const branchManager = createBranchManager(config);

		// List all branches
		const result = branchManager.listBranches();

		if (result.branches.length === 0) {
			logger.info("No preview environments found.");
			logger.info("Run 'bb branch create <name>' to create one.");
			return;
		}

		logger.info(`Found ${result.total} preview environment(s):\n`);

		// Display each branch
		result.branches.forEach((branch: BranchConfig) => {
			logger.info(`  ${branch.name}`);
			logger.info(`    Status: ${branch.status}`);
			logger.info(`    URL: ${branch.previewUrl}`);
			logger.info(`    Created: ${branch.createdAt.toISOString()}`);
			logger.info(`    Last accessed: ${branch.lastAccessedAt.toISOString()}`);
			logger.info("");
		});
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		logger.error(`Error listing preview environments: ${message}`);
		process.exit(1);
	}
}

/**
 * Run the branch delete command
 * @param args - Command arguments [name]
 * @param projectRoot - Path to the project root
 */
export async function runBranchDeleteCommand(
	args: string[],
	projectRoot: string = process.cwd(),
): Promise<void> {
	const name = args[0];

	if (!name) {
		logger.error("Branch name is required. Usage: bb branch delete <name>");
		process.exit(1);
	}

	logger.info(`Deleting preview environment: ${name}`);

	try {
		// Load configuration
		const config = await loadConfig(projectRoot);
		if (!config) {
			logger.error(
				`Could not load configuration from ${CONFIG_FILE_NAME}. Make sure you're in a BetterBase project directory.`,
			);
			process.exit(1);
		}

		// Create branch manager
		const branchManager = createBranchManager(config);

		// Find branch by name
		const branch = branchManager.getBranchByName(name);
		if (!branch) {
			logger.error(`Preview environment '${name}' not found.`);
			process.exit(1);
		}

		// Delete the branch
		const result = await branchManager.deleteBranch(branch.id);

		if (!result.success) {
			logger.error(`Failed to delete preview environment: ${result.error}`);
			process.exit(1);
		}

		logger.success(`Preview environment '${name}' deleted successfully!`);

		if (result.warnings && result.warnings.length > 0) {
			logger.warn("Warnings:");
			result.warnings.forEach((warning: string) => logger.warn(`  - ${warning}`));
		}
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		logger.error(`Error deleting preview environment: ${message}`);
		process.exit(1);
	}
}

/**
 * Run the branch sleep command
 * @param args - Command arguments [name]
 * @param projectRoot - Path to the project root
 */
export async function runBranchSleepCommand(
	args: string[],
	projectRoot: string = process.cwd(),
): Promise<void> {
	const name = args[0];

	if (!name) {
		logger.error("Branch name is required. Usage: bb branch sleep <name>");
		process.exit(1);
	}

	logger.info(`Putting preview environment to sleep: ${name}`);

	try {
		// Load configuration
		const config = await loadConfig(projectRoot);
		if (!config) {
			logger.error(
				`Could not load configuration from ${CONFIG_FILE_NAME}. Make sure you're in a BetterBase project directory.`,
			);
			process.exit(1);
		}

		// Create branch manager
		const branchManager = createBranchManager(config);

		// Find branch by name
		const branch = branchManager.getBranchByName(name);
		if (!branch) {
			logger.error(`Preview environment '${name}' not found.`);
			process.exit(1);
		}

		// Sleep the branch
		const result = await branchManager.sleepBranch(branch.id);

		if (!result.success) {
			logger.error(`Failed to sleep preview environment: ${result.error}`);
			process.exit(1);
		}

		logger.success(`Preview environment '${name}' is now sleeping!`);
		logger.info("You can wake it up later with 'bb branch wake <name>'");
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		logger.error(`Error putting preview environment to sleep: ${message}`);
		process.exit(1);
	}
}

/**
 * Run the branch wake command
 * @param args - Command arguments [name]
 * @param projectRoot - Path to the project root
 */
export async function runBranchWakeCommand(
	args: string[],
	projectRoot: string = process.cwd(),
): Promise<void> {
	const name = args[0];

	if (!name) {
		logger.error("Branch name is required. Usage: bb branch wake <name>");
		process.exit(1);
	}

	logger.info(`Waking preview environment: ${name}`);

	try {
		// Load configuration
		const config = await loadConfig(projectRoot);
		if (!config) {
			logger.error(
				`Could not load configuration from ${CONFIG_FILE_NAME}. Make sure you're in a BetterBase project directory.`,
			);
			process.exit(1);
		}

		// Create branch manager
		const branchManager = createBranchManager(config);

		// Find branch by name
		const branch = branchManager.getBranchByName(name);
		if (!branch) {
			logger.error(`Preview environment '${name}' not found.`);
			process.exit(1);
		}

		// Wake the branch
		const result = await branchManager.wakeBranch(branch.id);

		if (!result.success) {
			logger.error(`Failed to wake preview environment: ${result.error}`);
			process.exit(1);
		}

		logger.success(`Preview environment '${name}' is now active!`);
		logger.info(`Preview URL: ${branch.previewUrl}`);
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		logger.error(`Error waking preview environment: ${message}`);
		process.exit(1);
	}
}

/**
 * Run the branch command (main dispatcher)
 * @param args - Command arguments
 * @param projectRoot - Path to the project root
 */
export async function runBranchCommand(
	args: string[] = [],
	projectRoot: string = process.cwd(),
): Promise<void> {
	const action = args[0];

	switch (action) {
		case "create":
			await runBranchCreateCommand(args.slice(1), projectRoot);
			break;
		case "list":
		case "ls":
			await runBranchListCommand(args.slice(1), projectRoot);
			break;
		case "delete":
		case "remove":
		case "rm":
			await runBranchDeleteCommand(args.slice(1), projectRoot);
			break;
		case "sleep":
			await runBranchSleepCommand(args.slice(1), projectRoot);
			break;
		case "wake":
			await runBranchWakeCommand(args.slice(1), projectRoot);
			break;
		case undefined:
			// No action specified, show help
			logger.info("Usage: bb branch <command> [options]");
			logger.info("");
			logger.info("Commands:");
			logger.info("  create <name>   Create a new preview environment");
			logger.info("  list            List all preview environments");
			logger.info("  delete <name>  Delete a preview environment");
			logger.info("  sleep <name>   Put a preview environment to sleep");
			logger.info("  wake <name>    Wake a sleeping preview environment");
			logger.info("");
			logger.info("Examples:");
			logger.info("  bb branch create my-feature");
			logger.info("  bb branch list");
			logger.info("  bb branch delete my-feature");
			logger.info("  bb branch sleep my-feature");
			logger.info("  bb branch wake my-feature");
			break;
		default:
			logger.error(`Unknown branch command: ${action}`);
			logger.info("Run 'bb branch' for usage information.");
			process.exit(1);
	}
}
