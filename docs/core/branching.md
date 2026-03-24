# Branching Module

Preview environment system for creating isolated database branches for feature development and testing.

## Table of Contents
- [Overview](#overview)
- [Features](#features)
- [Installation](#installation)
- [Usage](#usage)
- [API Reference](#api-reference)
  - [Configuration](#configuration)
  - [Database Operations](#database-operations)
  - [Storage Operations](#storage-operations)
  - [Types](#types)
- [Workflow Examples](#workflow-examples)
- [Best Practices](#best-practices)

## Overview

The Branching module enables preview environments by creating isolated database branches that copy schema and optionally data from a parent database. This allows developers to test features, run migrations, and experiment without affecting the main database.

Key capabilities:
- Create/destroy database branches on-demand
- Copy schema from parent database
- Optional data cloning for realistic testing
- Automatic cleanup based on TTL or manual deletion
- Storage isolation for file uploads
- Webhook and real-time isolation per branch
- Integration with Vercel-style preview deployments

## Features

### Database Branching
- **Schema Cloning**: Replicates table structure, indexes, and constraints
- **Optional Data Cloning**: Copy production/staging data for realistic testing
- **Migration Isolation**: Run migrations on branches without affecting parent
- **Branch Metadata**: Track creation time, parent branch, and TTL
- **Automatic Cleanup**: Expire branches based on time-to-live settings

### Storage Branching
- **Bucket Isolation**: Separate storage buckets per branch
- **Policy Replication**: Copy storage policies from parent
- **Selective Cloning**: Option to clone existing files
- **Automatic Cleanup**: Remove branch storage when branch is destroyed

### Configuration-Driven
- **Declarative Setup**: Define branching behavior in BetterBase config
- **Provider Support**: Works with all supported database providers
- **Limits & Quotas**: Control number of concurrent previews
- **Sleep Timeout**: Automatically suspend inactive branches to save costs

### Development Workflow Integration
- **Preview URLs**: Generate unique URLs for each branch
- **Environment Variables**: Isolated env vars per branch
- **CI/CD Integration**: Hook into preview deployment systems
- **Git Branch Mapping**: Automatically create branches for Git branches

## Installation

The Branching module is part of `@betterbase/core`:
```bash
bun add @betterbase/core
```

## Usage

### Basic Configuration
```typescript
import { defineConfig } from '@betterbase/core';

const config = defineConfig({
  project: { name: 'my-app' },
  provider: { 
    type: 'postgres',
    connectionString: process.env.DATABASE_URL 
  },
  branching: {
    enabled: true,
    maxPreviews: 10,
    defaultSleepTimeout: 3600, // 1 hour
    storageEnabled: true
  }
});
```

### Creating a Branch (via CLI or API)
```bash
# Using BetterBase CLI
bunx betterbase branch create feature/new-feature --parent main

# Or specify source branch
bunx betterbase branch create feature/bugfix --parent staging
```

### Using Branches in Application
```typescript
import { getBranchConfig } from '@betterbase/core/branching';

// Get configuration for current branch
const branchConfig = getBranchConfig();
// Returns config with branch-specific:
// - database connection string
// - storage bucket name
// - webhook URLs
// - environment variables
```

## API Reference

### Configuration
Branching configuration is defined in the main BetterBase config.

#### Branching Options
```typescript
export interface BranchingConfig {
  /** Enable/disable branching (default: true) */
  enabled?: boolean;
  
  /** Maximum number of concurrent preview branches (default: 10) */
  maxPreviews?: number;
  
  /** Default sleep timeout in seconds for inactive branches (default: 3600s/1h) */
  defaultSleepTimeout?: number;
  
  /** Enable storage branching (default: true) */
  storageEnabled?: boolean;
  
  /** Automatically delete branches older than this (in seconds) */
  autoDeleteAfter?: number;
  
  /** Default strategy for data cloning: 'none', 'schema-only', 'full' */
  defaultCloneStrategy?: 'none' | 'schema-only' | 'full';
}
```

### Database Operations
Low-level database branching operations.

#### createBranch
```typescript
export async function createBranch(
  branchName: string,
  parentBranch: string,
  options: {
    cloneData?: boolean; // Default: false
    schemaOnly?: boolean; // Deprecated: use cloneData: false
    ttlSeconds?: number; // Time to live
    metadata?: Record<string, unknown>;
  }
): Promise<BranchInfo>
```

#### getBranch
```typescript
export async function getBranch(branchName: string): Promise<BranchInfo | null>
```

#### listBranches
```typescript
export async function listBranches(
  filter?: {
    status?: 'active' | 'sleeping' | 'deleted';
    createdAfter?: Date;
    createdBefore?: Date;
  }
): Promise<BranchInfo[]>
```

#### deleteBranch
```typescript
export async function deleteBranch(branchName: string): Promise<boolean>
```

#### wakeBranch
```typescript
export async function wakeBranch(branchName: string): Promise<boolean>
```

#### sleepBranch
```typescript
export async function sleepBranch(branchName: string): Promise<boolean>
```

### Storage Operations
Storage-specific branching functionality.

#### getBranchStorageConfig
```typescript
export function getBranchStorageConfig(
  branchName: string,
  parentConfig: StorageConfig
): StorageConfig
```
Returns storage configuration with branch-specific bucket/path.

#### cloneBranchStorage
```typescript
export async function cloneBranchStorage(
  branchName: string,
  parentBranch: string,
  options: {
    prefix?: string; // Optional prefix for cloned files
    include?: string[]; // Glob patterns to include
    exclude?: string[]; // Glob patterns to exclude
    maxConcurrent?: number; // Default: 5
  }
): Promise<StorageCloneResult>
```

### Types
Exported TypeScript types and interfaces.

#### BranchInfo
```typescript
export interface BranchInfo {
  /** Unique branch identifier */
  name: string;
  
  /** Parent branch name */
  parent: string;
  
  /** Current status: 'active', 'sleeping', 'deleted' */
  status: BranchStatus;
  
  /** Creation timestamp */
  createdAt: Date;
  
  /** Last accessed timestamp */
  lastAccessedAt: Date;
  
  /** Scheduled deletion time (if applicable) */
  expiresAt?: Date;
  
  /** Custom metadata */
  metadata: Record<string, unknown>;
  
  /** Database connection info */
  database: {
    connectionString: string;
    /** For Turso: libSQL URL */
    url?: string;
    /** For Turso: auth token */
    authToken?: string;
  };
  
  /** Storage configuration */
  storage: {
    bucket: string;
    region?: string;
    endpoint?: string;
  };
  
  /** Webhook configuration */
  webhooks: Array<{
    id: string;
    table: string;
    events: ('INSERT' | 'UPDATE' | 'DELETE')[];
    url: string;
    secret: string;
    enabled: boolean;
  }>;
}
```

#### BranchStatus
```typescript
export type BranchStatus = 'active' | 'sleeping' | 'deleted';
```

#### StorageCloneResult
```typescript
export interface StorageCloneResult {
  /** Number of files successfully cloned */
  filesCloned: number;
  
  /** Total size cloned in bytes */
  bytesCloned: number;
  
  /** Any errors encountered during cloning */
  errors: Array<{
    file: string;
    error: string;
  }>;
  
  /** Duration of cloning operation in milliseconds */
  durationMs: number;
}
```

## Workflow Examples

### Feature Development Workflow
1. Developer creates feature branch in Git: `git checkout -b feature/new-payment-method`
2. CI system detects new branch and triggers preview deployment
3. Preview deployment runs: `bunx betterbase branch create feature/new-payment-method --parent main`
4. Application starts with branch-specific configuration:
   - Database: `feature_new_payment_method` database
   - Storage: `feature-new-payment-method-uploads` bucket
   - Environment: Isolated env vars
5. Developer tests feature against realistic data
6. When PR is merged: `bunx betterbase branch delete feature/new-payment-method`
7. Branch and all associated resources are cleaned up

### Review App Workflow
1. PR opened: `feature/user-profile-update`
2. Preview environment automatically provisioned:
   - Database branch cloned from `staging` with production-like data
   - Storage bucket with sample files
   - Unique preview URL: `https://feature-user-profile-update--myapp.preview.betterbase.dev`
3. QA team tests against preview environment
4. PR updated with new commits: Preview automatically refreshed
5. PR merged or closed: Preview environment destroyed

### Data Migration Testing
1. Create migration branch: `bunx betterbase branch create migration/test-v2 --parent main --clone-data`
2. Run migration scripts against branch
3. Validate results and performance
4. Adjust migration as needed
5. Delete test branch: `bunx betterbase branch delete migration/test-v2`

## Best Practices

### Branch Naming Conventions
- Use descriptive names: `feature/user-auth`, `bugfix/login-issue`
- For temporary testing: `test/perf-test-$(date +%s)`
- For long-running branches: `env/staging`, `env/production-preview`
- Avoid special characters that may cause issues in DNS or database names

### Data Cloning Strategies
- **Development**: `cloneData: false` (schema only) for fast branch creation
- **QA/Staging**: `cloneData: true` with limited dataset for realistic testing
- **Performance Testing**: `cloneData: true` with full dataset for load testing
- **Sensitive Data**: Implement data masking or subset cloning for PII

### Resource Management
- Set appropriate `maxPreviews` to prevent resource exhaustion
- Configure `defaultSleepTimeout` to balance cost vs. responsiveness
- Use `autoDeleteAfter` to automatically clean up forgotten branches
- Monitor storage usage per branch to prevent unexpected costs

### Security Considerations
- Ensure branch names are validated to prevent injection attacks
- Isolate environment variables between branches
- Apply same security policies to branches as parent (network, IAM, etc.)
- Consider encrypting branch storage if parent storage is encrypted
- Audit branch creation/deletion for compliance

### Integration with CI/CD
- Use branch-specific environment variables for configuration
- Pass branch name as environment variable to preview deployments
- Implement webhook triggers for branch lifecycle events
- Cache dependencies between branch refreshes to speed up builds

## Limitations & Considerations

### Provider Support
- **PostgreSQL**: Full support via `CREATE DATABASE` with `TEMPLATE` option
- **MySQL/MariaDB**: Support via `CREATE DATABASE ... LIKE` and `mysqldump`
- **SQLite**: File-copy based branching (limited concurrency)
- **PlanetScale**: Uses native branching API
- **Turso**: Uses libSQL branching capabilities
- **Supabase**: Uses PostgreSQL branching under the hood
- **Managed/External**: Requires custom implementation or manual setup

### Performance Implications
- Schema-only branches: Very fast creation (milliseconds)
- Full data clone: Proportional to database size
- Storage cloning: Depends on number and size of files
- Active branches consume resources proportionally to their usage

### Consistency Guarantees
- Branches are point-in-time snapshots
- No automatic synchronization with parent
- For real-time sync, consider logical replication or custom solutions
- Write conflicts possible if multiple branches modify same data

### Storage Limitations
- Object storage branching depends on provider capabilities
- Some providers may not support bucket-level operations efficiently
- Consider using prefixes instead of separate buckets for cost optimization
- Lifecycle policies should be replicated to branch buckets

## Related Modules
- [Configuration](./config.md): For defining branching behavior in BetterBase config
- [Providers](./providers.md): For database provider-specific branching implementation details
- [Storage](./storage.md): For storage branching and policy replication
- [Webhooks](./webhooks.md): For webhook isolation per branch
- [Realtime](./realtime.md): For real-time channel isolation per branch
- [Auto-REST](./auto-rest.md): For automatic API generation in branch environments