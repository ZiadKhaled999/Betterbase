# BetterBase Agent Skill

Version: betterbase-skill@1.0.0

BetterBase is a Backend-as-a-Service layer that auto-generates APIs from schema definitions.

---

## When To Use This

Use this skill when working inside a BetterBase project created via `bb init`.

---

## Mental Model

- Built on Hono (HTTP framework) + Drizzle (ORM)
- Schema-driven: define tables in `src/db/schema.ts`, APIs auto-generate
- Strong conventions: follow CLI workflows over manual configuration
- Auth via BetterAuth integration
- RLS for Postgres/Supabase; policy-based for SQLite

---

## Project Structure

```
my-project/
├── betterbase.config.ts      # Project configuration (defineConfig)
├── drizzle.config.ts         # Drizzle ORM config
├── package.json
├── src/
│   ├── index.ts              # App entry (Hono instance)
│   ├── db/
│   │   ├── schema.ts         # Drizzle table definitions
│   │   ├── index.ts          # DB client export
│   │   ├── migrate.ts        # Migration runner
│   │   └── auth-schema.ts    # BetterAuth tables (if auth enabled)
│   ├── routes/
│   │   ├── index.ts          # Route registration
│   │   ├── health.ts         # Health check
│   │   └── users.ts          # Custom routes
│   ├── auth/
│   │   ├── index.ts          # BetterAuth instance
│   │   └── types.ts          # Type exports
│   ├── middleware/
│   │   ├── auth.ts           # Auth middleware (requireAuth, optionalAuth)
│   │   └── validation.ts     # Request validation helpers
│   └── lib/
│       └── env.ts            # Zod-validated env vars
└── drizzle/                  # Generated migrations
```

---

## Core Patterns

### Schema (Drizzle)

```typescript
// src/db/schema.ts
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

// Timestamp helpers (createdAt, updatedAt)
export const timestamps = {
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .$defaultFn(() => new Date())
    .$onUpdate(() => new Date()),
};

// UUID primary key
export const uuid = (name = 'id') => text(name).primaryKey().$defaultFn(() => crypto.randomUUID());

// Soft delete
export const softDelete = {
  deletedAt: integer('deleted_at', { mode: 'timestamp' }),
};

// Status enum
export const statusEnum = (name = 'status') => text(name, { enum: ['active', 'inactive', 'pending'] }).default('active');

// Table definition
export const users = sqliteTable('users', {
  id: uuid(),
  email: text('email').notNull().unique(),
  name: text('name'),
  status: statusEnum(),
  ...timestamps,
  ...softDelete,
});
```

### Migrations

```bash
# Generate migration from schema changes
bb migrate generate

# Apply migrations locally
bb migrate

# Preview without applying
bb migrate preview

# Rollback last migration
bb migrate rollback
```

### Routes (Hono)

```typescript
// src/routes/users.ts
import { Hono } from 'hono';
import { db } from '../db';
import { users } from '../db/schema';
import { parseBody } from '../middleware/validation';

const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
});

export const usersRoute = new Hono();

usersRoute.get('/', async (c) => {
  const rows = await db.select().from(users).limit(25);
  return c.json({ users: rows });
});

usersRoute.post('/', async (c) => {
  const body = await c.req.json();
  const parsed = parseBody(createUserSchema, body);
  const created = await db.insert(users).values(parsed).returning();
  return c.json({ user: created[0] }, 201);
});
```

### Config

```typescript
// betterbase.config.ts
import { defineConfig } from "@betterbase/core";

export default defineConfig({
  project: { name: "my-project" },
  provider: {
    type: "turso",
    url: process.env.TURSO_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
  },
  graphql: { enabled: true },
});
```

### RLS (Row Level Security)

```typescript
// src/rls/policies.ts
import { definePolicy } from "@betterbase/core/rls";
import { policyToSQL } from "@betterbase/core/rls/generator";

const userPolicy = definePolicy("users", {
  select: "auth.uid() = id",
  update: "auth.uid() = id",
  delete: "auth.uid() = id",
});

const sql = policyToSQL(userPolicy);
// Returns SQL to enable RLS and create policies
```

### Client Usage

```typescript
// In frontend app
import { createClient } from "@betterbase/client";

const client = createClient({
  url: "http://localhost:3000",
  key: process.env.VITE_API_KEY,
});

// Query data
const users = await client.from("users").select().limit(10);

// Auth
const { user, session } = await client.auth.signIn({
  email: "user@example.com",
  password: "password",
});

// Storage
const uploadResult = await client.storage.upload(file, { bucket: "avatars" });
```

---

## CLI Commands

- `bb init [name]` - Initialize new project
- `bb dev` - Watch mode for development
- `bb migrate generate` - Generate migration from schema
- `bb migrate` - Apply pending migrations
- `bb migrate preview` - Preview migration diff
- `bb migrate rollback` - Rollback migrations
- `bb generate crud <table>` - Generate CRUD routes
- `bb auth setup` - Install BetterAuth
- `bb auth add-provider <provider>` - Add OAuth provider
- `bb rls create <table>` - Create RLS policy
- `bb rls list` - List RLS policies
- `bb storage init` - Initialize storage
- `bb function create <name>` - Create edge function
- `bb function deploy <name>` - Deploy function
- `bb branch create <name>` - Create preview environment

---

## Critical Rules

- Use `process.execPath` instead of hardcoding "bun" for runtime detection
- Validate environment variables ONCE using Zod in `src/lib/env.ts`, never reassign
- The `init` command must remain public (no auth required)
- Edge function deployment requires `--no-verify-jwt` flag
- Admin keys are hashed server-side only; never store plaintext
- Supabase edge runtime cannot serve HTML responses
- Ignore `MaxListenersExceededWarning` in test environments
- Always use `parseInt` when converting string CLI args to numbers

---

## Forbidden Actions

- Do NOT import from `@betterbase/core` in user-land code (only `@betterbase/core/config`, `@betterbase/core/rls`)
- Do NOT manually write SQL migration files; use CLI
- Do NOT bypass auth middleware; always use `requireAuth`
- Do NOT assume Node.js runtime; BetterBase uses Bun exclusively
- Do NOT duplicate schema logic in routes; import from `src/db/schema.ts`
- Do NOT use raw SQL queries; use Drizzle ORM
- Do NOT hardcode environment variable parsing in multiple files

---

## Conditional Logic

- If auth enabled → use `requireAuth` middleware on protected routes
- If RLS enabled (Postgres/Supabase) → apply policies via `definePolicy`
- If storage enabled → use client SDK `storage.upload()`, not direct S3
- If using Turso/SQLite → use SQLite schema helpers, not Postgres-specific features
- If deploying edge functions → require `--no-verify-jwt` for unauthenticated endpoints

---

## Anti-Patterns

- Writing raw SQL instead of Drizzle queries
- Hardcoding env parsing: `const dbUrl = process.env.DATABASE_URL` repeated across files
- Creating custom auth instead of using BetterAuth
- Bypassing CLI: manually editing `drizzle/` folder
- Skipping migrations before deploying schema changes
- Using Supabase client in edge functions (use REST API instead)
- Forgetting to run `bb migrate` after schema changes in production

---

## Out of Scope

- Modifying BetterBase core packages
- Editing CLI internals
- Monorepo-level configuration changes
- Contributing to `@betterbase/core` development

