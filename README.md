# BetterBase Documentation

> An AI-native Backend-as-a-Service platform built for the modern web. Inspired by Supabase, powered by Bun.

---

## Table of Contents

1. [Introduction](#introduction)
2. [Architecture Overview](#architecture-overview)
3. [Getting Started](#getting-started)
4. [Core Concepts](#core-concepts)
5. [CLI Reference](#cli-reference)
6. [Client SDK](#client-sdk)
7. [Templates](#templates)
8. [API Reference](#api-reference)
9. [Best Practices](#best-practices)
10. [Maintenance & Troubleshooting](#maintenance--troubleshooting)

---

## Introduction

BetterBase is an AI-native Backend-as-a-Service (BaaS) platform that provides developers with a complete backend solution featuring database management, authentication, realtime subscriptions, and serverless API endpoints—all with sub-100ms startup times using Bun's native SQLite driver.

### Key Features

| Feature | Description |
|---------|-------------|
| **AI Context Generation** | Automatic `.betterbase-context.json` generation for AI-assisted development |
| **Sub-100ms Startup** | Lightning-fast local development with `bun:sqlite` |
| **Docker-less Dev** | Run everything locally without containerization overhead |
| **TypeScript First** | Full type inference and strict mode throughout |
| **BetterAuth Integration** | Production-ready authentication out of the box |
| **Realtime Subscriptions** | WebSocket-based live data updates |

### Tech Stack

- **Runtime**: [Bun](https://bun.sh) — All-in-one JavaScript runtime
- **Framework**: [Hono](https://hono.dev) — Ultrafast web framework
- **ORM**: [Drizzle ORM](https://orm.drizzle.team) — TypeScript-native database toolkit
- **Auth**: [BetterAuth](https://www.better-auth.com/) — Authentication framework
- **Monorepo**: [Turborepo](https://turbo.build/) — Build system for JavaScript/TypeScript
- **Dashboard**: [Next.js 15](https://nextjs.org/) — React framework with App Router

---

## Architecture Overview

BetterBase follows a modular monorepo architecture that separates concerns across specialized packages.

### System Design

```
┌─────────────────────────────────────────────────────────────────────┐
│                          BetterBase Platform                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────────┐  │
│  │   Dashboard  │    │     CLI      │    │    Client SDK        │  │
│  │  (Next.js 15) │    │  (@bb/cli)   │    │  (@betterbase/client)│  │
│  └──────┬───────┘    └──────┬───────┘    └──────────┬───────────┘  │
│         │                   │                       │               │
│         └───────────────────┼───────────────────────┘               │
│                             │                                        │
│                      ┌──────▼───────┐                                │
│                      │   Templates  │                                │
│                      │  (base/auth) │                                │
│                      └──────┬───────┘                                │
│                             │                                        │
│         ┌───────────────────┼───────────────────┐                   │
│         │                   │                   │                    │
│  ┌──────▼───────┐    ┌──────▼───────┐    ┌──────▼───────┐         │
│  │     Core     │    │    Shared    │    │    Client    │         │
│  │  (stub)     │    │  (utilities) │    │   (SDK)      │         │
│  └─────────────┘    └──────────────┘    └──────────────┘         │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                    Hono API Server                          │    │
│  │  ┌─────────┐  ┌─────────┐  ┌──────────┐  ┌─────────────┐   │    │
│  │  │ Routes  │  │ Auth    │  │ Database │  │  Realtime   │   │    │
│  │  └─────────┘  └─────────┘  └──────────┘  └─────────────┘   │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                             │                                        │
│                      ┌──────▼───────┐                                │
│                      │    SQLite    │                                │
│                      │ (bun:sqlite) │                                │
│                      └──────────────┘                                │
└─────────────────────────────────────────────────────────────────────┘
```

### Package Overview

| Package | Location | Purpose |
|---------|----------|---------|
| `@betterbase/cli` | [`packages/cli`](packages/cli) | Command-line tool for project management |
| `@betterbase/client` | [`packages/client`](packages/client) | TypeScript SDK for frontend integration |
| `@betterbase/core` | [`packages/core`](packages/core) | Core backend engine (stub) |
| `@betterbase/shared` | [`packages/shared`](packages/shared) | Shared utilities and types |
| Dashboard | [`apps/dashboard`](apps/dashboard) | Next.js 15 admin studio |
| Base Template | [`templates/base`](templates/base) | Bun + Hono + Drizzle starter |
| Auth Template | [`templates/auth`](templates/auth) | Template with BetterAuth |

---

## Getting Started

### Prerequisites

Before using BetterBase, ensure you have the following installed:

- **Bun** ≥ 1.0.0 — [Installation Guide](https://bun.sh/docs/installation)
- **Node.js** ≥ 18.0.0 (for some packages)
- **Git** — Version control

```bash
# Verify Bun installation
bun --version

# Verify Node.js (if needed)
node --version
```

### Quick Start

#### 1. Initialize a New Project

```bash
# Create a new BetterBase project
bunx @betterbase/cli init my-project

# Or use the base template directly
bun create betterbase my-project
```

#### 2. Navigate to Project Directory

```bash
cd my-project
```

#### 3. Install Dependencies

```bash
bun install
```

#### 4. Configure Environment

Create a `.env` file in your project root:

```bash
# Server Configuration
PORT=3000
NODE_ENV=development

# Database (SQLite by default)
DB_PATH=local.db
```

#### 5. Run Development Server

```bash
bun run dev
```

Your server is now running at `http://localhost:3000`.

---

## Core Concepts

### Database

BetterBase uses **Drizzle ORM** with SQLite for local development. The schema is defined in [`src/db/schema.ts`](templates/base/src/db/schema.ts).

#### Schema Helpers

The base template provides utility helpers for common patterns:

```typescript
import { timestamps, uuid, softDelete, statusEnum, jsonColumn } from './db/schema';

// Timestamps (created_at, updated_at)
export const posts = sqliteTable('posts', {
  id: uuid(),           // UUID primary key
  title: text('title').notNull(),
  status: statusEnum(), // 'active' | 'inactive' | 'pending'
  metadata: jsonColumn<{ key: string }>('metadata'),
  ...timestamps,        // Auto-managed timestamps
  ...softDelete,        // Soft delete (deleted_at)
});
```

#### Database Operations

```typescript
import { db } from './db';
import { users } from './db/schema';

// Query with Drizzle
const allUsers = await db.select().from(users).where(eq(users.status, 'active'));

// Insert
const [newUser] = await db.insert(users).values({
  id: crypto.randomUUID(),
  email: 'user@example.com',
  name: 'John Doe',
}).returning();

// Update
const [updated] = await db.update(users)
  .set({ name: 'Jane Doe' })
  .where(eq(users.id, userId))
  .returning();
```

### Authentication

BetterBase integrates **BetterAuth** for complete authentication functionality:

- Email/password authentication
- Session management with cookies
- OAuth providers (optional)
- Protected routes middleware

#### Auth Middleware

```typescript
import { requireAuth } from './middleware/auth';

app.get('/protected', requireAuth, async (c) => {
  const user = c.get('user');
  return c.json({ message: `Hello, ${user.name}!` });
});
```

### Realtime

WebSocket-based realtime subscriptions for live data updates:

```typescript
// Subscribe to table changes
const subscription = client.realtime
  .from('posts')
  .on('INSERT', (payload) => {
    console.log('New post:', payload.data);
  })
  .subscribe();
```

### AI Context (`.betterbase-context.json`)

The CLI automatically generates an AI context file that helps AI assistants understand your schema and API routes:

```json
{
  "version": 1,
  "tables": {
    "users": {
      "columns": {
        "id": "text (uuid)",
        "email": "text (unique)",
        "name": "text",
        "status": "text (enum: active, inactive, pending)"
      }
    }
  },
  "routes": {
    "GET /api/users": "List all users",
    "POST /api/users": "Create user"
  }
}
```

---

## CLI Reference

The BetterBase CLI (`bb`) provides commands for project management:

### Global Options

| Option | Description |
|--------|-------------|
| `-v, --version` | Display CLI version |
| `--help` | Show help information |

### Commands

#### `bb init [project-name]`

Initialize a new BetterBase project.

```bash
# Create project in current directory
bb init

# Create project in specified directory
bb init my-project
```

#### `bb dev [project-root]`

Watch schema and route files, regenerating `.betterbase-context.json` on changes.

```bash
# Watch current directory
bb dev

# Watch specific project
bb dev ./my-project
```

**Features:**
- Watches `src/db/schema.ts` for database changes
- Watches `src/routes` for API route changes
- Debounces regeneration (250ms)
- Automatic cleanup on exit

#### `bb migrate`

Generate and apply database migrations.

```bash
# Generate and apply migrations locally
bb migrate

# Preview migration diff without applying
bb migrate preview

# Apply migrations to production
bb migrate production
```

**Migration Features:**
- Automatic backup before destructive changes
- Destructive change detection
- SQL statement parsing
- Rollback on failure

#### `bb auth setup [project-root]`

Install and scaffold BetterAuth integration.

```bash
# Set up auth in current project
bb auth setup

# Set up auth in specific project
bb auth setup ./my-project
```

#### `bb generate crud <table-name> [project-root]`

Generate full CRUD routes for a table.

```bash
# Generate CRUD for 'posts' table
bb generate crud posts

# Generate CRUD in specific project
bb generate crud posts ./my-project
```

**Generated Endpoints:**

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/{table}` | List all records (paginated) |
| `GET` | `/api/{table}/:id` | Get single record |
| `POST` | `/api/{table}` | Create new record |
| `PATCH` | `/api/{table}/:id` | Update record |
| `DELETE` | `/api/{table}/:id` | Delete record |

---

## Client SDK

The `@betterbase/client` package provides a TypeScript SDK for frontend integration.

### Installation

```bash
bun add @betterbase/client
# or
npm install @betterbase/client
```

### Creating a Client

```typescript
import { createClient } from '@betterbase/client';

const client = createClient({
  url: 'http://localhost:3000',
  key: 'your-anon-key', // Optional: for service-level access
});
```

### Configuration Options

```typescript
interface BetterBaseConfig {
  url: string;                    // Your backend URL
  key?: string;                  // Anonymous key for auth
  schema?: string;               // Database schema (optional)
  fetch?: typeof fetch;          // Custom fetch implementation
  storage?: {
    getItem: (key: string) => string | null;
    setItem: (key: string, value: string) => void;
    removeItem: (key: string) => void;
  };
}
```

### Query Builder

The query builder provides a chainable API for database operations:

```typescript
// Select with filters
const { data, error } = await client
  .from('users')
  .select('id, name, email')
  .eq('status', 'active')
  .order('createdAt', 'desc')
  .limit(10)
  .execute();

// Get single record
const { data, error } = await client
  .from('users')
  .single(userId);

// Insert record
const { data, error } = await client
  .from('users')
  .insert({
    email: 'new@example.com',
    name: 'New User',
  });

// Update record
const { data, error } = await client
  .from('users')
  .update(userId, { name: 'Updated Name' });

// Delete record
const { data, error } = await client
  .from('users')
  .delete(userId);
```

### Query Builder Methods

| Method | Description |
|--------|-------------|
| `.select(fields)` | Select specific fields (default: `*`) |
| `.eq(column, value)` | Filter by equality |
| `.in(column, values)` | Filter by values in array |
| `.order(column, direction)` | Sort results (`asc` or `desc`) |
| `.limit(count)` | Limit results count |
| `.offset(count)` | Offset results for pagination |
| `.single(id)` | Get single record by ID |
| `.insert(data)` | Insert new record |
| `.update(id, data)` | Update existing record |
| `.delete(id)` | Delete record |

### Authentication

```typescript
// Sign up
const { data, error } = await client.auth.signUp(
  'user@example.com',
  'password123',
  'John Doe'
);

// Sign in
const { data, error } = await client.auth.signIn(
  'user@example.com',
  'password123'
);

// Get current session
const { data, error } = await client.auth.getSession();

// Sign out
const { error } = await client.auth.signOut();
```

### Authentication Methods

| Method | Parameters | Description |
|--------|------------|-------------|
| `.signUp(email, password, name)` | `string, string, string` | Create new account |
| `.signIn(email, password)` | `string, string` | Sign in with credentials |
| `.signOut()` | — | End current session |
| `.getSession()` | — | Get current session |
| `.getToken()` | — | Get stored token |

### Realtime Subscriptions

```typescript
// Subscribe to INSERT events
const insertSub = client.realtime
  .from('messages')
  .on('INSERT', (payload) => {
    console.log('New message:', payload.data);
  })
  .subscribe();

// Subscribe to UPDATE events
const updateSub = client.realtime
  .from('messages')
  .on('UPDATE', (payload) => {
    console.log('Updated message:', payload.data);
  })
  .subscribe();

// Subscribe to all events
const allSub = client.realtime
  .from('messages')
  .on('*', (payload) => {
    console.log('Any change:', payload.event, payload.data);
  })
  .subscribe();

// Unsubscribe
insertSub.unsubscribe();
```

### Error Handling

```typescript
import { BetterBaseError, NetworkError, AuthError, ValidationError } from '@betterbase/client';

const { data, error } = await client.from('users').execute();

if (error) {
  if (error instanceof NetworkError) {
    console.error('Network issue:', error.message);
  } else if (error instanceof AuthError) {
    console.error('Auth failed:', error.message);
  } else if (error instanceof ValidationError) {
    console.error('Validation error:', error.message);
  } else if (error instanceof BetterBaseError) {
    console.error('API error:', error.message, error.code);
  }
}
```

---

## Templates

BetterBase provides starter templates for different use cases.

### Base Template

Location: [`templates/base`](templates/base)

The base template includes:

- **Bun** runtime with TypeScript strict mode
- **Hono** API server
- **Drizzle ORM** with SQLite
- **Zod** for request validation
- **WebSocket** realtime support

#### Project Structure

```
templates/base/
├── src/
│   ├── db/
│   │   ├── index.ts      # Database connection
│   │   ├── schema.ts     # Drizzle schema
│   │   └── migrate.ts    # Migration utilities
│   ├── routes/
│   │   ├── index.ts      # Route registration
│   │   ├── health.ts     # Health check endpoint
│   │   └── users.ts      # User CRUD endpoints
│   ├── middleware/
│   │   ├── auth.ts       # Auth middleware
│   │   └── validation.ts # Request validation
│   ├── lib/
│   │   ├── env.ts        # Environment validation
│   │   └── realtime.ts   # WebSocket handler
│   └── index.ts          # App entry point
├── betterbase.config.ts  # BetterBase configuration
├── drizzle.config.ts     # Drizzle configuration
└── package.json
```

#### Quick Start

```bash
# Create from template
bun create betterbase my-app

cd my-app

# Install dependencies
bun install

# Start development
bun run dev
```

#### Available Scripts

| Script | Description |
|--------|-------------|
| `bun run dev` | Start development server |
| `bun run build` | Build for production |
| `bun run start` | Start production server |
| `bun run db:generate` | Generate Drizzle migrations |
| `bun run db:push` | Push schema to database |

### Auth Template

Location: [`templates/auth`](templates/auth)

The auth template extends the base template with BetterAuth integration:

- Email/password authentication
- Session management
- Protected routes
- TypeScript types for users and sessions

#### Getting Started

```bash
# Create auth template
bun create betterbase my-app --template auth

cd my-app

# Install dependencies
bun install

# Configure environment
cp .env.example .env
# Edit .env with your AUTH_SECRET

# Run migrations
bun run db:push

# Start development
bun run dev
```

#### Environment Variables

```bash
# Required
AUTH_SECRET=your-secret-key-change-in-production
AUTH_URL=http://localhost:3000

# Optional (for production)
DATABASE_URL=your-production-database-url
```

#### Auth API Endpoints

BetterAuth automatically provides these endpoints:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/auth/signup` | `POST` | Create new account |
| `/api/auth/signin` | `POST` | Sign in to account |
| `/api/auth/signout` | `POST` | Sign out |
| `/api/auth/get-session` | `GET` | Get current session |
| `/api/auth/verify-email` | `POST` | Verify email address |
| `/api/auth/forgot-password` | `POST` | Request password reset |
| `/api/auth/reset-password` | `POST` | Reset password |

---

## API Reference

### REST API Patterns

BetterBase follows RESTful conventions with the following patterns:

#### List Records

```http
GET /api/{table}?select=field1,field2&status=active&sort=createdAt:desc&limit=20&offset=0
```

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `select` | string | Comma-separated fields to select |
| `{column}` | string | Filter by column value |
| `{column}_in` | JSON array | Filter by values in array |
| `sort` | string | Sort format: `column:direction` |
| `limit` | number | Results limit (default: 50, max: 100) |
| `offset` | number | Results offset for pagination |

**Response:**

```json
{
  "users": [
    { "id": "uuid", "name": "John", "email": "john@example.com" }
  ],
  "pagination": {
    "limit": 50,
    "offset": 0,
    "hasMore": false
  }
}
```

#### Get Single Record

```http
GET /api/{table}/{id}
```

#### Create Record

```http
POST /api/{table}
Content-Type: application/json

{
  "field1": "value1",
  "field2": "value2"
}
```

#### Update Record

```http
PATCH /api/{table}/{id}
Content-Type: application/json

{
  "field1": "updated value"
}
```

#### Delete Record

```http
DELETE /api/{table}/{id}
```

### Authentication

#### Anonymous Access

Clients can make requests without authentication for public resources:

```typescript
const client = createClient({
  url: 'http://localhost:3000',
});
```

#### Authenticated Access

Include the session token in requests:

```typescript
// After sign in, the client automatically includes the token
const { data } = await client.auth.signIn('user@example', 'password');

// All subsequent requests include Authorization header
const { data } = await client.from('posts').execute();
```

### Rate Limiting

> **Note:** Rate limiting is planned for future implementation.

### WebSocket (Realtime)

Connect to the WebSocket endpoint for realtime updates:

```typescript
const ws = new WebSocket('ws://localhost:3000/ws?token=<session-token>');

// Subscribe
ws.send(JSON.stringify({
  type: 'subscribe',
  table: 'messages',
  filter: { status: 'active' }
}));

// Receive updates
ws.onmessage = (event) => {
  const { type, table, event: eventType, data } = JSON.parse(event.data);
  console.log(`${table}:${eventType}`, data);
};
```

---

## Best Practices

### Database Design

#### Use UUIDs for IDs

```typescript
// Always use UUID for primary keys
import { uuid } from './db/schema';

export const posts = sqliteTable('posts', {
  id: uuid(), // Generates: crypto.randomUUID()
  // ...
});
```

#### Add Timestamps

```typescript
import { timestamps } from './db/schema';

export const posts = sqliteTable('posts', {
  id: uuid(),
  // ...
  ...timestamps, // Adds createdAt and updatedAt
});
```

#### Use Enums for Status Fields

```typescript
import { statusEnum } from './db/schema';

export const orders = sqliteTable('orders', {
  id: uuid(),
  status: statusEnum(), // 'active' | 'inactive' | 'pending'
  // ...
});
```

### Security

#### Never Expose Secret Keys

```typescript
// ✅ GOOD: Server-side only
import { env } from './lib/env';
const secretKey = env.AUTH_SECRET;

// ❌ BAD: Client-side exposure
const client = createClient({
  url: 'http://localhost:3000',
  key: 'secret-key', // Never do this!
});
```

#### Validate Input Data

```typescript
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';

const createSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(100),
  age: z.number().int().min(0).optional(),
});

app.post('/users', zValidator('json', createSchema), async (c) => {
  const body = c.req.valid('json');
  // body is now type-safe
});
```

#### Use Protected Routes

```typescript
import { requireAuth } from './middleware/auth';

// This route requires authentication
app.get('/profile', requireAuth, async (c) => {
  const user = c.get('user');
  return c.json({ profile: user });
});
```

### Performance

#### Use Pagination

```typescript
// ✅ GOOD: Paginated queries
const { data } = await client
  .from('posts')
  .limit(20)
  .offset(page * 20)
  .execute();

// ❌ BAD: No limits
const { data } = await client.from('posts').execute(); // May return thousands!
```

#### Select Only Needed Fields

```typescript
// ✅ GOOD: Specific fields
const { data } = await client
  .from('users')
  .select('id, name')
  .execute();

// ❌ BAD: All fields
const { data } = await client
  .from('users')
  .select('*')
  .execute();
```

#### Unsubscribe from Realtime

```typescript
// Always unsubscribe when done
const subscription = client.realtime
  .from('messages')
  .on('INSERT', handleMessage)
  .subscribe();

// Later, when no longer needed
subscription.unsubscribe();
```

### Project Structure

#### Organize Routes by Resource

```
src/routes/
├── index.ts      # Route registration
├── users.ts      # User CRUD
├── posts.ts      # Post CRUD
├── comments.ts   # Comment CRUD
└── auth.ts       # Authentication
```

#### Use Middleware for Cross-Cutting Concerns

```typescript
// src/middleware/logging.ts
export const loggingMiddleware = async (c, next) => {
  const start = Date.now();
  await next();
  const duration = Date.now() - start;
  console.log(`${c.req.method} ${c.req.url} - ${duration}ms`);
};

// Usage
app.use('*', loggingMiddleware);
```

---

## Maintenance & Troubleshooting

### Database Migrations

#### Generating Migrations

```bash
# After modifying schema.ts, generate migrations
bun run db:generate

# Or use CLI
bb migrate
```

#### Previewing Migrations

```bash
# See what will change without applying
bb migrate preview
```

#### Applying Migrations

```bash
# Local development
bb migrate

# Production (with confirmation)
bb migrate production
```

### Troubleshooting Common Issues

#### "Database locked" Error

This occurs when multiple processes access SQLite simultaneously.

**Solution:**
```bash
# Close any other connections to the database
# Restart the dev server
bun run dev
```

#### Migration Conflicts

If migrations fail with conflict errors:

1. Review the migration files in `drizzle/`
2. Resolve conflicts manually
3. Re-run migration

```bash
bb migrate preview
```

#### TypeScript Errors

If you encounter TypeScript errors:

1. Clear the build cache:
```bash
rm -rf node_modules/.cache
bun run build
```

2. Verify `tsconfig.json` extends the base config:
```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "strict": true
  }
}
```

#### WebSocket Connection Issues

If realtime subscriptions fail to connect:

1. Verify WebSocket endpoint is enabled
2. Check firewall settings
3. Ensure browser supports WebSocket

```typescript
// Debug WebSocket
const ws = new WebSocket('ws://localhost:3000/ws');
ws.onerror = (error) => console.error('WS Error:', error);
ws.onopen = () => console.log('Connected!');
```

### Monitoring

#### Health Checks

Always verify server health before deploying:

```bash
curl http://localhost:3000/api/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

#### Logging

Enable debug logging in development:

```typescript
// In your app
console.log('[BetterBase] Request:', c.req.method, c.req.url);
```

### Deployment Checklist

Before deploying to production:

- [ ] Set `NODE_ENV=production`
- [ ] Configure production database (not SQLite)
- [ ] Set secure `AUTH_SECRET` (min 32 characters)
- [ ] Configure `AUTH_URL` to production domain
- [ ] Run migrations on production database
- [ ] Set up proper CORS configuration
- [ ] Enable HTTPS/SSL
- [ ] Configure rate limiting (future)
- [ ] Set up monitoring and alerting

### Environment Configuration

#### Development

```bash
NODE_ENV=development
PORT=3000
DB_PATH=local.db
```

#### Production

```bash
NODE_ENV=production
PORT=3000
AUTH_SECRET=your-secure-secret-min-32-chars
AUTH_URL=https://your-domain.com
DATABASE_URL=postgresql://user:pass@host:5432/db
```

---

## Contributing

Contributions are welcome! Please read our contributing guidelines before submitting PRs.

### Development Setup

```bash
# Clone the repository
git clone https://github.com/betterbase/betterbase.git
cd betterbase

# Install dependencies
bun install

# Build all packages
bun run build

# Run tests
bun test

# Start development
bun run dev
```

---

## License

MIT License — see [LICENSE](LICENSE) for details.

---

## Support

- **Documentation**: [docs.betterbase.io](https://docs.betterbase.io)
- **GitHub Issues**: [github.com/betterbase/betterbase/issues](https://github.com/betterbase/betterbase/issues)
- **Discord**: [discord.gg/betterbase](https://discord.gg/betterbase)

---

*Last updated: February 2026*
