# Configuration

Learn how to configure BetterBase for your project's specific needs.

## Configuration File

BetterBase uses `betterbase.config.ts` for project configuration:

```typescript
import { defineConfig } from '@betterbase/core'

export default defineConfig({
  project: { name: 'my-app' },
  provider: { 
    type: 'postgres',
    connectionString: process.env.DATABASE_URL 
  }
})
```

## Project Settings

```typescript
project: {
  name: string          // Required: Human-readable project name
}
```

## Database Provider

```typescript
provider: {
  type: 'postgres' | 'mysql' | 'sqlite' | 'neon' | 'turso' | 'planetscale' | 'supabase' | 'managed'
  connectionString?: string    // PostgreSQL, MySQL, Neon, PlanetScale, Supabase
  url?: string                // Turso: libSQL connection URL
  authToken?: string          // Turso: Auth token for managed DB
}
```

### Provider-Specific Requirements

| Provider | Required Fields |
|----------|-----------------|
| postgres, mysql, neon, planetscale, supabase | `connectionString` |
| turso | `url`, `authToken` |
| managed | No database needed |

## Storage Configuration

```typescript
storage: {
  provider: 's3' | 'r2' | 'backblaze' | 'minio' | 'managed'
  bucket: string
  region?: string
  endpoint?: string
  policies?: StoragePolicy[]
}
```

### Storage Policies

```typescript
storage: {
  policies: [
    {
      bucket: 'avatars',
      operation: 'upload' | 'download' | 'list' | 'delete' | '*',
      expression: 'auth.uid() != null'  // RLS-like expression
    }
  ]
}
```

## Webhooks

```typescript
webhooks: [
  {
    id: 'user-notifications',
    table: 'users',
    events: ['INSERT', 'UPDATE', 'DELETE'],
    url: process.env.USER_WEBHOOK_URL,
    secret: process.env.USER_WEBHOOK_SECRET,
    enabled: true
  }
]
```

## GraphQL

```typescript
graphql: {
  enabled: true,
  playground: process.env.NODE_ENV !== 'production'
}
```

## Vector Search

```typescript
vector: {
  enabled: false,
  provider: 'openai' | 'cohere' | 'huggingface' | 'custom',
  apiKey?: string,
  model?: string,
  dimensions?: number,
  endpoint?: string
}
```

## Auto-REST

```typescript
autoRest: {
  enabled: true,
  excludeTables: ['schema_migrations', 'audit_log'],
  tables: {
    posts: {
      advancedFilters: true,
      maxLimit: 1000
    },
    users: {
      advancedFilters: false,
      maxLimit: 100
    }
  }
}
```

## Branching

```typescript
branching: {
  enabled: true,
  maxPreviews: 10,
  defaultSleepTimeout: 3600,  // seconds
  storageEnabled: true
}
```

## Environment Variables

Required format for environment variable references:

```text
process.env.VARIABLE_NAME
```

### Common Variables

```bash
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/db

# Auth
AUTH_SECRET=your-secret-key-min-32-chars
AUTH_URL=http://localhost:3000

# Storage
STORAGE_PROVIDER=s3
STORAGE_BUCKET=my-bucket
AWS_REGION=us-west-2
AWS_ACCESS_KEY_ID=your-key
AWS_SECRET_ACCESS_KEY=your-secret

# Vector
OPENAI_API_KEY=sk-...
```

## Examples

### Minimal Configuration

```typescript
export default defineConfig({
  project: { name: 'my-app' },
  provider: { type: 'managed' }
})
```

### PostgreSQL with S3

```typescript
export default defineConfig({
  project: { name: 'prod-app' },
  provider: {
    type: 'postgres',
    connectionString: process.env.DATABASE_URL
  },
  storage: {
    provider: 's3',
    bucket: process.env.STORAGE_BUCKET,
    region: 'us-west-2'
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
    maxPreviews: 15
  }
})
```

### Turso with Cloudflare R2

```typescript
export default defineConfig({
  project: { name: 'edge-app' },
  provider: {
    type: 'turso',
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN
  },
  storage: {
    provider: 'r2',
    bucket: process.env.STORAGE_BUCKET
  },
  vector: {
    enabled: true,
    provider: 'openai',
    apiKey: process.env.OPENAI_API_KEY
  }
})
```

## Validation

Configuration is validated at startup. Errors provide clear guidance:

```
Invalid BetterBase configuration: provider.connectionString: 
Provider type "postgres" requires "connectionString" to be present and non-empty
```

## Best Practices

1. **Use environment variables for secrets** - Never hardcode API keys
2. **Validate in CI** - Check configuration before deployment
3. **Use sensible defaults** - Make common configurations work out-of-box
4. **Document required variables** - Create `.env.example` file
5. **Separate concerns** - Don't mix database, storage, and feature flags
