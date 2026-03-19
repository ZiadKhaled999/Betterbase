import { describe, expect, test } from "bun:test";
import { GraphQLInputObjectType, GraphQLObjectType, GraphQLSchema } from "graphql";
import {
	GraphQLDateTime,
	type GraphQLGenerationConfig,
	GraphQLJSON,
	generateGraphQLSchema,
} from "../src/graphql/schema-generator";

// ============================================================================
// GraphQL Schema Generator Tests
// ============================================================================

describe("GraphQL Schema Generator", () => {
	describe("generateGraphQLSchema", () => {
		test("should generate a valid GraphQL schema", () => {
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

			const schema = generateGraphQLSchema(tables);

			expect(schema).toBeInstanceOf(GraphQLSchema);
			expect(schema.getQueryType()).toBeInstanceOf(GraphQLObjectType);
		});

		test("should generate Query type", () => {
			const tables = {
				users: {
					name: "users",
					columns: {
						id: { name: "id", notNull: true, primaryKey: true, constructor: { name: "uuid" } },
					},
				},
			} as any;

			const schema = generateGraphQLSchema(tables);
			const queryType = schema.getQueryType();

			expect(queryType).toBeInstanceOf(GraphQLObjectType);
			expect(queryType!.name).toBe("Query");
		});

		test("should generate Mutation type", () => {
			const tables = {
				users: {
					name: "users",
					columns: {
						id: { name: "id", notNull: true, primaryKey: true, constructor: { name: "uuid" } },
					},
				},
			} as any;

			const schema = generateGraphQLSchema(tables);
			const mutationType = schema.getMutationType();

			expect(mutationType).toBeInstanceOf(GraphQLObjectType);
			expect(mutationType!.name).toBe("Mutation");
		});

		test("should generate Subscription type by default", () => {
			const tables = {
				users: {
					name: "users",
					columns: {
						id: { name: "id", notNull: true, primaryKey: true, constructor: { name: "uuid" } },
					},
				},
			} as any;

			const schema = generateGraphQLSchema(tables);
			const subscriptionType = schema.getSubscriptionType();

			expect(subscriptionType).toBeInstanceOf(GraphQLObjectType);
			expect(subscriptionType!.name).toBe("Subscription");
		});

		test("should handle multiple tables", () => {
			const tables = {
				users: {
					name: "users",
					columns: {
						id: { name: "id", notNull: true, primaryKey: true, constructor: { name: "uuid" } },
					},
				},
				posts: {
					name: "posts",
					columns: {
						id: { name: "id", notNull: true, primaryKey: true, constructor: { name: "uuid" } },
					},
				},
			} as any;

			const schema = generateGraphQLSchema(tables);
			const queryType = schema.getQueryType()!;
			const fields = queryType.getFields();

			expect(fields.users).toBeDefined();
			expect(fields.posts).toBeDefined();
		});

		test("should handle empty tables object", () => {
			const schema = generateGraphQLSchema({});

			expect(schema).toBeInstanceOf(GraphQLSchema);
			expect(schema.getQueryType()).toBeInstanceOf(GraphQLObjectType);
		});
	});

	describe("GraphQL scalar types", () => {
		test("should have GraphQLJSON scalar", () => {
			expect(GraphQLJSON).toBeDefined();
			expect(GraphQLJSON.name).toBe("JSON");
		});

		test("should have GraphQLDateTime scalar", () => {
			expect(GraphQLDateTime).toBeDefined();
			expect(GraphQLDateTime.name).toBe("DateTime");
		});

		test("should serialize Date to ISO string", () => {
			const date = new Date("2024-01-15T12:00:00Z");
			const serialized = GraphQLDateTime.serialize(date);
			expect(serialized).toBe("2024-01-15T12:00:00.000Z");
		});

		test("should serialize string to string", () => {
			const serialized = GraphQLDateTime.serialize("2024-01-15T12:00:00Z");
			expect(serialized).toBe("2024-01-15T12:00:00Z");
		});

		test("should parse string to Date", () => {
			const parsed = GraphQLDateTime.parseValue("2024-01-15T12:00:00Z");
			expect(parsed).toBeInstanceOf(Date);
		});

		test("should serialize JSON value", () => {
			const obj = { key: "value" };
			const serialized = GraphQLJSON.serialize(obj);
			expect(serialized).toEqual(obj);
		});

		test("should parse JSON value", () => {
			const obj = { key: "value" };
			const parsed = GraphQLJSON.parseValue(obj);
			expect(parsed).toEqual(obj);
		});
	});

	describe("GraphQLGenerationConfig", () => {
		test("should accept empty config object", () => {
			const tables = {
				users: {
					name: "users",
					columns: {
						id: { name: "id", notNull: true, primaryKey: true, constructor: { name: "uuid" } },
					},
				},
			} as any;

			const config: GraphQLGenerationConfig = {};
			const schema = generateGraphQLSchema(tables, config);

			expect(schema).toBeInstanceOf(GraphQLSchema);
		});

		test("should accept custom typePrefix", () => {
			const tables = {
				users: {
					name: "users",
					columns: {
						id: { name: "id", notNull: true, primaryKey: true, constructor: { name: "uuid" } },
					},
				},
			} as any;

			const config: GraphQLGenerationConfig = { typePrefix: "My" };
			const schema = generateGraphQLSchema(tables, config);

			expect(schema).toBeInstanceOf(GraphQLSchema);
		});
	});

	describe("schema structure", () => {
		test("should have proper query fields", () => {
			const tables = {
				users: {
					name: "users",
					columns: {
						id: { name: "id", notNull: true, primaryKey: true, constructor: { name: "uuid" } },
					},
				},
			} as any;

			const schema = generateGraphQLSchema(tables);
			const queryType = schema.getQueryType()!;
			const fields = queryType.getFields();

			// Query should have a field for the table
			expect(Object.keys(fields).length).toBeGreaterThan(0);
		});

		test("should have mutation fields when enabled", () => {
			const tables = {
				users: {
					name: "users",
					columns: {
						id: { name: "id", notNull: true, primaryKey: true, constructor: { name: "uuid" } },
					},
				},
			} as any;

			const schema = generateGraphQLSchema(tables);
			const mutationType = schema.getMutationType()!;
			const fields = mutationType.getFields();

			// Mutation should have fields
			expect(Object.keys(fields).length).toBeGreaterThan(0);
		});

		test("should have subscription fields when enabled", () => {
			const tables = {
				users: {
					name: "users",
					columns: {
						id: { name: "id", notNull: true, primaryKey: true, constructor: { name: "uuid" } },
					},
				},
			} as any;

			const schema = generateGraphQLSchema(tables);
			const subscriptionType = schema.getSubscriptionType()!;
			const fields = subscriptionType.getFields();

			// Subscription should have fields
			expect(Object.keys(fields).length).toBeGreaterThan(0);
		});
	});
});
