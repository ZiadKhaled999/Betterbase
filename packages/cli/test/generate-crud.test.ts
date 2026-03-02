// packages/cli/test/generate-crud.test.ts
// Tests for runGenerateCrudCommand(projectRoot, tableName)
// IMPORTANT: The command internally calls:
//   - ensureZodValidatorInstalled() → spawns "bun add @hono/zod-validator"
//   - ensureRealtimeUtility()       → reads realtime template from disk
//   - runGenerateGraphqlCommand()   → regenerates GraphQL schema
// We mock these by ensuring @hono/zod-validator is detectable in node_modules
// (it's already a dev dep in the monorepo) and by pre-creating the realtime
// utility so ensureRealtimeUtility() finds it and skips the copy.

import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "fs/promises";
import { existsSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

// Mock graphql command to avoid it running during generate tests
mock.module("./graphql", () => ({
	runGenerateGraphqlCommand: async () => {},
}));

const { runGenerateCrudCommand } = await import("../src/commands/generate");

const MULTI_TABLE_SCHEMA = `
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
});

export const posts = sqliteTable('posts', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  content: text('content'),
  userId: text('user_id').notNull(),
  published: integer('published', { mode: 'boolean' }).default(0),
});
`;

async function scaffoldProject(dir: string): Promise<void> {
	await mkdir(join(dir, "src/db"), { recursive: true });
	await mkdir(join(dir, "src/routes"), { recursive: true });
	await mkdir(join(dir, "src/lib"), { recursive: true });

	await writeFile(join(dir, "src/db/schema.ts"), MULTI_TABLE_SCHEMA);

	// Pre-create realtime utility so ensureRealtimeUtility() skips the copy
	await writeFile(
		join(dir, "src/lib/realtime.ts"),
		`export const realtime = { broadcast: () => {} }`,
	);

	// Pre-create routes index so updateMainRouter() can patch it
	await writeFile(
		join(dir, "src/routes/index.ts"),
		`import { Hono } from 'hono'
import { healthRoute } from './health';
export function registerRoutes(app: Hono) {
  app.route('/api/health', healthRoute);
}
`,
	);

	// Simulate @hono/zod-validator being available so the install check passes
	await mkdir(join(dir, "node_modules/@hono/zod-validator"), { recursive: true });
	await writeFile(
		join(dir, "node_modules/@hono/zod-validator/package.json"),
		JSON.stringify({ name: "@hono/zod-validator", version: "0.4.0" }),
	);

	await writeFile(
		join(dir, "package.json"),
		JSON.stringify({ name: "test-project", version: "0.0.1", private: true }, null, 2),
	);
}

describe("runGenerateCrudCommand", () => {
	let tmpDir: string;

	beforeEach(async () => {
		tmpDir = await mkdtemp(join(tmpdir(), "bb-gen-"));
		await scaffoldProject(tmpDir);
	});

	afterEach(async () => {
		await rm(tmpDir, { recursive: true, force: true });
	});

	test("creates src/routes/posts.ts for posts table", async () => {
		await runGenerateCrudCommand(tmpDir, "posts");
		expect(existsSync(join(tmpDir, "src/routes/posts.ts"))).toBe(true);
	});

	test("generated route exports postsRoute", async () => {
		await runGenerateCrudCommand(tmpDir, "posts");
		const content = await readFile(join(tmpDir, "src/routes/posts.ts"), "utf-8");
		expect(content).toContain("postsRoute");
	});

	test("generated route contains GET / handler", async () => {
		await runGenerateCrudCommand(tmpDir, "posts");
		const content = await readFile(join(tmpDir, "src/routes/posts.ts"), "utf-8");
		expect(content).toContain(".get('/'");
	});

	test("generated route contains GET /:id handler", async () => {
		await runGenerateCrudCommand(tmpDir, "posts");
		const content = await readFile(join(tmpDir, "src/routes/posts.ts"), "utf-8");
		expect(content).toContain(".get('/:id'");
	});

	test("generated route contains POST handler", async () => {
		await runGenerateCrudCommand(tmpDir, "posts");
		const content = await readFile(join(tmpDir, "src/routes/posts.ts"), "utf-8");
		expect(content).toContain(".post('/'");
	});

	test("generated route contains PATCH handler", async () => {
		await runGenerateCrudCommand(tmpDir, "posts");
		const content = await readFile(join(tmpDir, "src/routes/posts.ts"), "utf-8");
		expect(content).toContain(".patch('/:id'");
	});

	test("generated route contains DELETE handler", async () => {
		await runGenerateCrudCommand(tmpDir, "posts");
		const content = await readFile(join(tmpDir, "src/routes/posts.ts"), "utf-8");
		expect(content).toContain(".delete('/:id'");
	});

	test("generated route imports Zod and uses zValidator", async () => {
		await runGenerateCrudCommand(tmpDir, "posts");
		const content = await readFile(join(tmpDir, "src/routes/posts.ts"), "utf-8");
		expect(content).toContain("zValidator");
		expect(content).toContain("z.object");
	});

	test("generated route includes pagination schema", async () => {
		await runGenerateCrudCommand(tmpDir, "posts");
		const content = await readFile(join(tmpDir, "src/routes/posts.ts"), "utf-8");
		expect(content).toContain("paginationSchema");
	});

	test("generated route broadcasts realtime events", async () => {
		await runGenerateCrudCommand(tmpDir, "posts");
		const content = await readFile(join(tmpDir, "src/routes/posts.ts"), "utf-8");
		expect(content).toContain("realtime.broadcast");
	});

	test("updates src/routes/index.ts to register the new route", async () => {
		await runGenerateCrudCommand(tmpDir, "posts");
		const router = await readFile(join(tmpDir, "src/routes/index.ts"), "utf-8");
		expect(router).toContain("postsRoute");
		expect(router).toContain("/api/posts");
	});

	test("throws for a table that does not exist in the schema", async () => {
		await expect(
			runGenerateCrudCommand(tmpDir, "nonexistent_table_xyz"),
		).rejects.toThrow('Table "nonexistent_table_xyz" not found in schema.');
	});

	test("throws when schema file does not exist", async () => {
		await rm(join(tmpDir, "src/db/schema.ts"));
		await expect(runGenerateCrudCommand(tmpDir, "posts")).rejects.toThrow(
			"Schema file not found",
		);
	});
});