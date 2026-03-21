import { type FSWatcher, existsSync, readFileSync, statSync, watch } from "node:fs";
import path from "node:path";
import { ContextGenerator } from "../utils/context-generator";
import * as logger from "../utils/logger";

/**
 * Load environment variables from .env file
 * 
 * @param projectRoot - Project root directory
 * @returns Record of environment variables
 */
function loadEnvFile(projectRoot: string): Record<string, string> {
	const envPath = path.join(projectRoot, '.env');
	const envVars: Record<string, string> = {};

	if (existsSync(envPath)) {
		try {
			const content = readFileSync(envPath, 'utf-8');
			const lines = content.split('\n');
			
			for (const line of lines) {
				const trimmed = line.trim();
				// Skip comments and empty lines
				if (!trimmed || trimmed.startsWith('#')) {
					continue;
				}
				
				const equalIndex = trimmed.indexOf('=');
				if (equalIndex > 0) {
					const key = trimmed.substring(0, equalIndex).trim();
					let value = trimmed.substring(equalIndex + 1).trim();
					
					// Remove quotes if present
					if ((value.startsWith('"') && value.endsWith('"')) ||
						(value.startsWith("'") && value.endsWith("'"))) {
						value = value.slice(1, -1);
					}
					
					envVars[key] = value;
				}
			}
			
			logger.info('Loaded environment variables from .env');
		} catch (error) {
			logger.warn(`Failed to load .env file: ${error}`);
		}
	}

	return envVars;
}

const RESTART_DELAY_MS = 1000;
const DEBOUNCE_MS = 250;
const SERVER_ENTRY = "src/index.ts";
const GRACEFUL_SHUTDOWN_TIMEOUT_MS = 10000; // 10 seconds timeout for graceful shutdown

/**
 * Server state enumeration for proper state machine
 */
enum ServerState {
	STOPPED = "stopped",
	STARTING = "starting",
	RUNNING = "running",
	STOPPING = "stopping",
	RESTARTING = "restarting",
}

/**
 * Manages the dev server lifecycle with hot reload support
 * Fixed version with proper process lifecycle management
 */
class ServerManager {
	private process: ReturnType<typeof Bun.spawn> | null = null;
	private projectRoot: string;
	private envVars: Record<string, string>;
	private state: ServerState = ServerState.STOPPED;
	private restartTimeout: ReturnType<typeof setTimeout> | null = null;
	private abortController: AbortController | null = null;
	private exitPromise: Promise<void> | null = null;
	private resolveExit: (() => void) | null = null;

	constructor(projectRoot: string, envVars: Record<string, string> = {}) {
		this.projectRoot = projectRoot;
		this.envVars = envVars;
	}

	/**
	 * Get current running state
	 */
	isRunning(): boolean {
		return this.state === ServerState.RUNNING || this.state === ServerState.STARTING;
	}

	/**
	 * Start the dev server
	 */
	start(): void {
		if (this.isRunning()) {
			logger.warn("Server is already running");
			return;
		}

		logger.info("Starting dev server...");
		this.state = ServerState.STARTING;
		this.abortController = new AbortController();

		try {
			this.spawnProcess(this.envVars);
			this.state = ServerState.RUNNING;
		} catch (error) {
			// Spawn failed - reset to stopped state
			this.state = ServerState.STOPPED;
			this.abortController = null;
			const message = error instanceof Error ? error.message : String(error);
			logger.error(`Failed to start dev server: ${message}`);
			throw error;
		}
	}

	/**
	 * Stop the dev server gracefully using SIGTERM with guaranteed termination
	 */
	async stop(): Promise<void> {
		if (this.state === ServerState.STOPPED || this.state === ServerState.STOPPING) {
			return;
		}

		logger.info("Stopping dev server...");
		this.state = ServerState.STOPPING;

		// Clear any pending restart
		if (this.restartTimeout) {
			clearTimeout(this.restartTimeout);
			this.restartTimeout = null;
		}

		// Cancel any pending restarts via abort controller
		if (this.abortController) {
			this.abortController.abort();
			this.abortController = null;
		}

		// Send SIGTERM for graceful shutdown if process exists
		if (this.process) {
			this.process.kill("SIGTERM");

			// Wait for process to actually terminate with timeout
			try {
				await this.waitForTermination(GRACEFUL_SHUTDOWN_TIMEOUT_MS);
			} catch {
				// Timeout - force kill
				logger.warn("Graceful shutdown timed out, forcing kill...");
				this.process.kill("SIGKILL");
				await this.waitForTermination(1000);
			}
		}

		// Clean up
		this.process = null;
		this.state = ServerState.STOPPED;
		logger.success("Dev server stopped");
	}

	/**
	 * Wait for process termination with optional timeout
	 */
	private async waitForTermination(timeoutMs: number): Promise<void> {
		if (!this.process) {
			return;
		}

		// Create exit promise that resolves when process exits
		const exitPromise = this.process.exited;

		// Create timeout promise
		const timeoutPromise = new Promise<void>((_, reject) => {
			setTimeout(() => reject(new Error("Termination timeout")), timeoutMs);
		});

		// Race between exit and timeout
		await Promise.race([exitPromise, timeoutPromise]);
	}

	/**
	 * Restart the server (stop and start) with proper synchronization
	 */
	async restart(): Promise<void> {
		logger.info("Restarting dev server...");

		// Clear any pending restart timeout to avoid double restarts
		if (this.restartTimeout) {
			clearTimeout(this.restartTimeout);
			this.restartTimeout = null;
		}

		// Cancel any pending restart via abort controller
		if (this.abortController) {
			this.abortController.abort();
		}

		// If we're running or starting, stop first and wait for it
		if (this.process) {
			// Kill the current process
			this.process.kill("SIGTERM");

			// Wait for termination with timeout
			try {
				await this.waitForTermination(GRACEFUL_SHUTDOWN_TIMEOUT_MS);
			} catch {
				// Timeout - force kill
				this.process.kill("SIGKILL");
				await this.waitForTermination(1000);
			}

			// Clean up old process
			this.process = null;
		}

		// Create new abort controller for new instance
		this.abortController = new AbortController();

		// Start the new process
		this.state = ServerState.STARTING;

		try {
			this.spawnProcess(this.envVars);
			this.state = ServerState.RUNNING;
		} catch (error) {
			this.state = ServerState.STOPPED;
			this.abortController = null;
			const message = error instanceof Error ? error.message : String(error);
			logger.error(`Failed to restart dev server: ${message}`);
			throw error;
		}
	}

	/**
	 * Spawn the bun process with hot reload
	 */
	private spawnProcess(envVars: Record<string, string> = {}): void {
		// Check if we've been stopped/aborted while waiting
		if (this.abortController?.signal.aborted) {
			return;
		}

		let proc: ReturnType<typeof Bun.spawn>;
		try {
			// Merge loaded env vars with process.env
			const mergedEnv = { ...process.env, ...envVars };
			
			proc = Bun.spawn({
				cmd: [process.execPath, "--hot", SERVER_ENTRY],
				cwd: this.projectRoot,
				stdout: "inherit",
				stderr: "inherit",
				env: mergedEnv,
			});
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			logger.error(`Failed to spawn process: ${message}`);
			throw error;
		}

		// Store process reference
		this.process = proc;

		// Set up exit handler with proper process tracking
		// We capture the process in a local variable to avoid race conditions
		const currentProcess = proc;

		// Use proc.exited to properly wait for process termination
		proc.exited.then(async (exitedCode) => {
			// Check if we should restart or not
			const shouldRestart = this.state === ServerState.RUNNING;
			const isStopping = this.state === ServerState.STOPPING;

			// Clear the process reference
			this.process = null;

			if (shouldRestart && !this.abortController?.signal.aborted) {
				// Server crashed - schedule a restart
				logger.warn(`Server exited with code ${exitedCode}`);
				logger.info("Restarting server...");

				// Clear any pending restart to avoid double restarts
				if (this.restartTimeout) {
					clearTimeout(this.restartTimeout);
					this.restartTimeout = null;
				}

				// Delay before restarting to avoid rapid restarts
				this.restartTimeout = setTimeout(() => {
					// Check if we should still restart (not stopped in the meantime)
					if (this.state === ServerState.RUNNING && this.abortController && !this.abortController.signal.aborted) {
						try {
							this.spawnProcess(this.envVars);
						} catch (error) {
							const message = error instanceof Error ? error.message : String(error);
							logger.error(`Failed to restart: ${message}`);
							this.state = ServerState.STOPPED;
						}
					}
				}, RESTART_DELAY_MS);
			} else if (isStopping) {
				// Explicit stop - resolve exit promise if waiting
				if (this.resolveExit) {
					this.resolveExit();
					this.resolveExit = null;
				}
				logger.info("Dev server stopped");
			} else {
				// Unexpected exit when not running - reset state
				this.state = ServerState.STOPPED;
			}
		}).catch((error) => {
			// Handle any errors in the exit promise
			const message = error instanceof Error ? error.message : String(error);
			logger.error(`Process exit error: ${message}`);
			this.process = null;
			if (this.state === ServerState.RUNNING) {
				this.state = ServerState.STOPPED;
			}
		});

		logger.success("Dev server started");
	}
}

export async function runDevCommand(projectRoot: string = process.cwd()): Promise<() => void> {
	const generator = new ContextGenerator();

	// Load environment variables from .env file
	const envVars = loadEnvFile(projectRoot);

	// Check if functions directory exists
	const functionsDir = path.join(projectRoot, 'src', 'functions');
	const functionsEnabled = existsSync(functionsDir);

	if (functionsEnabled) {
		logger.info('Functions directory detected - functions will be available at /functions/:name');
	}

	// Generate initial context
	logger.info("Generating initial context...");
	await generator.generate(projectRoot);

	// Start the server manager with env vars
	const serverManager = new ServerManager(projectRoot, envVars);
	serverManager.start();

	// Set up file watchers for context regeneration
	const watchPaths = [
		path.join(projectRoot, "src/db/schema.ts"),
		path.join(projectRoot, "src/routes"),
	];

	// Add functions directory to watch paths if it exists
	if (functionsEnabled) {
		watchPaths.push(functionsDir);
	}
	const timers = new Map<string, ReturnType<typeof setTimeout>>();
	const watchers: FSWatcher[] = [];

	for (const watchPath of watchPaths) {
		if (!existsSync(watchPath)) {
			logger.warn(`Watch path does not exist; skipping: ${watchPath}`);
			continue;
		}

		try {
			// Only use recursive option for directories on supported platforms (darwin/win32)
			const isDir = statSync(watchPath).isDirectory();
			const isSupportedPlatform = process.platform === "darwin" || process.platform === "win32";
			const opts = isDir && isSupportedPlatform ? { recursive: true } : undefined;

			const watcher = watch(watchPath, opts, (_eventType, filename) => {
				logger.info(`File changed: ${String(filename ?? "")}`);

				const existing = timers.get(watchPath);
				if (existing) {
					clearTimeout(existing);
				}

				const timer = setTimeout(() => {
					// Wrap async callback to properly handle rejections
					(async () => {
						logger.info("Regenerating context...");
						const start = Date.now();

						try {
							await generator.generate(projectRoot);
							logger.success(`Context updated in ${Date.now() - start}ms`);
						} catch (error) {
							const message = error instanceof Error ? error.message : String(error);
							logger.error(`Failed to regenerate context: ${message}`);
						}
					})().catch((error: unknown) => {
						// Handle any errors from the async callback to prevent unhandled rejections
						const message = error instanceof Error ? error.message : String(error);
						logger.error(`Timer error: ${message}`);
					});
				}, DEBOUNCE_MS);

				timers.set(watchPath, timer);
			});

			watchers.push(watcher);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			logger.warn(`Failed to watch path ${watchPath}: ${message}`);
		}
	}

	logger.info("Watching for schema and route changes...");

	// Return cleanup function
	return async () => {
		// Stop the server (now async for proper process termination)
		await serverManager.stop();

		// Clear all debounce timers
		for (const timer of timers.values()) {
			clearTimeout(timer);
		}
		timers.clear();

		// Close all file watchers
		for (const watcher of watchers) {
			watcher.close();
		}
	};
}
