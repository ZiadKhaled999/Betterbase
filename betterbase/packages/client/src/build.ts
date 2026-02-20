import path from 'node:path';

const moduleDir = import.meta.dir;
const entrypoint = path.resolve(moduleDir, 'index.ts');
const outdir = path.resolve(moduleDir, '../dist');

const esmResult = await Bun.build({
  entrypoints: [entrypoint],
  outdir,
  target: 'browser',
  format: 'esm',
  minify: false,
  sourcemap: 'external',
  naming: 'index.js',
});

if (!esmResult.success) {
  console.error('ESM build failed:', esmResult.logs);
  process.exit(1);
}

const cjsResult = await Bun.build({
  entrypoints: [entrypoint],
  outdir,
  target: 'node',
  format: 'cjs',
  minify: false,
  sourcemap: 'external',
  naming: 'index.cjs',
});

if (!cjsResult.success) {
  console.error('CJS build failed:', cjsResult.logs);
  process.exit(1);
}

const proc = Bun.spawn(['bunx', 'tsc', '--project', 'tsconfig.json', '--emitDeclarationOnly', '--outDir', outdir], {
  cwd: path.resolve(moduleDir, '..'),
  stdout: 'inherit',
  stderr: 'inherit',
});

const exitCode = await proc.exited;
if (exitCode !== 0) {
  console.error('TypeScript declaration generation failed');
  process.exit(1);
}

console.log('✅ Build complete!');
