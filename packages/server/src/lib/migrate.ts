import { join } from "path";
import { readFile, readdir } from "fs/promises";
import type { Pool } from "pg";

const MIGRATIONS_DIR = join(__dirname, "../../migrations");

export async function runMigrations(pool: Pool): Promise<void> {
	// Ensure tracking table exists before we query it
	await pool.query(`
    CREATE SCHEMA IF NOT EXISTS betterbase_meta;
    CREATE EXTENSION IF NOT EXISTS pgcrypto;
    CREATE TABLE IF NOT EXISTS betterbase_meta.migrations (
      id SERIAL PRIMARY KEY,
      filename TEXT NOT NULL UNIQUE,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

	const files = (await readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith(".sql")).sort();

	const { rows: applied } = await pool.query<{ filename: string }>(
		"SELECT filename FROM betterbase_meta.migrations",
	);
	const appliedSet = new Set(applied.map((r) => r.filename));

	for (const file of files) {
		if (appliedSet.has(file)) continue;

		const sql = await readFile(join(MIGRATIONS_DIR, file), "utf-8");
		await pool.query(sql);
		await pool.query("INSERT INTO betterbase_meta.migrations (filename) VALUES ($1)", [file]);
		console.log(`[migrate] Applied: ${file}`);
	}

	console.log("[migrate] All migrations up to date.");
}
