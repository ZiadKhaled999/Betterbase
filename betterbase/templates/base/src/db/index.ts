import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { env, DEFAULT_DB_PATH } from '../lib/env';
import * as schema from './schema';

export { DEFAULT_DB_PATH };

// env.DB_PATH is always present because env schema provides a default.
const sqlite = new Database(env.DB_PATH, { create: true });

export const db = drizzle(sqlite, { schema });
