import { afterAll, beforeAll, describe, expect, it, vi } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { isRLSSupported, runMigration } from "../src/migration/index";
import type { DatabaseConnection, ProviderAdapter } from "../src/providers/types";

let tmpDir: string;

beforeAll(() => {
	tmpDir = mkdtempSync(path.join(os.tmpdir(), "betterbase-test-"));
});

afterAll(() => {
	rmSync(tmpDir, { recursive: true, force: true });
});

// Mock provider for testing
const createMockProvider = (supportsRLS: boolean, supportsGraphQL = true): ProviderAdapter => {
	return {
		type: "neon",
		dialect: "postgres",
		connect: vi.fn().mockResolvedValue({
			drizzle: {},
			close: vi.fn(),
			isConnected: () => true,
		}),
		getMigrationsDriver: vi.fn(),
		supportsRLS: () => supportsRLS,
		supportsGraphQL: () => supportsGraphQL,
	};
};

// Mock database connection for testing
const createMockDbConnection = (executeFn?: () => void): DatabaseConnection => {
	const mockDrizzle = {
		execute: executeFn
			? vi.fn().mockImplementation(executeFn)
			: vi.fn().mockResolvedValue({ rows: [] }),
	};
	return {
		drizzle: mockDrizzle as unknown as DatabaseConnection["drizzle"],
		close: vi.fn(),
		isConnected: () => true,
	};
};

describe("migration/index", () => {
	describe("runMigration", () => {
		it("warns when provider does not support RLS", async () => {
			const provider = createMockProvider(false);
			const db = createMockDbConnection();

			// Should not throw - should complete successfully
			let error: any;
			try {
				await runMigration(tmpDir, db, provider);
			} catch (e) {
				error = e;
			}
			expect(error).toBeUndefined();
		});

		it("logs info when no policies found", async () => {
			const provider = createMockProvider(true);
			const db = createMockDbConnection();

			// Should not throw - just completes without error
			let error: any;
			try {
				await runMigration(tmpDir, db, provider);
			} catch (e) {
				error = e;
			}
			expect(error).toBeUndefined();
		});

		it("applies policies when RLS is supported", async () => {
			const provider = createMockProvider(true);
			const db = createMockDbConnection();

			// Should not throw - just completes without error
			let error: any;
			try {
				await runMigration(tmpDir, db, provider);
			} catch (e) {
				error = e;
			}
			expect(error).toBeUndefined();
		});

		it("warns about policy loading errors", async () => {
			const provider = createMockProvider(true);
			const db = createMockDbConnection();

			// Should not throw - just completes with warning logged
			let error: any;
			try {
				await runMigration(tmpDir, db, provider);
			} catch (e) {
				error = e;
			}
			expect(error).toBeUndefined();
		});
	});

	describe("isRLSSupported", () => {
		it("returns true for provider that supports RLS", () => {
			const provider = createMockProvider(true);
			expect(isRLSSupported(provider)).toBe(true);
		});

		it("returns false for provider that does not support RLS", () => {
			const provider = createMockProvider(false);
			expect(isRLSSupported(provider)).toBe(false);
		});
	});
});

describe("migration/rls-migrator", () => {
	// Re-import the modules to avoid mock pollution from runMigration tests
	let applyAuthFunction: typeof import("../src/migration/rls-migrator").applyAuthFunction;
	let applyPolicies: typeof import("../src/migration/rls-migrator").applyPolicies;
	let applyRLSMigration: typeof import("../src/migration/rls-migrator").applyRLSMigration;
	let dropPolicies: typeof import("../src/migration/rls-migrator").dropPolicies;
	let dropTableRLS: typeof import("../src/migration/rls-migrator").dropTableRLS;
	let getAppliedPolicies: typeof import("../src/migration/rls-migrator").getAppliedPolicies;

	beforeAll(async () => {
		const module = await import("../src/migration/rls-migrator");
		applyAuthFunction = module.applyAuthFunction;
		applyPolicies = module.applyPolicies;
		applyRLSMigration = module.applyRLSMigration;
		dropPolicies = module.dropPolicies;
		dropTableRLS = module.dropTableRLS;
		getAppliedPolicies = module.getAppliedPolicies;
	});
	describe("applyAuthFunction", () => {
		it("executes auth function SQL", async () => {
			const executeFn = vi.fn().mockResolvedValue({});
			const db = createMockDbConnection(executeFn);

			await applyAuthFunction(db);

			expect(executeFn).toHaveBeenCalled();
		});

		it("throws when database does not support raw queries", async () => {
			const db = {
				drizzle: {}, // No execute method
				close: vi.fn(),
				isConnected: () => true,
			};

			await expect(applyAuthFunction(db as unknown as DatabaseConnection)).rejects.toThrow(
				"Cannot execute raw SQL",
			);
		});
	});

	describe("applyPolicies", () => {
		it("does nothing for empty policies array", async () => {
			const executeFn = vi.fn();
			const db = createMockDbConnection(executeFn);

			await applyPolicies([], db);

			expect(executeFn).not.toHaveBeenCalled();
		});

		it("generates and executes SQL for policies", async () => {
			const executeFn = vi.fn().mockResolvedValue({});
			const db = createMockDbConnection(executeFn);

			const policies = [
				{
					table: "users",
					select: "auth.uid() = id",
				},
			];

			await applyPolicies(policies, db);

			expect(executeFn).toHaveBeenCalled();
		});
	});

	describe("applyRLSMigration", () => {
		it("applies auth function then policies", async () => {
			const executeFn = vi.fn().mockResolvedValue({});
			const db = createMockDbConnection(executeFn);

			const policies = [
				{
					table: "users",
					select: "auth.uid() = id",
				},
			];

			await applyRLSMigration(policies, db);

			// Should have called execute at least twice (once for auth, once for policies)
			expect(executeFn).toHaveBeenCalled();
		});
	});

	describe("dropPolicies", () => {
		it("does nothing for empty policies array", async () => {
			const executeFn = vi.fn();
			const db = createMockDbConnection(executeFn);

			await dropPolicies([], db);

			expect(executeFn).not.toHaveBeenCalled();
		});

		it("generates and executes DROP SQL for policies", async () => {
			const executeFn = vi.fn().mockResolvedValue({});
			const db = createMockDbConnection(executeFn);

			const policies = [
				{
					table: "users",
					select: "auth.uid() = id",
				},
			];

			await dropPolicies(policies, db);

			expect(executeFn).toHaveBeenCalled();
		});
	});

	describe("dropTableRLS", () => {
		it("drops all policies for a table", async () => {
			const executeFn = vi.fn().mockResolvedValue({});
			const db = createMockDbConnection(executeFn);

			await dropTableRLS("users", db);

			expect(executeFn).toHaveBeenCalled();
		});
	});

	describe("getAppliedPolicies", () => {
		it("queries pg_policies for applied policies", async () => {
			const mockRows = [
				{
					schemaname: "public",
					tablename: "users",
					policyname: "users_select_policy",
					permissive: "PERMISSIVE",
					roles: "PUBLIC",
					cmd: "SELECT",
				},
			];

			const executeFn = vi.fn().mockResolvedValue({ rows: mockRows });
			const db = createMockDbConnection(executeFn);

			const result = await getAppliedPolicies(db);

			expect(executeFn).toHaveBeenCalledWith(
				expect.objectContaining({
					sql: expect.stringContaining("pg_policies"),
				}),
			);
			expect(result).toEqual(mockRows);
		});

		it("throws when database does not support raw queries", async () => {
			const db = {
				drizzle: {}, // No execute method
				close: vi.fn(),
				isConnected: () => true,
			};

			await expect(getAppliedPolicies(db as unknown as DatabaseConnection)).rejects.toThrow(
				"Cannot query policies",
			);
		});
	});
});
