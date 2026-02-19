import { existsSync, watch, type FSWatcher } from 'node:fs';
import path from 'node:path';
import { ContextGenerator } from '../utils/context-generator';
import * as logger from '../utils/logger';

export async function runDevCommand(projectRoot: string = process.cwd()): Promise<() => void> {
  const generator = new ContextGenerator();

  await generator.generate(projectRoot);

  const watchPaths = [path.join(projectRoot, 'src/db/schema.ts'), path.join(projectRoot, 'src/routes')];
  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  const watchers: FSWatcher[] = [];

  for (const watchPath of watchPaths) {
    if (!existsSync(watchPath)) {
      logger.warn(`Watch path does not exist; skipping: ${watchPath}`);
      continue;
    }

    try {
      const watcher = watch(watchPath, { recursive: true }, (_eventType, filename) => {
        logger.info(`File changed: ${String(filename ?? '')}`);

        const existing = timers.get(watchPath);
        if (existing) {
          clearTimeout(existing);
        }

        const timer = setTimeout(async () => {
          logger.info('Regenerating context...');
          const start = Date.now();

          try {
            await generator.generate(projectRoot);
            logger.info(`Context updated in ${Date.now() - start}ms`);
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            logger.error(`Failed to regenerate context: ${message}`);
          }
        }, 250);

        timers.set(watchPath, timer);
      });

      watchers.push(watcher);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.warn(`Failed to watch path ${watchPath}: ${message}`);
    }
  }

  logger.info('Watching for schema and route changes...');

  return () => {
    for (const timer of timers.values()) {
      clearTimeout(timer);
    }
    timers.clear();

    for (const watcher of watchers) {
      watcher.close();
    }
  };
}
