/**
 * Build the CLI as a standalone bundled executable output.
 */
export async function buildStandaloneCli(): Promise<void> {
  const result = await Bun.build({
    entrypoints: ['./src/index.ts'],
    outdir: './dist',
    target: 'bun',
    format: 'esm',
    minify: false,
    sourcemap: 'external',
    naming: 'index.js',
  });

  if (!result.success) {
    throw new Error(`Build failed with ${result.logs.length} error(s).`);
  }

  const outputPath = './dist/index.js';
  const compiled = await Bun.file(outputPath).text();
  await Bun.write(outputPath, `#!/usr/bin/env bun\n${compiled}`);
}

await buildStandaloneCli();
