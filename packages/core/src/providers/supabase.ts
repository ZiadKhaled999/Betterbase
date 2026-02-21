import postgres from 'postgres'
import type { ProviderAdapter, DatabaseConnection, DrizzleMigrationDriver, ProviderConfig, SupabaseDatabaseConnection } from './types'
import { parseProviderConfig } from './types'
import type { ProviderType } from '@betterbase/shared'

// Type for the Postgres client (used by Supabase)
type PostgresClient = ReturnType<typeof postgres>

/**
 * Supabase-specific database connection implementation
 * Uses direct Postgres connection (NOT @supabase/supabase-js)
 */
class SupabaseConnection implements SupabaseDatabaseConnection {
  readonly provider: 'supabase' = 'supabase'
  readonly postgres: PostgresClient
  // Store the drizzle-compatible client for use with drizzle-orm
  readonly drizzle: PostgresClient
  private _isConnected: boolean = false

  constructor(connectionString: string) {
    this.postgres = postgres(connectionString)
    this.drizzle = this.postgres
    this._isConnected = true
  }

  async close(): Promise<void> {
    await this.postgres.end()
    this._isConnected = false
  }

  isConnected(): boolean {
    return this._isConnected
  }
}

/**
 * Supabase migration driver implementation
 */
class SupabaseMigrationDriver implements DrizzleMigrationDriver {
  private readonly connectionString: string

  constructor(connectionString: string) {
    this.connectionString = connectionString
  }

  async migrate(_migrations: string[], _direction: 'up' | 'down'): Promise<void> {
    // Migration implementation would go here
    // For now, this is a placeholder
    console.log('Running migrations with Supabase driver...')
  }

  async createMigrationTable(): Promise<void> {
    // Create the __drizzle_migrations table if it doesn't exist
    console.log('Creating migration table with Supabase driver...')
  }

  async getPendingMigrations(): Promise<string[]> {
    // Return list of pending migrations
    return []
  }
}

/**
 * Supabase database provider adapter
 * Implements the ProviderAdapter (managed Postgres)
 interface for Supabase * Uses direct Postgres connection, NOT @supabase/supabase-js
 */
export class SupabaseProviderAdapter implements ProviderAdapter {
  readonly type: ProviderType = 'supabase'
  readonly dialect: 'postgres' = 'postgres'
  private _connectionString: string | null = null

  /**
   * Connect to a Supabase database
   * @param config - The provider configuration
   * @returns A promise that resolves to a Supabase database connection
   */
  async connect(config: ProviderConfig): Promise<DatabaseConnection> {
    const validatedConfig = parseProviderConfig(config)
    
    if (validatedConfig.type !== 'supabase') {
      throw new Error('Invalid configuration: expected Supabase provider config')
    }

    const connectionString = validatedConfig.connectionString
    
    if (!connectionString) {
      throw new Error('Supabase provider requires a connectionString')
    }

    // Store connection string for later use by getMigrationsDriver
    this._connectionString = connectionString

    return new SupabaseConnection(connectionString)
  }

  /**
   * Get the migrations driver for Supabase
   * @returns A Supabase migration driver instance
   */
  getMigrationsDriver(): DrizzleMigrationDriver {
    if (!this._connectionString) {
      throw new Error('Migration driver not initialized. Call connect() first.')
    }
    return new SupabaseMigrationDriver(this._connectionString)
  }

  /**
   * Supabase supports Row Level Security (RLS)
   * @returns true as Supabase is built on PostgreSQL with RLS support
   */
  supportsRLS(): boolean {
    return true
  }

  /**
   * Supabase supports GraphQL (via PostgreSQL)
   * @returns true
   */
  supportsGraphQL(): boolean {
    return true
  }
}

/**
 * Create a new Supabase provider adapter instance
 * @returns A new SupabaseProviderAdapter instance
 */
export function createSupabaseProvider(): SupabaseProviderAdapter {
  return new SupabaseProviderAdapter()
}

// Export the adapter as default for convenience
export default SupabaseProviderAdapter
