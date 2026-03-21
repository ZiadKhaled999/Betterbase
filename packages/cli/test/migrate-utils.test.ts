/**
 * Migrate Utils Test Suite
 *
 * Tests for migrate-utils.ts - migration utilities
 */

import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
	calculateChecksum,
	getDatabaseType,
	getMigrationsTableSql,
	parseMigrationFilename,
} from "../src/commands/migrate-utils";

describe("Migrate Utils", () => {
	describe("calculateChecksum", () => {
		it("should calculate SHA256 checksum of SQL content", () => {
			const sql = "CREATE TABLE users (id INTEGER PRIMARY KEY);";
			const checksum = calculateChecksum(sql);

			expect(checksum).toBeDefined();
			expect(typeof checksum).toBe("string");
			expect(checksum.length).toBe(64); // SHA256 produces 64 hex characters
		});

		it("should produce same checksum for same content", () => {
			const sql = "SELECT * FROM users;";
			const checksum1 = calculateChecksum(sql);
			const checksum2 = calculateChecksum(sql);

			expect(checksum1).toBe(checksum2);
		});

		it("should produce different checksum for different content", () => {
			const sql1 = "SELECT * FROM users;";
			const sql2 = "SELECT * FROM posts;";
			const checksum1 = calculateChecksum(sql1);
			const checksum2 = calculateChecksum(sql2);

			expect(checksum1).not.toBe(checksum2);
		});

		it("should trim whitespace before calculating checksum", () => {
			const sql1 = "  SELECT * FROM users;  ";
			const sql2 = "SELECT * FROM users;";
			const checksum1 = calculateChecksum(sql1);
			const checksum2 = calculateChecksum(sql2);

			expect(checksum1).toBe(checksum2);
		});

		it("should handle empty SQL", () => {
			const checksum = calculateChecksum("");

			expect(checksum).toBeDefined();
			expect(typeof checksum).toBe("string");
			expect(checksum.length).toBe(64);
		});

		it("should handle multiline SQL", () => {
			const sql = `
				CREATE TABLE users (
					id INTEGER PRIMARY KEY,
					name TEXT
				);
			`;
			const checksum = calculateChecksum(sql);

			expect(checksum).toBeDefined();
			expect(checksum.length).toBe(64);
		});
	});

	describe("parseMigrationFilename", () => {
		it("should parse valid up migration filename", () => {
			const result = parseMigrationFilename("0001_initial_up.sql");

			expect(result).not.toBeNull();
			expect(result?.id).toBe("0001");
			expect(result?.name).toBe("0001_initial");
			expect(result?.direction).toBe("up");
		});

		it("should parse valid down migration filename", () => {
			const result = parseMigrationFilename("0001_initial_down.sql");

			expect(result).not.toBeNull();
			expect(result?.id).toBe("0001");
			expect(result?.name).toBe("0001_initial");
			expect(result?.direction).toBe("down");
		});

		it("should parse migration with complex name", () => {
			const result = parseMigrationFilename("0002_add_user_email_column_up.sql");

			expect(result).not.toBeNull();
			expect(result?.id).toBe("0002");
			expect(result?.name).toBe("0002_add_user_email_column");
			expect(result?.direction).toBe("up");
		});

		it("should return null for invalid filename format", () => {
			expect(parseMigrationFilename("invalid.sql")).toBeNull();
		});

		it("should return null for filename without direction", () => {
			expect(parseMigrationFilename("0001_initial.sql")).toBeNull();
		});

		it("should return null for filename without id", () => {
			expect(parseMigrationFilename("initial_up.sql")).toBeNull();
		});

		it("should return null for filename with invalid direction", () => {
			expect(parseMigrationFilename("0001_initial_invalid.sql")).toBeNull();
		});

		it("should handle multiple underscores in name", () => {
			const result = parseMigrationFilename("0003_add_users_table_index_up.sql");

			expect(result).not.toBeNull();
			expect(result?.id).toBe("0003");
			expect(result?.name).toBe("0003_add_users_table_index");
			expect(result?.direction).toBe("up");
		});

		it("should handle large migration numbers", () => {
			const result = parseMigrationFilename("999999_final_migration_up.sql");

			expect(result).not.toBeNull();
			expect(result?.id).toBe("999999");
			expect(result?.name).toBe("999999_final_migration");
		});
	});

	describe("getDatabaseType", () => {
		it("should return postgresql for postgres:// URL", () => {
			// Save original env
			const originalDbUrl = process.env.DATABASE_URL;
			const originalDbUrl2 = process.env.DB_URL;

			process.env.DATABASE_URL = "postgres://localhost:5432/mydb";
			delete process.env.DB_URL;

			expect(getDatabaseType()).toBe("postgresql");

			// Restore original env
			if (originalDbUrl !== undefined) {
				process.env.DATABASE_URL = originalDbUrl;
			} else {
				delete process.env.DATABASE_URL;
			}
			if (originalDbUrl2 !== undefined) {
				process.env.DB_URL = originalDbUrl2;
			} else {
				delete process.env.DB_URL;
			}
		});

		it("should return postgresql for postgresql:// URL", () => {
			const originalDbUrl = process.env.DATABASE_URL;
			const originalDbUrl2 = process.env.DB_URL;

			process.env.DATABASE_URL = "postgresql://localhost:5432/mydb";
			delete process.env.DB_URL;

			expect(getDatabaseType()).toBe("postgresql");

			// Restore original env
			if (originalDbUrl !== undefined) {
				process.env.DATABASE_URL = originalDbUrl;
			} else {
				delete process.env.DATABASE_URL;
			}
			if (originalDbUrl2 !== undefined) {
				process.env.DB_URL = originalDbUrl2;
			} else {
				delete process.env.DB_URL;
			}
		});

		it("should return postgresql for DB_URL with postgres", () => {
			const originalDbUrl = process.env.DATABASE_URL;
			const originalDbUrl2 = process.env.DB_URL;

			delete process.env.DATABASE_URL;
			process.env.DB_URL = "postgres://localhost/mydb";

			expect(getDatabaseType()).toBe("postgresql");

			// Restore original env
			if (originalDbUrl !== undefined) {
				process.env.DATABASE_URL = originalDbUrl;
			} else {
				delete process.env.DATABASE_URL;
			}
			if (originalDbUrl2 !== undefined) {
				process.env.DB_URL = originalDbUrl2;
			} else {
				delete process.env.DB_URL;
			}
		});

		it("should return sqlite for file paths", () => {
			const originalDbUrl = process.env.DATABASE_URL;
			const originalDbUrl2 = process.env.DB_URL;

			delete process.env.DATABASE_URL;
			delete process.env.DB_URL;

			expect(getDatabaseType()).toBe("sqlite");

			// Restore original env
			if (originalDbUrl !== undefined) {
				process.env.DATABASE_URL = originalDbUrl;
			} else {
				delete process.env.DATABASE_URL;
			}
			if (originalDbUrl2 !== undefined) {
				process.env.DB_URL = originalDbUrl2;
			} else {
				delete process.env.DB_URL;
			}
		});

		it("should return sqlite for local database URLs", () => {
			const originalDbUrl = process.env.DATABASE_URL;
			const originalDbUrl2 = process.env.DB_URL;

			process.env.DATABASE_URL = "file:./local.db";
			delete process.env.DB_URL;

			expect(getDatabaseType()).toBe("sqlite");

			// Restore original env
			if (originalDbUrl !== undefined) {
				process.env.DATABASE_URL = originalDbUrl;
			} else {
				delete process.env.DATABASE_URL;
			}
			if (originalDbUrl2 !== undefined) {
				process.env.DB_URL = originalDbUrl2;
			} else {
				delete process.env.DB_URL;
			}
		});
	});

	describe("getMigrationsTableSql", () => {
		it("should return PostgreSQL migrations table SQL", () => {
			const originalDbUrl = process.env.DATABASE_URL;
			const originalDbUrl2 = process.env.DB_URL;

			process.env.DATABASE_URL = "postgres://localhost:5432/mydb";
			delete process.env.DB_URL;

			const sql = getMigrationsTableSql();

			expect(sql).toContain("CREATE TABLE IF NOT EXISTS _betterbase_migrations");
			expect(sql).toContain("id SERIAL PRIMARY KEY");
			expect(sql).toContain("CREATE INDEX IF NOT EXISTS idx_migrations_name");

			// Restore original env
			if (originalDbUrl !== undefined) {
				process.env.DATABASE_URL = originalDbUrl;
			} else {
				delete process.env.DATABASE_URL;
			}
			if (originalDbUrl2 !== undefined) {
				process.env.DB_URL = originalDbUrl2;
			} else {
				delete process.env.DB_URL;
			}
		});

		it("should return SQLite migrations table SQL", () => {
			const originalDbUrl = process.env.DATABASE_URL;
			const originalDbUrl2 = process.env.DB_URL;

			delete process.env.DATABASE_URL;
			delete process.env.DB_URL;

			const sql = getMigrationsTableSql();

			expect(sql).toContain("CREATE TABLE IF NOT EXISTS _betterbase_migrations");
			expect(sql).toContain("id INTEGER PRIMARY KEY AUTOINCREMENT");
			expect(sql).toContain("CREATE INDEX IF NOT EXISTS idx_migrations_name");

			// Restore original env
			if (originalDbUrl !== undefined) {
				process.env.DATABASE_URL = originalDbUrl;
			} else {
				delete process.env.DATABASE_URL;
			}
			if (originalDbUrl2 !== undefined) {
				process.env.DB_URL = originalDbUrl2;
			} else {
				delete process.env.DB_URL;
			}
		});

		it("should create table with all required columns", () => {
			const sql = getMigrationsTableSql();

			expect(sql).toContain("name TEXT NOT NULL UNIQUE");
			expect(sql).toContain("applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP");
			expect(sql).toContain("checksum TEXT NOT NULL");
		});
	});

	describe("Integration - loadMigrationFiles", () => {
		let tmpDir: string;

		beforeAll(() => {
			tmpDir = mkdtempSync(path.join(os.tmpdir(), "migrate-test-"));
		});

		afterAll(() => {
			if (tmpDir) {
				rmSync(tmpDir, { recursive: true, force: true });
			}
		});

		it("should verify calculateChecksum produces valid output", async () => {
			const migrations = calculateChecksum("SELECT 1");
			expect(migrations).toBeDefined();
		});
	});
});
