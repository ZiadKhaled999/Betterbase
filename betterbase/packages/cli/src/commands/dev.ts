import { watch } from 'node:fs';
import path from 'node:path';
import { ContextGenerator } from '../utils/context-generator';

export async function runDevCommand(projectRoot: string = process.cwd()): Promise<void> {
  const generator = new ContextGenerator();

  await generator.generate(projectRoot);

  const watchPaths = [path.join(projectRoot, 'src/db/schema.ts'), path.join(projectRoot, 'src/routes')];

  for (const watchPath of watchPaths) {
    watch(watchPath, { recursive: true }, async (_eventType, filename) => {
      console.log(`📝 File changed: ${String(filename ?? '')}`);
      console.log('🔄 Regenerating context...');

      const start = Date.now();
      try {
        await generator.generate(projectRoot);
        console.log(`✅ Context updated in ${Date.now() - start}ms`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`❌ Failed to regenerate context: ${message}`);
      }
    });
  }

  console.log('👀 Watching for schema and route changes...');
}
