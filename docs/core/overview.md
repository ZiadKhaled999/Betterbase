# @betterbase/core

Core engine package containing the backbone functionality of BetterBase including:
- Auto-REST API generation
- Database providers (Neon, Turso, PlanetScale, Supabase, Postgres)
- Storage adapters (S3-compatible)
- Webhook system
- Real-time capabilities
- GraphQL integration
- Row Level Security (RLS)
- Branching/preview environments
- Serverless function deployment
- Logging and middleware
- Vector search capabilities

## Table of Contents
- [Overview](#overview)
- [Modules](#modules)
  - [Auto-REST](#auto-rest)
  - [Branching](#branching)
  - [Configuration](#configuration)
  - [Functions](#functions)
  - [GraphQL](#graphql)
  - [Logger](#logger)
  - [Middleware](#middleware)
  - [Migration](#migration)
  - [Providers](#providers)
  - [Realtime](#realtime)
  - [RLS](#rls)
  - [Storage](#storage)
  - [Vector](#vector)
  - [Webhooks](#webhooks)
- [Usage](#usage)
- [API Reference](#api-reference)

## Overview

The `@betterbase/core` package is the central engine that powers BetterBase applications. It provides:
- Automatic CRUD API generation from database schemas
- Multi-database provider support
- File storage with policy engine
- Webhook event system
- Real-time subscriptions via WebSockets
- GraphQL API generation
- Fine-grained access control with RLS
- Preview environments for branching workflows
- Serverless function bundling and deployment
- Structured logging and request middleware
- Vector similarity search capabilities

## Modules

### Auto-REST
Automatic generation of RESTful endpoints from Drizzle ORM schemas with built-in RLS enforcement, filtering, and pagination.

### Branching
Preview environment system for creating isolated database branches for feature development and testing.

### Configuration
Zod-based configuration schema validation for database providers, storage, webhooks, GraphQL, vector search, Auto-REST, and branching.

### Functions
Serverless function bundling, local runtime, and deployment utilities.

### GraphQL
Auto-generated GraphQL schema, resolvers, server, and real-time bridge from Drizzle ORM schemas.

### Logger
Structured logging system with file transport capabilities.

### middleware
Request logging and RLS session middleware for request processing.

### Migration
Database migration utilities including RLS policy migration.

### Providers
Database adapter implementations for Neon, Turso, PlanetScale, Supabase, and Postgres.

### Realtime
WebSocket-based real-time channel manager for live updates.

### RLS
Row Level Security system including policy evaluation, generation, scanning, and auth bridging.

### Storage
File storage abstraction with S3 adapter, policy engine, and image transformation capabilities.

### Vector
Vector similarity search integration with OpenAI, Cohere, HuggingFace, and custom providers.

### Webhooks
Outgoing webhook delivery system with signing, retry logic, and event filtering.

## Usage

```typescript
import { 
  defineConfig,
  mountAutoRest,
  createGraphQLServer,
  // ... other imports
} from '@betterbase/core';

// Define configuration
const config = defineConfig({
  project: { name: 'my-app' },
  provider: { 
    type: 'postgres',
    connectionString: process.env.DATABASE_URL 
  }
});

// Use in your Hono app
const app = new Hono();
mountAutoRest(app, db, schema);
```

## API Reference

See individual module documentation for detailed API reference:
- [Auto-REST](./auto-rest.md)
- [Branching](./branching.md)
- [Configuration](./config.md)
- [Functions](./functions.md)
- [GraphQL](./graphql.md)
- [Logger](./logger.md)
- [Middleware](./middleware.md)
- [Migration](./migration.md)
- [Providers](./providers.md)
- [Realtime](./realtime.md)
- [RLS](./rls.md)
- [Storage](./storage.md)
- [Vector](./vector.md)
- [Webhooks](./webhooks.md)