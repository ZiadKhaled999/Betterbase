import { describe, expect, test } from "bun:test";
import {
	type GraphQLContext,
	type GraphQLResolver,
	type ResolverGenerationConfig,
	type Resolvers,
	createGraphQLContext,
	generateResolvers,
	requireAuth,
} from "../src/graphql/resolvers";

// ============================================================================
// GraphQL Resolvers Tests
// ============================================================================

describe("GraphQL Resolvers", () => {
	describe("generateResolvers", () => {
		test("should generate resolvers for single table", () => {
			const tables = {
				users: {
					name: "users",
					columns: {
						id: { name: "id", primaryKey: true },
						name: { name: "name" },
						email: { name: "email" },
					},
				},
			} as any;

			// Create a mock db that works with the resolver
			const mockDb = {
				select: () => ({
					from: () => ({
						where: () => ({
							limit: () => ({
								all: async () => [],
								execute: async () => [],
							}),
						}),
					}),
				}),
				insert: () => ({
					values: () => ({
						returning: async () => [],
					}),
				}),
				update: () => ({
					set: () => ({
						where: () => ({
							returning: async () => [],
						}),
					}),
				}),
				delete: () => ({
					where: () => ({
						returning: async () => [],
						run: async () => {},
					}),
				}),
			} as any;

			const resolvers = generateResolvers(tables, mockDb);

			expect(resolvers.Query).toBeDefined();
			expect(resolvers.Mutation).toBeDefined();
		});

		test("should generate resolvers for multiple tables", () => {
			const tables = {
				users: {
					name: "users",
					columns: {
						id: { name: "id", primaryKey: true },
						name: { name: "name" },
					},
				},
				posts: {
					name: "posts",
					columns: {
						id: { name: "id", primaryKey: true },
						title: { name: "title" },
					},
				},
			} as any;

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
				delete: () => ({ where: () => ({ returning: async () => [], run: async () => {} }) }),
			} as any;

			const resolvers = generateResolvers(tables, mockDb);

			expect(resolvers.Query).toBeDefined();
			expect(resolvers.Mutation).toBeDefined();
		});

		test("should generate subscriptions when enabled", () => {
			const tables = {
				users: {
					name: "users",
					columns: {
						id: { name: "id", primaryKey: true },
						name: { name: "name" },
					},
				},
			} as any;

			const mockDb = {} as any;
			const config: ResolverGenerationConfig = { subscriptions: true };
			const resolvers = generateResolvers(tables, mockDb, config);

			expect(resolvers.Subscription).toBeDefined();
		});

		test("should accept empty config", () => {
			const tables = {
				users: {
					name: "users",
					columns: {
						id: { name: "id", primaryKey: true },
						name: { name: "name" },
					},
				},
			} as any;

			const mockDb = {} as any;
			const config: ResolverGenerationConfig = {};
			const resolvers = generateResolvers(tables, mockDb, config);

			expect(resolvers.Query).toBeDefined();
			expect(resolvers.Mutation).toBeDefined();
		});
	});

	describe("createGraphQLContext", () => {
		test("should create context function", () => {
			const mockDb = { query: {} };

			// createGraphQLContext returns a function that takes a request
			const contextFn = createGraphQLContext(() => mockDb as any);

			expect(typeof contextFn).toBe("function");
		});
	});

	describe("requireAuth", () => {
		test("should wrap a resolver with auth check", () => {
			// requireAuth wraps a resolver function
			const mockResolver: GraphQLResolver = async (parent, args, context) => {
				return { success: true };
			};

			const wrappedResolver = requireAuth(mockResolver);

			expect(typeof wrappedResolver).toBe("function");
		});

		test("wrapped resolver should throw when user missing", async () => {
			const mockResolver: GraphQLResolver = async (parent, args, context) => {
				return { success: true };
			};

			const wrappedResolver = requireAuth(mockResolver);

			// Context without user should cause auth failure
			const contextWithoutUser: GraphQLContext = {
				db: {},
				headers: new Headers(),
			};

			// The requireAuth wrapper should throw when user is missing
			await expect(wrappedResolver(null, {}, contextWithoutUser, null)).rejects.toThrow(/auth/i);
		});

		test("wrapped resolver should call original when user present", async () => {
			const mockResolver: GraphQLResolver = async (parent, args, context) => {
				return { success: true, userId: context.user?.id };
			};

			const wrappedResolver = requireAuth(mockResolver);

			const contextWithUser: GraphQLContext = {
				db: {},
				headers: new Headers(),
				user: { id: "user-123", email: "test@example.com" },
			};

			const result = await wrappedResolver(null, {}, contextWithUser, null);
			expect(result).toEqual({ success: true, userId: "user-123" });
		});
	});

	describe("resolver hooks configuration", () => {
		test("should accept beforeCreate hook", () => {
			const tables = {
				users: {
					name: "users",
					columns: {
						id: { name: "id", primaryKey: true },
						name: { name: "name" },
					},
				},
			} as any;

			const mockDb = {} as any;

			const beforeCreateHook = async (
				input: Record<string, unknown>,
				context: GraphQLContext,
			): Promise<Record<string, unknown> | null> => {
				return input;
			};

			const config: ResolverGenerationConfig = {
				hooks: {
					beforeCreate: beforeCreateHook,
				},
			};

			const resolvers = generateResolvers(tables, mockDb, config);

			expect(resolvers.Mutation).toBeDefined();
		});

		test("should accept afterCreate hook", () => {
			const tables = {
				users: {
					name: "users",
					columns: {
						id: { name: "id", primaryKey: true },
						name: { name: "name" },
					},
				},
			} as any;

			const mockDb = {} as any;

			const afterCreateHook = async (
				result: unknown,
				context: GraphQLContext,
			): Promise<unknown> => {
				return result;
			};

			const config: ResolverGenerationConfig = {
				hooks: {
					afterCreate: afterCreateHook,
				},
			};

			const resolvers = generateResolvers(tables, mockDb, config);

			expect(resolvers.Mutation).toBeDefined();
		});

		test("should accept onError handler", () => {
			const tables = {
				users: {
					name: "users",
					columns: {
						id: { name: "id", primaryKey: true },
						name: { name: "name" },
					},
				},
			} as any;

			const mockDb = {} as any;

			const onErrorHandler = (error: Error, operation: string, context: GraphQLContext): void => {
				console.error(`Error in ${operation}:`, error.message);
			};

			const config: ResolverGenerationConfig = {
				onError: onErrorHandler,
			};

			const resolvers = generateResolvers(tables, mockDb, config);

			expect(resolvers.Query).toBeDefined();
		});
	});

	describe("resolver types", () => {
		test("should have correct Resolvers structure", () => {
			const resolvers: Resolvers = {
				Query: {
					users: async () => [],
				},
				Mutation: {
					createUser: async () => ({}),
				},
			};

			expect(resolvers.Query).toBeDefined();
			expect(resolvers.Mutation).toBeDefined();
		});

		test("GraphQLResolver type should accept function", () => {
			const resolver: GraphQLResolver = async (
				parent: unknown,
				args: Record<string, unknown>,
				context: GraphQLContext,
				info: unknown,
			) => {
				return { success: true };
			};

			expect(typeof resolver).toBe("function");
		});

		test("GraphQLContext should accept db and user", () => {
			const context: GraphQLContext = {
				db: {},
				user: { id: "user-1", email: "test@example.com" },
				headers: new Headers(),
			};

			expect(context.db).toBeDefined();
			expect(context.user).toBeDefined();
			expect(context.headers).toBeDefined();
		});
	});
});
