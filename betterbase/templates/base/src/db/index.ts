import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { env, DEFAULT_DB_PATH } from '../lib/env';
import * as schema from './schema';

export { DEFAULT_DB_PATH };

const sqlite = new Database(env.DB_PATH || DEFAULT_DB_PATH, { create: true });

export const db = drizzle(sqlite, { schema });
