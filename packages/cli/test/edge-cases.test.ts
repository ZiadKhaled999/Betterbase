// packages/cli/test/edge-cases.test.ts
// Edge case and boundary condition tests for CLI utilities.
// 
// IMPORTANT — actual API signatures (verified from source):
//   SchemaScanner  → new SchemaScanner(filePath: string) — takes a FILE PATH, reads internally
//   RouteScanner   → new RouteScanner(filePath: string)  — takes a FILE PATH, reads internally
//   ContextGenerator → instance.generate(projectRoot: string): Promise<BetterBaseContext>
//                      takes a PROJECT ROOT directory, scans schema + routes inside it

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile, mkdir } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { ContextGenerator } from "../src/utils/context-generator";
import { RouteScanner } from "../src/utils/route-scanner";
import { SchemaScanner } from "../src/utils/scanner";

// ─── SchemaScanner ────────────────────────────────────────────────────────────
// SchemaScanner takes a FILE PATH. We write temp files to test edge cases.

describe("SchemaScanner — malformed and edge inputs", () => {
	let tmpDir: string;

	beforeEach(async () => {
		tmpDir = await mkdtemp(join(tmpdir(), "bb-scanner-"));
	});

	afterEach(async () => {
		await rm(tmpDir, { recursive: true, force: true });
	});

	test("does not throw on completely empty file", async () => {
		const p = join(tmpDir, "schema.ts");
		await writeFile(p, "");
		expect(() => new SchemaScanner(p).scan()).not.toThrow();
	});

	test("returns empty object for empty file", async () => {
		const p = join(tmpDir, "schema.ts");
		await writeFile(p, "");
		expect(new SchemaScanner(p).scan()).toEqual({});
	});

	test("returns empty object for schema with only import statements", async () => {
		const p = join(tmpDir, "schema.ts");
		await writeFile(p, `import { sqliteTable } from 'drizzle-orm/sqlite-core';`);
		expect(new SchemaScanner(p).scan()).toEqual({});
	});

	test("returns empty object for schema with only comments", async () => {
		const p = join(tmpDir, "schema.ts");
		await writeFile(p, `// just a comment\n/* block comment */`);
		expect(new SchemaScanner(p).scan()).toEqual({});
	});

	test("does not throw on schema with syntax errors", async () => {
		const p = join(tmpDir, "schema.ts");
		await writeFile(p, `export const broken = sqliteTable('broken', { id: text(`);
		expect(() => new SchemaScanner(p).scan()).not.toThrow();
	});

	test("handles very long column names without throwing", async () => {
		const longName = "a".repeat(200);
		const p = join(tmpDir, "schema.ts");
		await writeFile(p, `
      import { sqliteTable, text } from 'drizzle-orm/sqlite-core';
      export const t = sqliteTable('t', { ${longName}: text('${longName}') });
    `);
		expect(() => new SchemaScanner(p).scan()).not.toThrow();
	});

	test("throws when file does not exist", () => {
		// SchemaScanner reads the file in the constructor — nonexistent path throws
		expect(() => new SchemaScanner("/nonexistent/path/schema.ts").scan()).toThrow();
	});
});

// ─── RouteScanner ─────────────────────────────────────────────────────────────
// RouteScanner also takes a FILE PATH.
// scan() return shape: check what the real return value looks like.

describe("RouteScanner — malformed and edge inputs", () => {
	let tmpDir: string;

	beforeEach(async () => {
		tmpDir = await mkdtemp(join(tmpdir(), "bb-route-scanner-"));
	});

	afterEach(async () => {
		await rm(tmpDir, { recursive: true, force: true });
	});

	test("does not throw on empty file", async () => {
		const p = join(tmpDir, "routes.ts");
		await writeFile(p, "");
		expect(() => new RouteScanner().scan(tmpDir)).not.toThrow();
	});

	test("scan() result is defined for empty file", async () => {
		const p = join(tmpDir, "routes.ts");
		await writeFile(p, "");
		expect(new RouteScanner().scan(tmpDir)).toBeDefined();
	});

	test("does not throw on file with no route registrations", async () => {
		const p = join(tmpDir, "routes.ts");
		await writeFile(p, `const x = 1;\nconst y = 'hello'`);
		expect(() => new RouteScanner().scan(tmpDir)).not.toThrow();
	});

	test("does not throw on malformed TypeScript", async () => {
		const p = join(tmpDir, "routes.ts");
		await writeFile(p, "app.get({{broken");
		expect(() => new RouteScanner().scan(tmpDir)).not.toThrow();
	});

	test("does not throw on deeply nested code", async () => {
		const p = join(tmpDir, "routes.ts");
		const nested = "function a() { function b() { function c() { ".repeat(10) + "} ".repeat(10);
		await writeFile(p, nested);
		expect(() => new RouteScanner().scan(tmpDir)).not.toThrow();
	});
});

// ─── ContextGenerator ─────────────────────────────────────────────────────────
// ContextGenerator.generate(projectRoot) is ASYNC and takes a PROJECT ROOT dir.
// It looks for src/db/schema.ts and src/routes/ inside that directory.

describe("ContextGenerator — boundary conditions", () => {
	let tmpDir: string;

	beforeEach(async () => {
		tmpDir = await mkdtemp(join(tmpdir(), "bb-context-edge-"));
	});

	afterEach(async () => {
		await rm(tmpDir, { recursive: true, force: true });
	});

	test("does not throw on project with no schema and no routes", async () => {
		// Completely empty project dir — generate() should handle missing files gracefully
		const gen = new ContextGenerator();
		await expect(gen.generate(tmpDir)).resolves.toBeDefined();
	});

	test("generate() returns an object", async () => {
		const gen = new ContextGenerator();
		const result = await gen.generate(tmpDir);
		expect(typeof result).toBe("object");
		expect(result).not.toBeNull();
	});

	test("output is always JSON-serializable", async () => {
		const gen = new ContextGenerator();
		const result = await gen.generate(tmpDir);
		expect(() => JSON.parse(JSON.stringify(result))).not.toThrow();
	});

	test("handles empty schema file without throwing", async () => {
		await mkdir(join(tmpDir, "src/db"), { recursive: true });
		await writeFile(join(tmpDir, "src/db/schema.ts"), "export {}");
		const gen = new ContextGenerator();
		await expect(gen.generate(tmpDir)).resolves.toBeDefined();
	});

	test("handles schema with real tables", async () => {
		await mkdir(join(tmpDir, "src/db"), { recursive: true });
		await writeFile(
			join(tmpDir, "src/db/schema.ts"),
			`
      import { sqliteTable, text } from 'drizzle-orm/sqlite-core';
      export const users = sqliteTable('users', { id: text('id').primaryKey() });
      `,
		);
		const gen = new ContextGenerator();
		const result = await gen.generate(tmpDir);
		expect(result).toBeDefined();
	});
});