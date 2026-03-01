# BetterBase Documentation

> An AI-native Backend-as-a-Service platform built for the modern web. Inspired by Supabase, powered by Bun.

---

## Table of Contents

1. [Introduction](#introduction)
2. [Features](#features)
3. [Tech Stack](#tech-stack)
4. [Architecture](#architecture)
   - [System Architecture Overview](#system-architecture-overview)
   - [CLI Workflow](#cli-workflow)
   - [Client Request Flow](#client-request-flow)
   - [Authentication Flow](#authentication-flow)
   - [Realtime Subscription Flow](#realtime-subscription-flow)
   - [Database Operations Flow](#database-operations-flow)
5. [Getting Started](#getting-started)
6. [CLI Reference](#cli-reference)
7. [Client SDK](#client-sdk)
8. [API Reference](#api-reference)
9. [Best Practices](#best-practices)

---

## Introduction

BetterBase is an AI-native Backend-as-a-Service (BaaS) platform that provides developers with a complete backend solution featuring database management, authentication, realtime subscriptions, and serverless API endpoints—all with sub-100ms startup times using Bun's native SQLite driver.

### Vision

BetterBase aims to be the most developer-friendly BaaS platform by:
- Providing instant local development without Docker
- Generating AI-friendly context files for smarter autocomplete
- Offering full TypeScript type inference
- Supporting multiple database providers

---

## Features

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
| **Webhooks** | Event-driven architecture with signed payloads |

---

## Tech Stack

- **Runtime**: [Bun](https://bun.sh) — All-in-one JavaScript runtime
- **Framework**: [Hono](https://hono.dev) — Ultrafast web framework
- **ORM**: [Drizzle ORM](https://orm.drizzle.team) — TypeScript-native database toolkit
- **Auth**: [BetterAuth](https://www.better-auth.com/) — Authentication framework
- **Monorepo**: [Turborepo](https://turbo.build/) — Build system for JavaScript/TypeScript
- **Dashboard**: [Next.js 15](https://nextjs.org/) — React framework with App Router

---

## Architecture

### System Architecture Overview

```mermaid
flowchart TB
    subgraph Client["Client Applications"]
        Web[Web App]
        Mobile[Mobile App]
        SPA[Single Page App]
    end

    subgraph Tools["Development Tools"]
        CLI[CLI<br/>packages/cli]
        Dashboard[Dashboard<br/>apps/dashboard]
    end

    subgraph Templates["Project Templates"]
        BaseTemp[Base Template<br/>templates/base]
        AuthTemp[Auth Template<br/>templates/auth]
    end

    subgraph Packages["Core Packages"]
        ClientSDK[Client SDK<br/>packages/client]
        Core[Core Backend<br/>packages/core]
        Shared[Shared Utils<br/>packages/shared]
    end

    subgraph Server["BetterBase Server"]
        API[Hono API Server]
        
        subgraph Middleware["Middleware"]
            Auth[Authentication]
            RLS[Row Level Security]
            Validation[Validation]
        end
        
        subgraph Handlers["Handlers"]
            Routes[API Routes]
            Functions[Serverless Functions]
            GraphQL[GraphQL Server]
            Webhooks[Webhook Dispatcher]
        end
        
        subgraph Services["Services"]
            DB[Database Service]
            Realtime[Realtime Service]
            Storage[Storage Service]
        end
    end

    subgraph Database["Database Providers"]
        SQLite[(SQLite<br/>bun:sqlite)]
        Postgres[(PostgreSQL)]
        MySQL[(MySQL)]
        Neon[(Neon)]
        Turso[(Turso)]
    end

    subgraph Storage["Object Storage"]
        S3[S3 Compatible]
    end

    Client -->|HTTP/WebSocket| ClientSDK
    CLI -->|Project Management| Templates
    CLI -->|Deploy Functions| Core
    Dashboard -->|Admin| Core
    BaseTemp -->|Uses| ClientSDK
    AuthTemp -->|Uses| ClientSDK
    
    ClientSDK -->|API Calls| API
    Templates -->|Local Dev| API
    
    API --> Middleware
    Middleware --> Handlers
    Handlers --> Services
    Services --> Database
    Storage --> S3
    
    Auth -.->|Session| Client
    Realtime -.->|WebSocket| Client
```

### Package Structure

```mermaid
flowchart LR
    subgraph Monorepo["BetterBase Monorepo"]
        direction TB
        
        subgraph CLI_Package["packages/cli"]
            CLI_Commands[Commands<br/>init, dev, migrate<br/>auth, generate, function<br/>graphql, login, rls<br/>storage, webhook]
        end
        
        subgraph Client_Package["packages/client"]
            Client_Modules[Modules<br/>Client, Auth<br/>Query Builder<br/>Realtime, Storage]
        end
        
        subgraph Core_Package["packages/core"]
            Core_Modules[Modules<br/>Config, Functions<br/>GraphQL, Middleware<br/>Migration, Providers<br/>RLS, Storage<br/>Webhooks]
        end
        
        subgraph Shared_Package["packages/shared"]
            Shared_Utils[Utilities<br/>Constants, Errors<br/>Types, Utils]
        end
    end
```

---

### CLI Workflow

```mermaid
flowchart TB
    Start([User starts CLI]) --> Init{Command type?}
    
    Init -->|init| InitCmd[Initialize Project]
    Init -->|dev| DevCmd[Start Dev Server]
    Init -->|migrate| MigrateCmd[Run Migrations]
    Init -->|auth| AuthCmd[Setup Authentication]
    Init -->|generate| GenerateCmd[Generate Code]
    Init -->|function| FunctionCmd[Manage Functions]
    Init -->|graphql| GraphQLCmd[GraphQL Operations]
    Init -->|login| LoginCmd[User Login]
    Init -->|rls| RLSCmd[Manage RLS Policies]
    Init -->|storage| StorageCmd[Storage Operations]
    Init -->|webhook| WebhookCmd[Webhook Management]
    
    InitCmd --> Scan[Scan Project Structure]
    Scan --> Template{Template?}
    Template -->|base| CopyBase[Copy Base Template]
    Template -->|auth| CopyAuth[Copy Auth Template]
    Template -->|none| Empty[Create Empty Project]
    
    CopyBase --> Deps[Install Dependencies]
    CopyAuth --> Deps
    Empty --> Deps
    
    Deps --> Config[Generate Config]
    Config --> Context[Create .betterbase-context.json]
    Context --> InitDone([Project Ready])
    
    DevCmd --> Watch[Watch Files]
    Watch --> Detect{File Changes?}
    Detect -->|Yes| ScanSchema[Scan Schema]
    Detect -->|No| Watch
    ScanSchema --> UpdateContext[Update Context]
    UpdateContext --> Watch
    
    MigrateCmd --> Diff[Generate Migration Diff]
    Diff --> Backup[Backup Database]
    Backup --> Apply[Apply Migration]
    Apply --> MigrateDone([Done])
    
    GenerateCmd --> Analyze[Analyze Schema]
    Analyze --> Scaffold[ Scaffold CRUD Routes]
    Scaffold --> GenerateDone([Done])
    
    AuthCmd --> Install[Install BetterAuth]
    Install --> ScaffoldAuth[Scaffold Auth Files]
    ScaffoldAuth --> AuthDone([Done])
```

---

### Client Request Flow

```mermaid
sequenceDiagram
    participant Client as Client App
    participant SDK as @betterbase/client
    participant API as Hono API Server
    participant MW as Middleware Stack
    participant RLS as RLS Engine
    participant DB as Database
    
    Client->>SDK: makeRequest(endpoint, options)
    SDK->>SDK: Build HTTP Request
    SDK->>API: Send HTTP Request
    
    API->>MW: Process Request
    MW->>MW: 1. CORS Headers
    MW->>MW: 2. Authentication Check
    MW->>MW: 3. Rate Limiting
    MW->>MW: 4. Validation
    
    alt Authenticated Request
        MW->>RLS: Check Permissions
        RLS->>RLS: Load Policies
        RLS->>RLS: Evaluate Policy
        RLS-->>API: Allow/Deny
    else Anonymous Request
        MW-->>API: Continue
    end
    
    API->>DB: Execute Query
    DB-->>API: Query Result
    
    API->>SDK: Return Response
    SDK->>Client: Return Result
    
    alt Success
        Client->>Client: Handle Data
    else Error
        Client->>Client: Handle Error
    end
```

---

### Authentication Flow

```mermaid
flowchart TB
    Start([User Authentication]) --> Flow{Auth Type?}
    
    Flow -->|Sign Up| SignUp[User Signs Up]
    Flow -->|Sign In| SignIn[User Signs In]
    Flow -->|OAuth| OAuth[OAuth Provider]
    Flow -->|Session| Session[Session Refresh]
    
    SignUp --> Validate1[Validate Input]
    SignIn --> Validate2[Validate Credentials]
    OAuth --> Redirect[Redirect to Provider]
    
    Validate1 --> CreateUser[Create User Record]
    Validate2 --> CheckPassword[Verify Password]
    Redirect --> ProviderAuth[Provider Authentication]
    
    CreateUser --> HashPassword[Hash Password]
    CheckPassword --> Verify[Verify Hash]
    ProviderAuth --> GetProviderToken[Get Provider Token]
    
    HashPassword --> CreateSession
    Verify --> CreateSession
    GetProviderToken --> CreateSession
    
    CreateSession[Create Session] --> GenerateToken[Generate JWT Token]
    GenerateToken --> StoreSession[Store Session in DB]
    StoreSession --> SetCookie[Set HTTP-Only Cookie]
    SetCookie --> ReturnSession[Return Session to Client]
    
    ReturnSession --> UserAuth([User Authenticated])
    
    Session --> LoadSession[Load Session from Cookie]
    LoadSession --> VerifySession[Verify Token]
    VerifySession --> CheckExpiry{Expired?}
    CheckExpiry -->|Yes| RefreshToken[Refresh Token]
    CheckExpiry -->|No| Valid[Valid Session]
    RefreshToken --> GenerateToken
    
    Valid --> UserAuth
```

---

### Realtime Subscription Flow

```mermaid
sequenceDiagram
    participant Client as Client App
    participant SDK as @betterbase/client
    participant WS as WebSocket Server
    participant Sub as Subscription Manager
    participant DB as Database
    
    Note over Client, DB: Realtime Subscription Flow
    
    Client->>SDK: .from(table).on(event, callback)
    SDK->>SDK: Create Subscription Object
    
    SDK->>WS: Connect WebSocket
    WS->>Sub: Register Subscription
    
    Sub->>DB: Subscribe to Changes
    DB-->>Sub: Subscription Confirmed
    
    WS-->>SDK: Connection Established
    SDK-->>Client: Subscription Ready
    
    Note over DB, Sub: Database Change Detection
    
    DB->>Sub: INSERT/UPDATE/DELETE Event
    Sub->>Sub: Apply RLS Policies
    Sub->>WS: Filtered Event
    
    WS->>SDK: Push Event
    SDK->>Client: Trigger Callback
    
    Client->>Client: Handle Event Data
    
    Note over Client, WS: Ongoing until Unsubscribe
    
    Client->>SDK: .unsubscribe()
    SDK->>WS: Close Subscription
    WS->>Sub: Remove Subscription
    Sub->>DB: Unsubscribe
```

---

### Database Operations Flow

```mermaid
flowchart TB
    Start([Database Operation]) --> Query{Operation Type?}
    
    Query -->|SELECT| SelectFlow[Build SELECT Query]
    Query -->|INSERT| InsertFlow[Build INSERT Query]
    Query -->|UPDATE| UpdateFlow[Build UPDATE Query]
    Query -->|DELETE| DeleteFlow[Build DELETE Query]
    
    SelectFlow --> Builder[Query Builder]
    InsertFlow --> Builder
    UpdateFlow --> Builder
    DeleteFlow --> Builder
    
    Builder --> Filters[Apply Filters]
    Filters --> RLS{RLS Enabled?}
    
    RLS -->|Yes| LoadPolicies[Load RLS Policies]
    RLS -->|No| SkipRLS[Skip RLS]
    
    LoadPolicies --> Evaluate[Evaluate Policies]
    Evaluate --> AddPolicy[Add Policy to Query]
    AddPolicy --> Execute
    SkipRLS --> Execute
    
    Execute --> DB[(Database)]
    DB --> Result[Return Result]
    
    Result --> ErrorCheck{Error?}
    ErrorCheck -->|Yes| HandleError[Handle Error]
    ErrorCheck -->|No| Transform[Transform Result]
    
    HandleError --> ReturnError([Return Error])
    Transform --> ReturnData([Return Data])
```

---

### RLS (Row Level Security) Flow

```mermaid
flowchart TB
    Start([RLS Protected Request]) --> Parse[Parse Request]
    Parse --> LoadUser{User Auth?}
    
    LoadUser -->|Authenticated| GetSession[Get Session]
    LoadUser -->|Anonymous| Anonymous[Anonymous User]
    
    GetSession --> LoadPolicies[Load Table Policies]
    Anonymous --> LoadPolicies
    
    LoadPolicies --> Iterate{For Each Policy}
    Iterate --> CheckType{Policy Type?}
    
    CheckType -->|SELECT| SelectCheck[Check SELECT]
    CheckType -->|INSERT| InsertCheck[Check INSERT]
    CheckType -->|UPDATE| UpdateCheck[Check UPDATE]
    CheckType -->|DELETE| DeleteCheck[Check DELETE]
    
    SelectCheck --> EvalExpression[Evaluate Expression]
    InsertCheck --> EvalExpression
    UpdateCheck --> EvalExpression
    DeleteCheck --> EvalExpression
    
    EvalExpression --> Result{Result?}
    
    Result -->|True| Allow[Allow Operation]
    Result -->|False| Deny[Deny Operation]
    
    Allow --> Continue[Continue to Handler]
    Deny --> Reject[Return 403 Error]
    
    Continue --> Complete([Complete Request])
    Reject --> Complete
```

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

## CLI Reference

The BetterBase CLI (`bb`) provides commands for project management.

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

#### `bb function`

Manage serverless functions.

```bash
# Create new function
bb function create my-function

# Deploy function
bb function deploy my-function

# List functions
bb function list
```

#### `bb rls`

Manage Row Level Security policies.

```bash
# Generate RLS policies
bb rls generate

# Apply policies
bb rls apply

# Test policies
bb rls test
```

#### `bb storage`

Manage object storage operations.

```bash
# Upload file
bb storage upload ./file.txt

# Download file
bb storage download path/to/file

# List files
bb storage ls
```

#### `bb webhook`

Manage webhooks.

```bash
# Create webhook
bb webhook create https://example.com/hook

# List webhooks
bb webhook list

# Delete webhook
bb webhook delete webhook-id
```

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

### Realtime Subscriptions

```typescript
// Subscribe to table changes
const subscription = client.realtime
  .from('posts')
  .on('INSERT', (payload) => {
    console.log('New post:', payload.data);
  })
  .on('UPDATE', (payload) => {
    console.log('Updated post:', payload.data);
  })
  .on('DELETE', (payload) => {
    console.log('Deleted post:', payload.oldData);
  })
  .subscribe();

// Unsubscribe when done
subscription.unsubscribe();
```

### Storage

```typescript
// Upload file
const { data, error } = await client.storage.upload(
  'avatars/user123.png',
  fileObject
);

// Download file
const { data, error } = await client.storage.download(
  'avatars/user123.png'
);

// Get public URL
const url = client.storage.getPublicUrl('avatars/user123.png');

// Delete file
const { error } = await client.storage.delete('avatars/user123.png');
```

---

## API Reference

### REST Endpoints

#### Users

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/users` | List all users (paginated) |
| `GET` | `/api/users/:id` | Get user by ID |
| `POST` | `/api/users` | Create new user |
| `PATCH` | `/api/users/:id` | Update user |
| `DELETE` | `/api/users/:id` | Delete user |

#### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/auth/signup` | Register new user |
| `POST` | `/api/auth/signin` | Sign in user |
| `POST` | `/api/auth/signout` | Sign out user |
| `GET` | `/api/auth/session` | Get current session |
| `POST` | `/api/auth/refresh` | Refresh session |

#### Storage

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/storage/files` | List files |
| `POST` | `/api/storage/upload` | Upload file |
| `GET` | `/api/storage/:path` | Download file |
| `DELETE` | `/api/storage/:path` | Delete file |

---

## Best Practices

### Database Schema

1. **Use UUIDs for primary keys**: BetterBase provides a `uuid()` helper

```typescript
import { uuid } from './db/schema';

export const users = sqliteTable('users', {
  id: uuid().primaryKey(),
  // ...
});
```

2. **Add timestamps to all tables**: Use the `timestamps` helper

```typescript
import { timestamps } from './db/schema';

export const posts = sqliteTable('posts', {
  id: uuid().primaryKey(),
  title: text('title').notNull(),
  ...timestamps,
});
```

3. **Use soft deletes**: Use the `softDelete` helper for data recovery

```typescript
import { softDelete } from './db/schema';

export const posts = sqliteTable('posts', {
  id: uuid().primaryKey(),
  ...softDelete,
});
```

### Security

1. **Always enable RLS**: Enable Row Level Security on all tables

```typescript
// In your schema
export const users = sqliteTable('users', {
  id: uuid().primaryKey(),
  email: text('email').notNull(),
});

// Enable RLS
await enableRLS('users');
```

2. **Create policies for common patterns**:

```typescript
// Users can only see their own data
createPolicy('users', 'read', 'auth.uid() = user_id');

// Only admins can delete
createPolicy('users', 'delete', 'auth.role() = admin');
```

3. **Validate all inputs**: Use the validation middleware

```typescript
import { validate } from './middleware/validation';

app.post('/api/users', validate(userSchema), async (c) => {
  // Handler code
});
```

### Performance

1. **Use indexes on frequently queried columns**:

```typescript
export const posts = sqliteTable('posts', {
  id: uuid().primaryKey(),
  authorId: text('author_id').notNull(),
  status: text('status').notNull(),
  createdAt: integer('created_at').notNull(),
}, (table) => ({
  authorIdx: index('author_idx').on(table.authorId),
  statusIdx: index('status_idx').on(table.status),
}));
```

2. **Limit query results**: Always use `.limit()` for large tables

```typescript
const posts = await client
  .from('posts')
  .select()
  .limit(50)
  .execute();
```

3. **Use pagination for lists**: Implement offset/limit pagination

```typescript
const page = 1;
const limit = 20;
const offset = (page - 1) * limit;

const posts = await client
  .from('posts')
  .select()
  .limit(limit)
  .offset(offset)
  .execute();
```

### Development Workflow

1. **Use the dev server for development**: It watches for changes

```bash
bb dev
```

2. **Generate context before AI coding**: Ensures AI has latest schema

```bash
# Automatically done by dev server
# Or manually:
bb dev --generate
```

3. **Use templates for new projects**: Start with a template

```bash
# Auth template includes:
# - BetterAuth setup
# - User table and policies
# - Session management
bb init my-app --template auth
```

---

## License

Apache 2.0 License - see [LICENSE](LICENSE) for details.

---

## Support

- [Documentation](https://docs.betterbase.dev)
- [GitHub Issues](https://github.com/betterbase/betterbase/issues)
- [Discord Community](https://discord.gg/betterbase)
