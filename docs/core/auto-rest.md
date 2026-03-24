# Auto-REST Module

Automatic CRUD route generation from Drizzle ORM schema with built-in RLS enforcement, filtering, and pagination.

## Table of Contents
- [Overview](#overview)
- [Features](#features)
- [Installation](#installation)
- [Usage](#usage)
- [API Reference](#api-reference)
  - [mountAutoRest](#mountautorest)
  - [AutoRestOptions](#autorestoptions)
  - [QUERY_OPERATORS](#query_operators)
  - [Types](#types)
- [Security Considerations](#security-considerations)
- [Customization](#customization)
- [Examples](#examples)

## Overview

The Auto-REST module automatically generates full CRUD (Create, Read, Update, Delete) RESTful endpoints for all tables in a Drizzle ORM schema. It eliminates boilerplate code by inspecting your database schema and creating standardized API routes with built-in security features.

Key capabilities:
- Automatic route generation for all tables
- Built-in Row Level Security (RLS) enforcement
- Advanced filtering with query operators
- Pagination support
- Input sanitization and validation
- Consistent error responses using BetterBaseResponse format

## Features

### Automatic CRUD Generation
For each table in your schema, Auto-REST creates:
- `GET /api/:table` - List all rows (with filtering, sorting, pagination)
- `GET /api/:table/:id` - Get single row by ID
- `POST /api/:table` - Insert new row
- `PATCH /api/:table/:id` - Update existing row
- `DELETE /api/:table/:id` - Delete row

### Security Features
- **RLS Enforcement**: When enabled, all routes require authentication
- **Per-row Access Control**: RLS filtering based on ownership columns
- **Input Sanitization**: Column whitelisting for insert/update operations
- **Owner Column Protection**: Prevents modification of ownership fields through API
- **SQL Injection Prevention**: Uses parameterized queries via Drizzle ORM

### Filtering & Query Capabilities
- **Basic Operators**: eq, neq, gt, gte, lt, lte
- **Pattern Matching**: like, ilike (case-insensitive like)
- **Array Operations**: in (comma-separated values)
- **Null Checks**: is_null (checks for NULL or NOT NULL)
- **Combined Filters**: Multiple query parameters combined with AND logic
- **Sorting**: order_by and order parameters
- **Pagination**: limit and offset with configurable defaults

### Response Format
All endpoints return consistent `BetterBaseResponse<T>` format:
```json
{
  "data": T | null,
  "error": string | SerializedError | null,
  "count?": number,
  "pagination?": {
    "page": number,
    "pageSize": number,
    "total": number
  }
}
```

## Installation

The Auto-REST module is part of `@betterbase/core`:
```bash
bun add @betterbase/core
```

## Usage

### Basic Setup
```typescript
import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/node-postgres';
import { 
  mountAutoRest, 
  defineConfig 
} from '@betterbase/core';
import { eq } from 'drizzle-orm';
import * as schema from './db/schema';

// Initialize Hono app
const app = new Hono();

// Set up database connection
const config = defineConfig({
  project: { name: 'my-app' },
  provider: { 
    type: 'postgres',
    connectionString: process.env.DATABASE_URL 
  }
});

const db = drizzle(config.provider.connectionString);

// Mount Auto-REST routes
mountAutoRest(app, db, schema);

// Start server
app.listen(3000);
```

### With Custom Options
```typescript
mountAutoRest(app, db, schema, {
  enabled: true,
  excludeTables: ['audit_logs', 'sessions'], // Skip sensitive tables
  basePath: '/api/v2', // Custom base path
  enableRLS: true, // Enable RLS enforcement
  writableColumns: ['name', 'email'], // Restrict updatable columns
  ownerColumn: 'userId' // Column for RLS ownership checks
});
```

## API Reference

### mountAutoRest
Primary function for mounting Auto-REST routes.

```typescript
export function mountAutoRest(
  app: Hono,
  db: DrizzleDB,
  schema: Record<string, DrizzleTable>,
  options: AutoRestOptions = {}
): void
```

#### Parameters
- `app`: Hono application instance
- `db`: Drizzle database instance
- `schema`: Record of table name to Drizzle table schema (from `drizzle-orm`)
- `options`: Configuration options (see `AutoRestOptions`)

#### Returns
`void` - Routes are registered directly on the Hono app

### AutoRestOptions
Configuration interface for Auto-REST behavior.

```typescript
export interface AutoRestOptions {
  /** Enable/disable auto-rest (default: true) */
  enabled?: boolean;
  
  /** Tables to exclude from auto-rest (default: []) */
  excludeTables?: string[];
  
  /** Base path for API routes (default: /api) */
  basePath?: string;
  
  /** Enable RLS enforcement (default: true) */
  enableRLS?: boolean;
  
  /** Columns that are allowed to be modified via API (default: all columns) */
  writableColumns?: string[];
  
  /** Column to use for RLS user ownership check (e.g., 'userId', 'owner_id') */
  ownerColumn?: string;
}
```

### QUERY_OPERATORS
Predefined filter operators for query parameter parsing.

```typescript
export const QUERY_OPERATORS = {
  eq: (col: DrizzleTable, val: unknown) => eq(col, val),
  neq: (col: DrizzleTable, val: unknown) => ne(col, val),
  gt: (col: DrizzleTable, val: unknown) => gt(col, val),
  gte: (col: DrizzleTable, val: unknown) => gte(col, val),
  lt: (col: DrizzleTable, val: unknown) => lt(col, val),
  lte: (col: DrizzleTable, val: unknown) => lte(col, val),
  like: (col: DrizzleTable, val: unknown) => like(col, `%${val}%`),
  ilike: (col: DrizzleTable, val: unknown) => ilike(col, `%${val}%`),
  in: (col: DrizzleTable, val: unknown) => {
    const values = typeof val === "string" ? val.split(",") : val;
    return inArray(col, values as unknown[]);
  },
  is_null: (col: DrizzleTable, val: unknown) => {
    const check = val === "true" || val === true;
    return check ? isNull(col) : isNotNull(col);
  },
} as const;
```

### Types
Exported TypeScript types from the module.

```typescript
export type DrizzleTable = any; // Drizzle table schema type
export type DrizzleDB = any; // Drizzle database client type

export interface AutoRestOptions {
  enabled?: boolean;
  excludeTables?: string[];
  basePath?: string;
  enableRLS?: boolean;
  writableColumns?: string[];
  ownerColumn?: string;
}
```

## Security Considerations

### Row Level Security (RLS)
When `enableRLS: true` (default):
1. All endpoints require authentication via `checkRLSAuth`
2. List endpoints apply per-row filtering using `ownerColumn`
3. Write operations (POST, PATCH, DELETE) verify row ownership before execution
4. Unauthenticated requests return 401 Unauthorized
5. Unauthorized access attempts return 403 Forbidden

### Input Protection
- **Column Whitelisting**: Only `writableColumns` can be inserted/updated
- **Owner Column Protection**: Prevents API modification of ownership fields
- **SQL Injection Prevention**: Uses Drizzle ORM parameterized queries
- **Request Size Limits**: Depends on Hono middleware configuration

### Rate Limiting & DDOS Protection
Auto-REST itself doesn't implement rate limiting - this should be handled at the middleware level:
```typescript
app.use('*', async (c, next) => {
  // Implement rate limiting logic here
  await next();
});
```

## Customization

### Excluding Tables
Prevent Auto-REST from generating routes for specific tables:
```typescript
mountAutoRest(app, db, schema, {
  excludeTables: ['secrets', 'migrations', 'audit_logs']
});
```

### Custom Base Path
Change the base URL for all generated routes:
```typescript
mountAutoRest(app, db, schema, {
  basePath: '/api/v1/resource'
});
// Results in: GET /api/v1/resource/users, POST /api/v1/resource/posts, etc.
```

### Column-Level Permissions
Restrict which columns can be modified via API:
```typescript
mountAutoRest(app, db, schema, {
  writableColumns: ['title', 'content', 'published'] // Only these columns updatable
});
```

### Disabling Auto-REST
Temporarily disable route generation:
```typescript
mountAutoRest(app, db, schema, {
  enabled: false // No routes will be generated
});
```

## Examples

### Standard Usage
See [Usage](#usage) above for basic implementation.

### Multi-tenant Application
```typescript
mountAutoRest(app, db, schema, {
  enableRLS: true,
  ownerColumn: 'tenant_id', // Multi-tenancy via tenant ID
  basePath: '/api'
});
```

### Public API with Protected Admin Routes
```typescript
// Public routes (no RLS)
mountAutoRest(app, db, schema, {
  enableRLS: false,
  basePath: '/api/public',
  excludeTables: ['admin_users', 'system_settings']
});

// Admin routes (with RLS)
mountAutoRest(app, db, schema, {
  enableRLS: true,
  ownerColumn: 'admin_id',
  basePath: '/api/admin',
  excludeTables: ['public_profiles', 'blog_posts'] // Only admin tables
});
```

### Custom Filtering Endpoints
Extend Auto-REST with custom search functionality:
```typescript
app.get('/api/search', async (c) => {
  const { q, table } = c.req.query();
  if (!q || !table) {
    return c.json({ error: 'Missing query or table parameter' }, 400);
  }
  
  // Implement custom search logic here
  // Could use full-text search or custom filtering
});
```

## Error Handling
All endpoints return standardized error responses:
- **400 Bad Request**: Invalid request body or query parameters
- **401 Unauthorized**: Missing or invalid authentication (when RLS enabled)
- **403 Forbidden**: Authenticated but insufficient permissions
- **404 Not Found**: Requested resource doesn't exist or access denied
- **500 Internal Server Error**: Unexpected server error

Error format follows `BetterBaseResponse<null>`:
```json
{
  "data": null,
  "error": "Error message description",
  "count": null,
  "pagination": null
}
```

## Performance Considerations

### Query Optimization
- Auto-REST uses efficient Drizzle ORM queries
- Pagination uses `LIMIT` and `OFFSET` (consider keyset pagination for large datasets)
- Filtering is applied at the database level
- Consider adding database indexes for frequently queried/filtered columns

### Caching
For read-heavy applications, consider implementing caching middleware:
```typescript
app.use('/api/*', async (c, next) => {
  // Check cache, serve if fresh, otherwise call next() and cache result
  await next();
});
```

### Connection Pooling
Ensure your database connection pooling is properly configured for expected load.

## Limitations & Known Issues

### Complex Joins
Auto-REST generates simple table-based queries. For complex joins or computed fields:
- Use custom routes alongside Auto-REST
- Create database views for complex query logic
- Implement custom endpoints for aggregated data

### Offsetting Large Datasets
OFFSET-based pagination can become slow with large datasets. Consider:
- Keyset pagination for infinite scroll patterns
- Implementing custom pagination strategies
- Adding WHERE clauses to limit result sets

### Database-Specific Features
Some advanced database features may require custom implementation:
- Full-text search
- Geospatial queries
- Complex transactions
- Stored procedure calls

## Related Modules
- [Configuration](./config.md): For defining BetterBase configuration
- [RLS](./rls.md): For understanding Row Level Security implementation
- [Providers](./providers.md): For database provider-specific details
- [Logger](./logger.md): For Auto-REST logging integration