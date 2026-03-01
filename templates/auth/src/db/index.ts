import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { accounts, sessions } from "./auth-schema";
import * as schema from "./schema";

// Merge all schemas for Drizzle
const fullSchema = {
	...schema,
	sessions,
	accounts,
};

// Note: In a real app, you'd import env from '../lib/env'
// For the auth template, we use a default path
const DB_PATH = process.env.DB_PATH || "./data/auth.db";

const sqlite = new Database(DB_PATH, { create: true });

export const db = drizzle(sqlite, { schema: fullSchema });

// Re-export all schema tables
export { users } from "./schema";
export { sessions, accounts };
