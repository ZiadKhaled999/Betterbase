import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import * as logger from '../utils/logger';
import * as prompts from '../utils/prompts';

const projectNameSchema = z
  .string()
  .trim()
  .min(1)
  .regex(/^[a-zA-Z0-9-_]+$/, 'Project name can only contain letters, numbers, hyphens, and underscores.');

const initOptionsSchema = z.object({
  projectName: projectNameSchema.optional(),
});

const databaseModeSchema = z.enum(['local', 'neon', 'turso']);

type DatabaseMode = z.infer<typeof databaseModeSchema>;

export type InitCommandOptions = z.infer<typeof initOptionsSchema>;

function getDatabaseLabel(databaseMode: DatabaseMode): string {
  if (databaseMode === 'neon') {
    return 'Neon (serverless Postgres)';
  }

  if (databaseMode === 'turso') {
    return 'Turso (edge SQLite)';
  }

  return 'SQLite (local.db)';
}

async function installDependencies(projectPath: string): Promise<void> {
  const installProcess = Bun.spawn(['bun', 'install'], {
    cwd: projectPath,
    stdout: 'inherit',
    stderr: 'inherit',
  });

  const exitCode = await installProcess.exited;

  if (exitCode !== 0) {
    throw new Error('Dependency installation failed. Please run `bun install` manually.');
  }
}

async function initializeGitRepository(projectPath: string): Promise<void> {
  const gitProcess = Bun.spawn(['git', 'init'], {
    cwd: projectPath,
    stdout: 'ignore',
    stderr: 'ignore',
  });

  const exitCode = await gitProcess.exited;

  if (exitCode !== 0) {
    logger.warn('Git initialization failed. You can run `git init` manually.');
  }
}

function buildPackageJson(databaseMode: DatabaseMode, useAuth: boolean): string {
  const dependencies: Record<string, string> = {
    hono: '^4.11.9',
    'drizzle-orm': '^0.36.4',
    zod: '^3.25.76',
  };

  if (databaseMode === 'turso') {
    dependencies['@libsql/client'] = '^0.14.0';
  } else {
    dependencies['better-sqlite3'] = '^11.7.0';
  }

  if (databaseMode === 'neon') {
    dependencies.pg = '^8.13.1';
  }

  if (useAuth) {
    dependencies['better-auth'] = '^1.1.15';
  }

  const json = {
    name: 'betterbase-app',
    private: true,
    type: 'module',
    scripts: {
      dev: 'bun run src/routes/index.ts',
      'db:generate': 'drizzle-kit generate',
      'db:push': 'drizzle-kit push',
    },
    dependencies,
    devDependencies: {
      '@types/bun': '^1.3.9',
      'drizzle-kit': '^0.27.2',
      typescript: '^5.9.3',
    },
  };

  return `${JSON.stringify(json, null, 2)}\n`;
}

function buildDrizzleConfig(databaseMode: DatabaseMode): string {
  const driver = databaseMode === 'neon' ? 'pg' : 'better-sqlite3';

  return `import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  driver: '${driver}',
  dbCredentials: {
    url: process.env.DATABASE_URL || 'file:local.db',
  },
});
`;
}

function buildDbIndex(databaseMode: DatabaseMode): string {
  if (databaseMode === 'neon') {
    return `import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export const db = drizzle(pool, { schema });
`;
  }

  if (databaseMode === 'turso') {
    return `import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from './schema';

const client = createClient({
  url: process.env.DATABASE_URL || 'file:local.db',
});

export const db = drizzle(client, { schema });
`;
  }

  return `import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import * as schema from './schema';

const client = new Database('local.db');

export const db = drizzle(client, { schema });
`;
}

function buildAuthMiddleware(): string {
  return `import { createMiddleware } from 'hono/factory';

export const authMiddleware = createMiddleware(async (c, next) => {
  // TODO: wire BetterAuth session validation.
  await next();
});
`;
}

function buildReadme(projectName: string): string {
  return `# ${projectName}

Generated with BetterBase CLI.

## Scripts

- \`bun run dev\`
- \`bun run db:generate\`
- \`bun run db:push\`
`;
}

async function writeProjectFiles(projectPath: string, databaseMode: DatabaseMode, useAuth: boolean): Promise<void> {
  await mkdir(path.join(projectPath, 'src/db'), { recursive: true });
  await mkdir(path.join(projectPath, 'src/routes'), { recursive: true });
  await mkdir(path.join(projectPath, 'src/middleware'), { recursive: true });
  await mkdir(path.join(projectPath, 'src/lib'), { recursive: true });

  await writeFile(
    path.join(projectPath, 'betterbase.config.ts'),
    `export default {
  mode: '${databaseMode}',
  database: {
    local: 'sqlite://local.db',
    production: process.env.DATABASE_URL,
  },
  auth: {
    enabled: ${useAuth},
  },
};
`,
  );

  await writeFile(path.join(projectPath, 'drizzle.config.ts'), buildDrizzleConfig(databaseMode));

  await writeFile(
    path.join(projectPath, 'package.json'),
    buildPackageJson(databaseMode, useAuth),
  );

  await writeFile(
    path.join(projectPath, 'tsconfig.json'),
    `{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noImplicitAny": true,
    "esModuleInterop": true,
    "types": ["bun"],
    "skipLibCheck": true
  },
  "include": ["src/**/*.ts", "drizzle.config.ts", "betterbase.config.ts"]
}
`,
  );

  await writeFile(
    path.join(projectPath, '.env.example'),
    `DATABASE_URL=
NODE_ENV=development
PORT=3000
`,
  );

  await writeFile(
    path.join(projectPath, '.gitignore'),
    `node_modules
bun.lockb
.env
local.db
.drizzle
`,
  );

  await writeFile(
    path.join(projectPath, 'README.md'),
    buildReadme(path.basename(projectPath)),
  );

  await writeFile(
    path.join(projectPath, 'src/db/schema.ts'),
    `import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  email: text('email').notNull().unique(),
  name: text('name'),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});
`,
  );

  await writeFile(path.join(projectPath, 'src/db/index.ts'), buildDbIndex(databaseMode));

  await writeFile(
    path.join(projectPath, 'src/routes/health.ts'),
    `import { Hono } from 'hono';

export const healthRoute = new Hono();

healthRoute.get('/', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});
`,
  );

  await writeFile(
    path.join(projectPath, 'src/routes/index.ts'),
    `import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { healthRoute } from './health';

const app = new Hono();

app.use('*', logger());
app.route('/health', healthRoute);

export default {
  port: Number(process.env.PORT || 3000),
  fetch: app.fetch,
};
`,
  );

  await writeFile(
    path.join(projectPath, 'src/lib/utils.ts'),
    `export function notImplemented(feature: string): never {
  throw new Error(\`\${feature} is not implemented yet.\`);
}
`,
  );

  if (useAuth) {
    await writeFile(path.join(projectPath, 'src/middleware/auth.ts'), buildAuthMiddleware());
  }
}

/**
 * Run the `bb init` command.
 */
export async function runInitCommand(rawOptions: InitCommandOptions): Promise<void> {
  const options = initOptionsSchema.parse(rawOptions);

  const projectNameInput =
    options.projectName ??
    (await prompts.text({
      message: 'What is your project name?',
      initial: 'my-betterbase-app',
    }));

  const projectName = projectNameSchema.parse(projectNameInput);
  const projectPath = path.resolve(process.cwd(), projectName);

  const databaseMode = databaseModeSchema.parse(
    await prompts.select({
      message: 'Choose your database setup:',
      initial: 'local',
      choices: [
        { name: 'Local SQLite (development only)', value: 'local' },
        { name: 'Connect to Neon (serverless Postgres)', value: 'neon' },
        { name: 'Connect to Turso (edge SQLite)', value: 'turso' },
      ],
    }),
  );

  const useAuth = await prompts.confirm({
    message: 'Add authentication? (yes/no)',
    initial: true,
  });

  const useGit = await prompts.confirm({
    message: 'Initialize git repository? (yes/no)',
    initial: true,
  });

  try {
    await mkdir(projectPath);
  } catch {
    throw new Error(`Directory \`${projectName}\` already exists. Choose another project name.`);
  }

  try {
    logger.info('Creating project files...');
    await writeProjectFiles(projectPath, databaseMode, useAuth);

    logger.info('Installing dependencies with bun...');
    await installDependencies(projectPath);

    if (useGit) {
      logger.info('Initializing git repository...');
      await initializeGitRepository(projectPath);
    }

    logger.success('✅ BetterBase project created successfully!');
    console.log('');
    console.log(`📁 Project: ${projectName}`);
    console.log(`🗄️  Database: ${getDatabaseLabel(databaseMode)}`);
    console.log(`🔐 Auth: ${useAuth ? 'Enabled' : 'Disabled'}`);
    console.log('');
    console.log('Next steps:');
    console.log(`  cd ${projectName}`);
    console.log('  bun run dev');
    console.log('');
    console.log('Your backend is running at http://localhost:3000');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown init error';
    throw new Error(`Failed to initialize project: ${message}`);
  }
}
