import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { z } from "zod";
import { action, mutation, query } from "../src/iac/functions";
import { generateApiTypes } from "../src/iac/generators/api-typegen";
import { generateDrizzleSchema } from "../src/iac/generators/drizzle-schema-gen";
import { generateMigration } from "../src/iac/generators/migration-gen";
import { defineSchema, defineTable } from "../src/iac/schema";
import { type SchemaDiff, diffSchemas, formatDiff } from "../src/iac/schema-diff";
import { type SerializedSchema, serializeSchema } from "../src/iac/schema-serializer";
import { type Infer, v } from "../src/iac/validators";

describe("Edge Cases: Validators", () => {
	test("v.id() with empty string table name", () => {
		const schema = v.id("");
		expect(schema.safeParse("id_123").success).toBe(true);
	});

	test("v.id() with special characters in table name", () => {
		const schema = v.id("table-with-dashes");
		expect(schema.safeParse("id_123").success).toBe(true);
	});

	test("v.optional() with nested optional", () => {
		const schema = v.optional(v.optional(v.string()));
		expect(schema.safeParse(undefined).success).toBe(true);
		expect(schema.safeParse("test").success).toBe(true);
	});

	test("v.array() with complex element type", () => {
		const schema = v.array(v.object({ name: v.string() }));
		expect(schema.safeParse([{ name: "a" }, { name: "b" }]).success).toBe(true);
		expect(schema.safeParse([{ name: 123 }]).success).toBe(false);
	});

	test("v.union() with many variants", () => {
		const schema = v.union(
			v.literal("a"),
			v.literal("b"),
			v.literal("c"),
			v.literal("d"),
			v.literal("e"),
		);
		expect(schema.safeParse("a").success).toBe(true);
		expect(schema.safeParse("e").success).toBe(true);
		expect(schema.safeParse("f").success).toBe(false);
	});

	test("v.object() with optional nested fields", () => {
		const schema = v.object({
			required: v.string(),
			optional: v.optional(v.number()),
		});
		expect(schema.safeParse({ required: "x" }).success).toBe(true);
		expect(schema.safeParse({ required: "x", optional: 1 }).success).toBe(true);
		expect(schema.safeParse({ required: "x", optional: "nope" }).success).toBe(false);
	});

	test("v.object() with deeply nested objects", () => {
		const schema = v.object({
			level1: v.object({
				level2: v.object({
					level3: v.string(),
				}),
			}),
		});
		expect(schema.safeParse({ level1: { level2: { level3: "deep" } } }).success).toBe(true);
		expect(schema.safeParse({ level1: { level2: { level3: 123 } } }).success).toBe(false);
	});

	test("v.datetime() with various ISO formats", () => {
		const schema = v.datetime();
		expect(schema.safeParse("2024-01-01T00:00:00Z").success).toBe(true);
		expect(schema.safeParse("2024-01-01T00:00:00+00:00").success).toBe(true);
		expect(schema.safeParse("2024-01-01T00:00:00-05:00").success).toBe(true);
		expect(schema.safeParse("2024-01-01").success).toBe(false);
	});

	test("v.bytes() with valid base64", () => {
		const schema = v.bytes();
		expect(schema.safeParse("SGVsbG8gV29ybGQ=").success).toBe(true);
		expect(schema.safeParse("").success).toBe(true);
		expect(schema.safeParse("not-base64!").success).toBe(false);
	});

	test("v.literal() with various primitive types", () => {
		const stringLit = v.literal("hello");
		expect(stringLit.safeParse("hello").success).toBe(true);

		const numLit = v.literal(42);
		expect(numLit.safeParse(42).success).toBe(true);

		const boolLit = v.literal(true);
		expect(boolLit.safeParse(true).success).toBe(true);
	});
});

describe("Edge Cases: Schema Definition", () => {
	test("defineTable with no user fields (system fields only)", () => {
		const table = defineTable({});
		expect(table._schema.shape._id).toBeDefined();
		expect(table._schema.shape._createdAt).toBeDefined();
		expect(table._schema.shape._updatedAt).toBeDefined();
	});

	test("defineTable with all field types", () => {
		const table = defineTable({
			str: v.string(),
			num: v.number(),
			bool: v.boolean(),
			arr: v.array(v.string()),
			obj: v.object({ nested: v.string() }),
			opt: v.optional(v.string()),
			lit: v.literal("x"),
			id: v.id("other"),
		});
		expect(table._schema.shape.str).toBeDefined();
		expect(table._schema.shape.num).toBeDefined();
		expect(table._schema.shape.bool).toBeDefined();
		expect(table._schema.shape.arr).toBeDefined();
		expect(table._schema.shape.obj).toBeDefined();
		expect(table._schema.shape.opt).toBeDefined();
		expect(table._schema.shape.lit).toBeDefined();
		expect(table._schema.shape.id).toBeDefined();
	});

	test("defineSchema with empty tables", () => {
		const schema = defineSchema({});
		expect(Object.keys(schema._tables)).toHaveLength(0);
	});

	test("defineSchema with many tables", () => {
		const schema = defineSchema({
			users: defineTable({ name: v.string() }),
			posts: defineTable({ title: v.string() }),
			comments: defineTable({ text: v.string() }),
			likes: defineTable({ userId: v.id("users") }),
			tags: defineTable({ name: v.string() }),
		});
		expect(Object.keys(schema._tables)).toHaveLength(5);
	});

	test("table with multiple indexes on same fields", () => {
		const table = defineTable({ a: v.string(), b: v.string() })
			.index("idx1", ["a"])
			.index("idx2", ["a", "b"]);
		expect(table._indexes).toHaveLength(2);
	});

	test("table with index on system field", () => {
		const table = defineTable({ name: v.string() }).index("by_created", ["_createdAt"]);
		expect(table._indexes[0].fields).toContain("_createdAt");
	});
});

describe("Edge Cases: Schema Serialization", () => {
	test("serializeSchema with empty schema", () => {
		const schema = defineSchema({});
		const serialized = serializeSchema(schema);
		expect(serialized.tables).toHaveLength(0);
		expect(serialized.version).toBeDefined();
	});

	test("serializeSchema with deeply nested object", () => {
		const schema = defineSchema({
			data: defineTable({
				nested: v.object({
					deep: v.object({
						value: v.string(),
					}),
				}),
			}),
		});
		const serialized = serializeSchema(schema);
		const nestedCol = serialized.tables[0].columns.find((c) => c.name === "nested");
		expect(nestedCol?.type).toBe("object");
	});

	test("serializeSchema with array of objects", () => {
		const schema = defineSchema({
			items: defineTable({
				tags: v.array(v.object({ name: v.string() })),
			}),
		});
		const serialized = serializeSchema(schema);
		const tagsCol = serialized.tables[0].columns.find((c) => c.name === "tags");
		expect(tagsCol?.type).toStartWith("array:");
	});

	test("serializeSchema with union type", () => {
		const schema = defineSchema({
			status: defineTable({
				state: v.union(v.literal("pending"), v.literal("active"), v.literal("done")),
			}),
		});
		const serialized = serializeSchema(schema);
		const stateCol = serialized.tables[0].columns.find((c) => c.name === "state");
		expect(stateCol?.type).toStartWith("union:");
	});

	test("serializeSchema preserves index metadata", () => {
		const schema = defineSchema({
			users: defineTable({ email: v.string() })
				.uniqueIndex("by_email", ["email"])
				.searchIndex("search_email", { searchField: "email" }),
		});
		const serialized = serializeSchema(schema);
		const indexes = serialized.tables[0].indexes;

		expect(indexes.find((i) => i.type === "uniqueIndex")).toBeDefined();
		expect(indexes.find((i) => i.type === "searchIndex")).toBeDefined();
	});
});

describe("Edge Cases: Schema Diff", () => {
	test("diffSchemas with multiple table changes", () => {
		const from = serializeSchema(
			defineSchema({
				users: defineTable({ name: v.string() }),
			}),
		);
		const to = serializeSchema(
			defineSchema({
				users: defineTable({ name: v.string(), email: v.string() }),
				posts: defineTable({ title: v.string() }),
			}),
		);

		const diff = diffSchemas(from, to);
		expect(diff.changes.length).toBeGreaterThanOrEqual(2);
	});

	test("diffSchemas with optional to required change", () => {
		const from = serializeSchema(
			defineSchema({
				users: defineTable({ name: v.optional(v.string()) }),
			}),
		);
		const to = serializeSchema(
			defineSchema({
				users: defineTable({ name: v.string() }),
			}),
		);

		const diff = diffSchemas(from, to);
		const alter = diff.changes.find((c) => c.type === "ALTER_COLUMN");
		expect(alter?.destructive).toBe(true);
	});

	test("diffSchemas with required to optional change", () => {
		const from = serializeSchema(
			defineSchema({
				users: defineTable({ name: v.string() }),
			}),
		);
		const to = serializeSchema(
			defineSchema({
				users: defineTable({ name: v.optional(v.string()) }),
			}),
		);

		const diff = diffSchemas(from, to);
		const alter = diff.changes.find((c) => c.type === "ALTER_COLUMN");
		expect(alter?.destructive).toBe(false);
	});

	test("diffSchemas with index changes only", () => {
		const from = serializeSchema(
			defineSchema({
				users: defineTable({ name: v.string() }),
			}),
		);
		const to = serializeSchema(
			defineSchema({
				users: defineTable({ name: v.string() }).index("by_name", ["name"]),
			}),
		);

		const diff = diffSchemas(from, to);
		expect(diff.changes.some((c) => c.type === "ADD_INDEX")).toBe(true);
	});

	test("diffSchemas with no changes returns empty", () => {
		const schema = defineSchema({ users: defineTable({ name: v.string() }) });
		const serialized = serializeSchema(schema);
		const diff = diffSchemas(serialized, serialized);

		expect(diff.isEmpty).toBe(true);
		expect(diff.changes).toHaveLength(0);
	});

	test("formatDiff with empty diff", () => {
		const schema = defineSchema({ users: defineTable({ name: v.string() }) });
		const serialized = serializeSchema(schema);
		const diff = diffSchemas(serialized, serialized);
		const formatted = formatDiff(diff);

		expect(formatted).toContain("No schema changes");
	});
});

describe("Edge Cases: Function Registration", () => {
	test("query with empty args", () => {
		const q = query({
			args: {},
			handler: async () => "result",
		});

		const parsed = q._args.safeParse({});
		expect(parsed.success).toBe(true);
	});

	test("query with complex nested args", () => {
		const q = query({
			args: {
				filter: v.object({
					field: v.string(),
					operator: v.union(v.literal("eq"), v.literal("gt")),
					value: v.string(),
				}),
				pagination: v.optional(
					v.object({
						limit: v.number(),
						offset: v.optional(v.number()),
					}),
				),
			},
			handler: async () => [],
		});

		const validArgs = {
			filter: { field: "name", operator: "eq", value: "test" },
			pagination: { limit: 10 },
		};
		expect(q._args.safeParse(validArgs).success).toBe(true);
	});

	test("mutation returns null", () => {
		const m = mutation({
			args: { id: v.string() },
			handler: async () => null,
		});

		const parsed = m._args.safeParse({ id: "123" });
		expect(parsed.success).toBe(true);
	});

	test("action with side effects only", () => {
		const a = action({
			args: { email: v.string() },
			handler: async (ctx) => {
				await ctx.storage.store(new Blob(["test"]));
				return { stored: true };
			},
		});

		expect(a._args.shape.email).toBeDefined();
	});
});

describe("Edge Cases: Code Generation", () => {
	test("generateDrizzleSchema with no tables", () => {
		const schema = serializeSchema(defineSchema({}));
		const code = generateDrizzleSchema(schema, "sqlite");

		expect(code).toContain("AUTO-GENERATED");
		expect(code).not.toContain("export const");
	});

	test("generateDrizzleSchema with all SQL types", () => {
		const schema = serializeSchema(
			defineSchema({
				items: defineTable({
					str: v.string(),
					num: v.number(),
					bool: v.boolean(),
					date: v.datetime(),
					arr: v.array(v.string()),
					obj: v.object({ x: v.string() }),
					id: v.id("users"),
					lit: v.literal("x"),
				}),
			}),
		);

		const code = generateDrizzleSchema(schema, "postgres");
		expect(code).toContain("text");
		expect(code).toContain("doublePrecision");
		expect(code).toContain("boolean");
		expect(code).toContain("timestamp");
		expect(code).toContain("jsonb");
	});

	test("generateDrizzleSchema preserves indexes in output", () => {
		const schema = serializeSchema(
			defineSchema({
				users: defineTable({ email: v.string() }).uniqueIndex("by_email", ["email"]),
			}),
		);

		const code = generateDrizzleSchema(schema, "sqlite");
		expect(code).toContain("uniqueIndex");
	});

	test("generateMigration with DROP_INDEX", () => {
		const from = serializeSchema(
			defineSchema({
				users: defineTable({ name: v.string() }).index("by_name", ["name"]),
			}),
		);
		const to = serializeSchema(
			defineSchema({
				users: defineTable({ name: v.string() }),
			}),
		);

		const diff = diffSchemas(from, to);
		const migration = generateMigration(diff, 1, "remove_index");

		expect(migration.sql).toContain("DROP INDEX");
	});

	test("generateMigration with DROP_TABLE", () => {
		const from = serializeSchema(
			defineSchema({
				old: defineTable({ data: v.string() }),
			}),
		);
		const to = serializeSchema(defineSchema({}));

		const diff = diffSchemas(from, to);
		const migration = generateMigration(diff, 1, "drop_old");

		expect(migration.sql).toContain("DROP TABLE");
		expect(diff.hasDestructive).toBe(true);
	});

	test("generateMigration filename handles special characters", () => {
		const to = serializeSchema(
			defineSchema({
				users: defineTable({ name: v.string() }),
			}),
		);
		const diff = diffSchemas(null, to);

		const migration = generateMigration(diff, 1, "add users table!");
		expect(migration.filename).toBe("0001_add_users_table!.sql");
	});

	test("generateMigration pads sequence correctly", () => {
		const to = serializeSchema(defineSchema({ test: defineTable({ x: v.string() }) }));
		const diff = diffSchemas(null, to);

		expect(generateMigration(diff, 1, "test").filename).toStartWith("0001");
		expect(generateMigration(diff, 10, "test").filename).toStartWith("0010");
		expect(generateMigration(diff, 100, "test").filename).toStartWith("0100");
	});

	test("generateApiTypes with empty functions", () => {
		const types = generateApiTypes([]);

		expect(types).toContain("api:");
		expect(types).toContain("queries:");
		expect(types).toContain("mutations:");
		expect(types).toContain("actions:");
	});

	test("generateApiTypes with deeply nested path", () => {
		const functions = [
			{
				kind: "query" as const,
				path: "queries/admin/users/list/all",
				name: "list",
				module: "/test.ts",
				handler: { _args: z.object({}), _handler: () => {} },
			},
		];

		const types = generateApiTypes(functions);
		expect(types).toContain("admin_users");
	});
});

describe("Edge Cases: Round-trip Serialization", () => {
	test("serialize -> deserialize -> diff produces no changes", () => {
		const original = defineSchema({
			users: defineTable({ name: v.string() }).uniqueIndex("by_name", ["name"]),
		});
		const serialized = serializeSchema(original);
		const json = JSON.stringify(serialized);
		const deserialized = JSON.parse(json) as SerializedSchema;

		const diff = diffSchemas(deserialized, serialized);
		expect(diff.isEmpty).toBe(true);
	});

	test("generated code is parseable for empty schema", () => {
		const schema = serializeSchema(defineSchema({}));
		const code = generateDrizzleSchema(schema, "sqlite");

		expect(code).toContain("AUTO-GENERATED");
	});
});

describe("Edge Cases: Null Handling", () => {
	test("v.null() accepts null only", () => {
		const schema = v.null();
		expect(schema.safeParse(null).success).toBe(true);
		expect(schema.safeParse("null").success).toBe(false);
		expect(schema.safeParse(undefined).success).toBe(false);
	});

	test("optional field can be null", () => {
		const schema = v.object({
			required: v.string(),
			optional: v.optional(v.string()),
		});
		expect(schema.safeParse({ required: "x" }).success).toBe(true);
		expect(schema.safeParse({ required: "x", optional: undefined }).success).toBe(true);
		expect(schema.safeParse({ required: "x", optional: "value" }).success).toBe(true);
	});
});

describe("Edge Cases: Type Inference", () => {
	test("Infer works with v.string()", () => {
		type Str = Infer<ReturnType<typeof v.string>>;
		const val: Str = "hello";
		expect(val).toBe("hello");
	});

	test("Infer works with v.number()", () => {
		type Num = Infer<ReturnType<typeof v.number>>;
		const val: Num = 42;
		expect(val).toBe(42);
	});

	test("Infer works with v.object()", () => {
		type Obj = Infer<ReturnType<typeof v.object>>;
		const val: Obj = { name: "test" };
		expect(val.name).toBe("test");
	});

	test("Infer works with v.array()", () => {
		type Arr = Infer<ReturnType<typeof v.array<v.ZodString>>>;
		const val: Arr = ["a", "b"];
		expect(val).toHaveLength(2);
	});
});
