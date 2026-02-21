import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { env } from '../lib/env';
import * as schema from './schema';


// env.DB_PATH is always present because env schema provides a default.
const sqlite = new Database(env.DB_PATH, { create: true });

export const db = drizzle(sqlite, { schema });
