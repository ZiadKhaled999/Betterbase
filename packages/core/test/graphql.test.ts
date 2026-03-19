import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { generateResolvers } from "../src/graphql/resolvers";
import { generateGraphQLSchema } from "../src/graphql/schema-generator";
import { exportSDL, exportTypeSDL } from "../src/graphql/sdl-exporter";

let tmpDir: string;

beforeAll(() => {
	tmpDir = mkdtempSync(path.join(os.tmpdir(), "betterbase-test-"));
});

afterAll(() => {
	rmSync(tmpDir, { recursive: true, force: true });
});

// Mock Drizzle table type for testing - use compatible type
interface MockColumn {
	name: string;
	notNull?: boolean;
	primaryKey?: boolean;
	default?: unknown;
	mode?: string;
	// Add constructor to mock Drizzle column behavior
	constructor?: { name: string };
}

interface MockTable {
	name: string;
	columns: Record<string, MockColumn>;
}

describe("graphql/schema-generator", () => {
	describe("generateGraphQLSchema", () => {
		it("generates schema with empty tables object", () => {
			const schema = generateGraphQLSchema({});
			expect(schema).toBeDefined();
			expect(schema.getQueryType()).toBeDefined();
		});

		it("generates schema with single table", () => {
			const tables: Record<string, MockTable> = {
				users: {
					name: "users",
					columns: {
						id: { name: "id", notNull: true, primaryKey: true },
						name: { name: "name", notNull: true },
						email: { name: "email" },
					},
				},
			};
			const schema = generateGraphQLSchema(tables);
			expect(schema).toBeDefined();
			// Query type should be generated
			expect(schema.getQueryType()).toBeDefined();
			// Query fields should reference the table
			const queryFields = schema.getQueryType()?.getFields();
			expect(queryFields).toHaveProperty("users");
			expect(queryFields).toHaveProperty("usersList");
		});

		it("generates query type with get and list operations", () => {
			const tables: Record<string, MockTable> = {
				users: {
					name: "users",
					columns: {
						id: { name: "id", notNull: true, primaryKey: true },
					},
				},
			};
			const schema = generateGraphQLSchema(tables);
			const queryType = schema.getQueryType();
			expect(queryType).toBeDefined();
			const fields = queryType?.getFields();
			expect(fields).toHaveProperty("users");
			expect(fields).toHaveProperty("usersList");
		});

		it("generates mutation type when enabled", () => {
			const tables: Record<string, MockTable> = {
				users: {
					name: "users",
					columns: {
						id: { name: "id", notNull: true, primaryKey: true },
						name: { name: "name", notNull: true },
					},
				},
			};
			const schema = generateGraphQLSchema(tables, { mutations: true });
			const mutationType = schema.getMutationType();
			expect(mutationType).toBeDefined();
			const fields = mutationType?.getFields();
			expect(fields).toHaveProperty("createUser");
			expect(fields).toHaveProperty("updateUser");
			expect(fields).toHaveProperty("deleteUser");
		});

		it("does not generate mutation type when disabled", () => {
			const tables: Record<string, MockTable> = {
				users: {
					name: "users",
					columns: {
						id: { name: "id", notNull: true, primaryKey: true },
					},
				},
			};
			const schema = generateGraphQLSchema(tables, { mutations: false });
			const mutationType = schema.getMutationType();
			expect(mutationType).toBeNull();
		});

		it("generates subscription type when enabled", () => {
			const tables: Record<string, MockTable> = {
				users: {
					name: "users",
					columns: {
						id: { name: "id", notNull: true, primaryKey: true },
					},
				},
			};
			const schema = generateGraphQLSchema(tables, { subscriptions: true });
			const subscriptionType = schema.getSubscriptionType();
			expect(subscriptionType).toBeDefined();
		});

		it("does not generate subscription type when disabled", () => {
			const tables: Record<string, MockTable> = {
				users: {
					name: "users",
					columns: {
						id: { name: "id", notNull: true, primaryKey: true },
					},
				},
			};
			const schema = generateGraphQLSchema(tables, { subscriptions: false });
			const subscriptionType = schema.getSubscriptionType();
			expect(subscriptionType).toBeUndefined();
		});

		it("applies type prefix when configured", () => {
			const tables: Record<string, MockTable> = {
				users: {
					name: "users",
					columns: {
						id: { name: "id", notNull: true, primaryKey: true },
					},
				},
			};
			const schema = generateGraphQLSchema(tables, { typePrefix: "App" });
			const userType = schema.getType("AppUser");
			expect(userType).toBeDefined();
		});
	});
});

describe("graphql/sdl-exporter", () => {
	describe("exportSDL", () => {
		it("exports empty schema with Query type", () => {
			const schema = generateGraphQLSchema({});
			const sdl = exportSDL(schema);
			expect(sdl).toContain("type Query");
		});

		it("exports custom scalars", () => {
			const tables: Record<string, MockTable> = {
				items: {
					name: "items",
					columns: {
						id: { name: "id", notNull: true, primaryKey: true },
						data: { name: "data", mode: "json" },
						timestamp: { name: "timestamp", mode: "timestamp" },
					},
				},
			};
			const schema = generateGraphQLSchema(tables);
			const sdl = exportSDL(schema);
			expect(sdl).toContain("scalar JSON");
			expect(sdl).toContain("scalar DateTime");
		});

		it("exports mutations when present", () => {
			const tables: Record<string, MockTable> = {
				users: {
					name: "users",
					columns: {
						id: { name: "id", notNull: true, primaryKey: true },
						name: { name: "name", notNull: true },
					},
				},
			};
			const schema = generateGraphQLSchema(tables, { mutations: true });
			const sdl = exportSDL(schema);
			expect(sdl).toContain("type Mutation");
		});

		it("exports subscriptions when present", () => {
			const tables: Record<string, MockTable> = {
				users: {
					name: "users",
					columns: {
						id: { name: "id", notNull: true, primaryKey: true },
					},
				},
			};
			const schema = generateGraphQLSchema(tables, { subscriptions: true });
			const sdl = exportSDL(schema);
			expect(sdl).toContain("type Subscription");
		});

		it("respects includeDescriptions option", () => {
			const schema = generateGraphQLSchema({});
			const sdlNoDesc = exportSDL(schema, { includeDescriptions: false });
			const sdlWithDesc = exportSDL(schema, { includeDescriptions: true });
			expect(sdlNoDesc).toBeDefined();
			expect(sdlWithDesc).toBeDefined();
		});

		it("respects sortTypes option", () => {
			const tables: Record<string, MockTable> = {
				users: {
					name: "users",
					columns: {
						id: { name: "id", notNull: true, primaryKey: true },
					},
				},
				posts: {
					name: "posts",
					columns: {
						id: { name: "id", notNull: true, primaryKey: true },
					},
				},
			};
			const schema = generateGraphQLSchema(tables);
			const sdl = exportSDL(schema, { sortTypes: true });
			expect(sdl).toContain("type Query");
		});
	});

	describe("exportTypeSDL", () => {
		it("exports a specific object type", () => {
			const tables: Record<string, MockTable> = {
				users: {
					name: "users",
					columns: {
						id: { name: "id", notNull: true, primaryKey: true },
						name: { name: "name", notNull: true },
					},
				},
			};
			const schema = generateGraphQLSchema(tables);
			const typeSdl = exportTypeSDL(schema, "User");
			expect(typeSdl).toContain("type User");
			expect(typeSdl).toContain("id");
		});

		it("throws for non-existent type", () => {
			const schema = generateGraphQLSchema({});
			expect(() => exportTypeSDL(schema, "NonExistent")).toThrow('Type "NonExistent" not found');
		});
	});
});

describe("graphql/resolvers", () => {
	describe("generateResolvers", () => {
		it("generates resolvers for empty tables", () => {
			const mockDb = {};
			const resolvers = generateResolvers({}, mockDb as any);
			expect(resolvers.Query).toEqual({});
			expect(resolvers.Mutation).toEqual({});
		});

		it("generates query resolvers", () => {
			const tables: Record<string, MockTable> = {
				users: {
					name: "users",
					columns: {
						id: { name: "id", notNull: true, primaryKey: true },
					},
				},
			};
			const mockDb = {
				select: () => ({
					from: () => ({
						where: () => ({
							limit: () => ({
								execute: () => Promise.resolve([]),
							}),
						}),
					}),
				}),
				insert: () => ({
					values: () => ({
						returning: () => Promise.resolve([]),
					}),
				}),
				update: () => ({
					set: () => ({
						where: () => ({
							returning: () => Promise.resolve([]),
						}),
					}),
				}),
				delete: () => ({
					where: () => ({
						returning: () => Promise.resolve([]),
					}),
				}),
			};
			const resolvers = generateResolvers(tables, mockDb as any);
			expect(resolvers.Query).toHaveProperty("users");
			expect(resolvers.Query).toHaveProperty("usersList");
		});

		it("respects mutations config", () => {
			const tables: Record<string, MockTable> = {
				users: {
					name: "users",
					columns: {
						id: { name: "id", notNull: true, primaryKey: true },
					},
				},
			};
			const mockDb = {};
			const resolvers = generateResolvers(tables, mockDb as any, { mutations: false });
			expect(resolvers.Mutation).toEqual({});
		});

		it("respects subscriptions config", () => {
			const tables: Record<string, MockTable> = {
				users: {
					name: "users",
					columns: {
						id: { name: "id", notNull: true, primaryKey: true },
					},
				},
			};
			const mockDb = {};
			const resolvers = generateResolvers(tables, mockDb as any, { subscriptions: false });
			expect(resolvers.Subscription).toBeUndefined();
		});
	});
});
