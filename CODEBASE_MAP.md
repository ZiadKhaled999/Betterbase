# BetterBase — Complete Codebase Map

> Last updated: 2026-03-07

## Project Identity

**BetterBase** is an AI-native Backend-as-a-Service (BaaS) platform inspired by Supabase. It provides a TypeScript-first developer experience with a focus on AI context generation, Docker-less local development, and zero lock-in. The stack is built on **Bun** (runtime), **Turborepo** (monorepo), **Hono** (API framework), **Drizzle ORM** (database), and **BetterAuth** (authentication: AI-first context). The philosophy emphasizes generation via `.betterbase-context.json`, sub-100ms startup with `bun:sqlite`, user-owned schemas, and strict TypeScript with Zod validation everywhere.

---

## Tech Stack Overview

| Layer | Technologies |
|-------|--------------|
| **Runtime** | Bun 1.x, Node.js (Bun-compatible) |
| **API Framework** | Hono.js (lightweight, fast, composable) |
| **Database** | Drizzle ORM (SQL abstraction), SQLite (local), PostgreSQL (Neon/Supabase), MySQL (PlanetScale), libSQL (Turso) |
| **Authentication** | BetterAuth (password, social) |
| **Storage** | AWS S3, Cloudflare R2, Backblaze B2, MinIO |
| **Realtime** | WebSockets (Bun server) |
| **GraphQL** | graphql-yoga (server), GraphQL.js (schema) |
| **Validation** | Zod (schema validation) |
| **Build Tool** | Turbo (monorepo), Bun build |
| **CLI** | Commander.js |

---

## Monorepo Structure Overview

```mermaid
graph TB
    subgraph Root
        Root[pkgjson<br/>turbojson<br/>tsconfigbasjson]
    end
    
    subgraph packages
        CLI[packages/cli<br/>11 commands<br/>6 utils]
        Client[packages/client<br/>8 modules]
        Core[packages/core<br/>9 modules]
        Shared[packages/shared<br/>5 utilities]
    end
    
    subgraph templates
        Base[templates/base]
        Auth[templates/auth]
    end
    
    Root --> CLI
    Root --> Client
    Root --> Core
    Root --> Shared
    Root --> Base
    Root --> Auth
```

```
betterbase/
├── package.json                    # Root workspace config
├── turbo.json                      # Turborepo task configuration
├── tsconfig.base.json             # Shared TypeScript config
├── bun.lock                        # Bun lockfile
├── CODEBASE_MAP.md                 # This file
├── README.md                       # Project documentation
├── .gitignore                      # Git ignore patterns
├── .npmignore                      # npm ignore patterns
├── betterbase_auth_refactor.md     # Auth refactoring notes
├── betterbase_backend_rebuild.md   # Backend rebuild notes
├── betterbase_blueprint_v3.md      # Blueprint v3
│
├── packages/
│   ├── cli/                        # @betterbase/cli - CLI tool (bb command)
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── src/
│   │   │   ├── index.ts            # Main CLI entry point
│   │   │   ├── build.ts           # Build script
│   │   │   ├── constants.ts       # Shared constants
│   │   │   ├── commands/          # CLI commands (11 files)
│   │   │   └── utils/             # CLI utilities (7 files)
│   │   └── test/                  # CLI tests (4 files)
│   │
│   ├── client/                     # @betterbase/client - Client SDK
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── tsconfig.test.json
│   │   ├── src/                    # Client SDK (9 files)
│   │   └── test/                   # Client tests (1 file)
│   │
│   ├── core/                       # @betterbase/core - Core backend engine
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── index.ts            # Core exports
│   │       ├── config/            # Configuration modules
│   │       ├── functions/         # Serverless functions
│   │       ├── graphql/           # GraphQL server
│   │       ├── middleware/        # Middleware (RLS session)
│   │       ├── migration/         # Database migrations
│   │       ├── providers/         # Database providers
│   │       ├── rls/               # Row Level Security
│   │       ├── storage/           # Storage adapter
│   │       └── webhooks/          # Webhook handling
│   │
│   └── shared/                     # @betterbase/shared - Shared utilities
│       ├── package.json
│       ├── tsconfig.json
│       └── src/
│           ├── index.ts
│           ├── constants.ts
│           ├── errors.ts
│           ├── types.ts
│           └── utils.ts
│
└── templates/
    ├── base/                       # Bun + Hono + Drizzle starter
    │   ├── package.json
    │   ├── betterbase.config.ts
    │   ├── drizzle.config.ts
    │   ├── tsconfig.json
    │   ├── README.md
    │   └── src/
    │       ├── index.ts
    │       ├── auth/              # Auth module
    │       ├── db/                # Database schema & migrate
    │       ├── functions/        # Serverless functions
    │       ├── lib/               # Utilities (env, realtime)
    │       ├── middleware/        # Route middleware
    │       └── routes/            # API routes
    │
    └── auth/                       # Auth template with BetterAuth
        ├── README.md
        └── src/
            ├── auth/              # Auth setup
            ├── db/               # Auth schema
            ├── middleware/        # Auth middleware
            └── routes/           # Auth routes
```

---

## Root-Level Files

### [`package.json`](package.json)
**Purpose:** Root workspace configuration for Turborepo monorepo.
- **Key Fields:** `name: "betterbase"`, workspaces: `["packages/*", "templates/*"]`
- **Scripts:** Build, test, and dev scripts using turbo
- **Dependencies:** `turbo@^2.3.0`

### [`turbo.json`](turbo.json)
**Purpose:** Turborepo task configuration defining build pipelines.
- **Tasks:** `build`, `test`, `lint` with cache settings
- **Dependencies:** Build depends on ^build, test depends on ^test

### [`tsconfig.base.json`](tsconfig.base.json)
**Purpose:** Shared TypeScript configuration for all packages.
- **Target:** ES2022
- **Module:** NodeNext
- **Strict:** Enabled
- **Module Resolution:** NodeNext

---

## packages/shared

`@betterbase/shared` - Shared utilities and types across all packages.

### Shared Modules

#### [`src/constants.ts`](packages/shared/src/constants.ts)
**Purpose:** Defines shared constants used by all packages.
- **Exports:** `BETTERBASE_VERSION`, `DEFAULT_PORT`, `DEFAULT_DB_PATH`, `CONTEXT_FILE_NAME`, `CONFIG_FILE_NAME`, `MIGRATIONS_DIR`, `FUNCTIONS_DIR`, `POLICIES_DIR`
- **Values:**
  - `BETTERBASE_VERSION`: "0.1.0"
  - `DEFAULT_PORT`: 3000
  - `DEFAULT_DB_PATH`: "local.db"
  - `CONTEXT_FILE_NAME`: ".betterbase-context.json"
  - `CONFIG_FILE_NAME`: "betterbase.config.ts"
  - `MIGRATIONS_DIR`: "drizzle"
  - `FUNCTIONS_DIR`: "src/functions"
  - `POLICIES_DIR`: "src/db/policies"

#### [`src/errors.ts`](packages/shared/src/errors.ts)
**Purpose:** Defines custom error classes for consistent error handling.
- **Exports:** `BetterBaseError`, `ValidationError`, `NotFoundError`, `UnauthorizedError`
- **Key Features:**
  - `BetterBaseError`: Base error class with code and status code
  - `ValidationError`: 400 Bad Request error for validation failures
  - `NotFoundError`: 404 Not Found error for missing resources
  - `UnauthorizedError`: 401 Unauthorized error for authentication failures

#### [`src/types.ts`](packages/shared/src/types.ts)
**Purpose:** Shared TypeScript type definitions.
- **Exports:**
  - `SerializedError`: JSON-serializable error representation
  - `BetterBaseResponse<T>`: Generic API response wrapper with data, error, count, and pagination
  - `DBEventType`: Database event type (INSERT, UPDATE, DELETE)
  - `DBEvent`: Database event object with table, type, record, old_record, and timestamp
  - `ProviderType`: Supported database providers (neon, turso, planetscale, supabase, postgres, managed)
  - `PaginationParams`: Generic pagination parameters (limit, offset)

#### [`src/utils.ts`](packages/shared/src/utils.ts)
**Purpose:** Utility functions used across all packages.
- **Exports:**
  - `serializeError(error)`: Converts an Error object to SerializedError
  - `isValidProjectName(name)`: Validates project name is slug-safe (lowercase, alphanumeric, hyphens)
  - `toCamelCase(str)`: Converts snake_case to camelCase
  - `toSnakeCase(str)`: Converts camelCase/PascalCase to snake_case
  - `safeJsonParse<T>(str)`: Safely parses JSON without throwing, returns null on failure
  - `formatBytes(bytes)`: Formats bytes to human-readable string (B, KiB, MiB, GiB, TiB, PiB)

#### [`src/index.ts`](packages/shared/src/index.ts)
**Purpose:** Shared package entry point re-exporting all modules.

---

## packages/core

`@betterbase/core` - Core backend engine with all server-side functionality.

### Core Modules

#### [`src/config/index.ts`](packages/core/src/config/index.ts)
**Purpose:** Configuration module exports.

#### [`src/config/schema.ts`](packages/core/src/config/schema.ts)
**Purpose:** Project configuration schema validation using Zod.
- **Exports:** `ProviderTypeSchema`, `BetterBaseConfigSchema`, `defineConfig`, `validateConfig`, `parseConfig`, `assertConfig`
- **Key Types:** `ProviderType`, `BetterBaseConfig`
- **Validation Features:**
  - Validates project configuration structure
  - Provider-specific validation (e.g., Turso requires url and authToken)
  - Storage configuration validation
  - Webhook configuration validation
  - GraphQL configuration validation

#### [`src/config/drizzle-generator.ts`](packages/core/src/config/drizzle-generator.ts)
**Purpose:** Drizzle configuration generator based on provider type.
- **Exports:** `generateDrizzleConfig`, `getDialectForProvider`, `getDriverForProvider`, `getRequiredEnvVars`
- **Key Types:** `DrizzleDriver`, `DrizzleDialect`, `DrizzleConfigOutput`, `DbCredentials`
- **Supported Providers:** Neon, Turso, PlanetScale, Supabase, PostgreSQL, managed

### functions/

#### [`functions/index.ts`](packages/core/src/functions/index.ts)
**Purpose:** Serverless functions module exports.

#### [`functions/bundler.ts`](packages/core/src/functions/bundler.ts)
**Purpose:** Bundles serverless functions using Bun's build API for edge compatibility.
- **Exports:** `bundleFunction`, `readFunctionConfig`, `listFunctions`, `isFunctionBuilt`
- **Key Types:** `BundleResult`, `FunctionConfig`, `FunctionInfo`
- **Features:**
  - Bundles TypeScript functions into single JavaScript file
  - Supports Cloudflare Workers and Vercel Edge runtime
  - Handles function configuration from config.ts
  - Lists all functions in project
  - Checks if function has been built

#### [`functions/deployer.ts`](packages/core/src/functions/deployer.ts)
**Purpose:** Deploys serverless functions to cloud providers.
- **Exports:** `deployToCloudflare`, `deployToVercel`, `syncEnvToCloudflare`, `syncEnvToVercel`, `getCloudflareLogs`, `getVercelLogs`
- **Key Types:** `DeployResult`
- **Features:**
  - Deploys to Cloudflare Workers using Wrangler CLI
  - Deploys to Vercel Edge using Vercel CLI
  - Syncs environment variables
  - Retrieves function logs

### graphql/

#### [`graphql/index.ts`](packages/core/src/graphql/index.ts)
**Purpose:** GraphQL module exports.

#### [`graphql/resolvers.ts`](packages/core/src/graphql/resolvers.ts)
**Purpose:** GraphQL resolver generator that calls Drizzle ORM directly.
- **Exports:** `generateResolvers`, `GraphQLContext`, `GraphQLResolver`, `Resolvers`, `ResolverGenerationConfig`
- **Key Features:**
  - Auto-generates resolvers from Drizzle schema
  - Supports queries, mutations, and subscriptions (placeholder)
  - Respect auth context from BetterAuth
  - Custom hooks for before/after mutations
  - Error handling

#### [`graphql/schema-generator.ts`](packages/core/src/graphql/schema-generator.ts)
**Purpose:** Generates GraphQL schema from Drizzle ORM schema.
- **Exports:** `generateGraphQLSchema`, `GraphQLGenerationConfig`
- **Key Features:**
  - Auto-generates GraphQL types from Drizzle schema
  - Creates input types for mutations
  - Generates query types for tables
  - Supports custom type mappings
  - Handles relationships and pagination

#### [`graphql/sdl-exporter.ts`](packages/core/src/graphql/sdl-exporter.ts)
**Purpose:** Exports GraphQL schema as SDL (Schema Definition Language) string.
- **Exports:** `exportSDL`, `exportTypeSDL`, `saveSDL`
- **Key Features:**
  - Exports complete GraphQL schema as SDL
  - Exports individual types as SDL
  - Saves SDL to file
  - Customizable output options (descriptions, sorting)

#### [`graphql/server.ts`](packages/core/src/graphql/server.ts)
**Purpose:** GraphQL HTTP server using graphql-yoga that integrates with Hono.
- **Exports:** `createGraphQLServer`, `startGraphQLServer`, `GraphQLConfig`
- **Key Features:**
  - Creates Hono-compatible GraphQL server
  - Supports authentication
  - GraphQL Playground in development
  - Subscriptions support
  - Health check endpoint

### middleware/

#### [`middleware/index.ts`](packages/core/src/middleware/index.ts)
**Purpose:** Middleware module exports.

#### [`middleware/rls-session.ts`](packages/core/src/middleware/rls-session.ts)
**Purpose:** RLS session middleware for Hono.
- **Exports:** `rlsSession`, `requireRLS`, `clearRLS`, `getRLSUserId`, `isRLSSessionSet`
- **Key Constants:** `RLS_USER_ID_KEY`, `RLS_SESSION_SET_KEY`
- **Key Types:** `RLSCContext`
- **Features:**
  - Reads authenticated user from BetterAuth session
  - Makes user ID available for RLS policies
  - Idempotent operations (safe to call multiple times)
  - Requires RLS to be set for protected routes
  - Clears RLS context (e.g., on logout)

### migration/

#### [`migration/index.ts`](packages/core/src/migration/index.ts)
**Purpose:** Migration module exports.

#### [`migration/rls-migrator.ts`](packages/core/src/migration/rls-migrator.ts)
**Purpose:** Applies RLS policies to the database.
- **Exports:** `applyAuthFunction`, `dropAuthFunctionSQL`, `applyPolicies`, `dropPolicies`, `dropTableRLS`, `applyRLSMigration`, `getAppliedPolicies`
- **Features:**
  - Applies auth.uid() function to database
  - Creates RLS policies from policy definitions
  - Idempotent operations (safe to run multiple times)
  - Drops RLS policies from database
  - Disables RLS on tables
  - Gets information about applied policies

### providers/

#### [`providers/index.ts`](packages/core/src/providers/index.ts)
**Purpose:** Database providers module exports.
- **Exports:** `resolveProvider`, `resolveProviderByType`, `getSupportedProviders`, `providerSupportsRLS`, `getProviderDialect`, `ManagedProviderNotSupportedError`

#### [`providers/types.ts`](packages/core/src/providers/types.ts)
**Purpose:** Provider interface definitions.
- **Exports:** All provider types and interfaces
- **Key Types:**
  - `DatabaseDialect`: "postgres", "mysql", "sqlite"
  - `ProviderConfig`: Configuration for connecting to a database provider
  - `DatabaseConnection`: Database connection wrapper
  - `DrizzleMigrationDriver`: Migration driver interface
  - `ProviderAdapter`: Provider adapter interface
  - `onchange()`: CDC (Change Data Capture) callback for database changes
- **Provider-Specific Types:**
  - `NeonProviderConfig`, `NeonDatabaseConnection`, `NeonMigrationDriver`
  - `TursoProviderConfig`, `TursoDatabaseConnection`, `TursoMigrationDriver`
  - `PlanetScaleProviderConfig`, `PlanetScaleDatabaseConnection`, `PlanetScaleMigrationDriver`
  - `SupabaseProviderConfig`, `SupabaseDatabaseConnection`, `SupabaseMigrationDriver`
  - `PostgresProviderConfig`, `PostgresDatabaseConnection`, `PostgresMigrationDriver`
  - `ManagedProviderConfig`

#### [`providers/neon.ts`](packages/core/src/providers/neon.ts)
**Purpose:** Neon database provider implementation.

#### [`providers/planetscale.ts`](packages/core/src/providers/planetscale.ts)
**Purpose:** PlanetScale database provider implementation.

#### [`providers/postgres.ts`](packages/core/src/providers/postgres.ts)
**Purpose:** PostgreSQL database provider implementation.

#### [`providers/supabase.ts`](packages/core/src/providers/supabase.ts)
**Purpose:** Supabase database provider implementation.

#### [`providers/turso.ts`](packages/core/src/providers/turso.ts)
**Purpose:** Turso database provider implementation.

### rls/

#### [`rls/index.ts`](packages/core/src/rls/index.ts)
**Purpose:** RLS module exports.

#### [`rls/auth-bridge.ts`](packages/core/src/rls/auth-bridge.ts)
**Purpose:** Creates the auth.uid() PostgreSQL function for RLS policies.
- **Exports:** `generateAuthFunction`, `generateAuthFunctionWithSetting`, `dropAuthFunction`, `setCurrentUserId`, `clearCurrentUserId`, `generateIsAuthenticatedCheck`, `dropIsAuthenticatedCheck`, `generateAllAuthFunctions`, `dropAllAuthFunctions`
- **Key Features:**
  - Generates SQL to create auth.uid() function
  - Generates SQL to set/clear current user ID
  - Generates is_authenticated() helper function
  - Handles SQL injection protection
  - Generates all auth bridge functions at once

#### [`rls/generator.ts`](packages/core/src/rls/generator.ts)
**Purpose:** RLS Policy SQL Generator.
- **Exports:** `policyToSQL`, `dropPolicySQL`, `dropPolicyByName`, `disableRLS`, `hasPolicyConditions`, `policiesToSQL`, `dropPoliciesSQL`
- **Key Types:** `PolicyOperation`
- **Features:**
  - Generates SQL to create RLS policies
  - Generates SQL to drop RLS policies
  - Handles policy operations (select, insert, update, delete)
  - Checks if policy has conditions
  - Converts policies to SQL statements

#### [`rls/scanner.ts`](packages/core/src/rls/scanner.ts)
**Purpose:** Scans a project for policy definition files and loads them.
- **Exports:** `scanPolicies`, `scanPoliciesStrict`, `listPolicyFiles`, `getPolicyFileInfo`, `PolicyScanError`
- **Key Types:** `ScanResult`, `PolicyFileInfo`
- **Features:**
  - Scans project for policy files (*.policy.ts)
  - Loads policy definitions
  - Handles errors gracefully
  - Lists policy files without loading them
  - Extracts metadata from policy files

#### [`rls/types.ts`](packages/core/src/rls/types.ts)
**Purpose:** RLS (Row Level Security) Policy Definition Types.
- **Exports:** `definePolicy`, `isPolicyDefinition`, `mergePolicies`
- **Key Types:** `PolicyDefinition`, `PolicyConfig`
- **Features:**
  - Helper function to create policy definitions
  - Type guard to check if value is a valid PolicyDefinition
  - Merges multiple policy configs for the same table

#### [`rls/evaluator.ts`](packages/core/src/rls/evaluator.ts)
**Purpose:** RLS Policy Evaluator for enforcing row-level security.
- **Exports:** `evaluatePolicy`, `applyRLSSelect`, `applyRLSInsert`, `applyRLSUpdate`, `applyRLSDelete`
- **Key Features:**
  - Evaluates RLS policies for database operations
  - Supports SELECT, INSERT, UPDATE, DELETE operations
  - SQLite-compatible policy evaluation
  - `evaluatePolicy()` function for evaluating policy expressions
  - Applies RLS policies to Drizzle queries

### storage/

#### [`storage/index.ts`](packages/core/src/storage/index.ts)
**Purpose:** Storage Module - Fluent Builder API.
- **Exports:** `createStorage`, `resolveStorageAdapter`, `Storage`
- **Key Types:** `StorageFactory`, `BucketClient`, `StorageConfig`, `UploadOptions`, `SignedUrlOptions`, `UploadResult`, `StorageObject`
- **Features:**
  - Supabase-compatible storage API
  - Fluent `.from(bucket)` API
  - Resolves storage adapter based on provider
  - Handles async operations with { data, error } pattern

#### [`storage/s3-adapter.ts`](packages/core/src/storage/s3-adapter.ts)
**Purpose:** S3-Compatible Storage Adapter Implementation.
- **Exports:** `S3StorageAdapter`, `createS3Adapter`
- **Key Features:**
  - Implements StorageAdapter interface for S3-compatible services
  - Supports AWS S3, Cloudflare R2, Backblaze B2, MinIO
  - Handles upload, download, delete, list, signed URL operations
  - Uses AWS SDK v3
  - Converts ReadableStream to Buffer for Bun runtime

#### [`storage/types.ts`](packages/core/src/storage/types.ts)
**Purpose:** Storage Types for S3-Compatible Storage Adapter.
- **Key Types:**
  - `StorageProvider`: "s3", "r2", "backblaze", "minio", "managed"
  - `StorageConfig`: Union of all storage provider config types
  - `UploadOptions`: File upload options (contentType, metadata, isPublic)
  - `SignedUrlOptions`: Signed URL options (expiresIn)
  - `UploadResult`: Result of successful upload
  - `StorageObject`: Represents a storage object
  - `StorageAdapter`: Core storage adapter interface
  - `AllowedMimeTypes`: Array of allowed MIME types for uploads
  - `BucketConfig`: Bucket configuration with size limits and allowed types

#### [`storage/policy-engine.ts`](packages/core/src/storage/policy-engine.ts)
**Purpose:** Storage Policy Engine for evaluating access policies.
- **Exports:** `evaluateStoragePolicy`, `checkStorageAccess`, `StoragePolicy`
- **Key Features:**
  - Evaluates storage access policies
  - Supports path-based access control
  - Integrates with RLS user context
  - New: `evaluateStoragePolicy()` function for policy evaluation

### vector/

Vector Search module for pgvector support in PostgreSQL.

#### [`vector/types.ts`](packages/core/src/vector/types.ts)
**Purpose:** Vector Search Type Definitions.
- **Key Types:**
  - `EmbeddingProvider`: "openai" | "cohere" | "huggingface" | "custom"
  - `SimilarityMetric`: "cosine" | "euclidean" | "inner_product"
  - `EmbeddingConfig`: Configuration for embedding generation
  - `EmbeddingInput`: Input for generating an embedding
  - `EmbeddingResult`: Generated embedding result
  - `SearchOptions`: Options for vector search
  - `VectorSearchResult`: Search result with similarity score

#### [`vector/embeddings.ts`](packages/core/src/vector/embeddings.ts)
**Purpose:** Embedding Generation Providers.
- **Exports:** `generateEmbedding`, `generateEmbeddings`, `normalizeVector`, `computeCosineSimilarity`, `createEmbeddingConfig`, `EmbeddingProviderBase`, `OpenAIEmbeddingProvider`, `CohereEmbeddingProvider`, `createEmbeddingProvider`, `DEFAULT_EMBEDDING_CONFIGS`, `validateEmbeddingDimensions`
- **Key Features:**
  - OpenAI embeddings provider (text-embedding-3-small, text-embedding-3-large, text-embedding-ada-002)
  - Cohere embeddings provider (embed-english-v3.0, embed-multilingual-v3.0)
  - Vector normalization utilities
  - Cosine similarity computation
  - Configurable embedding dimensions

#### [`vector/search.ts`](packages/core/src/vector/search.ts)
**Purpose:** Vector Similarity Search Functions.
- **Exports:** `VECTOR_OPERATORS`, `vectorDistance`, `cosineDistance`, `euclideanDistance`, `innerProductDistance`, `vectorSearch`, `createVectorIndex`
- **Key Features:**
  - pgvector operator mappings for PostgreSQL
  - Cosine distance calculation
  - Euclidean distance calculation
  - Inner product calculation
  - Vector search with filtering and pagination
  - Drizzle ORM integration for type-safe queries

#### [`vector/index.ts`](packages/core/src/vector/index.ts)
**Purpose:** Vector Module - Main entry point.
- **Exports:** All types and functions from the vector module
- **Key Features:**
  - Unified API for embedding generation and vector search
  - Support for multiple embedding providers
  - Type-safe vector operations with Drizzle ORM

### branching/

Preview Environments module for creating isolated development branches.

#### [`branching/types.ts`](packages/core/src/branching/types.ts)
**Purpose:** Branching/Preview Environment Types.
- **Key Types:**
  - `BranchStatus`: Enum (ACTIVE, SLEEPING, DELETED)
  - `BranchConfig`: Configuration for a preview environment
  - `PreviewEnvironment`: Complete preview environment definition
  - `CreateBranchOptions`: Options for creating a new branch
  - `BranchingConfig`: Global branching configuration
  - `BranchOperationResult`: Result of branch operations
  - `BranchListResult`: List of branches with pagination

#### [`branching/database.ts`](packages/core/src/branching/database.ts)
**Purpose:** Database Branching for Preview Environments.
- **Exports:** `DatabaseBranching`, `createDatabaseBranching`, `buildBranchConfig`
- **Key Features:**
  - Creates isolated database copies for preview environments
  - Supports PostgreSQL database cloning
  - Manages connection strings for branch databases
  - Handles database cleanup on branch deletion

#### [`branching/storage.ts`](packages/core/src/branching/storage.ts)
**Purpose:** Storage Branching for Preview Environments.
- **Exports:** `StorageBranching`, `createStorageBranching`
- **Key Features:**
  - Creates isolated storage buckets for preview environments
  - Supports S3-compatible storage backends
  - Manages storage namespace per branch
  - Handles storage cleanup on branch deletion

#### [`branching/index.ts`](packages/core/src/branching/index.ts)
**Purpose:** Branching Module - Main Orchestration.
- **Exports:** `BranchManager`, `createBranchManager`, `getAllBranches`, `clearAllBranches`
- **Key Features:**
  - Orchestrates database and storage branching together
  - Creates and manages preview environments
  - Handles branch sleep/wake cycles
  - Provides unified API for branch operations

### auto-rest.ts

#### [`auto-rest.ts`](packages/core/src/auto-rest.ts)
**Purpose:** Automatic CRUD Route Generation from Drizzle Schema.
- **Exports:** `mountAutoRest`, `AutoRestOptions`, `DrizzleTable`, `DrizzleDB`
- **Key Features:**
  - Runtime route registration for all tables in schema
  - Auto-generates full CRUD operations
  - Configurable base path (default: /api)
  - Supports table exclusion
  - RLS enforcement option
  - Generated Routes:
    - `GET /api/:table` - List all rows (paginated)
    - `GET /api/:table/:id` - Get single row by ID
    - `POST /api/:table` - Insert new row
    - `PATCH /api/:table/:id` - Update existing row
    - `DELETE /api/:table/:id` - Delete row

### webhooks/

#### [`webhooks/index.ts`](packages/core/src/webhooks/index.ts)
**Purpose:** Webhook module exports.

#### [`webhooks/dispatcher.ts`](packages/core/src/webhooks/dispatcher.ts)
**Purpose:** WebhookDispatcher handles sending webhook payloads to configured endpoints.
- **Exports:** `WebhookDispatcher`
- **Key Types:** `RetryConfig`, `WebhookDeliveryLog`
- **Features:**
  - Handles webhook dispatch with retry logic
  - Tests webhooks by sending synthetic payload
  - Tracks delivery logs
  - Fire-and-forget pattern
  - Retry with exponential backoff

#### [`webhooks/integrator.ts`](packages/core/src/webhooks/integrator.ts)
**Purpose:** Connects WebhookDispatcher to realtime event emitter.
- **Exports:** `connectToRealtime`
- **Features:**
  - Listens for database change events
  - Bridges Phase 6 (Realtime WebSockets) with Phase 13 (Webhooks)
  - Handles 'db:change', 'db:insert', 'db:update', 'db:delete' events

#### [`webhooks/signer.ts`](packages/core/src/webhooks/signer.ts)
**Purpose:** Signs and verifies webhook payloads using HMAC-SHA256.
- **Exports:** `signPayload`, `verifySignature`
- **Features:**
  - Signs payload with secret using HMAC-SHA256
  - Verifies signatures using timing-safe comparison
  - Prevents timing attacks
  - Handles both string and object payloads

#### [`webhooks/startup.ts`](packages/core/src/webhooks/startup.ts)
**Purpose:** Initializes webhooks from configuration during server startup.
- **Exports:** `initializeWebhooks`
- **Key Features:**
  - Loads webhooks from BetterBase config
  - Resolves environment variable references
  - Creates webhook dispatcher
  - Connects to realtime emitter
  - Handles missing environment variables

#### [`webhooks/types.ts`](packages/core/src/webhooks/types.ts)
**Purpose:** Webhook configuration and payload types.
- **Key Types:**
  - `WebhookConfig`: Webhook configuration (id, table, events, url, secret, enabled)
  - `WebhookPayload`: Payload sent to webhook endpoint (id, webhook_id, table, type, record, old_record, timestamp)

---

## packages/client

`@betterbase/client` - TypeScript SDK for BetterBase backends (like `@supabase/supabase-js`).

### Client Modules

#### [`src/auth.ts`](packages/client/src/auth.ts)
**Purpose:** Authentication client for BetterAuth integration.
- **Exports:** `AuthClient`, `authClient`, `createAuthClientInstance`
- **Key Types:** `User`, `Session`, `StorageAdapter`
- **Features:**
  - Wraps BetterAuth client
  - Handles sign up, sign in, sign out, get session
  - Manages session token in localStorage
  - On auth state change callback
  - Fallback storage adapter
  - **New Authentication Methods:**
    - `sendMagicLink(email)` - Send magic link for passwordless login
    - `verifyMagicLink(email, code)` - Verify magic link code
    - `sendOtp(email)` - Send one-time password
    - `verifyOtp(email, code)` - Verify OTP code
    - `mfa.enable()` - Enable multi-factor authentication
    - `mfa.verify(code)` - Verify MFA code
    - `mfa.disable()` - Disable MFA
    - `mfa.challenge()` - Challenge MFA
    - `sendPhoneVerification(phone)` - Send phone verification SMS
    - `verifyPhone(phone, code)` - Verify phone number

#### [`src/client.ts`](packages/client/src/client.ts)
**Purpose:** Main BetterBase client constructor.
- **Exports:** `createClient`, `BetterBaseClient`
- **Key Types:** `BetterBaseConfig`
- **Features:**
  - Configuration validation with Zod
  - Initializes auth, realtime, and storage clients
  - Manages authentication state
  - Provides fetch method with authenticated headers
  - Query builder support

#### [`src/query-builder.ts`](packages/client/src/query-builder.ts)
**Purpose:** Chainable query builder for database operations.
- **Exports:** `QueryBuilder`
- **Key Types:** `QueryBuilderOptions`, `QueryOptions`
- **Methods:**
  - `select(fields)`: Select fields to retrieve
  - `eq(column, value)`: Add equality filter
  - `in(column, values)`: Add IN filter
  - `limit(count)`: Limit number of results
  - `offset(count)`: Offset results
  - `order(column, direction)`: Sort results
  - `execute()`: Execute query
  - `single(id)`: Get single record by ID
  - `insert(data)`: Insert new record
  - `update(id, data)`: Update record
  - `delete(id)`: Delete record

#### [`src/realtime.ts`](packages/client/src/realtime.ts)
**Purpose:** Real-time subscription client for database changes.
- **Exports:** `RealtimeClient`
- **Key Types:** `RealtimeCallback`, `RealtimeSubscription`, `RealtimeEvent`
- **Features:**
  - WebSocket-based realtime updates
  - Subscription management
  - Reconnect logic with exponential backoff
  - Event filtering
  - Supports INSERT, UPDATE, DELETE, and * (all) events

#### [`src/storage.ts`](packages/client/src/storage.ts)
**Purpose:** Storage client for file operations.
- **Exports:** `Storage`, `StorageBucketClient`
- **Key Types:** `UploadOptions`, `SignedUrlOptions`, `StorageFile`, `UploadResult`, `PublicUrlResult`, `SignedUrlResult`, `RemoveResult`
- **Features:**
  - Supabase-compatible storage API
  - Fluent `.from(bucket)` API
  - Upload, download, remove, list operations
  - Public URL and signed URL generation
  - Handles File, Blob, and ArrayBuffer inputs
  - Error handling with { data, error } pattern

#### [`src/types.ts`](packages/client/src/types.ts)
**Purpose:** TypeScript type definitions for client.
- **Exports:** All client types and interfaces

#### [`src/errors.ts`](packages/client/src/errors.ts)
**Purpose:** Client-side error classes.
- **Exports:** Custom error classes (AuthError, NetworkError, ValidationError, etc.)

#### [`src/index.ts`](packages/client/src/index.ts)
**Purpose:** Client package entry point.
- **Exports:** All public APIs from the client package

#### [`src/build.ts`](packages/client/src/build.ts)
**Purpose:** Build configuration for client package.

---

## packages/cli

Canonical `@betterbase/cli` implementation - the `bb` command-line tool.

### CLI Commands

#### [`commands/init.ts`](packages/cli/src/commands/init.ts)
**Purpose:** `bb init` command - scaffolds new BetterBase projects.
- **Exports:** `runInitCommand(options)` - main command function, `InitCommandOptions` - type
- **Key Functions:** `installDependencies()`, `initializeGitRepository()`, `buildPackageJson()`, `buildDrizzleConfig()`, `buildSchema()`, `buildMigrateScript()`, `buildDbIndex()`, `buildAuthMiddleware()`, `buildReadme()`, `buildRoutesIndex()`, `writeProjectFiles()`
- **Internal Deps:** `../utils/logger`, `../utils/prompts`
- **Usage Patterns:** Typically called by developers starting a new project. Uses interactive prompts to gather project name, database mode, and options. Creates a complete project structure with sensible defaults.
- **Implementation Details:** Uses Inquirer for interactive prompts, writes files synchronously using fs module. Supports three database modes: local (SQLite), neon (PostgreSQL), turso (LibSQL). Generates Zod-validated config. Implements file templating with template literals for code generation.
- **External Deps:** `inquirer`, `zod`, `chalk`
- **Cross-Ref:** [`packages/cli/src/utils/prompts.ts`](packages/cli/src/utils/prompts.ts), [`templates/base/`](templates/base/)

#### [`commands/dev.ts`](packages/cli/src/commands/dev.ts)
**Purpose:** `bb dev` command - watches schema/routes and regenerates context.
- **Exports:** `runDevCommand(projectRoot)` - returns cleanup function
- **Internal Deps:** `../utils/context-generator`, `../utils/logger`
- **Usage Patterns:** Runs during development to continuously regenerate `.betterbase-context.json` as files change.
- **Implementation Details:** Sets up file watchers on schema and routes directories, triggers context regeneration on changes. Returns cleanup function to stop watchers.
- **External Deps:** `bun`, `chalk`
- **Cross-Ref:** [`packages/cli/src/utils/context-generator.ts`](packages/cli/src/utils/context-generator.ts)

#### [`commands/migrate.ts`](packages/cli/src/commands/migrate.ts)
**Purpose:** `bb migrate` commands - generates and applies migrations with safety checks.
- **Exports:** `runMigrateCommand(options)` - main function, `MigrateCommandOptions` - type, `MigrationChange` - interface, `MigrationChangeType` - type
- **Key Functions:** `runDrizzleKit()`, `listSqlFiles()`, `analyzeMigration()`, `displayDiff()`, `confirmDestructive()`, `backupDatabase()`, `restoreBackup()`, `splitStatements()`, `collectChangesFromGenerate()`
- **Internal Deps:** `../constants`, `../utils/logger`, `../utils/prompts`
- **Usage Patterns:** Called during database schema changes. Generates migration files, optionally previews changes, applies with safety checks.
- **Implementation Details:** Wraps DrizzleKit for migration generation. Implements visual diff display with color-coded changes. Prompts for confirmation on destructive operations. Creates automatic backups before dangerous migrations. Parses SQL files to extract migration metadata.
- **External Deps:** `drizzle-orm`, `drizzle-kit`, `inquirer`, `chalk`, `zod`

#### [`commands/auth.ts`](packages/cli/src/commands/auth.ts)
**Purpose:** `bb auth setup` command - scaffolds BetterAuth integration.
- **Exports:** `runAuthSetupCommand(projectRoot)` - main function
- **Key Constants:** `AUTH_SCHEMA_BLOCK` - sessions/accounts tables SQL, `AUTH_ROUTE_FILE` - auth routes template, `AUTH_MIDDLEWARE_FILE` - requireAuth/optionalAuth middleware
- **Key Functions:** `appendIfMissing()`, `ensurePasswordHashColumn()`, `ensureAuthInConfig()`, `ensureEnvVar()`, `ensureRoutesIndexHook()`
- **Internal Deps:** `../utils/logger`
- **Usage Patterns:** Run after project initialization to add authentication. Modifies existing files to integrate BetterAuth.
- **Implementation Details:** Injects SQL schema blocks into existing schema file, adds auth routes to routes index, creates auth middleware. Uses file patching rather than full file generation for integration.
- **External Deps:** `better-auth`, `chalk`
- **Cross-Ref:** [`templates/auth/`](templates/auth/)

#### [`commands/generate.ts`](packages/cli/src/commands/generate.ts)
**Purpose:** `bb generate crud` command - generates CRUD routes for a table.
- **Exports:** `runGenerateCrudCommand(projectRoot, tableName)` - main function
- **Key Functions:** `toSingular()`, `schemaTypeToZod()`, `buildSchemaShape()`, `buildFilterableColumns()`, `buildFilterCoercers()`, `generateRouteFile()`, `updateMainRouter()`, `ensureRealtimeUtility()`, `ensureZodValidatorInstalled()`
- **Internal Deps:** `../utils/schema-scanner`, `../utils/logger`
- **Usage Patterns:** Called after creating a database table to auto-generate REST API routes. Saves developers from writing boilerplate CRUD code.
- **Implementation Details:** Scans Drizzle schema to understand table structure. Maps Drizzle column types to Zod schemas. Generates Hono routes with type-safe handlers. Updates route index to register new endpoints.
- **External Deps:** `zod`, `hono`, `drizzle-orm`, `chalk`
- **Cross-Ref:** [`packages/cli/src/utils/scanner.ts`](packages/cli/src/utils/scanner.ts)

#### [`commands/function.ts`](packages/cli/src/commands/function.ts)
**Purpose:** `bb function` command - manages serverless functions.
- **Exports:** Function management commands (create, deploy, list, invoke)
- **Key Functions:** Function deployment and bundling
- **Internal Deps:** `../utils/logger`, `../utils/prompts`
- **Usage Patterns:** Deploy and manage serverless functions.
- **Implementation Details:** Handles function bundling, deployment to edge, and invocation.
- **External Deps:** `chalk`, `inquirer`

#### [`commands/graphql.ts`](packages/cli/src/commands/graphql.ts)
**Purpose:** `bb graphql` command - GraphQL schema management.
- **Exports:** GraphQL schema generation and introspection commands
- **Key Functions:** Schema generation, SDL export
- **Internal Deps:** `../utils/logger`, `../utils/prompts`
- **Usage Patterns:** Generate GraphQL schema from database, export SDL.
- **Implementation Details:** Uses Drizzle introspection to generate GraphQL types.
- **External Deps:** `chalk`, `inquirer`

#### [`commands/login.ts`](packages/cli/src/commands/login.ts)
**Purpose:** `bb login` command - authenticate with BetterBase cloud.
- **Exports:** `runLoginCommand(options)` - main function
- **Internal Deps:** `../utils/logger`
- **Usage Patterns:** Authenticate to BetterBase to access cloud features.
- **Implementation Details:** Handles OAuth flow or API key authentication.
- **External Deps:** `chalk`

#### [`commands/rls.ts`](packages/cli/src/commands/rls.ts)
**Purpose:** `bb rls` command - Row Level Security management.
- **Exports:** RLS policy management commands
- **Key Functions:** Policy creation, enable/disable RLS
- **Internal Deps:** `../utils/logger`
- **Usage Patterns:** Manage RLS policies for tables.
- **Implementation Details:** Generates RLS policies based on table structure.
- **External Deps:** `chalk`, `drizzle-orm`

#### [`commands/storage.ts`](packages/cli/src/commands/storage.ts)
**Purpose:** `bb storage` command - storage bucket management.
- **Exports:** Storage bucket management commands
- **Key Functions:** Bucket CRUD operations, policy management
- **Internal Deps:** `../utils/logger`, `../utils/prompts`
- **Usage Patterns:** Manage storage buckets and files.
- **Implementation Details:** Integrates with S3-compatible storage.
- **External Deps:** `chalk`, `inquirer`

#### [`commands/webhook.ts`](packages/cli/src/commands/webhook.ts)
**Purpose:** `bb webhook` command - webhook management.
- **Exports:** Webhook lifecycle management commands
- **Key Functions:** Webhook creation, testing, logging
- **Internal Deps:** `../utils/logger`
- **Usage Patterns:** Register and manage webhooks for database events.
- **Implementation Details:** Handles webhook registration and event dispatch.
- **External Deps:** `chalk`

#### [`commands/branch.ts`](packages/cli/src/commands/branch.ts)
**Purpose:** `bb branch` command - Preview Environment management.
- **Exports:** `runBranchCreateCommand`, `runBranchDeleteCommand`, `runBranchListCommand`, `runBranchStatusCommand`, `runBranchWakeCommand`, `runBranchSleepCommand`
- **Key Functions:**
  - `runBranchCreateCommand` - Creates a new preview environment
  - `runBranchDeleteCommand` - Deletes a preview environment
  - `runBranchListCommand` - Lists all preview environments
  - `runBranchStatusCommand` - Checks branch status
  - `runBranchWakeCommand` - Wakes a sleeping preview
  - `runBranchSleepCommand` - Puts a preview to sleep
- **Key Features:**
  - `bb branch create <name>` - Create preview environment
  - `bb branch delete <name>` - Delete preview environment
  - `bb branch list` - List all preview environments
  - `bb branch status <name>` - Check branch status
  - `bb branch wake <name>` - Wake sleeping preview
  - `bb branch sleep <name>` - Sleep preview
- **Internal Deps:** `../utils/logger`, `@betterbase/shared`, `@betterbase/core/branching`
- **Usage Patterns:** Manage preview environments for development branches.
- **External Deps:** `chalk`

### CLI Utilities

#### [`utils/logger.ts`](packages/cli/src/utils/logger.ts)
**Purpose:** Colored console logging utilities.
- **Exports:** `info(message)`, `warn(message)`, `error(message)`, `success(message)`
- **Internal Deps:** `chalk`
- **Usage Patterns:** Used throughout CLI commands for consistent, colored output.
- **Implementation Details:** Thin wrapper around Chalk with pre-configured color schemes. Info = cyan, Warn = yellow, Error = red, Success = green.
- **External Deps:** `chalk`

#### [`utils/prompts.ts`](packages/cli/src/utils/prompts.ts)
**Purpose:** Interactive prompt utilities wrapping Inquirer.
- **Exports:** `text(options)`, `confirm(options)`, `select(options)`
- **Internal Deps:** `inquirer`, `zod`
- **Usage Patterns:** Used by CLI commands that need user input during execution.
- **Implementation Details:** Wraps Inquirer with Zod validation on input. Provides typed promise-based API.
- **External Deps:** `inquirer`, `zod`

#### [`utils/context-generator.ts`](packages/cli/src/utils/context-generator.ts)
**Purpose:** Generates `.betterbase-context.json` for AI agents.
- **Exports:** `ContextGenerator` - class, `BetterBaseContext` - interface
- **Class Methods:** `generate(projectRoot)` - main method, `generateAIPrompt()` - creates AI-readable prompt
- **Internal Deps:** `./route-scanner`, `./schema-scanner`, `./logger`
- **Usage Patterns:** Called during `bb dev` or `bb generate` to create context file. Used by AI assistants to understand the project structure.
- **Implementation Details:** Scans schema and routes, aggregates metadata, outputs JSON file with tables, routes, and AI-readable prompt. The AI prompt helps contextualize the project for LLM-based development assistance.
- **External Deps:** `typescript`, `zod`, `chalk`
- **Cross-Ref:** [`packages/cli/src/utils/route-scanner.ts`](packages/cli/src/utils/route-scanner.ts), [`packages/cli/src/utils/scanner.ts`](packages/cli/src/utils/scanner.ts)

#### [`utils/route-scanner.ts`](packages/cli/src/utils/route-scanner.ts)
**Purpose:** Scans Hono routes directory and extracts endpoint metadata.
- **Exports:** `RouteScanner` - class, `RouteInfo` - interface
- **Class Methods:** `scan(routesDir)` - main method, `scanFile()` - parses single file, `findSchemaUsage()` - detects Zod schemas
- **Internal Deps:** `typescript` (TS AST parser)
- **Usage Patterns:** Used by context generator to discover all API endpoints in the project.
- **Implementation Details:** Uses TypeScript compiler API to parse route files. Extracts HTTP method, path, auth requirements, and Zod schemas. Handles Hono's chainable API pattern detection.
- **External Deps:** `typescript`

#### [`utils/scanner.ts`](packages/cli/src/utils/scanner.ts)
**Purpose:** Scans Drizzle schema files and extracts table metadata.
- **Exports:** `SchemaScanner` - class, `ColumnInfo` - type, `TableInfo` - type, `ColumnInfoSchema`, `TableInfoSchema`, `TablesRecordSchema` - Zod schemas
- **Class Methods:** `scan()` - main method, `parseTable()`, `parseColumn()`, `parseIndexes()`
- **Internal Deps:** `typescript`, `zod`, `./logger`
- **Usage Patterns:** Used by generate command and context generator to understand database schema.
- **Implementation Details:** Parses TypeScript schema files using TypeScript compiler API. Extracts table names, column definitions, relations, indexes. Returns typed metadata for code generation.
- **External Deps:** `typescript`, `zod`

#### [`utils/schema-scanner.ts`](packages/cli/src/utils/schema-scanner.ts)
**Purpose:** Re-exports from scanner.ts for cleaner imports.
- **Exports:** `SchemaScanner` - class (re-export), `ColumnInfo` - type (re-export), `TableInfo` - type (re-export)
- **Usage Patterns:** Import point for schema scanning functionality.
- **External Deps:** None (re-exports)

#### [`utils/provider-prompts.ts`](packages/cli/src/utils/provider-prompts.ts)
**Purpose:** Database provider selection prompts.
- **Exports:** Provider selection utilities
- **Usage Patterns:** Used by init command to select database provider.
- **Implementation Details:** Provides interactive selection for database providers (PostgreSQL, MySQL, SQLite).
- **External Deps:** `inquirer`

### CLI Tests

#### [`test/smoke.test.ts`](packages/cli/test/smoke.test.ts)
**Purpose:** Basic CLI tests verifying command registration.
- **Tests:** Program name, init argument, generate crud, auth setup, dev, migrate commands
- **Usage Patterns:** Smoke tests run in CI to verify CLI is functional after changes.

#### [`test/scanner.test.ts`](packages/cli/test/scanner.test.ts)
**Purpose:** Tests for SchemaScanner.
- **Tests:** Extracts tables, columns, relations, indexes from Drizzle schema
- **Usage Patterns:** Unit tests for scanner module.

#### [`test/context-generator.test.ts`](packages/cli/test/context-generator.test.ts)
**Purpose:** Tests for ContextGenerator.
- **Tests:** Creates context from schema/routes, handles missing routes, empty schema, missing schema
- **Usage Patterns:** Unit tests for context generation.

#### [`test/route-scanner.test.ts`](packages/cli/test/route-scanner.test.ts)
**Purpose:** Tests for RouteScanner.
- **Tests:** Extracts Hono routes with auth detection and schema usage
- **Usage Patterns:** Unit tests for route scanning.

---

## templates/base

Bun + Hono + Drizzle starter template.

### Template Files

#### [`src/index.ts`](templates/base/src/index.ts)
**Purpose:** Main server entry point.
- **Key Features:**
  - Initializes Hono app
  - Sets up WebSocket server for realtime
  - Registers routes
  - Mounts auth handler
  - Enables GraphQL API if configured
  - Initializes webhooks
  - Starts server
  - Handles shutdown signals

#### [`src/db/schema.ts`](templates/base/src/db/schema.ts)
**Purpose:** Database schema definitions using Drizzle ORM.
- **Key Features:**
  - User and posts tables
  - Helper functions for timestamps, UUID, soft delete, status enum, money column, JSON column
  - BetterAuth tables (user, session, account, verification)

#### [`src/routes/index.ts`](templates/base/src/routes/index.ts)
**Purpose:** Main route registration file.
- **Key Features:**
  - CORS middleware
  - Logger middleware
  - Error handler
  - Health check endpoint
  - Users API routes
  - Storage API routes

#### [`src/routes/storage.ts`](templates/base/src/routes/storage.ts)
**Purpose:** Storage API routes.
- **Key Features:**
  - List files in bucket
  - Delete files
  - Upload file
  - Download file
  - Get public URL
  - Create signed URL
  - Authentication middleware
  - Request validation with Zod
  - Path sanitization
  - Storage configuration from environment variables

#### [`src/lib/realtime.ts`](templates/base/src/lib/realtime.ts)
**Purpose:** Realtime server implementation.
- **Key Features:**
  - WebSocket server for realtime updates
  - Client management
  - Subscription management
  - Event broadcasting
  - Filtering
  - Rate limiting
  - Authentication and authorization
  - Connection limits

#### [`betterbase.config.ts`](templates/base/betterbase.config.ts)
**Purpose:** BetterBase project configuration.

#### [`drizzle.config.ts`](templates/base/drizzle.config.ts)
**Purpose:** Drizzle ORM configuration.

#### [`package.json`](templates/base/package.json)
**Purpose:** Project dependencies and scripts.

---

## templates/auth

Auth template with BetterAuth integration.

### Template Files

#### [`src/routes/auth.ts`](templates/auth/src/routes/auth.ts)
**Purpose:** Authentication API routes.

#### [`src/db/auth-schema.ts`](templates/auth/src/db/auth-schema.ts)
**Purpose:** BetterAuth database schema.

---

## Usage Examples

### Client SDK

```typescript
import { createClient } from '@betterbase/client';

const client = createClient({
  url: 'http://localhost:3000',
  key: 'your-api-key',
});

// Authenticate user
const { data, error } = await client.auth.signIn('user@example.com', 'password123');

if (error) {
  console.error('Sign in failed:', error);
} else {
  console.log('User signed in:', data?.user);
}

// Query data
const users = await client.from('users').select('*').execute();
console.log('Users:', users);

// Upload file
const file = new File(['hello world'], 'test.txt', { type: 'text/plain' });
const uploadResult = await client.storage.from('bucket').upload('test.txt', file);
console.log('Upload result:', uploadResult);

// Subscribe to realtime updates
const subscription = client.realtime.from('posts').on('INSERT', (payload) => {
  console.log('New post:', payload);
}).subscribe();

// Cleanup subscription
subscription.unsubscribe();
```

### Server-Side with Hono

```typescript
import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { auth } from './auth';
import { db } from './db';
import { users } from './db/schema';

const app = new Hono();

// Protected route
app.get('/api/protected', async (c) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const userPosts = await db.select().from(users)
    .where(eq(users.id, session.user.id));

  return c.json(userPosts);
});

export default app;
```

### RLS Policy Definition

```typescript
// src/db/policies/users.policy.ts
import { definePolicy } from '@betterbase/core/rls';

export default definePolicy('users', {
  select: 'auth.uid() = id',
  update: 'auth.uid() = id',
  delete: 'auth.uid() = id',
  insert: 'auth.uid() = id',
});
```

---

## Architecture Decisions

### Authentication
- **Choice:** BetterAuth for password and social authentication
- **Rationale:** Lightweight, extensible, and compatible with Drizzle ORM

### Database
- **Choice:** Drizzle ORM for database abstraction
- **Rationale:** Type-safe, composable, and supports multiple dialects

### Storage
- **Choice:** S3-compatible storage with AWS SDK v3
- **Rationale:** Wide support, compatibility with multiple providers

### Realtime
- **Choice:** WebSocket-based realtime using Bun's WebSocket API
- **Rationale:** Fast, lightweight, and built into Bun runtime

### GraphQL
- **Choice:** graphql-yoga for server, GraphQL.js for schema
- **Rationale:** Simple setup, good integration with Hono

### Validation
- **Choice:** Zod for schema validation
- **Rationale:** Type-safe, easy to use, and integrates well with TypeScript

### CLI
- **Choice:** Commander.js for CLI framework
- **Rationale:** Mature, lightweight, and well-documented

---

## Development Workflow

### Creating a New Project

```bash
# Initialize new project
bb init

# Answer prompts for project name, database provider, etc.

# Navigate to project directory
cd my-project

# Install dependencies
bun install

# Start development server
bun run dev
```

### Adding Authentication

```bash
# Add BetterAuth integration
bb auth setup

# Run database migrations
bun run db:push

# Set auth secret in .env
echo "AUTH_SECRET=your-secret-key" >> .env
```

### Generating CRUD Routes

```bash
# Generate CRUD routes for a table
bb generate crud posts

# Run GraphQL schema generation
bb graphql generate
```

### Migrating Database

```bash
# Generate and apply migrations
bb migrate

# Preview migration without applying
bb migrate preview

# Apply migrations to production
bb migrate production
```

---

## API Reference

### Client SDK

#### `createClient(config)`
```typescript
const client = createClient({
  url: string;
  key?: string;
  schema?: string;
  fetch?: typeof fetch;
  storage?: StorageAdapter;
});
```

#### `client.auth`
```typescript
client.auth.signUp(email: string, password: string, name: string): Promise<BetterBaseResponse<{ user: User; session: Session }>>;
client.auth.signIn(email: string, password: string): Promise<BetterBaseResponse<{ user: User; session: Session }>>;
client.auth.signOut(): Promise<BetterBaseResponse<null>>;
client.auth.getSession(): Promise<BetterBaseResponse<{ user: User; session: Session }>>;
client.auth.getToken(): string | null;
client.auth.setToken(token: string | null): void;
```

#### `client.from(table)`
```typescript
const query = client.from('users');
query.select(fields?: string): this;
query.eq(column: string, value: unknown): this;
query.in(column: string, values: unknown[]): this;
query.limit(count: number): this;
query.offset(count: number): this;
query.order(column: string, direction?: 'asc' | 'desc'): this;
query.execute(): Promise<BetterBaseResponse<T[]>>;
query.single(id: string): Promise<BetterBaseResponse<T>>;
query.insert(data: Partial<T>): Promise<BetterBaseResponse<T>>;
query.update(id: string, data: Partial<T>): Promise<BetterBaseResponse<T>>;
query.delete(id: string): Promise<BetterBaseResponse<T>>;
```

#### `client.realtime`
```typescript
client.realtime.from(table: string): {
  on: <T = unknown>(
    event: RealtimeEvent,
    callback: RealtimeCallback<T>,
  ) => {
    subscribe: (filter?: Record<string, unknown>) => RealtimeSubscription;
  };
};
```

#### `client.storage`
```typescript
client.storage.from(bucket: string): StorageBucketClient;
```

#### `StorageBucketClient`
```typescript
bucket.upload(path: string, file: File | Blob | ArrayBuffer, options?: UploadOptions): Promise<BetterBaseResponse<UploadResult>>;
bucket.download(path: string): Promise<BetterBaseResponse<Blob>>;
bucket.getPublicUrl(path: string): Promise<BetterBaseResponse<PublicUrlResult>>;
bucket.createSignedUrl(path: string, options?: SignedUrlOptions): Promise<BetterBaseResponse<SignedUrlResult>>;
bucket.remove(paths: string[]): Promise<BetterBaseResponse<RemoveResult>>;
bucket.list(prefix?: string): Promise<BetterBaseResponse<StorageFile[]>>;
```

---

## Server-Side API

### Hono App

```typescript
import { Hono } from 'hono';

const app = new Hono();

// Health check
app.get('/health', (c) => {
  return c.json({ status: 'ok' });
});

// Protected route
app.get('/protected', requireAuth, (c) => {
  const user = c.get('user');
  return c.json({ user });
});

// Error handler
app.onError((err, c) => {
  return c.json({ error: err.message }, 500);
});

export default app;
```

### Auth Middleware

```typescript
import { requireAuth, optionalAuth } from './middleware/auth';

// Example 1: Require authentication for all routes
app.use('*', requireAuth);

// Example 2: Optional authentication (mutually exclusive - use one or the other)
// app.use('*', optionalAuth);

// Get user from context
const user = c.get('user');
```

> **Note:** `requireAuth` and `optionalAuth` are mutually exclusive choices for route protection. Use `app.use('*', requireAuth)` for mandatory authentication, or `app.use('*', optionalAuth)` for optional authentication.

### Realtime Broadcast

```typescript
import { realtime } from './lib/realtime';

// Broadcast event
realtime.broadcast('posts', 'INSERT', {
  id: '1',
  title: 'New Post',
  content: 'Hello World',
  createdAt: new Date(),
});
```

---

## Configuration

### Project Configuration (`betterbase.config.ts`)

```typescript
import { defineConfig } from '@betterbase/core';

export default defineConfig({
  project: {
    name: 'my-project',
  },
  provider: {
    type: 'neon',
    connectionString: process.env.DATABASE_URL,
  },
  storage: {
    provider: 's3',
    bucket: 'my-bucket',
    region: 'us-east-1',
    accessKeyId: process.env.STORAGE_ACCESS_KEY_ID,
    secretAccessKey: process.env.STORAGE_SECRET_ACCESS_KEY,
  },
  webhooks: [
    {
      id: 'new-post',
      table: 'posts',
      events: ['INSERT'],
      url: process.env.WEBHOOK_URL,
      secret: process.env.WEBHOOK_SECRET,
      enabled: true,
    },
  ],
  graphql: {
    enabled: true,
  },
});
```

### Environment Variables

```bash
# Database
DATABASE_URL="postgres://user:password@localhost:5432/mydb"
TURSO_URL="https://mydb.turso.io"
TURSO_AUTH_TOKEN="my-turso-token"

# Auth
AUTH_SECRET="your-auth-secret"
AUTH_URL="http://localhost:3000"

# Storage
STORAGE_PROVIDER="s3"
STORAGE_BUCKET="my-bucket"
STORAGE_REGION="us-east-1"
STORAGE_ACCESS_KEY_ID="my-access-key"
STORAGE_SECRET_ACCESS_KEY="my-secret-key"

# Webhooks
WEBHOOK_URL="https://example.com/webhook"
WEBHOOK_SECRET="my-webhook-secret"

# Server
PORT=3000
NODE_ENV="development"
```

---

## Testing

### Running Tests

```bash
# Run all tests
bun test

# Run tests in watch mode
bun test --watch

# Run specific test file
bun test packages/cli/test/smoke.test.ts
```

### Test Structure

Tests are located in the `test/` directory of each package. The test files follow the pattern `*.test.ts`.

---

## Contributing

### Development Setup

```bash
# Clone repository
git clone <repository-URL>
cd betterbase

# Install dependencies
bun install

# Build packages
bun run build

# Run tests
bun test
```

### Development Workflow

1. Create a new branch
2. Make changes to the codebase
3. Run tests
4. Commit changes
5. Push to remote repository
6. Create a pull request

---

## License

BetterBase is released under the MIT license.
