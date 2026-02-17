#!/usr/bin/env node

/**
 * Legacy bb wrapper entrypoint.
 *
 * Forwards execution to the canonical CLI implementation in packages/cli.
 */
export async function runLegacyCli(): Promise<void> {
  const cliModule = await import('../../../packages/cli/src/index');
  await cliModule.runCli(process.argv);
}

if (import.meta.main) {
  await runLegacyCli();
}
