# Migration

BetterBase provides database migration utilities for managing schema changes and Row Level Security (RLS) policies.

## Overview

The migration module provides:
- **RLS Policy Migration**: Apply and manage Row Level Security policies
- **Schema Migration**: Database schema version management via Drizzle

## RLS Migration

### Purpose

RLS migration applies Row Level Security policies to the database. It handles:
- Creating auth.uid() function for PostgreSQL
- Applying RLS policies to tables
- Idempotent operations (safe to run multiple times)

### Usage

```typescript
import { applyRLSMigration, getAppliedPolicies } from '@betterbase/core/migration';
import { db } from './db';

// Apply all RLS policies
await applyRLSMigration(db);

// Check applied policies
const policies = await getAppliedPolicies(db);
console.log(policies);
```

### Functions

| Function | Description |
|-----------|-------------|
| `applyAuthFunction(db)` | Creates auth.uid() function in database |
| `applyPolicies(db, policies)` | Applies RLS policies to tables |
| `dropPolicies(db, table)` | Removes all policies from a table |
| `dropTableRLS(db, table)` | Disables RLS on a table |
| `getAppliedPolicies(db)` | Returns list of applied policies |
| `applyRLSMigration(db)` | Applies complete RLS migration |

### Idempotent Operations

All migration functions are idempotent:
- `applyAuthFunction()` can be called multiple times
- `applyPolicies()` won't error if policy exists
- Safe to include in CI/CD pipelines

### Policy Definition

Define policies in policy files:

```typescript
// src/db/policies/users.policy.ts
import { definePolicy } from '@betterbase/core/rls';

export default definePolicy('users', {
  select: 'auth.uid() = id',
  insert: 'auth.uid() = id',
  update: 'auth.uid() = id',
  delete: 'auth.uid() = id',
});
```

## Schema Migration

### Drizzle Migrations

BetterBase uses Drizzle Kit for schema migrations:

```bash
# Generate migration from schema changes
bb migrate

# Preview migration
bb migrate preview

# Apply to production
bb migrate production

# Rollback
bb migrate rollback
```

### Manual Migration

```typescript
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { db } from './db';

await migrate(db, { migrationsFolder: './drizzle' });
```

## CLI Commands

### bb migrate

Generate and apply migrations:

```bash
# Generate and apply to local database
bb migrate

# Preview changes without applying
bb migrate preview

# Apply to production (with confirmation)
bb migrate production

# Rollback last migration
bb migrate rollback

# Show migration history
bb migrate history
```

## Best Practices

1. **Version Control**: Keep migrations in version control
2. **Idempotent**: Write migrations that can run multiple times
3. **Test First**: Preview migrations before applying
4. **Backup**: Backup production database before migrations
5. **Atomic**: Keep migrations small and focused

## Related

- [Overview](./overview.md) - Core package overview
- [RLS](../features/rls.md) - Row Level Security features
- [Database](../features/database.md) - Database configuration