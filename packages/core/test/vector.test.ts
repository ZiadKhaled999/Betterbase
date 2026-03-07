import { describe, expect, test, beforeAll } from "bun:test";
import {
	// Types
	type EmbeddingConfig,
	type SearchOptions,
	type VectorSearchResult,
	type SimilarityMetric,
	// Embedding utilities
	validateEmbeddingDimensions,
	normalizeVector,
	computeCosineSimilarity,
	createEmbeddingConfig,
	DEFAULT_EMBEDDING_CONFIGS,
	// Search utilities
	VECTOR_OPERATORS,
	embeddingToSql,
	validateEmbedding,
	buildVectorSearchQuery,
	createVectorIndex,
} from "../src/vector";

describe("vector/types", () => {
	test("DEFAULT_EMBEDDING_CONFIGS has correct providers", () => {
		expect(DEFAULT_EMBEDDING_CONFIGS.openai).toBeDefined();
		expect(DEFAULT_EMBEDDING_CONFIGS.cohere).toBeDefined();
		expect(DEFAULT_EMBEDDING_CONFIGS.huggingface).toBeDefined();
		expect(DEFAULT_EMBEDDING_CONFIGS.custom).toBeDefined();
	});

	test("DEFAULT_EMBEDDING_CONFIGS.openai has correct defaults", () => {
		const config = DEFAULT_EMBEDDING_CONFIGS.openai;
		expect(config.model).toBe("text-embedding-3-small");
		expect(config.dimensions).toBe(1536);
		expect(config.provider).toBe("openai");
	});
});

describe("vector/embeddings - validateEmbeddingDimensions", () => {
	test("validates correct dimensions", () => {
		const embedding = new Array(1536).fill(0).map(() => Math.random());
		expect(() => validateEmbeddingDimensions(embedding, 1536)).not.toThrow();
	});

	test("throws on dimension mismatch", () => {
		const embedding = new Array(100).fill(0).map(() => Math.random());
		expect(() => validateEmbeddingDimensions(embedding, 1536)).toThrow(
			"Embedding dimension mismatch: expected 1536, got 100",
		);
	});
});

describe("vector/embeddings - normalizeVector", () => {
	test("normalizes a vector to unit length", () => {
		const vector = [3, 4];
		const normalized = normalizeVector(vector);
		const magnitude = Math.sqrt(normalized.reduce((sum, val) => sum + val * val, 0));
		expect(magnitude).toBeCloseTo(1, 5);
	});

	test("handles zero vector", () => {
		const vector = [0, 0, 0];
		const normalized = normalizeVector(vector);
		expect(normalized).toEqual([0, 0, 0]);
	});

	test("preserves direction", () => {
		const vector = [3, 4];
		const normalized = normalizeVector(vector);
		const ratio = normalized[0] / normalized[1];
		expect(ratio).toBeCloseTo(3 / 4, 5);
	});
});

describe("vector/embeddings - computeCosineSimilarity", () => {
	test("returns 1 for identical vectors", () => {
		const vector = [1, 2, 3];
		expect(computeCosineSimilarity(vector, vector)).toBeCloseTo(1, 5);
	});

	test("returns 0 for orthogonal vectors", () => {
		const v1 = [1, 0, 0];
		const v2 = [0, 1, 0];
		expect(computeCosineSimilarity(v1, v2)).toBeCloseTo(0, 5);
	});

	test("returns -1 for opposite vectors", () => {
		const v1 = [1, 0, 0];
		const v2 = [-1, 0, 0];
		expect(computeCosineSimilarity(v1, v2)).toBeCloseTo(-1, 5);
	});

	test("throws for different dimension vectors", () => {
		const v1 = [1, 2, 3];
		const v2 = [1, 2];
		expect(() => computeCosineSimilarity(v1, v2)).toThrow(
			"Vectors must have the same dimension",
		);
	});
});

describe("vector/embeddings - createEmbeddingConfig", () => {
	test("creates config with defaults", () => {
		const config = createEmbeddingConfig({ provider: "openai" });
		expect(config.provider).toBe("openai");
		expect(config.model).toBe("text-embedding-3-small");
		expect(config.dimensions).toBe(1536);
	});

	test("overrides defaults with provided values", () => {
		const config = createEmbeddingConfig({
			provider: "openai",
			model: "text-embedding-3-large",
			dimensions: 3072,
		});
		expect(config.model).toBe("text-embedding-3-large");
		expect(config.dimensions).toBe(3072);
	});

	test("handles cohere provider", () => {
		const config = createEmbeddingConfig({ provider: "cohere" });
		expect(config.provider).toBe("cohere");
		expect(config.dimensions).toBe(1024);
	});
});

describe("vector/search - VECTOR_OPERATORS", () => {
	test("has correct cosine operator", () => {
		expect(VECTOR_OPERATORS.cosine).toBe("<=>");
	});

	test("has correct euclidean operator", () => {
		expect(VECTOR_OPERATORS.euclidean).toBe("<->");
	});

	test("has correct inner product operator", () => {
		expect(VECTOR_OPERATORS.inner_product).toBe("<#>");
	});
});

describe("vector/search - validateEmbedding", () => {
	test("validates valid embedding", () => {
		const embedding = [0.1, 0.2, 0.3, 0.4];
		expect(() => validateEmbedding(embedding)).not.toThrow();
	});

	test("throws for non-array", () => {
		expect(() => validateEmbedding("not an array" as unknown as number[])).toThrow(
			"Embedding must be an array",
		);
	});

	test("throws for empty array", () => {
		expect(() => validateEmbedding([])).toThrow("Embedding cannot be empty");
	});

	test("throws for non-numeric values", () => {
		expect(() => validateEmbedding([1, "a", 3] as unknown as number[])).toThrow(
			"Embedding must contain only valid numbers",
		);
	});

	test("throws for NaN values", () => {
		expect(() => validateEmbedding([1, NaN, 3])).toThrow(
			"Embedding must contain only valid numbers",
		);
	});

	test("throws for Infinity", () => {
		expect(() => validateEmbedding([1, Infinity, 3])).toThrow(
			"Embedding contains non-finite numbers",
		);
	});
});

describe("vector/search - embeddingToSql", () => {
	test("converts array to SQL vector literal", () => {
		const embedding = [0.1, 0.2, 0.3];
		expect(embeddingToSql(embedding)).toBe("[0.1,0.2,0.3]");
	});

	test("handles empty-ish numbers", () => {
		const embedding = [0, -1, 1.5];
		expect(embeddingToSql(embedding)).toBe("[0,-1,1.5]");
	});
});

describe("vector/search - buildVectorSearchQuery", () => {
	test("builds basic query", () => {
		const { query, params } = buildVectorSearchQuery(
			"documents",
			"embedding",
			[0.1, 0.2, 0.3],
		);
		expect(query).toContain("SELECT *");
		expect(query).toContain("documents");
		expect(query).toContain("embedding");
		expect(params[0]).toBe("[0.1,0.2,0.3]");
	});

	test("applies limit", () => {
		const { query } = buildVectorSearchQuery(
			"documents",
			"embedding",
			[0.1, 0.2],
			{ limit: 5 },
		);
		expect(query).toContain("LIMIT 5");
	});

	test("applies filter", () => {
		const { query, params } = buildVectorSearchQuery(
			"documents",
			"embedding",
			[0.1, 0.2],
			{ filter: { userId: "abc123" } },
		);
		expect(query).toContain("WHERE");
		expect(query).toContain("userId = $2");
		expect(params[1]).toBe("abc123");
	});

	test("uses correct operator for cosine", () => {
		const { query } = buildVectorSearchQuery(
			"documents",
			"embedding",
			[0.1],
			{ metric: "cosine" },
		);
		expect(query).toContain("<=>");
	});

	test("uses correct operator for euclidean", () => {
		const { query } = buildVectorSearchQuery(
			"documents",
			"embedding",
			[0.1],
			{ metric: "euclidean" },
		);
		expect(query).toContain("<->");
	});

	test("uses correct operator for inner_product", () => {
		const { query } = buildVectorSearchQuery(
			"documents",
			"embedding",
			[0.1],
			{ metric: "inner_product" },
		);
		expect(query).toContain("<#>");
	});
});

describe("vector/search - createVectorIndex", () => {
	test("creates HNSW index", () => {
		const sql = createVectorIndex("documents", "embedding", "hnsw");
		expect(sql).toContain("CREATE INDEX");
		expect(sql).toContain("USING hnsw");
		expect(sql).toContain("vector_cosine_ops");
	});

	test("creates IVFFlat index", () => {
		const sql = createVectorIndex("documents", "embedding", "ivfflat");
		expect(sql).toContain("CREATE INDEX");
		expect(sql).toContain("USING ivfflat");
		expect(sql).toContain("lists = 100");
	});

	test("uses correct ops for euclidean", () => {
		const sql = createVectorIndex("documents", "embedding", "hnsw", {
			metric: "euclidean",
		});
		expect(sql).toContain("vector_l2_ops");
	});

	test("uses correct ops for inner_product", () => {
		const sql = createVectorIndex("documents", "embedding", "hnsw", {
			metric: "inner_product",
		});
		expect(sql).toContain("vector_ip_ops");
	});

	test("respects custom connection count", () => {
		const sql = createVectorIndex("documents", "embedding", "hnsw", {
			connections: 32,
		});
		expect(sql).toContain("m = 32");
		expect(sql).toContain("ef_construction = 128");
	});
});

describe("vector - config integration", () => {
	test("BetterBaseConfigSchema accepts vector config", async () => {
		// Import here to test the full integration
		const { BetterBaseConfigSchema } = await import("../src/config/schema");
		
		const config = {
			project: { name: "test" },
			provider: {
				type: "postgres" as const,
				connectionString: "postgres://localhost/test",
			},
			vector: {
				enabled: true,
				provider: "openai",
				model: "text-embedding-3-small",
				dimensions: 1536,
			},
		};
		
		const result = BetterBaseConfigSchema.safeParse(config);
		expect(result.success).toBe(true);
	});

	test("BetterBaseConfigSchema accepts vector config with apiKey", async () => {
		const { BetterBaseConfigSchema } = await import("../src/config/schema");
		
		const config = {
			project: { name: "test" },
			provider: {
				type: "postgres" as const,
				connectionString: "postgres://localhost/test",
			},
			vector: {
				enabled: true,
				provider: "cohere",
				apiKey: "test-api-key",
			},
		};
		
		const result = BetterBaseConfigSchema.safeParse(config);
		expect(result.success).toBe(true);
	});
});
