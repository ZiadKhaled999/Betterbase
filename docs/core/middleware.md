# Middleware

BetterBase provides middleware components for request processing, including RLS session handling and request logging.

## Overview

The middleware module provides:
- **RLS Session Middleware**: Manages Row Level Security user context
- **Request Logger Middleware**: Logs HTTP requests and responses

## RLS Session Middleware

### Purpose

The RLS session middleware extracts user information from BetterAuth sessions and makes it available for Row Level Security policies. This allows database queries to be filtered based on the authenticated user's ID.

### Usage

```typescript
import { Hono } from 'hono';
import { rlsSession, requireRLS } from '@betterbase/core/middleware';

const app = new Hono();

// Apply RLS session middleware to all routes
app.use('*', rlsSession());

// Protected routes require RLS to be set
app.use('/api/protected/*', requireRLS());

app.get('/api/protected/data', (c) => {
  // User ID is available from RLS session
  const userId = c.get('rlsUserId');
  return c.json({ userId });
});
```

### Functions

| Function | Description |
|-----------|-------------|
| `rlsSession()` | Middleware that extracts user from session and sets RLS context |
| `requireRLS()` | Middleware that requires RLS to be set (protects routes) |
| `clearRLS()` | Clears RLS context (e.g., on logout) |
| `getRLSUserId(c)` | Gets the current user's ID from context |
| `isRLSSessionSet(c)` | Checks if RLS session is set |

### Context Keys

The middleware sets these keys on the Hono context:
- `rlsUserId`: Current user's ID from authentication
- `rlsSessionSet`: Boolean indicating if RLS session is active

### Idempotent Operations

The RLS session middleware is idempotent - it's safe to call multiple times:
- Calling `rlsSession()` multiple times won't duplicate operations
- `clearRLS()` can be called without checking if session exists first

## Request Logger Middleware

### Purpose

The request logger middleware logs HTTP requests and responses, including method, path, status code, and duration. This is useful for debugging and monitoring.

### Usage

```typescript
import { Hono } from 'hono';
import { requestLogger } from '@betterbase/core/middleware';

const app = new Hono();

// Use request logger middleware
app.use('*', requestLogger());

app.get('/', (c) => c.text('Hello World'));
```

### Output Format

The logger outputs:
```
GET /api/users 200 45ms
POST /api/users 201 123ms
GET /api/users/1 404 12ms
```

### Custom Configuration

```typescript
import { requestLogger } from '@betterbase/core/middleware';

app.use('*', requestLogger({
  // Log only requests slower than threshold (ms)
  slow: 1000,
  
  // Skip logging for specific paths
  skip: ['/health', '/metrics'],
  
  // Custom log format
  format: '{method} {path} {status} {duration}ms'
}));
```

## Using with Hono

### Basic Setup

```typescript
import { Hono } from 'hono';
import { rlsSession, requestLogger } from '@betterbase/core/middleware';

const app = new Hono();

// Request logging for all routes
app.use('*', requestLogger());

// RLS session for authenticated routes
app.use('/api/*', rlsSession());

// Protected API routes
app.use('/api/protected/*', requireRLS());

app.get('/', (c) => c.text('Public'));
app.get('/api/protected/data', (c) => c.json({ secure: true }));
```

### Route-Specific Middleware

```typescript
import { Hono } from 'hono';
import { rlsSession } from '@betterbase/core/middleware';

const app = new Hono();

// Public routes - no RLS
app.get('/health', (c) => c.json({ status: 'ok' }));

// Auth routes - RLS but not required
app.use('/api/auth/*', rlsSession());

// Protected routes - RLS required
app.use('/api/users/*', requireRLS());
```

## Best Practices

1. **Order Matters**: Apply request logger first, then RLS session
2. **Protect Sensitive Routes**: Use `requireRLS()` for sensitive endpoints
3. **Clear on Logout**: Call `clearRLS()` when user logs out
4. **Skip Health Checks**: Don't log health check endpoints
5. **Configure Slow Threshold**: Set threshold to identify slow requests

## Related

- [Overview](./overview.md) - Core package overview
- [RLS](../features/rls.md) - Row Level Security features
- [Logger](./logger.md) - Logging system