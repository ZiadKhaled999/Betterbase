/**
 * Vector Search Module
 *
 * Main entry point for vector search functionality in BetterBase.
 * Provides embedding generation, similarity search, and schema helpers.
 */

// Types
export * from "./types";

// Embedding utilities
export {
	DEFAULT_EMBEDDING_CONFIGS,
	validateEmbeddingDimensions,
	normalizeVector,
	computeCosineSimilarity,
	createEmbeddingConfig,
	EmbeddingProviderBase,
	OpenAIEmbeddingProvider,
	CohereEmbeddingProvider,
	createEmbeddingProvider,
	generateEmbedding,
	generateEmbeddings,
} from "./embeddings";

// Search functions
export {
	VECTOR_OPERATORS,
	vectorDistance,
	cosineDistance,
	euclideanDistance,
	innerProductDistance,
	vectorSearch,
	buildVectorSearchQuery,
	createVectorIndex,
	validateEmbedding,
	embeddingToSql,
} from "./search";

import { vector } from "drizzle-orm/pg-core";
import type { VectorColumnConfig } from "./types";

/**
 * Creates a vector column for Drizzle schema
 * 
 * @param config - Configuration for the vector column
 * @returns A Drizzle vector column definition
 * 
 * @example
 * ```typescript
 * import { pgTable } from 'drizzle-orm/pg-core';
 * import { vector } from './vector';
 * 
 * const documents = pgTable('documents', {
 *   id: serial('id').primaryKey(),
 *   content: text('content'),
 *   embedding: vector('embedding', { dimensions: 1536 }),
 * });
 * ```
 */
export function createVectorColumn(name: string, config: VectorColumnConfig) {
	return vector(name, { dimensions: config.dimensions });
}

/**
 * Creates a vector column with custom configuration
 * Useful for specifying notNull, default, etc.
 * 
 * @param config - Configuration including dimensions, nullable, default
 * @returns A configured Drizzle vector column
 */
export function vectorColumn(config: {
	dimensions: number;
	nullable?: boolean;
	default?: number[];
}) {
	return vector("vector", {
		dimensions: config.dimensions,
	});
}

/**
 * Default vector search configuration
 */
export const DEFAULT_VECTOR_CONFIG = {
	enabled: true,
	provider: "openai" as const,
	model: "text-embedding-3-small",
	dimensions: 1536,
	metric: "cosine" as const,
	defaultLimit: 10,
	defaultThreshold: 0.7,
};

/**
 * Helper to check if pgvector extension is available
 * Use this in migrations or setup scripts
 */
export const PGVECTOR_EXTENSION_SQL = "CREATE EXTENSION IF NOT EXISTS vector;";

/**
 * SQL to create a vector column (for raw SQL migrations)
 */
export function createVectorColumnSQL(
	columnName: string,
	dimensions: number,
	options: {
		nullable?: boolean;
		default?: number[];
	} = {},
): string {
	const nullable = options.nullable ? "" : "NOT NULL";
	const defaultVal = options.default 
		? `DEFAULT '[${options.default.join(",")}]'::vector` 
		: "";
	return `${columnName} vector(${dimensions}) ${nullable} ${defaultVal}`.trim();
}
