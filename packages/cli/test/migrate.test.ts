import { describe, expect, test } from "bun:test";
import { splitStatements, analyzeMigration } from "../src/commands/migrate";

describe("splitStatements", () => {
	test("splits two statements separated by semicolons", () => {
		const sql = `CREATE TABLE users (id TEXT PRIMARY KEY);\nCREATE TABLE posts (id TEXT PRIMARY KEY);`;
		const result = splitStatements(sql);
		expect(result.length).toBe(2);
	});

	test("trims whitespace from each statement", () => {
		const sql = `  CREATE TABLE a (id TEXT);  `;
		const result = splitStatements(sql);
		expect(result[0].trim()).toBe("CREATE TABLE a (id TEXT)");
	});

	test("ignores empty statements from consecutive semicolons", () => {
		const sql = `CREATE TABLE a (id TEXT);;;CREATE TABLE b (id TEXT);`;
		const result = splitStatements(sql);
		expect(result.every((s: string) => s.trim().length > 0)).toBe(true);
	});

	test("returns empty array for empty input", () => {
		expect(splitStatements("")).toEqual([]);
	});

	test("returns single item for input with no semicolons", () => {
		const sql = `CREATE TABLE a (id TEXT PRIMARY KEY)`;
		const result = splitStatements(sql);
		expect(result.length).toBe(1);
	});

	test("handles strings with semicolons inside quotes", () => {
		const sql = `INSERT INTO users (name) VALUES ('Test; User');`;
		const result = splitStatements(sql);
		expect(result.length).toBe(1);
		expect(result[0]).toContain("Test; User");
	});

	test("handles double-quoted strings with semicolons", () => {
		const sql = `INSERT INTO test (val) VALUES ("value; with; semicolons");`;
		const result = splitStatements(sql);
		expect(result.length).toBe(1);
	});

	test("handles backtick-quoted strings with semicolons", () => {
		const sql = "INSERT INTO test (val) VALUES (`value; with; semicolons`);";
		const result = splitStatements(sql);
		expect(result.length).toBe(1);
	});
});

describe("analyzeMigration", () => {
	test("returns empty changes for empty array", () => {
		const result = analyzeMigration([]);
		expect(result).toEqual([]);
	});

	test("detects CREATE TABLE as non-destructive", () => {
		const statements = ["CREATE TABLE posts (id TEXT PRIMARY KEY, title TEXT)"];
		const result = analyzeMigration(statements);
		expect(result.length).toBe(1);
		expect(result[0].type).toBe("create_table");
		expect(result[0].isDestructive).toBe(false);
	});

	test("detects ADD COLUMN as non-destructive", () => {
		const statements = ["ALTER TABLE users ADD COLUMN bio TEXT"];
		const result = analyzeMigration(statements);
		expect(result.length).toBe(1);
		expect(result[0].type).toBe("add_column");
		expect(result[0].isDestructive).toBe(false);
	});

	test("detects DROP TABLE as destructive", () => {
		const statements = ["DROP TABLE users"];
		const result = analyzeMigration(statements);
		expect(result.length).toBe(1);
		expect(result[0].type).toBe("drop_table");
		expect(result[0].isDestructive).toBe(true);
	});

	test("detects DROP COLUMN as destructive", () => {
		const statements = ["ALTER TABLE users DROP COLUMN bio"];
		const result = analyzeMigration(statements);
		expect(result.length).toBe(1);
		expect(result[0].type).toBe("drop_column");
		expect(result[0].isDestructive).toBe(true);
	});

	test("handles multiple statements with mixed destructiveness", () => {
		const statements = [
			"CREATE TABLE posts (id TEXT)",
			"DROP TABLE old_table",
		];
		const result = analyzeMigration(statements);
		const hasDestructive = result.some((c) => c.isDestructive);
		expect(hasDestructive).toBe(true);
	});

	test("case-insensitive detection of DROP TABLE", () => {
		const result = analyzeMigration(["drop table users"]);
		expect(result[0].type).toBe("drop_table");
		expect(result[0].isDestructive).toBe(true);
	});

	test("handles IF NOT EXISTS for CREATE TABLE", () => {
		const result = analyzeMigration(["CREATE TABLE IF NOT EXISTS users (id TEXT)"]);
		expect(result[0].type).toBe("create_table");
		expect(result[0].isDestructive).toBe(false);
	});

	test("handles IF EXISTS for DROP TABLE", () => {
		const result = analyzeMigration(["DROP TABLE IF EXISTS users"]);
		expect(result[0].type).toBe("drop_table");
		expect(result[0].isDestructive).toBe(true);
	});
});
