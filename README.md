# Betterbase

<div align="center">

<!-- Badges -->

[![License](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Build Status](https://img.shields.io/badge/build-passing-brightgreen)](https://github.com/betterbase/betterbase/actions)
[![Bun](https://img.shields.io/badge/Bun-v1.2+-red)](https://bun.sh)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)](https://www.typescriptlang.org)
[![Discord](https://img.shields.io/badge/Discord-Join-purple)](https://discord.gg/betterbase)
[![Twitter](https://img.shields.io/badge/Twitter-Follow-blue)](https://twitter.com/betterbase)

<!-- Tagline -->

**The AI-Native Backend-as-a-Service Platform**

Betterbase is an open-source alternative to Supabase, built with Bun for blazing-fast performance. It provides database, authentication, realtime subscriptions, storage, and serverless functions with sub-100ms local dev using Bun + SQLite.

</div>

---

## Why Betterbase?

Traditional backend development is slow. You spend weeks setting up databases, authentication, APIs, and infrastructure before writing business logic. Betterbase changes that.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         BETTERBASE ARCHITECTURE                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   ┌──────────────┐     ┌──────────────┐     ┌──────────────┐          │
│   │   Frontend   │────▶│   Betterbase │────▶│   Database   │          │
│   │   (React,    │     │     Core     │     │  (SQLite,    │          │
│   │    Vue,      │     │              │     │   Postgres,  │          │
│   │    Mobile)   │     │  ┌────────┐  │     │   MySQL,     │          │
│   └──────────────┘     │  │ Auth   │  │     │   Neon...)   │          │
│                        │  ├────────┤  │     └──────────────┘          │
│   ┌──────────────┐     │  │ Realtime│  │                                │
│   │  Serverless  │────▶│  ├────────┤  │     ┌──────────────┐          │
│   │  Functions  │     │  │Storage │  │     │  S3 Storage  │          │
│   └──────────────┘     │  ├────────┤  │     └──────────────┘          │
│                        │  │GraphQL │  │                                │
│   ┌──────────────┐     │  ├────────┤  │     ┌──────────────┐          │
│   │   Webhooks   │────▶│  │  RLS   │  │     │  External   │          │
│   └──────────────┘     │  └────────┘  │     │  Services   │          │
│                        └──────────────┘     └──────────────┘          │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Features

Betterbase provides a complete backend solution with enterprise-grade features:

| Feature | Description |
|---------|-------------|
| 🚀 **AI Context Generation** | AI-powered context awareness that understands your schema and generates intelligent queries, migrations, and code suggestions |
| ⚡ **Sub-100ms Startup** | Local development starts in under 100ms using Bun's native performance |
| 🐳 **Docker-less Dev** | No Docker required. Run everything natively with Bun + SQLite |
| 🔒 **TypeScript-first** | Full TypeScript support with auto-generated types for all operations |
| 🔐 **BetterAuth Integration** | Enterprise-grade authentication with 30+ providers, session management, and security features |
| 📡 **Realtime Subscriptions** | WebSocket-based realtime data sync with sub-second latency |
| 🗄️ **Multi-Provider Support** | Connect to SQLite, PostgreSQL, MySQL, Neon, Turso, and PlanetScale |
| 🛡️ **Row Level Security** | Fine-grained access control policies at the database level |
| ⚡ **Serverless Functions** | Deploy TypeScript functions that scale automatically |
| 💾 **S3 Storage** | Compatible file storage with AWS S3 SDK |
| 🔗 **Webhooks** | Event-driven architecture with configurable webhook triggers |

---

## Quick Start

### Installation

Install the Betterbase CLI globally:

```bash
bun install -g @betterbase/cli
```

Verify installation:

```bash
bb --version
```

### Initialize a New Project

Create a new Betterbase project:

```bash
bb init my-project
cd my-project
```

This creates the following structure:

```
my-project/
├── betterbase.config.ts
├── drizzle.config.ts
├── src/
│   ├── db/
│   │   ├── schema.ts
│   │   └── migrate.ts
│   ├── functions/
│   ├── auth/
│   └── routes/
└── package.json
```

### Configure Your Database

Edit `betterbase.config.ts`:

```typescript
import { defineConfig } from '@betterbase/core'

export default defineConfig({
  database: {
    provider: 'sqlite', // or 'postgres', 'mysql', 'neon', 'turso', 'planetscale'
    connectionString: process.env.DATABASE_URL || 'file:./dev.db'
  },
  auth: {
    providers: ['email', 'github', 'google'],
    sessionExpiry: 7 * 24 * 60 * 60 * 1000 // 7 days
  },
  storage: {
    provider: 'local', // or 's3'
    bucket: 'uploads'
  },
  graphql: {
    enabled: true,
    playground: true
  }
})
```

### Define Your Schema

Edit `src/db/schema.ts`:

```typescript
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'
import { relations } from 'drizzle-orm'

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(new Date())
})

export const posts = sqliteTable('posts', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  content: text('content'),
  userId: text('user_id').references(() => users.id),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(new Date())
})

export const usersRelations = relations(users, ({ many }) => ({
  posts: many(posts)
}))

export const postsRelations = relations(posts, ({ one }) => ({
  user: one(users, {
    fields: [posts.userId],
    references: [users.id]
  })
}))
```

### Run the Development Server

```bash
bb dev
```

Your backend is now running at `http://localhost:3000`:

| Endpoint | Description |
|----------|-------------|
| `http://localhost:3000` | API root |
| `http://localhost:3000/rest/v1/*` | REST API |
| `http://localhost:3000/graphql` | GraphQL playground |
| `http://localhost:3000/auth/*` | Authentication endpoints |
| `http://localhost:3000/storage/*` | Storage endpoints |
| `http://localhost:3000/realtime/*` | Realtime subscriptions |

---

## Architecture Overview

### System Design

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          CLIENT LAYER                                    │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │
│  │   Web SDK   │  │  React Hooks│  │   Mobile    │  │   GraphQL   │    │
│  │  @betterbase│  │   @betterbase│  │  SDK        │  │   Client    │    │
│  │   /client   │  │   /client   │  │             │  │             │    │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘    │
└─────────┼────────────────┼────────────────┼────────────────┼──────────┘
          │                │                │                │
          ▼                ▼                ▼                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                          API GATEWAY (Hono)                             │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  REST API  │  GraphQL  │  Auth  │  Storage  │  Realtime  │  Webhooks│   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      CORE SERVICES LAYER                                │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │  Query   │  │  Auth    │  │ Realtime │  │ Storage  │  │Function │  │
│  │  Engine  │  │ Service  │  │ Service  │  │ Service  │  │Runtime  │  │
│  │ (Drizzle)│  │(BetterAuth│  │(WebSocket)│ │  (S3)   │  │ (Bun)   │  │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘  │
│       │            │            │            │            │         │
│       └────────────┴────────────┴────────────┴────────────┘         │
│                              │                                         │
└──────────────────────────────┼────────────────────────────────────────┘
                               ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      DATA LAYER                                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │ SQLite   │  │PostgreSQL│  │  MySQL   │  │  Neon    │  │  Turso   │  │
│  │(dev)     │  │          │  │          │  │(serverless│  │(libSQL)  │  │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘  └──────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

### Package Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        TURBOREPO MONOREPO                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                     @betterbase/cli                              │   │
│  │  CLI tool with 11 commands for development and deployment       │   │
│  │  init, dev, migrate, auth, generate, function, graphql, login,   │   │
│  │  rls, storage, webhook                                           │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                     @betterbase/client                           │   │
│  │  TypeScript SDK for frontend integration                         │   │
│  │  Auth, Query Builder, Realtime, Storage                         │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                     @betterbase/core                             │   │
│  │  Core backend engine with all server-side functionality         │   │
│  │  Database, Auth, GraphQL, RLS, Storage, Webhooks, Functions    │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                     @betterbase/shared                          │   │
│  │  Shared utilities, types, constants, and validation schemas     │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Technology Stack

| Technology | Purpose | Why |
|------------|---------|-----|
| **Bun** | Runtime | 3x faster than Node.js, native TypeScript support, built-in bundler |
| **Hono** | Web Framework | Fast, lightweight, works on any runtime (Cloudflare Workers, Deno, Bun) |
| **Drizzle ORM** | Database | Type-safe, lightweight, SQL-like syntax, migrations built-in |
| **BetterAuth** | Authentication | Extensible, secure, 30+ providers, session management |
| **Pothos + graphql-yoga** | GraphQL | Type-safe GraphQL schema builder with modern features |
| **Turborepo** | Monorepo | Efficient caching, parallel builds, remote caching |
| **AWS S3 SDK** | Storage | Industry-standard object storage compatibility |
| **Zod** | Validation | TypeScript-first schema validation |

---

## CLI Reference

The Betterbase CLI (`bb`) provides 11 commands for development and deployment:

### Core Commands

#### `bb init [name]`

Initialize a new Betterbase project.

```bash
# Create in current directory
bb init

# Create in specific directory
bb init my-project

# With template
bb init my-project --template auth
```

#### `bb dev`

Start the development server with hot reload.

```bash
# Default port (3000)
bb dev

# Custom port
bb dev --port 8080

# With specific config
bb dev --config production.config.ts
```

#### `bb migrate`

Run database migrations.

```bash
# Generate migration from schema changes
bb migrate generate my-migration

# Apply pending migrations
bb migrate up

# Rollback last migration
bb migrate down

# Reset database (warning: destructive)
bb migrate reset
```

### Authentication

#### `bb auth`

Manage authentication configuration.

```bash
# Setup authentication
bb auth setup

# Add provider
bb auth add-provider github

# List providers
bb auth list-providers
```

### Code Generation

#### `bb generate`

Generate types, CRUD operations, and more.

```bash
# Generate TypeScript types
bb generate types

# Generate CRUD operations
bb generate crud

# Generate everything
bb generate all
```

### Serverless Functions

#### `bb function`

Manage serverless functions.

```bash
# Create new function
bb function create my-function

# Deploy function
bb function deploy my-function

# List functions
bb function list

# Invoke function locally
bb function invoke my-function
```

### GraphQL

#### `bb graphql`

GraphQL schema management.

```bash
# Start GraphQL server
bb graphql start

# Export schema
bb graphql schema export

# Validate schema
bb graphql schema validate
```

### Authentication (User Management)

#### `bb login`

Manage user authentication.

```bash
# Login user
bb login --email user@example.com

# Logout user
bb logout

# Get current session
bb login status
```

### Security

#### `bb rls`

Manage Row Level Security policies.

```bash
# Add RLS policy
bb rls add --table posts --name users-own-posts --command SELECT --check "user_id = auth.uid()"

# List policies
bb rls list --table posts

# Disable RLS
bb rls disable --table posts

# Enable RLS
bb rls enable --table posts
```

### Storage

#### `bb storage`

Manage file storage.

```bash
# Setup storage
bb storage setup

# Create bucket
bb storage create-bucket avatars

# List buckets
bb storage list

# Upload file
bb storage upload avatars avatar.png
```

### Webhooks

#### `bb webhook`

Manage webhooks.

```bash
# Create webhook
bb webhook create --url https://example.com/hook --events "insert,update,delete"

# List webhooks
bb webhook list

# Test webhook
bb webhook test my-webhook

# Delete webhook
bb webhook delete my-webhook
```

---

## Client SDK

Install the client SDK:

```bash
bun add @betterbase/client
```

### Initialization

```typescript
import { createClient } from '@betterbase/client'

const client = createClient({
  baseUrl: 'http://localhost:3000',
  auth: {
    persistSession: true,
    autoRefreshToken: true
  }
})
```

### Authentication

#### Sign Up

```typescript
const { data, error } = await client.auth.signUp({
  email: 'user@example.com',
  password: 'secure-password',
  name: 'John Doe'
})

if (error) {
  console.error('Signup failed:', error.message)
} else {
  console.log('User created:', data.user)
}
```

#### Sign In

```typescript
const { data, error } = await client.auth.signInWithPassword({
  email: 'user@example.com',
  password: 'secure-password'
})

if (error) {
  console.error('Login failed:', error.message)
} else {
  console.log('Logged in:', data.session)
}
```

#### Sign In with Provider

```typescript
// GitHub OAuth
const { data, error } = await client.auth.signInWithOAuth({
  provider: 'github'
})

// Google OAuth
const { data, error } = await client.auth.signInWithOAuth({
  provider: 'google'
})
```

#### Sign Out

```typescript
await client.auth.signOut()
```

#### Get Current User

```typescript
const { data: { user }, error } = await client.auth.getUser()

if (user) {
  console.log('Current user:', user)
}
```

### Query Builder

#### Select

```typescript
// Get all posts
const { data: posts, error } = await client
  .from('posts')
  .select()

// Select with filters
const { data: posts, error } = await client
  .from('posts')
  .select('id, title, content, user:users(name)')
  .eq('published', true)
  .order('createdAt', { ascending: false })
  .limit(10)

// Single record
const { data: post, error } = await client
  .from('posts')
  .select()
  .eq('id', 'post-123')
  .single()
```

#### Insert

```typescript
const { data, error } = await client
  .from('posts')
  .insert({
    title: 'My New Post',
    content: 'Post content here',
    userId: 'user-123'
  })
```

#### Update

```typescript
const { data, error } = await client
  .from('posts')
  .update({
    title: 'Updated Title'
  })
  .eq('id', 'post-123')
```

#### Delete

```typescript
const { data, error } = await client
  .from('posts')
  .delete()
  .eq('id', 'post-123')
```

### Realtime Subscriptions

```typescript
// Subscribe to table changes
const channel = client.channel('public:posts')

channel
  .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'posts' }, 
    (payload) => {
      console.log('New post:', payload.new)
    }
  )
  .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'posts' },
    (payload) => {
      console.log('Updated post:', payload.new)
    }
  )
  .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'posts' },
    (payload) => {
      console.log('Deleted post:', payload.old)
    }
  )
  .subscribe()

// Unsubscribe when done
channel.unsubscribe()
```

### Storage

#### Upload File

```typescript
const { data, error } = await client
  .storage
  .upload('avatars', 'user-avatar.png', file)
```

#### Download File

```typescript
const { data, error } = await client
  .storage
  .download('avatars', 'user-avatar.png')
```

#### Get Public URL

```typescript
const { data: { url } } = client
  .storage
  .getPublicUrl('avatars', 'user-avatar.png')
```

#### Delete File

```typescript
await client
  .storage
  .remove('avatars', 'user-avatar.png')
```

---

## Deployment Options

### Local Development

The easiest way to get started:

```bash
bb init my-project
cd my-project
bb dev
```

Uses SQLite by default for zero-configuration development.

### Production (Bun)

Deploy to any Bun-compatible host:

```bash
# Build for production
bun run build

# Start production server
bun run start
```

### Docker

Create a `Dockerfile`:

```dockerfile
FROM oven/bun:1 AS base
WORKDIR /app

FROM base AS deps
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN bun run build

FROM base
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY package.json ./

EXPOSE 3000
CMD ["bun", "run", "start"]
```

Build and run:

```bash
docker build -t betterbase-app .
docker run -p 3000:3000 betterbase-app
```

### Cloud Providers

| Provider | Deployment Method |
|----------|-------------------|
| **Railway** | `bb deploy` or Docker |
| **Render** | Docker |
| **Fly.io** | Docker |
| **Vercel** | Edge Functions |
| **AWS Lambda** | Serverless Framework |
| **Cloudflare Workers** | `wrangler` |

---

## Configuration

### betterbase.config.ts

```typescript
import { defineConfig } from '@betterbase/core'

export default defineConfig({
  // Database configuration
  database: {
    provider: 'sqlite',
    connectionString: process.env.DATABASE_URL || 'file:./dev.db',
    // For connection pooling (PostgreSQL)
    pool: {
      min: 2,
      max: 10
    }
  },

  // Authentication
  auth: {
    providers: ['email', 'github', 'google', 'discord'],
    email: {
      confirmEmail: true,
      passwordMinLength: 8
    },
    session: {
      expiry: 7 * 24 * 60 * 60 * 1000, // 7 days
      refreshTokenExpiry: 30 * 24 * 60 * 60 * 1000 // 30 days
    }
  },

  // Storage
  storage: {
    provider: 'local', // or 's3'
    local: {
      path: './storage'
    },
    s3: {
      bucket: process.env.S3_BUCKET,
      region: process.env.AWS_REGION,
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    },
    // File size limits (bytes)
    maxFileSize: 10 * 1024 * 1024, // 10MB
    allowedMimeTypes: ['image/*', 'application/pdf']
  },

  // GraphQL
  graphql: {
    enabled: true,
    playground: process.env.NODE_ENV !== 'production',
    depthLimit: 10,
    costLimit: 1000
  },

  // API Configuration
  api: {
    port: parseInt(process.env.PORT || '3000'),
    host: process.env.HOST || '0.0.0.0',
    cors: {
      origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'],
      credentials: true
    }
  },

  // Row Level Security
  rls: {
    enabled: true,
    auditLog: true
  },

  // Webhooks
  webhooks: {
    retry: {
      maxAttempts: 3,
      retryInterval: 1000
    }
  }
})
```

### Environment Variables

```bash
# Database
DATABASE_URL=file:./dev.db
# Or for PostgreSQL
DATABASE_URL=postgres://user:password@localhost:5432/mydb

# Auth
AUTH_SECRET=your-secret-key-min-32-chars-long
AUTH_URL=http://localhost:3000

# Storage (S3)
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
S3_BUCKET=my-bucket

# API
PORT=3000
HOST=0.0.0.0
NODE_ENV=development

# CORS
CORS_ORIGIN=http://localhost:3000,http://localhost:5173
```

---

## Database Providers

Betterbase supports multiple database providers for different use cases:

### SQLite (Development)

Best for local development. Zero configuration required.

```typescript
database: {
  provider: 'sqlite',
  connectionString: 'file:./dev.db'
}
```

### PostgreSQL (Production)

Best for production deployments requiring full SQL capabilities.

```typescript
database: {
  provider: 'postgres',
  connectionString: process.env.DATABASE_URL
}
```

### Neon (Serverless PostgreSQL)

Best for serverless applications with automatic scaling.

```typescript
database: {
  provider: 'neon',
  connectionString: process.env.NEON_CONNECTION_STRING
}
```

### Turso (libSQL)

Best for edge deployments and distributed databases.

```typescript
database: {
  provider: 'turso',
  connectionString: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN
}
```

### MySQL

Best for legacy applications or MySQL preference.

```typescript
database: {
  provider: 'mysql',
  connectionString: process.env.MYSQL_URL
}
```

### PlanetScale (MySQL-compatible)

Best for serverless MySQL with branch-based schema changes.

```typescript
database: {
  provider: 'planetscale',
  connectionString: process.env.PLANETSCALE_URL
}
```

---

## Authentication

### Setup BetterAuth

Initialize authentication in your project:

```bash
bb auth setup
```

This creates `src/auth/` with default configuration.

### Configure Providers

Edit `src/auth/index.ts`:

```typescript
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { db } from '../db'

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'sqlite' // or 'postgres', 'mysql'
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false
  },
  socialProviders: {
    github: {
      clientId: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET
    },
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET
    }
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24 // 1 day
  }
})
```

### Row Level Security

Betterbase integrates with database RLS for secure data access:

```typescript
// In your schema or via CLI
bb rls add \
  --table posts \
  --name users_own_posts \
  --command SELECT \
  --check "user_id = auth.uid()"
```

This ensures users can only access their own data.

---

## Contributing

We welcome contributions! Please follow these steps:

### Getting Started

1. **Fork** the repository
2. **Clone** your fork: `git clone https://github.com/your-username/betterbase.git`
3. **Install** dependencies: `bun install`
4. **Create** a branch: `git checkout -b feature/my-feature`

### Development Setup

```bash
# Install dependencies
bun install

# Build all packages
bun run build

# Run tests
bun test

# Run linting
bun run lint
```

### Project Structure

```
betterbase/
├── apps/
│   └── test-project/      # Example/test project
├── packages/
│   ├── cli/               # @betterbase/cli
│   ├── client/            # @betterbase/client
│   ├── core/              # @betterbase/core
│   └── shared/            # @betterbase/shared
├── templates/             # Project templates
└── turbo.json             # Turborepo configuration
```

### Code Style

We use Biome for code formatting and linting:

```bash
# Format code
bun run format

# Lint code
bun run lint

# Fix auto-fixable issues
bun run lint:fix
```

### Testing

```bash
# Run all tests
bun test

# Run tests for specific package
bun test --filter=@betterbase/cli

# Run tests in watch mode
bun test --watch
```

### Commit Messages

Follow Conventional Commits:

```
feat: add new feature
fix: resolve bug
docs: update documentation
refactor: restructure code
test: add tests
chore: maintenance
```

### Submitting Changes

1. Push your branch: `git push origin feature/my-feature`
2. Open a **Pull Request**
3. Fill out the PR template
4. Wait for review

---

## Code of Conduct

### Our Pledge

In the interest of fostering an open and welcoming environment, we as contributors and maintainers pledge to make participation in our project and our community a harassment-free experience for everyone, regardless of age, body size, disability, ethnicity, gender identity and expression, level of experience, nationality, personal appearance, race, religion, or sexual identity and orientation.

### Our Standards

Examples of behavior that contributes to creating a positive environment include:

- Using welcoming and inclusive language
- Being respectful of differing viewpoints and experiences
- Gracefully accepting constructive criticism
- Focusing on what is best for the community
- Showing empathy towards other community members

### Our Responsibilities

Project maintainers are responsible for clarifying the standards of acceptable behavior and are expected to take appropriate and fair corrective action in response to any instances of unacceptable behavior.

### Enforcement

Instances of abusive, harassing, or otherwise unacceptable behavior may be reported by contacting the project team at conduct@betterbase.io. All complaints will be reviewed and investigated and will result in a response that is deemed necessary and appropriate to the circumstances.

---

## License

Betterbase is open source under the [MIT License](LICENSE).

```
MIT License

Copyright (c) 2024 Betterbase

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

## Community & Support

### Get Help

| Resource | Link |
|----------|------|
| **Documentation** | [docs.betterbase.io](https://docs.betterbase.io) |
| **Discord** | [discord.gg/betterbase](https://discord.gg/betterbase) |
| **GitHub Issues** | [github.com/betterbase/betterbase/issues](https://github.com/betterbase/betterbase/issues) |
| **Stack Overflow** | [stackoverflow.com/questions/tagged/betterbase](https://stackoverflow.com/questions/tagged/betterbase) |

### Stay Updated

| Channel | Link |
|---------|------|
| **Twitter** | [@betterbase](https://twitter.com/betterbase) |
| **Blog** | [blog.betterbase.io](https://blog.betterbase.io) |
| **Newsletter** | [subscribe.betterbase.io](https://subscribe.betterbase.io) |

### Contribute

| Resource | Link |
|----------|------|
| **GitHub** | [github.com/betterbase/betterbase](https://github.com/betterbase/betterbase) |
| **Contributing Guide** | [CONTRIBUTING.md](CONTRIBUTING.md) |
| **Good First Issues** | [github.com/betterbase/betterbase/labels/good%20first%20issue](https://github.com/betterbase/betterbase/labels/good%20first%20issue) |

---

<div align="center">

**Built with ❤️ using Bun**

[Website](https://betterbase.io) • [Documentation](https://docs.betterbase.io) • [Discord](https://discord.gg/betterbase) • [Twitter](https://twitter.com/betterbase)

</div>
