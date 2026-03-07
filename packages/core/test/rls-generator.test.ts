import { describe, expect, test } from "bun:test";
import { definePolicy } from "../src/rls/types";
import {
	policyToSQL,
	dropPolicySQL,
	dropPolicyByName,
	disableRLS,
	hasPolicyConditions,
	policiesToSQL,
	dropPoliciesSQL,
	type PolicyOperation,
} from "../src/rls/generator";

describe("RLS Generator", () => {
	describe("policyToSQL", () => {
		test("should generate SQL for SELECT policy", () => {
			const policy = definePolicy("users", {
				select: "auth.uid() = id",
			});

			const sql = policyToSQL(policy);

			expect(sql).toContain("ALTER TABLE users ENABLE ROW LEVEL SECURITY;");
			expect(sql).toContain("CREATE POLICY users_select_policy ON users FOR SELECT USING (auth.uid() = id);");
		});

		test("should generate SQL for INSERT policy", () => {
			const policy = definePolicy("posts", {
				insert: "auth.uid() = author_id",
			});

			const sql = policyToSQL(policy);

			expect(sql).toContain("CREATE POLICY posts_insert_policy ON posts FOR INSERT WITH CHECK (auth.uid() = author_id);");
		});

		test("should generate SQL for UPDATE policy", () => {
			const policy = definePolicy("documents", {
				update: "auth.uid() = owner_id",
			});

			const sql = policyToSQL(policy);

			expect(sql).toContain("CREATE POLICY documents_update_policy ON documents FOR UPDATE USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);");
		});

		test("should generate SQL for DELETE policy", () => {
			const policy = definePolicy("comments", {
				delete: "auth.uid() = user_id",
			});

			const sql = policyToSQL(policy);

			expect(sql).toContain("CREATE POLICY comments_delete_policy ON comments FOR DELETE USING (auth.uid() = user_id);");
		});

		test("should generate SQL for multiple operations", () => {
			const policy = definePolicy("profiles", {
				select: "auth.uid() = user_id",
				insert: "auth.uid() = user_id",
				update: "auth.uid() = user_id",
				delete: "auth.uid() = user_id",
			});

			const sql = policyToSQL(policy);

			expect(sql.length).toBe(5); // 1 enable RLS + 4 operations
			expect(sql).toContain("CREATE POLICY profiles_select_policy ON profiles FOR SELECT USING (auth.uid() = user_id);");
			expect(sql).toContain("CREATE POLICY profiles_insert_policy ON profiles FOR INSERT WITH CHECK (auth.uid() = user_id);");
			expect(sql).toContain("CREATE POLICY profiles_update_policy ON profiles FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);");
			expect(sql).toContain("CREATE POLICY profiles_delete_policy ON profiles FOR DELETE USING (auth.uid() = user_id);");
		});

		test("should use USING clause for SELECT", () => {
			const policy = definePolicy("items", {
				using: "auth.uid() = owner_id",
			});

			const sql = policyToSQL(policy);

			expect(sql).toContain("CREATE POLICY items_select_policy ON items FOR SELECT USING (auth.uid() = owner_id);");
		});

		test("should use WITH CHECK clause for INSERT", () => {
			const policy = definePolicy("messages", {
				withCheck: "auth.uid() = sender_id",
			});

			const sql = policyToSQL(policy);

			expect(sql).toContain("CREATE POLICY messages_insert_policy ON messages FOR INSERT WITH CHECK (auth.uid() = sender_id);");
		});

		test("should prioritize using clause over operation-specific for SELECT/DELETE/UPDATE", () => {
			const policy = definePolicy("test1", {
				select: "explicit_select",
				using: "using_clause",
			});

			const sql = policyToSQL(policy);

			// using clause takes priority over select for USING clause
			expect(sql).toContain("CREATE POLICY test1_select_policy ON test1 FOR SELECT USING (using_clause);");
		});

		test("should prioritize withCheck clause over operation-specific for INSERT/UPDATE", () => {
			const policy = definePolicy("test2", {
				insert: "explicit_insert",
				withCheck: "withcheck_clause",
			});

			const sql = policyToSQL(policy);

			// withCheck takes priority over insert for WITH CHECK clause
			expect(sql).toContain("CREATE POLICY test2_insert_policy ON test2 FOR INSERT WITH CHECK (withcheck_clause);");
		});

		test("should handle true policy (allow all)", () => {
			const policy = definePolicy("public_data", {
				select: "true",
			});

			const sql = policyToSQL(policy);

			expect(sql).toContain("CREATE POLICY public_data_select_policy ON public_data FOR SELECT USING (true);");
		});

		test("should handle false policy (deny all)", () => {
			const policy = definePolicy("restricted", {
				select: "false",
			});

			const sql = policyToSQL(policy);

			expect(sql).toContain("CREATE POLICY restricted_select_policy ON restricted FOR SELECT USING (false);");
		});

		test("should include operations when using or withCheck is defined", () => {
			const policy = definePolicy("partial", {
				select: "auth.uid() = id",
				using: "auth.uid() = id",
				// No insert or delete explicitly defined
				// But using is defined, so SELECT, UPDATE, DELETE are included
			});

			const sql = policyToSQL(policy);

			expect(sql).toContain("CREATE POLICY partial_select_policy ON partial FOR SELECT USING (auth.uid() = id);");
			expect(sql).toContain("CREATE POLICY partial_update_policy ON partial FOR UPDATE USING (auth.uid() = id);");
			expect(sql).toContain("CREATE POLICY partial_delete_policy ON partial FOR DELETE USING (auth.uid() = id);");
			// No INSERT since only select and using are defined
		});

		test("should enable RLS first", () => {
			const policy = definePolicy("test_order", {
				select: "true",
			});

			const sql = policyToSQL(policy);

			expect(sql[0]).toBe("ALTER TABLE test_order ENABLE ROW LEVEL SECURITY;");
		});
	});

	describe("dropPolicySQL", () => {
		test("should generate DROP statements for all operations", () => {
			const policy = definePolicy("users", {
				select: "auth.uid() = id",
			});

			const sql = dropPolicySQL(policy);

			expect(sql).toContain("DROP POLICY IF EXISTS users_select_policy ON users;");
			expect(sql).toContain("DROP POLICY IF EXISTS users_insert_policy ON users;");
			expect(sql).toContain("DROP POLICY IF EXISTS users_update_policy ON users;");
			expect(sql).toContain("DROP POLICY IF EXISTS users_delete_policy ON users;");
			expect(sql).toContain("ALTER TABLE users DISABLE ROW LEVEL SECURITY;");
		});

		test("should disable RLS last", () => {
			const policy = definePolicy("test", {
				select: "true",
			});

			const sql = dropPolicySQL(policy);

			expect(sql[sql.length - 1]).toBe("ALTER TABLE test DISABLE ROW LEVEL SECURITY;");
		});
	});

	describe("dropPolicyByName", () => {
		test("should generate DROP statement for specific operation", () => {
			const sql = dropPolicyByName("users", "select");

			expect(sql).toBe("DROP POLICY IF EXISTS users_select_policy ON users;");
		});

		test("should work for all operation types", () => {
			const operations: PolicyOperation[] = ["select", "insert", "update", "delete"];

			for (const op of operations) {
				const sql = dropPolicyByName("posts", op);
				expect(sql).toBe(`DROP POLICY IF EXISTS posts_${op}_policy ON posts;`);
			}
		});
	});

	describe("disableRLS", () => {
		test("should generate ALTER TABLE DISABLE RLS statement", () => {
			const sql = disableRLS("users");

			expect(sql).toBe("ALTER TABLE users DISABLE ROW LEVEL SECURITY;");
		});
	});

	describe("hasPolicyConditions", () => {
		test("should return true when select is defined", () => {
			const policy = definePolicy("test", { select: "true" });
			expect(hasPolicyConditions(policy)).toBe(true);
		});

		test("should return true when insert is defined", () => {
			const policy = definePolicy("test", { insert: "true" });
			expect(hasPolicyConditions(policy)).toBe(true);
		});

		test("should return true when update is defined", () => {
			const policy = definePolicy("test", { update: "true" });
			expect(hasPolicyConditions(policy)).toBe(true);
		});

		test("should return true when delete is defined", () => {
			const policy = definePolicy("test", { delete: "true" });
			expect(hasPolicyConditions(policy)).toBe(true);
		});

		test("should return true when using is defined", () => {
			const policy = definePolicy("test", { using: "true" });
			expect(hasPolicyConditions(policy)).toBe(true);
		});

		test("should return true when withCheck is defined", () => {
			const policy = definePolicy("test", { withCheck: "true" });
			expect(hasPolicyConditions(policy)).toBe(true);
		});

		test("should return false when no conditions defined", () => {
			const policy = definePolicy("test", {});
			expect(hasPolicyConditions(policy)).toBe(false);
		});
	});

	describe("policiesToSQL", () => {
		test("should generate SQL for multiple policies", () => {
			const policies = [
				definePolicy("users", { select: "auth.uid() = id" }),
				definePolicy("posts", { select: "true" }),
			];

			const sql = policiesToSQL(policies);

			expect(sql.length).toBe(4); // 2 enable RLS + 2 select policies
		});

		test("should handle empty array", () => {
			const sql = policiesToSQL([]);

			expect(sql).toEqual([]);
		});
	});

	describe("dropPoliciesSQL", () => {
		test("should generate DROP SQL for multiple policies", () => {
			const policies = [
				definePolicy("users", { select: "auth.uid() = id" }),
				definePolicy("posts", { select: "true" }),
			];

			const sql = dropPoliciesSQL(policies);

			expect(sql.length).toBe(10); // 4 drop + 2 disable RLS for each policy
		});

		test("should handle empty array", () => {
			const sql = dropPoliciesSQL([]);

			expect(sql).toEqual([]);
		});
	});
});
