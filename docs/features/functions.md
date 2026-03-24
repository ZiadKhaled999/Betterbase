# Functions

BetterBase supports serverless functions for custom business logic, deployment, and edge computing.

## Features

- **Multiple Targets** - AWS Lambda, Cloudflare Workers, Vercel, Netlify, Deno, Bun
- **Local Development** - Test functions locally with hot reload
- **Automatic Bundling** - esbuild-based bundling with tree shaking
- **TypeScript Support** - Full type checking during bundling
- **Environment Variables** - Configure runtime environment
- **Dependencies** - Automatic dependency inclusion

## Quick Setup

```bash
# Create a new function
bb function create process-data
```

This creates `src/functions/process-data/index.ts`:

```typescript
export default async function handler(event, context) {
  return {
    statusCode: 200,
    body: JSON.stringify({ message: 'Hello!' })
  }
}
```

## Function Structure

```typescript
// src/functions/my-function/index.ts
import type { BetterBaseResponse } from '@betterbase/shared'

export default async function handler(
  event: Record<string, unknown>,
  context?: Record<string, unknown>
): Promise<BetterBaseResponse<unknown>> {
  try {
    // Process event
    const result = await processData(event)
    
    return {
      data: result,
      error: null
    }
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

async function processData(event: Record<string, unknown>) {
  // Your logic here
  return { processed: true }
}
```

## Event Format

The event object contains:

```typescript
interface FunctionEvent {
  // HTTP properties (API Gateway style)
  method: string
  path: string
  headers: Record<string, string>
  body: string | undefined
  query: Record<string, string>
  params: Record<string, string>
  
  // Custom properties
  [key: string]: unknown
}
```

## Response Format

Return a `BetterBaseResponse`:

```typescript
interface BetterBaseResponse<T> {
  data: T | null
  error: string | null
  count?: number
  pagination?: {
    page: number
    pageSize: number
    total: number
  }
}
```

## Local Development

```bash
# Run function locally
bb function dev process-data

# With custom event
bb function dev process-data --event '{"key": "value"}'
```

## Building

```bash
# Build for default target
bb function build process-data

# Build for specific platform
bb function build process-data --target aws-lambda

# Build with minification
bb function build process-data --minify
```

### Build Options

| Option | Description | Default |
|--------|-------------|---------|
| `--target` | Build target | `node` |
| `--format` | Output format | `esm` |
| `--minify` | Enable minification | `false` |
| `--sourcemap` | Generate source maps | `true` |
| `--outdir` | Output directory | `dist/` |

### Supported Targets

- `node` - Node.js
- `browser` - Browser
- `aws-lambda` - AWS Lambda
- `cloudflare-workers` - Cloudflare Workers
- `vercel` - Vercel Serverless
- `netlify` - Netlify Functions
- `deno` - Deno Deploy
- `bun` - Bun runtime

## Deployment

```bash
# Deploy function
bb function deploy process-data

# Deploy with environment sync
bb function deploy process-data --sync-env
```

## Database Access

```typescript
// src/functions/user-profile/index.ts
import { drizzle } from 'drizzle-orm/postgres'
import { eq } from 'drizzle-orm'
import { users } from '../../db/schema'

export default async function handler(event) {
  const userId = event.pathParameters?.userId
  
  if (!userId) {
    return { data: null, error: 'Missing userId' }
  }
  
  const db = drizzle(process.env.DATABASE_URL)
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)
  
  if (!user) {
    return { data: null, error: 'User not found' }
  }
  
  return { data: user, error: null }
}
```

## Using External APIs

```typescript
export default async function handler(event) {
  const { url } = event
  
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${process.env.API_KEY}`
    }
  })
  
  const data = await response.json()
  
  return { data, error: null }
}
```

## Scheduled Functions

For scheduled execution (cron jobs):

```typescript
export default async function handler(event) {
  const { scheduleTime } = event
  
  // Run daily task
  const report = await generateDailyReport()
  
  return { data: { generated: true }, error: null }
}
```

Configure in your deployment platform (AWS EventBridge, Vercel Cron, etc.)

## CLI Commands

```bash
# Create function
bb function create <name>

# Run locally
bb function dev <name>

# Build function
bb function build <name>

# Deploy function
bb function deploy <name>

# List functions
bb function list

# View logs
bb function logs <name>
```

## Best Practices

1. **Single responsibility** - Each function does one thing
2. **Stateless** - Don't rely on local storage
3. **Idempotent** - Safe to retry
4. **Fast initialization** - Minimize cold start
5. **Proper errors** - Return structured errors

## Limitations

| Platform | Bundle Size | Timeout |
|----------|-------------|---------|
| AWS Lambda | 50MB zipped | 15 min |
| Cloudflare Workers | 10MB | 30 sec |
| Vercel | 50MB | 10 sec |
| Netlify | 50MB | 10 sec |

## Related

- [Configuration](../getting-started/configuration.md) - Function config
- [Webhooks](./webhooks.md) - Event-driven calls
- [CLI Commands](../api-reference/cli-commands.md) - CLI reference
