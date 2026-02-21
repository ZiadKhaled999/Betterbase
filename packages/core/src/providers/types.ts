import { z } from 'zod'
import type { ProviderType } from '@betterbase/shared'

/**
 * Dialect types supported by the database providers
 */
export type DatabaseDialect = 'postgres' | 'mysql' | 'sqlite'

/**
 * Provider-specific configuration schemas for Zod validation
 */
export const NeonProviderConfigSchema = z.object({
  type: z.literal('neon'),
  connectionString: z.string().min(1),
})

export const TursoProviderConfigSchema = z.object({
  type: z.literal('turso'),
  url: z.string().min(1),
  authToken: z.string().min(1),
})

export const PlanetScaleProviderConfigSchema = z.object({
  type: z.literal('planetscale'),
  connectionString: z.string().min(1),
})

export const SupabaseProviderConfigSchema = z.object({
  type: z.literal('supabase'),
  connectionString: z.string().min(1),
})

export const PostgresProviderConfigSchema = z.object({
  type: z.literal('postgres'),
  connectionString: z.string().min(1),
})

export const ManagedProviderConfigSchema = z.object({
  type: z.literal('managed'),
})

/**
 * Union of all provider configuration schemas
 */
export const ProviderConfigSchema = z.discriminatedUnion('type', [
  NeonProviderConfigSchema,
  TursoProviderConfigSchema,
  PlanetScaleProviderConfigSchema,
  SupabaseProviderConfigSchema,
  PostgresProviderConfigSchema,
  ManagedProviderConfigSchema,
])

/**
 * Configuration for connecting to a database provider
 * Each provider has different required fields
 */
export type ProviderConfig = z.infer<typeof ProviderConfigSchema>

/**
 * Drizzle Migration Driver type
 * Used for running migrations against the database
 */
export interface DrizzleMigrationDriver {
  migrate(migrations: string[], direction: 'up' | 'down'): Promise<void>
  createMigrationTable(): Promise<void>
  getPendingMigrations(): Promise<string[]>
}

/**
 * Neon-specific migration driver implementation
 */
export interface NeonMigrationDriver extends DrizzleMigrationDriver {
  readonly provider: 'neon'
}

/**
 * Turso-specific migration driver implementation
 */
export interface TursoMigrationDriver extends DrizzleMigrationDriver {
  readonly provider: 'turso'
}

/**
 * PlanetScale-specific migration driver implementation
 */
export interface PlanetScaleMigrationDriver extends DrizzleMigrationDriver {
  readonly provider: 'planetscale'
}

/**
 * Supabase-specific migration driver implementation
 */
export interface SupabaseMigrationDriver extends DrizzleMigrationDriver {
  readonly provider: 'supabase'
}

/**
 * Standard Postgres migration driver implementation
 */
export interface PostgresMigrationDriver extends DrizzleMigrationDriver {
  readonly provider: 'postgres'
}

/**
 * Database connection wrapper that encapsulates the drizzle instance
 * and provides provider-specific functionality
 */
export interface DatabaseConnection {
  /** The underlying drizzle ORM instance */
  readonly drizzle: unknown
  /** Close the database connection */
  close(): Promise<void>
  /** Get the connection status */
  isConnected(): boolean
}

/**
 * Neon-specific database connection
 */
export interface NeonDatabaseConnection extends DatabaseConnection {
  readonly provider: 'neon'
  readonly neon: unknown
}

/**
 * Turso-specific database connection
 */
export interface TursoDatabaseConnection extends DatabaseConnection {
  readonly provider: 'turso'
  readonly libsql: unknown
}

/**
 * PlanetScale-specific database connection
 */
export interface PlanetScaleDatabaseConnection extends DatabaseConnection {
  readonly provider: 'planetscale'
  readonly planetscale: unknown
}

/**
 * Supabase-specific database connection
 */
export interface SupabaseDatabaseConnection extends DatabaseConnection {
  readonly provider: 'supabase'
  readonly postgres: unknown
}

/**
 * Standard Postgres database connection
 */
export interface PostgresDatabaseConnection extends DatabaseConnection {
  readonly provider: 'postgres'
  readonly postgres: unknown
}

/**
 * Provider adapter interface that all database providers must implement
 * This ensures a consistent API regardless of the underlying database technology
 */
export interface ProviderAdapter {
  /** The type of provider */
  readonly type: ProviderType
  /** The SQL dialect used by this provider */
  readonly dialect: DatabaseDialect
  /**
   * Connect to the database provider
   * @param config - Provider-specific configuration
   * @returns A promise that resolves to a database connection
   */
  connect(config: ProviderConfig): Promise<DatabaseConnection>
  /**
   * Get the migrations driver for this provider
   * @returns A migration driver instance
   */
  getMigrationsDriver(): DrizzleMigrationDriver
  /**
   * Check if this provider supports Row Level Security (RLS)
   * @returns true if RLS is supported, false otherwise
   */
  supportsRLS(): boolean
  /**
   * Check if this provider supports GraphQL
   * @returns true if GraphQL is supported (partial for non-Postgres)
   */
  supportsGraphQL(): boolean
}

/**
 * Type guard to check if a provider config is valid
 * @param config - The configuration to validate
 * @returns true if the configuration is valid
 */
export function isValidProviderConfig(config: unknown): config is ProviderConfig {
  return ProviderConfigSchema.safeParse(config).success
}

/**
 * Parse and validate provider configuration
 * @param config - The configuration to parse
 * @returns The validated configuration
 * @throws ZodError if validation fails
 */
export function parseProviderConfig(config: unknown): ProviderConfig {
  return ProviderConfigSchema.parse(config)
}

/**
 * Safe parse provider configuration
 * @param config - The configuration to parse
 * @returns Result containing either the validated config or error
 */
export function safeParseProviderConfig(config: unknown): z.SafeParseReturnType<unknown, ProviderConfig> {
  return ProviderConfigSchema.safeParse(config)
}
