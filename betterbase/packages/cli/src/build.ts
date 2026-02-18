import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Build the CLI as a standalone bundled executable output.
 */
export async function buildStandaloneCli(): Promise<void> {
  const moduleDir = path.dirname(fileURLToPath(import.meta.url));
  const entrypoint = path.resolve(moduleDir, 'index.ts');
  const outdir = path.resolve(moduleDir, '../dist');

  const result = await Bun.build({
    entrypoints: [entrypoint],
    outdir,
    target: 'bun',
    format: 'esm',
    minify: false,
    sourcemap: 'external',
    naming: 'index.js',
  });

  if (!result.success) {
    const diagnostics = result.logs.map((log) => (typeof log === 'string' ? log : JSON.stringify(log))).join('\n');
    throw new Error(`Build failed with ${result.logs.length} error(s).\n${diagnostics}`);
  }

  const outputPath = path.join(outdir, 'index.js');
  const compiled = await Bun.file(outputPath).text();
  await Bun.write(outputPath, `#!/usr/bin/env bun\n${compiled}`);
}

async function main(): Promise<void> {
  await buildStandaloneCli();
}

const isEsmMain = typeof import.meta !== 'undefined' && import.meta.main;

if (isEsmMain) {
  main().catch((error) => {
    console.error('Build failed:', error);
    process.exit(1);
  });
}
