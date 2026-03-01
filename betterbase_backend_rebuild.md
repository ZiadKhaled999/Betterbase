# BetterBase — Backend Rebuild for Dashboard Readiness
> **Priority:** CRITICAL. Complete this entire document before touching the BetterBaseDashboard repo.
> **Why:** The dashboard cannot display real data without these backend changes. Every section in this document is a prerequisite for a specific dashboard feature.
> **Who this is for:** An LLM agent (Cursor, Codex) that will implement these changes. Read the entire document before writing a single line of code. The order of implementation matters.

---

## PART 0: UNDERSTAND WHAT IS BEING BUILT

### The current problem

The BetterBase backend right now is a good standalone API server. But it has no concept of:
- Who is calling it (no API key system)
- What is happening inside it (no request logging)
- How to expose its internals to a dashboard (no meta API)
- Project identity (no project ID, no project registration)
- Authentication with our managed platform (no `bb login`)

This document adds all of that. When complete, the backend will be able to power a real dashboard with real data.

### What gets built in this document

In order:
1. `bb login` — OAuth flow that authenticates the CLI with `app.betterbase.com`
2. `betterbase_*` system tables — created in every project during `bb init`
3. Project ID generation — nanoid for self-hosted, server-generated for managed
4. API key generation — `anon` and `service_role` keys created during `bb init`
5. Key middleware — all routes validated against the key system
6. Request logging middleware — every request written to `betterbase_logs`
7. Meta API — `/api/meta/*` endpoints that the dashboard reads
8. `bb init` rebuild — wires everything above together

---

## PART 1: PROJECT CONTEXT

```
MONOREPO ROOT: /betterbase
RUNTIME: Bun
LANGUAGE: TypeScript strict mode — no `any`, no implicit types
API FRAMEWORK: Hono
ORM: Drizzle ORM
AUTH: BetterAuth (already implemented — do not break)
VALIDATION: Zod
CLI PROMPTS: inquirer@^10.2.2
CLI LOGGING: packages/cli/src/utils/logger.ts (info, warn, success, error)

KEY RULE: Authorization: Bearer <key> is the standard.
  - anon key → passed by frontend clients
  - service_role key → passed by dashboard and server-side scripts
  - BetterAuth session token → passed by authenticated users via Cookie or Bearer

DO NOT TOUCH:
  - packages/cli/src/commands/migrate.ts  (reuse its migration tracking)
  - packages/cli/src/commands/auth.ts     (BetterAuth setup, already fixed)
  - packages/cli/src/commands/generate.ts
  - packages/client/                      (SDK, separate concern)
  - templates/base/src/auth/              (BetterAuth instance, already fixed)
```

---

## PART 2: THE SYSTEM TABLES

Every BetterBase project gets four reserved tables created automatically during `bb init`. These tables are prefixed with `betterbase_` so they never conflict with user-defined tables.

### 2.1 Table Definitions

Add these to `templates/base/src/db/schema.ts` in a clearly marked section. Add them BELOW the BetterAuth tables. Do not remove any existing content.

**For SQLite (local development):**

```typescript
// ─────────────────────────────────────────────────────────────────────────────
// BetterBase System Tables
// These are reserved tables managed by BetterBase internals.
// Do not modify or delete these tables manually.
// ─────────────────────────────────────────────────────────────────────────────

export const betterbaseProject = sqliteTable("betterbase_project", {
  id: text("id").primaryKey(),                    // nanoid — generated at bb init
  name: text("name").notNull(),                   // human-readable project name
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
})

export const betterbaseKeys = sqliteTable("betterbase_keys", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => betterbaseProject.id),
  keyType: text("key_type", { enum: ["anon", "service_role"] }).notNull(),
  // The actual key is stored HASHED. The raw key is only shown once at bb init.
  // We use SHA-256 for hashing — fast enough, not a password so bcrypt is overkill.
  keyHash: text("key_hash").notNull().unique(),
  // We store a non-sensitive key prefix so the user can identify which key is which
  // in the dashboard without exposing the full key. Example: "bb_anon_v7k2mx..."
  keyPrefix: text("key_prefix").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  lastUsedAt: integer("last_used_at", { mode: "timestamp" }),
})

export const betterbaseLogs = sqliteTable("betterbase_logs", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull(),
  method: text("method").notNull(),               // GET, POST, PUT, DELETE, PATCH
  path: text("path").notNull(),                   // /api/users, /api/auth/sign-in
  statusCode: integer("status_code").notNull(),   // 200, 201, 400, 401, 500
  responseTimeMs: integer("response_time_ms").notNull(),
  userId: text("user_id"),                        // null if unauthenticated
  keyType: text("key_type"),                      // "anon" | "service_role" | null
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
})

// betterbase_migrations already exists in the migration system.
// DO NOT create a new one — reuse the existing table from migrate.ts.
// Just verify packages/cli/src/commands/migrate.ts already creates this table.
// If the table is named differently, note the name and use it consistently.
```

**For Postgres (production providers — Neon, Supabase DB, raw Postgres):**

When the provider is Postgres, replace `sqliteTable` with `pgTable` and update column types:
- `integer("...", { mode: "timestamp" })` → `timestamp("...")`
- `integer("...", { mode: "boolean" })` → `boolean("...")`
- All other column types remain the same

The `bb auth setup` command already handles this dialect detection pattern — follow the same approach in the schema generator.

### 2.2 When These Tables Are Created

These tables are created during `bb init` by running a migration immediately after the project files are written. The user does not need to run `bb migrate` manually for system tables — it happens automatically.

In `packages/cli/src/commands/init.ts`, after `writeProjectFiles()` completes, add a call to `initializeSystemTables(projectRoot)` which runs the DDL for these four tables directly using Drizzle's `migrate()` function.

---

## PART 3: `bb login` COMMAND

### 3.1 What it does

`bb login` authenticates the CLI with `app.betterbase.com` using an OAuth device flow — the same pattern used by GitHub CLI, Vercel CLI, and Supabase CLI. No password is ever entered in the terminal.

### 3.2 The flow

```
User runs: bb login

CLI generates a one-time code: "XKCD-7823"
CLI opens browser: https://app.betterbase.com/cli/auth?code=XKCD-7823
CLI prints to terminal:
  "Opening browser for authentication..."
  "If browser didn't open, visit: https://app.betterbase.com/cli/auth?code=XKCD-7823"
  "Waiting for authentication..."

[User logs in or signs up at that URL in browser]
[Browser redirects to: https://app.betterbase.com/cli/auth/callback?code=XKCD-7823&token=JWT_HERE]
[app.betterbase.com marks the code as authenticated and stores the JWT]

CLI polls every 2 seconds: GET https://app.betterbase.com/api/cli/auth/poll?code=XKCD-7823
  → Returns 202 (pending) while user hasn't authenticated yet
  → Returns 200 { token: "JWT_HERE", user: { email, id } } once authenticated

CLI receives token → stores in ~/.betterbase/credentials.json
CLI prints: "✓ Logged in as user@email.com"
```

### 3.3 Implementation

**File to create:** `packages/cli/src/commands/login.ts`

```typescript
import path from "path"
import fs from "fs/promises"
import { existsSync } from "fs"
import os from "os"
import { info, success, error as logError, warn } from "../utils/logger"

const BETTERBASE_API = process.env.BETTERBASE_API_URL ?? "https://app.betterbase.com"
const CREDENTIALS_PATH = path.join(os.homedir(), ".betterbase", "credentials.json")
const POLL_INTERVAL_MS = 2000
const POLL_TIMEOUT_MS = 300000  // 5 minutes

export interface Credentials {
  token: string
  email: string
  userId: string
  expiresAt: string
}

/**
 * runLoginCommand
 * Authenticates the CLI with app.betterbase.com via browser OAuth flow.
 */
export async function runLoginCommand(): Promise<void> {
  // Check if already logged in
  const existing = await getCredentials()
  if (existing) {
    info(`Already logged in as ${existing.email}`)
    info("Run bb logout to sign out.")
    return
  }

  // Generate a one-time device code
  const code = generateDeviceCode()
  const authUrl = `${BETTERBASE_API}/cli/auth?code=${code}`

  info("Opening browser for authentication...")
  info(`Auth URL: ${authUrl}`)
  info("Waiting for authentication... (timeout: 5 minutes)")

  // Try to open the browser
  await openBrowser(authUrl)

  // Poll for authentication
  const credentials = await pollForAuth(code)

  if (!credentials) {
    logError("Authentication timed out. Run bb login to try again.")
    process.exit(1)
  }

  // Store credentials
  await saveCredentials(credentials)
  success(`Logged in as ${credentials.email}`)
}

/**
 * runLogoutCommand
 * Removes stored credentials.
 */
export async function runLogoutCommand(): Promise<void> {
  if (existsSync(CREDENTIALS_PATH)) {
    await fs.unlink(CREDENTIALS_PATH)
    success("Logged out successfully.")
  } else {
    warn("Not currently logged in.")
  }
}

/**
 * getCredentials
 * Reads stored credentials from ~/.betterbase/credentials.json
 * Returns null if not logged in or credentials expired.
 */
export async function getCredentials(): Promise<Credentials | null> {
  if (!existsSync(CREDENTIALS_PATH)) return null
  try {
    const raw = await fs.readFile(CREDENTIALS_PATH, "utf-8")
    const creds = JSON.parse(raw) as Credentials
    if (new Date(creds.expiresAt) < new Date()) return null
    return creds
  } catch {
    return null
  }
}

/**
 * requireCredentials
 * Used by commands that require authentication (like bb init in managed mode).
 * Exits with a helpful message if not logged in.
 */
export async function requireCredentials(): Promise<Credentials> {
  const creds = await getCredentials()
  if (!creds) {
    logError(
      "Not logged in. Run: bb login\n" +
      "This connects your CLI with app.betterbase.com so your project\n" +
      "can be registered and managed from the dashboard."
    )
    process.exit(1)
  }
  return creds
}

// ── Internal helpers ─────────────────────────────────────────────────────────

function generateDeviceCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  const part1 = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join("")
  const part2 = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join("")
  return `${part1}-${part2}`
}

async function openBrowser(url: string): Promise<void> {
  const { platform } = process
  try {
    if (platform === "darwin") {
      const { execSync } = await import("child_process")
      execSync(`open "${url}"`, { stdio: "ignore" })
    } else if (platform === "win32") {
      const { execSync } = await import("child_process")
      execSync(`start "" "${url}"`, { stdio: "ignore" })
    } else {
      const { execSync } = await import("child_process")
      execSync(`xdg-open "${url}"`, { stdio: "ignore" })
    }
  } catch {
    // Browser open failed — URL already printed, user can open manually
  }
}

async function pollForAuth(code: string): Promise<Credentials | null> {
  const startTime = Date.now()

  while (Date.now() - startTime < POLL_TIMEOUT_MS) {
    await sleep(POLL_INTERVAL_MS)

    try {
      const response = await fetch(
        `${BETTERBASE_API}/api/cli/auth/poll?code=${code}`
      )

      if (response.status === 200) {
        const data = await response.json() as {
          token: string
          email: string
          userId: string
          expiresAt: string
        }
        return data
      }
      // 202 = still pending, continue polling
      // Any other status = error, continue polling until timeout
    } catch {
      // Network error — continue polling
    }
  }

  return null
}

async function saveCredentials(creds: Credentials): Promise<void> {
  const dir = path.dirname(CREDENTIALS_PATH)
  await fs.mkdir(dir, { recursive: true })
  await fs.writeFile(CREDENTIALS_PATH, JSON.stringify(creds, null, 2), "utf-8")
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
```

### 3.4 Register the command in the CLI

**File:** `packages/cli/src/index.ts`

Add these two commands:

```typescript
import { runLoginCommand, runLogoutCommand } from "./commands/login"

program
  .command("login")
  .description("Authenticate the CLI with app.betterbase.com")
  .action(runLoginCommand)

program
  .command("logout")
  .description("Sign out of app.betterbase.com")
  .action(runLogoutCommand)
```

---

## PART 4: API KEY SYSTEM

### 4.1 Key format

BetterBase API keys follow this format:

```
bb_anon_v7k2mxpq4n8js3ab        ← anon key
bb_service_v7k2mxpq4n8js3ab     ← service_role key
```

Structure: `bb_<type>_<projectId>`

The project ID is embedded in the key. This lets the middleware identify which project a request is for just from the key itself — no database lookup of a separate project registry needed.

### 4.2 Key generation during `bb init`

**File:** `packages/cli/src/utils/key-generator.ts` (create this file)

```typescript
import { createHash } from "crypto"

export interface GeneratedKeys {
  anonKey: string
  anonKeyHash: string
  anonKeyPrefix: string
  serviceRoleKey: string
  serviceRoleKeyHash: string
  serviceRoleKeyPrefix: string
}

/**
 * generateProjectKeys
 * Generates anon and service_role keys for a new BetterBase project.
 * Returns both the raw keys (shown once to user) and their hashes (stored in DB).
 */
export function generateProjectKeys(projectId: string): GeneratedKeys {
  const anonRandom = generateSecureRandom(32)
  const serviceRandom = generateSecureRandom(32)

  const anonKey = `bb_anon_${projectId}_${anonRandom}`
  const serviceRoleKey = `bb_service_${projectId}_${serviceRandom}`

  return {
    anonKey,
    anonKeyHash: hashKey(anonKey),
    anonKeyPrefix: anonKey.substring(0, 20) + "...",
    serviceRoleKey,
    serviceRoleKeyHash: hashKey(serviceRoleKey),
    serviceRoleKeyPrefix: serviceRoleKey.substring(0, 20) + "...",
  }
}

export function hashKey(key: string): string {
  return createHash("sha256").update(key).digest("hex")
}

function generateSecureRandom(length: number): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789"
  const array = new Uint8Array(length)
  crypto.getRandomValues(array)
  return Array.from(array, byte => chars[byte % chars.length]).join("")
}
```

### 4.3 Key middleware

This middleware runs on EVERY request. It reads the `Authorization: Bearer <key>` header, validates the key against `betterbase_keys`, and sets the request context.

**File:** `templates/base/src/middleware/api-key.ts` (create this file)

```typescript
import type { Context, Next } from "hono"
import { createHash } from "crypto"
import { db } from "../db"
import { betterbaseKeys } from "../db/schema"
import { eq } from "drizzle-orm"

export type KeyType = "anon" | "service_role" | null

declare module "hono" {
  interface ContextVariableMap {
    keyType: KeyType
    isAuthenticated: boolean
  }
}

/**
 * apiKeyMiddleware
 *
 * Validates the API key on every request.
 * Sets keyType on context: "anon" | "service_role" | null
 *
 * If no key is provided → keyType is null, request continues
 * (Some public endpoints may not require a key)
 *
 * If invalid key is provided → 401 immediately
 *
 * If valid anon key → keyType = "anon", RLS is enforced
 * If valid service_role key → keyType = "service_role", RLS bypassed
 */
export async function apiKeyMiddleware(c: Context, next: Next): Promise<Response | void> {
  const authHeader = c.req.header("Authorization")

  if (!authHeader) {
    c.set("keyType", null)
    await next()
    return
  }

  if (!authHeader.startsWith("Bearer ")) {
    return c.json({ data: null, error: "Invalid Authorization header format. Use: Bearer <key>" }, 401)
  }

  const key = authHeader.slice(7).trim()

  if (!key) {
    return c.json({ data: null, error: "API key is empty" }, 401)
  }

  const keyHash = createHash("sha256").update(key).digest("hex")

  const keyRecord = await db
    .select()
    .from(betterbaseKeys)
    .where(eq(betterbaseKeys.keyHash, keyHash))
    .get()

  if (!keyRecord) {
    return c.json({ data: null, error: "Invalid API key" }, 401)
  }

  // Update last used timestamp (fire and forget — don't await)
  db.update(betterbaseKeys)
    .set({ lastUsedAt: new Date() })
    .where(eq(betterbaseKeys.id, keyRecord.id))
    .run()

  c.set("keyType", keyRecord.keyType as KeyType)
  await next()
}

/**
 * requireApiKey
 * Blocks requests that have no valid API key at all.
 * Use this on all non-public endpoints.
 */
export async function requireApiKey(c: Context, next: Next): Promise<Response | void> {
  const keyType = c.get("keyType")
  if (!keyType) {
    return c.json({
      data: null,
      error: "API key required. Pass your key as: Authorization: Bearer <your-key>"
    }, 401)
  }
  await next()
}

/**
 * requireServiceRole
 * Blocks requests that are not using the service_role key.
 * Use this on meta API endpoints and admin operations.
 */
export async function requireServiceRole(c: Context, next: Next): Promise<Response | void> {
  const keyType = c.get("keyType")
  if (keyType !== "service_role") {
    return c.json({
      data: null,
      error: "This endpoint requires the service_role key"
    }, 403)
  }
  await next()
}
```

### 4.4 Apply the middleware globally

**File:** `templates/base/src/index.ts`

Add `apiKeyMiddleware` as a global middleware — it runs before every route:

```typescript
import { apiKeyMiddleware } from "./middleware/api-key"

// Apply API key middleware to all routes
app.use("*", apiKeyMiddleware)

// BetterAuth handler (already exists from auth refactor)
app.on(["POST", "GET"], "/api/auth/**", (c) => auth.handler(c.req.raw))

// Your routes below...
```

---

## PART 5: REQUEST LOGGING MIDDLEWARE

Every request — success, error, auth, everything — gets written to `betterbase_logs`.

**File:** `templates/base/src/middleware/logger.ts` (create this file)

```typescript
import type { Context, Next } from "hono"
import { db } from "../db"
import { betterbaseLogs } from "../db/schema"
import { nanoid } from "nanoid"

/**
 * requestLogger
 *
 * Logs every HTTP request to betterbase_logs table.
 * Captures: method, path, status code, response time, user ID, key type, IP.
 *
 * This runs AFTER the response is sent so it captures the actual status code.
 * Fire-and-forget — does not block the response.
 */
export async function requestLogger(c: Context, next: Next): Promise<void> {
  const startTime = Date.now()

  await next()

  const responseTimeMs = Date.now() - startTime

  // Get the project ID from the betterbase_project table
  // We cache this in memory after first read — it never changes
  const projectId = await getProjectId()

  // Fire and forget — don't slow down the response
  db.insert(betterbaseLogs).values({
    id: nanoid(),
    projectId,
    method: c.req.method,
    path: new URL(c.req.url).pathname,
    statusCode: c.res.status,
    responseTimeMs,
    userId: (c.get("user") as { id?: string } | undefined)?.id ?? null,
    keyType: c.get("keyType") ?? null,
    ipAddress: c.req.header("CF-Connecting-IP")
      ?? c.req.header("X-Forwarded-For")
      ?? c.req.header("X-Real-IP")
      ?? null,
    userAgent: c.req.header("User-Agent") ?? null,
    createdAt: new Date(),
  }).run()
}

// ── Project ID cache ─────────────────────────────────────────────────────────

let cachedProjectId: string | null = null

async function getProjectId(): Promise<string> {
  if (cachedProjectId) return cachedProjectId
  const { betterbaseProject } = await import("../db/schema")
  const project = await db.select().from(betterbaseProject).get()
  cachedProjectId = project?.id ?? "unknown"
  return cachedProjectId
}
```

**Apply in `src/index.ts`:**

```typescript
import { requestLogger } from "./middleware/logger"

// Request logger runs after api key middleware, before routes
app.use("*", requestLogger)
```

**Order of middleware in `src/index.ts` must be:**
```typescript
app.use("*", apiKeyMiddleware)   // 1. Validate API key first
app.use("*", requestLogger)      // 2. Log the request
app.on(["POST", "GET"], "/api/auth/**", ...) // 3. Auth routes
// ... your routes
```

---

## PART 6: THE META API

The meta API is a set of Hono routes mounted at `/api/meta/*`. These routes are what the BetterBaseDashboard reads to display real data. All meta routes require the `service_role` key.

**File:** `templates/base/src/routes/meta.ts` (create this file)

```typescript
import { Hono } from "hono"
import { db } from "../db"
import {
  betterbaseProject,
  betterbaseKeys,
  betterbaseLogs,
  user as authUser,
  session as authSession,
} from "../db/schema"
import { desc, count, gte, eq, and, sql } from "drizzle-orm"
import { requireServiceRole } from "../middleware/api-key"

export const metaRoute = new Hono()

// All meta routes require service_role key
metaRoute.use("*", requireServiceRole)

// ── GET /api/meta/project ─────────────────────────────────────────────────────
// Returns the project info

metaRoute.get("/project", async (c) => {
  const project = await db.select().from(betterbaseProject).get()
  if (!project) return c.json({ data: null, error: "Project not initialized" }, 500)
  return c.json({ data: project, error: null })
})

// ── GET /api/meta/stats ───────────────────────────────────────────────────────
// Returns overview stats for the dashboard home page

metaRoute.get("/stats", async (c) => {
  const [
    totalUsers,
    activeSessions,
    totalRequests,
    requestsToday,
    errorRate,
  ] = await Promise.all([
    db.select({ count: count() }).from(authUser).get(),
    db.select({ count: count() }).from(authSession)
      .where(gte(authSession.expiresAt, new Date()))
      .get(),
    db.select({ count: count() }).from(betterbaseLogs).get(),
    db.select({ count: count() }).from(betterbaseLogs)
      .where(gte(betterbaseLogs.createdAt, startOfToday()))
      .get(),
    db.select({ count: count() }).from(betterbaseLogs)
      .where(
        and(
          gte(betterbaseLogs.createdAt, startOfToday()),
          gte(betterbaseLogs.statusCode, 500)
        )
      )
      .get(),
  ])

  return c.json({
    data: {
      totalUsers: totalUsers?.count ?? 0,
      activeSessions: activeSessions?.count ?? 0,
      totalRequests: totalRequests?.count ?? 0,
      requestsToday: requestsToday?.count ?? 0,
      errorsToday: errorRate?.count ?? 0,
    },
    error: null,
  })
})

// ── GET /api/meta/tables ─────────────────────────────────────────────────────
// Returns the list of user-defined tables with row counts

metaRoute.get("/tables", async (c) => {
  // Get all table names from sqlite_master (SQLite) or information_schema (Postgres)
  // This is the only place we use raw SQL — Drizzle doesn't have a schema inspection API
  const tables = await db.all<{ name: string; count: number }>(
    sql`
      SELECT name, (SELECT COUNT(*) FROM main."" || name || "") as count
      FROM sqlite_master
      WHERE type = 'table'
      AND name NOT LIKE 'betterbase_%'
      AND name NOT LIKE '__drizzle_%'
      AND name NOT IN ('user', 'session', 'account', 'verification')
      ORDER BY name ASC
    `
  )

  return c.json({ data: tables, error: null })
})

// ── GET /api/meta/tables/:tableName/rows ─────────────────────────────────────
// Returns rows from a specific table (paginated)

metaRoute.get("/tables/:tableName/rows", async (c) => {
  const tableName = c.req.param("tableName")
  const limit = parseInt(c.req.query("limit") ?? "50")
  const offset = parseInt(c.req.query("offset") ?? "0")

  // Validate table name — only alphanumeric and underscores
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tableName)) {
    return c.json({ data: null, error: "Invalid table name" }, 400)
  }

  // Prevent access to system tables via this endpoint
  if (tableName.startsWith("betterbase_") || ["user", "session", "account", "verification"].includes(tableName)) {
    return c.json({ data: null, error: "Cannot access system tables via this endpoint" }, 403)
  }

  const rows = await db.all(
    sql`SELECT * FROM ${sql.identifier(tableName)} LIMIT ${limit} OFFSET ${offset}`
  )
  const total = await db.get<{ count: number }>(
    sql`SELECT COUNT(*) as count FROM ${sql.identifier(tableName)}`
  )

  return c.json({
    data: rows,
    count: total?.count ?? 0,
    error: null,
  })
})

// ── GET /api/meta/users ───────────────────────────────────────────────────────
// Returns BetterAuth users (paginated)

metaRoute.get("/users", async (c) => {
  const limit = parseInt(c.req.query("limit") ?? "20")
  const offset = parseInt(c.req.query("offset") ?? "0")

  const [users, total] = await Promise.all([
    db.select({
      id: authUser.id,
      name: authUser.name,
      email: authUser.email,
      emailVerified: authUser.emailVerified,
      createdAt: authUser.createdAt,
    })
    .from(authUser)
    .limit(limit)
    .offset(offset)
    .orderBy(desc(authUser.createdAt)),
    db.select({ count: count() }).from(authUser).get(),
  ])

  return c.json({
    data: users,
    count: total?.count ?? 0,
    error: null,
  })
})

// ── DELETE /api/meta/users/:userId ───────────────────────────────────────────
// Deletes a user and their sessions

metaRoute.delete("/users/:userId", async (c) => {
  const userId = c.req.param("userId")

  await db.delete(authUser).where(eq(authUser.id, userId))

  return c.json({ data: { deleted: true }, error: null })
})

// ── GET /api/meta/logs ────────────────────────────────────────────────────────
// Returns request logs (paginated, filterable)

metaRoute.get("/logs", async (c) => {
  const limit = parseInt(c.req.query("limit") ?? "50")
  const offset = parseInt(c.req.query("offset") ?? "0")
  const method = c.req.query("method")
  const statusMin = c.req.query("statusMin") ? parseInt(c.req.query("statusMin")!) : undefined
  const statusMax = c.req.query("statusMax") ? parseInt(c.req.query("statusMax")!) : undefined

  const logs = await db
    .select()
    .from(betterbaseLogs)
    .orderBy(desc(betterbaseLogs.createdAt))
    .limit(limit)
    .offset(offset)

  const total = await db.select({ count: count() }).from(betterbaseLogs).get()

  return c.json({
    data: logs,
    count: total?.count ?? 0,
    error: null,
  })
})

// ── GET /api/meta/keys ────────────────────────────────────────────────────────
// Returns the API keys (prefix only — never the full key)

metaRoute.get("/keys", async (c) => {
  const keys = await db
    .select({
      id: betterbaseKeys.id,
      keyType: betterbaseKeys.keyType,
      keyPrefix: betterbaseKeys.keyPrefix,
      createdAt: betterbaseKeys.createdAt,
      lastUsedAt: betterbaseKeys.lastUsedAt,
    })
    .from(betterbaseKeys)
    .orderBy(betterbaseKeys.keyType)

  return c.json({ data: keys, error: null })
})

// ── GET /api/meta/logs/chart ──────────────────────────────────────────────────
// Returns hourly request counts for the last 24 hours (for dashboard chart)

metaRoute.get("/logs/chart", async (c) => {
  const hours = Array.from({ length: 24 }, (_, i) => {
    const d = new Date()
    d.setHours(d.getHours() - (23 - i), 0, 0, 0)
    return d
  })

  const data = await Promise.all(
    hours.map(async (hour) => {
      const next = new Date(hour.getTime() + 3600000)
      const result = await db
        .select({ count: count() })
        .from(betterbaseLogs)
        .where(
          and(
            gte(betterbaseLogs.createdAt, hour),
            sql`${betterbaseLogs.createdAt} < ${next}`
          )
        )
        .get()
      return {
        hour: hour.toISOString(),
        requests: result?.count ?? 0,
      }
    })
  )

  return c.json({ data, error: null })
})

// ── Helpers ───────────────────────────────────────────────────────────────────

function startOfToday(): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}
```

**Register the meta route in `src/routes/index.ts`:**

```typescript
import { metaRoute } from "./meta"

app.route("/api/meta", metaRoute)
```

---

## PART 7: REBUILD `bb init`

### 7.1 New flow

```
bb init
→ Check if logged in (getCredentials())
→ If not: "Run bb login first to connect your CLI with app.betterbase.com"
→ If yes: continue

Prompt: "Project name?" → validates slug format
Prompt: "Which database provider?" → (existing expanded provider prompts)
Prompt: "Set up authentication now?" → (existing auth setup)
Prompt: "Set up storage now?" → (existing storage prompts)

Summary: shows project name, provider, auth, storage
Prompt: "Proceed?" → confirm

→ Call app.betterbase.com/api/projects/create with { name, userId: credentials.userId }
→ Server returns { projectId, anonKey, serviceRoleKey }

→ Write all project files (existing writeProjectFiles())
→ Write betterbase.config.ts with projectId
→ Run initializeSystemTables() — creates betterbase_* tables
→ Insert project row into betterbase_project
→ Insert hashed keys into betterbase_keys
→ Print keys to terminal (ONCE — they cannot be retrieved again from CLI)
→ Run bb auth setup if user selected auth
→ Done
```

### 7.2 Key printing to terminal

After project creation, print the keys clearly and warn the user to copy them:

```typescript
success(`\nProject "${projectName}" created!\n`)
info("─────────────────────────────────────────────────────")
info("API Keys — Copy these now. They will not be shown again.")
info("─────────────────────────────────────────────────────")
info(`Project ID:        ${projectId}`)
info(`Anon key:          ${anonKey}`)
info(`Service role key:  ${serviceRoleKey}`)
info("─────────────────────────────────────────────────────")
warn("Keep your service_role key secret. Never expose it in client-side code.")
info("You can view key prefixes anytime in your dashboard at app.betterbase.com")
info("─────────────────────────────────────────────────────\n")
```

Also write keys to `.env`:

```
BETTERBASE_PROJECT_ID=<projectId>
BETTERBASE_ANON_KEY=<anonKey>
BETTERBASE_SERVICE_ROLE_KEY=<serviceRoleKey>
```

### 7.3 Self-hosted mode detection

If `bb login` has not been run (no credentials), instead of exiting, ask:

```
? No app.betterbase.com account detected.
  How do you want to proceed?
  ❯ Log in to app.betterbase.com (recommended)
    Continue without account (self-hosted mode)
```

If user picks "Continue without account":
- Generate projectId with `nanoid(16)` locally
- Generate keys locally with `generateProjectKeys()`
- No server call — fully offline
- Warn: "Running in self-hosted mode. Your project will not appear in app.betterbase.com"

---

## PART 8: VERIFICATION

After implementing everything, run these checks:

```bash
# 1. Install dependencies
bun install

# 2. TypeScript check
bun run typecheck
# Expected: zero errors

# 3. Test bb login
bb login
# Expected: opens browser, completes auth, prints "Logged in as..."

# 4. Test bb init
bb init test-project
# Expected:
# - Project files created
# - Keys printed to terminal
# - betterbase_* tables created in database
# - .env has BETTERBASE_PROJECT_ID, BETTERBASE_ANON_KEY, BETTERBASE_SERVICE_ROLE_KEY

# 5. Test API key middleware
curl http://localhost:3000/api/users
# Expected: 401 "API key required"

curl http://localhost:3000/api/users \
  -H "Authorization: Bearer INVALID_KEY"
# Expected: 401 "Invalid API key"

curl http://localhost:3000/api/users \
  -H "Authorization: Bearer $BETTERBASE_ANON_KEY"
# Expected: 200 with data

# 6. Test meta API with anon key (should fail)
curl http://localhost:3000/api/meta/stats \
  -H "Authorization: Bearer $BETTERBASE_ANON_KEY"
# Expected: 403 "This endpoint requires the service_role key"

# 7. Test meta API with service_role key (should work)
curl http://localhost:3000/api/meta/stats \
  -H "Authorization: Bearer $BETTERBASE_SERVICE_ROLE_KEY"
# Expected: 200 with { totalUsers, activeSessions, totalRequests, ... }

# 8. Test request logging
curl http://localhost:3000/api/users \
  -H "Authorization: Bearer $BETTERBASE_ANON_KEY"
curl http://localhost:3000/api/meta/logs \
  -H "Authorization: Bearer $BETTERBASE_SERVICE_ROLE_KEY"
# Expected: logs array contains the previous request
```

---

## PART 9: FILES CHANGED SUMMARY

| File | Action |
|------|--------|
| `packages/cli/src/commands/login.ts` | CREATE |
| `packages/cli/src/commands/init.ts` | MODIFY — add login check, key generation, system table init |
| `packages/cli/src/utils/key-generator.ts` | CREATE |
| `packages/cli/src/index.ts` | MODIFY — register login/logout commands |
| `templates/base/src/db/schema.ts` | MODIFY — add betterbase_* tables |
| `templates/base/src/middleware/api-key.ts` | CREATE |
| `templates/base/src/middleware/logger.ts` | CREATE |
| `templates/base/src/routes/meta.ts` | CREATE |
| `templates/base/src/routes/index.ts` | MODIFY — register meta route |
| `templates/base/src/index.ts` | MODIFY — apply middleware in correct order |
| `packages/client/src/index.ts` | MODIFY — export key types |

**Do not touch:** `migrate.ts`, `auth.ts`, `generate.ts`, `dev.ts`, `scanner.ts`, `context-generator.ts`, `packages/client/src/auth.ts`
