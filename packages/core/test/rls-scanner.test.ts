import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
	scanPolicies,
	scanPoliciesStrict,
	listPolicyFiles,
	getPolicyFileInfo,
	PolicyScanError,
	type PolicyFileInfo,
} from "../src/rls/scanner";
import { definePolicy } from "../src/rls/types";

describe("RLS Scanner", () => {
	let testDir: string;

	beforeEach(async () => {
		// Create a temporary directory for test policy files
		testDir = join(tmpdir(), `rls-scanner-test-${Date.now()}`);
		await mkdir(testDir, { recursive: true });
	});

	afterEach(async () => {
		// Clean up test directory
		try {
			await rm(testDir, { recursive: true, force: true });
		} catch {
			// Ignore cleanup errors
		}
	});

	describe("scanPolicies", () => {
		test("should return empty result when no policy directory exists", async () => {
			const result = await scanPolicies("/nonexistent/path");

			expect(result.policies).toEqual([]);
			expect(result.errors).toEqual([]);
		});

		test("should scan src/db/policies directory", async () => {
			const policiesDir = join(testDir, "src/db/policies");
			await mkdir(policiesDir, { recursive: true });

			const policyContent = `
import { definePolicy } from '../../src/rls/types';
export default definePolicy('users', {
	select: "auth.uid() = id",
});
`;
			await writeFile(join(policiesDir, "users.policy.ts"), policyContent);

			const result = await scanPolicies(testDir);

			expect(result.policies.length).toBe(1);
			expect(result.policies[0].table).toBe("users");
			expect(result.errors.length).toBe(0);
		});

		test("should scan db/policies directory", async () => {
			const policiesDir = join(testDir, "db/policies");
			await mkdir(policiesDir, { recursive: true });

			const policyContent = `
import { definePolicy } from '../../packages/core/src/rls/types';
export default definePolicy('posts', {
	select: "true",
});
`;
			await writeFile(join(policiesDir, "posts.policy.ts"), policyContent);

			const result = await scanPolicies(testDir);

			expect(result.policies.length).toBe(1);
			expect(result.policies[0].table).toBe("posts");
		});

		test("should scan policies directory", async () => {
			const policiesDir = join(testDir, "policies");
			await mkdir(policiesDir, { recursive: true });

			const policyContent = `
import { definePolicy } from '../packages/core/src/rls/types';
export default definePolicy('comments', {
	select: "auth.uid() = user_id",
});
`;
			await writeFile(join(policiesDir, "comments.policy.ts"), policyContent);

			const result = await scanPolicies(testDir);

			expect(result.policies.length).toBe(1);
			expect(result.policies[0].table).toBe("comments");
		});

		test("should load multiple policy files", async () => {
			const policiesDir = join(testDir, "src/db/policies");
			await mkdir(policiesDir, { recursive: true });

			await writeFile(
				join(policiesDir, "users.policy.ts"),
				`export default definePolicy('users', { select: "auth.uid() = id" });`,
			);
			await writeFile(
				join(policiesDir, "posts.policy.ts"),
				`export default definePolicy('posts', { select: "true" });`,
			);
			await writeFile(
				join(policiesDir, "comments.policy.ts"),
				`export default definePolicy('comments', { select: "auth.uid() = user_id" });`,
			);

			const result = await scanPolicies(testDir);

			expect(result.policies.length).toBe(3);
			expect(result.policies.map((p) => p.table).sort()).toEqual(["comments", "posts", "users"]);
		});

		test("should handle errors when policy file is invalid", async () => {
			const policiesDir = join(testDir, "src/db/policies");
			await mkdir(policiesDir, { recursive: true });

			// Write invalid policy file (no default export)
			await writeFile(join(policiesDir, "invalid.policy.ts"), `export const foo = 'bar';`);

			const result = await scanPolicies(testDir);

			expect(result.errors.length).toBeGreaterThan(0);
		});

		test("should return empty when policy directory is empty", async () => {
			const policiesDir = join(testDir, "src/db/policies");
			await mkdir(policiesDir, { recursive: true });

			const result = await scanPolicies(testDir);

			expect(result.policies).toEqual([]);
			expect(result.errors).toEqual([]);
		});
	});

	describe("scanPoliciesStrict", () => {
		test("should return policies when scan succeeds", async () => {
			const policiesDir = join(testDir, "src/db/policies");
			await mkdir(policiesDir, { recursive: true });

			await writeFile(
				join(policiesDir, "users.policy.ts"),
				`export default definePolicy('users', { select: "true" });`,
			);

			const policies = await scanPoliciesStrict(testDir);

			expect(policies.length).toBe(1);
			expect(policies[0].table).toBe("users");
		});

		test("should throw when scan has errors", async () => {
			const policiesDir = join(testDir, "src/db/policies");
			await mkdir(policiesDir, { recursive: true });

			await writeFile(
				join(policiesDir, "invalid.policy.ts"),
				`export const notapolicy = 'test';`,
			);

			await expect(scanPoliciesStrict(testDir)).rejects.toThrow(PolicyScanError);
		});
	});

	describe("listPolicyFiles", () => {
		test("should return empty array when no policy directory exists", async () => {
			const files = await listPolicyFiles("/nonexistent/path");

			expect(files).toEqual([]);
		});

		test("should return list of policy file paths", async () => {
			const policiesDir = join(testDir, "src/db/policies");
			await mkdir(policiesDir, { recursive: true });

			await writeFile(join(policiesDir, "users.policy.ts"), `export default {};`);
			await writeFile(join(policiesDir, "posts.policy.ts"), `export default {};`);

			const files = await listPolicyFiles(testDir);

			expect(files.length).toBe(2);
			expect(files.some((f) => f.endsWith("users.policy.ts"))).toBe(true);
			expect(files.some((f) => f.endsWith("posts.policy.ts"))).toBe(true);
		});

		test("should return empty when policy directory is empty", async () => {
			const policiesDir = join(testDir, "src/db/policies");
			await mkdir(policiesDir, { recursive: true });

			const files = await listPolicyFiles(testDir);

			expect(files).toEqual([]);
		});

		test("should not include non-policy files", async () => {
			const policiesDir = join(testDir, "src/db/policies");
			await mkdir(policiesDir, { recursive: true });

			await writeFile(join(policiesDir, "users.policy.ts"), `export default {};`);
			await writeFile(join(policiesDir, "utils.ts"), `export const foo = 'bar';`);
		await writeFile(join(policiesDir, "schema.ts"), `export const schema = {};`);

			const files = await listPolicyFiles(testDir);

			expect(files.length).toBe(1);
			expect(files[0].endsWith("users.policy.ts")).toBe(true);
		});
	});

	describe("getPolicyFileInfo", () => {
		test("should return policy file info", async () => {
			const policiesDir = join(testDir, "src/db/policies");
			await mkdir(policiesDir, { recursive: true });

			await writeFile(join(policiesDir, "users.policy.ts"), `export default {};`);

			const info = await getPolicyFileInfo(testDir);

			expect(info.length).toBe(1);
			expect(info[0].table).toBe("users");
			expect(info[0].filename).toBe("users.policy.ts");
			expect(info[0].path).toContain("users.policy.ts");
		});

		test("should return empty array when no policies", async () => {
			const info = await getPolicyFileInfo("/nonexistent");

			expect(info).toEqual([]);
		});
	});

	describe("policy file parsing", () => {
		test("should parse policy with select condition", async () => {
			const policiesDir = join(testDir, "src/db/policies");
			await mkdir(policiesDir, { recursive: true });

			await writeFile(
				join(policiesDir, "users.policy.ts"),
				`export default definePolicy('users', { select: "auth.uid() = id" });`,
			);

			const result = await scanPolicies(testDir);

			expect(result.policies[0].select).toBe("auth.uid() = id");
		});

		test("should parse policy with multiple conditions", async () => {
			const policiesDir = join(testDir, "src/db/policies");
			await mkdir(policiesDir, { recursive: true });

			await writeFile(
				join(policiesDir, "posts.policy.ts"),
				`export default definePolicy('posts', {
	select: "true",
	insert: "auth.uid() = author_id",
	update: "auth.uid() = author_id",
	delete: "auth.uid() = author_id"
});`,
			);

			const result = await scanPolicies(testDir);

			expect(result.policies[0].table).toBe("posts");
			expect(result.policies[0].select).toBe("true");
			expect(result.policies[0].insert).toBe("auth.uid() = author_id");
			expect(result.policies[0].update).toBe("auth.uid() = author_id");
			expect(result.policies[0].delete).toBe("auth.uid() = author_id");
		});

		test("should parse policy with using clause", async () => {
			const policiesDir = join(testDir, "src/db/policies");
			await mkdir(policiesDir, { recursive: true });

			await writeFile(
				join(policiesDir, "documents.policy.ts"),
				`export default definePolicy('documents', { using: "auth.uid() = owner_id" });`,
			);

			const result = await scanPolicies(testDir);

			expect(result.policies[0].using).toBe("auth.uid() = owner_id");
		});

		test("should parse policy with withCheck clause", async () => {
			const policiesDir = join(testDir, "src/db/policies");
			await mkdir(policiesDir, { recursive: true });

			await writeFile(
				join(policiesDir, "comments.policy.ts"),
				`export default definePolicy('comments', { withCheck: "auth.uid() = user_id" });`,
			);

			const result = await scanPolicies(testDir);

			expect(result.policies[0].withCheck).toBe("auth.uid() = user_id");
		});
	});

	describe("PolicyScanError", () => {
		test("should create error with message", () => {
			const error = new PolicyScanError("Test error message");

			expect(error.message).toBe("Test error message");
			expect(error.name).toBe("PolicyScanError");
		});

		test("should create error with cause", () => {
			const cause = new Error("Original error");
			const error = new PolicyScanError("Test error", cause);

			expect(error.message).toBe("Test error");
			expect(error.cause).toBe(cause);
		});
	});
});
