# Configuration Module

Zod-based configuration schema validation for BetterBase applications.

## Table of Contents
- [Overview](#overview)
- [Features](#features)
- [Installation](#installation)
- [Usage](#usage)
- [API Reference](#api-reference)
  - [defineConfig](#defineconfig)
  - [validateConfig](#validateconfig)
  - [parseConfig](#parseconfig)
  - [assertConfig](#assertconfig)
  - [Schemas](#schemas)
- [Configuration Structure](#configuration-structure)
  - [Project](#project)
  - [Provider](#provider)
  - [Storage](#storage)
  - [Webhooks](#webhooks)
  - [GraphQL](#graphql)
  - [Vector](#vector)
  - [Auto-REST](#autorest)
  - [Branching](#branching)
- [Validation & Error Handling](#validation--error-handling)
- [Environment Variables](#environment-variables)
- [Best Practices](#best-practices)
- [Examples](#examples)

## Overview

The Configuration module provides a robust, type-safe configuration system using Zod schema validation. It ensures that your BetterBase application configuration is valid at runtime with clear error messages and full TypeScript inference.

Key capabilities:
- **Schema Validation**: Runtime validation of configuration objects
- **Type Safety**: Full TypeScript type inference from Zod schemas
- **Clear Error Messages**: Descriptive validation errors with field paths
- **Flexible Structure**: Support for nested objects, arrays, unions, and custom refinements
- **Environment Variable Integration**: Seamless work with process.env references
- **Provider-Specific Validation**: Custom validation rules per database provider
- **Extensible Design**: Easy to extend for custom configuration needs

## Features

### Runtime Validation
All configuration is validated at startup using Zod schemas, preventing misconfiguration from causing runtime errors.

### TypeScript Integration
Configuration types are automatically inferred from Zod schemas, ensuring perfect alignment between runtime validation and compile-time types.

### Comprehensive Error Reporting
Validation errors include:
- Exact field path where validation failed
- Clear error messages explaining what went wrong
- Support for multiple simultaneous errors

### Provider-Specific Logic
Different database providers have different connection requirements:
- **PostgreSQL/MySQL/Supabase/PlanetScale**: Require connectionString
- **Turso**: Requires url and authToken
- **Managed**: No database connection required

### Modular Structure
Configuration is organized into logical sections:
- Project metadata
- Database provider configuration
- Storage provider settings
- Webhook configuration
- GraphQL settings
- Vector search configuration
- Auto-REST options
- Branching/preview environment settings

### Environment Variable Support
Special handling for environment variable references in string values (e.g., "process.env.DATABASE_URL").

## Installation

The Configuration module is part of `@betterbase/core`:
```bash
bun add @betterbase/core
```

## Usage

### Defining Configuration
```typescript
import { defineConfig } from '@betterbase/core';

const config = defineConfig({
  project: { name: 'my-app' },
  provider: { 
    type: 'postgres',
    connectionString: process.env.DATABASE_URL 
  },
  storage: {
    provider: 's3',
    bucket: 'my-app-uploads',
    region: 'us-west-2'
  },
  webhooks: [
    {
      id: 'user-notifications',
      table: 'users',
      events: ['INSERT', 'UPDATE'],
      url: 'process.env.USER_WEBHOOK_URL',
      secret: 'process.env.USER_WEBHOOK_SECRET'
    }
  ],
  branching: {
    enabled: true,
    maxPreviews: 5
  }
});
```

### Using Configuration in Code
```typescript
import { config } from './betterbase.config.ts';

// Access configuration with full TypeScript support
const databaseUrl = config.provider.connectionString;
const isBranchingEnabled = config.branching?.enabled ?? false;
const storageBucket = config.storage?.bucket;
```

### Validating External Configuration
```typescript
import { validateConfig, parseConfig } from '@betterbase/core';

// Validate a configuration object
const isValid = validateConfig(externalConfig);

// Parse with detailed result
const result = parseConfig(externalConfig);
if (result.success) {
  // Use result.data
} else {
  // Handle result.error
}
```

## API Reference

### defineConfig
Validates and returns a BetterBase configuration object.

```typescript
export function defineConfig(
  config: z.input<typeof BetterBaseConfigSchema>
): BetterBaseConfig
```

#### Parameters
- `config`: Configuration object to validate

#### Returns
- `BetterBaseConfig`: Validated configuration with full TypeScript typing

#### Throws
- `ZodError`: If validation fails (wrapped in descriptive Error by assertConfig)

### validateConfig
Checks if a configuration is valid without throwing.

```typescript
export function validateConfig(config: unknown): boolean
```

#### Parameters
- `config`: Configuration to validate

#### Returns
- `boolean`: true if valid, false otherwise

### parseConfig
Safely parses configuration returning a result object.

```typescript
export function parseConfig(
  config: unknown
): z.SafeParseReturnType<unknown, BetterBaseConfig>
```

#### Parameters
- `config`: Configuration to parse

#### Returns
- `SafeParseReturnType`: Object with `.success` boolean and either `.data` or `.error`

### assertConfig
Validates configuration and throws descriptive error if invalid.

```typescript
export function assertConfig(config: unknown): asserts config is BetterBaseConfig
```

#### Parameters
- `config`: Configuration to validate

#### Throws
- `Error`: With detailed validation error messages if invalid

### Schemas
Exported Zod schemas for advanced usage and extension.

```typescript
export {
  ProviderTypeSchema,
  BetterBaseConfigSchema,
  // ... other internal schemas
}
```

## Configuration Structure

### Project
Basic project metadata.

```typescript
project: z.object({
  name: z.string().min(1, "Project name is required"),
})
```

#### Fields
- `name`: Human-readable project name (required)

### Provider
Database provider configuration with provider-specific validation.

```typescript
provider: z.object({
  type: ProviderTypeSchema, // neon | turso | planetscale | supabase | postgres | managed
  connectionString: z.string().optional(),
  url: z.string().optional(), // Turso - libSQL connection URL
  authToken: z.string().optional(), // Turso - auth token for managed DB
})
```

#### Provider-Specific Requirements
- **postgres, neon, planetscale, supabase**: `connectionString` required
- **turso**: `url` and `authToken` required
- **managed**: No database fields required

### Storage
File storage provider configuration.

```typescript
storage: z.object({
  provider: z.enum(["s3", "r2", "backblaze", "minio", "managed"]),
  bucket: z.string(),
  region: z.string().optional(),
  endpoint: z.string().optional(),
  policies: z.array(
    z.object({
      bucket: z.string(),
      operation: z.enum(["upload", "download", "list", "delete", "*"]),
      expression: z.string(),
    })
  ).default([])
}).optional()
```

#### Storage Providers
- **s3**: Amazon S3
- **r2**: Cloudflare R2
- **backblaze**: Backblaze B2
- **minio**: Self-hosted MinIO
- **managed**: No external storage (local/dev only)

#### Policy Format
Each policy defines:
- `bucket`: Target bucket (can differ from main bucket)
- `operation`: Storage operation to allow
- `expression`: RLS-like expression for conditional access

### Webhooks
Outgoing webhook delivery configuration.

```typescript
webhooks: z.array(
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
  })
).optional()
```

#### Webhook Fields
- `id`: Unique webhook identifier
- `table`: Database table to watch for changes
- `events`: Array of trigger events (INSERT, UPDATE, DELETE)
- `url`: Destination URL (must be process.env reference)
- `secret`: Signing secret (must be process.env reference)
- `enabled`: Whether webhook is active

### GraphQL
GraphQL API configuration.

```typescript
graphql: z.object({
  enabled: z.boolean().default(true),
}).optional()
```

#### GraphQL Fields
- `enabled`: Whether to enable GraphQL endpoint (default: true)

### Vector
Vector search/service configuration.

```typescript
vector: z.object({
  enabled: z.boolean().default(false),
  provider: z.enum(["openai", "cohere", "huggingface", "custom"]).default("openai"),
  apiKey: z.string().optional(),
  model: z.string().optional(),
  dimensions: z.number().int().min(1).optional(),
  endpoint: z.string().optional(),
}).optional()
```

#### Vector Fields
- `enabled`: Enable vector search features
- `provider`: Embedding service provider
- `apiKey`: API key for provider (optional for some)
- `model`: Embedding model to use
- `dimensions`: Vector dimensions (provider-dependent)
- `endpoint`: Custom endpoint for self-hosted

### Auto-REST
Automatic REST API generation configuration.

```typescript
autoRest: z.object({
  enabled: z.boolean().default(true),
  excludeTables: z.array(z.string()).default([]),
  tables: z.record(
    z.object({
      advancedFilters: z.boolean().default(false),
      maxLimit: z.number().default(1000),
    })
  ).optional(),
}).optional()
```

#### Auto-REST Fields
- `enabled`: Enable automatic CRUD route generation
- `excludeTables`: Tables to skip in Auto-REST generation
- `tables`: Per-table configuration overrides
  - `advancedFilters`: Enable advanced query filtering syntax
  - `maxLimit`: Maximum limit for pagination queries

### Branching
Preview environment/branching configuration.

```typescript
branching: z.object({
  enabled: z.boolean().default(true),
  maxPreviews: z.number().int().min(1).max(50).default(10),
  defaultSleepTimeout: z.number().int().min(60).default(3600),
  storageEnabled: z.boolean().default(true),
}).optional()
```

#### Branching Fields
- `enabled`: Enable preview branch creation
- `maxPreviews`: Maximum concurrent preview branches
- `defaultSleepTimeout`: Seconds of inactivity before sleeping branch (60s-50min)
- `storageEnabled`: Whether to create isolated storage per branch

## Validation & Error Handling

### Validation Process
Configuration validation occurs in `defineConfig`:
1. Basic schema structure validation
2. Type coercion and refinement
3. Provider-specific validation (connection requirements)
4. Custom refinements (environment variable format, etc.)

### Error Formats
Validation errors provide:
- Field path: `provider.connectionString`
- Error message: `Provider type "postgres" requires "connectionString" to be present and non-empty`
- Validation code: `z.ZodIssueCode.custom`

### Common Validation Errors
1. **Missing Required Fields**
   ```text
   Invalid BetterBase configuration: project.name: Project name is required
   ```

2. **Provider-Specific Requirements**
   ```text
   Invalid BetterBase configuration: provider.url: Turso provider requires "url" to be present and non-empty; provider.authToken: Turso provider requires "authToken" to be present and non-empty
   ```

3. **Invalid Enum Values**
   ```text
   Invalid BetterBase configuration: provider.type: Invalid enum value. Expected 'postgres' | 'mysql' | ..., received 'mongodb'
   ```

4. **Environment Variable Format**
   ```text
   Invalid BetterBase configuration: webhooks[0].url: URL must be an environment variable reference (e.g., process.env.WEBHOOK_URL)
   ```

### Programmatic Error Handling
```typescript
try {
  const config = defineConfig(userConfig);
  // Use validated config
} catch (error) {
  if (error instanceof Error && error.message.startsWith('Invalid BetterBase configuration')) {
    // Handle validation errors
    console.error('Configuration validation failed:', error.message);
  } else {
    // Handle unexpected errors
    throw error;
  }
}
```

## Environment Variables

### Required Format
Strings that should reference environment variables must follow:
```text
process.env.VARIABLE_NAME
```

### Validation
The configuration schema validates that:
- URL and secret fields in webhooks start with `process.env.`
- No other restrictions on the variable name format

### Best Practices
1. **Always use env vars for secrets**: Never hardcode API keys, passwords, or tokens
2. **Use descriptive variable names**: `DATABASE_URL`, `STORAGE_BUCKET`, `WEBHOOK_SECRET`
3. **Provide defaults for development**: Use `||` fallback for non-secrets
4. **Document required variables**: Create `.env.example` file
5. **Validate in CI**: Check that required env vars are present before deployment

### Example .env File
```env
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/db
PROVIDER_TYPE=postgres

# Storage
STORAGE_PROVIDER=s3
STORAGE_BUCKET=my-app-prod
AWS_ACCESS_KEY_ID=your-key-here
AWS_SECRET_ACCESS_KEY=your-secret-here
AWS_REGION=us-west-2

# Webhooks
USER_WEBHOOK_URL=https://hooks.slack.com/services/T00000000/B00000000/EXAMPLE_WEBHOOK_TOKEN
USER_WEBHOOK_SECRET=your-webhook-signing-secret

# Vector Search
OPENAI_API_KEY=sk-...
```

## Best Practices

### Configuration Organization
1. **Keep it flat when possible**: Avoid deeply nested structures
2. **Group related settings**: Use objects for logical sections (as already done)
3. **Use sensible defaults**: Make common configurations work out-of-box
4. **Separate concerns**: Don't mix database, storage, and feature flags in same object
5. **Make required fields explicit**: Use `.min(1)` or similar for required strings

### Validation Strategy
1. **Validate at startup**: Catch configuration errors early
2. **Fail fast**: Don't start if configuration is invalid
3. **Provide clear guidance**: Error messages should help fix the problem
4. **Validate external inputs**: Any config from outside (files, env, etc.)
5. **Trust but verify**: Even if you think it's valid, validate it

### Environment Variables
1. **Never commit secrets**: Use .gitignore for .env files
2. **Use consistent naming**: PREFIX_VARIABLE_NAME pattern
3. **Document all required variables**: In README or .env.example
4. **Consider validation tools**: Use packages like `dotenv-validator` in development
5. **Handle missing gracefully**: Provide helpful errors for missing vars

### Type Safety
1. **Trust the inferred types**: TypeScript types from Zod are reliable
2. **Don't duplicate type definitions**: Use `z.infer<typeof Schema>` when needed
3. **Extend carefully**: When adding config, update both schema and docs
4. **Use branded types**: For special string formats (env var refs, etc.)

### Security
1. **Validate all inputs**: Especially anything touching database or storage
2. **Sanitize strings**: Prevent injection in dynamic contexts
3. **Limit exposure**: Don't log full configuration objects
4. **Consider encryption**: For highly sensitive configuration values
5. **Audit regularly**: Review what configuration is actually needed

## Examples

### Minimal Valid Configuration
```typescript
const config = defineConfig({
  project: { name: 'my-minimal-app' },
  provider: { type: 'managed' } // No DB needed
  // All other sections optional
});
```

### PostgreSQL with S3 Storage
```typescript
const config = defineConfig({
  project: { name: 'prod-app' },
  provider: {
    type: 'postgres',
    connectionString: process.env.DATABASE_URL
  },
  storage: {
    provider: 's3',
    bucket: process.env.STORAGE_BUCKET,
    region: process.env.AWS_REGION || 'us-east-1'
  },
  webhooks: [
    {
      id: 'order-events',
      table: 'orders',
      events: ['INSERT', 'UPDATE', 'DELETE'],
      url: process.env.ORDER_WEBHOOK_URL,
      secret: process.env.ORDER_WEBHOOK_SECRET
    }
  ],
  branching: {
    enabled: true,
    maxPreviews: 15,
    defaultSleepTimeout: 1800 // 30 minutes
  }
});
```

### Multi-Provider Setup (Turso Example)
```typescript
const config = defineConfig({
  project: { name: 'edge-app' },
  provider: {
    type: 'turso',
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN
  },
  storage: {
    provider: 'r2', // Cloudflare R2 pairs well with Turso
    bucket: process.env.STORAGE_BUCKET,
    // R2 doesn't use region in same way as AWS
  },
  vector: {
    enabled: true,
    provider: 'openai',
    apiKey: process.env.OPENAI_API_KEY
  }
});
```

### Development Configuration
```typescript
const config = defineConfig({
  project: { name: 'dev-app' },
  provider: {
    type: 'postgres',
    connectionString: 'postgresql://localhost:5432/dev_db'
  },
  storage: {
    provider: 'minio',
    bucket: 'dev-uploads',
    endpoint: 'http://localhost:9000',
    // MinIO doesn't require region by default
  },
  // Disable expensive features in dev
  vector: { enabled: false },
  branching: { enabled: false } // Or set low limits
});
```

### Configuration with Custom Tables (Auto-REST)
```typescript
const config = defineConfig({
  project: { name: 'blog-platform' },
  provider: {
    type: 'postgres',
    connectionString: process.env.DATABASE_URL
  },
  autoRest: {
    enabled: true,
    excludeTables: ['schema_migrations', 'audit_log'],
    tables: {
      // Advanced filtering for posts table
      posts: {
        advancedFilters: true,
        maxLimit: 100 // Higher limit for blog lists
      },
      // Strict limits for sensitive data
      users: {
        advancedFilters: false,
        maxLimit: 10 // Low limit for user listings
      }
    }
  }
});
```

## Migration Guide

### From Untyped Configuration
If you previously had untyped configuration objects:

1. Add Zod to your dependencies: `bun add zod`
2. Move validation logic to `defineConfig` wrapper
3. Replace manual checks with schema refinements
4. Leverage inferred TypeScript types
5. Remove redundant runtime type checks

### Version Compatibility
Configuration schemas are designed to be backward compatible:
- New fields are added as optional
- Default values maintain existing behavior
- Breaking changes require major version bump
- Validation errors guide migration path

## Related Modules
- [Auto-REST](./auto-rest.md): Configuration options affect API generation
- [Branching](./branching.md): Branching behavior configured here
- [Providers](./providers.md): Provider-specific implementation details
- [Storage](./storage.md): Storage provider configuration details
- [Webhooks](./webhooks.md): Webhook configuration and delivery
- [Logger](./logger.md): Logging can be configured via environment