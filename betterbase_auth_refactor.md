# BetterBase — Refactoring the Authentication System to Real BetterAuth
> **Priority:** CRITICAL — Complete this before any Phase 10–15 work begins.
> **Why:** The current auth system is fake. It is hand-rolled strings pretending to be BetterAuth. Real BetterAuth is not installed anywhere in the monorepo. This document tells you exactly how to fix that.
> **Who this is for:** An LLM agent (Cursor, Codex, or similar) that will implement this refactor. Every step is written assuming you have no prior context. Read the entire document before writing a single line of code.

---

## PART 0: READ THIS FIRST — UNDERSTAND WHAT IS BROKEN

### What exists right now (the problem)

Open this file: `packages/cli/src/commands/auth.ts`

You will find three large string constants:
- `AUTH_SCHEMA_BLOCK` — a string of SQL/Drizzle code for sessions and accounts tables
- `AUTH_ROUTE_FILE` — a string of TypeScript code for auth route handlers
- `AUTH_MIDDLEWARE_FILE` — a string of TypeScript code for `requireAuth()` and `optionalAuth()`

When the user runs `bb auth setup`, the CLI writes these strings directly to files in the user's project. That's it. There is no `better-auth` package imported anywhere. There is no `betterAuth({...})` call anywhere. The current implementation is a completely custom, hand-written authentication system that happens to be called "BetterAuth integration" in the comments but has nothing to do with the real BetterAuth library.

### What the real BetterAuth library is

BetterAuth (`better-auth`) is a real npm package. Its documentation lives at `https://www.better-auth.com`. It provides:
- A server-side auth instance created with `betterAuth({...})`
- A Drizzle adapter so it uses your existing Drizzle database
- A single request handler `auth.handler(request)` that handles all auth routes automatically
- A client-side library `better-auth/client` with `createAuthClient()`
- A plugin system where you add features like rate limiting, two-factor auth, magic links, passkeys, and more just by adding them to a `plugins: []` array
- A CLI tool `@better-auth/cli` that generates the correct Drizzle schema tables for you

### What this refactor does

This refactor replaces the fake hand-rolled auth with real BetterAuth across three places:

1. **`templates/base/`** — the project scaffold template gets a real BetterAuth setup
2. **`packages/cli/src/commands/auth.ts`** — `bb auth setup` gets rewritten to scaffold real BetterAuth files
3. **`packages/client/src/auth.ts`** — the client SDK auth module gets rewritten to use `better-auth/client`

---

## PART 1: PROJECT CONTEXT

Before writing any code, understand the project you are working in.

```
PROJECT: BetterBase — AI-Native Backend-as-a-Service Framework
MONOREPO ROOT: /betterbase
RUNTIME: Bun
LANGUAGE: TypeScript — strict mode everywhere. No `any` types. No implicit types.
API FRAMEWORK: Hono (all server routes use Hono)
ORM: Drizzle ORM (all database access goes through Drizzle)
VALIDATION: Zod (all input validation uses Zod schemas)
CLI PROMPTS: inquirer@^10.2.2 (this is what the CLI uses for interactive prompts)
CLI LOGGING: packages/cli/src/utils/logger.ts exports info(), warn(), error(), success()
MONOREPO TOOL: Turborepo with Bun workspaces

MONOREPO STRUCTURE:
/betterbase
  /apps
    /cli          → thin wrapper, ignore this
    /dashboard    → Next.js dashboard, you will touch this at the end
  /packages
    /cli          → THE CANONICAL CLI — this is where bb commands live
      /src
        /commands
          init.ts      → bb init (DO NOT BREAK)
          dev.ts       → bb dev (DO NOT BREAK)
          migrate.ts   → bb migrate (DO NOT BREAK)
          auth.ts      → bb auth setup (YOU WILL REWRITE THIS)
          generate.ts  → bb generate crud (DO NOT BREAK)
        /utils
          logger.ts    → logging utilities (DO NOT TOUCH)
          prompts.ts   → inquirer wrappers (DO NOT TOUCH)
          scanner.ts   → Drizzle schema AST scanner (DO NOT TOUCH)
    /client       → @betterbase/client SDK
      /src
        auth.ts        → client auth module (YOU WILL REWRITE THIS)
        client.ts      → main BetterBaseClient class (DO NOT BREAK)
        realtime.ts    → WebSocket client (DO NOT TOUCH)
        query-builder.ts → query builder (DO NOT TOUCH)
    /core         → stub, do not touch
    /shared       → stub, do not touch
  /templates
    /base         → the project scaffold template
      /src
        /db
          schema.ts    → Drizzle schema (YOU WILL ADD AUTH TABLES HERE)
        /routes
          index.ts     → route registration (YOU WILL ADD AUTH MOUNT HERE)
        /middleware
          auth.ts      → auth middleware (YOU WILL REWRITE THIS FILE)
      betterbase.config.ts  → project config (DO NOT CHANGE)
      package.json          → template dependencies (YOU WILL ADD better-auth HERE)
    /auth         → stub placeholder, you will fill this in
```

---

## PART 2: BETTERAUTH FUNDAMENTALS

Read this section completely before writing any code. These are the exact patterns you must follow.

### 2.1 How BetterAuth works on the server

BetterAuth requires three things on the server side:

**Thing 1: An auth instance file**

You create one file — call it `src/auth/index.ts` — that creates and exports the auth instance:

```typescript
import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { db } from "../db"
import * as schema from "../db/schema"

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "sqlite",  // "sqlite" for local dev, "pg" for Postgres
    schema: {
      user: schema.user,           // IMPORTANT: BetterAuth calls it "user" not "users"
      session: schema.session,     // BetterAuth calls it "session" not "sessions"
      account: schema.account,     // BetterAuth calls it "account" not "accounts"
      verification: schema.verification,
    }
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,  // keep false for now, can enable later
  },
  secret: process.env.AUTH_SECRET,
  baseURL: process.env.AUTH_URL ?? "http://localhost:3000",
  plugins: [],  // empty for now — plugins are added here later
})
```

**Thing 2: Mount the handler in Hono**

In `src/index.ts` (the main server file), add ONE line to mount BetterAuth's handler. BetterAuth handles ALL auth routes itself — you do not write individual signUp/signIn/signOut routes:

```typescript
import { auth } from "./auth"

// Mount BetterAuth — this handles /api/auth/sign-in, /api/auth/sign-up, etc.
app.on(["POST", "GET"], "/api/auth/**", (c) => {
  return auth.handler(c.req.raw)
})
```

**Thing 3: Middleware that uses the session**

The `requireAuth()` middleware reads the session from BetterAuth's API:

```typescript
import { auth } from "../auth"
import type { Context, Next } from "hono"

export async function requireAuth(c: Context, next: Next) {
  const session = await auth.api.getSession({
    headers: c.req.raw.headers,
  })
  if (!session) {
    return c.json({ data: null, error: "Unauthorized" }, 401)
  }
  c.set("user", session.user)
  c.set("session", session.session)
  await next()
}

export async function optionalAuth(c: Context, next: Next) {
  const session = await auth.api.getSession({
    headers: c.req.raw.headers,
  })
  if (session) {
    c.set("user", session.user)
    c.set("session", session.session)
  }
  await next()
}
```

### 2.2 How BetterAuth generates the database schema

BetterAuth has its own CLI that generates the Drizzle schema tables it needs. You run:

```bash
bunx @better-auth/cli generate --output src/db/schema.ts
```

This adds four tables to your schema file:
- `user` — stores user accounts (id, name, email, emailVerified, image, createdAt, updatedAt)
- `session` — stores active sessions (id, expiresAt, token, userId, ipAddress, userAgent)
- `account` — stores OAuth accounts (id, userId, providerId, accountId, etc.)
- `verification` — stores email verification tokens

**IMPORTANT naming:** BetterAuth uses singular table names — `user`, `session`, `account`, `verification`. Not `users`, `sessions`. This is not a mistake. Do not rename them.

### 2.3 How BetterAuth works on the client

The `@betterbase/client` SDK wraps BetterAuth's client. In the client package you use:

```typescript
import { createAuthClient } from "better-auth/client"

const authClient = createAuthClient({
  baseURL: config.url,  // the BetterBase server URL
})

// Sign up
await authClient.signUp.email({
  email: "user@example.com",
  password: "securepassword",
  name: "John Doe",
})

// Sign in
await authClient.signIn.email({
  email: "user@example.com",
  password: "securepassword",
})

// Get session
const session = await authClient.getSession()

// Sign out
await authClient.signOut()
```

### 2.4 The plugin system — why we chose BetterAuth

This is the most important architectural point. BetterAuth plugins are added to the `plugins: []` array in the auth instance. Each plugin adds new capabilities without you writing any code:

```typescript
import { betterAuth } from "better-auth"
import { twoFactor } from "better-auth/plugins"
import { rateLimit } from "better-auth/plugins"
import { magicLink } from "better-auth/plugins"
import { passkey } from "better-auth/plugins"
import { organization } from "better-auth/plugins"

export const auth = betterAuth({
  // ... database config ...
  plugins: [
    twoFactor(),       // adds /api/auth/two-factor/* routes automatically
    rateLimit(),       // adds rate limiting to all auth endpoints
    magicLink(),       // adds /api/auth/magic-link/* routes
    passkey(),         // adds WebAuthn/passkey support
    organization(),    // adds multi-tenant organization support
  ]
})
```

The refactor you are doing right now sets up the foundation. The `plugins: []` array starts empty and is ready for future additions. Do not implement any plugins yet — just leave the array empty with a comment explaining where plugins go.

---

## PART 3: WHAT YOU WILL BUILD — COMPLETE FILE LIST

Here is every file you will create or modify. Nothing else should change.

### Files to CREATE (new files that do not exist yet):

```
templates/base/src/auth/index.ts
templates/base/src/auth/types.ts
templates/auth/src/auth/index.ts
templates/auth/src/auth/types.ts
templates/auth/src/middleware/auth.ts
templates/auth/src/routes/auth-example.ts
templates/auth/README.md  (replace the existing placeholder)
```

### Files to MODIFY (existing files that need changes):

```
templates/base/package.json
  → add: better-auth as a dependency

templates/base/src/db/schema.ts
  → add: user, session, account, verification tables for BetterAuth

templates/base/src/index.ts
  → add: BetterAuth handler mount

templates/base/src/middleware/auth.ts
  → replace: entire file with real BetterAuth middleware

packages/cli/src/commands/auth.ts
  → replace: entire file with new implementation that scaffolds real BetterAuth

packages/client/src/auth.ts
  → replace: entire file with better-auth/client wrapper

packages/client/package.json
  → add: better-auth as a dependency
```

### Files to NOT TOUCH:

```
templates/base/betterbase.config.ts   → leave as is
templates/base/drizzle.config.ts      → leave as is
templates/base/src/routes/            → leave as is (except index.ts)
templates/base/src/db/index.ts        → leave as is
packages/cli/src/commands/init.ts     → leave as is
packages/cli/src/commands/migrate.ts  → leave as is
packages/cli/src/commands/generate.ts → leave as is
packages/cli/src/utils/             → leave everything as is
packages/client/src/client.ts         → leave as is
packages/client/src/query-builder.ts  → leave as is
packages/client/src/realtime.ts       → leave as is
```

---

## PART 4: STEP-BY-STEP IMPLEMENTATION

Follow these steps in exact order. Do not skip ahead.

---

### STEP 1: Add `better-auth` to the template's package.json

**File:** `templates/base/package.json`

Find the `dependencies` object and add `better-auth`:

```json
{
  "dependencies": {
    "hono": "^4.6.10",
    "drizzle-orm": "^0.44.5",
    "zod": "^4.0.0",
    "fast-deep-equal": "...",
    "better-auth": "^1.0.0"
  }
}
```

Use `"^1.0.0"` as the version — this gets the latest stable 1.x release.

---

### STEP 2: Add BetterAuth tables to the template schema

**File:** `templates/base/src/db/schema.ts`

Open this file. It currently has `users` and `posts` tables for demonstration. You need to ADD the four BetterAuth tables. Do not remove or change the existing `users` and `posts` tables.

Add these four tables at the BOTTOM of the file, after all existing content:

```typescript
// ─────────────────────────────────────────────
// BetterAuth Tables — do not rename these
// BetterAuth requires singular names: user, session, account, verification
// ─────────────────────────────────────────────

export const user = sqliteTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: integer("email_verified", { mode: "boolean" }).notNull().default(false),
  image: text("image"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
})

export const session = sqliteTable("session", {
  id: text("id").primaryKey(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  token: text("token").notNull().unique(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
})

export const account = sqliteTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: integer("access_token_expires_at", { mode: "timestamp" }),
  refreshTokenExpiresAt: integer("refresh_token_expires_at", { mode: "timestamp" }),
  scope: text("scope"),
  password: text("password"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
})

export const verification = sqliteTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }),
  updatedAt: integer("updated_at", { mode: "timestamp" }),
})
```

**Why SQLite column types here:** The template uses SQLite for local development (`bun:sqlite`). SQLite does not have native boolean or timestamp column types, so BetterAuth uses `integer` with `mode: "boolean"` and `mode: "timestamp"`. When the provider adapter (Phase 10) switches to Postgres, these column types change. The CLI's `bb auth setup` command will generate the correct types for the selected provider.

---

### STEP 3: Create the auth instance file in the template

**File to create:** `templates/base/src/auth/index.ts`

Create the directory `templates/base/src/auth/` first if it does not exist.

```typescript
import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { db } from "../db"
import * as schema from "../db/schema"

/**
 * BetterBase Auth Instance
 *
 * This is the single source of truth for authentication in your BetterBase project.
 *
 * ADDING PLUGINS:
 * BetterAuth has a rich plugin ecosystem. Add plugins to the `plugins` array below.
 * Each plugin adds new auth capabilities without you writing additional code.
 *
 * Example plugins (install the relevant packages first):
 *   import { twoFactor } from "better-auth/plugins"
 *   import { rateLimit } from "better-auth/plugins"
 *   import { magicLink } from "better-auth/plugins"
 *   import { organization } from "better-auth/plugins"
 *
 * Then add them to plugins: [twoFactor(), rateLimit(), ...]
 *
 * Full plugin list: https://www.better-auth.com/docs/plugins
 */
export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "sqlite",
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
    },
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
  },
  secret: process.env.AUTH_SECRET,
  baseURL: process.env.AUTH_URL ?? "http://localhost:3000",
  trustedOrigins: [process.env.AUTH_URL ?? "http://localhost:3000"],
  /**
   * PLUGINS — add BetterAuth plugins here.
   * See: https://www.better-auth.com/docs/plugins
   */
  plugins: [],
})

export type Auth = typeof auth
```

**File to create:** `templates/base/src/auth/types.ts`

```typescript
import type { auth } from "./index"

/**
 * Type helpers for BetterAuth session data.
 * Use these types throughout your route handlers.
 */
export type Session = typeof auth.$Infer.Session.session
export type User = typeof auth.$Infer.Session.user

/**
 * Type for Hono context variables set by requireAuth middleware.
 * Use this to type your Hono app context.
 *
 * Example:
 *   const app = new Hono<{ Variables: AuthVariables }>()
 */
export type AuthVariables = {
  user: User
  session: Session
}
```

---

### STEP 4: Rewrite the auth middleware in the template

**File:** `templates/base/src/middleware/auth.ts`

This file currently contains hand-rolled custom middleware. Replace the **entire file** with this:

```typescript
import type { Context, Next } from "hono"
import { auth } from "../auth"
import type { User, Session } from "../auth/types"

/**
 * requireAuth — Hono middleware that enforces authentication.
 *
 * Reads the session from the BetterAuth session store.
 * If no valid session exists, returns 401 Unauthorized.
 * If session is valid, sets `user` and `session` on the Hono context.
 *
 * Usage:
 *   app.get("/protected", requireAuth, (c) => {
 *     const user = c.get("user")
 *     return c.json({ user })
 *   })
 */
export async function requireAuth(c: Context, next: Next): Promise<Response | void> {
  const session = await auth.api.getSession({
    headers: c.req.raw.headers,
  })

  if (!session) {
    return c.json({ data: null, error: "Unauthorized" }, 401)
  }

  c.set("user", session.user as User)
  c.set("session", session.session as Session)
  await next()
}

/**
 * optionalAuth — Hono middleware that reads the session if present.
 *
 * Does NOT block the request if unauthenticated.
 * If session is valid, sets `user` and `session` on the Hono context.
 * If not authenticated, the request continues without user context.
 *
 * Usage:
 *   app.get("/public", optionalAuth, (c) => {
 *     const user = c.get("user")  // may be undefined
 *     return c.json({ user: user ?? null })
 *   })
 */
export async function optionalAuth(c: Context, next: Next): Promise<void> {
  const session = await auth.api.getSession({
    headers: c.req.raw.headers,
  })

  if (session) {
    c.set("user", session.user as User)
    c.set("session", session.session as Session)
  }

  await next()
}

/**
 * getAuthUser — utility to get the current user from Hono context.
 *
 * Use inside route handlers after requireAuth middleware.
 * Throws if called in a context where requireAuth was not applied.
 */
export function getAuthUser(c: Context): User {
  const user = c.get("user") as User | undefined
  if (!user) {
    throw new Error(
      "getAuthUser() called in unauthenticated context. " +
      "Apply requireAuth middleware before calling this function."
    )
  }
  return user
}
```

---

### STEP 5: Mount BetterAuth in the template's main server

**File:** `templates/base/src/index.ts`

This file already exists and sets up the Hono app. You need to add two things:

**Add import at the top** (after existing imports):
```typescript
import { auth } from "./auth"
```

**Add the BetterAuth mount** (after `const app = new Hono()` and before route registration):
```typescript
/**
 * BetterAuth handler — mounts all auth routes automatically.
 * Handles: /api/auth/sign-in, /api/auth/sign-up, /api/auth/sign-out,
 *          /api/auth/get-session, and any plugin routes.
 */
app.on(["POST", "GET"], "/api/auth/**", (c) => {
  return auth.handler(c.req.raw)
})
```

Do not change anything else in this file.

---

### STEP 6: Fill in the `templates/auth/` stub

The `templates/auth/` folder is currently a stub with only a README. Fill it in as a reference implementation showing what a fully configured BetterAuth setup looks like.

**File:** `templates/auth/README.md` (replace existing content)

```markdown
# BetterBase Auth Template

This folder contains reference files for BetterAuth integration in a BetterBase project.
These files are generated by `bb auth setup` and reflect what a complete auth setup looks like.

## Files

- `src/auth/index.ts` — The auth instance. This is where you configure BetterAuth and add plugins.
- `src/auth/types.ts` — TypeScript types derived from the auth instance.
- `src/middleware/auth.ts` — requireAuth() and optionalAuth() Hono middleware.
- `src/routes/auth-example.ts` — Example of how to use auth in route handlers.

## Adding plugins

Open `src/auth/index.ts` and add plugins to the `plugins: []` array.
See https://www.better-auth.com/docs/plugins for the full list.

## Environment variables required

AUTH_SECRET=your-secret-here-minimum-32-characters
AUTH_URL=http://localhost:3000
```

**File:** `templates/auth/src/auth/index.ts`

This is identical to `templates/base/src/auth/index.ts` from Step 3. Copy it exactly.

**File:** `templates/auth/src/auth/types.ts`

This is identical to `templates/base/src/auth/types.ts` from Step 3. Copy it exactly.

**File:** `templates/auth/src/middleware/auth.ts`

This is identical to `templates/base/src/middleware/auth.ts` from Step 4. Copy it exactly.

**File:** `templates/auth/src/routes/auth-example.ts`

```typescript
import { Hono } from "hono"
import { requireAuth, optionalAuth, getAuthUser } from "../middleware/auth"
import type { AuthVariables } from "../auth/types"

/**
 * Example route file showing how to use BetterAuth middleware.
 *
 * This is NOT a route you need to add — BetterAuth handles its own routes
 * automatically via the handler mounted in src/index.ts.
 *
 * This file shows how to USE auth in YOUR OWN routes.
 */
const exampleRoute = new Hono<{ Variables: AuthVariables }>()

// Public route — no auth required
exampleRoute.get("/public", (c) => {
  return c.json({ message: "Anyone can see this" })
})

// Protected route — requires valid session
exampleRoute.get("/me", requireAuth, (c) => {
  const user = getAuthUser(c)
  return c.json({
    data: {
      id: user.id,
      name: user.name,
      email: user.email,
    },
    error: null,
  })
})

// Optional auth — works for both logged in and anonymous users
exampleRoute.get("/profile/:id", optionalAuth, (c) => {
  const currentUser = c.get("user")
  const profileId = c.req.param("id")

  return c.json({
    data: {
      profileId,
      isOwner: currentUser?.id === profileId,
    },
    error: null,
  })
})

export { exampleRoute }
```

---

### STEP 7: Rewrite `packages/cli/src/commands/auth.ts`

This is the most important step. The existing file writes hardcoded strings to disk. You will replace it entirely with code that scaffolds real BetterAuth files.

**File:** `packages/cli/src/commands/auth.ts`

Replace the **entire file** with the following. Read all comments carefully before implementing.

```typescript
import path from "path"
import fs from "fs/promises"
import { existsSync } from "fs"
import { execSync } from "child_process"
import { info, warn, success, error as logError } from "../utils/logger"

/**
 * runAuthSetupCommand
 *
 * Sets up real BetterAuth in a BetterBase project.
 *
 * What this function does, in order:
 * 1. Validates we are in a BetterBase project directory
 * 2. Installs better-auth as a dependency
 * 3. Creates src/auth/index.ts — the BetterAuth instance
 * 4. Creates src/auth/types.ts — TypeScript type helpers
 * 5. Writes/overwrites src/middleware/auth.ts with real BetterAuth middleware
 * 6. Generates BetterAuth schema tables using @better-auth/cli
 * 7. Patches src/index.ts to mount the BetterAuth handler
 * 8. Adds AUTH_SECRET and AUTH_URL to .env if not already present
 * 9. Prints success message with next steps
 */
export async function runAuthSetupCommand(projectRoot: string = process.cwd()): Promise<void> {
  info("Setting up BetterAuth...")

  // ── Step 1: Validate project directory ──────────────────────────────────

  const configPath = path.join(projectRoot, "betterbase.config.ts")
  if (!existsSync(configPath)) {
    logError(
      "No betterbase.config.ts found. Are you in a BetterBase project directory?\n" +
      "Run bb auth setup from your project root."
    )
    process.exit(1)
  }

  const schemaPath = path.join(projectRoot, "src", "db", "schema.ts")
  if (!existsSync(schemaPath)) {
    logError("No src/db/schema.ts found. Run bb migrate first to initialize your schema.")
    process.exit(1)
  }

  const indexPath = path.join(projectRoot, "src", "index.ts")
  if (!existsSync(indexPath)) {
    logError("No src/index.ts found. Your project structure may be corrupted.")
    process.exit(1)
  }

  // ── Step 2: Install better-auth ──────────────────────────────────────────

  info("Installing better-auth...")
  try {
    execSync("bun add better-auth", {
      cwd: projectRoot,
      stdio: "inherit",
    })
    success("better-auth installed")
  } catch {
    logError("Failed to install better-auth. Check your internet connection and try again.")
    process.exit(1)
  }

  // ── Step 3: Detect provider for correct schema dialect ───────────────────

  // Read betterbase.config.ts to detect SQLite vs Postgres
  // We do a simple string check — no need to parse TypeScript AST here
  const configContent = await fs.readFile(configPath, "utf-8")
  const isPostgres = configContent.includes("neon") ||
                     configContent.includes("postgres") ||
                     configContent.includes("supabase") ||
                     configContent.includes("planetscale")
  const dialect: "sqlite" | "pg" = isPostgres ? "pg" : "sqlite"

  info(`Detected database dialect: ${dialect}`)

  // ── Step 4: Create src/auth/ directory ───────────────────────────────────

  const authDir = path.join(projectRoot, "src", "auth")
  await fs.mkdir(authDir, { recursive: true })

  // ── Step 5: Write src/auth/index.ts ──────────────────────────────────────

  const authIndexPath = path.join(authDir, "index.ts")

  // Only write if it doesn't already exist (don't overwrite user customizations)
  if (existsSync(authIndexPath)) {
    warn("src/auth/index.ts already exists — skipping to preserve your customizations.")
  } else {
    await fs.writeFile(authIndexPath, buildAuthInstance(dialect), "utf-8")
    success("Created src/auth/index.ts")
  }

  // ── Step 6: Write src/auth/types.ts ──────────────────────────────────────

  const authTypesPath = path.join(authDir, "types.ts")

  if (existsSync(authTypesPath)) {
    warn("src/auth/types.ts already exists — skipping.")
  } else {
    await fs.writeFile(authTypesPath, buildAuthTypes(), "utf-8")
    success("Created src/auth/types.ts")
  }

  // ── Step 7: Write src/middleware/auth.ts ─────────────────────────────────

  const middlewareDir = path.join(projectRoot, "src", "middleware")
  await fs.mkdir(middlewareDir, { recursive: true })
  const middlewarePath = path.join(middlewareDir, "auth.ts")

  // Always overwrite the middleware — this is a refactor target
  await fs.writeFile(middlewarePath, buildAuthMiddleware(), "utf-8")
  success("Written src/middleware/auth.ts")

  // ── Step 8: Generate BetterAuth schema tables ─────────────────────────────

  info("Generating BetterAuth database tables...")
  try {
    execSync(`bunx @better-auth/cli generate --output ${schemaPath}`, {
      cwd: projectRoot,
      stdio: "inherit",
    })
    success("BetterAuth tables added to src/db/schema.ts")
  } catch {
    // If the CLI tool fails, fall back to writing the tables manually
    warn(
      "@better-auth/cli generate failed. Adding schema tables manually instead..."
    )
    await appendAuthTablesToSchema(schemaPath, dialect)
    success("BetterAuth tables added to src/db/schema.ts (manual fallback)")
  }

  // ── Step 9: Patch src/index.ts to mount BetterAuth handler ───────────────

  await patchIndexFile(indexPath)

  // ── Step 10: Add env vars to .env ─────────────────────────────────────────

  await ensureEnvVars(projectRoot)

  // ── Step 11: Print success and next steps ────────────────────────────────

  success("\nBetterAuth setup complete!\n")
  info("Next steps:")
  info("  1. Run: bb migrate")
  info("     This applies the new auth tables to your database.")
  info("  2. Run: bun dev")
  info("     Your server now has these auth endpoints:")
  info("       POST /api/auth/sign-up/email")
  info("       POST /api/auth/sign-in/email")
  info("       POST /api/auth/sign-out")
  info("       GET  /api/auth/get-session")
  info("  3. Protect routes by adding requireAuth middleware:")
  info("     import { requireAuth } from './middleware/auth'")
  info("     app.get('/protected', requireAuth, (c) => { ... })")
  info("  4. Add plugins in src/auth/index.ts to extend auth capabilities.")
  info("     See: https://www.better-auth.com/docs/plugins")
}

// ── Template string builders ─────────────────────────────────────────────────
// These functions return the file content as strings.
// Keep them as pure string builders — no file I/O inside these functions.

function buildAuthInstance(dialect: "sqlite" | "pg"): string {
  const drizzleImport = dialect === "pg"
    ? `import { drizzleAdapter } from "better-auth/adapters/drizzle"`
    : `import { drizzleAdapter } from "better-auth/adapters/drizzle"`

  return `import { betterAuth } from "better-auth"
${drizzleImport}
import { db } from "../db"
import * as schema from "../db/schema"

/**
 * BetterBase Auth Instance
 *
 * This is the single source of truth for authentication in your BetterBase project.
 *
 * ADDING PLUGINS:
 * BetterAuth has a rich plugin ecosystem. Add plugins to the \\`plugins\\` array below.
 * Each plugin adds new auth capabilities without writing additional code.
 *
 * Example plugins:
 *   import { twoFactor } from "better-auth/plugins"
 *   import { rateLimit } from "better-auth/plugins"
 *   import { magicLink } from "better-auth/plugins"
 *   import { organization } from "better-auth/plugins"
 *
 * Full plugin list: https://www.better-auth.com/docs/plugins
 */
export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "${dialect}",
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
    },
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
  },
  secret: process.env.AUTH_SECRET,
  baseURL: process.env.AUTH_URL ?? "http://localhost:3000",
  trustedOrigins: [process.env.AUTH_URL ?? "http://localhost:3000"],
  /**
   * PLUGINS — add BetterAuth plugins here.
   * See: https://www.better-auth.com/docs/plugins
   */
  plugins: [],
})

export type Auth = typeof auth
`
}

function buildAuthTypes(): string {
  return `import type { auth } from "./index"

/**
 * Type helpers for BetterAuth session data.
 * Use these types in your route handlers for full TypeScript safety.
 */
export type Session = typeof auth.$Infer.Session.session
export type User = typeof auth.$Infer.Session.user

/**
 * Type for Hono context variables set by requireAuth middleware.
 *
 * Usage:
 *   const app = new Hono<{ Variables: AuthVariables }>()
 */
export type AuthVariables = {
  user: User
  session: Session
}
`
}

function buildAuthMiddleware(): string {
  return `import type { Context, Next } from "hono"
import { auth } from "../auth"
import type { User, Session } from "../auth/types"

/**
 * requireAuth — Hono middleware that enforces authentication.
 *
 * Returns 401 if no valid session exists.
 * Sets \\`user\\` and \\`session\\` on context if authenticated.
 *
 * Usage:
 *   app.get("/protected", requireAuth, (c) => {
 *     const user = c.get("user")
 *     return c.json({ user })
 *   })
 */
export async function requireAuth(c: Context, next: Next): Promise<Response | void> {
  const session = await auth.api.getSession({
    headers: c.req.raw.headers,
  })

  if (!session) {
    return c.json({ data: null, error: "Unauthorized" }, 401)
  }

  c.set("user", session.user as User)
  c.set("session", session.session as Session)
  await next()
}

/**
 * optionalAuth — reads session if present, does not block if absent.
 *
 * Usage:
 *   app.get("/feed", optionalAuth, (c) => {
 *     const user = c.get("user") // may be undefined
 *   })
 */
export async function optionalAuth(c: Context, next: Next): Promise<void> {
  const session = await auth.api.getSession({
    headers: c.req.raw.headers,
  })

  if (session) {
    c.set("user", session.user as User)
    c.set("session", session.session as Session)
  }

  await next()
}

/**
 * getAuthUser — gets the current user from Hono context.
 * Must be called inside a route that uses requireAuth.
 */
export function getAuthUser(c: Context): User {
  const user = c.get("user") as User | undefined
  if (!user) {
    throw new Error(
      "getAuthUser() called outside authenticated context. " +
      "Apply requireAuth middleware first."
    )
  }
  return user
}
`
}

/**
 * appendAuthTablesToSchema
 *
 * Fallback function — used when @better-auth/cli fails.
 * Manually appends BetterAuth tables to the existing schema.ts file.
 * Does NOT overwrite existing content.
 */
async function appendAuthTablesToSchema(
  schemaPath: string,
  dialect: "sqlite" | "pg"
): Promise<void> {
  const existing = await fs.readFile(schemaPath, "utf-8")

  // Guard: don't append if tables already exist
  if (existing.includes("export const user =") ||
      existing.includes("export const session =")) {
    warn("BetterAuth tables already present in schema.ts — skipping.")
    return
  }

  const tables = dialect === "sqlite"
    ? buildSQLiteAuthTables()
    : buildPostgresAuthTables()

  await fs.appendFile(schemaPath, "\n" + tables, "utf-8")
}

function buildSQLiteAuthTables(): string {
  return `
// ─────────────────────────────────────────────────────────────
// BetterAuth Tables (SQLite)
// Do not rename these tables or columns — BetterAuth requires these exact names.
// ─────────────────────────────────────────────────────────────

export const user = sqliteTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: integer("email_verified", { mode: "boolean" }).notNull().default(false),
  image: text("image"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
})

export const session = sqliteTable("session", {
  id: text("id").primaryKey(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  token: text("token").notNull().unique(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
})

export const account = sqliteTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: integer("access_token_expires_at", { mode: "timestamp" }),
  refreshTokenExpiresAt: integer("refresh_token_expires_at", { mode: "timestamp" }),
  scope: text("scope"),
  password: text("password"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
})

export const verification = sqliteTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }),
  updatedAt: integer("updated_at", { mode: "timestamp" }),
})
`
}

function buildPostgresAuthTables(): string {
  return `
// ─────────────────────────────────────────────────────────────
// BetterAuth Tables (Postgres)
// Do not rename these tables or columns — BetterAuth requires these exact names.
// ─────────────────────────────────────────────────────────────

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
})

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
})

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
})

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at"),
  updatedAt: timestamp("updated_at"),
})
`
}

/**
 * patchIndexFile
 *
 * Adds the BetterAuth handler mount to src/index.ts.
 * Reads the file, checks if the mount is already present, adds it if not.
 * Does NOT reformat or change any other part of the file.
 */
async function patchIndexFile(indexPath: string): Promise<void> {
  let content = await fs.readFile(indexPath, "utf-8")

  // Guard: don't add if already present
  if (content.includes('auth.handler') || content.includes('/api/auth/**')) {
    warn("BetterAuth handler already mounted in src/index.ts — skipping.")
    return
  }

  // Add the import at the top
  if (!content.includes('from "../auth"') && !content.includes("from './auth'")) {
    content = `import { auth } from "./auth"\n` + content
  }

  // Find the line where the Hono app is created and add the mount after it
  // Look for: const app = new Hono()
  const honoAppLine = /const app = new Hono\([^)]*\)/
  const match = content.match(honoAppLine)

  if (!match) {
    warn(
      "Could not find 'const app = new Hono()' in src/index.ts.\n" +
      "Add the following manually to src/index.ts:\n\n" +
      "  app.on([\"POST\", \"GET\"], \"/api/auth/**\", (c) => auth.handler(c.req.raw))\n"
    )
    return
  }

  const insertAfter = match[0]
  const authMount = `\n\n// BetterAuth — handles all /api/auth/* routes automatically\napp.on(["POST", "GET"], "/api/auth/**", (c) => auth.handler(c.req.raw))\n`
  content = content.replace(insertAfter, insertAfter + authMount)

  await fs.writeFile(indexPath, content, "utf-8")
  success("Mounted BetterAuth handler in src/index.ts")
}

/**
 * ensureEnvVars
 *
 * Adds AUTH_SECRET and AUTH_URL to the project's .env file.
 * Does not overwrite existing values.
 * Generates a random AUTH_SECRET if one does not exist.
 */
async function ensureEnvVars(projectRoot: string): Promise<void> {
  const envPath = path.join(projectRoot, ".env")

  let envContent = ""
  if (existsSync(envPath)) {
    envContent = await fs.readFile(envPath, "utf-8")
  }

  let additions = ""

  if (!envContent.includes("AUTH_SECRET")) {
    // Generate a random 32-character secret
    const secret = Array.from(
      { length: 32 },
      () => Math.random().toString(36).charAt(2)
    ).join("")
    additions += `AUTH_SECRET=${secret}\n`
  }

  if (!envContent.includes("AUTH_URL")) {
    additions += `AUTH_URL=http://localhost:3000\n`
  }

  if (additions) {
    await fs.appendFile(envPath, "\n# BetterAuth\n" + additions, "utf-8")
    success("Added AUTH_SECRET and AUTH_URL to .env")
  }
}
```

---

### STEP 8: Rewrite `packages/client/src/auth.ts`

**File:** `packages/client/src/auth.ts`

Replace the **entire file** with this:

```typescript
import { createAuthClient } from "better-auth/client"
import type { BetterBaseConfig } from "./types"

/**
 * AuthClient
 *
 * Wraps BetterAuth's client library to provide authentication
 * methods for BetterBase backends.
 *
 * This is the auth module used inside @betterbase/client.
 * It is not used directly — access it via bb.auth after calling createClient().
 */
export class AuthClient {
  private client: ReturnType<typeof createAuthClient>

  constructor(config: Pick<BetterBaseConfig, "url">) {
    this.client = createAuthClient({
      baseURL: config.url,
    })
  }

  /**
   * Sign up a new user with email and password.
   *
   * @returns The new user object and session on success.
   * @returns An error string on failure.
   */
  async signUp(credentials: {
    email: string
    password: string
    name: string
  }): Promise<{ data: { user: User; session: Session } | null; error: string | null }> {
    try {
      const result = await this.client.signUp.email(credentials)
      if (result.error) {
        return { data: null, error: result.error.message ?? "Sign up failed" }
      }
      return {
        data: {
          user: result.data?.user as User,
          session: result.data?.session as Session,
        },
        error: null,
      }
    } catch (err) {
      return { data: null, error: String(err) }
    }
  }

  /**
   * Sign in an existing user with email and password.
   *
   * @returns The user object and session on success.
   * @returns An error string on failure.
   */
  async signIn(credentials: {
    email: string
    password: string
  }): Promise<{ data: { user: User; session: Session } | null; error: string | null }> {
    try {
      const result = await this.client.signIn.email(credentials)
      if (result.error) {
        return { data: null, error: result.error.message ?? "Sign in failed" }
      }
      return {
        data: {
          user: result.data?.user as User,
          session: result.data?.session as Session,
        },
        error: null,
      }
    } catch (err) {
      return { data: null, error: String(err) }
    }
  }

  /**
   * Sign out the current user.
   */
  async signOut(): Promise<{ error: string | null }> {
    try {
      await this.client.signOut()
      return { error: null }
    } catch (err) {
      return { error: String(err) }
    }
  }

  /**
   * Get the current session.
   *
   * @returns The current session and user, or null if not authenticated.
   */
  async getSession(): Promise<{
    data: { user: User; session: Session } | null
    error: string | null
  }> {
    try {
      const result = await this.client.getSession()
      if (!result?.data) return { data: null, error: null }
      return {
        data: {
          user: result.data.user as User,
          session: result.data.session as Session,
        },
        error: null,
      }
    } catch (err) {
      return { data: null, error: String(err) }
    }
  }

  /**
   * Get the raw BetterAuth client.
   *
   * Use this to access BetterAuth plugin methods directly.
   * For example, if you've added the twoFactor plugin:
   *   const raw = bb.auth.raw()
   *   await raw.twoFactor.enable(...)
   */
  raw(): ReturnType<typeof createAuthClient> {
    return this.client
  }
}

// ── Type definitions ─────────────────────────────────────────────────────────
// These are the minimal types needed on the client side.
// Full session types are inferred from the server's auth instance.

export interface User {
  id: string
  name: string
  email: string
  emailVerified: boolean
  image?: string | null
  createdAt: Date
  updatedAt: Date
}

export interface Session {
  id: string
  userId: string
  token: string
  expiresAt: Date
  ipAddress?: string | null
  userAgent?: string | null
  createdAt: Date
  updatedAt: Date
}

export interface AuthCredentials {
  email: string
  password: string
  name?: string
}
```

---

### STEP 9: Add `better-auth` to `packages/client/package.json`

**File:** `packages/client/package.json`

Find the `dependencies` object and add:

```json
"better-auth": "^1.0.0"
```

---

### STEP 10: Verify TypeScript compiles

After completing all steps, run this from the monorepo root:

```bash
bun install
bun run typecheck
```

**If you get TypeScript errors:**

- Error mentioning `$Infer` — make sure `better-auth` is installed and the auth instance in `src/auth/index.ts` is correct
- Error mentioning `sqliteTable is not defined` in schema.ts — check that the import at the top of `schema.ts` includes `sqliteTable`
- Error in `packages/client/src/auth.ts` about `createAuthClient` — make sure `better-auth` is in `packages/client/package.json` dependencies
- Error about `auth.handler` in `src/index.ts` — make sure the import `import { auth } from "./auth"` was added to the top of the file

---

## PART 5: VERIFICATION — HOW TO TEST IT WORKED

After completing all steps, test the following:

### Test 1: Server starts without errors
```bash
cd your-test-project
bun dev
# Expected: server starts on port 3000 with no errors
```

### Test 2: BetterAuth routes exist
```bash
curl -X POST http://localhost:3000/api/auth/sign-up/email \
  -H "Content-Type: application/json" \
  -d '{"email": "test@test.com", "password": "password123", "name": "Test User"}'
# Expected: 200 with { "user": {...}, "session": {...} }
# NOT Expected: 404, which would mean the handler is not mounted
```

### Test 3: Sign in works
```bash
curl -X POST http://localhost:3000/api/auth/sign-in/email \
  -H "Content-Type: application/json" \
  -d '{"email": "test@test.com", "password": "password123"}'
# Expected: 200 with session token
```

### Test 4: Get session works
```bash
# Use the session token from Test 3 as a cookie or bearer header
curl http://localhost:3000/api/auth/get-session \
  -H "Cookie: better-auth.session_token=TOKEN_HERE"
# Expected: 200 with current user and session data
```

### Test 5: requireAuth blocks unauthenticated requests
```bash
curl http://localhost:3000/api/posts
# Expected: 401 { "data": null, "error": "Unauthorized" }
```

### Test 6: requireAuth allows authenticated requests
```bash
curl http://localhost:3000/api/posts \
  -H "Cookie: better-auth.session_token=TOKEN_HERE"
# Expected: 200 with data
```

### Test 7: TypeScript compiles cleanly
```bash
bun run typecheck
# Expected: zero TypeScript errors
```

---

## PART 6: WHAT TO DO AFTER THIS REFACTOR

Once this refactor is complete and verified, the following things are now possible:

### Adding plugins (the real benefit of BetterAuth)

Open `src/auth/index.ts` in any BetterBase project and add to the `plugins` array:

```typescript
import { rateLimit } from "better-auth/plugins"
import { twoFactor } from "better-auth/plugins"
import { organization } from "better-auth/plugins"

export const auth = betterAuth({
  // ...
  plugins: [
    rateLimit({
      window: 60,      // 60 second window
      max: 10,         // max 10 attempts per window
    }),
    twoFactor(),
    organization(),
  ]
})
```

### Phase 11 (RLS) dependency

Phase 11's RLS middleware needs the authenticated user's ID at the Postgres session level. With real BetterAuth, the `rls-session.ts` middleware from Phase 11 reads the user ID like this:

```typescript
import { auth } from "../auth"

export async function rlsSession(c: Context, next: Next) {
  const session = await auth.api.getSession({
    headers: c.req.raw.headers,
  })
  if (session?.user?.id) {
    await db.execute(
      sql`SELECT set_config('app.current_user_id', ${session.user.id}, true)`
    )
  }
  await next()
}
```

This only works correctly because `auth.api.getSession()` is the real BetterAuth session read — not a custom token parse.

### Dashboard auth pages

`apps/dashboard` can now use BetterAuth's client for its own login/signup flows, replacing any placeholder auth it currently has.
