# Feature 10: Structured Logging

**Priority**: CRITICAL (Week 1-2) - **IMPLEMENT THIS FIRST**  
**Complexity**: Low  
**Dependencies**: None  
**Estimated Effort**: 1-2 weeks

---

## Why This Feature First?

Structured logging is the FOUNDATION for all other features. Every feature will use logging for:
- **Debugging**: Track what's happening in production
- **Performance**: Log slow queries, long requests
- **Security**: Audit trail for sensitive operations
- **Monitoring**: Track errors and warnings

**Without logging in place first, debugging the other 9 features will be painful.**

---

## Problem Statement

Current codebase uses scattered `console.log` statements:
- **No structure**: `console.log("User logged in")` - what user? when?
- **No levels**: Can't filter debug vs error messages
- **No persistence**: Logs disappear when process restarts
- **No request tracking**: Can't trace a request across multiple log entries

**Production Impact**: When something breaks in production, you have no way to diagnose it.

---

## Solution Overview

Implement **Pino** (fastest Node.js logger) with:
- **Log levels**: debug, info, warn, error
- **Structured data**: JSON logs with metadata
- **Pretty dev mode**: Colored, human-readable
- **File persistence**: Rotating daily log files in production
- **Request IDs**: Track requests across the system

---

## Architecture

```
┌────────────────────────────────────────────────────────────┐
│  Application Code                                          │
│  ┌──────────────────────────────────────────────────┐     │
│  │  logger.info({ msg: "User logged in",            │     │
│  │                userId: "123",                     │     │
│  │                duration: 45 })                    │     │
│  └────────────────────┬─────────────────────────────┘     │
└───────────────────────┼────────────────────────────────────┘
                        │
                        ▼
┌────────────────────────────────────────────────────────────┐
│  Pino Logger                                               │
│  ┌──────────────────────────────────────────────────┐     │
│  │  NODE_ENV === 'development'?                     │     │
│  │    ├─ YES → pino-pretty (colored console)       │     │
│  │    └─ NO  → JSON (structured logs)              │     │
│  └────────────────────┬─────────────────────────────┘     │
└───────────────────────┼────────────────────────────────────┘
                        │
                ┌───────┴────────┐
                │                 │
         DEVELOPMENT         PRODUCTION
                │                 │
                ▼                 ▼
         ┌─────────────┐   ┌──────────────────┐
         │  Terminal   │   │  Console + Files │
         │  (pretty)   │   │  (JSON)          │
         └─────────────┘   │  logs/           │
                           │  betterbase-     │
                           │  2026-03-20.log  │
                           └──────────────────┘
```

---

## Implementation Steps

### Step 1: Install Pino

**Action**: Install Pino and pino-pretty

```bash
cd packages/core
bun add pino
bun add -D pino-pretty  # Dev dependency for pretty printing
```

**Verification**:
```bash
cat package.json | grep pino
# Should show:
# "pino": "^8.x.x"
# "pino-pretty": "^10.x.x" (in devDependencies)
```

---

### Step 2: Create Logger Module

**File**: `packages/core/src/logger/index.ts` (NEW FILE - create `logger/` directory)

```bash
mkdir -p packages/core/src/logger
```

```typescript
/**
 * Structured Logging Module
 * 
 * Provides application-wide logging with:
 * - Structured JSON logs
 * - Log levels (debug, info, warn, error)
 * - Request ID tracking
 * - Pretty dev mode, JSON production mode
 * - File rotation (production only)
 * 
 * Usage:
 *   import { logger } from './logger';
 *   logger.info({ msg: "User action", userId: "123" });
 */

import pino from 'pino';
import { nanoid } from 'nanoid';

/**
 * Determine environment
 */
const isDev = process.env.NODE_ENV !== 'production';
const logLevel = process.env.LOG_LEVEL || (isDev ? 'debug' : 'info');

/**
 * Main application logger
 * 
 * Development mode:
 * - Uses pino-pretty for colored, readable output
 * - Shows timestamp, level, message
 * - Hides pid and hostname (noise reduction)
 * 
 * Production mode:
 * - Outputs structured JSON
 * - Includes all metadata
 * - Can be parsed by log aggregators (Datadog, CloudWatch, etc.)
 * 
 * @example
 * logger.info("User logged in");
 * logger.info({ userId: "123", action: "login" }, "User logged in");
 * logger.error({ err: error }, "Failed to process payment");
 */
export const logger = pino({
  level: logLevel,
  
  // Pretty print in development
  transport: isDev ? {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'HH:MM:ss.l', // e.g., 14:30:22.123
      ignore: 'pid,hostname', // Hide noise
      singleLine: false,
    },
  } : undefined,
  
  // JSON formatting in production
  formatters: isDev ? undefined : {
    level: (label) => {
      return { level: label };
    },
  },
});

/**
 * Create a child logger with a unique request ID
 * 
 * Use this for HTTP request handling to track all logs
 * related to a single request
 * 
 * @returns Child logger with reqId field
 * 
 * @example
 * const reqLogger = createRequestLogger();
 * reqLogger.info("Processing request");
 * reqLogger.info("Query executed");
 * // Both logs will have the same reqId
 */
export function createRequestLogger(): pino.Logger {
  const requestId = nanoid(10); // e.g., "a1B2c3D4e5"
  return logger.child({ reqId: requestId });
}

/**
 * Log slow database queries
 * 
 * Automatically warns when a query exceeds threshold
 * 
 * @param query - SQL query (will be truncated to 200 chars)
 * @param duration - Query duration in milliseconds
 * @param threshold - Threshold in ms (default: 100ms)
 * 
 * @example
 * const start = Date.now();
 * await db.execute(query);
 * logSlowQuery(query, Date.now() - start);
 */
export function logSlowQuery(
  query: string, 
  duration: number, 
  threshold = 100
): void {
  if (duration > threshold) {
    logger.warn({
      msg: 'Slow query detected',
      query: query.substring(0, 200), // Truncate long queries
      duration_ms: duration,
      threshold_ms: threshold,
    });
  }
}

/**
 * Log errors with full stack trace
 * 
 * Ensures errors are logged consistently with context
 * 
 * @param error - Error object
 * @param context - Additional context (userId, requestId, etc.)
 * 
 * @example
 * try {
 *   await riskyOperation();
 * } catch (error) {
 *   logError(error, { userId: "123", operation: "payment" });
 * }
 */
export function logError(
  error: Error, 
  context?: Record<string, any>
): void {
  logger.error({
    msg: error.message,
    stack: error.stack,
    error_name: error.name,
    ...context,
  });
}

/**
 * Log successful operations with timing
 * 
 * @param operation - Operation name
 * @param duration - Duration in ms
 * @param metadata - Additional metadata
 * 
 * @example
 * const start = Date.now();
 * await processData();
 * logSuccess("process_data", Date.now() - start, { records: 100 });
 */
export function logSuccess(
  operation: string,
  duration: number,
  metadata?: Record<string, any>
): void {
  logger.info({
    msg: `Operation completed: ${operation}`,
    operation,
    duration_ms: duration,
    ...metadata,
  });
}
```

**Verification**:
```bash
cd packages/core
bun run build
# Should compile without errors
```

---

### Step 3: Create Request Logger Middleware (Hono)

**File**: `packages/core/src/middleware/request-logger.ts` (NEW FILE)

```typescript
import type { Context, Next } from 'hono';
import { createRequestLogger } from '../logger';

/**
 * Request logging middleware for Hono
 * 
 * Logs all incoming requests and responses with:
 * - Request ID (unique per request)
 * - HTTP method and path
 * - Response status code
 * - Request duration
 * 
 * Usage:
 *   app.use('*', requestLogger());
 * 
 * The logger is attached to context and can be accessed:
 *   const logger = c.get('logger');
 *   logger.info("Processing payment");
 */
export function requestLogger() {
  return async (c: Context, next: Next) => {
    const logger = createRequestLogger();
    const start = Date.now();

    // Attach logger to context for use in route handlers
    c.set('logger', logger);

    // Log incoming request
    logger.info({
      msg: 'Incoming request',
      method: c.req.method,
      path: c.req.path,
      user_agent: c.req.header('user-agent'),
    });

    // Execute route handler
    await next();

    // Log response
    const duration = Date.now() - start;
    const level = c.res.status >= 500 ? 'error' : 
                  c.res.status >= 400 ? 'warn' : 'info';
    
    logger[level]({
      msg: 'Request completed',
      method: c.req.method,
      path: c.req.path,
      status: c.res.status,
      duration_ms: duration,
    });

    // Warn on slow requests (>1s)
    if (duration > 1000) {
      logger.warn({
        msg: 'Slow request detected',
        duration_ms: duration,
        path: c.req.path,
      });
    }
  };
}
```

---

### Step 4: Add File Logging (Production Only)

**File**: `packages/core/src/logger/file-transport.ts` (NEW FILE)

```typescript
import path from 'path';
import { mkdir } from 'fs/promises';
import pino from 'pino';

/**
 * Setup file logging for production
 * 
 * Creates daily rotating log files in logs/ directory
 * 
 * @returns Pino destination stream
 */
export async function setupFileLogging(): Promise<pino.DestinationStream> {
  const logsDir = path.join(process.cwd(), 'logs');
  
  // Create logs directory if it doesn't exist
  await mkdir(logsDir, { recursive: true });
  
  // Create log file with today's date
  const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const logFile = path.join(logsDir, `betterbase-${date}.log`);
  
  return pino.destination({
    dest: logFile,
    sync: false, // Async for better performance
    mkdir: true,
  });
}
```

**Update**: `packages/core/src/logger/index.ts`

**REPLACE** the logger initialization with:

```typescript
import { setupFileLogging } from './file-transport';

// Initialize logger
let loggerInstance: pino.Logger;

if (isDev) {
  // Development: Pretty console output
  loggerInstance = pino({
    level: logLevel,
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'HH:MM:ss.l',
        ignore: 'pid,hostname',
      },
    },
  });
} else {
  // Production: JSON to console + file
  const fileStream = await setupFileLogging();
  
  // Multi-stream: both console and file
  const streams = [
    { stream: process.stdout },
    { stream: fileStream },
  ];
  
  loggerInstance = pino(
    { level: logLevel },
    pino.multistream(streams)
  );
}

export const logger = loggerInstance;
```

---

### Step 5: Replace console.log Throughout Codebase

**Action**: Search and replace console.log with logger

**Strategy**:
1. Search for all `console.log`
2. Replace with `logger.info`
3. Search for all `console.error`
4. Replace with `logger.error`
5. Search for all `console.warn`
6. Replace with `logger.warn`

**Example Replacements**:

**Before**:
```typescript
console.log('User logged in:', userId);
console.error('Failed to save:', error);
```

**After**:
```typescript
import { logger } from './logger';

logger.info({ userId }, 'User logged in');
logger.error({ error }, 'Failed to save');
```

**Files to Update** (search in these directories):
- `packages/core/src/`
- `packages/cli/src/`
- `apps/test-project/src/`

**Bash Command to Find All console.log**:
```bash
grep -r "console\.log" packages/core/src
grep -r "console\.error" packages/core/src
grep -r "console\.warn" packages/core/src
```

---

### Step 6: Add Logging to Main App

**File**: `apps/test-project/src/index.ts`

**Action**: Add request logger middleware

```typescript
import { Hono } from 'hono';
import { requestLogger } from '@betterbase/core/middleware/request-logger';

const app = new Hono();

// Add request logger (must be first middleware)
app.use('*', requestLogger());

// ... rest of your app
```

---

## Testing

### Manual Testing

**1. Start dev server**:
```bash
cd apps/test-project
bun run dev
```

**Expected output** (pretty logs):
```
14:30:22.123 INFO  Server starting on port 3000
```

**2. Make a request**:
```bash
curl http://localhost:3000/api/users
```

**Expected logs**:
```
14:30:25.456 INFO  (a1B2c3D4e5) Incoming request
    method: "GET"
    path: "/api/users"
14:30:25.498 INFO  (a1B2c3D4e5) Request completed
    method: "GET"
    path: "/api/users"
    status: 200
    duration_ms: 42
```

**3. Test production mode**:
```bash
NODE_ENV=production bun run dev
```

**Expected output** (JSON logs):
```json
{"level":"info","time":1709827935234,"msg":"Server starting","port":3000}
{"level":"info","time":1709827936123,"reqId":"a1B2c3D4e5","msg":"Incoming request","method":"GET","path":"/api/users"}
```

**4. Check log file created**:
```bash
ls -la logs/
# Should show: betterbase-2026-03-20.log
```

---

## Acceptance Criteria

- [ ] Pino and pino-pretty installed
- [ ] Logger module created in `packages/core/src/logger/`
- [ ] Request ID middleware created
- [ ] File logging works in production (logs/ directory)
- [ ] Dev mode uses pretty colored output
- [ ] Production mode uses JSON output
- [ ] All console.log replaced with logger.info
- [ ] All console.error replaced with logger.error
- [ ] Request duration logged for every HTTP request
- [ ] Slow requests (>1s) generate warning logs
- [ ] Slow queries (>100ms) generate warning logs
- [ ] Test: Start server, make request, verify logs with request ID
- [ ] Test: Production mode writes to file
- [ ] Test: Log rotation creates new file daily

---

## Log Levels Guide

**debug**: Verbose information for debugging
```typescript
logger.debug({ query, params }, 'Executing database query');
```

**info**: Normal application flow
```typescript
logger.info({ userId }, 'User logged in');
```

**warn**: Something unusual but not an error
```typescript
logger.warn({ duration: 1500 }, 'Slow request detected');
```

**error**: Error occurred
```typescript
logger.error({ error: err }, 'Failed to process payment');
```

---

## Environment Variables

Add to `.env`:
```bash
# Logging configuration
LOG_LEVEL=debug          # debug | info | warn | error
NODE_ENV=development     # development | production
```

---

## Performance Notes

- Pino is the **fastest** Node.js logger (benchmarked)
- Async file writes don't block requests
- Pretty printing adds ~5-10ms overhead (dev only)
- Production JSON logs add <1ms overhead

---

## Next Steps After Implementation

1. **Integrate with other features**: All features will use this logger
2. **Add log aggregation** (optional): Send logs to Datadog, CloudWatch, Loki
3. **Add sampling** (optional): Sample high-volume logs in production
4. **Add correlation IDs**: Track requests across microservices

---

**Feature Status**: Ready for implementation  
**Estimated Time**: 1-2 weeks  
**Start Date**: Week 1 (IMPLEMENT THIS FIRST)

