import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

/**
 * Represents a migration file with its up/down SQL and metadata
 */
export type MigrationFile = {
	id: string;
	name: string;
	upPath: string;
	downPath: string | null;
	upSql: string;
	downSql: string | null;
	checksum: string;
};

/**
 * Represents a migration that has been applied to the database
 */
export type AppliedMigration = {
	id: number;
	name: string;
	applied_at: Date;
	checksum: string;
};

/**
 * Parsed migration filename result
 */
export type ParsedMigration = {
	id: string;
	name: string;
	direction: "up" | "down";
} | null;

/**
 * Calculate SHA256 checksum of SQL content
 */
export function calculateChecksum(sql: string): string {
	return createHash("sha256").update(sql.trim()).digest("hex");
}

/**
 * Parse migration filename to extract id, name, and direction
 * Expected format: 0001_initial_up.sql or 0001_initial_down.sql
 */
export function parseMigrationFilename(filename: string): ParsedMigration {
	const match = filename.match(/^(\d+)_(.+?)_(up|down)\.sql$/);
	if (!match) return null;

	return {
		id: match[1],
		name: `${match[1]}_${match[2]}`,
		direction: match[3] as "up" | "down",
	};
}

/**
 * Load all migration files from a directory
 * Looks for files matching pattern: NNNN_name_up.sql and NNNN_name_down.sql
 */
export async function loadMigrationFiles(dir: string): Promise<MigrationFile[]> {
	const { readdir } = await import("node:fs/promises");

	const files = await readdir(dir);
	const sqlFiles = files.filter((f) => f.endsWith(".sql"));

	const migrationMap = new Map<string, Partial<MigrationFile>>();

	for (const file of sqlFiles) {
		const parsed = parseMigrationFilename(file);
		if (!parsed) continue;

		const filePath = path.join(dir, file);
		const sql = await readFile(filePath, "utf-8");

		if (!migrationMap.has(parsed.id)) {
			migrationMap.set(parsed.id, { id: parsed.id, name: parsed.name });
		}

		const migration = migrationMap.get(parsed.id)!;

		if (parsed.direction === "up") {
			migration.upPath = filePath;
			migration.upSql = sql;
			migration.checksum = calculateChecksum(sql);
		} else {
			migration.downPath = filePath;
			migration.downSql = sql;
		}
	}

	const migrations: MigrationFile[] = [];
	for (const [, m] of migrationMap) {
		if (!m.upPath || !m.upSql) {
			throw new Error(`Migration ${m.id} missing up file`);
		}

		migrations.push({
			id: m.id!,
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

/**
 * Get database type from connection string or environment
 */
export function getDatabaseType(): "postgresql" | "sqlite" {
	const dbUrl = process.env.DATABASE_URL || process.env.DB_URL || "";

	if (dbUrl.startsWith("postgres") || dbUrl.startsWith("postgresql")) {
		return "postgresql";
	}

	// Default to SQLite for local development
	return "sqlite";
}

/**
 * Generate the SQL to create the migrations tracking table
 * Based on database type
 */
export function getMigrationsTableSql(): string {
	const dbType = getDatabaseType();

	if (dbType === "postgresql") {
		return `
CREATE TABLE IF NOT EXISTS _betterbase_migrations (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  checksum TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_migrations_name 
  ON _betterbase_migrations(name);
`;
	}

	// SQLite
	return `
CREATE TABLE IF NOT EXISTS _betterbase_migrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  checksum TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_migrations_name 
  ON _betterbase_migrations(name);
`;
}
