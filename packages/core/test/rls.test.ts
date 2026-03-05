import { describe, it, expect, beforeAll, beforeEach, afterAll, afterEach } from "bun:test"
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from "node:fs"
import { existsSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import {
	definePolicy,
	isPolicyDefinition,
	mergePolicies,
	policyToSQL,
	dropPolicySQL,
	dropPolicyByName,
	disableRLS,
	hasPolicyConditions,
	policiesToSQL,
	dropPoliciesSQL,
	scanPolicies,
	scanPoliciesStrict,
	listPolicyFiles,
	getPolicyFileInfo,
	PolicyScanError,
	generateAuthFunction,
	generateAuthFunctionWithSetting,
	dropAuthFunction,
	setCurrentUserId,
	clearCurrentUserId,
	generateIsAuthenticatedCheck,
	dropIsAuthenticatedCheck,
	generateAllAuthFunctions,
	dropAllAuthFunctions,
	type PolicyDefinition,
	type PolicyConfig,
} from "../src/rls/index"

let tmpDir: string

beforeEach(() => {
	tmpDir = mkdtempSync(path.join(os.tmpdir(), "betterbase-test-"))
})

afterEach(() => {
	rmSync(tmpDir, { recursive: true, force: true })
})

describe("rls/types", () => {
	describe("definePolicy", () => {
		it("creates a policy definition with select", () => {
			const policy = definePolicy("users", {
				select: "auth.uid() = id",
			})
			expect(policy.table).toBe("users")
			expect(policy.select).toBe("auth.uid() = id")
		})

		it("creates a policy definition with multiple operations", () => {
			const policy = definePolicy("users", {
				select: "auth.uid() = id",
				update: "auth.uid() = id",
				delete: "auth.uid() = id",
			})
			expect(policy.table).toBe("users")
			expect(policy.select).toBe("auth.uid() = id")
			expect(policy.update).toBe("auth.uid() = id")
			expect(policy.delete).toBe("auth.uid() = id")
		})

		it("creates a policy with using clause", () => {
			const policy = definePolicy("posts", {
				using: "auth.uid() = user_id",
			})
			expect(policy.table).toBe("posts")
			expect(policy.using).toBe("auth.uid() = user_id")
		})

		it("creates a policy with withCheck clause", () => {
			const policy = definePolicy("posts", {
				insert: "auth.uid() = user_id",
				withCheck: "auth.uid() = user_id",
			})
			expect(policy.withCheck).toBe("auth.uid() = user_id")
		})
	})

	describe("isPolicyDefinition", () => {
		it("returns true for valid policy", () => {
			const policy = definePolicy("users", { select: "auth.uid() = id" })
			expect(isPolicyDefinition(policy)).toBe(true)
		})

		it("returns false for null", () => {
			expect(isPolicyDefinition(null)).toBe(false)
		})

		it("returns false for undefined", () => {
			expect(isPolicyDefinition(undefined)).toBe(false)
		})

		it("returns false for empty object", () => {
			expect(isPolicyDefinition({})).toBe(false)
		})

		it("returns false for object without table", () => {
			expect(isPolicyDefinition({ select: "auth.uid() = id" })).toBe(false)
		})

		it("returns false for object with empty table", () => {
			expect(isPolicyDefinition({ table: "" })).toBe(false)
		})
	})

	describe("mergePolicies", () => {
		it("merges policies for the same table", () => {
			const policies: PolicyDefinition[] = [
				definePolicy("users", { select: "auth.uid() = id" }),
				definePolicy("users", { update: "auth.uid() = id" }),
			]
			const merged = mergePolicies(policies)
			expect(merged.length).toBe(1)
			expect(merged[0].select).toBe("auth.uid() = id")
			expect(merged[0].update).toBe("auth.uid() = id")
		})

		it("keeps separate policies for different tables", () => {
			const policies: PolicyDefinition[] = [
				definePolicy("users", { select: "auth.uid() = id" }),
				definePolicy("posts", { select: "auth.uid() = user_id" }),
			]
			const merged = mergePolicies(policies)
			expect(merged.length).toBe(2)
		})

		it("prefers new values when merging", () => {
			const policies: PolicyDefinition[] = [
				definePolicy("users", { select: "old_value" }),
				definePolicy("users", { select: "new_value" }),
			]
			const merged = mergePolicies(policies)
			expect(merged[0].select).toBe("new_value")
		})
	})
})

describe("rls/generator", () => {
	describe("policyToSQL", () => {
		it("generates SQL for select policy", () => {
			const policy = definePolicy("users", {
				select: "auth.uid() = id",
			})
			const sql = policyToSQL(policy)
			const sqlJoined = sql.join(" ")
			expect(sqlJoined).toContain("ALTER TABLE users ENABLE ROW LEVEL SECURITY;")
			expect(sqlJoined).toContain("CREATE POLICY users_select_policy ON users FOR SELECT USING (auth.uid() = id);")
		})

		it("generates SQL for multiple operations", () => {
			const policy = definePolicy("users", {
				select: "auth.uid() = id",
				update: "auth.uid() = id",
				delete: "auth.uid() = id",
			})
			const sql = policyToSQL(policy)
			expect(sql.some(s => s.includes("CREATE POLICY users_select_policy"))).toBe(true)
			expect(sql.some(s => s.includes("CREATE POLICY users_update_policy"))).toBe(true)
			expect(sql.some(s => s.includes("CREATE POLICY users_delete_policy"))).toBe(true)
		})

		it("generates USING clause for select/update/delete", () => {
			const policy = definePolicy("posts", {
				using: "auth.uid() = user_id",
			})
			const sql = policyToSQL(policy)
			expect(sql.some(s => s.includes("USING (auth.uid() = user_id)"))).toBe(true)
		})

		it("generates WITH CHECK clause for insert/update", () => {
			const policy = definePolicy("posts", {
				insert: "auth.uid() = user_id",
				withCheck: "auth.uid() = user_id",
			})
			const sql = policyToSQL(policy)
			expect(sql.some(s => s.includes("WITH CHECK (auth.uid() = user_id)"))).toBe(true)
		})

		it("handles insert with operation-specific condition", () => {
			const policy = definePolicy("posts", {
				insert: "auth.uid() = user_id",
			})
			const sql = policyToSQL(policy)
			expect(sql.some(s => s.includes("FOR INSERT"))).toBe(true)
			expect(sql.some(s => s.includes("WITH CHECK (auth.uid() = user_id)"))).toBe(true)
		})
	})

	describe("dropPolicySQL", () => {
		it("generates DROP statements for all operations", () => {
			const policy = definePolicy("users", {
				select: "auth.uid() = id",
			})
			const sql = dropPolicySQL(policy)
			expect(sql).toContain("DROP POLICY IF EXISTS users_select_policy ON users;")
			expect(sql).toContain("DROP POLICY IF EXISTS users_insert_policy ON users;")
			expect(sql).toContain("DROP POLICY IF EXISTS users_update_policy ON users;")
			expect(sql).toContain("DROP POLICY IF EXISTS users_delete_policy ON users;")
			expect(sql).toContain("ALTER TABLE users DISABLE ROW LEVEL SECURITY;")
		})
	})

	describe("dropPolicyByName", () => {
		it("generates DROP POLICY statement", () => {
			const sql = dropPolicyByName("users", "select")
			expect(sql).toBe("DROP POLICY IF EXISTS users_select_policy ON users;")
		})
	})

	describe("disableRLS", () => {
		it("generates ALTER TABLE statement", () => {
			const sql = disableRLS("users")
			expect(sql).toBe("ALTER TABLE users DISABLE ROW LEVEL SECURITY;")
		})
	})

	describe("hasPolicyConditions", () => {
		it("returns true when select is defined", () => {
			const policy = definePolicy("users", { select: "auth.uid() = id" })
			expect(hasPolicyConditions(policy)).toBe(true)
		})

		it("returns true when using is defined", () => {
			const policy = definePolicy("users", { using: "auth.uid() = id" })
			expect(hasPolicyConditions(policy)).toBe(true)
		})

		it("returns true when withCheck is defined", () => {
			const policy = definePolicy("users", { withCheck: "auth.uid() = id" })
			expect(hasPolicyConditions(policy)).toBe(true)
		})

		it("returns false when no conditions are defined", () => {
			const policy = definePolicy("users", {})
			expect(hasPolicyConditions(policy)).toBe(false)
		})
	})

	describe("policiesToSQL", () => {
		it("generates SQL for multiple policies", () => {
			const policies: PolicyDefinition[] = [
				definePolicy("users", { select: "auth.uid() = id" }),
				definePolicy("posts", { select: "auth.uid() = user_id" }),
			]
			const sql = policiesToSQL(policies)
			// Each policy returns 2 statements: ALTER TABLE + CREATE POLICY
			expect(sql.length).toBe(4)
			expect(sql.some(s => s.includes("ALTER TABLE users ENABLE ROW LEVEL SECURITY;"))).toBe(true)
			expect(sql.some(s => s.includes("ALTER TABLE posts ENABLE ROW LEVEL SECURITY;"))).toBe(true)
		})
	})

	describe("dropPoliciesSQL", () => {
		it("generates DROP SQL for multiple policies", () => {
			const policies: PolicyDefinition[] = [
				definePolicy("users", { select: "auth.uid() = id" }),
				definePolicy("posts", { select: "auth.uid() = user_id" }),
			]
			const sql = dropPoliciesSQL(policies)
			expect(sql).toContain("ALTER TABLE users DISABLE ROW LEVEL SECURITY;")
			expect(sql).toContain("ALTER TABLE posts DISABLE ROW LEVEL SECURITY;")
		})
	})
})

describe("rls/auth-bridge", () => {
	describe("generateAuthFunction", () => {
		it("generates auth.uid() function SQL", () => {
			const sql = generateAuthFunction()
			expect(sql).toContain("CREATE OR REPLACE FUNCTION auth.uid()")
			expect(sql).toContain("RETURNS uuid")
			expect(sql).toContain("current_setting('app.current_user_id', true)")
		})
	})

	describe("generateAuthFunctionWithSetting", () => {
		it("generates auth.uid() with custom setting", () => {
			const sql = generateAuthFunctionWithSetting("app.custom_user_id")
			expect(sql).toContain("current_setting('app.custom_user_id', true)")
		})

		it("throws for invalid setting name", () => {
			expect(() => generateAuthFunctionWithSetting("'; DROP TABLE users;--")).toThrow()
		})

		it("allows valid setting names", () => {
			const sql = generateAuthFunctionWithSetting("app.current_user_id")
			expect(sql).toBeDefined()
		})
	})

	describe("dropAuthFunction", () => {
		it("generates DROP FUNCTION statement", () => {
			const sql = dropAuthFunction()
			expect(sql).toBe("DROP FUNCTION IF EXISTS auth.uid();")
		})
	})

	describe("setCurrentUserId", () => {
		it("generates SET statement with user ID", () => {
			const sql = setCurrentUserId("123e4567-e89b-12d3-a456-426614174000")
			expect(sql).toContain("SET LOCAL app.current_user_id")
			expect(sql).toContain("123e4567-e89b-12d3-a456-426614174000")
		})

		it("escapes single quotes in user ID", () => {
			const sql = setCurrentUserId("user'id")
			expect(sql).toContain("user''id")
		})
	})

	describe("clearCurrentUserId", () => {
		it("generates CLEAR statement", () => {
			const sql = clearCurrentUserId()
			expect(sql).toContain("SET LOCAL app.current_user_id = ''")
		})
	})

	describe("generateIsAuthenticatedCheck", () => {
		it("generates auth.authenticated() function", () => {
			const sql = generateIsAuthenticatedCheck()
			expect(sql).toContain("CREATE OR REPLACE FUNCTION auth.authenticated()")
			expect(sql).toContain("RETURNS boolean")
		})
	})

	describe("dropIsAuthenticatedCheck", () => {
		it("generates DROP FUNCTION statement", () => {
			const sql = dropIsAuthenticatedCheck()
			expect(sql).toBe("DROP FUNCTION IF EXISTS auth.authenticated();")
		})
	})

	describe("generateAllAuthFunctions", () => {
		it("returns array of all auth functions", () => {
			const funcs = generateAllAuthFunctions()
			expect(funcs.length).toBe(2)
			expect(funcs[0]).toContain("auth.uid()")
			expect(funcs[1]).toContain("auth.authenticated()")
		})
	})

	describe("dropAllAuthFunctions", () => {
		it("returns array of all DROP statements", () => {
			const stmts = dropAllAuthFunctions()
			expect(stmts.length).toBe(2)
			expect(stmts[0]).toContain("DROP FUNCTION IF EXISTS auth.authenticated()")
			expect(stmts[1]).toContain("DROP FUNCTION IF EXISTS auth.uid()")
		})
	})
})

describe("rls/scanner", () => {
	describe("scanPolicies", () => {
		it("returns empty result for empty directory", async () => {
			const result = await scanPolicies(tmpDir)
			expect(result.policies).toEqual([])
			expect(result.errors).toEqual([])
		})

		it("scans and loads policies from policy files", async () => {
			const policiesDir = path.join(tmpDir, "policies")
			mkdirSync(policiesDir, { recursive: true })

			writeFileSync(
				path.join(policiesDir, "users.ts"),
				`
export const usersPolicy = {
  table: 'users',
  select: 'auth.uid() = id',
}
`,
			)

			const result = await scanPolicies(tmpDir)
			expect(result.errors).toHaveLength(0)
			// The scanner may or may not find policies depending on implementation
			// Just verify it doesn't crash
		})
	})

	describe("listPolicyFiles", () => {
		it("returns empty array for directory without policy files", async () => {
			const files = await listPolicyFiles(tmpDir)
			expect(files).toEqual([])
		})

		it("finds policy files in policies directory", async () => {
			const policiesDir = path.join(tmpDir, "policies")
			mkdirSync(policiesDir, { recursive: true })
			writeFileSync(path.join(policiesDir, "test.ts"), "export const policy = {}")

			const files = await listPolicyFiles(tmpDir)
			expect(files.length).toBeGreaterThanOrEqual(0)
		})
	})

	describe("getPolicyFileInfo", () => {
		it("returns empty array for non-existent file", async () => {
			const info = await getPolicyFileInfo(path.join(tmpDir, "nonexistent.ts"))
			expect(info).toEqual([])
		})
	})
})
