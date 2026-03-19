import { describe, expect, test } from "bun:test";
import {
	PolicyConfig,
	type PolicyDefinition,
	definePolicy,
	isPolicyDefinition,
	mergePolicies,
} from "../src/rls/types";

describe("RLS Types", () => {
	describe("definePolicy", () => {
		test("should create a basic policy with table name", () => {
			const policy = definePolicy("users", {
				select: "auth.uid() = id",
			});

			expect(policy).toEqual({
				table: "users",
				select: "auth.uid() = id",
			});
		});

		test("should create a policy with multiple operations", () => {
			const policy = definePolicy("posts", {
				select: "true",
				insert: "auth.uid() = author_id",
				update: "auth.uid() = author_id",
				delete: "auth.uid() = author_id",
			});

			expect(policy.table).toBe("posts");
			expect(policy.select).toBe("true");
			expect(policy.insert).toBe("auth.uid() = author_id");
			expect(policy.update).toBe("auth.uid() = author_id");
			expect(policy.delete).toBe("auth.uid() = author_id");
		});

		test("should create a policy with using clause", () => {
			const policy = definePolicy("documents", {
				using: "auth.uid() = owner_id",
			});

			expect(policy.table).toBe("documents");
			expect(policy.using).toBe("auth.uid() = owner_id");
		});

		test("should create a policy with withCheck clause", () => {
			const policy = definePolicy("comments", {
				withCheck: "auth.uid() = user_id",
			});

			expect(policy.table).toBe("comments");
			expect(policy.withCheck).toBe("auth.uid() = user_id");
		});

		test("should create a policy with all clauses", () => {
			const policy = definePolicy("profiles", {
				select: "auth.uid() = user_id",
				insert: "auth.uid() = user_id",
				update: "auth.uid() = user_id",
				delete: "auth.uid() = user_id",
				using: "auth.uid() = user_id",
				withCheck: "auth.uid() = user_id",
			});

			expect(policy.table).toBe("profiles");
			expect(policy.select).toBe("auth.uid() = user_id");
			expect(policy.insert).toBe("auth.uid() = user_id");
			expect(policy.update).toBe("auth.uid() = user_id");
			expect(policy.delete).toBe("auth.uid() = user_id");
			expect(policy.using).toBe("auth.uid() = user_id");
			expect(policy.withCheck).toBe("auth.uid() = user_id");
		});

		test("should handle empty config", () => {
			const policy = definePolicy("empty_table", {});

			expect(policy.table).toBe("empty_table");
			expect(policy.select).toBeUndefined();
		});
	});

	describe("isPolicyDefinition", () => {
		test("should return true for valid policy definition", () => {
			const policy: PolicyDefinition = {
				table: "users",
				select: "auth.uid() = id",
			};

			expect(isPolicyDefinition(policy)).toBe(true);
		});

		test("should return true for policy with minimum required fields", () => {
			const policy = { table: "posts" };

			expect(isPolicyDefinition(policy)).toBe(true);
		});

		test("should return false for null", () => {
			expect(isPolicyDefinition(null)).toBe(false);
		});

		test("should return false for undefined", () => {
			expect(isPolicyDefinition(undefined)).toBe(false);
		});

		test("should return false for primitive values", () => {
			expect(isPolicyDefinition("string")).toBe(false);
			expect(isPolicyDefinition(123)).toBe(false);
			expect(isPolicyDefinition(true)).toBe(false);
		});

		test("should return false for empty object", () => {
			expect(isPolicyDefinition({})).toBe(false);
		});

		test("should return false for object without table", () => {
			expect(isPolicyDefinition({ select: "true" })).toBe(false);
		});

		test("should return false for object with empty table string", () => {
			expect(isPolicyDefinition({ table: "" })).toBe(false);
		});

		test("should return false for object with non-string table", () => {
			expect(isPolicyDefinition({ table: 123 })).toBe(false);
		});
	});

	describe("mergePolicies", () => {
		test("should merge policies for the same table", () => {
			const policies: PolicyDefinition[] = [
				{ table: "users", select: "auth.uid() = id" },
				{ table: "users", update: "auth.uid() = id" },
			];

			const merged = mergePolicies(policies);

			expect(merged.length).toBe(1);
			expect(merged[0].table).toBe("users");
			expect(merged[0].select).toBe("auth.uid() = id");
			expect(merged[0].update).toBe("auth.uid() = id");
		});

		test("should keep separate policies for different tables", () => {
			const policies: PolicyDefinition[] = [
				{ table: "users", select: "auth.uid() = id" },
				{ table: "posts", select: "true" },
			];

			const merged = mergePolicies(policies);

			expect(merged.length).toBe(2);
		});

		test("should handle three policies for same table", () => {
			const policies: PolicyDefinition[] = [
				{ table: "items", select: "auth.uid() = id" },
				{ table: "items", insert: "auth.uid() = id" },
				{ table: "items", update: "auth.uid() = id" },
			];

			const merged = mergePolicies(policies);

			expect(merged.length).toBe(1);
			expect(merged[0].select).toBe("auth.uid() = id");
			expect(merged[0].insert).toBe("auth.uid() = id");
			expect(merged[0].update).toBe("auth.uid() = id");
		});

		test("should handle empty array", () => {
			const merged = mergePolicies([]);

			expect(merged).toEqual([]);
		});

		test("should handle single policy", () => {
			const policies: PolicyDefinition[] = [{ table: "users", select: "true" }];

			const merged = mergePolicies(policies);

			expect(merged.length).toBe(1);
			expect(merged[0]).toEqual(policies[0]);
		});

		test("should handle using and withCheck merging", () => {
			const policies: PolicyDefinition[] = [
				{ table: "documents", using: "auth.uid() = owner_id" },
				{ table: "documents", withCheck: "auth.uid() = owner_id" },
			];

			const merged = mergePolicies(policies);

			expect(merged.length).toBe(1);
			expect(merged[0].using).toBe("auth.uid() = owner_id");
			expect(merged[0].withCheck).toBe("auth.uid() = owner_id");
		});

		test("should preserve later values when merging duplicate operations", () => {
			const policies: PolicyDefinition[] = [
				{ table: "users", select: "first_condition" },
				{ table: "users", select: "second_condition" },
			];

			const merged = mergePolicies(policies);

			expect(merged.length).toBe(1);
			expect(merged[0].select).toBe("second_condition");
		});
	});
});
