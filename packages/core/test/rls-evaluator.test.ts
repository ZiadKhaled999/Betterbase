import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
	applyRLSDelete,
	applyRLSInsert,
	applyRLSSelect,
	applyRLSUpdate,
	createRLSMiddleware,
	evaluatePolicy,
} from "../src/rls/evaluator";
import { definePolicy } from "../src/rls/types";

describe("RLS Evaluator", () => {
	describe("evaluatePolicy", () => {
		describe("true policy", () => {
			test("should allow all when policy is 'true'", () => {
				const result = evaluatePolicy("true", "user-123", "select", {});
				expect(result).toBe(true);
			});

			test("should allow all when policy is 'true' with null userId", () => {
				const result = evaluatePolicy("true", null, "select", {});
				expect(result).toBe(true);
			});
		});

		describe("false policy", () => {
			test("should deny all when policy is 'false'", () => {
				const result = evaluatePolicy("false", "user-123", "select", {});
				expect(result).toBe(false);
			});

			test("should deny all when policy is 'false' with null userId", () => {
				const result = evaluatePolicy("false", null, "select", {});
				expect(result).toBe(false);
			});
		});

		describe("auth.uid() = column", () => {
			test("should allow when userId matches column value", () => {
				const record = { user_id: "user-123" };
				const result = evaluatePolicy("auth.uid() = user_id", "user-123", "select", record);
				expect(result).toBe(true);
			});

			test("should deny when userId does not match column value", () => {
				const record = { user_id: "user-456" };
				const result = evaluatePolicy("auth.uid() = user_id", "user-123", "select", record);
				expect(result).toBe(false);
			});

			test("should deny when userId is null", () => {
				const record = { user_id: "user-123" };
				const result = evaluatePolicy("auth.uid() = user_id", null, "select", record);
				expect(result).toBe(false);
			});

			test("should handle string comparison", () => {
				const record = { owner_id: "abc-123" };
				const result = evaluatePolicy("auth.uid() = owner_id", "abc-123", "select", record);
				expect(result).toBe(true);
			});

			test("should handle column value as number", () => {
				const record = { owner_id: 123 };
				const result = evaluatePolicy("auth.uid() = owner_id", "123", "select", record);
				expect(result).toBe(true);
			});

			test("should handle missing column in record", () => {
				const record = {};
				const result = evaluatePolicy("auth.uid() = user_id", "user-123", "select", record);
				expect(result).toBe(false);
			});
		});

		describe("auth.role() = 'value'", () => {
			test("should deny role check (not implemented)", () => {
				const result = evaluatePolicy("auth.role() = 'admin'", "admin-user", "select", {});
				expect(result).toBe(false); // Deny by default as role check not fully implemented
			});
		});

		describe("unknown policy format", () => {
			test("should deny unknown policy format", () => {
				const result = evaluatePolicy("unknown_expression", "user-123", "select", {});
				expect(result).toBe(false);
			});

			test("should deny empty string policy", () => {
				const result = evaluatePolicy("", "user-123", "select", {});
				expect(result).toBe(false);
			});
		});

		describe("different operations", () => {
			test("should evaluate for insert operation", () => {
				const record = { user_id: "user-123" };
				const result = evaluatePolicy("auth.uid() = user_id", "user-123", "insert", record);
				expect(result).toBe(true);
			});

			test("should evaluate for update operation", () => {
				const record = { user_id: "user-123" };
				const result = evaluatePolicy("auth.uid() = user_id", "user-123", "update", record);
				expect(result).toBe(true);
			});

			test("should evaluate for delete operation", () => {
				const record = { user_id: "user-123" };
				const result = evaluatePolicy("auth.uid() = user_id", "user-123", "delete", record);
				expect(result).toBe(true);
			});
		});
	});

	describe("applyRLSSelect", () => {
		test("should return all rows when no policies defined", () => {
			const rows = [{ id: 1 }, { id: 2 }, { id: 3 }];
			const result = applyRLSSelect(rows, [], "user-123");

			expect(result.length).toBe(3);
		});

		test("should filter rows based on SELECT policy", () => {
			const rows = [
				{ id: 1, user_id: "user-123" },
				{ id: 2, user_id: "user-456" },
				{ id: 3, user_id: "user-123" },
			];
			const policy = definePolicy("posts", {
				select: "auth.uid() = user_id",
			});

			const result = applyRLSSelect(rows, [policy], "user-123");

			expect(result.length).toBe(2);
			expect(result.map((r) => r.id)).toEqual([1, 3]);
		});

		test("should deny anonymous when no SELECT policy defined", () => {
			const rows = [{ id: 1 }, { id: 2 }];
			const policy = definePolicy("posts", {
				update: "auth.uid() = user_id",
			});

			const result = applyRLSSelect(rows, [policy], null);

			expect(result).toEqual([]);
		});

		test("should allow authenticated when no SELECT policy defined", () => {
			const rows = [{ id: 1 }, { id: 2 }];
			const policy = definePolicy("posts", {
				update: "auth.uid() = user_id",
			});

			const result = applyRLSSelect(rows, [policy], "user-123");

			expect(result).toEqual(rows);
		});

		test("should apply USING clause for SELECT", () => {
			const rows = [
				{ id: 1, owner_id: "user-123" },
				{ id: 2, owner_id: "user-456" },
			];
			const policy = definePolicy("documents", {
				using: "auth.uid() = owner_id",
			});

			const result = applyRLSSelect(rows, [policy], "user-123");

			expect(result.length).toBe(1);
			expect(result[0].id).toBe(1);
		});

		test("should allow all when SELECT policy is 'true'", () => {
			const rows = [{ id: 1 }, { id: 2 }, { id: 3 }];
			const policy = definePolicy("public_data", {
				select: "true",
			});

			const result = applyRLSSelect(rows, [policy], null);

			expect(result.length).toBe(3);
		});

		test("should filter correctly for multiple policies on different tables", () => {
			const rows = [
				{ id: 1, user_id: "user-123" },
				{ id: 2, user_id: "user-456" },
			];
			const policy1 = definePolicy("posts", {
				select: "auth.uid() = user_id",
			});
			const policy2 = definePolicy("other", {
				select: "true",
			});

			const result = applyRLSSelect(rows, [policy1, policy2], "user-123");

			// With "any policy allows" logic, policy2 (true) allows all rows
			// So both rows pass since at least one policy grants access
			expect(result.length).toBe(2);
		});
	});

	describe("applyRLSInsert", () => {
		test("should throw when no policy and no user", () => {
			expect(() => {
				applyRLSInsert(undefined, null, { id: 1 });
			}).toThrow();
		});

		test("should allow when authenticated and no policy", () => {
			expect(() => {
				applyRLSInsert(undefined, "user-123", { id: 1 });
			}).not.toThrow();
		});

		test("should throw when policy denies", () => {
			const policy = definePolicy("posts", {
				insert: "false",
			});

			expect(() => {
				applyRLSInsert(policy.insert, "user-123", { id: 1 });
			}).toThrow();
		});

		test("should allow when policy allows", () => {
			const policy = definePolicy("posts", {
				insert: "true",
			});

			expect(() => {
				applyRLSInsert(policy.insert, "user-123", { id: 1 });
			}).not.toThrow();
		});

		test("should evaluate auth.uid() check", () => {
			const record = { user_id: "user-123", content: "test" };

			expect(() => {
				applyRLSInsert("auth.uid() = user_id", "user-123", record);
			}).not.toThrow();

			expect(() => {
				applyRLSInsert("auth.uid() = user_id", "user-456", record);
			}).toThrow();
		});
	});

	describe("applyRLSUpdate", () => {
		test("should throw when no policy and no user", () => {
			expect(() => {
				applyRLSUpdate(undefined, null, { id: 1 });
			}).toThrow();
		});

		test("should allow when authenticated and no policy", () => {
			expect(() => {
				applyRLSUpdate(undefined, "user-123", { id: 1 });
			}).not.toThrow();
		});

		test("should throw when policy denies", () => {
			const policy = definePolicy("posts", {
				update: "false",
			});

			expect(() => {
				applyRLSUpdate(policy.update, "user-123", { id: 1 });
			}).toThrow();
		});

		test("should allow when policy allows", () => {
			const policy = definePolicy("posts", {
				update: "true",
			});

			expect(() => {
				applyRLSUpdate(policy.update, "user-123", { id: 1 });
			}).not.toThrow();
		});

		test("should evaluate using clause for update", () => {
			const record = { user_id: "user-123", content: "updated" };

			expect(() => {
				applyRLSUpdate("auth.uid() = user_id", "user-123", record);
			}).not.toThrow();

			expect(() => {
				applyRLSUpdate("auth.uid() = user_id", "user-456", record);
			}).toThrow();
		});
	});

	describe("applyRLSDelete", () => {
		test("should throw when no policy and no user", () => {
			expect(() => {
				applyRLSDelete(undefined, null, { id: 1 });
			}).toThrow();
		});

		test("should allow when authenticated and no policy", () => {
			expect(() => {
				applyRLSDelete(undefined, "user-123", { id: 1 });
			}).not.toThrow();
		});

		test("should throw when policy denies", () => {
			const policy = definePolicy("posts", {
				delete: "false",
			});

			expect(() => {
				applyRLSDelete(policy.delete, "user-123", { id: 1 });
			}).toThrow();
		});

		test("should allow when policy allows", () => {
			const policy = definePolicy("posts", {
				delete: "true",
			});

			expect(() => {
				applyRLSDelete(policy.delete, "user-123", { id: 1 });
			}).not.toThrow();
		});

		test("should evaluate auth.uid() check for delete", () => {
			const record = { id: 1, user_id: "user-123" };

			expect(() => {
				applyRLSDelete("auth.uid() = user_id", "user-123", record);
			}).not.toThrow();

			expect(() => {
				applyRLSDelete("auth.uid() = user_id", "user-456", record);
			}).toThrow();
		});
	});

	describe("createRLSMiddleware", () => {
		const userId: string | null = "test-user";

		const getUserId = () => userId;
		const policies = [
			definePolicy("posts", {
				select: "auth.uid() = user_id",
				insert: "true",
				update: "auth.uid() = user_id",
				delete: "auth.uid() = user_id",
			}),
		];

		const middleware = createRLSMiddleware(policies, getUserId);

		describe("middleware.select", () => {
			test("should filter rows based on policy", () => {
				const rows = [
					{ id: 1, user_id: "test-user" },
					{ id: 2, user_id: "other-user" },
				];

				const result = middleware.select(rows);

				expect(result.length).toBe(1);
				expect(result[0].id).toBe(1);
			});
		});

		describe("middleware.insert", () => {
			test("should allow insert when policy passes", () => {
				expect(() => {
					middleware.insert({ id: 1, content: "test" });
				}).not.toThrow();
			});

			test("should allow insert when policy is true", () => {
				// Insert policy is "true", so should always pass
				expect(() => {
					middleware.insert({ id: 2, content: "test2" });
				}).not.toThrow();
			});
		});

		describe("middleware.update", () => {
			test("should allow update when user owns record", () => {
				expect(() => {
					middleware.update({ id: 1, user_id: "test-user", content: "updated" });
				}).not.toThrow();
			});

			test("should throw when user does not own record", () => {
				expect(() => {
					middleware.update({ id: 2, user_id: "other-user", content: "updated" });
				}).toThrow();
			});
		});

		describe("middleware.delete", () => {
			test("should allow delete when user owns record", () => {
				expect(() => {
					middleware.delete({ id: 1, user_id: "test-user" });
				}).not.toThrow();
			});

			test("should throw when user does not own record", () => {
				expect(() => {
					middleware.delete({ id: 2, user_id: "other-user" });
				}).toThrow();
			});
		});

		describe("middleware with null user", () => {
			let nullUserMiddleware: ReturnType<typeof createRLSMiddleware>;

			// Use policies without insert/update/delete to properly test null user behavior
			const nullUserPolicies = [
				definePolicy("posts", {
					select: "auth.uid() = user_id",
				}),
			];

			beforeEach(() => {
				nullUserMiddleware = createRLSMiddleware(nullUserPolicies, () => null);
			});

			test("should deny select when user is null", () => {
				const rows = [{ id: 1, user_id: "test-user" }];
				const result = nullUserMiddleware.select(rows);
				expect(result).toEqual([]);
			});

			test("should throw on insert when user is null", () => {
				expect(() => {
					nullUserMiddleware.insert({ id: 1 });
				}).toThrow();
			});

			test("should throw on update when user is null", () => {
				expect(() => {
					nullUserMiddleware.update({ id: 1 });
				}).toThrow();
			});

			test("should throw on delete when user is null", () => {
				expect(() => {
					nullUserMiddleware.delete({ id: 1 });
				}).toThrow();
			});
		});
	});
});
