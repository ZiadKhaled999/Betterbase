import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from "bun:test"
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from "node:fs"
import { existsSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import {
	ProviderConfigSchema,
	NeonProviderConfigSchema,
	TursoProviderConfigSchema,
	PlanetScaleProviderConfigSchema,
	SupabaseProviderConfigSchema,
	PostgresProviderConfigSchema,
	ManagedProviderConfigSchema,
	isValidProviderConfig,
	parseProviderConfig,
	safeParseProviderConfig,
	type ProviderConfig,
	type ProviderAdapter,
} from "../src/providers/index"
import {
	resolveProvider,
	resolveProviderByType,
	getSupportedProviders,
	providerSupportsRLS,
	getProviderDialect,
	ManagedProviderNotSupportedError,
	NeonProviderAdapter,
	PostgresProviderAdapter,
	SupabaseProviderAdapter,
	TursoProviderAdapter,
	PlanetScaleProviderAdapter,
} from "../src/providers/index"

let tmpDir: string

beforeAll(() => {
	tmpDir = mkdtempSync(path.join(os.tmpdir(), "betterbase-test-"))
})

afterAll(() => {
	rmSync(tmpDir, { recursive: true, force: true })
})

describe("providers/types", () => {
	describe("ProviderConfigSchema", () => {
		it("validates a valid Neon provider config", () => {
			const config = {
				type: "neon" as const,
				connectionString: "postgres://user:pass@host/db",
			}
			const result = ProviderConfigSchema.safeParse(config)
			expect(result.success).toBe(true)
		})

		it("validates a valid Turso provider config", () => {
			const config = {
				type: "turso" as const,
				url: "libsql://my-db.turso.io",
				authToken: "my-auth-token",
			}
			const result = ProviderConfigSchema.safeParse(config)
			expect(result.success).toBe(true)
		})

		it("validates a valid PlanetScale provider config", () => {
			const config = {
				type: "planetscale" as const,
				connectionString: "mysql://user:pass@host/db",
			}
			const result = ProviderConfigSchema.safeParse(config)
			expect(result.success).toBe(true)
		})

		it("validates a valid Supabase provider config", () => {
			const config = {
				type: "supabase" as const,
				connectionString: "postgres://user:pass@host/db",
			}
			const result = ProviderConfigSchema.safeParse(config)
			expect(result.success).toBe(true)
		})

		it("validates a valid Postgres provider config", () => {
			const config = {
				type: "postgres" as const,
				connectionString: "postgres://user:pass@host/db",
			}
			const result = ProviderConfigSchema.safeParse(config)
			expect(result.success).toBe(true)
		})

		it("validates a managed provider config (no required fields)", () => {
			const config = {
				type: "managed" as const,
			}
			const result = ProviderConfigSchema.safeParse(config)
			expect(result.success).toBe(true)
		})

		it("rejects invalid provider type", () => {
			const config = {
				type: "invalid",
				connectionString: "postgres://user:pass@host/db",
			}
			const result = ProviderConfigSchema.safeParse(config)
			expect(result.success).toBe(false)
		})

		it("rejects Neon config without connectionString", () => {
			const config = {
				type: "neon" as const,
			}
			const result = ProviderConfigSchema.safeParse(config)
			expect(result.success).toBe(false)
		})

		it("rejects Turso config without url", () => {
			const config = {
				type: "turso" as const,
				authToken: "my-auth-token",
			}
			const result = ProviderConfigSchema.safeParse(config)
			expect(result.success).toBe(false)
		})

		it("rejects Turso config without authToken", () => {
			const config = {
				type: "turso" as const,
				url: "libsql://my-db.turso.io",
			}
			const result = ProviderConfigSchema.safeParse(config)
			expect(result.success).toBe(false)
		})
	})

	describe("NeonProviderConfigSchema", () => {
		it("validates valid Neon config", () => {
			const config = {
				type: "neon",
				connectionString: "postgres://user:pass@host/db",
			}
			const result = NeonProviderConfigSchema.safeParse(config)
			expect(result.success).toBe(true)
		})

		it("rejects wrong type", () => {
			const config = {
				type: "postgres",
				connectionString: "postgres://user:pass@host/db",
			}
			const result = NeonProviderConfigSchema.safeParse(config)
			expect(result.success).toBe(false)
		})
	})

	describe("TursoProviderConfigSchema", () => {
		it("validates valid Turso config", () => {
			const config = {
				type: "turso",
				url: "libsql://my-db.turso.io",
				authToken: "my-auth-token",
			}
			const result = TursoProviderConfigSchema.safeParse(config)
			expect(result.success).toBe(true)
		})
	})

	describe("PlanetScaleProviderConfigSchema", () => {
		it("validates valid PlanetScale config", () => {
			const config = {
				type: "planetscale",
				connectionString: "mysql://user:pass@host/db",
			}
			const result = PlanetScaleProviderConfigSchema.safeParse(config)
			expect(result.success).toBe(true)
		})
	})

	describe("SupabaseProviderConfigSchema", () => {
		it("validates valid Supabase config", () => {
			const config = {
				type: "supabase",
				connectionString: "postgres://user:pass@host/db",
			}
			const result = SupabaseProviderConfigSchema.safeParse(config)
			expect(result.success).toBe(true)
		})
	})

	describe("PostgresProviderConfigSchema", () => {
		it("validates valid Postgres config", () => {
			const config = {
				type: "postgres",
				connectionString: "postgres://user:pass@host/db",
			}
			const result = PostgresProviderConfigSchema.safeParse(config)
			expect(result.success).toBe(true)
		})
	})

	describe("ManagedProviderConfigSchema", () => {
		it("validates managed config with just type", () => {
			const config = {
				type: "managed",
			}
			const result = ManagedProviderConfigSchema.safeParse(config)
			expect(result.success).toBe(true)
		})
	})

	describe("isValidProviderConfig", () => {
		it("returns true for valid config", () => {
			const config = {
				type: "neon",
				connectionString: "postgres://user:pass@host/db",
			}
			expect(isValidProviderConfig(config)).toBe(true)
		})

		it("returns false for invalid config", () => {
			const config = {
				type: "invalid",
			}
			expect(isValidProviderConfig(config)).toBe(false)
		})
	})

	describe("parseProviderConfig", () => {
		it("parses valid config", () => {
			const config = {
				type: "neon",
				connectionString: "postgres://user:pass@host/db",
			}
			const result = parseProviderConfig(config)
			expect(result.type).toBe("neon")
			expect(result.connectionString).toBe("postgres://user:pass@host/db")
		})

		it("throws on invalid config", () => {
			const config = {
				type: "invalid",
			}
			expect(() => parseProviderConfig(config)).toThrow()
		})
	})

	describe("safeParseProviderConfig", () => {
		it("returns success for valid config", () => {
			const config = {
				type: "neon",
				connectionString: "postgres://user:pass@host/db",
			}
			const result = safeParseProviderConfig(config)
			expect(result.success).toBe(true)
		})

		it("returns error for invalid config", () => {
			const config = {
				type: "invalid",
			}
			const result = safeParseProviderConfig(config)
			expect(result.success).toBe(false)
		})
	})
})

describe("providers/index", () => {
	describe("getSupportedProviders", () => {
		it("returns all supported providers except managed", () => {
			const providers = getSupportedProviders()
			expect(providers).toContain("neon")
			expect(providers).toContain("turso")
			expect(providers).toContain("planetscale")
			expect(providers).toContain("supabase")
			expect(providers).toContain("postgres")
			expect(providers).not.toContain("managed")
			expect(providers.length).toBe(5)
		})
	})

	describe("providerSupportsRLS", () => {
		it("returns true for PostgreSQL-based providers", () => {
			expect(providerSupportsRLS("neon")).toBe(true)
			expect(providerSupportsRLS("supabase")).toBe(true)
			expect(providerSupportsRLS("postgres")).toBe(true)
		})

		it("returns false for SQLite and MySQL providers", () => {
			expect(providerSupportsRLS("turso")).toBe(false)
			expect(providerSupportsRLS("planetscale")).toBe(false)
		})

		it("returns true for managed provider", () => {
			expect(providerSupportsRLS("managed")).toBe(true)
		})
	})

	describe("getProviderDialect", () => {
		it("returns postgres for PostgreSQL-based providers", () => {
			expect(getProviderDialect("neon")).toBe("postgres")
			expect(getProviderDialect("supabase")).toBe("postgres")
			expect(getProviderDialect("postgres")).toBe("postgres")
		})

		it("returns mysql for PlanetScale", () => {
			expect(getProviderDialect("planetscale")).toBe("mysql")
		})

		it("returns sqlite for Turso", () => {
			expect(getProviderDialect("turso")).toBe("sqlite")
		})

		it("throws for managed provider", () => {
			expect(() => getProviderDialect("managed")).toThrow()
		})
	})

	describe("resolveProvider", () => {
		it("resolves Neon provider config", () => {
			const config: ProviderConfig = {
				type: "neon",
				connectionString: "postgres://user:pass@host/db",
			}
			const adapter = resolveProvider(config)
			expect(adapter).toBeInstanceOf(NeonProviderAdapter)
			expect(adapter.type).toBe("neon")
			expect(adapter.dialect).toBe("postgres")
		})

		it("resolves Postgres provider config", () => {
			const config: ProviderConfig = {
				type: "postgres",
				connectionString: "postgres://user:pass@host/db",
			}
			const adapter = resolveProvider(config)
			expect(adapter).toBeInstanceOf(PostgresProviderAdapter)
			expect(adapter.type).toBe("postgres")
		})

		it("resolves Supabase provider config", () => {
			const config: ProviderConfig = {
				type: "supabase",
				connectionString: "postgres://user:pass@host/db",
			}
			const adapter = resolveProvider(config)
			expect(adapter).toBeInstanceOf(SupabaseProviderAdapter)
			expect(adapter.type).toBe("supabase")
		})

		it("resolves Turso provider config", () => {
			const config: ProviderConfig = {
				type: "turso",
				url: "libsql://my-db.turso.io",
				authToken: "my-auth-token",
			}
			const adapter = resolveProvider(config)
			expect(adapter).toBeInstanceOf(TursoProviderAdapter)
			expect(adapter.type).toBe("turso")
			expect(adapter.dialect).toBe("sqlite")
		})

		it("resolves PlanetScale provider config", () => {
			const config: ProviderConfig = {
				type: "planetscale",
				connectionString: "mysql://user:pass@host/db",
			}
			const adapter = resolveProvider(config)
			expect(adapter).toBeInstanceOf(PlanetScaleProviderAdapter)
			expect(adapter.type).toBe("planetscale")
			expect(adapter.dialect).toBe("mysql")
		})

		it("throws for managed provider", () => {
			const config: ProviderConfig = {
				type: "managed",
			}
			expect(() => resolveProvider(config)).toThrow(ManagedProviderNotSupportedError)
		})
	})

	describe("resolveProviderByType", () => {
		it("resolves Neon by type string", () => {
			const adapter = resolveProviderByType("neon")
			expect(adapter).toBeInstanceOf(NeonProviderAdapter)
		})

		it("resolves Postgres by type string", () => {
			const adapter = resolveProviderByType("postgres")
			expect(adapter).toBeInstanceOf(PostgresProviderAdapter)
		})

		it("resolves Supabase by type string", () => {
			const adapter = resolveProviderByType("supabase")
			expect(adapter).toBeInstanceOf(SupabaseProviderAdapter)
		})

		it("resolves Turso by type string", () => {
			const adapter = resolveProviderByType("turso")
			expect(adapter).toBeInstanceOf(TursoProviderAdapter)
		})

		it("resolves PlanetScale by type string", () => {
			const adapter = resolveProviderByType("planetscale")
			expect(adapter).toBeInstanceOf(PlanetScaleProviderAdapter)
		})

		it("throws for managed provider", () => {
			expect(() => resolveProviderByType("managed")).toThrow(ManagedProviderNotSupportedError)
		})
	})

	describe("ManagedProviderNotSupportedError", () => {
		it("has correct message", () => {
			const error = new ManagedProviderNotSupportedError()
			expect(error.name).toBe("ManagedProviderNotSupportedError")
			expect(error.message).toContain("managed")
			expect(error.message).toContain("neon")
			expect(error.message).toContain("turso")
		})
	})
})

describe("NeonProviderAdapter", () => {
	describe("constructor", () => {
		it("creates adapter with correct type and dialect", () => {
			const adapter = new NeonProviderAdapter()
			expect(adapter.type).toBe("neon")
			expect(adapter.dialect).toBe("postgres")
		})
	})

	describe("connect", () => {
		it("validates config type", async () => {
			const adapter = new NeonProviderAdapter()
			const config = {
				type: "postgres" as const,
				connectionString: "postgres://user:pass@host/db",
			}
			await expect(adapter.connect(config)).rejects.toThrow("Invalid configuration")
		})

		it("creates connection on valid config", async () => {
			const adapter = new NeonProviderAdapter()
			const config = {
				type: "neon" as const,
				connectionString: "postgres://user:pass@host/db",
			}
			const connection = await adapter.connect(config)
			expect(connection.provider).toBe("neon")
			expect(connection.isConnected()).toBe(true)
			await connection.close()
		})
	})

	describe("supportsRLS", () => {
		it("returns true", () => {
			const adapter = new NeonProviderAdapter()
			expect(adapter.supportsRLS()).toBe(true)
		})
	})

	describe("supportsGraphQL", () => {
		it("returns true", () => {
			const adapter = new NeonProviderAdapter()
			expect(adapter.supportsGraphQL()).toBe(true)
		})
	})

	describe("getMigrationsDriver", () => {
		it("throws if not connected first", () => {
			const adapter = new NeonProviderAdapter()
			expect(() => adapter.getMigrationsDriver()).toThrow("Migration driver not initialized")
		})

		it("returns driver after connection", async () => {
			const adapter = new NeonProviderAdapter()
			const config = {
				type: "neon" as const,
				connectionString: "postgres://user:pass@host/db",
			}
			await adapter.connect(config)
			const driver = adapter.getMigrationsDriver()
			expect(driver).toBeDefined()
		})
	})
})

describe("PostgresProviderAdapter", () => {
	describe("constructor", () => {
		it("creates adapter with correct type and dialect", () => {
			const adapter = new PostgresProviderAdapter()
			expect(adapter.type).toBe("postgres")
			expect(adapter.dialect).toBe("postgres")
		})
	})

	describe("connect", () => {
		it("validates config type", async () => {
			const adapter = new PostgresProviderAdapter()
			const config = {
				type: "neon" as const,
				connectionString: "postgres://user:pass@host/db",
			}
			await expect(adapter.connect(config)).rejects.toThrow("Invalid configuration")
		})
	})

	describe("supportsRLS", () => {
		it("returns true", () => {
			const adapter = new PostgresProviderAdapter()
			expect(adapter.supportsRLS()).toBe(true)
		})
	})
})

describe("SupabaseProviderAdapter", () => {
	describe("constructor", () => {
		it("creates adapter with correct type and dialect", () => {
			const adapter = new SupabaseProviderAdapter()
			expect(adapter.type).toBe("supabase")
			expect(adapter.dialect).toBe("postgres")
		})
	})

	describe("connect", () => {
		it("validates config type", async () => {
			const adapter = new SupabaseProviderAdapter()
			const config = {
				type: "postgres" as const,
				connectionString: "postgres://user:pass@host/db",
			}
			await expect(adapter.connect(config)).rejects.toThrow("Invalid configuration")
		})
	})

	describe("supportsRLS", () => {
		it("returns true", () => {
			const adapter = new SupabaseProviderAdapter()
			expect(adapter.supportsRLS()).toBe(true)
		})
	})
})

describe("TursoProviderAdapter", () => {
	describe("constructor", () => {
		it("creates adapter with correct type and dialect", () => {
			const adapter = new TursoProviderAdapter()
			expect(adapter.type).toBe("turso")
			expect(adapter.dialect).toBe("sqlite")
		})
	})

	describe("connect", () => {
		it("validates config type", async () => {
			const adapter = new TursoProviderAdapter()
			const config = {
				type: "neon" as const,
				connectionString: "postgres://user:pass@host/db",
			}
			await expect(adapter.connect(config)).rejects.toThrow("Invalid configuration")
		})

		it("validates url is provided", async () => {
			const adapter = new TursoProviderAdapter()
			const config = {
				type: "turso" as const,
				url: "",
				authToken: "my-auth-token",
			}
			await expect(adapter.connect(config)).rejects.toThrow("url")
		})

		it("validates authToken is provided", async () => {
			const adapter = new TursoProviderAdapter()
			const config = {
				type: "turso" as const,
				url: "libsql://my-db.turso.io",
				authToken: "",
			}
			await expect(adapter.connect(config)).rejects.toThrow("authToken")
		})
	})

	describe("supportsRLS", () => {
		it("returns false for SQLite", () => {
			const adapter = new TursoProviderAdapter()
			expect(adapter.supportsRLS()).toBe(false)
		})
	})

	describe("supportsGraphQL", () => {
		it("returns false for SQLite", () => {
			const adapter = new TursoProviderAdapter()
			expect(adapter.supportsGraphQL()).toBe(false)
		})
	})
})

describe("PlanetScaleProviderAdapter", () => {
	describe("constructor", () => {
		it("creates adapter with correct type and dialect", () => {
			const adapter = new PlanetScaleProviderAdapter()
			expect(adapter.type).toBe("planetscale")
			expect(adapter.dialect).toBe("mysql")
		})
	})

	describe("connect", () => {
		it("validates config type", async () => {
			const adapter = new PlanetScaleProviderAdapter()
			const config = {
				type: "neon" as const,
				connectionString: "postgres://user:pass@host/db",
			}
			await expect(adapter.connect(config)).rejects.toThrow("Invalid configuration")
		})
	})

	describe("supportsRLS", () => {
		it("returns false for MySQL", () => {
			const adapter = new PlanetScaleProviderAdapter()
			expect(adapter.supportsRLS()).toBe(false)
		})
	})
})
