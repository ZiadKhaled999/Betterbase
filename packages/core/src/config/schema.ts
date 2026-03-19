import { z } from "zod";
import type { StoragePolicy } from "../storage/types";
import type { VectorConfig } from "../vector/types";

/**
 * Supported database provider types in BetterBase
 */
export const ProviderTypeSchema = z.enum([
	"neon",
	"turso",
	"planetscale",
	"supabase",
	"postgres",
	"managed",
]);

/**
 * TypeScript type inferred from the ProviderTypeSchema
 */
export type ProviderType = z.infer<typeof ProviderTypeSchema>;

/**
 * Zod schema for validating BetterBase configuration
 * Defines the structure and validation rules for all config options
 */
export const BetterBaseConfigSchema = z
	.object({
		project: z.object({
			name: z.string().min(1, "Project name is required"),
		}),
		provider: z.object({
			type: ProviderTypeSchema,
			connectionString: z.string().optional(),
			url: z.string().optional(), // Turso - libSQL connection URL
			authToken: z.string().optional(), // Turso - auth token for managed DB
		}),
		storage: z
			.object({
				provider: z.enum(["s3", "r2", "backblaze", "minio", "managed"]),
				bucket: z.string(),
				region: z.string().optional(),
				endpoint: z.string().optional(),
				policies: z
					.array(
						z.object({
							bucket: z.string(),
							operation: z.enum(["upload", "download", "list", "delete", "*"]),
							expression: z.string(),
						}),
					)
					.default([]) as z.ZodType<StoragePolicy[]>,
			})
			.optional(),
		webhooks: z
			.array(
				z.object({
					id: z.string(),
					table: z.string(),
					events: z.array(z.enum(["INSERT", "UPDATE", "DELETE"])),
					url: z.string().refine((val) => val.startsWith("process.env."), {
						message:
							"URL must be an environment variable reference (e.g., process.env.WEBHOOK_URL)",
					}),
					secret: z.string().refine((val) => val.startsWith("process.env."), {
						message:
							"Secret must be an environment variable reference (e.g., process.env.WEBHOOK_SECRET)",
					}),
					enabled: z.boolean().default(true),
				}),
			)
			.optional(),
		graphql: z
			.object({
				enabled: z.boolean().default(true),
			})
			.optional(),
		vector: z
			.object({
				enabled: z.boolean().default(false),
				provider: z.enum(["openai", "cohere", "huggingface", "custom"]).default("openai"),
				apiKey: z.string().optional(),
				model: z.string().optional(),
				dimensions: z.number().int().min(1).optional(),
				endpoint: z.string().optional(),
			})
			.optional(),
		autoRest: z
			.object({
				enabled: z.boolean().default(true),
				excludeTables: z.array(z.string()).default([]),
			})
			.optional(),
		branching: z
			.object({
				enabled: z.boolean().default(true),
				maxPreviews: z.number().int().min(1).max(50).default(10),
				defaultSleepTimeout: z.number().int().min(60).default(3600),
				storageEnabled: z.boolean().default(true),
			})
			.optional(),
	})
	.superRefine(
		(
			data: {
				provider: {
					type: ProviderType;
					connectionString?: string;
					url?: string;
					authToken?: string;
				};
			},
			ctx,
		) => {
			const { provider } = data;

			// Turso-specific validation: require both url and authToken
			if (provider.type === "turso") {
				if (!provider.url || provider.url.trim() === "") {
					ctx.addIssue({
						code: z.ZodIssueCode.custom,
						message: 'Turso provider requires "url" to be present and non-empty',
						path: ["provider", "url"],
					});
				}
				if (!provider.authToken || provider.authToken.trim() === "") {
					ctx.addIssue({
						code: z.ZodIssueCode.custom,
						message: 'Turso provider requires "authToken" to be present and non-empty',
						path: ["provider", "authToken"],
					});
				}
			} else if (provider.type !== "managed") {
				// Other providers require connectionString (except managed which has no DB)
				if (!provider.connectionString || provider.connectionString.trim() === "") {
					ctx.addIssue({
						code: z.ZodIssueCode.custom,
						message: `Provider type "${provider.type}" requires "connectionString" to be present and non-empty`,
						path: ["provider", "connectionString"],
					});
				}
			}
		},
	);

/**
 * TypeScript type inferred from the BetterBaseConfigSchema
 * Represents the validated configuration structure
 */
export type BetterBaseConfig = z.infer<typeof BetterBaseConfigSchema>;

/**
 * Creates a validated BetterBaseConfig from input data
 * @param config - The configuration object to validate
 * @returns The validated configuration
 * @throws ZodError if validation fails
 */
export function defineConfig(config: z.input<typeof BetterBaseConfigSchema>): BetterBaseConfig {
	return BetterBaseConfigSchema.parse(config);
}

/**
 * Validates a configuration object and returns a boolean result
 * @param config - The configuration to validate
 * @returns true if the configuration is valid, false otherwise
 */
export function validateConfig(config: unknown): boolean {
	return BetterBaseConfigSchema.safeParse(config).success;
}

/**
 * Safely parses a configuration object
 * @param config - The configuration to parse
 * @returns Result containing either the validated config or error
 */
export function parseConfig(config: unknown): z.SafeParseReturnType<unknown, BetterBaseConfig> {
	return BetterBaseConfigSchema.safeParse(config);
}

/**
 * Validates the configuration and throws a descriptive error if invalid
 * @param config - The configuration to validate
 * @throws ZodError with detailed error messages if validation fails
 */
export function assertConfig(config: unknown): asserts config is BetterBaseConfig {
	const result = BetterBaseConfigSchema.safeParse(config);
	if (!result.success) {
		const errors = result.error.issues.map((e) => `${e.path.join(".")}: ${e.message}`).join("; ");
		throw new Error(`Invalid BetterBase configuration: ${errors}`);
	}
}
