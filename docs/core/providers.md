# Database Providers

BetterBase supports multiple database providers for different deployment scenarios.

## Overview

The providers module provides adapter implementations for:
- **PostgreSQL**: Standard PostgreSQL
- **Neon**: Serverless PostgreSQL
- **MySQL**: Standard MySQL
- **PlanetScale**: Serverless MySQL
- **Turso**: libSQL for edge
- **Supabase**: Supabase-compatible

## Supported Providers

| Provider | Type | Best For |
|----------|------|----------|
| `postgres` | Standard | Production deployments |
| `neon` | Serverless | Serverless applications |
| `mysql` | Standard | Legacy applications |
| `planetscale` | Serverless | Serverless MySQL |
| `turso` | Edge | Edge deployments |
| `supabase` | Compatible | Supabase users |

## Configuration

### PostgreSQL

```typescript
import { defineConfig } from '@betterbase/core';

export default defineConfig({
  provider: {
    type: 'postgres',
    connectionString: process.env.DATABASE_URL
  }
});
```

### Neon

```typescript
export default defineConfig({
  provider: {
    type: 'neon',
    connectionString: process.env.NEON_CONNECTION_STRING
  }
});
```

### Turso

```typescript
export default defineConfig({
  provider: {
    type: 'turso',
    connectionString: process.env.TURSO_URL,
    authToken: process.env.TURSO_AUTH_TOKEN
  }
});
```

### PlanetScale

```typescript
export default defineConfig({
  provider: {
    type: 'planetscale',
    connectionString: process.env.PLANETSCALE_URL
  }
});
```

### Supabase

```typescript
export default defineConfig({
  provider: {
    type: 'supabase',
    connectionString: process.env.SUPABASE_DB_URL
  }
});
```

## Provider Features

### RLS Support

| Provider | RLS Support |
|----------|-------------|
| PostgreSQL | ✅ Full |
| Neon | ✅ Full |
| MySQL | ❌ |
| PlanetScale | ❌ |
| Turso | ✅ Basic |
| Supabase | ✅ Full |

### Connection Pooling

| Provider | Pooling |
|----------|---------|
| PostgreSQL | ✅ Built-in |
| Neon | ✅ Serverless |
| MySQL | ✅ Built-in |
| PlanetScale | ❌ Serverless |
| Turso | ❌ Edge |
| Supabase | ✅ Built-in |

## Usage

### Resolving Provider

```typescript
import { resolveProvider, getSupportedProviders } from '@betterbase/core/providers';

const provider = resolveProvider('neon');
const providers = getSupportedProviders();
```

### Getting Dialect

```typescript
import { getProviderDialect } from '@betterbase/core/providers';

const dialect = getProviderDialect('postgres'); // 'postgres'
```

## Best Practices

1. **Development**: Use SQLite/Turso for local development
2. **Production**: Use PostgreSQL/Neon for production
3. **Serverless**: Use Neon/PlanetScale for serverless
4. **Edge**: Use Turso for edge deployments

## Related

- [Overview](./overview.md) - Core package overview
- [Database](../features/database.md) - Database features