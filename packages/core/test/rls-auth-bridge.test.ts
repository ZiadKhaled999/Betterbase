import { describe, expect, test } from "bun:test";
import {
	clearCurrentUserId,
	dropAllAuthFunctions,
	dropAuthFunction,
	dropIsAuthenticatedCheck,
	generateAllAuthFunctions,
	generateAuthFunction,
	generateAuthFunctionWithSetting,
	generateIsAuthenticatedCheck,
	setCurrentUserId,
} from "../src/rls/auth-bridge";

describe("RLS Auth Bridge", () => {
	describe("generateAuthFunction", () => {
		test("should generate auth.uid() function", () => {
			const sql = generateAuthFunction();

			expect(sql).toContain("CREATE OR REPLACE FUNCTION auth.uid()");
			expect(sql).toContain("RETURNS uuid");
			expect(sql).toContain("current_setting('app.current_user_id', true)::uuid");
			expect(sql).toContain("LANGUAGE sql STABLE");
		});

		test("should be valid SQL", () => {
			const sql = generateAuthFunction();

			expect(sql).toMatch(/^CREATE OR REPLACE FUNCTION/);
			expect(sql).toMatch(/;$/);
		});
	});

	describe("generateAuthFunctionWithSetting", () => {
		test("should use custom setting name", () => {
			const sql = generateAuthFunctionWithSetting("app.custom_user_id");

			expect(sql).toContain("current_setting('app.custom_user_id', true)::uuid");
		});

		test("should throw for invalid setting name with semicolon", () => {
			expect(() => {
				generateAuthFunctionWithSetting("app.setting; DROP TABLE users;--");
			}).toThrow();
		});

		test("should throw for invalid setting name with quotes", () => {
			expect(() => {
				generateAuthFunctionWithSetting("app.setting'injection'");
			}).toThrow();
		});

		test("should throw for invalid setting name with special chars", () => {
			expect(() => {
				generateAuthFunctionWithSetting("app.setting$var");
			}).toThrow();
		});

		test("should allow valid setting names with dots and underscores", () => {
			const sql = generateAuthFunctionWithSetting("app.my_custom.setting");

			expect(sql).toContain("current_setting('app.my_custom.setting', true)::uuid");
		});

		test("should allow alphanumeric setting names", () => {
			const sql = generateAuthFunctionWithSetting("app123.setting456");

			expect(sql).toContain("current_setting('app123.setting456', true)::uuid");
		});
	});

	describe("dropAuthFunction", () => {
		test("should generate DROP FUNCTION statement", () => {
			const sql = dropAuthFunction();

			expect(sql).toBe("DROP FUNCTION IF EXISTS auth.uid();");
		});
	});

	describe("setCurrentUserId", () => {
		test("should generate SET statement with user ID", () => {
			const userId = "123e4567-e89b-12d3-a456-426614174000";
			const sql = setCurrentUserId(userId);

			expect(sql).toContain(`'${userId}'`);
			expect(sql).toContain("SET LOCAL");
			expect(sql).toContain("app.current_user_id");
		});

		test("should escape single quotes in user ID", () => {
			const userId = "user'name";
			const sql = setCurrentUserId(userId);

			expect(sql).toContain("user''name");
		});

		test("should handle UUID format", () => {
			const uuid = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
			const sql = setCurrentUserId(uuid);

			expect(sql).toBe(`SET LOCAL app.current_user_id = '${uuid}';`);
		});

		test("should handle numeric user ID as string", () => {
			const userId = "12345";
			const sql = setCurrentUserId(userId);

			expect(sql).toContain("'12345'");
		});
	});

	describe("clearCurrentUserId", () => {
		test("should generate SET statement to clear user ID", () => {
			const sql = clearCurrentUserId();

			expect(sql).toContain("SET LOCAL app.current_user_id = ''");
		});
	});

	describe("generateIsAuthenticatedCheck", () => {
		test("should generate auth.authenticated() function", () => {
			const sql = generateIsAuthenticatedCheck();

			expect(sql).toContain("CREATE OR REPLACE FUNCTION auth.authenticated()");
			expect(sql).toContain("RETURNS boolean");
			expect(sql).toContain("current_setting('app.current_user_id', true) != ''");
			expect(sql).toContain("LANGUAGE sql STABLE");
		});
	});

	describe("dropIsAuthenticatedCheck", () => {
		test("should generate DROP FUNCTION statement", () => {
			const sql = dropIsAuthenticatedCheck();

			expect(sql).toBe("DROP FUNCTION IF EXISTS auth.authenticated();");
		});
	});

	describe("generateAllAuthFunctions", () => {
		test("should return array of auth functions", () => {
			const functions = generateAllAuthFunctions();

			expect(functions.length).toBe(2);
			expect(functions[0]).toContain("auth.uid()");
			expect(functions[1]).toContain("auth.authenticated()");
		});

		test("should include auth.uid() function", () => {
			const functions = generateAllAuthFunctions();

			expect(functions.some((f) => f.includes("auth.uid()"))).toBe(true);
		});

		test("should include auth.authenticated() function", () => {
			const functions = generateAllAuthFunctions();

			expect(functions.some((f) => f.includes("auth.authenticated()"))).toBe(true);
		});
	});

	describe("dropAllAuthFunctions", () => {
		test("should return array of DROP statements", () => {
			const statements = dropAllAuthFunctions();

			expect(statements.length).toBe(2);
		});

		test("should include drop for auth.authenticated()", () => {
			const statements = dropAllAuthFunctions();

			expect(statements[0]).toContain("auth.authenticated()");
		});

		test("should include drop for auth.uid()", () => {
			const statements = dropAllAuthFunctions();

			expect(statements[1]).toContain("auth.uid()");
		});
	});

	describe("SQL generation integration", () => {
		test("auth functions should be valid PostgreSQL", () => {
			const authFunctions = generateAllAuthFunctions();

			for (const sql of authFunctions) {
				// Check for basic SQL structure
				expect(sql).toMatch(/^(CREATE|DROP)/);
				expect(sql).toContain(";");
			}
		});

		test("generated functions should have proper language specification", () => {
			const sql = generateAuthFunction();

			expect(sql).toContain("LANGUAGE sql");
			expect(sql).toContain("STABLE");
		});

		test("SET statements should use LOCAL for session scope", () => {
			const setUser = setCurrentUserId("test-user");
			const clearUser = clearCurrentUserId();

			expect(setUser).toContain("SET LOCAL");
			expect(clearUser).toContain("SET LOCAL");
		});
	});
});
