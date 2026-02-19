import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { migrate } from 'drizzle-orm/bun-sqlite/migrator';
import { DEFAULT_DB_PATH } from '../lib/env';

try {
  const sqlite = new Database(DEFAULT_DB_PATH, { create: true });
  const db = drizzle(sqlite);

  migrate(db, { migrationsFolder: './drizzle' });
  console.log('Migrations applied successfully.');
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error('Failed to apply migrations:', message);
  process.exit(1);
}
