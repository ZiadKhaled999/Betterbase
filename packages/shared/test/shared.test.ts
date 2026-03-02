import { describe, expect, test } from "bun:test";
import {
	BetterBaseError,
	ValidationError,
	NotFoundError,
	UnauthorizedError,
} from "../src/errors";
import {
	BETTERBASE_VERSION,
	DEFAULT_PORT,
	DEFAULT_DB_PATH,
	CONTEXT_FILE_NAME,
	CONFIG_FILE_NAME,
	MIGRATIONS_DIR,
	FUNCTIONS_DIR,
	POLICIES_DIR,
} from "../src/constants";
import {
	serializeError,
	isValidProjectName,
	toCamelCase,
	toSnakeCase,
	safeJsonParse,
	formatBytes,
} from "../src/utils";

describe("shared/errors", () => {
	describe("BetterBaseError", () => {
		test("is a subclass of Error", () => {
			const error = new BetterBaseError("test", "CODE");
			expect(error).toBeInstanceOf(Error);
		});

		test("preserves message", () => {
			const error = new BetterBaseError("test message", "CODE");
			expect(error.message).toBe("test message");
		});

		test("has code property", () => {
			const error = new BetterBaseError("test", "MY_CODE");
			expect(error.code).toBe("MY_CODE");
		});

		test("has default statusCode", () => {
			const error = new BetterBaseError("test", "CODE");
			expect(error.statusCode).toBe(500);
		});

		test("accepts custom statusCode", () => {
			const error = new BetterBaseError("test", "CODE", 400);
			expect(error.statusCode).toBe(400);
		});

		test("has correct name", () => {
			const error = new BetterBaseError("test", "CODE");
			expect(error.name).toBe("BetterBaseError");
		});
	});

	describe("ValidationError", () => {
		test("has correct code and statusCode", () => {
			const error = new ValidationError("invalid input");
			expect(error.code).toBe("VALIDATION_ERROR");
			expect(error.statusCode).toBe(400);
		});

		test("is subclass of BetterBaseError", () => {
			const error = new ValidationError("test");
			expect(error).toBeInstanceOf(BetterBaseError);
		});
	});

	describe("NotFoundError", () => {
		test("creates message with resource name", () => {
			const error = new NotFoundError("User");
			expect(error.message).toBe("User not found");
			expect(error.code).toBe("NOT_FOUND");
			expect(error.statusCode).toBe(404);
		});
	});

	describe("UnauthorizedError", () => {
		test("has correct defaults", () => {
			const error = new UnauthorizedError();
			expect(error.message).toBe("Unauthorized");
			expect(error.code).toBe("UNAUTHORIZED");
			expect(error.statusCode).toBe(401);
		});

		test("accepts custom message", () => {
			const error = new UnauthorizedError("Token expired");
			expect(error.message).toBe("Token expired");
		});
	});
});

describe("shared/constants", () => {
	test("exports version string", () => {
		expect(BETTERBASE_VERSION).toBe("0.1.0");
	});

	test("exports default port", () => {
		expect(DEFAULT_PORT).toBe(3000);
	});

	test("exports default db path", () => {
		expect(DEFAULT_DB_PATH).toBe("local.db");
	});

	test("exports context file name", () => {
		expect(CONTEXT_FILE_NAME).toBe(".betterbase-context.json");
	});

	test("exports config file name", () => {
		expect(CONFIG_FILE_NAME).toBe("betterbase.config.ts");
	});

	test("exports migrations dir", () => {
		expect(MIGRATIONS_DIR).toBe("drizzle");
	});

	test("exports functions dir", () => {
		expect(FUNCTIONS_DIR).toBe("src/functions");
	});

	test("exports policies dir", () => {
		expect(POLICIES_DIR).toBe("src/db/policies");
	});
});

describe("shared/utils", () => {
	describe("serializeError", () => {
		test("serializes error properties", () => {
			const error = new Error("test error");
			const serialized = serializeError(error);
			expect(serialized.message).toBe("test error");
			expect(serialized.name).toBe("Error");
		});
	});

	describe("isValidProjectName", () => {
		test("accepts valid lowercase names", () => {
			expect(isValidProjectName("my-project")).toBe(true);
			expect(isValidProjectName("a")).toBe(true);
			expect(isValidProjectName("abc")).toBe(true);
			expect(isValidProjectName("abc123")).toBe(true);
			expect(isValidProjectName("abc-123")).toBe(true);
		});

		test("rejects invalid names", () => {
			expect(isValidProjectName("")).toBe(false);
			expect(isValidProjectName("MyProject")).toBe(false);
			expect(isValidProjectName("my_project")).toBe(false);
			expect(isValidProjectName("123abc")).toBe(false);
			expect(isValidProjectName("-abc")).toBe(false);
			expect(isValidProjectName("abc-")).toBe(false);
		});
	});

	describe("toCamelCase", () => {
		test("converts snake_case to camelCase", () => {
			expect(toCamelCase("hello_world")).toBe("helloWorld");
			expect(toCamelCase("my_variable_name")).toBe("myVariableName");
		});

		test("handles empty string", () => {
			expect(toCamelCase("")).toBe("");
		});
	});

	describe("toSnakeCase", () => {
		test("converts camelCase to snake_case", () => {
			expect(toSnakeCase("helloWorld")).toBe("hello_world");
			expect(toSnakeCase("myVariableName")).toBe("my_variable_name");
		});

		test("converts PascalCase to snake_case", () => {
			expect(toSnakeCase("HelloWorld")).toBe("hello_world");
		});

		test("handles empty string", () => {
			expect(toSnakeCase("")).toBe("");
		});
	});

	describe("safeJsonParse", () => {
		test("parses valid JSON", () => {
			const result = safeJsonParse<{ key: string }>('{"key":"value"}');
			expect(result?.key).toBe("value");
		});

		test("returns null for invalid JSON", () => {
			expect(safeJsonParse("invalid json")).toBeNull();
		});
	});

	describe("formatBytes", () => {
		test("formats bytes correctly", () => {
			expect(formatBytes(0)).toBe("0 B");
			expect(formatBytes(1024)).toBe("1 KiB");
			expect(formatBytes(1024 * 1024)).toBe("1 MiB");
			expect(formatBytes(1536)).toBe("1.5 KiB");
		});

		test("throws for negative bytes", () => {
			expect(() => formatBytes(-1)).toThrow();
		});
	});
});
