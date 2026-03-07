/**
 * GraphQL Resolvers Generator
 *
 * Auto-generates GraphQL resolvers that call Drizzle ORM directly.
 * Each resolver respects auth context from BetterAuth.
 */

import { and, eq } from "drizzle-orm";

// Vector search imports
import { vectorSearch, validateEmbedding } from "../vector/search";
import { generateEmbedding } from "../vector/embeddings";

/**
 * Type for database connection - using any for flexibility
 */
export type DatabaseConnection = unknown;

/**
 * GraphQL context with auth information
 */
export interface GraphQLContext {
	/** The database connection */
	db: DatabaseConnection;
	/** Current user from BetterAuth (if authenticated) */
	user?: {
		id: string;
		email?: string;
		name?: string;
		image?: string;
	};
	/** Request headers */
	headers: Headers;
	/** Any additional context */
	[key: string]: unknown;
}

/**
 * GraphQL resolver function type
 */
export type GraphQLResolver = (
	parent: unknown,
	args: Record<string, unknown>,
	context: GraphQLContext,
	info: unknown,
) => Promise<unknown> | unknown;

/**
 * Resolver map type
 */
export interface Resolvers {
	Query?: {
		[field: string]: GraphQLResolver;
	};
	Mutation?: {
		[field: string]: GraphQLResolver;
	};
	Subscription?: {
		[field: string]: GraphQLResolver;
	};
}

/**
 * Configuration for resolver generation
 */
export interface ResolverGenerationConfig {
	/** Enable subscriptions (default: true) */
	subscriptions?: boolean;
	/** Enable mutations (default: true) */
	mutations?: boolean;
	/** Custom before/after hooks for mutations */
	hooks?: {
		beforeCreate?: (
			input: Record<string, unknown>,
			context: GraphQLContext,
		) => Promise<Record<string, unknown> | null>;
		afterCreate?: (result: unknown, context: GraphQLContext) => Promise<unknown>;
		beforeUpdate?: (
			id: string,
			input: Record<string, unknown>,
			context: GraphQLContext,
		) => Promise<Record<string, unknown> | null>;
		afterUpdate?: (result: unknown, context: GraphQLContext) => Promise<unknown>;
		beforeDelete?: (id: string, context: GraphQLContext) => Promise<boolean>;
		afterDelete?: (result: unknown, context: GraphQLContext) => Promise<unknown>;
	};
	/** Custom error handler */
	onError?: (error: Error, operation: string, context: GraphQLContext) => void;
}

/**
 * Default resolver configuration
 */
const defaultConfig: Required<ResolverGenerationConfig> = {
	subscriptions: true,
	mutations: true,
	hooks: {},
	onError: (error: Error) => {
		console.error(`[GraphQL Resolver Error]: ${error.message}`);
	},
};

/**
 * Type for Drizzle table object
 */
type DrizzleTable = {
	name: string;
	columns: Record<string, unknown>;
};

/**
 * Get primary key column name from a table
 */
function getPrimaryKeyColumnName(table: DrizzleTable): string {
	for (const [name, column] of Object.entries(table.columns)) {
		if ((column as { primaryKey?: boolean }).primaryKey) {
			return name;
		}
	}
	return "id";
}

/**
 * Capitalize first letter helper
 */
function capitalize(str: string): string {
	return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Type for the Drizzle query builder - improved to reduce any casting
 */
interface DrizzleQueryBuilder {
	select: () => {
		from: <T>(table: T) => {
			where: (condition: unknown) => {
				limit: (n: number) => {
					offset: (n: number) => Promise<unknown[]>;
					all: () => Promise<unknown[]>;
					execute: () => Promise<unknown[]>;
				};
				offset: (n: number) => Promise<unknown[]>;
				all: () => Promise<unknown[]>;
				execute: () => Promise<unknown[]>;
				orderBy: (...args: unknown[]) => unknown;
			};
			limit: (n: number) => {
				offset: (n: number) => Promise<unknown[]>;
				all: () => Promise<unknown[]>;
				execute: () => Promise<unknown[]>;
				orderBy: (...args: unknown[]) => unknown;
			};
			all: () => Promise<unknown[]>;
			execute: () => Promise<unknown[]>;
		};
	};
}

/**
 * Type for the Drizzle insert builder
 */
interface DrizzleInsertBuilder {
	insert: <T>(table: T) => {
		values: (data: unknown) => {
			returning: () => Promise<unknown[]>;
		};
	};
}

/**
 * Type for the Drizzle update builder
 */
interface DrizzleUpdateBuilder {
	update: <T>(table: T) => {
		set: (data: unknown) => {
			where: (condition: unknown) => {
				returning: () => Promise<unknown[]>;
			};
		};
	};
}

/**
 * Type for the Drizzle delete builder
 */
interface DrizzleDeleteBuilder {
	delete: <T>(table: T) => {
		where: (condition: unknown) => {
			returning: () => Promise<unknown[]>;
			run: () => Promise<unknown>;
		};
	};
}

/**
 * Type for the Drizzle database - improved with proper return types
 */
interface DrizzleDb {
	select: DrizzleQueryBuilder["select"];
	insert: DrizzleInsertBuilder["insert"];
	update: DrizzleUpdateBuilder["update"];
	delete: DrizzleDeleteBuilder["delete"];
}

/**
 * Generate resolvers for a single table
 */
function generateTableResolvers(
	tableName: string,
	table: DrizzleTable,
	db: DrizzleDb,
	config: Required<ResolverGenerationConfig>,
): Record<string, GraphQLResolver> {
	const pkColumnName = getPrimaryKeyColumnName(table);
	const resolvers: Record<string, GraphQLResolver> = {};

	// Get by ID resolver
	resolvers[tableName] = async (
		_parent: unknown,
		args: Record<string, unknown>,
		context: GraphQLContext,
	) => {
		try {
			const id = args.id as string;
			const pkColumn = table.columns[pkColumnName];

			// Use DrizzleDb type - need to cast db for cross-dialect compatibility
			// The Drizzle query builder types vary between database dialects
			const dbTyped = db as unknown as DrizzleDb;
			const pkColumnTyped = pkColumn as unknown as Parameters<typeof eq>[0];
			const result = await dbTyped
				.select()
				.from(table)
				.where(eq(pkColumnTyped, id))
				.limit(1)
				.execute();

			return result[0] || null;
		} catch (error) {
			config.onError(error as Error, `${tableName}:getById`, context);
			return null;
		}
	};

	// List resolver
	resolvers[`${tableName}List`] = async (
		_parent: unknown,
		args: Record<string, unknown>,
		context: GraphQLContext,
	) => {
		try {
			const limit = args.limit as number | undefined;
			const offset = args.offset as number | undefined;
			const filter = args.filter as Record<string, unknown> | undefined;

			// Use typed db but cast the query builder for complex operations
			// Drizzle query builder types vary between database dialects
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			let queryBuilder: any = db.select().from(table);

			// Apply filter if provided
			if (filter && typeof filter === "object") {
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				const conditions: any[] = [];

				for (const [key, value] of Object.entries(filter)) {
					if (value !== undefined && value !== null) {
						const column = table.columns[key];
						if (column) {
							// eslint-disable-next-line @typescript-eslint/no-explicit-any
							conditions.push(eq(column as any, value));
						}
					}
				}

				if (conditions.length > 0) {
					queryBuilder = queryBuilder.where(and(...conditions));
				}
			}

			// Apply pagination
			if (limit) {
				queryBuilder = queryBuilder.limit(limit);
			}

			if (offset) {
				queryBuilder = queryBuilder.offset(offset);
			}

			return await queryBuilder.all();
		} catch (error) {
			config.onError(error as Error, `${tableName}:list`, context);
			return [];
		}
	};

	// Create resolver
	if (config.mutations) {
		resolvers[`create${capitalize(tableName)}`] = async (
			_parent: unknown,
			args: Record<string, unknown>,
			context: GraphQLContext,
		) => {
			try {
				const input = (args.input as Record<string, unknown>) || {};
				let processedInput = { ...input };

				// Apply beforeCreate hook
				if (config.hooks.beforeCreate) {
					const modifiedInput = await config.hooks.beforeCreate(processedInput, context);
					if (modifiedInput === null) {
						throw new Error("Create operation cancelled by beforeCreate hook");
					}
					processedInput = modifiedInput;
				}

				// Add user ID if authenticated
				if (context.user) {
					processedInput = {
						...processedInput,
						userId: context.user.id,
					};
				}

				const dbTyped = db as unknown as DrizzleDb;
				const result = await dbTyped.insert(table).values(processedInput).returning();

				const created = result[0];

				// Apply afterCreate hook
				if (config.hooks.afterCreate) {
					await config.hooks.afterCreate(created, context);
				}

				return created;
			} catch (error) {
				config.onError(error as Error, `${tableName}:create`, context);
				throw error;
			}
		};

		// Update resolver
		resolvers[`update${capitalize(tableName)}`] = async (
			_parent: unknown,
			args: Record<string, unknown>,
			context: GraphQLContext,
		) => {
			try {
				const id = args.id as string;
				const input = (args.input as Record<string, unknown>) || {};
				let processedInput = { ...input };

				// Apply beforeUpdate hook
				if (config.hooks.beforeUpdate) {
					const modifiedInput = await config.hooks.beforeUpdate(id, processedInput, context);
					if (modifiedInput === null) {
						throw new Error("Update operation cancelled by beforeUpdate hook");
					}
					processedInput = modifiedInput;
				}

				const pkColumn = table.columns[pkColumnName];

				const dbTyped = db as unknown as DrizzleDb;
				const pkColumnTyped = pkColumn as unknown as Parameters<typeof eq>[0];
				const result = await dbTyped
					.update(table)
					.set({
						...processedInput,
						updatedAt: new Date(),
					})
					.where(eq(pkColumnTyped, id))
					.returning();

				const updated = result[0];

				// Apply afterUpdate hook
				if (config.hooks.afterUpdate) {
					await config.hooks.afterUpdate(updated, context);
				}

				return updated || null;
			} catch (error) {
				config.onError(error as Error, `${tableName}:update`, context);
				throw error;
			}
		};

		// Delete resolver
		resolvers[`delete${capitalize(tableName)}`] = async (
			_parent: unknown,
			args: Record<string, unknown>,
			context: GraphQLContext,
		) => {
			try {
				const id = args.id as string;

				// Apply beforeDelete hook
				if (config.hooks.beforeDelete) {
					const canDelete = await config.hooks.beforeDelete(id, context);
					if (!canDelete) {
						throw new Error("Delete operation cancelled by beforeDelete hook");
					}
				}

				const pkColumn = table.columns[pkColumnName];

				const result = await (db as any)
					.delete(table)
					.where(eq(pkColumn as any, id))
					.returning();

				const deleted = result[0];

				// Apply afterDelete hook
				if (config.hooks.afterDelete) {
					await config.hooks.afterDelete(deleted, context);
				}

				return deleted || null;
			} catch (error) {
				config.onError(error as Error, `${tableName}:delete`, context);
				throw error;
			}
		};
	}

	return resolvers;
}

/**
 * Generate resolvers for all tables in a Drizzle schema
 *
 * @param tables - Object mapping table names to Drizzle table definitions
 * @param db - The Drizzle database connection
 * @param config - Optional configuration for resolver generation
 * @returns A complete resolver map for GraphQL
 *
 * @example
 * ```typescript
 * import { db } from './db';
 * import { users, posts } from './db/schema';
 *
 * const resolvers = generateResolvers({
 *   users,
 *   posts,
 * }, db, {
 *   hooks: {
 *     beforeCreate: async (input, context) => {
 *       console.log('Creating:', input);
 *       return input;
 *     },
 *   },
 * });
 * ```
 */
export function generateResolvers(
	tables: Record<string, DrizzleTable>,
	db: DrizzleDb,
	config: ResolverGenerationConfig = {},
): Resolvers {
	const mergedConfig = { ...defaultConfig, ...config };

	const resolvers: Resolvers = {
		Query: {},
		Mutation: {},
		Subscription: {},
	};

	// Generate resolvers for each table
	for (const [tableName, table] of Object.entries(tables)) {
		const tableResolvers = generateTableResolvers(tableName, table, db, mergedConfig);

		// Add to appropriate resolver section
		for (const [fieldName, resolver] of Object.entries(tableResolvers)) {
			if (fieldName === tableName || fieldName.endsWith("List")) {
				resolvers.Query![fieldName] = resolver;
			} else if (
				fieldName.startsWith("create") ||
				fieldName.startsWith("update") ||
				fieldName.startsWith("delete")
			) {
				resolvers.Mutation![fieldName] = resolver;
			} else {
				// Default to Query
				resolvers.Query![fieldName] = resolver;
			}
		}
	}

	// Generate subscription resolvers if enabled
	// Note: Subscriptions require a realtime layer (Phase 6) to be fully functional
	// These are stubs that indicate subscriptions are not yet implemented
	if (mergedConfig.subscriptions) {
		for (const [tableName] of Object.entries(tables)) {
			// Mark subscriptions as not implemented - they will throw an error if called
			// TODO: Implement with realtime layer in Phase 6
			resolvers.Subscription![`${tableName}Created`] = {
				subscribe: () => {
					// Subscriptions require realtime layer (Phase 6) to work properly
					// Return empty iterator to indicate not implemented
					return {
						[Symbol.asyncIterator]() {
							return this;
						},
						next: async () => {
							return { done: true, value: undefined };
						},
					};
				},
			} as unknown as GraphQLResolver;

			resolvers.Subscription![`${tableName}Updated`] = {
				subscribe: () => {
					return {
						[Symbol.asyncIterator]() {
							return this;
						},
						next: async () => {
							return { done: true, value: undefined };
						},
					};
				},
			} as unknown as GraphQLResolver;

			resolvers.Subscription![`${tableName}Deleted`] = {
				subscribe: () => {
					return {
						[Symbol.asyncIterator]() {
							return this;
						},
						next: async () => {
							return { done: true, value: undefined };
						},
					};
				},
			} as unknown as GraphQLResolver;
		}
	}

	return resolvers;
}

/**
 * Create a context function for GraphQL
 *
 * @param getDb - Function that returns the database connection
 * @param getUser - Optional function to get user from request
 * @returns A context function for GraphQL
 */
export function createGraphQLContext(
	getDb: () => DrizzleDb,
	getUser?: (
		headers: Headers,
	) => GraphQLContext["user"] | Promise<GraphQLContext["user"] | undefined>,
) {
	return async (request: Request): Promise<GraphQLContext> => {
		const headers = request.headers;

		// Get user if getUser function is provided
		let user: GraphQLContext["user"] | undefined;
		if (getUser) {
			user = await getUser(headers);
		}

		return {
			db: getDb(),
			user,
			headers,
		};
	};
}

/**
 * Require authentication middleware for resolvers
 *
 * @param resolver - The resolver to wrap
 * @returns A resolver that requires authentication
 */
export function requireAuth(resolver: GraphQLResolver): GraphQLResolver {
	return async (
		parent: unknown,
		args: Record<string, unknown>,
		context: GraphQLContext,
		info: unknown,
	) => {
		if (!context.user) {
			throw new Error("Authentication required");
		}
		return resolver(parent, args, context, info);
	};
}

/**
 * Configuration for vector search resolvers
 */
export interface VectorSearchResolverConfig {
	/** The name of the vector column in the table */
	vectorColumn: string;
	/** Optional: Text column to generate embedding from */
	textColumn?: string;
	/** Embedding configuration */
	embeddingConfig?: {
		provider: "openai" | "cohere" | "huggingface" | "custom";
		model?: string;
		dimensions?: number;
		apiKey?: string;
	};
	/** Default search options */
	defaultOptions?: {
		limit?: number;
		threshold?: number;
		metric?: "cosine" | "euclidean" | "inner_product";
	};
}

/**
 * Generate a vector search resolver for a table
 *
 * @param tableName - Name of the table to search
 * @param table - The Drizzle table definition
 * @param db - The Drizzle database connection
 * @param config - Vector search configuration
 * @returns A resolver function for vector search
 *
 * @example
 * ```typescript
 * import { generateVectorSearchResolver } from './resolvers';
 *
 * const vectorResolvers = generateVectorSearchResolver(
 *   'documents',
 *   documents,
 *   db,
 *   {
 *     vectorColumn: 'embedding',
 *     textColumn: 'content',
 *     embeddingConfig: { provider: 'openai' },
 *   }
 * );
 *
 * // Add to your resolvers
 * const resolvers = {
 *   Query: {
 *     searchDocuments: vectorResolvers.search,
 *   },
 * };
 * ```
 */
export function generateVectorSearchResolver<T = Record<string, unknown>>(
	tableName: string,
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	table: any,
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	db: any,
	config: VectorSearchResolverConfig,
) {
	return {
		/**
		 * Search by embedding vector directly
		 */
		searchByVector: async (
			_parent: unknown,
			args: Record<string, unknown>,
			_context: GraphQLContext,
		): Promise<Array<{ item: T; score: number }>> => {
			try {
				const embedding = args.embedding as number[];
				const limit = (args.limit as number) || config.defaultOptions?.limit || 10;
				const threshold = args.threshold as number | undefined;
				const metric = (args.metric as "cosine" | "euclidean" | "inner_product") ||
					config.defaultOptions?.metric || "cosine";
				const filter = args.filter as Record<string, unknown> | undefined;

				if (!embedding || !Array.isArray(embedding)) {
					throw new Error("embedding is required and must be an array");
				}

				validateEmbedding(embedding);

				const results = await vectorSearch(db, table, config.vectorColumn, embedding, {
					limit,
					threshold,
					metric,
					filter,
					includeScore: true,
				});

				return results as Array<{ item: T; score: number }>;
			} catch (error) {
				console.error(`[Vector Search Error]: ${error}`);
				throw new Error(`Vector search failed: ${error instanceof Error ? error.message : "Unknown error"}`);
			}
		},

		/**
		 * Search by text (generates embedding automatically)
		 */
		searchByText: async (
			_parent: unknown,
			args: Record<string, unknown>,
			_context: GraphQLContext,
		): Promise<Array<{ item: T; score: number }>> => {
			try {
				const text = args.text as string;
				const limit = (args.limit as number) || config.defaultOptions?.limit || 10;
				const threshold = args.threshold as number | undefined;
				const metric = (args.metric as "cosine" | "euclidean" | "inner_product") ||
					config.defaultOptions?.metric || "cosine";
				const filter = args.filter as Record<string, unknown> | undefined;

				if (!text || typeof text !== "string") {
					throw new Error("text is required and must be a string");
				}

				// Generate embedding from text
				const embeddingResult = await generateEmbedding(text, {
					provider: config.embeddingConfig?.provider || "openai",
					model: config.embeddingConfig?.model,
					dimensions: config.embeddingConfig?.dimensions,
					apiKey: config.embeddingConfig?.apiKey,
				});

				const results = await vectorSearch(db, table, config.vectorColumn, embeddingResult.embedding, {
					limit,
					threshold,
					metric,
					filter,
					includeScore: true,
				});

				return results as Array<{ item: T; score: number }>;
			} catch (error) {
				console.error(`[Vector Search Error]: ${error}`);
				throw new Error(`Vector search failed: ${error instanceof Error ? error.message : "Unknown error"}`);
			}
		},
	};
}
