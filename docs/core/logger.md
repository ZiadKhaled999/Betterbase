# Logger

BetterBase provides a structured logging system with file transport capabilities for application-wide logging.

## Overview

The logger module provides:
- Configurable log levels (debug, info, warn, error)
- Structured logging with metadata
- File transport for persistent logging
- Console output with colors

## Installation

The logger is included in `@betterbase/core`:

```typescript
import { createLogger, BetterBaseLogger } from '@betterbase/core';
```

## Basic Usage

```typescript
import { createLogger } from '@betterbase/core';

const logger = createLogger({
  level: 'info',
  name: 'my-app'
});

// Log messages
logger.info('Server started on port 3000');
logger.warn('Connection pool approaching limit');
logger.error('Failed to connect to database', { error: err.message });
```

## Log Levels

| Level | Description | Numeric Value |
|-------|-------------|----------------|
| `debug` | Detailed debug information | 0 |
| `info` | General informational messages | 1 |
| `warn` | Warning messages | 2 |
| `error` | Error messages | 3 |

## Configuration

```typescript
import { createLogger } from '@betterbase/core';

const logger = createLogger({
  // Log level (default: 'info')
  level: 'debug',
  
  // Logger name (default: 'default')
  name: 'my-app',
  
  // Include timestamps (default: true)
  timestamps: true,
  
  // Include colors in console (default: true)
  colors: true,
  
  // Custom metadata
  metadata: {
    environment: process.env.NODE_ENV,
    version: '1.0.0'
  }
});
```

## File Transport

Log to files with the file transport:

```typescript
import { createLogger, createFileTransport } from '@betterbase/core';

const fileTransport = createFileTransport({
  // Log file directory
  directory: './logs',
  
  // Log file name pattern (supports date formatting)
  filename: 'app-%DATE%.log',
  
  // Max file size before rotation (default: 10MB)
  maxSize: '10m',
  
  // Max number of files to keep (default: 14)
  maxFiles: 14,
  
  // Log level for file transport (default: 'info')
  level: 'info',
  
  // Compress rotated files (default: true)
  compress: true
});

const logger = createLogger({
  transports: [fileTransport]
});
```

## Structured Logging

Add structured metadata to logs:

```typescript
const logger = createLogger({ name: 'api' });

// Log with metadata
logger.info('Request processed', {
  method: 'GET',
  path: '/api/users',
  statusCode: 200,
  duration: 45 // ms
});

logger.error('Request failed', {
  method: 'POST',
  path: '/api/users',
  statusCode: 500,
  error: 'Database connection failed'
});
```

## Log Entry Format

Each log entry contains:

```typescript
interface LogEntry {
  // Log level
  level: 'debug' | 'info' | 'warn' | 'error';
  
  // Logger name
  name: string;
  
  // Log message
  message: string;
  
  // Timestamp
  timestamp: Date;
  
  // Additional metadata
  metadata?: Record<string, unknown>;
  
  // Error stack trace (if error level)
  stack?: string;
}
```

## Usage in Hono

Integrate with Hono for request logging:

```typescript
import { Hono } from 'hono';
import { requestLogger } from '@betterbase/core/middleware';

const app = new Hono();

// Use request logger middleware
app.use('*', requestLogger());

app.get('/', (c) => c.text('Hello World'));
```

The request logger automatically logs:
- Request method and path
- Response status code
- Response time
- Request headers (configurable)

## Custom Transports

Create custom transport:

```typescript
import { createLogger, type Transport } from '@betterbase/core';

const customTransport: Transport = {
  log: (entry) => {
    // Send to external service
    fetch('https://logs.example.com/ingest', {
      method: 'POST',
      body: JSON.stringify(entry)
    });
  }
};

const logger = createLogger({
  transports: [customTransport]
});
```

## Best Practices

1. **Use Appropriate Levels**: Use `debug` for development, `info` for general messages, `warn` for recoverable issues, `error` for failures
2. **Include Context**: Add relevant metadata to logs (user ID, request ID, etc.)
3. **Avoid Sensitive Data**: Don't log passwords, tokens, or personal information
4. **Use Structured Data**: Use objects instead of string interpolation
5. **Rotate Logs**: Use file transport with rotation for production

## Related

- [Overview](./overview.md) - Core package overview
- [Configuration](./config.md) - Configuration schema
- [Middleware](./middleware.md) - Request logging middleware