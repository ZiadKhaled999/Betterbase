Document 1: bb dev Hot Reload
File: 01_bb_dev_hot_reload.md
The problem: bb dev only regenerates context. It never starts the server. The developer runs bun run dev in a separate terminal manually.
The fix: spawn bun --hot src/index.ts as a managed child process inside runDevCommand. Bun's --hot flag handles HMR natively — we just manage the process lifecycle.
Replace entire packages/cli/src/commands/dev.ts with:
typescriptimport path from "node:path";
import { existsSync } from "node:fs";
import { watch } from "node:fs";
import type { FSWatcher } from "node:fs";
import { ContextGenerator } from "../utils/context-generator";
import * as logger from "../utils/logger";

type BunSubprocess = ReturnType<typeof Bun.spawn>;

const RESTART_DELAY_MS = 1000;
const DEBOUNCE_MS = 250;
const SERVER_ENTRY = "src/index.ts";

class ServerManager {
  private process: BunSubprocess | null = null;
  private projectRoot: string;
  private isShuttingDown = false;
  private restartTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
  }

  start(): void {
    const entryPath = path.join(this.projectRoot, SERVER_ENTRY);
    if (!existsSync(entryPath)) {
      logger.error(
        `Server entry not found: ${SERVER_ENTRY}\n` +
        `Run bb dev from your project root.\n` +
        `Expected: ${entryPath}`
      );
      process.exit(1);
    }
    this.spawn();
  }

  private spawn(): void {
    if (this.isShuttingDown) return;
    logger.info(`Starting server: bun --hot ${SERVER_ENTRY}`);
    this.process = Bun.spawn({
      cmd: ["bun", "--hot", SERVER_ENTRY],
      cwd: this.projectRoot,       // CRITICAL: must be project root, not CLI dir
      stdout: "inherit",           // pipe server logs directly to terminal
      stderr: "inherit",
      env: { ...process.env },
      onExit: (_proc, exitCode, signalCode) => {
        this.handleExit(exitCode, signalCode);
      },
    });
    logger.success(`Server started (PID: ${this.process.pid})`);
  }

  private handleExit(exitCode: number | null, signalCode: string | null): void {
    if (this.isShuttingDown) return; // we stopped it intentionally
    if (signalCode) return;          // we sent the signal
    logger.error(`Server crashed (code ${exitCode ?? "unknown"}). Restarting in ${RESTART_DELAY_MS / 1000}s...`);
    this.restartTimer = setTimeout(() => {
      logger.info("Restarting server...");
      this.spawn();
    }, RESTART_DELAY_MS);
  }

  stop(): void {
    this.isShuttingDown = true;
    if (this.restartTimer) { clearTimeout(this.restartTimer); this.restartTimer = null; }
    if (this.process) { this.process.kill("SIGTERM"); this.process = null; }
  }
}

export async function runDevCommand(projectRoot: string = process.cwd()): Promise<() => void> {
  logger.info(`Starting BetterBase dev in: ${projectRoot}`);

  const generator = new ContextGenerator();
  try {
    await generator.generate(projectRoot);
    logger.success("Context generated.");
  } catch (error) {
    logger.warn(`Context generation failed: ${error instanceof Error ? error.message : String(error)}`);
  }

  const server = new ServerManager(projectRoot);
  server.start();

  const watchPaths = [
    path.join(projectRoot, "src/db/schema.ts"),
    path.join(projectRoot, "src/routes"),
  ];
  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  const watchers: FSWatcher[] = [];

  for (const watchPath of watchPaths) {
    if (!existsSync(watchPath)) { logger.warn(`Watch path missing, skipping: ${watchPath}`); continue; }
    try {
      const watcher = watch(watchPath, { recursive: true }, (_eventType, filename) => {
        logger.info(`File changed: ${String(filename ?? "")}`);
        const existing = timers.get(watchPath);
        if (existing) clearTimeout(existing);
        const timer = setTimeout(async () => {
          logger.info("Regenerating context...");
          const start = Date.now();
          try {
            await generator.generate(projectRoot);
            logger.success(`Context updated in ${Date.now() - start}ms`);
          } catch (error) {
            logger.error(`Context regeneration failed: ${error instanceof Error ? error.message : String(error)}`);
          }
        }, DEBOUNCE_MS);
        timers.set(watchPath, timer);
      });
      watchers.push(watcher);
    } catch (error) {
      logger.warn(`Failed to watch ${watchPath}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  logger.info("Watching for changes. Press Ctrl+C to stop.\n");

  return () => {
    logger.info("Shutting down...");
    server.stop();
    for (const timer of timers.values()) clearTimeout(timer);
    timers.clear();
    for (const watcher of watchers) watcher.close();
    logger.success("Stopped.");
  };
}
Also verify packages/cli/src/index.ts has signal handlers for bb dev:
typescript.action(async (projectRoot?: string) => {
  const cleanup = await runDevCommand(projectRoot);
  process.on("SIGINT", () => { cleanup(); process.exit(0); });
  process.on("SIGTERM", () => { cleanup(); process.exit(0); });
});
Without these, Ctrl+C orphans the server process and the port stays locked.