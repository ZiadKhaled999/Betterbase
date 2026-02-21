import type { ProviderType } from './schema'
import type { BetterBaseConfig } from './schema'

/**
 * Drizzle driver types supported by the generator
 */
export type DrizzleDriver = 
  | 'neon-serverless'  // Neon
  | 'turso'            // Turso/libSQL
  | 'mysql2'           // PlanetScale
  | 'pg'               // PostgreSQL/Supabase
  | 'better-sqlite'    // Local/SQLite

/**
 * Drizzle dialect types
 */
export type DrizzleDialect = 'postgresql' | 'mysql' | 'sqlite' | 'turso'

/**
 * Interface for database credentials in generated config
 */
export interface DbCredentials {
  connectionString?: string
  url?: string
  uri?: string
  authToken?: string
}

/**
 * Generated drizzle configuration structure
 */
export interface DrizzleConfigOutput {
  schema?: string
  out?: string
  dialect: DrizzleDialect
  driver?: DrizzleDriver
  dbCredentials: DbCredentials
  verbose?: boolean
  strict?: boolean
}

/**
 * Generates a drizzle.config.ts file content based on the selected provider
 * @param providerType - The database provider type
 * @param config - The BetterBase configuration (used for custom schema/out paths)
 * @returns A string containing the complete drizzle.config.ts file content
 * @throws Error if the provider type is not supported
 */
export function generateDrizzleConfig(
  providerType: ProviderType,
  config?: Partial<BetterBaseConfig>
): string {
  const schemaPath = config?.project?.name ? './src/db/schema.ts' : './src/db/schema.ts'
  const outPath = './drizzle'

  switch (providerType) {
    case 'neon':
      return generateNeonConfig(schemaPath, outPath)
    
    case 'turso':
      return generateTursoConfig(schemaPath, outPath)
    
    case 'planetscale':
      return generatePlanetScaleConfig(schemaPath, outPath)
    
    case 'supabase':
      return generateSupabaseConfig(schemaPath, outPath)
    
    case 'postgres':
      return generatePostgresConfig(schemaPath, outPath)
    
    case 'managed':
      return generateManagedConfig(schemaPath, outPath)
    
    default:
      throw new Error(`Unsupported provider type: ${providerType}`)
  }
}

/**
 * Generates drizzle config for Neon database
 * Uses postgresql dialect with neon-serverless driver
 */
function generateNeonConfig(schemaPath: string, outPath: string): string {
  return `import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: '${schemaPath}',
  out: '${outPath}',
  dialect: 'postgresql',
  driver: 'neon-serverless',
  dbCredentials: {
    connectionString: process.env.DATABASE_URL!
  },
  verbose: true,
  strict: true,
})
`
}

/**
 * Generates drizzle config for Turso (libSQL) database
 * Uses turso dialect with turso driver
 */
function generateTursoConfig(schemaPath: string, outPath: string): string {
  return `import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: '${schemaPath}',
  out: '${outPath}',
  dialect: 'turso',
  driver: 'turso',
  dbCredentials: {
    url: process.env.TURSO_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN!
  },
  verbose: true,
  strict: true,
})
`
}

/**
 * Generates drizzle config for PlanetScale database
 * Uses mysql dialect with mysql2 driver
 */
function generatePlanetScaleConfig(schemaPath: string, outPath: string): string {
  return `import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: '${schemaPath}',
  out: '${outPath}',
  dialect: 'mysql',
  driver: 'mysql2',
  dbCredentials: {
    uri: process.env.DATABASE_URL!
  },
  verbose: true,
  strict: true,
})
`
}

/**
 * Generates drizzle config for Supabase (PostgreSQL) database
 * Uses postgresql dialect with pg driver
 */
function generateSupabaseConfig(schemaPath: string, outPath: string): string {
  return `import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: '${schemaPath}',
  out: '${outPath}',
  dialect: 'postgresql',
  driver: 'pg',
  dbCredentials: {
    url: process.env.DATABASE_URL!
  },
  verbose: true,
  strict: true,
})
`
}

/**
 * Generates drizzle config for standard PostgreSQL database
 * Uses postgresql dialect with pg driver
 */
function generatePostgresConfig(schemaPath: string, outPath: string): string {
  return `import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: '${schemaPath}',
  out: '${outPath}',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!
  },
  verbose: true,
  strict: true,
})
`
}

/**
 * Generates drizzle config for managed (BetterBase-hosted) database
 * Uses sqlite dialect with better-sqlite driver for local development
 */
function generateManagedConfig(schemaPath: string, outPath: string): string {
  return `import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: '${schemaPath}',
  out: '${outPath}',
  dialect: 'sqlite',
  driver: 'better-sqlite',
  dbCredentials: {
    url: process.env.DATABASE_URL || 'file:local.db'
  },
  verbose: true,
  strict: true,
})
`
}

/**
 * Gets the appropriate dialect for a given provider type
 * @param providerType - The database provider type
 * @returns The Drizzle dialect string
 */
export function getDialectForProvider(providerType: ProviderType): DrizzleDialect {
  switch (providerType) {
    case 'neon':
    case 'supabase':
    case 'postgres':
      return 'postgresql'
    case 'planetscale':
      return 'mysql'
    case 'turso':
      return 'turso'
    case 'managed':
      return 'sqlite'
    default:
      throw new Error(`Unsupported provider type: ${providerType}`)
  }
}

/**
 * Gets the appropriate driver for a given provider type
 * @param providerType - The database provider type
 * @returns The Drizzle driver string or undefined for default driver
 */
export function getDriverForProvider(providerType: ProviderType): DrizzleDriver | undefined {
  switch (providerType) {
    case 'neon':
      return 'neon-serverless'
    case 'turso':
      return 'turso'
    case 'planetscale':
      return 'mysql2'
    case 'managed':
      return 'better-sqlite'
    case 'supabase':
    case 'postgres':
      return undefined // Uses default pg driver
    default:
      throw new Error(`Unsupported provider type: ${providerType}`)
  }
}

/**
 * Gets the environment variables required for a given provider type
 * @param providerType - The database provider type
 * @returns Array of required environment variable names
 */
export function getRequiredEnvVars(providerType: ProviderType): string[] {
  switch (providerType) {
    case 'neon':
    case 'supabase':
    case 'postgres':
    case 'planetscale':
      return ['DATABASE_URL']
    case 'turso':
      return ['TURSO_URL', 'TURSO_AUTH_TOKEN']
    case 'managed':
      return ['DATABASE_URL'] // Optional, defaults to local.db
    default:
      return []
  }
}
