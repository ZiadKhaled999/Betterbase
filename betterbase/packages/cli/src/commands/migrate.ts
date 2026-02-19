import { Database } from 'bun:sqlite';
import chalk from 'chalk';
import { access, mkdir, readdir } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { DEFAULT_DB_PATH } from '../constants';
import * as logger from '../utils/logger';
import * as prompts from '../utils/prompts';

const migrateOptionsSchema = z.object({
  preview: z.boolean().optional(),
  production: z.boolean().optional(),
});

export type MigrateCommandOptions = z.infer<typeof migrateOptionsSchema>;

export type MigrationChangeType = 'create_table' | 'add_column' | 'modify_column' | 'drop_column' | 'drop_table';

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
}

interface MigrationBackup {
  sourcePath: string;
  backupPath: string;
}

const DRIZZLE_DIR = 'drizzle';
const DRIZZLE_TIMEOUT_MS = 30_000;

function captureIdentifier(match: RegExpMatchArray, startIndex: number): string {
  return match[startIndex] ?? match[startIndex + 1] ?? match[startIndex + 2] ?? '';
}

async function runDrizzleKit(args: string[]): Promise<DrizzleResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DRIZZLE_TIMEOUT_MS);

  const proc = Bun.spawn(['bunx', 'drizzle-kit', ...args], {
    cwd: process.cwd(),
    stdout: 'pipe',
    stderr: 'pipe',
    signal: controller.signal,
  });

  try {
    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ]);

    return { success: exitCode === 0, stdout, stderr };
  } catch {
    return {
      success: false,
      stdout: '',
      stderr: `drizzle-kit ${args.join(' ')} timed out after ${DRIZZLE_TIMEOUT_MS / 1000}s`,
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function listSqlFiles(baseDir: string): Promise<Map<string, string>> {
  const entries = new Map<string, string>();
  const root = path.join(process.cwd(), baseDir);

  const walk = async (dir: string): Promise<void> => {
    try {
      await access(dir);
    } catch {
      return;
    }

    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
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
  const ident = '(?:"([^"]+)"|`([^`]+)`|([\\w.-]+))';

  for (const statement of sqlStatements) {
    const sql = statement.trim();
    if (!sql) continue;

    const createTable = sql.match(new RegExp(`create\\s+table(?:\\s+if\\s+not\\s+exists)?\\s+${ident}`, 'i'));
    if (createTable) {
      changes.push({ type: 'create_table', table: captureIdentifier(createTable, 1), isDestructive: false, detail: sql });
      continue;
    }

    const dropTable = sql.match(new RegExp(`drop\\s+table(?:\\s+if\\s+exists)?\\s+${ident}`, 'i'));
    if (dropTable) {
      changes.push({ type: 'drop_table', table: captureIdentifier(dropTable, 1), isDestructive: true, detail: sql });
      continue;
    }

    const addColumn = sql.match(
      new RegExp(`alter\\s+table(?:\\s+if\\s+exists)?\\s+${ident}\\s+add\\s+column(?:\\s+if\\s+not\\s+exists)?\\s+${ident}`, 'i'),
    );
    if (addColumn) {
      changes.push({
        type: 'add_column',
        table: captureIdentifier(addColumn, 1),
        column: captureIdentifier(addColumn, 4),
        isDestructive: false,
        detail: sql,
      });
      continue;
    }

    const dropColumn = sql.match(
      new RegExp(`alter\\s+table(?:\\s+if\\s+exists)?\\s+${ident}\\s+drop\\s+column(?:\\s+if\\s+exists)?\\s+${ident}`, 'i'),
    );
    if (dropColumn) {
      changes.push({
        type: 'drop_column',
        table: captureIdentifier(dropColumn, 1),
        column: captureIdentifier(dropColumn, 4),
        isDestructive: true,
        detail: sql,
      });
      continue;
    }

    const alterColumn = sql.match(
      new RegExp(
        `alter\\s+table(?:\\s+if\\s+exists)?\\s+${ident}\\s+(?:alter\\s+column\\s+${ident}|rename\\s+column\\s+${ident})`,
        'i',
      ),
    );
    if (alterColumn) {
      changes.push({
        type: 'modify_column',
        table: captureIdentifier(alterColumn, 1),
        column: captureIdentifier(alterColumn, 4) || captureIdentifier(alterColumn, 7),
        isDestructive: /drop\s+not\s+null|set\s+not\s+null|set\s+data\s+type|rename\s+column/i.test(sql),
        detail: sql,
      });
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

  if (newTables.length) {
    console.log(chalk.green('✅ New Tables:'));
    newTables.forEach((change) => console.log(chalk.green(`  + ${change.table}`)));
    console.log('');
  }

  if (newColumns.length) {
    console.log(chalk.green('✅ New Columns:'));
    newColumns.forEach((change) => console.log(chalk.green(`  + ${change.table}.${change.column ?? ''}`)));
    console.log('');
  }

  if (modified.length) {
    console.log(chalk.yellow('⚠️  Modified Columns:'));
    modified.forEach((change) => console.log(chalk.yellow(`  ! ${change.table}.${change.column ?? ''}`)));
    console.log('');
  }

  if (destructive.length) {
    console.log(chalk.red('❌ Destructive Changes:'));
    destructive.forEach((change) => {
      console.log(chalk.red(`  - ${change.type}: ${change.table}${change.column ? `.${change.column}` : ''}`));
      console.log(chalk.red('    ⚠️  This will DELETE DATA'));
    });
    console.log('');
  }
}

async function confirmDestructive(changes: MigrationChange[]): Promise<boolean> {
  const destructive = changes.filter((c) => c.isDestructive);
  if (destructive.length === 0) return true;

  logger.warn('DESTRUCTIVE CHANGES DETECTED:');
  destructive.forEach((change) => console.log(`  - ${change.type}: ${change.table}${change.column ? `.${change.column}` : ''}`));

  const confirmation = await prompts.text({ message: 'Type "delete data" to confirm:' });
  if (confirmation !== 'delete data') {
    logger.warn('Confirmation phrase mismatch. Migration cancelled.');
    return false;
  }

  return true;
}

async function backupDatabase(): Promise<MigrationBackup | null> {
  const sourcePath = process.env.DB_PATH ?? DEFAULT_DB_PATH;

  try {
    await access(sourcePath);
  } catch {
    logger.warn(`No local database found at ${sourcePath}; skipping backup.`);
    return null;
  }

  const timestamp = new Date().toISOString().replace(/:/g, '-');
  const backupDir = path.join(process.cwd(), 'backups');
  await mkdir(backupDir, { recursive: true });

  const backupPath = path.join(backupDir, `db-${timestamp}.sqlite`);

  const db = new Database(sourcePath, { readonly: true });
  try {
    await Bun.write(backupPath, db.serialize());
  } finally {
    db.close();
  }

  logger.success(`Backup saved: ${backupPath}`);
  return { sourcePath, backupPath };
}

async function restoreBackup(backup: MigrationBackup | null): Promise<void> {
  if (backup === null) return;
  const bytes = await Bun.file(backup.backupPath).bytes();
  await Bun.write(backup.sourcePath, bytes);
  logger.warn(`Rollback complete. Restored database from ${backup.backupPath}`);
}

function splitStatements(sql: string): string[] {
  return sql
    .split(/;\s*/g)
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
    if (previous === content) continue;

    // Intentionally analyze full changed file content: drizzle-kit typically creates new migration files,
    // so whole-file analysis is simpler and reliable. If in-place edits become common, switch to a true diff.
    changedSql.push(...splitStatements(content));
  }

  return analyzeMigration(changedSql);
}

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
    const proceed = await prompts.confirm({ message: 'Apply migrations to production now?', initial: false });
    if (!proceed) {
      logger.warn('Migration cancelled by user.');
      return;
    }
  }

  let backup: MigrationBackup | null = null;
  if (changes.some((change) => change.isDestructive)) {
    backup = await backupDatabase();
    const confirmed = await confirmDestructive(changes);
    if (!confirmed) return;
  }

  logger.info('Applying migrations with drizzle-kit push...');
  const push = await runDrizzleKit(['push']);

  if (!push.success) {
    await restoreBackup(backup);

    if (/\b(?:connect(?:ion)?|econnrefused|econnreset|enotfound|etimedout)\b/i.test(push.stderr)) {
      throw new Error(`Database connection failed while applying migration.\n${push.stderr}`);
    }

    if (/conflict|merge/i.test(push.stderr)) {
      throw new Error(`Migration conflict detected during push. Please resolve and retry.\n${push.stderr}`);
    }

    throw new Error(`Migration push failed.\n${push.stderr || push.stdout}`);
  }

  logger.success('Migration complete!');
}
