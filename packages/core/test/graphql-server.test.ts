import { describe, expect, test } from "bun:test";
import {
	createGraphQLServer,
	startGraphQLServer,
	type GraphQLConfig,
} from "../src/graphql/server";
import { generateGraphQLSchema } from "../src/graphql/schema-generator";
import { generateResolvers } from "../src/graphql/resolvers";
import { GraphQLSchema, GraphQLObjectType } from "graphql";

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
				id: { name: "id", primaryKey: true },
				name: { name: "name" },
			},
		},
	} as any;

	return generateGraphQLSchema(tables);
}

/**
 * Create mock resolvers
 */
function createMockResolvers() {
	const mockDb = {
		select: () => ({
			from: () => ({
				where: () => ({
					limit: () => ({
						all: async () => [],
					}),
				}),
			}),
		}),
		insert: () => ({ values: () => ({ returning: async () => [] }) }),
		update: () => ({ set: () => ({ where: () => ({ returning: async () => [] }) }) }),
		delete: () => ({ where: () => ({ returning: async () => [] }) }),
	} as any;

	const tables = {
		users: {
			name: "users",
			columns: {
				id: { name: "id", primaryKey: true },
				name: { name: "name" },
			},
		},
	} as any;

	return generateResolvers(tables, mockDb);
}

/**
 * Mock getDb function
 */
function getMockDb() {
	return {
		query: {},
	};
}

// ============================================================================
// GraphQL Server Tests
// ============================================================================

describe("GraphQL Server", () => {
	describe("createGraphQLServer", () => {
		test("should create server with required config", () => {
			const schema = createTestSchema();
			const resolvers = createMockResolvers();

			const config: GraphQLConfig = {
				schema,
				resolvers,
				getDb: getMockDb,
			};

			const server = createGraphQLServer(config);

			expect(server).toBeDefined();
			expect(server.app).toBeDefined();
			expect(server.yoga).toBeDefined();
			expect(server.server).toBeDefined();
		});

		test("should create server with custom path", () => {
			const schema = createTestSchema();
			const resolvers = createMockResolvers();

			const config: GraphQLConfig = {
				schema,
				resolvers,
				getDb: getMockDb,
				path: "/custom/graphql",
			};

			const server = createGraphQLServer(config);

			expect(server).toBeDefined();
		});

		test("should create server with auth disabled", () => {
			const schema = createTestSchema();
			const resolvers = createMockResolvers();

			const config: GraphQLConfig = {
				schema,
				resolvers,
				getDb: getMockDb,
				auth: false,
			};

			const server = createGraphQLServer(config);

			expect(server).toBeDefined();
		});

		test("should create server with playground disabled", () => {
			const schema = createTestSchema();
			const resolvers = createMockResolvers();

			const config: GraphQLConfig = {
				schema,
				resolvers,
				getDb: getMockDb,
				playground: false,
			};

			const server = createGraphQLServer(config);

			expect(server).toBeDefined();
		});

		test("should create server with custom getUser function", () => {
			const schema = createTestSchema();
			const resolvers = createMockResolvers();

			const getUser = async (headers: Headers) => {
				return { id: "user-1", email: "test@example.com" };
			};

			const config: GraphQLConfig = {
				schema,
				resolvers,
				getDb: getMockDb,
				getUser,
			};

			const server = createGraphQLServer(config);

			expect(server).toBeDefined();
		});

		test("should create server with yoga options", () => {
			const schema = createTestSchema();
			const resolvers = createMockResolvers();

			const config: GraphQLConfig = {
				schema,
				resolvers,
				getDb: getMockDb,
				yogaOptions: {
					plugins: [],
				},
			};

			const server = createGraphQLServer(config);

			expect(server).toBeDefined();
		});
	});

	describe("startGraphQLServer", () => {
		test("should be a function", () => {
			expect(typeof startGraphQLServer).toBe("function");
		});
	});

	describe("GraphQLConfig type", () => {
		test("should accept minimal config", () => {
			const schema = createTestSchema();
			const resolvers = createMockResolvers();

			const config: GraphQLConfig = {
				schema,
				resolvers,
				getDb: getMockDb,
			};

			expect(config.schema).toBeDefined();
			expect(config.resolvers).toBeDefined();
			expect(config.getDb).toBeDefined();
		});

		test("should accept all optional config", () => {
			const schema = createTestSchema();
			const resolvers = createMockResolvers();

			const config: GraphQLConfig = {
				schema,
				resolvers,
				getDb: getMockDb,
				path: "/api/graphql",
				playground: true,
				auth: true,
				getUser: async () => undefined,
				yogaOptions: {},
			};

			expect(config.path).toBe("/api/graphql");
			expect(config.playground).toBe(true);
			expect(config.auth).toBe(true);
		});
	});

	describe("server structure", () => {
		test("should return app with route method", () => {
			const schema = createTestSchema();
			const resolvers = createMockResolvers();

			const config: GraphQLConfig = {
				schema,
				resolvers,
				getDb: getMockDb,
			};

			const server = createGraphQLServer(config);

			// App should have route method
			expect(typeof server.app.route).toBe("function");
		});

		test("should return yoga server instance", () => {
			const schema = createTestSchema();
			const resolvers = createMockResolvers();

			const config: GraphQLConfig = {
				schema,
				resolvers,
				getDb: getMockDb,
			};

			const server = createGraphQLServer(config);

			// Yoga should have handle method
			expect(typeof server.yoga.handle).toBe("function");
		});

		test("should return HTTP server", () => {
			const schema = createTestSchema();
			const resolvers = createMockResolvers();

			const config: GraphQLConfig = {
				schema,
				resolvers,
				getDb: getMockDb,
			};

			const server = createGraphQLServer(config);

			// Server should have listen method
			expect(typeof server.server.listen).toBe("function");
		});
	});

	describe("default configuration", () => {
		test("should use default path when not provided", () => {
			const schema = createTestSchema();
			const resolvers = createMockResolvers();

			const config: GraphQLConfig = {
				schema,
				resolvers,
				getDb: getMockDb,
			};

			const server = createGraphQLServer(config);

			// Server should be created successfully
			expect(server).toBeDefined();
		});
	});
});
