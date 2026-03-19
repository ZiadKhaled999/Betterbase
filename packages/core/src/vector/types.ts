/**
 * Vector Search Type Definitions
 *
 * Provides type definitions for pgvector support in BetterBase.
 * These types enable vector similarity search with PostgreSQL.
 */

/**
 * Supported embedding providers
 */
export type EmbeddingProvider = "openai" | "cohere" | "huggingface" | "custom";

/**
 * Supported similarity metrics for vector search
 */
export type SimilarityMetric = "cosine" | "euclidean" | "inner_product";

/**
 * Configuration for embedding generation
 */
export interface EmbeddingConfig {
	/** The embedding model to use */
	model: string;
	/** The number of dimensions the model outputs */
	dimensions: number;
	/** The provider for generating embeddings */
	provider: EmbeddingProvider;
	/** API key for the embedding provider (can be environment variable reference) */
	apiKey?: string;
	/** Custom endpoint URL (for self-hosted models) */
	endpoint?: string;
	/** Timeout for embedding requests in milliseconds */
	timeout?: number;
}

/**
 * Input for generating an embedding
 */
export interface EmbeddingInput {
	/** Text content to generate embedding for */
	text: string;
	/** Optional metadata to store with the embedding */
	metadata?: Record<string, unknown>;
}

/**
 * Generated embedding result
 */
export interface EmbeddingResult {
	/** The embedding vector as an array of numbers */
	embedding: number[];
	/** The number of dimensions */
	dimensions: number;
	/** The model used to generate the embedding */
	model: string;
	/** Optional metadata */
	metadata?: Record<string, unknown>;
}

/**
 * Options for vector similarity search
 */
export interface SearchOptions {
	/** Maximum number of results to return */
	limit?: number;
	/** Minimum similarity threshold (0-1 for cosine, varies for others) */
	threshold?: number;
	/** The similarity metric to use */
	metric?: SimilarityMetric;
	/** Filter conditions to apply before vector search */
	filter?: Record<string, unknown>;
	/** Include similarity score in results */
	includeScore?: boolean;
}

/**
 * Result from a vector similarity search
 */
export interface VectorSearchResult<T = Record<string, unknown>> {
	/** The matching record */
	item: T;
	/** The similarity/distance score */
	score: number;
}

/**
 * Type for a vector column in Drizzle schema
 * This is used to define vector columns in the database schema
 */
export interface VectorColumnConfig {
	/** The name of the column */
	name: string;
	/** The number of dimensions for the vector */
	dimensions: number;
	/** Whether the column is nullable */
	nullable?: boolean;
	/** Default value for the column */
	default?: number[];
}

/**
 * Type for vector column in Drizzle ORM
 * Represents a pgvector column in the schema
 * Note: Use Drizzle's built-in `vector()` function from drizzle-orm/pg-core to create vector columns
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type VectorColumn = any;

/**
 * Configuration for vector search in BetterBase
 */
export interface VectorConfig {
	/** Whether vector search is enabled */
	enabled: boolean;
	/** The embedding provider to use */
	provider: EmbeddingProvider;
	/** API key for the embedding provider */
	apiKey?: string;
	/** Default embedding model */
	model?: string;
	/** Default number of dimensions */
	dimensions?: number;
	/** Custom embedding endpoint */
	endpoint?: string;
}

/**
 * Batch embedding generation result
 */
export interface BatchEmbeddingResult {
	/** Array of embedding results */
	embeddings: EmbeddingResult[];
	/** Number of successful embeddings */
	successCount: number;
	/** Number of failed embeddings */
	failureCount: number;
	/** Errors for failed embeddings */
	errors?: Array<{
		index: number;
		message: string;
	}>;
}

/**
 * Vector index configuration for optimizing search
 */
export interface VectorIndexConfig {
	/** Type of index (ivfflat, hnsw) */
	indexType: "ivfflat" | "hnsw";
	/** Number of lists for ivfflat (optional for hnsw) */
	lists?: number;
	/** Number of connections for hnsw */
	connections?: number;
	/** Whether to rebuild the index after data changes */
	maintain?: boolean;
}

/**
 * Vector search query builder result
 */
export interface VectorQueryResult<T = Record<string, unknown>> {
	/** SQL query string */
	query: string;
	/** Query parameters */
	params: unknown[];
	/** Results from executing the query */
	results: VectorSearchResult<T>[];
}
