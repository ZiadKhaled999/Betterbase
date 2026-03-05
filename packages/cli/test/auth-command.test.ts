// packages/cli/test/auth-command.test.ts - FIXED v2
// Tests for runAuthSetupCommand(projectRoot, provider)
//
// The command calls execSync("bun add better-auth") and execSync("bun run db:push").
// Bun 1.3.9 does NOT support mock.module() for built-in Node modules like
// node:child_process. Instead we test file OUTPUTS only — the command still
// runs execSync but we scaffold a project where db:push fails gracefully
// (the command catches that error with a warning and continues).
//
// fs/promises access() in Bun 1.3.9 resolves to null (not undefined) on success.
// Use existsSync (sync, returns boolean) instead.

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "fs/promises";
import { existsSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

const { runAuthSetupCommand } = await import("../src/commands/auth");

async function scaffoldProject(dir: string): Promise<void> {
	await mkdir(join(dir, "src/db"), { recursive: true });
	await mkdir(join(dir, "src/middleware"), { recursive: true });
	await mkdir(join(dir, "src/routes"), { recursive: true });

	await writeFile(
		join(dir, "src/db/schema.ts"),
		`import { sqliteTable, text } from 'drizzle-orm/sqlite-core'
export const users = sqliteTable('users', { id: text('id').primaryKey() })
`,
	);

	await writeFile(
		join(dir, "src/db/index.ts"),
		`export * from "./schema"
export const db = {} as any
`,
	);

	// updateIndexForAuth() searches for this exact import string to patch
	await writeFile(
		join(dir, "src/index.ts"),
		`import { Hono } from 'hono'
import { registerRoutes } from "./routes"
const app = new Hono()
registerRoutes(app)
export { app }
`,
	);

	await writeFile(join(dir, ".env.example"), "PORT=3000\n");

	// Fake package.json so bun add doesn't traverse up to the monorepo root
	await writeFile(
		join(dir, "package.json"),
		JSON.stringify({ name: "test-project", version: "0.0.1", private: true }, null, 2),
	);
}

describe("runAuthSetupCommand", () => {
	let tmpDir: string;

	beforeEach(async () => {
		tmpDir = await mkdtemp(join(tmpdir(), "bb-auth-"));
		await scaffoldProject(tmpDir);
	});

	afterEach(async () => {
		await rm(tmpDir, { recursive: true, force: true });
	});

	// Use existsSync (sync bool) — fs/promises access() resolves to null in Bun 1.3.9,
	// not undefined, causing .resolves.toBeUndefined() to fail.

	test("creates src/auth/index.ts", async () => {
		// Increase timeout for first test - bun add better-auth takes ~30s on first run
		await runAuthSetupCommand(tmpDir, "sqlite");
		expect(existsSync(join(tmpDir, "src/auth/index.ts"))).toBe(true);
	}, 60000);

	test("creates src/auth/types.ts", async () => {
		await runAuthSetupCommand(tmpDir, "sqlite");
		expect(existsSync(join(tmpDir, "src/auth/types.ts"))).toBe(true);
	});

	test("creates src/db/auth-schema.ts", async () => {
		await runAuthSetupCommand(tmpDir, "sqlite");
		expect(existsSync(join(tmpDir, "src/db/auth-schema.ts"))).toBe(true);
	});

	test("creates src/middleware/auth.ts", async () => {
		await runAuthSetupCommand(tmpDir, "sqlite");
		expect(existsSync(join(tmpDir, "src/middleware/auth.ts"))).toBe(true);
	});

	test("middleware contains requireAuth export", async () => {
		await runAuthSetupCommand(tmpDir, "sqlite");
		const content = await readFile(join(tmpDir, "src/middleware/auth.ts"), "utf-8");
		expect(content).toContain("requireAuth");
	});

	test("middleware contains optionalAuth export", async () => {
		await runAuthSetupCommand(tmpDir, "sqlite");
		const content = await readFile(join(tmpDir, "src/middleware/auth.ts"), "utf-8");
		expect(content).toContain("optionalAuth");
	});

	test("auth-schema.ts contains user and session tables for sqlite", async () => {
		await runAuthSetupCommand(tmpDir, "sqlite");
		const schema = await readFile(join(tmpDir, "src/db/auth-schema.ts"), "utf-8");
		expect(schema).toContain("sqliteTable");
		expect(schema).toContain("user");
		expect(schema).toContain("session");
	});

	test("auth-schema.ts uses pgTable for pg provider", async () => {
		await runAuthSetupCommand(tmpDir, "pg");
		const schema = await readFile(join(tmpDir, "src/db/auth-schema.ts"), "utf-8");
		expect(schema).toContain("pgTable");
	});

	test("auth/index.ts references the correct provider and betterAuth", async () => {
		await runAuthSetupCommand(tmpDir, "sqlite");
		const content = await readFile(join(tmpDir, "src/auth/index.ts"), "utf-8");
		expect(content).toContain("sqlite");
		expect(content).toContain("betterAuth");
	});

	test("adds AUTH_SECRET to .env.example", async () => {
		await runAuthSetupCommand(tmpDir, "sqlite");
		const env = await readFile(join(tmpDir, ".env.example"), "utf-8");
		expect(env).toContain("AUTH_SECRET");
	});

	test("mounts auth handler in src/index.ts", async () => {
		await runAuthSetupCommand(tmpDir, "sqlite");
		const index = await readFile(join(tmpDir, "src/index.ts"), "utf-8");
		expect(index).toContain("/api/auth/**");
	});

	test("is idempotent — running twice does not duplicate auth handler mount", async () => {
		await runAuthSetupCommand(tmpDir, "sqlite");
		await runAuthSetupCommand(tmpDir, "sqlite");
		const index = await readFile(join(tmpDir, "src/index.ts"), "utf-8");
		const matches = index.match(/\/api\/auth\/\*\*/g) || [];
		expect(matches.length).toBe(1);
	}, 120000);
});
