# BetterBase: Blueprint v3.0 — New Feature Phases (10–15)

> **Status:** Phases 1–8.1 complete. Phase 9 (Dashboard UI) in progress separately.
> **This document covers:** Phases 10–15 — the 6 new feature layers being added to BetterBase as open-source infrastructure.
> **Philosophy:** Zero vendor lock-in. User owns everything. AI-native. Docker-less. Open source first, managed cloud later.

---

## Project Identity (Include in every prompt)

| Field | Value |
|---|---|
| **Project** | BetterBase |
| **Type** | AI-Native Backend-as-a-Service Framework |
| **Positioning** | Open-source Supabase alternative — better DX, zero lock-in |
| **Stack** | Bun + TypeScript + Hono + Drizzle ORM + BetterAuth |
| **Monorepo** | Turborepo (`apps/cli`, `apps/dashboard`, `packages/core`, `packages/client`, `packages/shared`) |
| **CLI Command** | `bb` |
| **Local DB** | SQLite (dev) via `bun:sqlite` |
| **Production DB** | Provider-agnostic (see Phase 10) |
| **Auth** | BetterAuth — user owns the auth tables |
| **AI Context File** | `.betterbase-context.json` — auto-generated machine-readable manifest |
| **Development Model** | Solo dev, 80% AI code generation, 20% human review |

---

## What Has Changed From v2.0 That These Phases Affect

Before reading the phases, understand the parts of the existing codebase that will be **modified** (not just extended) by this work:

### `betterbase.config.ts` (Template)
Currently holds basic project config. Phases 10 and 14 both add new top-level config blocks:
- `provider` block (Phase 10) — database adapter selection
- `storage` block (Phase 14) — S3-compatible credentials and bucket config

### `bb init` Interactive Prompts (apps/cli)
Currently asks: project name, local or production, database URL.
Phases 10 and 14 add new prompts:
- "Which database provider?" (Neon / Turso / PlanetScale / Supabase DB / Raw Postgres / Managed — coming soon)
- "Set up S3-compatible storage now?" (optional, skippable)

### `drizzle.config.ts` (Template)
Currently likely hardcoded for SQLite → Postgres switching.
Phase 10 makes this **dynamically generated** based on provider selection.

### Migration System (`bb migrate`)
Currently handles schema diffs.
Phase 11 (RLS) adds a policy migration hook — RLS policy files must be applied alongside schema migrations.

### `.betterbase-context.json`
Currently contains tables, columns, routes, and AI instructions.
Phases 11 and 12 both add new fields:
- `rls_policies` — what policies exist per table (Phase 11)
- `graphql_schema` — the auto-generated GraphQL SDL (Phase 12)

### Auth Package (BetterAuth integration)
Currently generates auth tables and middleware.
Phase 11 (RLS) requires the auth user ID (`auth.uid()` equivalent) to be accessible at the Postgres session level so policies can reference it. This may require a small addition to the auth middleware.

---

## Phase 10: Database Provider Adapter Layer

### What you're building
A provider-agnostic database connection and configuration system. Instead of BetterBase assuming Postgres or SQLite, the user picks their provider and BetterBase generates the correct Drizzle config, connection string format, and migration commands for that provider.

### Why this matters
Zero vendor lock-in from day one. A developer using Turso should get the same BetterBase experience as one using Neon. And when BetterBase launches its own managed cloud later, it slots in as just another provider option — no API changes for the user.

### Providers supported in v1
| Provider | Type | Notes |
|---|---|---|
| Neon | Serverless Postgres | Connection pooling via `@neondatabase/serverless` |
| Turso | LibSQL / SQLite edge | Uses `@libsql/client` |
| PlanetScale | MySQL-compatible | Uses `@planetscale/database` |
| Supabase (DB only) | Postgres | Direct connection, no Supabase SDK needed |
| Raw Postgres | Standard Postgres | Uses `postgres` or `pg` driver |
| Managed (BetterBase) | Coming soon | Placeholder, disabled in CLI for now |

### How it works

**During `bb init`:**
```
? What database provider would you like to use?
  ❯ Neon (Serverless Postgres)
    Turso (SQLite Edge)
    PlanetScale (MySQL-compatible)
    Supabase (Postgres DB only)
    Raw Postgres
    Managed by BetterBase (coming soon)
```

This generates a `betterbase.config.ts` with a `provider` block:

```typescript
// betterbase.config.ts
export default defineConfig({
  project: {
    name: "my-app",
  },
  provider: {
    type: "neon",
    connectionString: process.env.DATABASE_URL,
  },
  // storage block added in Phase 14
})
```

And generates the correct `drizzle.config.ts` for that provider automatically.

**Provider adapter in `packages/core`:**
Each provider gets its own adapter file:
```
packages/core/src/providers/
  neon.ts
  turso.ts
  planetscale.ts
  supabase.ts
  postgres.ts
  index.ts  ← resolves adapter from config
```

The adapter interface:
```typescript
interface ProviderAdapter {
  connect(config: ProviderConfig): Promise<DatabaseConnection>
  getMigrationsDriver(): DrizzleMigrationDriver
  supportsRLS(): boolean       // false for Turso/PlanetScale
  supportsGraphQL(): boolean   // true for all Postgres-based
}
```

### Notes
- `supportsRLS()` and `supportsGraphQL()` are used by Phases 11 and 12 to warn the user if their provider doesn't support those features
- The `Managed by BetterBase` option is visible in the CLI but marked as `[coming soon]` and exits with a friendly message
- Migration commands stay the same (`bb migrate`) — the adapter handles the driver difference internally

---

## Phase 11: Row-Level Security (RLS)

### What you're building
A Postgres RLS policy management system that integrates with BetterAuth. Users define policies in their codebase, and BetterBase applies them as part of migrations.

### Why this matters
RLS is the missing security layer between "auth works" and "data is actually protected at the database level." Without it, a leaked API key can read any row. With it, even direct DB access is scoped to the authenticated user.

### Prerequisite
Provider must support RLS (`supportsRLS() === true`). If the user is on Turso or PlanetScale, `bb rls` commands will warn and exit.

### How it works

**New CLI command:**
```bash
bb rls create <table>
# Example:
bb rls create posts
```

This generates a policy file:
```
src/db/policies/
  posts.policy.ts
```

**Policy file format:**
```typescript
// src/db/policies/posts.policy.ts
import { definePolicy } from "@betterbase/core/rls"

export default definePolicy("posts", {
  select: "auth.uid() = user_id",
  insert: "auth.uid() = user_id",
  update: "auth.uid() = user_id",
  delete: "auth.uid() = user_id",
})
```

**Auth integration:**
The auth middleware is extended to set the Postgres session variable on each request:
```typescript
// Set in request middleware, before DB queries
await db.execute(sql`SET LOCAL app.current_user_id = ${userId}`)
```

And in Postgres, `auth.uid()` is a function that reads this:
```sql
CREATE OR REPLACE FUNCTION auth.uid()
RETURNS uuid AS $$
  SELECT current_setting('app.current_user_id', true)::uuid
$$ LANGUAGE sql;
```

**Migration integration:**
`bb migrate` now also picks up policy files and applies them:
```
bb migrate
→ Applying schema changes...
→ Applying RLS policies: posts, comments (2 policies)
→ Done
```

**Context file update:**
`.betterbase-context.json` gains a `rls_policies` field:
```json
{
  "rls_policies": {
    "posts": {
      "select": "auth.uid() = user_id",
      "insert": "auth.uid() = user_id"
    }
  }
}
```

### Notes
- RLS is opt-in per table. Tables without a policy file are unprotected (by design — developer's choice)
- `bb rls list` shows all active policies
- `bb rls disable <table>` drops the policy without deleting the file

---

## Phase 12: GraphQL API

### What you're building
An auto-generated GraphQL API mounted at `/api/graphql`, derived entirely from the Drizzle schema. Zero manual schema writing.

### Why this matters
Some teams prefer GraphQL over REST. BetterBase should support both without the developer writing a second API layer.

### How it works

**Auto-generation:**
When the user runs `bb generate graphql` (or it runs automatically during `bb dev`), BetterBase scans `src/db/schema.ts` and generates a full GraphQL schema and resolvers.

**Library:**
Uses `Pothos` (schema builder) with a Drizzle plugin. This gives type-safe GraphQL resolvers that are derived from Drizzle types — no type drift.

**Mounted in Hono:**
```typescript
// src/routes/graphql.ts (auto-generated)
import { createYoga } from "graphql-yoga"
import { schema } from "../lib/graphql/schema"

export const graphqlRoute = new Hono()
graphqlRoute.use("/api/graphql", createYoga({ schema }))
```

**What gets generated for each table:**
- Query: `users`, `usersBy(id)`, `usersList(filter, limit, offset)`
- Mutation: `createUser`, `updateUser`, `deleteUser`
- Subscription: `onUserChange` (if realtime is enabled)

**Auth protection:**
GraphQL routes respect the existing `requireAuth()` middleware from Phase 4. Resolvers can call `getUser()` for per-resolver auth checks.

**Context file update:**
```json
{
  "graphql_schema": "type User { id: ID! email: String! ... }  type Query { users: [User!]! ... }"
}
```

**New CLI command:**
```bash
bb generate graphql     # regenerate the schema
bb graphql playground   # open GraphQL Playground in browser
```

### Notes
- The GraphQL schema is always in sync with the Drizzle schema. Any `bb migrate` run also triggers a GraphQL schema regeneration
- If the provider does not support Postgres (`supportsGraphQL() === false`), a warning is shown but generation still works — only subscriptions are skipped
- The playground is disabled in production by default

---

## Phase 13: Webhooks

### What you're building
A database event webhook system. When rows are inserted, updated, or deleted in a table, BetterBase fires an HTTP POST to a user-defined URL with a signed payload.

### Why this matters
Webhooks are the connective tissue between a backend and the rest of the world — Slack notifications, email triggers, third-party sync, audit logs. Without them, developers have to poll or build their own event system.

### How it works

**User defines webhooks in config or via CLI:**
```bash
bb webhook create
# Prompts:
# → Table: posts
# → Events: INSERT, UPDATE
# → Target URL: https://my-app.com/webhooks/posts
```

This generates an entry in `betterbase.config.ts`:
```typescript
webhooks: [
  {
    table: "posts",
    events: ["INSERT", "UPDATE"],
    url: process.env.WEBHOOK_POSTS_URL,
    secret: process.env.WEBHOOK_SECRET,
  }
]
```

**Delivery mechanism:**
Built on top of the existing realtime layer. When a WebSocket event fires (Phase 6), the webhook dispatcher intercepts it and makes an HTTP POST:

```typescript
// packages/core/src/webhooks/dispatcher.ts
export async function dispatch(event: DBEvent, webhook: WebhookConfig) {
  const payload = {
    table: event.table,
    type: event.type,           // INSERT | UPDATE | DELETE
    record: event.new,
    old_record: event.old,
    timestamp: new Date().toISOString(),
  }
  const signature = signPayload(payload, webhook.secret)
  await fetch(webhook.url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-BetterBase-Signature": signature,
    },
    body: JSON.stringify(payload),
  })
}
```

**Signature verification (for webhook receivers):**
```typescript
import { verifyWebhook } from "@betterbase/client"

const isValid = verifyWebhook(payload, signature, process.env.WEBHOOK_SECRET)
```

**Retry logic:**
Failed deliveries retry 3 times with exponential backoff (1s, 5s, 30s). Failures are logged to the observability layer.

**CLI commands:**
```bash
bb webhook create        # create a new webhook
bb webhook list          # list all configured webhooks
bb webhook test <id>     # send a test payload to the URL
bb webhook logs <id>     # see delivery history
```

### Notes
- Webhooks require the realtime WebSocket layer (Phase 6) to be active
- In production, the `url` should always reference an environment variable, never a hardcoded string
- `bb webhook test` is critical for local development — sends a synthetic payload to the target URL

---

## Phase 14: S3-Compatible Storage

### What you're building
A storage interaction layer that wraps any S3-compatible service (AWS S3, Cloudflare R2, Backblaze B2, MinIO). The user brings their own credentials. BetterBase provides the clean API. In the future, BetterBase will offer its own managed storage — the API will not change.

### Why this matters
File storage is one of the top missing features compared to Supabase. Every real app needs it. The BYOK (Bring Your Own Keys) model means the user has zero vendor lock-in and full cost control.

### Setup

**During `bb init` or via `bb storage init`:**
```
? Set up storage now?
  ❯ Yes — I have AWS/S3-compatible credentials
    Skip for now
    Use managed storage (coming soon)
```

This adds to `.env`:
```
STORAGE_PROVIDER=s3
STORAGE_REGION=us-east-1
STORAGE_BUCKET=my-app-uploads
STORAGE_ACCESS_KEY=xxx
STORAGE_SECRET_KEY=xxx
STORAGE_ENDPOINT=          # optional, for R2/Backblaze/MinIO
```

And adds to `betterbase.config.ts`:
```typescript
storage: {
  provider: "s3",           // "s3" | "r2" | "backblaze" | "minio" | "managed"
  bucket: process.env.STORAGE_BUCKET,
  region: process.env.STORAGE_REGION,
  endpoint: process.env.STORAGE_ENDPOINT,  // optional
}
```

### The storage API (via `@betterbase/client`)

```typescript
const bb = createClient({ url, key })

// Upload
const { data, error } = await bb.storage
  .from("avatars")
  .upload("user-123.jpg", file, { contentType: "image/jpeg" })

// Download
const { data } = await bb.storage
  .from("avatars")
  .download("user-123.jpg")

// Get public URL
const { publicUrl } = bb.storage
  .from("avatars")
  .getPublicUrl("user-123.jpg")

// Generate signed URL (private files)
const { signedUrl } = await bb.storage
  .from("documents")
  .createSignedUrl("contract.pdf", { expiresIn: 3600 })

// Delete
await bb.storage.from("avatars").remove(["user-123.jpg"])
```

### Server-side in Hono routes

```typescript
import { storage } from "@betterbase/core/storage"

app.post("/upload", requireAuth(), async (c) => {
  const file = await c.req.formData()
  const result = await storage.upload("avatars", file.get("file"))
  return c.json({ url: result.publicUrl })
})
```

### Bucket types
- **Public bucket** — files are publicly accessible via URL
- **Private bucket** — files require signed URLs (default)

### CLI commands
```bash
bb storage init           # configure storage credentials
bb storage buckets list   # list all buckets
bb storage upload <file>  # upload a file (dev utility)
```

### Notes
- For Cloudflare R2, set `endpoint` to your R2 endpoint URL and `region` to `auto`
- The `managed` provider option is a placeholder in the CLI — it shows as available but exits with "Coming soon — managed storage launching Q2 2025"
- Credentials must never be committed. `bb storage init` automatically adds storage vars to `.gitignore`

---

## Phase 15: Edge Functions

### What you're building
A system for writing, bundling, and deploying standalone serverless functions from within a BetterBase project. Functions are written in TypeScript with Hono, bundled by Bun, and deployed to Cloudflare Workers or Vercel Edge.

### Why this matters
Some logic doesn't belong in the main API — image processing, background jobs, AI inference, webhooks receivers. Edge functions let developers deploy isolated pieces of logic without leaving the BetterBase ecosystem.

### How it works

**Create a function:**
```bash
bb function create send-email
```

This scaffolds:
```
src/functions/
  send-email/
    index.ts
    config.ts
```

**Function template:**
```typescript
// src/functions/send-email/index.ts
import { Hono } from "hono"

const app = new Hono()

app.post("/", async (c) => {
  const { to, subject, body } = await c.req.json()
  // your logic here
  return c.json({ success: true })
})

export default app
```

**Function config:**
```typescript
// src/functions/send-email/config.ts
export default {
  name: "send-email",
  runtime: "cloudflare-workers",  // "cloudflare-workers" | "vercel-edge"
  env: ["RESEND_API_KEY"],
}
```

**Bundle:**
```bash
bb function build send-email
# Uses Bun.build to bundle to a single file
# Output: .betterbase/functions/send-email.js
```

**Deploy:**
```bash
bb function deploy send-email
# Deploys to Cloudflare Workers or Vercel Edge based on config.runtime
```

**Cloudflare deployment** uses `wrangler` CLI under the hood.
**Vercel deployment** uses `vercel` CLI under the hood.
Both are installed as dev dependencies when the user creates their first function.

**Access BetterBase core packages from a function:**
```typescript
import { createClient } from "@betterbase/client"

const bb = createClient({
  url: process.env.BETTERBASE_URL,
  key: process.env.BETTERBASE_KEY,
})
```

Functions access the database through the `@betterbase/client` SDK — they do not import `packages/core` directly (edge runtimes have limitations).

**CLI commands:**
```bash
bb function create <name>      # scaffold a new function
bb function build <name>       # bundle for edge deployment
bb function deploy <name>      # deploy to configured runtime
bb function list               # list all functions in the project
bb function dev <name>         # run function locally with hot reload
bb function logs <name>        # tail logs (Cloudflare or Vercel)
```

### Notes
- Functions are isolated from the main Hono API. They are separate deployments
- `bb function dev` runs the function locally via Bun on a separate port (default: 3001+)
- Environment variables for functions are defined in `config.ts` and must exist in `.env` locally and in the target platform's dashboard for production
- Cloudflare Workers and Vercel Edge are the only supported runtimes in v1. AWS Lambda and Deno Deploy are candidates for v2

---

## Feature Compatibility Matrix

| Feature | Neon | Turso | PlanetScale | Supabase DB | Raw Postgres |
|---|---|---|---|---|---|
| DB Provider Adapter | ✅ | ✅ | ✅ | ✅ | ✅ |
| RLS (Phase 11) | ✅ | ❌ | ❌ | ✅ | ✅ |
| GraphQL (Phase 12) | ✅ | ⚠️ partial | ⚠️ partial | ✅ | ✅ |
| Webhooks (Phase 13) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Storage (Phase 14) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Edge Functions (Phase 15) | ✅ | ✅ | ✅ | ✅ | ✅ |

> ⚠️ partial = works for queries/mutations, subscriptions skipped

---

## Recommended Build Order

```
Phase 10 (Provider Adapter) → FIRST. Everything else references the provider.
Phase 14 (Storage)          → Can be built in parallel with Phase 11.
Phase 11 (RLS)              → Depends on Phase 10 (needs provider.supportsRLS()).
Phase 12 (GraphQL)          → Depends on Phase 10 + schema being stable.
Phase 13 (Webhooks)         → Depends on Phase 6 (realtime) already being done. ✅
Phase 15 (Edge Functions)   → Independent. Can be built any time after Phase 8.
```
