/**
 * Local Functions Runtime
 *
 * Provides local development server for edge functions with hot reload.
 * Functions are loaded from src/functions/:name/index.ts
 */

import { watch } from "node:fs";
import { existsSync, statSync } from "node:fs";
import path from "node:path";
import type { Context, Handler } from "hono";
import { logger } from "../logger";

/**
 * Function context passed to each function handler
 */
export type FunctionContext = {
	request: Request;
	env: Record<string, string>;
};

/**
 * Function handler signature - a function that processes requests
 */
export type FunctionHandler = (ctx: FunctionContext) => Promise<Response> | Response;

/**
 * Loaded function metadata
 */
type LoadedFunction = {
	name: string;
	handler: FunctionHandler;
	lastModified: number;
};

/**
 * Local Functions Runtime
 *
 * Manages loading and executing functions locally during development.
 * Supports hot reload when function files are modified.
 */
export class LocalFunctionsRuntime {
	private functions = new Map<string, LoadedFunction>();
	private functionsDir: string;
	private envVars: Record<string, string>;
	private watcher: ReturnType<typeof watch> | null = null;

	/**
	 * Create a new LocalFunctionsRuntime
	 *
	 * @param functionsDir - Path to the functions directory (e.g., src/functions)
	 * @param envVars - Environment variables to pass to functions
	 */
	constructor(functionsDir: string, envVars: Record<string, string> = {}) {
		this.functionsDir = functionsDir;
		this.envVars = envVars;
	}

	/**
	 * Get the functions directory path
	 */
	getFunctionsDir(): string {
		return this.functionsDir;
	}

	/**
	 * Check if functions directory exists
	 */
	functionsDirExists(): boolean {
		return existsSync(this.functionsDir);
	}

	/**
	 * Load a function by name
	 *
	 * @param name - Function name (directory name in src/functions)
	 * @returns Loaded function with handler
	 * @throws Error if function not found or invalid
	 */
	async loadFunction(name: string): Promise<LoadedFunction> {
		const functionPath = path.join(this.functionsDir, name, "index.ts");

		if (!existsSync(functionPath)) {
			throw new Error(`Function not found: ${name}`);
		}

		const stat = statSync(functionPath);

		// Clear require cache for hot reload (Node.js compatibility)
		// For Bun, we use dynamic import which naturally handles cache
		try {
			// Use dynamic import with cache-busting query for hot reload
			const timestamp = Date.now();
			const module = await import(`file://${functionPath}?t=${timestamp}`);

			if (!module.default || typeof module.default !== "function") {
				throw new Error(`Function ${name} must export a default function`);
			}

			const loaded: LoadedFunction = {
				name,
				handler: module.default,
				lastModified: stat.mtime.getTime(),
			};

			this.functions.set(name, loaded);
			logger.debug({ msg: `Function loaded`, function: name });
			return loaded;
		} catch (error) {
			logger.error({ msg: `Failed to load function`, function: name, error });
			throw error;
		}
	}

	/**
	 * Execute a function by name
	 *
	 * @param name - Function name
	 * @param request - HTTP request to pass to the function
	 * @returns Response from the function
	 */
	async executeFunction(name: string, request: Request): Promise<Response> {
		let func = this.functions.get(name);

		if (!func) {
			// Function not loaded yet, load it
			func = await this.loadFunction(name);
		} else {
			// Check if modified (hot reload)
			const functionPath = path.join(this.functionsDir, name, "index.ts");

			if (existsSync(functionPath)) {
				const stat = statSync(functionPath);

				if (stat.mtime.getTime() > func.lastModified) {
					logger.info({ msg: `Hot reloading function`, function: name });
					func = await this.loadFunction(name);
				}
			}
		}

		const ctx: FunctionContext = {
			request,
			env: this.envVars,
		};

		try {
			return await func.handler(ctx);
		} catch (error) {
			logger.error({ msg: `Function execution error`, function: name, error });
			return new Response(
				JSON.stringify({
					error: "Internal Server Error",
					message: error instanceof Error ? error.message : String(error),
				}),
				{ status: 500, headers: { "Content-Type": "application/json" } },
			);
		}
	}

	/**
	 * Start watching for file changes in the functions directory
	 * Triggers hot reload when .ts files are modified
	 */
	startWatcher(): void {
		if (!existsSync(this.functionsDir)) {
			logger.warn({ msg: `Functions directory not found`, path: this.functionsDir });
			return;
		}

		this.watcher = watch(this.functionsDir, { recursive: true }, (eventType, filename) => {
			if (filename && filename.endsWith(".ts")) {
				// Extract function name from path (first segment)
				const parts = filename.split(path.sep);
				const functionName = parts[0];

				if (functionName && functionName !== "functions") {
					logger.info({ msg: `File changed, invalidating cache`, file: filename });
					this.functions.delete(functionName);
				}
			}
		});

		logger.info({ msg: `Watching functions directory`, path: this.functionsDir });
	}

	/**
	 * Stop watching for file changes
	 */
	stopWatcher(): void {
		if (this.watcher) {
			this.watcher.close();
			this.watcher = null;
			logger.debug({ msg: `Stopped watching functions directory` });
		}
	}

	/**
	 * Get list of available functions
	 *
	 * @returns Array of function names
	 */
	async listFunctions(): Promise<string[]> {
		if (!existsSync(this.functionsDir)) {
			return [];
		}

		const { readdirSync } = await import("node:fs");
		const entries = readdirSync(this.functionsDir, { withFileTypes: true });
		const functions: string[] = [];

		for (const entry of entries) {
			if (entry.isDirectory()) {
				const indexPath = path.join(this.functionsDir, entry.name, "index.ts");
				if (existsSync(indexPath)) {
					functions.push(entry.name);
				}
			}
		}

		return functions;
	}
}

/**
 * Create Hono middleware for function routing
 *
 * @param runtime - LocalFunctionsRuntime instance
 * @returns Hono middleware handler
 */
export function createFunctionsMiddleware(runtime: LocalFunctionsRuntime): Handler {
	return async (c: Context) => {
		const functionName = c.req.param("name");

		if (!functionName) {
			return c.json({ error: "Function name required" }, 400);
		}

		try {
			const response = await runtime.executeFunction(functionName, c.req.raw);
			return response;
		} catch (error) {
			if (error instanceof Error && error.message.includes("not found")) {
				return c.json({ error: `Function not found: ${functionName}` }, 404);
			}
			logger.error({ msg: `Function middleware error`, function: functionName, error });
			return c.json({ error: "Internal Server Error" }, 500);
		}
	};
}

/**
 * Initialize functions runtime for development
 *
 * @param projectRoot - Project root directory
 * @param envVars - Environment variables
 * @returns LocalFunctionsRuntime instance or null if no functions directory
 */
export async function initializeFunctionsRuntime(
	projectRoot: string,
	envVars: Record<string, string> = process.env as Record<string, string>,
): Promise<LocalFunctionsRuntime | null> {
	const functionsDir = path.join(projectRoot, "src", "functions");

	if (!existsSync(functionsDir)) {
		logger.debug({ msg: `No functions directory found`, path: functionsDir });
		return null;
	}

	const runtime = new LocalFunctionsRuntime(functionsDir, envVars);
	runtime.startWatcher();

	const functions = await runtime.listFunctions();
	logger.info({ msg: `Functions runtime initialized`, functions });

	return runtime;
}
