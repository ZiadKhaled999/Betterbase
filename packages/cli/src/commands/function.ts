import { type ChildProcess, spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import {
	type DeployResult,
	type FunctionConfig,
	type FunctionInfo,
	bundleFunction,
	isFunctionBuilt,
	listFunctions,
	readFunctionConfig,
} from "@betterbase/core/functions";
import {
	deployToCloudflare,
	deployToVercel,
	getCloudflareLogs,
	getVercelLogs,
	syncEnvToCloudflare,
} from "@betterbase/core/functions";
import * as logger from "../utils/logger";

// Store running function processes for cleanup
const runningFunctions: Map<string, ChildProcess> = new Map();
const FUNCTION_PORT_START = 3001;

// Timeout for graceful shutdown (ms)
const GRACEFUL_SHUTDOWN_TIMEOUT_MS = 5000;

/**
 * Wait for process termination with optional timeout using Node.js APIs
 */
async function waitForTermination(proc: ChildProcess, timeoutMs: number): Promise<void> {
	return new Promise((resolve, reject) => {
		// Check if already exited
		if (!proc.pid || proc.killed) {
			resolve();
			return;
		}

		// Create exit handler
		const onExit = (code: number | null, signal: string | null): void => {
			clearTimeout(timeout);
			resolve();
		};

		// Set up exit listener (use once to avoid memory leaks)
		proc.once("exit", onExit);

		// Timeout handler
		const timeout = setTimeout(() => {
			// Remove the listener to prevent memory leak
			proc.removeListener("exit", onExit);
			reject(new Error("Termination timeout"));
		}, timeoutMs);
	});
}

/**
 * Kill a process gracefully with timeout-based forced kill
 */
async function killProcess(proc: ChildProcess, timeoutMs: number = GRACEFUL_SHUTDOWN_TIMEOUT_MS): Promise<void> {
	// Check if process is still running
	if (!proc.pid || proc.killed) {
		return;
	}

	// Send SIGTERM for graceful shutdown
	proc.kill("SIGTERM");

	// Wait for graceful shutdown with timeout
	try {
		await waitForTermination(proc, timeoutMs);
	} catch {
		// Timeout - force kill with SIGKILL
		proc.kill("SIGKILL");
		// Wait a bit for forced kill
		try {
			await waitForTermination(proc, 1000);
		} catch {
			// Process still running - ignore, we've done our best
		}
	}
}

/**
 * Run the function command
 */
export async function runFunctionCommand(
	args: string[],
	projectRoot: string = process.cwd(),
): Promise<void> {
	const [action, nameOrOption, extra] = args;

	switch (action) {
		case "create":
			await runFunctionCreate(nameOrOption, projectRoot);
			break;
		case "dev":
			await runFunctionDev(nameOrOption, projectRoot);
			break;
		case "build":
			await runFunctionBuild(nameOrOption, projectRoot);
			break;
		case "list":
			await runFunctionList(projectRoot);
			break;
		case "logs":
			await runFunctionLogs(nameOrOption, projectRoot);
			break;
		case "deploy":
			await runFunctionDeploy(nameOrOption, projectRoot, extra === "--sync-env");
			break;
		default:
			logger.error(`Unknown function action: ${action}`);
			console.log("\nAvailable commands:");
			console.log("  bb function create <name>  - Create a new edge function");
			console.log("  bb function dev <name>     - Run function locally with hot reload");
			console.log("  bb function build <name>   - Bundle function for deployment");
			console.log("  bb function list           - List all functions");
			console.log("  bb function logs <name>    - Show function logs");
			console.log("  bb function deploy <name>  - Deploy function to cloud");
			console.log("  bb function deploy <name> --sync-env  - Deploy and sync env vars");
	}
}

/**
 * Create a new function
 */
async function runFunctionCreate(name: string | undefined, projectRoot: string): Promise<void> {
	if (!name) {
		logger.error("Function name is required");
		console.log("Usage: bb function create <name>");
		return;
	}

	// Validate name
	if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
		logger.error("Function name can only contain letters, numbers, underscores, and hyphens");
		return;
	}

	const functionsDir = join(projectRoot, "src", "functions", name);

	if (existsSync(functionsDir)) {
		logger.error(`Function "${name}" already exists`);
		return;
	}

	// Create function directory
	mkdirSync(functionsDir, { recursive: true });

	// Create index.ts template
	const indexContent = `import { Hono } from 'hono'

const app = new Hono()

app.get('/', (c) => c.json({ message: 'Hello from BetterBase edge function!' }))

app.post('/', async (c) => {
  const body = await c.req.json()
  return c.json({ received: body })
})

export default app
`;
	writeFileSync(join(functionsDir, "index.ts"), indexContent);

	// Create config.ts template
	const configContent = `export default {
  name: '${name}',
  runtime: 'cloudflare-workers' as const,  // 'cloudflare-workers' | 'vercel-edge'
  env: [] as string[],   // env var names this function needs
}
`;
	writeFileSync(join(functionsDir, "config.ts"), configContent);

	console.log(`Function created: src/functions/${name}/`);
	console.log(`Run with: bb function dev ${name}`);
}

/**
 * Run function in development mode with hot reload
 */
async function runFunctionDev(name: string | undefined, projectRoot: string): Promise<void> {
	if (!name) {
		logger.error("Function name is required");
		console.log("Usage: bb function dev <name>");
		return;
	}

	const functionsDir = join(projectRoot, "src", "functions", name);
	const indexPath = join(functionsDir, "index.ts");

	if (!existsSync(functionsDir)) {
		logger.error(`Function "${name}" not found`);
		return;
	}

	if (!existsSync(indexPath)) {
		logger.error(`Function entry point not found: ${indexPath}`);
		return;
	}

	// Determine port - find the index of this function
	const functions = await listFunctions(projectRoot);
	const functionIndex = functions.findIndex((f: FunctionInfo) => f.name === name);
	const port = FUNCTION_PORT_START + (functionIndex >= 0 ? functionIndex : 0);

	console.log(`Starting function "${name}" on port ${port}...`);
	console.log(`Watching for changes in src/functions/${name}/`);

	// Kill any existing process with the same name to prevent orphaning
	const existingProc = runningFunctions.get(name);
	if (existingProc) {
		await killProcess(existingProc, 1000);
	}

	// Start the function with bun --watch
	const proc = spawn("bun", ["run", "--watch", indexPath], {
		cwd: projectRoot,
		stdio: "inherit",
		env: {
			...process.env,
			PORT: String(port),
			BUN_ENV: "development",
		},
	});

	runningFunctions.set(name, proc);

	// Handle cleanup on exit - use named functions to allow removal
	const cleanup = async (): Promise<void> => {
		const p = runningFunctions.get(name);
		if (p) {
			await killProcess(p);
			runningFunctions.delete(name);
		}
		// Remove the event listeners to prevent leaks
		process.off("SIGINT", cleanup);
		process.off("SIGTERM", cleanup);
	};

	// Use once option to automatically remove listeners after first trigger
	// But we still need the named cleanup function for manual removal on process exit
	process.on("SIGINT", cleanup);
	process.on("SIGTERM", cleanup);

	// Handle case where the function process exits on its own
	proc.once("exit", (code: number | null, signal: string | null) => {
		// Clean up the Map entry
		runningFunctions.delete(name);
		// Remove the signal listeners to prevent leaks
		process.off("SIGINT", cleanup);
		process.off("SIGTERM", cleanup);
		console.log(`Function "${name}" exited with code ${code}, signal ${signal}`);
	});

	console.log(`Function ${name} running at http://localhost:${port}`);
}

/**
 * Build a function for deployment
 */
async function runFunctionBuild(name: string | undefined, projectRoot: string): Promise<void> {
	if (!name) {
		logger.error("Function name is required");
		console.log("Usage: bb function build <name>");
		return;
	}

	console.log(`Building function "${name}"...`);

	const result = await bundleFunction(name, projectRoot);

	if (!result.success) {
		logger.error("Build failed:");
		for (const error of result.errors) {
			console.log(`  - ${error}`);
		}
		return;
	}

	const sizeKB = (result.size / 1024).toFixed(2);
	console.log("Build successful!");
	console.log(`  Output: ${result.outputPath}`);
	console.log(`  Size: ${sizeKB} KB`);
}

/**
 * List all functions
 */
async function runFunctionList(projectRoot: string): Promise<void> {
	const functions = await listFunctions(projectRoot);

	if (functions.length === 0) {
		console.log("No functions found. Create one with: bb function create <name>");
		return;
	}

	console.log("\nFunctions:\n");
	console.log("  Name          | Runtime              | Status");
	console.log("  --------------|----------------------|-------");

	for (const fn of functions) {
		const built = await isFunctionBuilt(fn.name, projectRoot);
		const status = built ? "built" : "not built";
		const runtime = fn.runtime;
		console.log(`  ${fn.name.padEnd(14)} | ${runtime.padEnd(20)} | ${status}`);
	}

	console.log("");
}

/**
 * Show function logs
 */
async function runFunctionLogs(name: string | undefined, projectRoot: string): Promise<void> {
	if (!name) {
		logger.error("Function name is required");
		console.log("Usage: bb function logs <name>");
		return;
	}

	const config = await readFunctionConfig(name, projectRoot);
	const runtime = config?.runtime ?? "cloudflare-workers";

	console.log(`Fetching logs for "${name}" (${runtime})...`);

	if (runtime === "cloudflare-workers") {
		const result = await getCloudflareLogs(name, projectRoot);

		if (!result.success) {
			logger.error(result.message || "Failed to get logs");
			console.log("\nTo view Cloudflare Worker logs:");
			console.log("  1. Install wrangler: bun add -g wrangler");
			console.log("  2. Run: wrangler tail <name>");
			return;
		}

		console.log("\nLogs:");
		for (const log of result.logs) {
			console.log(log);
		}
	} else {
		const result = await getVercelLogs(name);

		if (!result.success) {
			logger.error(result.message || "Failed to get logs");
			console.log("\nTo view Vercel logs:");
			console.log("  1. Install vercel: bun add -g vercel");
			console.log("  2. Run: vercel logs <name>");
			return;
		}

		console.log("\nLogs:");
		for (const log of result.logs) {
			console.log(log);
		}
	}
}

/**
 * Deploy a function
 */
async function runFunctionDeploy(
	name: string | undefined,
	projectRoot: string,
	syncEnv: boolean,
): Promise<void> {
	if (!name) {
		logger.error("Function name is required");
		console.log("Usage: bb function deploy <name> [--sync-env]");
		return;
	}

	const functionsDir = join(projectRoot, "src", "functions", name);

	if (!existsSync(functionsDir)) {
		logger.error(`Function "${name}" not found`);
		return;
	}

	// First, build the function
	console.log(`Building function "${name}" before deployment...`);
	const buildResult = await bundleFunction(name, projectRoot);

	if (!buildResult.success) {
		logger.error("Build failed:");
		for (const error of buildResult.errors) {
			console.log(`  - ${error}`);
		}
		return;
	}

	console.log(`Build successful (${(buildResult.size / 1024).toFixed(2)} KB)\n`);

	// Get function config
	const config = await readFunctionConfig(name, projectRoot);
	const runtime = config?.runtime ?? "cloudflare-workers";

	console.log(`Deploying to ${runtime}...`);

	let deployResult: DeployResult | undefined;

	if (runtime === "cloudflare-workers") {
		deployResult = await deployToCloudflare(
			name,
			buildResult.outputPath,
			config ?? { name, runtime: "cloudflare-workers", env: [] },
			projectRoot,
		);
	} else {
		deployResult = await deployToVercel(
			name,
			buildResult.outputPath,
			config ?? { name, runtime: "vercel-edge", env: [] },
			projectRoot,
		);
	}

	if (!deployResult.success) {
		logger.error("Deployment failed:");
		for (const log of deployResult.logs) {
			console.log(`  ${log}`);
		}
		return;
	}

	console.log("\nDeployment successful!");
	console.log(`  URL: ${deployResult.url}`);

	// Handle env sync
	if (syncEnv && config && config.env.length > 0) {
		console.log(`\nSyncing ${config.env.length} environment variables...`);

		// Read .env file
		const envPath = join(projectRoot, ".env");
		const envValues: Record<string, string> = {};

		if (existsSync(envPath)) {
			const envContent = readFileSync(envPath, "utf-8");
			const envLines = envContent.split("\n");

			for (const line of envLines) {
				const trimmed = line.trim();
				if (trimmed && !trimmed.startsWith("#")) {
					const [key, ...valueParts] = trimmed.split("=");
					if (key && config.env.includes(key)) {
						envValues[key] = valueParts.join("=").trim();
					}
				}
			}
		}

		const missing: string[] = [];
		for (const envVar of config.env) {
			if (!envValues[envVar]) {
				missing.push(envVar);
			}
		}

		if (missing.length > 0) {
			console.log(`\nWarning: Missing env vars in .env: ${missing.join(", ")}`);
		}

		console.log("\nThe following env vars will be synced:");
		for (const envVar of config.env) {
			const isSet = envValues[envVar] !== undefined;
			console.log(`  ${envVar} = ${isSet ? "(set)" : "(not set)"}`);
		}

		if (runtime === "cloudflare-workers") {
			const syncResult = await syncEnvToCloudflare(name, config, projectRoot, envValues);
			if (syncResult.success) {
				console.log(`\n${syncResult.message}`);
			} else {
				logger.error(syncResult.message);
			}
		}
	}
}

/**
 * Stop all running functions
 */
export async function stopAllFunctions(): Promise<void> {
	const stopPromises: Promise<void>[] = [];

	for (const [name, proc] of runningFunctions) {
		console.log(`Stopping function "${name}"...`);
		stopPromises.push(killProcess(proc));
	}

	// Wait for all processes to terminate
	await Promise.all(stopPromises);

	runningFunctions.clear();
}
