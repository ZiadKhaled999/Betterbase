/**
 * BetterBase Configuration Module
 * 
 * This module provides configuration validation and Drizzle config generation
 * for the BetterBase framework.
 */

// Re-export everything from schema
export {
  ProviderTypeSchema,
  type ProviderType,
  BetterBaseConfigSchema,
  type BetterBaseConfig,
  defineConfig,
  validateConfig,
  parseConfig,
  assertConfig,
} from './schema'

// Re-export drizzle generator
export {
  generateDrizzleConfig,
  getDialectForProvider,
  getDriverForProvider,
  getRequiredEnvVars,
  type DrizzleDriver,
  type DrizzleDialect,
  type DrizzleConfigOutput,
  type DbCredentials,
} from './drizzle-generator'
