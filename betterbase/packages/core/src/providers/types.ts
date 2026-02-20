import type { ProviderType } from '@betterbase/shared'

export interface ProviderAdapter {
  type: ProviderType
  dialect: 'postgres' | 'mysql' | 'sqlite'
  connect(config: ProviderConfig): Promise<DatabaseConnection>
  getMigrationsDriver(): unknown           // typed per phase 10.1
  supportsRLS(): boolean
  supportsGraphQL(): boolean
}

export interface ProviderConfig {
  type: ProviderType
  connectionString?: string
  url?: string
  authToken?: string
}

// Placeholder — real connection type implemented in Phase 10.1
export type DatabaseConnection = unknown
