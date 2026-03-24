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

**Last Updated: 2026-03-21**

---

## Why Betterbase?

Traditional backend development is slow. You spend weeks setting up databases, authentication, APIs, and infrastructure before writing business logic. Betterbase changes that.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         BETTERBASE ARCHITECTURE                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   ┌──────────────┐       ┌──────────────┐       ┌──────────────┐       │
│   │   Frontend   │──────▶│   Betterbase │──────▶│   Database   │       │
│   │   (React,    │       │     Core     │       │  (SQLite,    │       │
│   │    Vue,      │       │              │       │   Postgres,  │       │
│   │    Mobile)   │       │  ┌────────┐  │       │   MySQL,     │       │
│   └──────────────┘       │  │ Auth   │  │       │   Neon...)   │       │
│                          │  ├────────┤  │       └──────────────┘       │
│   ┌──────────────┐       │  │ Realtime│  │                               │
│   │  Serverless  │──────▶│  ├────────┤  │       ┌──────────────┐       │
│   │  Functions   │       │  │ Storage │  │       │  S3 Storage  │       │
│   └──────────────┘       │  ├────────┤  │       │  (R2, B2,    │       │
│                          │  │GraphQL │  │       │   MinIO...)   │       │
│   ┌──────────────┐       │  ├────────┤  │       └──────────────┘       │
│   │   Webhooks   │──────▶│  │  RLS   │  │                               │
│   └──────────────┘       │  ├────────┤  │       ┌──────────────┐       │
│                          │  │ Vector │  │       │   External   │       │
│   ┌──────────────┐       │  ├────────┤  │       │   Services   │       │
│   │    Logger    │──────▶│  │ Branch │  │       │  (AI APIs,   │       │
│   └──────────────┘       │  ├────────┤  │       │   OAuth...)   │       │
│                          │  │ Logger │  │       └──────────────┘       │
│                          │  └────────┘  │                               │
│                          └──────────────┘                               │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Features

Betterbase provides a complete backend solution with enterprise-grade features:

| Feature | Description |
|---------|-------------|
| **AI Context Generation** | Automatic `.betterbase-context.json` generation for AI-assisted development |
| **Sub-100ms Startup** | Lightning-fast local development with `bun:sqlite` |
| **Docker-less Dev** | Run everything locally without containerization overhead |
| **TypeScript First** | Full type inference and strict mode throughout |
| **BetterAuth Integration** | Production-ready authentication out of the box |
| **Realtime Subscriptions** | WebSocket-based live data updates |
| **Multi-Provider Support** | PostgreSQL, MySQL (Planetscale), SQLite (Turso), Neon, Supabase |
| **RLS (Row Level Security)** | Built-in policy engine for fine-grained access control |
| **Serverless Functions** | Deploy custom API functions |
| **Storage API** | S3-compatible object storage |
| **Image Transformations** | On-the-fly image resizing, cropping, and format conversion |
| **Webhooks** | Event-driven architecture with signed payloads |
| **Vector Search** | pgvector-powered similarity search with embeddings support |
| **Branching/Preview Environments** | Create isolated development environments for each branch |
| **Auto-REST** | Automatic CRUD route generation from Drizzle schema |
| **GraphQL** | GraphQL API with schema generation and subscriptions |
| **Magic Link Auth** | Passwordless authentication via email magic links |
| **MFA** | Multi-factor authentication support |
| **Phone Auth** | Phone number verification via SMS/OTP |
| **Project Templates** | Base and Auth templates for quick project initialization |
| **Request Logging** | Built-in request logging with file transport |

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
| `http://localhost:3000/api/auth/*` | Authentication endpoints |
| `http://localhost:3000/storage/*` | Storage endpoints |
| `http://localhost:3000/realtime/*` | Realtime subscriptions |

---

## Templates

BetterBase provides project templates for quick project initialization:

### Base Template

The base template includes essential project structure:

```bash
bb init my-project --template base
```

**Includes:**
- Basic Hono server setup
- Database schema with users table
- Authentication middleware
- Storage routes
- Health check endpoint

### Auth Template

The authentication template includes full BetterAuth integration:

```bash
bb init my-project --template auth
```

**Includes:**
- Pre-configured BetterAuth setup
- Email/password authentication
- Social OAuth providers (configurable)
- Session management
- Auth middleware examples

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
│                        TURBOREPO MONOREPO                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                     @betterbase/cli                              │   │
│  │  CLI tool with 17 commands for development and deployment       │   │
│  │  init, dev, migrate, auth, auth add-provider, generate,          │   │
│  │  function, graphql, login, rls, rls test, storage,              │   │
│  │  webhook, branch                                                 │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                     @betterbase/client                           │   │
│  │  TypeScript SDK for frontend integration                         │   │
│  │  Auth, Query Builder, Realtime, Storage, Errors                 │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                     @betterbase/core                             │   │
│  │  Core backend engine with all server-side functionality         │   │
│  │  Database, Auth, GraphQL, RLS, Storage, Webhooks, Functions,     │   │
│  │  Vector Search, Branching, Auto-REST, Logger, Realtime          │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                     @betterbase/shared                           │   │
│  │  Shared utilities, types, and constants across all packages      │   │
│  │  Types, Errors, Constants, Utils                                 │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                     templates/                                   │   │
│  │  Project templates for quick initialization                      │   │
│  │  base, auth                                                     │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```
┌─────────────────────────────────────────────────────────────────────────┐
│                        TURBOREPO MONOREPO                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                     @betterbase/cli                              │   │
│  │  CLI tool with 12 commands for development and deployment       │   │
│  │  init, dev, migrate, auth, generate, function, graphql, login,  │   │
│  │  rls, storage, webhook, branch                                   │   │
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

### Configuration Options

BetterBase can be configured using `betterbase.config.ts`:

```typescript
import { defineConfig } from '@betterbase/core';

export default defineConfig({
  // Auto-REST: Automatic CRUD route generation
  autoRest: {
    enabled: true,
    excludeTables: ['internal_logs', 'migrations'],
  },
  
  // Storage policies for access control
  storage: {
    policies: [
      {
        bucket: 'avatars',
        operation: 'upload',
        expression: 'auth.uid() != null', // Allow authenticated users
      },
      {
        bucket: 'avatars',
        operation: 'download',
        expression: 'true', // Allow public read
      },
    ],
  },
  
  // Branching: Preview Environments configuration
  branching: {
    enabled: true,
    maxPreviews: 10,
    defaultSleepTimeout: 3600, // seconds
  },
  
  // Vector search configuration
  vector: {
    enabled: true,
    provider: 'openai',
    model: 'text-embedding-3-small',
    dimensions: 1536,
  },
});
```

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `3000` |
| `NODE_ENV` | Environment (development/production) | `development` |
| `DB_PATH` | SQLite database path | `local.db` |
| `DATABASE_URL` | PostgreSQL/MySQL connection string | — |
| `STORAGE_PROVIDER` | Storage provider (s3, r2, backblaze, minio) | `s3` |
| `STORAGE_BUCKET` | Default storage bucket name | `storage` |
| `STORAGE_ALLOWED_MIME_TYPES` | Comma-separated allowed MIME types | — |
| `STORAGE_MAX_FILE_SIZE` | Maximum file size in bytes | 10485760 |
| `SMTP_HOST` | SMTP server host | — |
| `SMTP_PORT` | SMTP server port | 587 |
| `SMTP_USER` | SMTP username | — |
| `SMTP_PASS` | SMTP password | — |
| `SMTP_FROM` | SMTP from email address | — |
| `TWILIO_ACCOUNT_SID` | Twilio Account SID | — |
| `TWILIO_AUTH_TOKEN` | Twilio Auth Token | — |
| `TWILIO_PHONE_NUMBER` | Twilio phone number | — |

---

## CLI Reference

The Betterbase CLI (`bb`) provides 17 commands for development and deployment:

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

# Preview migration changes
bb migrate preview

# Run in production mode
bb migrate production
```

### Authentication

#### `bb auth setup`

Setup and configure BetterAuth.

```bash
# Setup authentication
bb auth setup
```

#### `bb auth add-provider`

Add OAuth provider to your project.

```bash
# Add OAuth provider
bb auth add-provider github

# Available providers: google, github, discord, apple, microsoft, twitter, facebook
bb auth add-provider google
bb auth add-provider discord
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

### GraphQL

#### `bb graphql`

GraphQL schema management.

```bash
# Generate GraphQL schema from database
bb graphql generate

# Open GraphQL Playground
bb graphql playground

# Export schema as SDL
bb graphql export
```

### RLS (Row Level Security)

#### `bb rls`

Manage Row Level Security policies.

```bash
# Create new RLS policy
bb rls create --table posts --name users-own-posts --command SELECT

# List all RLS policies
bb rls list

# Disable RLS for a table
bb rls disable --table posts

# Enable RLS for a table
bb rls enable --table posts

# Test RLS policies
bb rls test --table posts
```

### Storage

#### `bb storage`

Manage file storage.

```bash
# Initialize storage
bb storage init

# List buckets
bb storage list

# List objects in bucket
bb storage buckets avatars

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

# View webhook logs
bb webhook logs my-webhook
```

### Serverless Functions

#### `bb function`

Manage serverless functions.

```bash
# Create new function
bb function create my-function

# Run function in development mode
bb function dev my-function

# Build function
bb function build my-function

# Deploy function
bb function deploy my-function

# List all functions
bb function list

# View function logs
bb function logs my-function
```

### Branching (Preview Environments)

#### `bb branch`

Manage preview environments (branches) for isolated development.

```bash
# Create a new preview environment
bb branch create my-feature

# List all preview environments
bb branch list

# Delete a preview environment
bb branch delete my-feature

# Check branch status
bb branch status my-feature

# Wake a sleeping preview
bb branch wake my-feature

# Sleep a preview to save resources
bb branch sleep my-feature
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

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/auth/signup` | Register new user |
| `POST` | `/api/auth/signin` | Sign in user |
| `POST` | `/api/auth/signout` | Sign out user |
| `GET` | `/api/auth/session` | Get current session |
| `POST` | `/api/auth/refresh` | Refresh session |
| `POST` | `/api/auth/magic-link` | Send magic link email |
| `GET` | `/api/auth/magic-link/verify` | Verify magic link |
| `POST` | `/api/auth/otp/send` | Send OTP |
| `POST` | `/api/auth/otp/verify` | Verify OTP |
| `POST` | `/api/auth/mfa/enable` | Enable MFA |
| `POST` | `/api/auth/mfa/verify` | Verify MFA |
| `POST` | `/api/auth/mfa/disable` | Disable MFA |
| `POST` | `/api/auth/mfa/challenge` | MFA challenge |
| `POST` | `/api/auth/phone/send` | Send SMS verification |
| `POST` | `/api/auth/phone/verify` | Verify SMS code |

#### Auto-REST (Automatic CRUD)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/:table` | List all records (paginated) |
| `GET` | `/api/:table/:id` | Get single record by ID |
| `POST` | `/api/:table` | Create new record |
| `PATCH` | `/api/:table/:id` | Update record |
| `DELETE` | `/api/:table/:id` | Delete record |

Deploy to any Bun-compatible host:

```bash
# Build for production
bun run build

# Start production server
bun run start
```

### Docker

Betterbase includes production-ready Docker configuration for self-hosted deployment.

#### Quick Start with Docker Compose

```bash
# Start development environment with PostgreSQL
docker-compose up -d

# View logs
docker-compose logs -f app

# Stop services
docker-compose down
```

#### Docker Files Included

| File | Purpose |
|------|---------|
| `Dockerfile` | Monorepo build (for developing Betterbase itself) |
| `Dockerfile.project` | Project template for deploying user projects |
| `docker-compose.yml` | Development environment with PostgreSQL |
| `docker-compose.production.yml` | Production-ready configuration |
| `.env.example` | Environment variable template |

#### Building a Project

```bash
# Copy the project Dockerfile to your project root
cp Dockerfile.project ./Dockerfile

# Configure environment variables
cp .env.example .env
# Edit .env with your database and storage settings

# Build and run
docker build -t my-betterbase-app .
docker run -p 3000:3000 my-betterbase-app
```

#### Production Deployment

```bash
# Use production compose file
docker-compose -f docker-compose.production.yml up -d

# With external database (Neon, Supabase, RDS)
DATABASE_URL=postgres://... docker-compose -f docker-compose.production.yml up -d

# With Cloudflare R2 storage
STORAGE_PROVIDER=r2 STORAGE_BUCKET=my-bucket docker-compose -f docker-compose.production.yml up -d
```

#### Docker Features

- **Multi-stage builds** for minimal image size
- **PostgreSQL** included in dev environment
- **Health checks** for reliability
- **Non-root user** for security
- **Volume mounts** for hot-reload in development
- **External database support** - Neon, Supabase, RDS, etc.
- **S3-compatible storage** - R2, S3, B2, MinIO

### Self-Hosted Deployment

Betterbase can be self-hosted on your own infrastructure using Docker. This is ideal for teams wanting full control over their data and infrastructure.

#### Quick Start

```bash
# Clone the repository
git clone https://github.com/betterbase/betterbase.git
cd betterbase

# Start self-hosted deployment
docker-compose -f docker-compose.self-hosted.yml up -d
```

The self-hosted version includes:
- **Admin Dashboard** - Web UI for managing projects, users, and settings
- **Device Authentication** - CLI login flow for self-hosted instances
- **Admin API** - Full API for administrative tasks
- **Metrics** - Usage and performance tracking

#### Configuration

Copy the example environment file and configure:

```bash
cp .env.self-hosted.example .env
```

Key environment variables:

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | PostgreSQL connection string | Yes |
| `AUTH_SECRET` | Secret for auth tokens (min 32 chars) | Yes |
| `SERVER_URL` | Public URL of your instance | Yes |
| `ADMIN_EMAIL` | Initial admin email | Yes |
| `ADMIN_PASSWORD` | Initial admin password | Yes |
| `STORAGE_PROVIDER` | Storage provider (local, s3, r2, backblaze, minio) | No |
| `STORAGE_BUCKET` | Storage bucket name | No |

#### CLI Login with Self-Hosted

```bash
# Login to your self-hosted instance
bb login --url https://your-instance.com

# This will initiate device authentication flow
# 1. You'll be given a device code
# 2. Open the admin dashboard
# 3. Approve the device
# 4. CLI will receive credentials automatically
```

#### Docker Compose Services

| Service | Port | Description |
|---------|------|-------------|
| server | 3000 | Main API server |
| dashboard | 3001 | Admin dashboard |
| nginx | 80, 443 | Reverse proxy |

#### For Development

```bash
# Start all services
docker-compose -f docker-compose.self-hosted.yml up

# View logs
docker-compose -f docker-compose.self-hosted.yml logs -f

# Stop services
docker-compose -f docker-compose.self-hosted.yml down
```

See [SELF_HOSTED.md](SELF_HOSTED.md) for detailed documentation.

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
STORAGE_PROVIDER=s3
STORAGE_REGION=us-east-1
STORAGE_ACCESS_KEY_ID=your-access-key
STORAGE_SECRET_ACCESS_KEY=your-secret-key
STORAGE_BUCKET=my-bucket

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
│   └── core/              # @betterbase/core
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

## Changelog

All notable changes to this project will be documented in this section.

### [1.0.0] - 2026-03-19

#### Added
- **AI Context Generation**: Automatic `.betterbase-context.json` generation for AI-assisted development
- **Branch Management**: New `bb branch` command for creating isolated preview environments
- **Vector Search**: pgvector-powered similarity search with embeddings support
- **Auto-REST**: Automatic CRUD route generation from Drizzle schema
- **Enhanced CLI**: Added 12 commands including branch, webhook management, and storage operations

#### Updated
- Updated copyright year to 2026
- Improved documentation with Last Updated timestamp
- Verified all features against current codebase structure
- Removed deprecated @betterbase/shared package references

#### Security
- Improved webhook signature verification
- Enhanced RLS policy engine

---

## License

Betterbase is open source under the [MIT License](LICENSE).

```
MIT License

Copyright (c) 2026 Betterbase

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

**Built with ❤️ using Weroperking**

[Website](https://betterbase.io) • [Documentation](https://docs.betterbase.io) • [Discord](https://discord.gg/betterbase) • [Twitter](https://twitter.com/betterbase)

</div>
