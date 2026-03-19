import { describe, expect, test } from "bun:test";
import {
	type BetterBaseConfig,
	BetterBaseConfigSchema,
	ProviderTypeSchema,
	assertConfig,
	defineConfig,
	parseConfig,
	validateConfig,
} from "../src/config/schema";

describe("config/schema", () => {
	describe("ProviderTypeSchema", () => {
		test("accepts valid provider types", () => {
			expect(ProviderTypeSchema.safeParse("neon").success).toBe(true);
			expect(ProviderTypeSchema.safeParse("turso").success).toBe(true);
			expect(ProviderTypeSchema.safeParse("planetscale").success).toBe(true);
			expect(ProviderTypeSchema.safeParse("supabase").success).toBe(true);
			expect(ProviderTypeSchema.safeParse("postgres").success).toBe(true);
			expect(ProviderTypeSchema.safeParse("managed").success).toBe(true);
		});

		test("rejects invalid provider types", () => {
			expect(ProviderTypeSchema.safeParse("invalid").success).toBe(false);
			expect(ProviderTypeSchema.safeParse("").success).toBe(false);
		});
	});

	describe("BetterBaseConfigSchema", () => {
		test("validates a complete valid config", () => {
			const config = {
				project: { name: "my-project" },
				provider: {
					type: "neon" as const,
					connectionString: "postgres://user:pass@host/db",
				},
			};
			const result = BetterBaseConfigSchema.safeParse(config);
			expect(result.success).toBe(true);
		});

		test("validates config with optional storage", () => {
			const config = {
				project: { name: "my-project" },
				provider: {
					type: "neon" as const,
					connectionString: "postgres://user:pass@host/db",
				},
				storage: {
					provider: "s3" as const,
					bucket: "my-bucket",
					region: "us-east-1",
				},
			};
			const result = BetterBaseConfigSchema.safeParse(config);
			expect(result.success).toBe(true);
		});

		test("validates config with webhooks", () => {
			const config = {
				project: { name: "my-project" },
				provider: {
					type: "neon" as const,
					connectionString: "postgres://user:pass@host/db",
				},
				webhooks: [
					{
						id: "webhook-1",
						table: "users",
						events: ["INSERT", "UPDATE"] as const,
						url: "process.env.WEBHOOK_URL",
						secret: "process.env.WEBHOOK_SECRET",
					},
				],
			};
			const result = BetterBaseConfigSchema.safeParse(config);
			expect(result.success).toBe(true);
		});

		test("rejects config without project name", () => {
			const config = {
				project: {},
				provider: {
					type: "neon" as const,
					connectionString: "postgres://user:pass@host/db",
				},
			};
			const result = BetterBaseConfigSchema.safeParse(config);
			expect(result.success).toBe(false);
		});

		test("rejects config with invalid mode", () => {
			const config = {
				project: { name: "my-project" },
				provider: {
					type: "invalid-provider",
					connectionString: "postgres://user:pass@host/db",
				},
			};
			const result = BetterBaseConfigSchema.safeParse(config);
			expect(result.success).toBe(false);
		});

		test("rejects config without connectionString for non-managed providers", () => {
			const config = {
				project: { name: "my-project" },
				provider: {
					type: "neon" as const,
				},
			};
			const result = BetterBaseConfigSchema.safeParse(config);
			expect(result.success).toBe(false);
		});

		test("validates turso provider with url and authToken", () => {
			const config = {
				project: { name: "my-project" },
				provider: {
					type: "turso" as const,
					url: "libsql://my-db.turso.io",
					authToken: "my-auth-token",
				},
			};
			const result = BetterBaseConfigSchema.safeParse(config);
			expect(result.success).toBe(true);
		});

		test("rejects turso provider without url", () => {
			const config = {
				project: { name: "my-project" },
				provider: {
					type: "turso" as const,
					authToken: "my-auth-token",
				},
			};
			const result = BetterBaseConfigSchema.safeParse(config);
			expect(result.success).toBe(false);
		});

		test("validates managed provider without connectionString", () => {
			const config = {
				project: { name: "my-project" },
				provider: {
					type: "managed" as const,
				},
			};
			const result = BetterBaseConfigSchema.safeParse(config);
			expect(result.success).toBe(true);
		});
	});

	describe("defineConfig", () => {
		test("returns validated config", () => {
			const config: BetterBaseConfig = {
				project: { name: "my-project" },
				provider: {
					type: "neon",
					connectionString: "postgres://user:pass@host/db",
				},
			};
			const result = defineConfig(config);
			expect(result.project.name).toBe("my-project");
		});
	});

	describe("validateConfig", () => {
		test("returns true for valid config", () => {
			const config = {
				project: { name: "my-project" },
				provider: {
					type: "neon" as const,
					connectionString: "postgres://user:pass@host/db",
				},
			};
			expect(validateConfig(config)).toBe(true);
		});

		test("returns false for invalid config", () => {
			const config = {
				project: {},
				provider: {
					type: "neon" as const,
				},
			};
			expect(validateConfig(config)).toBe(false);
		});
	});

	describe("parseConfig", () => {
		test("returns success result for valid config", () => {
			const config = {
				project: { name: "my-project" },
				provider: {
					type: "neon" as const,
					connectionString: "postgres://user:pass@host/db",
				},
			};
			const result = parseConfig(config);
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data.project.name).toBe("my-project");
			}
		});

		test("returns error result for invalid config", () => {
			const config = {
				project: {},
				provider: {
					type: "neon" as const,
				},
			};
			const result = parseConfig(config);
			expect(result.success).toBe(false);
		});
	});

	describe("assertConfig", () => {
		test("does not throw for valid config", () => {
			const config = {
				project: { name: "my-project" },
				provider: {
					type: "neon" as const,
					connectionString: "postgres://user:pass@host/db",
				},
			};
			expect(() => assertConfig(config)).not.toThrow();
		});

		test("throws for invalid config", () => {
			const config = {
				project: {},
				provider: {
					type: "neon" as const,
				},
			};
			expect(() => assertConfig(config)).toThrow();
		});
	});
});
