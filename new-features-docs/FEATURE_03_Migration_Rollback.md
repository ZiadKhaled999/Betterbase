# Feature 3: Database Migration Rollback

**Priority**: High (Week 3-4)  
**Complexity**: Medium  
**Dependencies**: Structured Logging  
**Estimated Effort**: 1-2 weeks

---

## Problem Statement

Drizzle generates migrations but provides NO rollback mechanism. If a migration breaks production:
- No safe way to undo
- Manual SQL intervention required
- Risk of data loss
- Downtime while fixing

---

## Solution

Implement up/down migration pairs with tracking table:
- `0001_initial_up.sql` + `0001_initial_down.sql`
- `_betterbase_migrations` table tracks applied migrations
- `bb migrate:rollback` command safely reverts

---

## Implementation Steps

### Step 1: Create Migration Tracking Schema

**File**: `packages/cli/src/commands/migrate-schema.sql` (NEW FILE)

```sql
CREATE TABLE IF NOT EXISTS _betterbase_migrations (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  checksum TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_migrations_name 
  ON _betterbase_migrations(name);
```

---

### Step 2: Create Migration Utilities

**File**: `packages/cli/src/commands/migrate-utils.ts` (NEW FILE)

```typescript
import { createHash } from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';

export type MigrationFile = {
  id: string;
  name: string;
  upPath: string;
  downPath: string | null;
  upSql: string;
  downSql: string | null;
  checksum: string;
};

export type AppliedMigration = {
  id: number;
  name: string;
  applied_at: Date;
  checksum: string;
};

export function calculateChecksum(sql: string): string {
  return createHash('sha256').update(sql.trim()).digest('hex');
}

export function parseMigrationFilename(filename: string) {
  const match = filename.match(/^(\d+)_(.+)_(up|down)\.sql$/);
  if (!match) return null;
  
  return {
    id: match[1],
    name: `${match[1]}_${match[2]}`,
    direction: match[3] as 'up' | 'down',
  };
}

export async function loadMigrationFiles(dir: string): Promise<MigrationFile[]> {
  const files = await fs.readdir(dir);
  const sqlFiles = files.filter(f => f.endsWith('.sql'));
  
  const migrationMap = new Map<string, Partial<MigrationFile>>();
  
  for (const file of sqlFiles) {
    const parsed = parseMigrationFilename(file);
    if (!parsed) continue;
    
    const filePath = path.join(dir, file);
    const sql = await fs.readFile(filePath, 'utf-8');
    
    if (!migrationMap.has(parsed.id)) {
      migrationMap.set(parsed.id, { id: parsed.id, name: parsed.name });
    }
    
    const migration = migrationMap.get(parsed.id)!;
    
    if (parsed.direction === 'up') {
      migration.upPath = filePath;
      migration.upSql = sql;
      migration.checksum = calculateChecksum(sql);
    } else {
      migration.downPath = filePath;
      migration.downSql = sql;
    }
  }
  
  const migrations: MigrationFile[] = [];
  for (const [id, m] of migrationMap) {
    if (!m.upPath || !m.upSql) {
      throw new Error(`Migration ${id} missing up file`);
    }
    
    migrations.push({
      id: m.id,
      name: m.name!,
      upPath: m.upPath,
      downPath: m.downPath || null,
      upSql: m.upSql,
      downSql: m.downSql || null,
      checksum: m.checksum!,
    });
  }
  
  migrations.sort((a, b) => a.id.localeCompare(b.id));
  return migrations;
}

export async function getAppliedMigrations(db: any): Promise<AppliedMigration[]> {
  // Create tracking table if doesn't exist
  await db.execute(`
    CREATE TABLE IF NOT EXISTS _betterbase_migrations (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      checksum TEXT NOT NULL
    );
  `);
  
  const result = await db.execute(
    'SELECT * FROM _betterbase_migrations ORDER BY id ASC'
  );
  return result.rows as AppliedMigration[];
}
```

---

### Step 3: Implement Rollback Command

**File**: `packages/cli/src/commands/migrate.ts`

**ADD**:

```typescript
export async function runMigrateRollbackCommand(
  projectRoot: string,
  options: { steps?: number } = {}
): Promise<void> {
  const { steps = 1 } = options;
  
  logger.info(`Rolling back last ${steps} migration(s)...`);
  
  const db = await loadDatabaseConnection(projectRoot);
  const migrationsDir = path.join(projectRoot, 'migrations');
  const allMigrations = await loadMigrationFiles(migrationsDir);
  const applied = await getAppliedMigrations(db);
  
  if (applied.length === 0) {
    logger.warn('No migrations to rollback');
    return;
  }
  
  let rolledBack = 0;
  for (let i = 0; i < steps; i++) {
    const lastMigration = applied[applied.length - 1];
    if (!lastMigration) break;
    
    const migration = allMigrations.find(m => m.name === lastMigration.name);
    
    if (!migration?.downSql) {
      logger.error(`Migration ${lastMigration.name} has no down file`);
      logger.info(`Create ${lastMigration.name}_down.sql to enable rollback`);
      process.exit(1);
    }
    
    logger.info(`Rolling back: ${migration.name}`);
    
    try {
      await db.execute(migration.downSql);
      await db.execute({
        sql: 'DELETE FROM _betterbase_migrations WHERE name = ?',
        args: [migration.name],
      });
      
      logger.success(`✅ Rolled back: ${migration.name}`);
      rolledBack++;
      applied.pop();
    } catch (error) {
      logger.error(`Failed to rollback: ${error}`);
      process.exit(1);
    }
  }
  
  logger.success(`✅ Rolled back ${rolledBack} migration(s)`);
}

export async function runMigrateHistoryCommand(projectRoot: string) {
  const db = await loadDatabaseConnection(projectRoot);
  const applied = await getAppliedMigrations(db);
  
  if (applied.length === 0) {
    logger.info('No migrations applied');
    return;
  }
  
  console.log('\nMigration History:\n');
  console.log('ID | Name                    | Applied At');
  console.log('---|-------------------------|-------------------');
  
  for (const m of applied) {
    console.log(`${m.id.toString().padEnd(2)} | ${m.name.padEnd(23)} | ${m.applied_at}`);
  }
}
```

---

### Step 4: Register Commands

**File**: `packages/cli/src/index.ts`

```typescript
program
  .command('migrate:rollback')
  .description('Rollback last migration')
  .option('-s, --steps <number>', 'Number of migrations', '1')
  .action(async (options) => {
    await runMigrateRollbackCommand(process.cwd(), {
      steps: parseInt(options.steps),
    });
  });

program
  .command('migrate:history')
  .description('Show migration history')
  .action(async () => {
    await runMigrateHistoryCommand(process.cwd());
  });
```

---

## Acceptance Criteria

- [ ] Migrations tracking table created
- [ ] `bb migrate` records migrations in tracking table
- [ ] `bb migrate:rollback` reverts last migration
- [ ] `bb migrate:rollback --steps=3` reverts last 3
- [ ] `bb migrate:history` shows applied migrations
- [ ] Migration files: `0001_name_up.sql` + `0001_name_down.sql`
- [ ] Error if down file missing
- [ ] Test: Apply → rollback → verify DB state restored
