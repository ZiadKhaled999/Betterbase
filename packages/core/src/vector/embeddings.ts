/**
 * Embedding Generation Utilities
 *
 * Provides utilities for generating text embeddings using various providers.
 * Supports OpenAI, Cohere, HuggingFace, and custom endpoints.
 */

import type {
	BatchEmbeddingResult,
	EmbeddingConfig,
	EmbeddingInput,
	EmbeddingProvider,
	EmbeddingResult,
} from "./types";

/**
 * Default embedding configurations for supported providers
 */
export const DEFAULT_EMBEDDING_CONFIGS: Record<EmbeddingProvider, Partial<EmbeddingConfig>> = {
	openai: {
		model: "text-embedding-3-small",
		dimensions: 1536,
		provider: "openai",
	},
	cohere: {
		model: "embed-english-v3.0",
		dimensions: 1024,
		provider: "cohere",
	},
	huggingface: {
		model: "sentence-transformers/all-MiniLM-L6-v2",
		dimensions: 384,
		provider: "huggingface",
	},
	custom: {
		model: "custom",
		dimensions: 384,
		provider: "custom",
	},
};

/**
 * Validates that an embedding has the expected number of dimensions
 * @param embedding - The embedding to validate
 * @param expectedDimensions - Expected number of dimensions
 * @throws Error if dimensions don't match
 */
export function validateEmbeddingDimensions(embedding: number[], expectedDimensions: number): void {
	if (embedding.length !== expectedDimensions) {
		throw new Error(
			`Embedding dimension mismatch: expected ${expectedDimensions}, got ${embedding.length}`,
		);
	}
}

/**
 * Normalizes a vector to unit length (for cosine similarity)
 * @param vector - The vector to normalize
 * @returns The normalized vector
 */
export function normalizeVector(vector: number[]): number[] {
	const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
	if (magnitude === 0) {
		return vector;
	}
	return vector.map((val) => val / magnitude);
}

/**
 * Computes cosine similarity between two vectors
 * @param a - First vector
 * @param b - Second vector
 * @returns Cosine similarity score (-1 to 1)
 */
export function computeCosineSimilarity(a: number[], b: number[]): number {
	if (a.length !== b.length) {
		throw new Error("Vectors must have the same dimension");
	}

	const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
	const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
	const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));

	if (magnitudeA === 0 || magnitudeB === 0) {
		return 0;
	}

	return dotProduct / (magnitudeA * magnitudeB);
}

/**
 * Creates an embedding configuration with defaults
 * @param config - Partial configuration
 * @returns Full embedding configuration
 */
export function createEmbeddingConfig(config: Partial<EmbeddingConfig>): EmbeddingConfig {
	const providerDefaults = DEFAULT_EMBEDDING_CONFIGS[config.provider || "openai"];
	return {
		model: config.model || providerDefaults.model || "text-embedding-3-small",
		dimensions: config.dimensions || providerDefaults.dimensions || 1536,
		provider: config.provider || "openai",
		apiKey: config.apiKey,
		endpoint: config.endpoint,
	};
}

/**
 * Abstract embedding provider class
 * Extend this to implement custom embedding providers
 */
export abstract class EmbeddingProviderBase {
	protected config: EmbeddingConfig;

	constructor(config: EmbeddingConfig) {
		this.config = createEmbeddingConfig(config);
	}

	/**
	 * Generate an embedding for a single text
	 */
	abstract generate(input: EmbeddingInput): Promise<EmbeddingResult>;

	/**
	 * Generate embeddings for multiple texts
	 */
	abstract generateBatch(inputs: EmbeddingInput[]): Promise<BatchEmbeddingResult>;

	/**
	 * Get the number of dimensions for this provider
	 */
	getDimensions(): number {
		return this.config.dimensions;
	}

	/**
	 * Get the model name for this provider
	 */
	getModel(): string {
		return this.config.model;
	}

	/**
	 * Validate input text
	 */
	protected validateInput(input: EmbeddingInput): void {
		if (!input.text || typeof input.text !== "string") {
			throw new Error("Input text is required and must be a string");
		}
		if (input.text.trim().length === 0) {
			throw new Error("Input text cannot be empty");
		}
	}
}

/**
 * OpenAI embedding provider implementation
 */
export class OpenAIEmbeddingProvider extends EmbeddingProviderBase {
	private apiKey: string;
	private endpoint: string;
	private timeout: number;

	constructor(config: EmbeddingConfig) {
		super(createEmbeddingConfig({ ...config, provider: "openai" }));
		this.apiKey = config.apiKey || process.env.OPENAI_API_KEY || "";
		this.endpoint = config.endpoint || "https://api.openai.com/v1";
		this.timeout = config.timeout || 60000; // Default 60 second timeout
	}

	async generate(input: EmbeddingInput): Promise<EmbeddingResult> {
		this.validateInput(input);

		if (!this.apiKey) {
			throw new Error("OpenAI API key is required. Set OPENAI_API_KEY environment variable.");
		}

		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), this.timeout);

		try {
			const response = await fetch(`${this.endpoint}/embeddings`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${this.apiKey}`,
				},
				body: JSON.stringify({
					input: input.text,
					model: this.config.model,
				}),
				signal: controller.signal,
			});

			clearTimeout(timeoutId);

			if (!response.ok) {
				const error = await response.text();
				throw new Error(`OpenAI API error: ${error}`);
			}

			const data = (await response.json()) as {
				data: Array<{ embedding: number[] }>;
			};

			const embedding = data.data[0]?.embedding;
			if (!embedding) {
				throw new Error("No embedding returned from OpenAI");
			}

			validateEmbeddingDimensions(embedding, this.config.dimensions);

			return {
				embedding,
				dimensions: this.config.dimensions,
				model: this.config.model,
				metadata: input.metadata,
			};
		} catch (error) {
			clearTimeout(timeoutId);
			if (error instanceof Error && error.name === "AbortError") {
				throw new Error(`Embedding request timed out after ${this.timeout}ms`);
			}
			throw error;
		}
	}

	async generateBatch(inputs: EmbeddingInput[]): Promise<BatchEmbeddingResult> {
		const embeddings: EmbeddingResult[] = [];
		const errors: Array<{ index: number; message: string }> = [];

		// Process in batches to avoid rate limits
		const batchSize = 100;
		for (let i = 0; i < inputs.length; i += batchSize) {
			const batch = inputs.slice(i, i + batchSize);

			try {
				if (!this.apiKey) {
					throw new Error("OpenAI API key is required");
				}

				const response = await fetch(`${this.endpoint}/embeddings`, {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						Authorization: `Bearer ${this.apiKey}`,
					},
					body: JSON.stringify({
						input: batch.map((b) => b.text),
						model: this.config.model,
					}),
				});

				if (!response.ok) {
					const error = await response.text();
					throw new Error(`OpenAI API error: ${error}`);
				}

				const data = (await response.json()) as {
					data: Array<{ embedding: number[] }>;
				};

				for (let j = 0; j < batch.length; j++) {
					const embedding = data.data[j]?.embedding;
					if (embedding) {
						validateEmbeddingDimensions(embedding, this.config.dimensions);
						embeddings.push({
							embedding,
							dimensions: this.config.dimensions,
							model: this.config.model,
							metadata: batch[j].metadata,
						});
					} else {
						errors.push({
							index: i + j,
							message: "No embedding returned",
						});
					}
				}
			} catch (error) {
				for (let j = 0; j < batch.length; j++) {
					errors.push({
						index: i + j,
						message: error instanceof Error ? error.message : "Unknown error",
					});
				}
			}
		}

		return {
			embeddings,
			successCount: embeddings.length,
			failureCount: errors.length,
			errors: errors.length > 0 ? errors : undefined,
		};
	}
}

/**
 * Cohere embedding provider implementation
 */
export class CohereEmbeddingProvider extends EmbeddingProviderBase {
	private apiKey: string;
	private endpoint: string;
	private timeout: number;

	constructor(config: EmbeddingConfig) {
		super(createEmbeddingConfig({ ...config, provider: "cohere" }));
		this.apiKey = config.apiKey || process.env.COHERE_API_KEY || "";
		this.endpoint = config.endpoint || "https://api.cohere.ai/v1";
		this.timeout = config.timeout || 60000; // Default 60 second timeout
	}

	async generate(input: EmbeddingInput): Promise<EmbeddingResult> {
		this.validateInput(input);

		if (!this.apiKey) {
			throw new Error("Cohere API key is required. Set COHERE_API_KEY environment variable.");
		}

		const response = await fetch(`${this.endpoint}/embed`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${this.apiKey}`,
			},
			body: JSON.stringify({
				texts: [input.text],
				model: this.config.model,
				input_type: "search_document",
			}),
		});

		if (!response.ok) {
			const error = await response.text();
			throw new Error(`Cohere API error: ${error}`);
		}

		const data = (await response.json()) as {
			embeddings: number[][];
		};

		const embedding = data.embeddings?.[0];
		if (!embedding) {
			throw new Error("No embedding returned from Cohere");
		}

		validateEmbeddingDimensions(embedding, this.config.dimensions);

		return {
			embedding,
			dimensions: this.config.dimensions,
			model: this.config.model,
			metadata: input.metadata,
		};
	}

	async generateBatch(inputs: EmbeddingInput[]): Promise<BatchEmbeddingResult> {
		const embeddings: EmbeddingResult[] = [];
		const errors: Array<{ index: number; message: string }> = [];

		// Cohere API limit is 96 texts per request
		const CHUNK_SIZE = 96;

		try {
			if (!this.apiKey) {
				throw new Error("Cohere API key is required");
			}

			// Split inputs into chunks of at most 96
			for (let chunkStart = 0; chunkStart < inputs.length; chunkStart += CHUNK_SIZE) {
				const chunkEnd = Math.min(chunkStart + CHUNK_SIZE, inputs.length);
				const chunkInputs = inputs.slice(chunkStart, chunkEnd);

				const controller = new AbortController();
				const timeoutId = setTimeout(() => controller.abort(), this.timeout);

				try {
					const response = await fetch(`${this.endpoint}/embed`, {
						method: "POST",
						headers: {
							"Content-Type": "application/json",
							Authorization: `Bearer ${this.apiKey}`,
						},
						body: JSON.stringify({
							texts: chunkInputs.map((i) => i.text),
							model: this.config.model,
							input_type: "search_document",
						}),
						signal: controller.signal,
					});

					clearTimeout(timeoutId);

					if (!response.ok) {
						const error = await response.text();
						// Add errors for all items in this chunk
						for (let i = chunkStart; i < chunkEnd; i++) {
							errors.push({
								index: i,
								message: `Cohere API error: ${error}`,
							});
						}
						continue;
					}

					const data = (await response.json()) as {
						embeddings: number[][];
					};

					for (let i = 0; i < chunkInputs.length; i++) {
						const originalIndex = chunkStart + i;
						const embedding = data.embeddings?.[i];
						if (embedding) {
							validateEmbeddingDimensions(embedding, this.config.dimensions);
							embeddings.push({
								embedding,
								dimensions: this.config.dimensions,
								model: this.config.model,
								metadata: chunkInputs[i].metadata,
							});
						} else {
							errors.push({
								index: originalIndex,
								message: "No embedding returned",
							});
						}
					}
				} catch (chunkError) {
					clearTimeout(timeoutId);
					if (chunkError instanceof Error && chunkError.name === "AbortError") {
						for (let i = chunkStart; i < chunkEnd; i++) {
							errors.push({
								index: i,
								message: `Embedding request timed out after ${this.timeout}ms`,
							});
						}
					} else {
						for (let i = chunkStart; i < chunkEnd; i++) {
							errors.push({
								index: i,
								message: chunkError instanceof Error ? chunkError.message : "Unknown error",
							});
						}
					}
				}
			}
		} catch (err) {
			for (let i = 0; i < inputs.length; i++) {
				if (!errors.find((e) => e.index === i)) {
					errors.push({
						index: i,
						message: err instanceof Error ? err.message : "Unknown error",
					});
				}
			}
		}

		return {
			embeddings,
			successCount: embeddings.length,
			failureCount: errors.length,
			errors: errors.length > 0 ? errors : undefined,
		};
	}
}

/**
 * Factory function to create an embedding provider
 * @param config - Configuration for the embedding provider
 * @returns An instance of the appropriate embedding provider
 */
export function createEmbeddingProvider(config: EmbeddingConfig): EmbeddingProviderBase {
	switch (config.provider) {
		case "openai":
			return new OpenAIEmbeddingProvider(config);
		case "cohere":
			return new CohereEmbeddingProvider(config);
		case "huggingface":
		case "custom":
			// For custom/huggingface, users should extend EmbeddingProviderBase
			throw new Error(
				`Provider '${config.provider}' requires a custom implementation. Extend EmbeddingProviderBase to implement custom providers.`,
			);
		default:
			throw new Error(`Unknown embedding provider: ${(config as { provider?: string }).provider}`);
	}
}

/**
 * Simple text-to-embedding function using the configured provider
 * @param text - Text to generate embedding for
 * @param config - Embedding configuration
 * @returns Generated embedding result
 */
export async function generateEmbedding(
	text: string,
	config: Partial<EmbeddingConfig>,
): Promise<EmbeddingResult> {
	const provider = createEmbeddingProvider(createEmbeddingConfig(config));
	return provider.generate({ text });
}

/**
 * Batch text-to-embedding function using the configured provider
 * @param texts - Array of texts to generate embeddings for
 * @param config - Embedding configuration
 * @returns Batch embedding result
 */
export async function generateEmbeddings(
	texts: string[],
	config: Partial<EmbeddingConfig>,
): Promise<BatchEmbeddingResult> {
	const provider = createEmbeddingProvider(createEmbeddingConfig(config));
	const inputs = texts.map((text) => ({ text }));
	return provider.generateBatch(inputs);
}
