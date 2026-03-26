# Test Project Application

Reference implementation showing how to build applications with BetterBase.

## Table of Contents
- [Overview](#overview)
- [Project Structure](#project-structure)
- [Configuration](#configuration)
- [Database](#database)
- [API Routes](#api-routes)
- [Authentication](#authentication)
- [Storage](#storage)
- [Webhooks](#webhooks)
- [Realtime](#realtime)
- [Functions](#functions)
- [Development Workflow](#development-workflow)
- [Testing](#testing)
- [Deployment](#deployment)

## Overview

The test-project application is a starter template that demonstrates Best practices for building applications with BetterBase. It includes:

- **Bun Runtime**: Fast JavaScript/TypeScript runtime
- **TypeScript Strict Mode**: Strong typing for enhanced developer experience
- **Hono API Server**: Lightweight, fast web framework
- **Drizzle ORM**: Type-safe database access
- **Zod Validation**: Runtime schema validation
- **Modular Structure**: Well-organized code separation

This template serves as both a learning resource and a starting point for new BetterBase projects.

## Project Structure

```
src/
├── db/                 # Database configuration and schema
│   ├── index.ts        # Database connection
│   ├── schema.ts       # Database table definitions
│   ├── migrate.ts      # Migration utilities
│   └── policies/       # Row Level Security policies
├── routes/             # API route handlers
│   ├── index.ts        # Route registration
│   ├── health.ts       # Health check endpoints
│   ├── users.ts        # User management endpoints
│   ├── storage.ts      # File storage endpoints
│   ├── webhooks.ts     # Webhook delivery endpoints
│   └── graphql.d.ts    # GraphQL type definitions
├── middleware/         # Custom middleware
│   ├── auth.ts         # Authentication middleware
│   └── validation.ts   # Request validation middleware
├── lib/                # Library utilities
│   ├── env.ts          # Environment variable validation
│   └── realtime.ts     # WebSocket realtime support
├── functions/          # Serverless functions
│   └── hello/          # Example hello world function
├── index.ts            # Application entry point
├── betterbase.config.ts # BetterBase configuration
└── drizzle.config.ts   # Drizzle ORM configuration
```

## Configuration

### betterbase.config.ts
The main BetterBase configuration file defines:
- Project metadata
- Database provider settings
- Storage configuration (commented out)
- Webhook configuration (commented out)
- GraphQL API settings

See the [Configuration Guide](#configuration) for detailed explanation.

### Environment Variables
Required environment variables are validated in `src/lib/env.ts`:
- `NODE_ENV`: Node environment (development, production, test)
- `PORT`: Server port (defaults to 3000)
- `DB_PATH`: Database file path for SQLite (defaults to local.db)
- `DATABASE_URL`: Connection string for external databases

## Database

### Schema Definition
Database schema is defined in `src/db/schema.ts` using Drizzle ORM:
```typescript
import { pgTable, varchar, timestamp, boolean, integer, serial } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  emailVerified: boolean('email_verified').default(false),
  image: varchar('image', { length: 500 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
});

export const posts = pgTable('posts', {
  id: serial('id').primaryKey(),
  title: varchar('title', { length: 255 }).notNull(),
  content: text('content').notNull(),
  published: boolean('published').default(false),
  authorId: integer('author_id').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
}, (table) => [
  foreignKey({
    columns: [table.authorId],
    foreignColumns: [users.id],
    name: 'posts_author_id_fkey'
  })
]);
```

### Migrations
Migration commands are available through the CLI:
```bash
# Generate migration from schema changes
bb migrate

# Preview migration without applying
bb migrate preview

# Apply migration to local database
bb migrate

# Apply to production (requires confirmation)
bb migrate production

# Rollback last migration
bb migrate rollback
```

### Database Connection
Database connection is established in `src/db/index.ts`:
```typescript
import { drizzle } from 'drizzle-orm/postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { eq } from 'drizzle-orm';
import { DB_URL } from '../lib/env';

export const db = drizzle(DB_URL);
```

## API Routes

### Route Registration
All API routes are registered in `src/routes/index.ts`:
```typescript
import { Hono } from 'hono';
import { healthRoute } from './health';
import { usersRoute } from './users';
import { storageRoute } from './storage';
import { webhooksRoute } from './webhooks';

export const apiRoutes = new Hono()
  .basePath('/api')
  .route('/health', healthRoute)
  .route('/users', usersRoute)
  .route('/storage', storageRoute)
  .route('/webhooks', webhooksRoute);
```

### Health Check
Simple health check endpoint in `src/routes/health.ts`:
```typescript
import { Hono } from 'hono';

export const healthRoute = new Hono()
  .get('/', (c) => c.json({ status: 'OK', timestamp: new Date().toISOString() }));
```

### Users Endpoints
CRUD operations for users in `src/routes/users.ts`:
- `GET /api/users` - List users (with filtering, pagination)
- `GET /api/users/:id` - Get single user
- `POST /api/users` - Create new user
- `PATCH /api/users/:id` - Update user
- `DELETE /api/users/:id` - Delete user

### Storage Endpoints
File storage operations in `src/routes/storage.ts`:
- `POST /api/storage/:bucket/upload` - Upload file
- `GET /api/storage/:bucket/:path` - Download file
- `GET /api/storage/:bucket/:path/public` - Get public URL
- `POST /api/storage/:bucket/:path/sign` - Create signed URL
- `DELETE /api/storage/:bucket` - Remove files
- `GET /api/storage/:bucket` - List files

### Webhook Endpoints
Webhook delivery in `src/routes/webhooks.ts`:
- `POST /api/webhooks` - Receive webhook payload
- Implements webhook signature verification
- Handles retry logic and delivery confirmation

## Authentication

### Auth Middleware
Authentication middleware in `src/middleware/auth.ts`:
- Validates JWT tokens from Authorization header
- Attaches user info to request context
- Handles token expiration and refresh

### Auth Routes
Authentication endpoints in `src/auth/`:
- `POST /api/auth/signup` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `POST /api/auth/magic-link/send` - Send magic link
- `POST /api/auth/magic-link/verify` - Verify magic link
- `POST /api/auth/otp/send` - Send OTP
- `POST /api/auth/otp/verify` - Verify OTP
- MFA and phone auth endpoints

### Session Management
Session handling uses browser localStorage or cookies:
- Tokens stored client-side
- Automatic token refresh
- Session expiration handling

## Storage

### Storage Configuration
Storage is configured in `betterbase.config.ts` (currently commented out):
```typescript
// storage: {
//   provider: 's3', // 's3' | 'r2' | 'backblaze' | 'minio' | 'managed'
//   bucket: 'my-bucket',
//   region: 'us-east-1',
//   // For S3-compatible providers:
//   // endpoint: 'https://s3.amazonaws.com',
// },
```

### Storage Endpoints
Once configured, storage endpoints provide:
- File upload with metadata support
- Secure file downloads
- Public URL generation
- Time-limited signed URLs
- Batch file operations
- Directory listing with filtering

## Webhooks

### Webhook Configuration
Webhooks are configured in `betterbase.config.ts` (currently commented out):
```typescript
// webhooks: [
//   {
//     id: 'webhook-1',
//     table: 'users',
//     events: ['INSERT', 'UPDATE', 'DELETE'],
//     url: 'https://example.com/webhook',
//     secret: process.env.WEBHOOK_SECRET!,
//     enabled: true,
//   },
// ],
```

### Webhook Delivery
Webhook system provides:
- Reliable delivery with exponential backoff
- Signature verification for security
- Delivery logging and monitoring
- Manual retry capabilities
- Webhook testing utilities

## Realtime

### WebSocket Server
Realtime WebSocket support in `src/lib/realtime.ts`:
- Secure WebSocket connections (wss://)
- Token-based authentication
- Channel-based messaging
- Presence tracking
- Broadcast messaging

### Client Connection
Clients connect to realtime endpoint:
```javascript
// Browser client
const ws = new WebSocket(`wss://${host}/ws?token=${jwtToken}`);

// With query parameter
const ws = new WebSocket(`wss://${host}/ws?token=${jwtToken}`);

// With bearer header (requires custom WebSocket implementation)
```

### Events
Realtime system supports:
- Database change events (INSERT, UPDATE, DELETE)
- Custom broadcast events
- Presence events (join, leave, sync, update)
- Channel subscription management

## Functions

### Function Structure
Serverless functions in `src/functions/`:
```typescript
// src/functions/hello/index.ts
export default async function handler(event) {
  return {
    statusCode: 200,
    body: JSON.stringify({ message: 'Hello World!' })
  };
}
```

### Function Management
Functions are managed through the CLI:
```bash
# Create new function
bb function create hello-world

# Develop locally with hot reload
bb function dev hello-world

# Bundle for deployment
bb function build hello-world

# Deploy to cloud
bb function deploy hello-world --sync-env
```

### Function Runtime
Functions run in a secure sandbox with:
- Limited execution time (configurable)
- Memory limits
- Network access controls
- Environment variable injection
- Logging capture

## Development Workflow

### Getting Started
1. Install dependencies: `bun install`
2. Set up environment variables (copy .env.example to .env)
3. Initialize database: `bun run db:generate` then `bun run db:push`
4. Start development server: `bun run dev`
5. Open API documentation at `http://localhost:3000/api`

### Development Commands
```bash
# Start development server with auto-reload
bun run dev

# Generate Drizzle migrations from schema changes
bun run db:generate

# Apply migrations to local database
bun run db:push

# Run test suite
bun run test

# Build for production
bun run build

# Start production server
bun run start
```

### File Watching
The template includes automatic file watching:
- Schema changes trigger migration generation
- Route changes trigger context regeneration
- Function changes trigger rebuild (in development)

### Environment Setup
Example `.env` file:
```env
# Environment
NODE_ENV=development
PORT=3000

# Database (SQLite default)
DB_PATH=local.db

# For external databases (uncomment and configure)
# DATABASE_URL="postgresql://user:pass@localhost:5432/mydb"
# TURSO_URL="libsql://user:pass@host:port"
# TURSO_AUTH_TOKEN="your-turso-auth-token"

# Storage (uncomment and configure when implementing)
# STORAGE_PROVIDER=s3
# STORAGE_BUCKET=my-bucket
# AWS_ACCESS_KEY_ID=your-key
# AWS_SECRET_ACCESS_KEY=your-secret
# AWS_REGION=us-east-1

# Webhooks (uncomment and configure when implementing)
# WEBHOOK_SECRET=your-webhook-signing-secret
```

## Testing

### Test Structure
Tests are located in the `test/` directory:
- `crud.test.ts` - CRUD operation tests
- `health.test.ts` - Health check endpoint tests

### Running Tests
```bash
# Run all tests
bun run test

# Run tests in watch mode
bun run test:watch

# Run specific test file
bun run test ./test/crud.test.ts
```

### Test Framework
Uses Bun's built-in test runner:
- Assertions with `expect`
- Mocking capabilities
- Test grouping and filtering
- Coverage reporting

### Writing Tests
Example test structure:
```typescript
import { describe, it, expect } from 'bun:test';
import { serve } from 'hono/bun';
import { apiRoutes } from '../src/routes/index';

describe('Users API', () => {
  it('should create a user', async () => {
    const app = new Hono();
    app.route('/', apiRoutes);
    
    const res = await app.request('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'John Doe', email: 'john@example.com' })
    });
    
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.data).toHaveProperty('id');
    expect(data.data.name).toBe('John Doe');
  });
});
```

## Deployment

### Production Build
Create production-optimized build:
```bash
bun run build
```
Outputs to `dist/` directory with:
- Minified JavaScript
- Tree-shaken dependencies
- Optimized imports
- Production environment variables

### Deployment Options
The application can be deployed to various platforms:
- **Vercel**: Automatic deployment from Git
- **Netlify**: Continuous deployment from Git
- **AWS**: Elastic Beanstalk, Lambda, or ECS
- **Cloudflare Workers**: Serverless edge deployment
- **Deno Deploy**: Global edge network
- **Traditional VPS**: Any Node.js compatible host

### Environment Configuration
Production requires setting environment variables:
```bash
# Example for Vercel
vercel env add DATABASE_URL
vercel env add STORAGE_BUCKET
vercel env add AWS_ACCESS_KEY_ID
vercel env add AWS_SECRET_ACCESS_KEY
```

### Health Checks
Deployment platforms should check:
- `GET /api/health` - Basic health endpoint
- `GET /` - Root endpoint (serves frontend if applicable)
- WebSocket endpoint (`/ws`) - For realtime applications

### Scaling Considerations
For high-traffic applications:
1. **Database Connection Pooling**: Configure appropriate pool size
2. **Caching Layer**: Add Redis or similar for frequently accessed data
3. **CDN**: Serve static assets through CDN
4. **Load Balancer**: Distribute traffic across multiple instances
5. **Monitoring**: Implement application performance monitoring
6. **Logging**: Centralized logging for debugging and auditing

## Best Practices

### Code Organization
1. **Separation of Concerns**: Keep routes, middleware, and utilities separate
2. **Consistent Naming**: Use consistent naming conventions for files and functions
3. **Modular Design**: Break functionality into reusable modules
4. **Type Safety**: Leverage TypeScript for compile-time safety
5. **Error Handling**: Implement consistent error handling throughout

### Security
1. **Input Validation**: Validate all incoming data with Zod
2. **Authentication**: Protect sensitive endpoints with auth middleware
3. **Authorization**: Check permissions for resource access
4. **Input Sanitization**: Sanitize user input to prevent XSS
5. **Output Encoding**: Encode data appropriately for output context
6. **Environment Secrets**: Never commit secrets to version control

### Performance
1. **Database Indexes**: Index columns used in WHERE/JOIN/ORDER BY clauses
2. **Query Optimization**: Select only needed columns, avoid SELECT *
3. **Caching**: Cache expensive operations when appropriate
4. **Pagination**: Implement pagination for large result sets
5. **Connection Pooling**: Properly configure database connection pool
6. **Asset Optimization**: Minify and compress static assets

### Maintainability
1. **Documentation**: Comment complex logic and public APIs
2. **Testing**: Write tests for critical functionality
3. **Logging**: Use structured logging for debugging and monitoring
4. **Configuration**: Externalize configuration to environment variables
5. **Dependencies**: Keep dependencies updated and audited
6. **Code Reviews**: Implement peer review process for changes

## Related Resources

### BetterBase Documentation
- [Core SDK](./../core/overview.md) - Core functionality
- [Client SDK](./../client/overview.md) - Client-side SDK
- [CLI Reference](./../cli/overview.md) - Command-line interface
- [Shared Utilities](./../shared/overview.md) - Shared types and utilities

### Learning Resources
- [Getting Started Guide](https://betterbase.dev/docs/getting-started)
- [API Reference](https://betterbase.dev/docs/api)
- [Examples](https://betterbase.dev/examples)
- [Tutorials](https://betterbase.dev/tutorials)

### Community
- [GitHub Repository](https://github.com/betterbase/betterbase)
- [Discord Community](https://discord.gg/betterbase)
- [Twitter](https://twitter.com/betterbase)
- [Stack Overflow](https://stackoverflow.com/questions/tagged/betterbase)

---

*This document is part of the BetterBase documentation suite.*
*Last updated: 2026-03-26*