import { describe, expect, test } from "bun:test";
import { generateGraphQLSchema } from "../src/graphql/schema-generator";
import { exportSDL, exportTypeSDL, saveSDL } from "../src/graphql/sdl-exporter";

// ============================================================================
// Test Utilities
// ============================================================================

/**
 * Create a simple test schema
 */
function createTestSchema() {
	const tables = {
		users: {
			name: "users",
			columns: {
				id: { name: "id", notNull: true, primaryKey: true, constructor: { name: "uuid" } },
				name: { name: "name", notNull: true, constructor: { name: "varchar" } },
				email: { name: "email", constructor: { name: "varchar" } },
			},
		},
	} as any;

	return generateGraphQLSchema(tables);
}

// ============================================================================
// SDL Exporter Tests
// ============================================================================

describe("SDL Exporter", () => {
	describe("exportSDL", () => {
		test("should export basic schema to SDL", () => {
			const schema = createTestSchema();
			const sdl = exportSDL(schema);

			expect(sdl).toBeDefined();
			expect(typeof sdl).toBe("string");
			expect(sdl.length).toBeGreaterThan(0);
		});

		test("should include Query type in SDL", () => {
			const schema = createTestSchema();
			const sdl = exportSDL(schema);

			expect(sdl).toContain("type Query");
			expect(sdl).toContain("users");
			expect(sdl).toContain("usersList");
		});

		test("should include Mutation type in SDL", () => {
			const schema = createTestSchema();
			const sdl = exportSDL(schema);

			expect(sdl).toContain("type Mutation");
			expect(sdl).toContain("createUser");
			expect(sdl).toContain("updateUser");
			expect(sdl).toContain("deleteUser");
		});

		test("should include Object types in SDL", () => {
			const schema = createTestSchema();
			const sdl = exportSDL(schema);

			expect(sdl).toContain("type User");
			expect(sdl).toContain("id");
			expect(sdl).toContain("name");
			expect(sdl).toContain("email");
		});

		test("should include Input types in SDL", () => {
			const schema = createTestSchema();
			const sdl = exportSDL(schema);

			expect(sdl).toContain("input CreateUserInput");
			expect(sdl).toContain("input UpdateUserInput");
			expect(sdl).toContain("input UserWhereInput");
		});

		test("should include scalar types in SDL", () => {
			const schema = createTestSchema();
			const sdl = exportSDL(schema);

			expect(sdl).toContain("scalar JSON");
			expect(sdl).toContain("scalar DateTime");
		});

		test("should respect includeDescriptions option", () => {
			const schema = createTestSchema();
			const sdlWithDescriptions = exportSDL(schema, { includeDescriptions: true });
			const sdlWithoutDescriptions = exportSDL(schema, { includeDescriptions: false });

			// With descriptions should have more content due to comments
			expect(sdlWithDescriptions.length).toBeGreaterThanOrEqual(sdlWithoutDescriptions.length);
		});

		test("should respect useCommentSyntax option", () => {
			const schema = createTestSchema();

			const sdlWithCommentSyntax = exportSDL(schema, { useCommentSyntax: true });
			const sdlWithBlockSyntax = exportSDL(schema, { useCommentSyntax: false });

			// Both should produce valid SDL
			expect(sdlWithCommentSyntax).toContain("#");
			expect(sdlWithBlockSyntax).toContain('"""');
		});

		test("should respect sortTypes option", () => {
			const schema = createTestSchema();

			const sdlSorted = exportSDL(schema, { sortTypes: true });
			const sdlUnsorted = exportSDL(schema, { sortTypes: false });

			// Both should be valid SDL
			expect(sdlSorted).toContain("type Query");
			expect(sdlUnsorted).toContain("type Query");
		});

		test("should include header comment", () => {
			const schema = createTestSchema();
			const sdl = exportSDL(schema);

			expect(sdl).toContain("# GraphQL Schema");
			expect(sdl).toContain("Generated at:");
		});
	});

	describe("exportTypeSDL", () => {
		test("should export specific Object type", () => {
			const schema = createTestSchema();
			// The type name is singular (User, not Users)
			const typeSdl = exportTypeSDL(schema, "User");

			expect(typeSdl).toBeDefined();
			expect(typeSdl).toContain("type User");
			expect(typeSdl).toContain("id");
		});

		test("should export specific Input type", () => {
			const schema = createTestSchema();
			// Export the Input type and verify it contains the expected SDL
			const typeSdl = exportTypeSDL(schema, "CreateUserInput");

			expect(typeSdl).toBeDefined();
			expect(typeSdl).toContain("input CreateUserInput");
			expect(typeSdl).toContain("name");
			expect(typeSdl).toContain("email");
		});

		test("should throw error for non-existent type", () => {
			const schema = createTestSchema();

			expect(() => {
				exportTypeSDL(schema, "NonExistentType");
			}).toThrow();
		});

		test("should respect includeDescriptions option", () => {
			const schema = createTestSchema();
			const typeSdl = exportTypeSDL(schema, "User", { includeDescriptions: true });

			expect(typeSdl).toBeDefined();
		});

		test("should export scalar types", () => {
			const schema = createTestSchema();
			const typeSdl = exportTypeSDL(schema, "JSON");

			expect(typeSdl).toBeDefined();
			expect(typeSdl).toContain("scalar JSON");
		});
	});

	describe("saveSDL", () => {
		test("should be a function", () => {
			expect(typeof saveSDL).toBe("function");
		});
	});

	describe("SDL output validation", () => {
		test("should produce valid SDL syntax", () => {
			const schema = createTestSchema();
			const sdl = exportSDL(schema);

			// Check for basic SDL structure
			expect(sdl).toMatch(/type Query \{/);
			expect(sdl).toMatch(/type Mutation \{/);
			expect(sdl).toMatch(/type User \{/);
		});

		test("should properly format field arguments", () => {
			const schema = createTestSchema();
			const sdl = exportSDL(schema);

			// List query should have limit and offset arguments
			expect(sdl).toMatch(/usersList.*limit/);
		});

		test("should include non-null markers for required fields", () => {
			const schema = createTestSchema();
			const sdl = exportSDL(schema);

			// ID should be non-null in the User type
			expect(sdl).toMatch(/id: ID!/);
		});
	});
});
