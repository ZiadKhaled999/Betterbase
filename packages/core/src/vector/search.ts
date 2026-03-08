/**
 * Vector Similarity Search Functions
 *
 * Provides functions for performing vector similarity search using pgvector.
 * Supports cosine similarity, euclidean distance, and inner product.
 */

import { and, sql, asc, desc } from "drizzle-orm";
import type { PgTable, PgColumn } from "drizzle-orm/pg-core";
import type {
	SearchOptions,
	VectorSearchResult,
	SimilarityMetric,
} from "./types";

/**
 * pgvector operator mappings
 * These operators are used in PostgreSQL for vector similarity calculations
 */
export const VECTOR_OPERATORS: Record<SimilarityMetric, string> = {
	cosine: "<=>", // Cosine distance (returns 1 - cosine_similarity)
	euclidean: "<->", // Euclidean distance
	inner_product: "<#>", // Inner product (negative for similarity)
};

/**
 * Type for a Drizzle table with columns
 */
type DrizzleTableWithColumns = {
	columns: Record<string, PgColumn>;
};

/**
 * Creates a vector similarity expression for Drizzle ORM
 *
 * @param table - The Drizzle table
 * @param vectorColumn - The name of the vector column
 * @param queryEmbedding - The embedding to search for
 * @param metric - The similarity metric to use
 * @returns SQL expression for vector similarity
 *
 * @example
 * ```typescript
 * import { cosineDistance } from './search';
 *
 * const results = await db
 *   .select({
 *     id: posts.id,
 *     title: posts.title,
 *     similarity: cosineDistance(posts.embedding, queryEmbedding),
 *   })
 *   .from(posts)
 *   .orderBy(cosineDistance(posts.embedding, queryEmbedding));
 * ```
 */
export function vectorDistance(
	table: DrizzleTableWithColumns,
	vectorColumn: string,
	queryEmbedding: number[],
	metric: SimilarityMetric = "cosine",
) {
	const column = table.columns[vectorColumn];
	const operator = VECTOR_OPERATORS[metric];

	// Validate that every item is a finite number
	for (let i = 0; i < queryEmbedding.length; i++) {
		if (!Number.isFinite(queryEmbedding[i])) {
			throw new Error(`Invalid embedding value at index ${i}: must be a finite number`);
		}
	}

	// Use parameterized values with sql.join to safely pass embedding values
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	return sql<any>`${column} ${sql.raw(operator)} (${sql.join(
		queryEmbedding.map((v) => sql`${v}::float8`),
		", "
	)})::vector`;
}

/**
 * Creates a cosine distance expression (1 - cosine_similarity)
 * This is the preferred metric for most use cases as it's bounded and works well with normalization
 */
export function cosineDistance(
	table: DrizzleTableWithColumns,
	vectorColumn: string,
	queryEmbedding: number[],
) {
	return vectorDistance(table, vectorColumn, queryEmbedding, "cosine");
}

/**
 * Creates a euclidean distance expression
 * Straight-line distance between two vectors
 */
export function euclideanDistance(
	table: DrizzleTableWithColumns,
	vectorColumn: string,
	queryEmbedding: number[],
) {
	return vectorDistance(table, vectorColumn, queryEmbedding, "euclidean");
}

/**
 * Creates an inner product expression (negative inner product for similarity ranking)
 * Note: For similarity ranking, use negative inner product (more negative = more similar)
 */
export function innerProductDistance(
	table: DrizzleTableWithColumns,
	vectorColumn: string,
	queryEmbedding: number[],
) {
	return vectorDistance(table, vectorColumn, queryEmbedding, "inner_product");
}

/**
 * Performs a vector similarity search on a table
 *
 * @param db - The Drizzle database connection
 * @param table - The table to search
 * @param vectorColumn - The name of the vector column
 * @param queryEmbedding - The embedding to search for
 * @param options - Search options (limit, threshold, metric, filter)
 * @returns Array of search results with similarity scores
 *
 * @example
 * ```typescript
 * const results = await vectorSearch(db, posts, 'embedding', queryEmbedding, {
 *   limit: 10,
 *   metric: 'cosine',
 *   threshold: 0.7,
 * });
 * ```
 */
export async function vectorSearch<TItem = Record<string, unknown>>(
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	db: any,
	table: DrizzleTableWithColumns,
	vectorColumn: string,
	queryEmbedding: number[],
	options: SearchOptions = {},
): Promise<VectorSearchResult<TItem>[]> {
	const {
		limit = 10,
		threshold,
		metric = "cosine",
		filter,
		includeScore = true,
	} = options;

	const distanceExpr = vectorDistance(table, vectorColumn, queryEmbedding, metric);

	// Build the select with all columns
	const selectColumns: Record<string, unknown> = {};
	for (const [colName, col] of Object.entries(table.columns)) {
		selectColumns[colName] = col;
	}

	// Build the query
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let queryBuilder: any = db
		.select({
			...selectColumns,
			...(includeScore ? { _score: distanceExpr } : {}),
		})
		.from(table as unknown as PgTable);

	// Apply filters if provided
	if (filter && Object.keys(filter).length > 0) {
		const conditions = Object.entries(filter).map(([key, value]) => {
			const column = table.columns[key];
			if (column) {
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				return (column as any).eq(value);
			}
			return null;
		}).filter(Boolean);

		if (conditions.length > 0) {
			queryBuilder = queryBuilder.where(and(...conditions));
		}
	}

	// Apply ordering based on metric
	// For cosine and euclidean, lower distance = more similar
	// For inner product, higher (less negative) = more similar
	const orderFn = metric === "inner_product" ? desc : asc;
	queryBuilder = queryBuilder.orderBy(orderFn(distanceExpr));

	// Apply limit
	queryBuilder = queryBuilder.limit(limit);

	// Execute query
	const results = await queryBuilder.execute();

	// Filter by threshold if provided and transform results
	return results
		.map((row: Record<string, unknown>) => {
			const score = includeScore ? (row._score as number) : 0;
			const { _score, ...item } = row;
			return {
				item: item as TItem,
				score,
			};
		})
		.filter((result: VectorSearchResult<TItem>) => {
			if (threshold === undefined) return true;

			// For cosine, threshold is minimum similarity (0-1)
			if (metric === "cosine") {
				const similarity = 1 - result.score;
				return similarity >= threshold;
			}

			// For euclidean, threshold is max distance
			if (metric === "euclidean") {
				return result.score <= threshold;
			}

			// For inner product, higher (less negative) is more similar
			return result.score >= threshold;
		});
}

/**
 * Builds a raw SQL vector search query string
 * Useful for complex queries or when you need more control
 *
 * @param tableName - Name of the table to search
 * @param vectorColumn - Name of the vector column
 * @param queryEmbedding - The embedding to search for
 * @param options - Search options
 * @returns Object with query string and parameters
 */
export function buildVectorSearchQuery(
	tableName: string,
	vectorColumn: string,
	queryEmbedding: number[],
	options: SearchOptions = {},
): { query: string; params: unknown[] } {
	const {
		limit = 10,
		threshold: _threshold,
		metric = "cosine",
		filter,
	} = options;

	const operator = VECTOR_OPERATORS[metric];
	const embeddingStr = `[${queryEmbedding.join(",")}]`;

	const orderBy = metric === "inner_product" ? "DESC" : "ASC";

	let whereClause = "";
	const params: unknown[] = [embeddingStr];

	if (filter && Object.keys(filter).length > 0) {
		const filterConditions = Object.entries(filter).map(([key, value], index) => {
			params.push(value);
			return `${key} = $${index + 2}`;
		});
		whereClause = `WHERE ${filterConditions.join(" AND ")}`;
	}

	const query = `
		SELECT *, ${vectorColumn} ${operator} $1::vector AS _score
		FROM ${tableName}
		${whereClause}
		ORDER BY _score ${orderBy}
		LIMIT ${limit}
	`;

	return { query, params };
}

/**
 * Creates a vector index on a column
 * Use this to optimize vector search performance
 *
 * @param tableName - Name of the table
 * @param columnName - Name of the vector column
 * @param indexType - Type of index (ivfflat or hnsw)
 * @param options - Additional index options
 * @returns SQL statement to create the index
 *
 * @example
 * ```sql
 * -- HNSW index for fast approximate search
 * CREATE INDEX ON documents USING hnsw (embedding vector_cosine_ops)
 * WITH (m = 16, ef_construction = 64);
 *
 * -- IVFFlat index for larger datasets
 * CREATE INDEX ON documents USING ivfflat (embedding vector_cosine_ops)
 * WITH (lists = 100);
 * ```
 */
export function createVectorIndex(
	tableName: string,
	columnName: string,
	indexType: "ivfflat" | "hnsw" = "hnsw",
	options: {
		lists?: number;
		connections?: number;
		metric?: SimilarityMetric;
	} = {},
): string {
	const { lists = 100, connections = 16, metric = "cosine" } = options;

	// Map metric to pgvector ops
	const ops: Record<SimilarityMetric, string> = {
		cosine: "vector_cosine_ops",
		euclidean: "vector_l2_ops",
		inner_product: "vector_ip_ops",
	};

	const opsType = ops[metric];

	if (indexType === "hnsw") {
		return `
			CREATE INDEX ON ${tableName} 
			USING hnsw (${columnName} ${opsType})
			WITH (m = ${connections}, ef_construction = ${connections * 4});
		`.trim();
	}

	return `
		CREATE INDEX ON ${tableName}
		USING ivfflat (${columnName} ${opsType})
		WITH (lists = ${lists});
	`.trim();
}

/**
 * Validates that an embedding array is valid for vector operations
 * @param embedding - The embedding to validate
 * @throws Error if the embedding is invalid
 */
export function validateEmbedding(embedding: number[]): void {
	if (!Array.isArray(embedding)) {
		throw new Error("Embedding must be an array");
	}

	if (embedding.length === 0) {
		throw new Error("Embedding cannot be empty");
	}

	if (embedding.some((val) => typeof val !== "number" || isNaN(val))) {
		throw new Error("Embedding must contain only valid numbers");
	}

	if (embedding.some((val) => !isFinite(val))) {
		throw new Error("Embedding contains non-finite numbers");
	}
}

/**
 * Converts a query embedding to a SQL-safe string representation
 * @param embedding - The embedding array
 * @returns SQL vector literal string
 */
export function embeddingToSql(embedding: number[]): string {
	return `[${embedding.join(",")}]`;
}
