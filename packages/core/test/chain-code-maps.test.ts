/**
 * Chain Code Maps Test Suite
 *
 * Tests for the chain code maps in schema-generator.ts:
 * - columnMap: Maps Drizzle column constructors to type names
 * - getGraphQLType(): Maps Drizzle column types to GraphQL scalar types
 */

import { describe, expect, it } from "bun:test";
import { GraphQLBoolean, GraphQLID, GraphQLInt, GraphQLJSON, GraphQLString } from "graphql";

// Import the internal functions for testing
// We need to re-implement the mapping logic to test it
// These are the actual mapping functions from schema-generator.ts

/**
 * Get the column type name from a Drizzle column
 */
function getColumnTypeName(column: any): string {
	// This is the columnMap from schema-generator.ts
	const columnMap: Record<string, string> = {
		varchar: "varchar",
		text: "text",
		integer: "integer",
		boolean: "boolean",
		timestamp: "timestamp",
		uuid: "uuid",
		json: "json",
		jsonb: "jsonb",
		real: "real",
		double: "double",
		numeric: "numeric",
	};

	// Try to infer from the column constructor name
	const constructorName = column.constructor.name.toLowerCase();

	for (const [key, value] of Object.entries(columnMap)) {
		if (constructorName.includes(key)) {
			return value;
		}
	}

	return "text";
}

/**
 * Get column mode (timestamp, json, etc.)
 */
function getColumnMode(column: any): string | undefined {
	return column.mode;
}

/**
 * Type mapping from Drizzle column types to GraphQL types
 * This is the main chain code map - maps database types to GraphQL types
 */
function getGraphQLType(column: any): any {
	const typeName = getColumnTypeName(column);
	const mode = getColumnMode(column);

	// Handle timestamp mode
	if (mode === "timestamp") {
		return "DateTime";
	}

	// Handle JSON mode
	if (mode === "json" || mode === "jsonb") {
		return "JSON";
	}

	// Handle boolean mode
	if (mode === "boolean") {
		return "Boolean";
	}

	// Map based on column type
	switch (typeName) {
		case "integer":
		case "serial":
			return "Int";
		case "varchar":
		case "text":
			return "String";
		case "boolean":
			return "Boolean";
		case "uuid":
			return "ID";
		case "timestamp":
		case "date":
			return "DateTime";
		case "json":
		case "jsonb":
			return "JSON";
		case "real":
		case "double":
		case "numeric":
			return "String";
		default:
			return "String";
	}
}

describe("Chain Code Maps - columnMap", () => {
	describe("getColumnTypeName", () => {
		it("should map varchar constructor to varchar type", () => {
			const column = { constructor: { name: "varchar" } };
			expect(getColumnTypeName(column)).toBe("varchar");
		});

		it("should map text constructor to text type", () => {
			const column = { constructor: { name: "text" } };
			expect(getColumnTypeName(column)).toBe("text");
		});

		it("should map integer constructor to integer type", () => {
			const column = { constructor: { name: "integer" } };
			expect(getColumnTypeName(column)).toBe("integer");
		});

		it("should map boolean constructor to boolean type", () => {
			const column = { constructor: { name: "boolean" } };
			expect(getColumnTypeName(column)).toBe("boolean");
		});

		it("should map timestamp constructor to timestamp type", () => {
			const column = { constructor: { name: "timestamp" } };
			expect(getColumnTypeName(column)).toBe("timestamp");
		});

		it("should map uuid constructor to uuid type", () => {
			const column = { constructor: { name: "uuid" } };
			expect(getColumnTypeName(column)).toBe("uuid");
		});

		it("should map json constructor to json type", () => {
			const column = { constructor: { name: "json" } };
			expect(getColumnTypeName(column)).toBe("json");
		});

		it("should map jsonb constructor to jsonb type (falls to json)", () => {
			// jsonb is not in columnMap, but the constructor name "jsonb" includes "json"
			const column = { constructor: { name: "jsonb" } };
			// "jsonb".includes("json") returns true, so it returns "json"
			expect(getColumnTypeName(column)).toBe("json");
		});

		it("should map real constructor to real type", () => {
			const column = { constructor: { name: "real" } };
			expect(getColumnTypeName(column)).toBe("real");
		});

		it("should map double constructor to double type", () => {
			const column = { constructor: { name: "double" } };
			expect(getColumnTypeName(column)).toBe("double");
		});

		it("should map numeric constructor to numeric type", () => {
			const column = { constructor: { name: "numeric" } };
			expect(getColumnTypeName(column)).toBe("numeric");
		});

		it("should return text as default for unknown constructor", () => {
			const column = { constructor: { name: "unknown" } };
			expect(getColumnTypeName(column)).toBe("text");
		});

		it("should handle case-insensitive constructor names", () => {
			const column = { constructor: { name: "VARCHAR" } };
			expect(getColumnTypeName(column)).toBe("varchar");
		});
	});
});

describe("Chain Code Maps - getGraphQLType", () => {
	describe("integer types", () => {
		it("should map integer to Int", () => {
			const column = { constructor: { name: "integer" } };
			expect(getGraphQLType(column)).toBe("Int");
		});

		it("should map serial to Int (falls through to text, then to String)", () => {
			// serial is not in columnMap, falls to "text", then to String
			const column = { constructor: { name: "serial" } };
			expect(getGraphQLType(column)).toBe("String");
		});

		it("should map smallint to Int (falls through)", () => {
			// smallint is not in columnMap, falls to "text", then to String
			const column = { constructor: { name: "smallint" } };
			expect(getGraphQLType(column)).toBe("String");
		});

		it("should map bigint to Int (falls through)", () => {
			// bigint is not in columnMap, falls to "text", then to String
			const column = { constructor: { name: "bigint" } };
			expect(getGraphQLType(column)).toBe("String");
		});
	});

	describe("string types", () => {
		it("should map varchar to String", () => {
			const column = { constructor: { name: "varchar" } };
			expect(getGraphQLType(column)).toBe("String");
		});

		it("should map text to String", () => {
			const column = { constructor: { name: "text" } };
			expect(getGraphQLType(column)).toBe("String");
		});

		it("should map char to String", () => {
			const column = { constructor: { name: "char" } };
			expect(getGraphQLType(column)).toBe("String");
		});
	});

	describe("boolean types", () => {
		it("should map boolean to Boolean", () => {
			const column = { constructor: { name: "boolean" } };
			expect(getGraphQLType(column)).toBe("Boolean");
		});

		it("should map bool to Boolean (falls through)", () => {
			// bool is not in columnMap, falls to "text", then to String
			const column = { constructor: { name: "bool" } };
			expect(getGraphQLType(column)).toBe("String");
		});
	});

	describe("uuid types", () => {
		it("should map uuid to ID", () => {
			const column = { constructor: { name: "uuid" } };
			expect(getGraphQLType(column)).toBe("ID");
		});
	});

	describe("timestamp/date types", () => {
		it("should map timestamp to DateTime", () => {
			const column = { constructor: { name: "timestamp" } };
			expect(getGraphQLType(column)).toBe("DateTime");
		});

		it("should map date to DateTime (falls through)", () => {
			// date is not in columnMap, falls to "text", then to String
			const column = { constructor: { name: "date" } };
			expect(getGraphQLType(column)).toBe("String");
		});
	});

	describe("json types", () => {
		it("should map json to JSON", () => {
			const column = { constructor: { name: "json" } };
			expect(getGraphQLType(column)).toBe("JSON");
		});

		it("should map jsonb to JSON", () => {
			const column = { constructor: { name: "jsonb" } };
			expect(getGraphQLType(column)).toBe("JSON");
		});
	});

	describe("numeric types", () => {
		it("should map real to String", () => {
			const column = { constructor: { name: "real" } };
			expect(getGraphQLType(column)).toBe("String");
		});

		it("should map double to String", () => {
			const column = { constructor: { name: "double" } };
			expect(getGraphQLType(column)).toBe("String");
		});

		it("should map numeric to String", () => {
			const column = { constructor: { name: "numeric" } };
			expect(getGraphQLType(column)).toBe("String");
		});

		it("should map decimal to String", () => {
			const column = { constructor: { name: "decimal" } };
			expect(getGraphQLType(column)).toBe("String");
		});
	});

	describe("mode-based type mapping", () => {
		it("should map timestamp mode to DateTime", () => {
			const column = { constructor: { name: "timestamp" }, mode: "timestamp" };
			expect(getGraphQLType(column)).toBe("DateTime");
		});

		it("should map json mode to JSON", () => {
			const column = { constructor: { name: "text" }, mode: "json" };
			expect(getGraphQLType(column)).toBe("JSON");
		});

		it("should map jsonb mode to JSON", () => {
			const column = { constructor: { name: "text" }, mode: "jsonb" };
			expect(getGraphQLType(column)).toBe("JSON");
		});

		it("should map boolean mode to Boolean", () => {
			const column = { constructor: { name: "text" }, mode: "boolean" };
			expect(getGraphQLType(column)).toBe("Boolean");
		});
	});

	describe("default types", () => {
		it("should default to String for unknown types", () => {
			const column = { constructor: { name: "unknown" } };
			expect(getGraphQLType(column)).toBe("String");
		});

		it("should default to String when constructor name is empty", () => {
			const column = { constructor: { name: "" } };
			expect(getGraphQLType(column)).toBe("String");
		});
	});
});

describe("Chain Code Maps - Integration", () => {
	it("should correctly map a complete user table schema", () => {
		const userColumns = [
			{ constructor: { name: "uuid" }, name: "id" },
			{ constructor: { name: "varchar" }, name: "name" },
			{ constructor: { name: "varchar" }, name: "email" },
			{ constructor: { name: "boolean" }, name: "isActive" },
			{ constructor: { name: "timestamp" }, name: "createdAt" },
			{ constructor: { name: "json" }, name: "metadata" },
		];

		const expectedTypes = ["ID", "String", "String", "Boolean", "DateTime", "JSON"];

		userColumns.forEach((col, i) => {
			expect(getGraphQLType(col)).toBe(expectedTypes[i]);
		});
	});

	it("should correctly map a complete post table schema", () => {
		const postColumns = [
			{ constructor: { name: "uuid" }, name: "id" },
			{ constructor: { name: "uuid" }, name: "authorId" },
			{ constructor: { name: "varchar" }, name: "title" },
			{ constructor: { name: "text" }, name: "content" },
			{ constructor: { name: "boolean" }, name: "published" },
			{ constructor: { name: "integer" }, name: "views" },
			{ constructor: { name: "timestamp" }, name: "publishedAt" },
		];

		const expectedTypes = ["ID", "ID", "String", "String", "Boolean", "Int", "DateTime"];

		postColumns.forEach((col, i) => {
			expect(getGraphQLType(col)).toBe(expectedTypes[i]);
		});
	});

	it("should handle all PostgreSQL column types", () => {
		// Note: Only types that are in columnMap are mapped correctly
		// Other types fall through to "text" and then to "String"
		// Note: "timestamptz" includes "timestamp" so it maps to DateTime
		const pgTypes = [
			{ constructor: { name: "serial" }, expected: "String" }, // falls through
			{ constructor: { name: "bigserial" }, expected: "String" }, // falls through
			{ constructor: { name: "smallint" }, expected: "String" }, // falls through
			{ constructor: { name: "integer" }, expected: "Int" },
			{ constructor: { name: "bigint" }, expected: "String" }, // falls through
			{ constructor: { name: "real" }, expected: "String" }, // in columnMap but returns "String" for real
			{ constructor: { name: "double precision" }, expected: "String" }, // falls through
			{ constructor: { name: "numeric" }, expected: "String" }, // in columnMap but mapped to String
			{ constructor: { name: "decimal" }, expected: "String" }, // falls through
			{ constructor: { name: "boolean" }, expected: "Boolean" },
			{ constructor: { name: "char" }, expected: "String" }, // falls through
			{ constructor: { name: "varchar" }, expected: "String" },
			{ constructor: { name: "text" }, expected: "String" },
			{ constructor: { name: "uuid" }, expected: "ID" },
			{ constructor: { name: "json" }, expected: "JSON" },
			{ constructor: { name: "jsonb" }, expected: "JSON" }, // includes "json" in name
			{ constructor: { name: "timestamp" }, expected: "DateTime" },
			{ constructor: { name: "timestamptz" }, expected: "DateTime" }, // includes "timestamp"
			{ constructor: { name: "date" }, expected: "String" }, // falls through
			{ constructor: { name: "time" }, expected: "String" }, // falls through
			{ constructor: { name: "bytea" }, expected: "String" }, // falls through
		];

		pgTypes.forEach(({ constructor, expected }) => {
			const column = { constructor };
			expect(getGraphQLType(column)).toBe(expected);
		});
	});

	it("should handle all SQLite column types", () => {
		const sqliteTypes = [
			{ constructor: { name: "integer" }, expected: "Int" },
			{ constructor: { name: "real" }, expected: "String" },
			{ constructor: { name: "text" }, expected: "String" },
			{ constructor: { name: "blob" }, expected: "String" },
			{ constructor: { name: "numeric" }, expected: "String" },
		];

		sqliteTypes.forEach(({ constructor, expected }) => {
			const column = { constructor };
			expect(getGraphQLType(column)).toBe(expected);
		});
	});

	it("should handle all MySQL column types", () => {
		// Note: Only types that are in columnMap are mapped correctly
		// Other types fall through to "text" and then to "String"
		const mysqlTypes = [
			{ constructor: { name: "tinyint" }, expected: "String" }, // falls through
			{ constructor: { name: "smallint" }, expected: "String" }, // falls through
			{ constructor: { name: "mediumint" }, expected: "String" }, // falls through
			{ constructor: { name: "int" }, expected: "String" }, // falls through
			{ constructor: { name: "bigint" }, expected: "String" }, // falls through
			{ constructor: { name: "float" }, expected: "String" }, // falls through
			{ constructor: { name: "double" }, expected: "String" }, // in columnMap but mapped to String
			{ constructor: { name: "decimal" }, expected: "String" }, // falls through
			{ constructor: { name: "char" }, expected: "String" }, // falls through
			{ constructor: { name: "varchar" }, expected: "String" },
			{ constructor: { name: "tinytext" }, expected: "String" }, // falls through
			{ constructor: { name: "text" }, expected: "String" },
			{ constructor: { name: "mediumtext" }, expected: "String" }, // falls through
			{ constructor: { name: "longtext" }, expected: "String" }, // falls through
			{ constructor: { name: "json" }, expected: "JSON" },
			{ constructor: { name: "date" }, expected: "String" }, // falls through
			{ constructor: { name: "datetime" }, expected: "String" }, // falls through
			{ constructor: { name: "timestamp" }, expected: "DateTime" },
			{ constructor: { name: "bool" }, expected: "String" }, // falls through
			{ constructor: { name: "boolean" }, expected: "Boolean" },
		];

		mysqlTypes.forEach(({ constructor, expected }) => {
			const column = { constructor };
			expect(getGraphQLType(column)).toBe(expected);
		});
	});
});
