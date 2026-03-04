import { type FSWatcher, existsSync, watch } from "node:fs";
import path from "node:path";
import { ContextGenerator } from "../utils/context-generator";
import * as logger from "../utils/logger";

const RESTART_DELAY_MS = 1000;
const DEBOUNCE_MS = 250;
const SERVER_ENTRY = "src/index.ts";

/**
 * Manages the dev server lifecycle with hot reload support
 */
class ServerManager {
	private process: ReturnType<typeof Bun.spawn> | null = null;
	private projectRoot: string;
	private isRunning = false;
	private restartTimeout: ReturnType<typeof setTimeout> | null = null;

	constructor(projectRoot: string) {
		this.projectRoot = projectRoot;
	}

	/**
	 * Start the dev server
	 */
	start(): void {
		if (this.isRunning) {
			logger.warn("Server is already running");
			return;
		}

		logger.info("Starting dev server...");
		this.spawnProcess();
		this.isRunning = true;
	}

	/**
	 * Stop the dev server gracefully using SIGTERM
	 */
	stop(): void {
		if (!this.isRunning || !this.process) {
			return;
		}

		logger.info("Stopping dev server...");

		// Clear any pending restart
		if (this.restartTimeout) {
			clearTimeout(this.restartTimeout);
			this.restartTimeout = null;
		}

		// Set isRunning to false to prevent restart on crash
		this.isRunning = false;

		// Send SIGTERM for graceful shutdown
		this.process.kill("SIGTERM");

		// Note: We don't immediately null out this.process here because
		// the onExit callback needs to handle cleanup when the process actually exits.
		// Instead, we rely on isRunning=false to prevent restart behavior.

		logger.success("Dev server stopped");
	}

	/**
	 * Restart the server (stop and start)
	 */
	restart(): void {
		logger.info("Restarting dev server...");

		// Clear any pending restart timeout to avoid double restarts
		if (this.restartTimeout) {
			clearTimeout(this.restartTimeout);
			this.restartTimeout = null;
		}

		// If we're already running, stop first and let onExit handle the restart
		if (this.isRunning && this.process) {
			this.process.kill("SIGTERM");
			// Don't set isRunning to false here - let onExit handle the restart
			// This prevents race conditions between stop and auto-restart
		} else {
			// Not running, just start directly
			this.spawnProcess();
			this.isRunning = true;
		}
	}

	/**
	 * Spawn the bun process with hot reload
	 */
	private spawnProcess(): void {
		this.process = Bun.spawn({
			cmd: ["bun", "--hot", SERVER_ENTRY],
			cwd: this.projectRoot,
			stdout: "inherit",
			stderr: "inherit",
			env: { ...process.env },
			onExit: (proc, exitCode, signal) => {
				if (this.isRunning) {
					// Server crashed - schedule a restart
					logger.warn(`Server exited with code ${exitCode} (signal: ${signal})`);
					logger.info("Restarting server...");

					// Clear any pending restart to avoid double restarts
					if (this.restartTimeout) {
						clearTimeout(this.restartTimeout);
						this.restartTimeout = null;
					}

					// Delay before restarting to avoid rapid restarts
					this.restartTimeout = setTimeout(() => {
						this.spawnProcess();
						this.isRunning = true; // Explicitly set state after spawn
						this.restartTimeout = null;
					}, RESTART_DELAY_MS);
				} else {
					// Explicit stop (via stop() or restart()) - clean up
					this.process = null;
					logger.info("Dev server stopped");
				}
			},
		});

		logger.success("Dev server started");
	}
}

export async function runDevCommand(projectRoot: string = process.cwd()): Promise<() => void> {
	const generator = new ContextGenerator();

	// Generate initial context
	logger.info("Generating initial context...");
	await generator.generate(projectRoot);

	// Start the server manager
	const serverManager = new ServerManager(projectRoot);
	serverManager.start();

	// Set up file watchers for context regeneration
	const watchPaths = [
		path.join(projectRoot, "src/db/schema.ts"),
		path.join(projectRoot, "src/routes"),
	];
	const timers = new Map<string, ReturnType<typeof setTimeout>>();
	const watchers: FSWatcher[] = [];

	for (const watchPath of watchPaths) {
		if (!existsSync(watchPath)) {
			logger.warn(`Watch path does not exist; skipping: ${watchPath}`);
			continue;
		}

		try {
			const watcher = watch(watchPath, { recursive: true }, (_eventType, filename) => {
				logger.info(`File changed: ${String(filename ?? "")}`);

				const existing = timers.get(watchPath);
				if (existing) {
					clearTimeout(existing);
				}

				const timer = setTimeout(async () => {
					logger.info("Regenerating context...");
					const start = Date.now();

					try {
						await generator.generate(projectRoot);
						logger.success(`Context updated in ${Date.now() - start}ms`);
					} catch (error) {
						const message = error instanceof Error ? error.message : String(error);
						logger.error(`Failed to regenerate context: ${message}`);
					}
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
	return () => {
		// Stop the server
		serverManager.stop();

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
