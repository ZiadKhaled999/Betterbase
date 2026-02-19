import chalk from 'chalk';
import { mkdir, readdir } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import * as logger from '../utils/logger';
import * as prompts from '../utils/prompts';

const migrateOptionsSchema = z.object({
  preview: z.boolean().optional(),
  production: z.boolean().optional(),
});

export type MigrateCommandOptions = z.infer<typeof migrateOptionsSchema>;

export type MigrationChangeType =
  | 'create_table'
  | 'add_column'
  | 'modify_column'
  | 'drop_column'
  | 'drop_table';

export interface MigrationChange {
  type: MigrationChangeType;
  table: string;
  column?: string;
  detail?: string;
  isDestructive: boolean;
}

interface DrizzleResult {
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number;
}

interface MigrationBackup {
  sourcePath: string;
  backupPath: string;
}

const DRIZZLE_DIR = 'drizzle';
const DEFAULT_DB_PATH = 'local.db';

async function runDrizzleKit(args: string[]): Promise<DrizzleResult> {
  const proc = Bun.spawn(['bunx', 'drizzle-kit', ...args], {
    cwd: process.cwd(),
    stdout: 'pipe',
    stderr: 'pipe',
  });

  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);

  return {
    success: exitCode === 0,
    stdout,
    stderr,
    exitCode,
  };
}

async function listSqlFiles(baseDir: string): Promise<Map<string, string>> {
  const entries = new Map<string, string>();
  const root = path.join(process.cwd(), baseDir);

  const walk = async (dir: string): Promise<void> => {
    if (!(await Bun.file(dir).exists())) {
      return;
    }

    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        await walk(fullPath);
        continue;
      }

      const stat = await Bun.file(fullPath).stat();
      if (stat.isDirectory()) {
        await walk(fullPath);
        continue;
      }

      if (!fullPath.endsWith('.sql')) {
        continue;
      }

      entries.set(path.relative(root, fullPath), await Bun.file(fullPath).text());
    }
  };

  await walk(root);
  return entries;
}

function analyzeMigration(sqlStatements: string[]): MigrationChange[] {
  const changes: MigrationChange[] = [];

  for (const statement of sqlStatements) {
    const sql = statement.trim();
    if (!sql) {
      continue;
    }

    const createTable = sql.match(/create\s+table\s+"?([\w.-]+)"?/i);
    if (createTable) {
      changes.push({ type: 'create_table', table: createTable[1], isDestructive: false, detail: sql });
      continue;
    }

    const dropTable = sql.match(/drop\s+table\s+"?([\w.-]+)"?/i);
    if (dropTable) {
      changes.push({ type: 'drop_table', table: dropTable[1], isDestructive: true, detail: sql });
      continue;
    }

    const addColumn = sql.match(/alter\s+table\s+"?([\w.-]+)"?\s+add\s+column\s+"?([\w.-]+)"?/i);
    if (addColumn) {
      changes.push({
        type: 'add_column',
        table: addColumn[1],
        column: addColumn[2],
        isDestructive: false,
        detail: sql,
      });
      continue;
    }

    const dropColumn = sql.match(/alter\s+table\s+"?([\w.-]+)"?\s+drop\s+column\s+"?([\w.-]+)"?/i);
    if (dropColumn) {
      changes.push({
        type: 'drop_column',
        table: dropColumn[1],
        column: dropColumn[2],
        isDestructive: true,
        detail: sql,
      });
      continue;
    }

    const alterColumn = sql.match(
      /alter\s+table\s+"?([\w.-]+)"?\s+(alter\s+column\s+"?([\w.-]+)"?|rename\s+column\s+"?([\w.-]+)"?)/i,
    );
    if (alterColumn) {
      changes.push({
        type: 'modify_column',
        table: alterColumn[1],
        column: alterColumn[3] ?? alterColumn[4],
        isDestructive: /drop\s+not\s+null|set\s+not\s+null|set\s+data\s+type/i.test(sql),
        detail: sql,
      });
      continue;
    }
  }

  return changes;
}

function displayDiff(changes: MigrationChange[]): void {
  console.log('\n📊 Migration Preview\n');

  if (changes.length === 0) {
    console.log(chalk.gray('No schema changes detected.'));
    return;
  }

  const newTables = changes.filter((c) => c.type === 'create_table');
  const newColumns = changes.filter((c) => c.type === 'add_column');
  const modified = changes.filter((c) => c.type === 'modify_column');
  const destructive = changes.filter((c) => c.isDestructive);

  if (newTables.length > 0) {
    console.log(chalk.green('✅ New Tables:'));
    for (const change of newTables) {
      console.log(chalk.green(`  + ${change.table}`));
    }
    console.log('');
  }

  if (newColumns.length > 0) {
    console.log(chalk.green('✅ New Columns:'));
    for (const change of newColumns) {
      console.log(chalk.green(`  + ${change.table}.${change.column ?? ''}`));
    }
    console.log('');
  }

  if (modified.length > 0) {
    console.log(chalk.yellow('⚠️  Modified Columns:'));
    for (const change of modified) {
      console.log(chalk.yellow(`  ! ${change.table}.${change.column ?? ''}`));
    }
    console.log('');
  }

  if (destructive.length > 0) {
    console.log(chalk.red('❌ Destructive Changes:'));
    for (const change of destructive) {
      console.log(chalk.red(`  - ${change.type}: ${change.table}${change.column ? `.${change.column}` : ''}`));
      console.log(chalk.red('    ⚠️  This will DELETE DATA'));
    }
    console.log('');
  }
}

async function confirmDestructive(changes: MigrationChange[]): Promise<boolean> {
  const destructive = changes.filter((c) => c.isDestructive);

  if (destructive.length === 0) {
    return true;
  }

  logger.warn('DESTRUCTIVE CHANGES DETECTED:');
  for (const change of destructive) {
    console.log(`  - ${change.type}: ${change.table}${change.column ? `.${change.column}` : ''}`);
  }

  const confirmation = await prompts.text({ message: 'Type "delete data" to confirm:' });
  if (confirmation !== 'delete data') {
    logger.warn('Confirmation phrase mismatch. Migration cancelled.');
    return false;
  }

  return true;
}

async function backupDatabase(): Promise<MigrationBackup | null> {
  const sourcePath = process.env.DB_PATH ?? DEFAULT_DB_PATH;
  const source = Bun.file(sourcePath);

  if (!(await source.exists())) {
    logger.warn(`No local database found at ${sourcePath}; skipping backup.`);
    return null;
  }

  const timestamp = new Date().toISOString().replace(/:/g, '-');
  const backupDir = path.join(process.cwd(), 'backups');
  await mkdir(backupDir, { recursive: true });

  const backupPath = path.join(backupDir, `db-${timestamp}.sqlite`);
  await Bun.write(backupPath, source);
  logger.success(`Backup saved: ${backupPath}`);

  return { sourcePath, backupPath };
}

async function restoreBackup(backup: MigrationBackup | null): Promise<void> {
  if (backup === null) {
    return;
  }

  await Bun.write(backup.sourcePath, Bun.file(backup.backupPath));
  logger.warn(`Rollback complete. Restored database from ${backup.backupPath}`);
}

function splitStatements(sql: string): string[] {
  return sql
    .split(/;\s*(?:\n|$)/g)
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0);
}

async function collectChangesFromGenerate(): Promise<MigrationChange[]> {
  const before = await listSqlFiles(DRIZZLE_DIR);
  const generate = await runDrizzleKit(['generate']);

  if (!generate.success) {
    if (/conflict|merge/i.test(generate.stderr)) {
      throw new Error(`Migration conflict detected. Resolve migration files manually.\n${generate.stderr}`);
    }

    throw new Error(`Failed to generate migrations.\n${generate.stderr || generate.stdout}`);
  }

  const after = await listSqlFiles(DRIZZLE_DIR);
  const changedSql: string[] = [];

  for (const [relativePath, content] of after.entries()) {
    const previous = before.get(relativePath);
    if (previous === content) {
      continue;
    }

    changedSql.push(...splitStatements(content));
  }

  return analyzeMigration(changedSql);
}

/**
 * Run the `bb migrate` command.
 */
export async function runMigrateCommand(rawOptions: MigrateCommandOptions): Promise<void> {
  const options = migrateOptionsSchema.parse(rawOptions);

  logger.info('Generating migration files with drizzle-kit...');
  const changes = await collectChangesFromGenerate();
  displayDiff(changes);

  if (options.preview) {
    logger.info('Preview mode enabled. No migrations applied.');
    return;
  }

  if (options.production) {
    const proceed = await prompts.confirm({
      message: 'Apply migrations to production now?',
      initial: false,
    });

    if (!proceed) {
      logger.warn('Migration cancelled by user.');
      return;
    }
  }

  let backup: MigrationBackup | null = null;

  if (changes.some((change) => change.isDestructive)) {
    backup = await backupDatabase();

    const confirmed = await confirmDestructive(changes);
    if (!confirmed) {
      return;
    }
  }

  logger.info('Applying migrations with drizzle-kit push...');
  const push = await runDrizzleKit(['push']);

  if (!push.success) {
    await restoreBackup(backup);

    if (/connect|econn|database/i.test(push.stderr)) {
      throw new Error(`Database connection failed while applying migration.\n${push.stderr}`);
    }

    if (/conflict|merge/i.test(push.stderr)) {
      throw new Error(`Migration conflict detected during push. Please resolve and retry.\n${push.stderr}`);
    }

    throw new Error(`Migration push failed.\n${push.stderr || push.stdout}`);
  }

  logger.success('Migration complete!');
}
