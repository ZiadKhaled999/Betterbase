import { describe, expect, it } from "bun:test";
import {
	formatBytes,
	isValidProjectName,
	safeJsonParse,
	serializeError,
	toCamelCase,
	toSnakeCase,
} from "../src/utils";

describe("utils", () => {
	describe("serializeError", () => {
		it("should serialize an Error object", () => {
			const error = new Error("Something went wrong");
			const serialized = serializeError(error);

			expect(serialized.message).toBe("Something went wrong");
			expect(serialized.name).toBe("Error");
			expect(serialized.stack).toBeDefined();
		});

		it("should include all properties from error", () => {
			const error = new Error("Test error");
			const serialized = serializeError(error);

			expect(serialized).toHaveProperty("message");
			expect(serialized).toHaveProperty("name");
			expect(serialized).toHaveProperty("stack");
		});

		it("should handle custom error names", () => {
			const error = new Error("Custom error");
			error.name = "CustomError";
			const serialized = serializeError(error);

			expect(serialized.name).toBe("CustomError");
		});
	});

	describe("isValidProjectName", () => {
		describe("valid project names", () => {
			it("should accept simple lowercase names", () => {
				expect(isValidProjectName("myapp")).toBe(true);
			});

			it("should accept names with numbers", () => {
				expect(isValidProjectName("app123")).toBe(true);
			});

			it("should accept names with hyphens", () => {
				expect(isValidProjectName("my-app")).toBe(true);
			});

			it("should accept names starting with letter and ending with number", () => {
				expect(isValidProjectName("app1")).toBe(true);
			});

			it("should accept single letter names", () => {
				expect(isValidProjectName("a")).toBe(true);
			});

			it("should accept complex valid names", () => {
				expect(isValidProjectName("my-app-123")).toBe(true);
			});
		});

		describe("invalid project names", () => {
			it("should reject empty strings", () => {
				expect(isValidProjectName("")).toBe(false);
			});

			it("should reject names starting with numbers", () => {
				expect(isValidProjectName("123app")).toBe(false);
			});

			it("should reject names starting with hyphen", () => {
				expect(isValidProjectName("-app")).toBe(false);
			});

			it("should reject names ending with hyphen", () => {
				expect(isValidProjectName("app-")).toBe(false);
			});

			it("should reject names with uppercase letters", () => {
				expect(isValidProjectName("MyApp")).toBe(false);
			});

			it("should reject names with special characters", () => {
				expect(isValidProjectName("my_app")).toBe(false);
				expect(isValidProjectName("my.app")).toBe(false);
				expect(isValidProjectName("my@app")).toBe(false);
			});

			it("should reject whitespace-only strings", () => {
				expect(isValidProjectName("   ")).toBe(false);
			});
		});
	});

	describe("toCamelCase", () => {
		it("should convert snake_case to camelCase", () => {
			expect(toCamelCase("hello_world")).toBe("helloWorld");
		});

		it("should convert multiple underscores", () => {
			expect(toCamelCase("hello_world_test")).toBe("helloWorldTest");
		});

		it("should handle single word", () => {
			expect(toCamelCase("hello")).toBe("hello");
		});

		it("should handle empty string", () => {
			expect(toCamelCase("")).toBe("");
		});

		it("should handle strings with no underscores", () => {
			expect(toCamelCase("helloworld")).toBe("helloworld");
		});

		it("should handle leading underscore", () => {
			expect(toCamelCase("_hello")).toBe("Hello");
		});
	});

	describe("toSnakeCase", () => {
		it("should convert camelCase to snake_case", () => {
			expect(toSnakeCase("helloWorld")).toBe("hello_world");
		});

		it("should convert PascalCase to snake_case", () => {
			expect(toSnakeCase("HelloWorld")).toBe("hello_world");
		});

		it("should handle single word", () => {
			expect(toSnakeCase("hello")).toBe("hello");
		});

		it("should handle empty string", () => {
			expect(toSnakeCase("")).toBe("");
		});

		it("should handle consecutive uppercase letters", () => {
			expect(toSnakeCase("HTMLParser")).toBe("h_t_m_l_parser");
		});

		it("should handle numbers in string", () => {
			expect(toSnakeCase("user123Name")).toBe("user123_name");
		});

		it("should handle all uppercase", () => {
			expect(toSnakeCase("HELLO")).toBe("h_e_l_l_o");
		});
	});

	describe("safeJsonParse", () => {
		it("should parse valid JSON", () => {
			const result = safeJsonParse<{ name: string }>('{"name": "test"}');

			expect(result).toEqual({ name: "test" });
		});

		it("should parse JSON arrays", () => {
			const result = safeJsonParse<number[]>("[1, 2, 3]");

			expect(result).toEqual([1, 2, 3]);
		});

		it("should return null for invalid JSON", () => {
			const result = safeJsonParse("not valid json");

			expect(result).toBeNull();
		});

		it("should return null for empty string", () => {
			const result = safeJsonParse("");

			expect(result).toBeNull();
		});

		it("should return null for partial JSON", () => {
			const result = safeJsonParse('{"incomplete":');

			expect(result).toBeNull();
		});

		it("should parse numbers", () => {
			const result = safeJsonParse<number>("42");

			expect(result).toBe(42);
		});

		it("should parse booleans", () => {
			expect(safeJsonParse<boolean>("true")).toBe(true);
			expect(safeJsonParse<boolean>("false")).toBe(false);
		});

		it("should parse null", () => {
			const result = safeJsonParse("null");

			expect(result).toBeNull();
		});
	});

	describe("formatBytes", () => {
		it("should format 0 bytes", () => {
			expect(formatBytes(0)).toBe("0 B");
		});

		it("should format bytes in binary units", () => {
			expect(formatBytes(1024)).toBe("1 KiB");
			expect(formatBytes(1024 * 1024)).toBe("1 MiB");
			expect(formatBytes(1024 * 1024 * 1024)).toBe("1 GiB");
		});

		it("should format with decimal places", () => {
			expect(formatBytes(1536)).toBe("1.5 KiB");
			expect(formatBytes(1572864)).toBe("1.5 MiB");
		});

		it("should handle small values", () => {
			expect(formatBytes(1)).toBe("1 B");
			expect(formatBytes(500)).toBe("500 B");
		});

		it("should handle large values", () => {
			expect(formatBytes(1024 * 1024 * 1024 * 1024)).toBe("1 TiB");
			expect(formatBytes(1024 * 1024 * 1024 * 1024 * 1024)).toBe("1 PiB");
		});

		it("should throw RangeError for negative bytes", () => {
			expect(() => formatBytes(-1)).toThrow(RangeError);
		});

		it("should throw with correct message", () => {
			expect(() => formatBytes(-100)).toThrow("bytes must be non-negative");
		});
	});
});
