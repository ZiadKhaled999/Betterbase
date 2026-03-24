# BetterBase Self-Hosted — Orchestrator Specification

> **For Kilo Code Orchestrator**
> Execute tasks in strict order. Each task lists its dependencies — do not begin a task until all listed dependencies are marked complete. All file paths are relative to the monorepo root unless otherwise noted.

---

## Overview

This document specifies everything needed to make Betterbase fully self-hostable. The output is: a user runs `docker compose up` and gets a complete BaaS platform — server, dashboard, database, storage, proxy — with the CLI working against their local instance.

**7 implementation phases, 28 tasks total.**

---

## Phase 1 — Metadata Database Schema

> Foundation. Every other phase depends on this. No code is written elsewhere until this phase is complete.

### Task SH-01 — Create Betterbase Internal Schema Migration Files

**Depends on:** nothing

**What it is:** Betterbase needs its own internal tables to track admin accounts, projects, device auth sessions, and CLI credentials. These tables live in the same Postgres instance the user spins up, in a schema called `betterbase_meta`.

**Create file:** `packages/server/migrations/001_initial_schema.sql`

```sql
-- Betterbase internal metadata schema
-- Runs once on first container start via the bootstrap process

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE SCHEMA IF NOT EXISTS betterbase_meta;

-- Admin accounts (these are Betterbase operators, not end-users of projects)
CREATE TABLE IF NOT EXISTS betterbase_meta.admin_users (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  email       TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Projects registered in this Betterbase instance
CREATE TABLE IF NOT EXISTS betterbase_meta.projects (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name          TEXT NOT NULL,
  slug          TEXT NOT NULL UNIQUE,
  admin_key_hash TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Device auth codes for CLI `bb login` flow
CREATE TABLE IF NOT EXISTS betterbase_meta.device_codes (
  user_code     TEXT PRIMARY KEY,
  device_code   TEXT NOT NULL UNIQUE,
  admin_user_id TEXT REFERENCES betterbase_meta.admin_users(id) ON DELETE CASCADE,
  expires_at    TIMESTAMPTZ NOT NULL,
  verified      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- CLI sessions — issued after device code verified
CREATE TABLE IF NOT EXISTS betterbase_meta.cli_sessions (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  admin_user_id TEXT NOT NULL REFERENCES betterbase_meta.admin_users(id) ON DELETE CASCADE,
  token_hash    TEXT NOT NULL UNIQUE,
  expires_at    TIMESTAMPTZ NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Migration tracking
CREATE TABLE IF NOT EXISTS betterbase_meta.migrations (
  id         SERIAL PRIMARY KEY,
  filename   TEXT NOT NULL UNIQUE,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Acceptance criteria:**
- File exists at the specified path
- All five tables defined with correct columns, types, constraints
- Schema prefix `betterbase_meta.` on every table
- `gen_random_uuid()` used for IDs (requires `pgcrypto` extension — add `CREATE EXTENSION IF NOT EXISTS pgcrypto;` at top of file before the schema)

---

### Task SH-02 — Create Migration Runner

**Depends on:** SH-01

**What it is:** A TypeScript module that reads SQL files from the migrations directory and applies any that haven't been applied yet. Runs on server startup before anything else.

**Create file:** `packages/server/src/lib/migrate.ts`

```typescript
import { readdir, readFile } from "fs/promises";
import { join } from "path";
import type { Pool } from "pg";

const MIGRATIONS_DIR = join(__dirname, "../../migrations");

export async function runMigrations(pool: Pool): Promise<void> {
  // Ensure tracking table exists before we query it
  await pool.query(`
    CREATE SCHEMA IF NOT EXISTS betterbase_meta;
    CREATE EXTENSION IF NOT EXISTS pgcrypto;
    CREATE TABLE IF NOT EXISTS betterbase_meta.migrations (
      id SERIAL PRIMARY KEY,
      filename TEXT NOT NULL UNIQUE,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  const files = (await readdir(MIGRATIONS_DIR))
    .filter((f) => f.endsWith(".sql"))
    .sort();

  const { rows: applied } = await pool.query<{ filename: string }>(
    "SELECT filename FROM betterbase_meta.migrations"
  );
  const appliedSet = new Set(applied.map((r) => r.filename));

  for (const file of files) {
    if (appliedSet.has(file)) continue;

    const sql = await readFile(join(MIGRATIONS_DIR, file), "utf-8");
    await pool.query(sql);
    await pool.query(
      "INSERT INTO betterbase_meta.migrations (filename) VALUES ($1)",
      [file]
    );
    console.log(`[migrate] Applied: ${file}`);
  }

  console.log("[migrate] All migrations up to date.");
}
```

**Acceptance criteria:**
- Idempotent — safe to call on every server start
- Applies only unapplied files, in alphabetical order
- Logs each applied migration
- Uses `pg` Pool, not Drizzle (keeps it dependency-light and safe to run before the app fully initialises)

---

### Task SH-03 — Create Database Connection Pool Module

**Depends on:** SH-02

**What it is:** A singleton Postgres pool for use by the server. Reads `DATABASE_URL` from env.

**Create file:** `packages/server/src/lib/db.ts`

```typescript
import { Pool } from "pg";

let _pool: Pool | null = null;

export function getPool(): Pool {
  if (!_pool) {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL environment variable is required");
    }
    _pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    });
  }
  return _pool;
}
```

**Acceptance criteria:**
- Singleton pattern — only one pool created per process
- Throws with clear message if `DATABASE_URL` missing
- Pool config has reasonable limits

---

## Phase 2 — The Server Package

> Creates the runnable Betterbase backend. This is what runs inside Docker.

### Task SH-04 — Scaffold `packages/server`

**Depends on:** SH-03

**What it is:** The server package doesn't exist yet. Create the scaffold.

**Create file:** `packages/server/package.json`

```json
{
  "name": "@betterbase/server",
  "version": "0.1.0",
  "private": true,
  "main": "src/index.ts",
  "scripts": {
    "dev": "bun --watch src/index.ts",
    "start": "bun src/index.ts",
    "build": "bun build src/index.ts --outdir dist --target bun"
  },
  "dependencies": {
    "@betterbase/core": "workspace:*",
    "@betterbase/shared": "workspace:*",
    "hono": "^4.0.0",
    "pg": "^8.11.0",
    "bcryptjs": "^2.4.3",
    "nanoid": "^5.0.0",
    "jose": "^5.0.0"
  },
  "devDependencies": {
    "@types/pg": "^8.11.0",
    "@types/bcryptjs": "^2.4.6",
    "typescript": "^5.4.0"
  }
}
```

**Create file:** `packages/server/tsconfig.json`

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src/**/*", "migrations/**/*"]
}
```

**Create directory structure (empty files to establish layout):**

```text
packages/server/
├── package.json
├── tsconfig.json
├── migrations/
│   └── 001_initial_schema.sql   ← already created in SH-01
└── src/
    ├── index.ts                 ← created in SH-05
    ├── lib/
    │   ├── db.ts                ← created in SH-03
    │   ├── migrate.ts           ← created in SH-02
    │   ├── auth.ts              ← created in SH-06
    │   └── env.ts               ← created in SH-05
    └── routes/
        ├── admin/
        │   ├── index.ts         ← created in SH-08
        │   ├── auth.ts          ← created in SH-09
        │   ├── projects.ts      ← created in SH-10
        │   ├── users.ts         ← created in SH-11
        │   ├── metrics.ts       ← created in SH-12
        │   ├── storage.ts       ← created in SH-13
        │   ├── webhooks.ts      ← created in SH-14
        │   ├── functions.ts     ← created in SH-15
        │   └── logs.ts          ← created in SH-16
        └── device/
            ├── index.ts         ← created in SH-17
```

**Acceptance criteria:**
- Directory structure exists
- `package.json` added to Turborepo workspace (root `package.json` `workspaces` array already includes `packages/*` so this is automatic)

---

### Task SH-05 — Create Server Entry Point and Env Validation

**Depends on:** SH-04

**Create file:** `packages/server/src/lib/env.ts`

```typescript
import { z } from "zod";

const EnvSchema = z.object({
  DATABASE_URL: z.string().min(1),
  BETTERBASE_JWT_SECRET: z.string().min(32, "JWT secret must be at least 32 characters"),
  BETTERBASE_ADMIN_EMAIL: z.string().email().optional(),
  BETTERBASE_ADMIN_PASSWORD: z.string().min(8).optional(),
  PORT: z.string().default("3001"),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  STORAGE_ENDPOINT: z.string().optional(),    // MinIO or S3 endpoint
  STORAGE_ACCESS_KEY: z.string().optional(),
  STORAGE_SECRET_KEY: z.string().optional(),
  STORAGE_BUCKET: z.string().default("betterbase"),
  CORS_ORIGINS: z.string().default("http://localhost:3000"),
});

export type Env = z.infer<typeof EnvSchema>;

export function validateEnv(): Env {
  const result = EnvSchema.safeParse(process.env);
  if (!result.success) {
    console.error("[env] Invalid environment variables:");
    console.error(result.error.flatten().fieldErrors);
    process.exit(1);
  }
  return result.data;
}
```

**Create file:** `packages/server/src/index.ts`

```typescript
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { validateEnv } from "./lib/env";
import { getPool } from "./lib/db";
import { runMigrations } from "./lib/migrate";
import { adminRouter } from "./routes/admin/index";
import { deviceRouter } from "./routes/device/index";

// Validate env first — exits if invalid
const env = validateEnv();

// Bootstrap
const pool = getPool();
await runMigrations(pool);

// Seed initial admin if env vars provided and no admin exists
if (env.BETTERBASE_ADMIN_EMAIL && env.BETTERBASE_ADMIN_PASSWORD) {
  const { seedAdminUser } = await import("./lib/auth");
  await seedAdminUser(pool, env.BETTERBASE_ADMIN_EMAIL, env.BETTERBASE_ADMIN_PASSWORD);
}

// App
const app = new Hono();

app.use("*", logger());
app.use("*", cors({
  origin: env.CORS_ORIGINS.split(","),
  credentials: true,
  allowHeaders: ["Content-Type", "Authorization"],
  allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
}));

// Health check — used by Docker HEALTHCHECK
app.get("/health", (c) => c.json({ status: "ok", timestamp: new Date().toISOString() }));

// Routers
app.route("/admin", adminRouter);
app.route("/device", deviceRouter);

// 404
app.notFound((c) => c.json({ error: "Not found" }, 404));

// Error handler
app.onError((err, c) => {
  console.error("[error]", err);
  return c.json({ error: "Internal server error" }, 500);
});

const port = parseInt(env.PORT);
console.log(`[server] Betterbase server running on port ${port}`);

export default {
  port,
  fetch: app.fetch,
};
```

**Acceptance criteria:**
- Server starts with `bun src/index.ts`
- Env validation runs before anything else — exits with clear error if invalid
- Migrations run on startup
- `/health` returns 200 JSON
- CORS configured from env

---

### Task SH-06 — Create Auth Utilities (JWT + Password)

**Depends on:** SH-05

**What it is:** JWT signing/verification for admin sessions, password hashing for admin accounts.

**Create file:** `packages/server/src/lib/auth.ts`

```typescript
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import type { Pool } from "pg";

const getSecret = () =>
  new TextEncoder().encode(process.env.BETTERBASE_JWT_SECRET!);

const TOKEN_EXPIRY = "30d";
const BCRYPT_ROUNDS = 12;

// --- Password ---

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// --- JWT for admin sessions ---

export async function signAdminToken(adminUserId: string): Promise<string> {
  return new SignJWT({ sub: adminUserId, type: "admin" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(TOKEN_EXPIRY)
    .sign(getSecret());
}

export async function verifyAdminToken(
  token: string
): Promise<{ sub: string } | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (payload.type !== "admin") return null;
    return { sub: payload.sub as string };
  } catch {
    return null;
  }
}

// --- Middleware helper: extract + verify token from Authorization header ---

export function extractBearerToken(authHeader: string | undefined): string | null {
  if (!authHeader?.startsWith("Bearer ")) return null;
  return authHeader.slice(7);
}

// --- Seed initial admin on first start ---

export async function seedAdminUser(
  pool: Pool,
  email: string,
  password: string
): Promise<void> {
  const { rows } = await pool.query(
    "SELECT id FROM betterbase_meta.admin_users WHERE email = $1",
    [email]
  );
  if (rows.length > 0) return; // Already exists

  const hash = await hashPassword(password);
  await pool.query(
    "INSERT INTO betterbase_meta.admin_users (email, password_hash) VALUES ($1, $2)",
    [email, hash]
  );
  console.log(`[auth] Seeded admin user: ${email}`);
}
```

**Acceptance criteria:**
- JWT uses HS256, 30-day expiry
- Password hashing uses bcrypt with 12 rounds
- `seedAdminUser` is idempotent
- `verifyAdminToken` returns null on any failure (never throws)

---

### Task SH-07 — Create Admin Auth Middleware

**Depends on:** SH-06

**What it is:** Hono middleware that validates the admin JWT on every protected route.

**Create file:** `packages/server/src/lib/admin-middleware.ts`

```typescript
import type { Context, Next } from "hono";
import { extractBearerToken, verifyAdminToken } from "./auth";
import { getPool } from "./db";

export async function requireAdmin(c: Context, next: Next) {
  const token = extractBearerToken(c.req.header("Authorization"));
  if (!token) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const payload = await verifyAdminToken(token);
  if (!payload) {
    return c.json({ error: "Invalid or expired token" }, 401);
  }

  // Verify admin still exists in DB
  const pool = getPool();
  const { rows } = await pool.query(
    "SELECT id, email FROM betterbase_meta.admin_users WHERE id = $1",
    [payload.sub]
  );
  if (rows.length === 0) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  c.set("adminUser", rows[0]);
  await next();
}
```

**Acceptance criteria:**
- Returns 401 with `{ error: "Unauthorized" }` for missing/invalid token
- Verifies admin still exists in DB (handles deleted accounts)
- Sets `adminUser` on context for downstream handlers

---

## Phase 3 — Admin API Routes

> These are the routes the dashboard and CLI call. Implement them in the order listed.

### Task SH-08 — Admin Router Index

**Depends on:** SH-07

**Create file:** `packages/server/src/routes/admin/index.ts`

```typescript
import { Hono } from "hono";
import { requireAdmin } from "../../lib/admin-middleware";
import { authRoutes } from "./auth";
import { projectRoutes } from "./projects";
import { userRoutes } from "./users";
import { metricsRoutes } from "./metrics";
import { storageRoutes } from "./storage";
import { webhookRoutes } from "./webhooks";
import { functionRoutes } from "./functions";
import { logRoutes } from "./logs";

export const adminRouter = new Hono();

// Auth routes are public (login doesn't require a token)
adminRouter.route("/auth", authRoutes);

// All other admin routes require a valid admin token
adminRouter.use("/*", requireAdmin);
adminRouter.route("/projects", projectRoutes);
adminRouter.route("/users", userRoutes);
adminRouter.route("/metrics", metricsRoutes);
adminRouter.route("/storage", storageRoutes);
adminRouter.route("/webhooks", webhookRoutes);
adminRouter.route("/functions", functionRoutes);
adminRouter.route("/logs", logRoutes);
```

**Acceptance criteria:**
- `/admin/auth/*` is unprotected
- All other `/admin/*` routes go through `requireAdmin`

---

### Task SH-09 — Admin Auth Routes (Login / Logout / Me)

**Depends on:** SH-08

**Create file:** `packages/server/src/routes/admin/auth.ts`

```typescript
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { getPool } from "../../lib/db";
import { verifyPassword, signAdminToken, extractBearerToken, verifyAdminToken } from "../../lib/auth";

export const authRoutes = new Hono();

// POST /admin/auth/login
authRoutes.post(
  "/login",
  zValidator("json", z.object({
    email: z.string().email(),
    password: z.string().min(1),
  })),
  async (c) => {
    const { email, password } = c.req.valid("json");
    const pool = getPool();

    const { rows } = await pool.query(
      "SELECT id, email, password_hash FROM betterbase_meta.admin_users WHERE email = $1",
      [email]
    );
    if (rows.length === 0) {
      return c.json({ error: "Invalid credentials" }, 401);
    }

    const admin = rows[0];
    const valid = await verifyPassword(password, admin.password_hash);
    if (!valid) {
      return c.json({ error: "Invalid credentials" }, 401);
    }

    const token = await signAdminToken(admin.id);
    return c.json({ token, admin: { id: admin.id, email: admin.email } });
  }
);

// GET /admin/auth/me  (requires token)
authRoutes.get("/me", async (c) => {
  const token = extractBearerToken(c.req.header("Authorization"));
  if (!token) return c.json({ error: "Unauthorized" }, 401);

  const payload = await verifyAdminToken(token);
  if (!payload) return c.json({ error: "Unauthorized" }, 401);

  const pool = getPool();
  const { rows } = await pool.query(
    "SELECT id, email, created_at FROM betterbase_meta.admin_users WHERE id = $1",
    [payload.sub]
  );
  if (rows.length === 0) return c.json({ error: "Unauthorized" }, 401);

  return c.json({ admin: rows[0] });
});

// POST /admin/auth/logout  (client-side token discard — stateless)
authRoutes.post("/logout", (c) => c.json({ success: true }));
```

**Acceptance criteria:**
- `POST /admin/auth/login` returns token + admin object on success, 401 on bad credentials
- `GET /admin/auth/me` validates token and returns admin data
- Timing-safe: both "user not found" and "wrong password" return identical 401

---

### Task SH-10 — Projects Routes

**Depends on:** SH-09

**Create file:** `packages/server/src/routes/admin/projects.ts`

```typescript
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { nanoid } from "nanoid";
import { createHash, randomBytes } from "crypto";
import { getPool } from "../../lib/db";

export const projectRoutes = new Hono();

// GET /admin/projects
projectRoutes.get("/", async (c) => {
  const pool = getPool();
  const { rows } = await pool.query(
    "SELECT id, name, slug, created_at, updated_at FROM betterbase_meta.projects ORDER BY created_at DESC"
  );
  return c.json({ projects: rows });
});

// GET /admin/projects/:id
projectRoutes.get("/:id", async (c) => {
  const pool = getPool();
  const { rows } = await pool.query(
    "SELECT id, name, slug, created_at, updated_at FROM betterbase_meta.projects WHERE id = $1",
    [c.req.param("id")]
  );
  if (rows.length === 0) return c.json({ error: "Not found" }, 404);
  return c.json({ project: rows[0] });
});

// POST /admin/projects
projectRoutes.post(
  "/",
  zValidator("json", z.object({
    name: z.string().min(1).max(100),
    slug: z.string().min(1).max(63).regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with hyphens"),
  })),
  async (c) => {
    const { name, slug } = c.req.valid("json");
    const pool = getPool();

    // Check slug uniqueness
    const { rows: existing } = await pool.query(
      "SELECT id FROM betterbase_meta.projects WHERE slug = $1",
      [slug]
    );
    if (existing.length > 0) {
      return c.json({ error: "Slug already taken" }, 409);
    }

    // Generate admin key — returned once, never again
    const adminKeyPlaintext = `bb_admin_${randomBytes(24).toString("hex")}`;
    const adminKeyHash = createHash("sha256").update(adminKeyPlaintext).digest("hex");

    const { rows } = await pool.query(
      `INSERT INTO betterbase_meta.projects (id, name, slug, admin_key_hash)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, slug, created_at`,
      [nanoid(), name, slug, adminKeyHash]
    );

    // Return admin key plaintext ONCE — not stored, cannot be recovered
    return c.json({ project: rows[0], admin_key: adminKeyPlaintext }, 201);
  }
);

// PATCH /admin/projects/:id
projectRoutes.patch(
  "/:id",
  zValidator("json", z.object({
    name: z.string().min(1).max(100).optional(),
  })),
  async (c) => {
    const { name } = c.req.valid("json");
    const pool = getPool();
    const { rows } = await pool.query(
      `UPDATE betterbase_meta.projects
       SET name = COALESCE($1, name), updated_at = NOW()
       WHERE id = $2
       RETURNING id, name, slug, updated_at`,
      [name, c.req.param("id")]
    );
    if (rows.length === 0) return c.json({ error: "Not found" }, 404);
    return c.json({ project: rows[0] });
  }
);

// DELETE /admin/projects/:id
projectRoutes.delete("/:id", async (c) => {
  const pool = getPool();
  const { rows } = await pool.query(
    "DELETE FROM betterbase_meta.projects WHERE id = $1 RETURNING id",
    [c.req.param("id")]
  );
  if (rows.length === 0) return c.json({ error: "Not found" }, 404);
  return c.json({ success: true });
});
```

**Acceptance criteria:**
- Admin key is SHA-256 hashed before storage, plaintext returned only on creation
- Slug uniqueness enforced at DB + API level
- `name` is the only patchable field (slug changes are destructive, not allowed)
- All routes return consistent `{ project }` or `{ projects }` shape

---

### Task SH-11 — Users Routes

**Depends on:** SH-09

**Create file:** `packages/server/src/routes/admin/users.ts`

```typescript
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { getPool } from "../../lib/db";
import { hashPassword } from "../../lib/auth";
import { nanoid } from "nanoid";

export const userRoutes = new Hono();

// GET /admin/users  — list all admin users
userRoutes.get("/", async (c) => {
  const pool = getPool();
  const { rows } = await pool.query(
    "SELECT id, email, created_at FROM betterbase_meta.admin_users ORDER BY created_at DESC"
  );
  return c.json({ users: rows });
});

// POST /admin/users  — create new admin user
userRoutes.post(
  "/",
  zValidator("json", z.object({
    email: z.string().email(),
    password: z.string().min(8),
  })),
  async (c) => {
    const { email, password } = c.req.valid("json");
    const pool = getPool();

    const { rows: existing } = await pool.query(
      "SELECT id FROM betterbase_meta.admin_users WHERE email = $1",
      [email]
    );
    if (existing.length > 0) {
      return c.json({ error: "Email already registered" }, 409);
    }

    const passwordHash = await hashPassword(password);
    const { rows } = await pool.query(
      "INSERT INTO betterbase_meta.admin_users (id, email, password_hash) VALUES ($1, $2, $3) RETURNING id, email, created_at",
      [nanoid(), email, passwordHash]
    );
    return c.json({ user: rows[0] }, 201);
  }
);

// DELETE /admin/users/:id
userRoutes.delete("/:id", async (c) => {
  const pool = getPool();
  // Prevent deleting last admin
  const { rows: count } = await pool.query(
    "SELECT COUNT(*)::int as count FROM betterbase_meta.admin_users"
  );
  if (count[0].count <= 1) {
    return c.json({ error: "Cannot delete last admin user" }, 400);
  }

  const { rows } = await pool.query(
    "DELETE FROM betterbase_meta.admin_users WHERE id = $1 RETURNING id",
    [c.req.param("id")]
  );
  if (rows.length === 0) return c.json({ error: "Not found" }, 404);
  return c.json({ success: true });
});
```

**Acceptance criteria:**
- Password never returned in any response
- Cannot delete the last admin user
- Email uniqueness enforced

---

### Task SH-12 — Metrics Route

**Depends on:** SH-09

**Create file:** `packages/server/src/routes/admin/metrics.ts`

```typescript
import { Hono } from "hono";
import { getPool } from "../../lib/db";

export const metricsRoutes = new Hono();

// GET /admin/metrics  — overview stats for dashboard home
metricsRoutes.get("/", async (c) => {
  const pool = getPool();

  const [projects, admins] = await Promise.all([
    pool.query("SELECT COUNT(*)::int as count FROM betterbase_meta.projects"),
    pool.query("SELECT COUNT(*)::int as count FROM betterbase_meta.admin_users"),
  ]);

  return c.json({
    metrics: {
      projects: projects.rows[0].count,
      admin_users: admins.rows[0].count,
      server_uptime_seconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    },
  });
});
```

**Acceptance criteria:**
- Returns counts for projects and admin users
- Returns server uptime
- Single query-grouped for performance

---

### Task SH-13 — Storage Admin Routes

**Depends on:** SH-09

**What it is:** Routes for the dashboard to list and manage MinIO/S3 buckets. Uses the `@aws-sdk/client-s3` that already exists in `@betterbase/core`.

**Create file:** `packages/server/src/routes/admin/storage.ts`

```typescript
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import {
  S3Client,
  ListBucketsCommand,
  CreateBucketCommand,
  DeleteBucketCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";

function getS3Client(): S3Client {
  return new S3Client({
    endpoint: process.env.STORAGE_ENDPOINT,
    region: "us-east-1",
    credentials: {
      accessKeyId: process.env.STORAGE_ACCESS_KEY ?? "minioadmin",
      secretAccessKey: process.env.STORAGE_SECRET_KEY ?? "minioadmin",
    },
    forcePathStyle: true, // Required for MinIO
  });
}

export const storageRoutes = new Hono();

// GET /admin/storage/buckets
storageRoutes.get("/buckets", async (c) => {
  const client = getS3Client();
  const { Buckets } = await client.send(new ListBucketsCommand({}));
  return c.json({ buckets: Buckets ?? [] });
});

// POST /admin/storage/buckets
storageRoutes.post(
  "/buckets",
  zValidator("json", z.object({ name: z.string().min(1) })),
  async (c) => {
    const { name } = c.req.valid("json");
    const client = getS3Client();
    await client.send(new CreateBucketCommand({ Bucket: name }));
    return c.json({ bucket: { name } }, 201);
  }
);

// DELETE /admin/storage/buckets/:name
storageRoutes.delete("/buckets/:name", async (c) => {
  const client = getS3Client();
  await client.send(new DeleteBucketCommand({ Bucket: c.req.param("name") }));
  return c.json({ success: true });
});

// GET /admin/storage/buckets/:name/objects
storageRoutes.get("/buckets/:name/objects", async (c) => {
  const client = getS3Client();
  const { Contents } = await client.send(
    new ListObjectsV2Command({ Bucket: c.req.param("name") })
  );
  return c.json({ objects: Contents ?? [] });
});
```

**Acceptance criteria:**
- All 4 endpoints work against MinIO (forcePathStyle=true)
- Falls back to `minioadmin` defaults if env vars not set (dev convenience only)
- Errors from S3Client propagate to the global error handler

---

### Task SH-14 — Webhooks Admin Routes

**Depends on:** SH-09

**Create file:** `packages/server/src/routes/admin/webhooks.ts`

```typescript
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { getPool } from "../../lib/db";
import { nanoid } from "nanoid";

// Note: webhook configs are stored in betterbase_meta.
// Add this table to a new migration file: 002_webhooks.sql
// CREATE TABLE IF NOT EXISTS betterbase_meta.webhooks (
//   id TEXT PRIMARY KEY,
//   name TEXT NOT NULL,
//   table_name TEXT NOT NULL,
//   events TEXT[] NOT NULL,
//   url TEXT NOT NULL,
//   secret TEXT,
//   enabled BOOLEAN NOT NULL DEFAULT TRUE,
//   created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
// );

export const webhookRoutes = new Hono();

webhookRoutes.get("/", async (c) => {
  const pool = getPool();
  const { rows } = await pool.query(
    "SELECT id, name, table_name, events, url, enabled, created_at FROM betterbase_meta.webhooks ORDER BY created_at DESC"
  );
  return c.json({ webhooks: rows });
});

webhookRoutes.post(
  "/",
  zValidator("json", z.object({
    name: z.string().min(1),
    table_name: z.string().min(1),
    events: z.array(z.enum(["INSERT", "UPDATE", "DELETE"])).min(1),
    url: z.string().url(),
    secret: z.string().optional(),
    enabled: z.boolean().default(true),
  })),
  async (c) => {
    const data = c.req.valid("json");
    const pool = getPool();
    const { rows } = await pool.query(
      `INSERT INTO betterbase_meta.webhooks (id, name, table_name, events, url, secret, enabled)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, name, table_name, events, url, enabled, created_at`,
      [nanoid(), data.name, data.table_name, data.events, data.url, data.secret ?? null, data.enabled]
    );
    return c.json({ webhook: rows[0] }, 201);
  }
);

webhookRoutes.patch(
  "/:id",
  zValidator("json", z.object({
    enabled: z.boolean().optional(),
    url: z.string().url().optional(),
    secret: z.string().optional(),
  })),
  async (c) => {
    const data = c.req.valid("json");
    const pool = getPool();
    const { rows } = await pool.query(
      `UPDATE betterbase_meta.webhooks
       SET enabled = COALESCE($1, enabled),
           url = COALESCE($2, url),
           secret = COALESCE($3, secret)
       WHERE id = $4
       RETURNING id, name, table_name, events, url, enabled`,
      [data.enabled ?? null, data.url ?? null, data.secret ?? null, c.req.param("id")]
    );
    if (rows.length === 0) return c.json({ error: "Not found" }, 404);
    return c.json({ webhook: rows[0] });
  }
);

webhookRoutes.delete("/:id", async (c) => {
  const pool = getPool();
  const { rows } = await pool.query(
    "DELETE FROM betterbase_meta.webhooks WHERE id = $1 RETURNING id",
    [c.req.param("id")]
  );
  if (rows.length === 0) return c.json({ error: "Not found" }, 404);
  return c.json({ success: true });
});
```

**Also create file:** `packages/server/migrations/002_webhooks.sql`

```sql
CREATE TABLE IF NOT EXISTS betterbase_meta.webhooks (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  table_name TEXT NOT NULL,
  events     TEXT[] NOT NULL,
  url        TEXT NOT NULL,
  secret     TEXT,
  enabled    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Acceptance criteria:**
- Migration file follows the naming convention so it runs after `001_initial_schema.sql`
- Webhook secret stored in plaintext (it's user-provided, used for HMAC signing, not an auth credential)
- PATCH allows toggling `enabled` without full replacement

---

### Task SH-15 — Functions Admin Routes

**Depends on:** SH-09

**Create file:** `packages/server/src/routes/admin/functions.ts`

```typescript
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { getPool } from "../../lib/db";
import { nanoid } from "nanoid";

// Migration: 003_functions.sql
// CREATE TABLE IF NOT EXISTS betterbase_meta.functions (
//   id TEXT PRIMARY KEY,
//   name TEXT NOT NULL UNIQUE,
//   runtime TEXT NOT NULL DEFAULT 'bun',
//   status TEXT NOT NULL DEFAULT 'inactive',
//   deploy_target TEXT,
//   created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
//   updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
// );

export const functionRoutes = new Hono();

functionRoutes.get("/", async (c) => {
  const pool = getPool();
  const { rows } = await pool.query(
    "SELECT id, name, runtime, status, deploy_target, created_at FROM betterbase_meta.functions ORDER BY created_at DESC"
  );
  return c.json({ functions: rows });
});

functionRoutes.post(
  "/",
  zValidator("json", z.object({
    name: z.string().min(1).regex(/^[a-z0-9-]+$/),
    runtime: z.string().default("bun"),
    deploy_target: z.enum(["cloudflare", "vercel"]).optional(),
  })),
  async (c) => {
    const data = c.req.valid("json");
    const pool = getPool();
    const { rows } = await pool.query(
      `INSERT INTO betterbase_meta.functions (id, name, runtime, deploy_target)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, runtime, status, deploy_target, created_at`,
      [nanoid(), data.name, data.runtime, data.deploy_target ?? null]
    );
    return c.json({ function: rows[0] }, 201);
  }
);

functionRoutes.delete("/:id", async (c) => {
  const pool = getPool();
  const { rows } = await pool.query(
    "DELETE FROM betterbase_meta.functions WHERE id = $1 RETURNING id",
    [c.req.param("id")]
  );
  if (rows.length === 0) return c.json({ error: "Not found" }, 404);
  return c.json({ success: true });
});
```

**Also create file:** `packages/server/migrations/003_functions.sql`

```sql
CREATE TABLE IF NOT EXISTS betterbase_meta.functions (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL UNIQUE,
  runtime       TEXT NOT NULL DEFAULT 'bun',
  status        TEXT NOT NULL DEFAULT 'inactive',
  deploy_target TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Acceptance criteria:**
- Function names constrained to lowercase alphanumeric + hyphens
- Status defaults to `inactive`

---

### Task SH-16 — Logs Route

**Depends on:** SH-09

**Create file:** `packages/server/src/routes/admin/logs.ts`

```typescript
import { Hono } from "hono";
import { getPool } from "../../lib/db";

// Migration: 004_logs.sql
// CREATE TABLE IF NOT EXISTS betterbase_meta.request_logs (
//   id BIGSERIAL PRIMARY KEY,
//   method TEXT NOT NULL,
//   path TEXT NOT NULL,
//   status INT NOT NULL,
//   duration_ms INT,
//   created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
// );

export const logRoutes = new Hono();

// GET /admin/logs?limit=50&offset=0
logRoutes.get("/", async (c) => {
  const limit = Math.min(parseInt(c.req.query("limit") ?? "50"), 200);
  const offset = parseInt(c.req.query("offset") ?? "0");
  const pool = getPool();

  const { rows } = await pool.query(
    `SELECT id, method, path, status, duration_ms, created_at
     FROM betterbase_meta.request_logs
     ORDER BY created_at DESC
     LIMIT $1 OFFSET $2`,
    [limit, offset]
  );
  return c.json({ logs: rows, limit, offset });
});
```

**Also create file:** `packages/server/migrations/004_logs.sql`

```sql
CREATE TABLE IF NOT EXISTS betterbase_meta.request_logs (
  id          BIGSERIAL PRIMARY KEY,
  method      TEXT NOT NULL,
  path        TEXT NOT NULL,
  status      INT NOT NULL,
  duration_ms INT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for dashboard queries
CREATE INDEX IF NOT EXISTS idx_request_logs_created_at
  ON betterbase_meta.request_logs (created_at DESC);
```

**Add request logging middleware to `packages/server/src/index.ts`** after the existing `logger()` middleware line:

```typescript
// Add this import at the top:
import { getPool } from "./lib/db";

// Add this middleware after app.use("*", logger()):
app.use("*", async (c, next) => {
  const start = Date.now();
  await next();
  const duration = Date.now() - start;
  // Fire-and-forget log insert (don't await, don't fail requests on log error)
  getPool()
    .query(
      "INSERT INTO betterbase_meta.request_logs (method, path, status, duration_ms) VALUES ($1, $2, $3, $4)",
      [c.req.method, new URL(c.req.url).pathname, c.res.status, duration]
    )
    .catch(() => {}); // Silently ignore log failures
});
```

**Acceptance criteria:**
- Logs are written fire-and-forget (never delays responses)
- `limit` capped at 200 to prevent large queries
- Index on `created_at` for fast dashboard queries

---

## Phase 4 — Device Auth for CLI

> Powers `bb login` against a self-hosted instance.

### Task SH-17 — Device Auth Routes

**Depends on:** SH-08

**What it is:** The OAuth 2.0 device flow that `bb login` uses. Three endpoints: initiate, verify (user approves in browser), poll (CLI waits for approval).

**Create file:** `packages/server/src/routes/device/index.ts`

```typescript
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { nanoid } from "nanoid";
import { getPool } from "../../lib/db";
import { signAdminToken } from "../../lib/auth";

export const deviceRouter = new Hono();

const CODE_EXPIRY_MINUTES = 10;

// POST /device/code  — CLI calls this to initiate login
deviceRouter.post("/code", async (c) => {
  const pool = getPool();

  const deviceCode = nanoid(32);
  const userCode = nanoid(8).toUpperCase(); // Human-readable: shown in CLI
  const expiresAt = new Date(Date.now() + CODE_EXPIRY_MINUTES * 60 * 1000);

  await pool.query(
    `INSERT INTO betterbase_meta.device_codes (user_code, device_code, expires_at)
     VALUES ($1, $2, $3)`,
    [userCode, deviceCode, expiresAt]
  );

  const baseUrl = process.env.BETTERBASE_PUBLIC_URL ?? `http://localhost:${process.env.PORT ?? 3001}`;

  return c.json({
    device_code: deviceCode,
    user_code: userCode,
    verification_uri: `${baseUrl}/device/verify`,
    expires_in: CODE_EXPIRY_MINUTES * 60,
    interval: 5, // CLI polls every 5 seconds
  });
});

// GET /device/verify  — Browser opens this page to approve
deviceRouter.get("/verify", async (c) => {
  const userCode = c.req.query("code");
  // Return minimal HTML form for verification
  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Betterbase CLI Login</title>
<style>
  body { font-family: system-ui, sans-serif; max-width: 400px; margin: 100px auto; padding: 0 20px; }
  input, button { width: 100%; padding: 10px; margin: 8px 0; border-radius: 6px; border: 1px solid #ccc; font-size: 16px; }
  button { background: #2563eb; color: white; border: none; cursor: pointer; }
  button:hover { background: #1d4ed8; }
  .error { color: red; }
  .success { color: green; }
</style>
</head>
<body>
  <h2>Betterbase CLI Login</h2>
  <p>Enter your admin credentials to authorize the CLI.</p>
  <form method="POST" action="/device/verify">
    <input name="user_code" placeholder="User Code (e.g. ABC12345)" value="${userCode ?? ""}" required />
    <input name="email" type="email" placeholder="Admin Email" required />
    <input name="password" type="password" placeholder="Password" required />
    <button type="submit">Authorize CLI</button>
  </form>
</body>
</html>`;
  return c.html(html);
});

// POST /device/verify  — Form submission
deviceRouter.post("/verify", async (c) => {
  const body = await c.req.parseBody();
  const userCode = String(body.user_code ?? "").toUpperCase().trim();
  const email = String(body.email ?? "").trim();
  const password = String(body.password ?? "");

  const pool = getPool();

  // Verify admin credentials
  const { rows: admins } = await pool.query(
    "SELECT id, password_hash FROM betterbase_meta.admin_users WHERE email = $1",
    [email]
  );
  if (admins.length === 0) {
    return c.html(`<p style="color:red">Invalid credentials.</p>`);
  }

  const { verifyPassword } = await import("../../lib/auth");
  const valid = await verifyPassword(password, admins[0].password_hash);
  if (!valid) {
    return c.html(`<p style="color:red">Invalid credentials.</p>`);
  }

  // Find and verify the device code
  const { rows: codes } = await pool.query(
    `SELECT user_code FROM betterbase_meta.device_codes
     WHERE user_code = $1 AND verified = FALSE AND expires_at > NOW()`,
    [userCode]
  );
  if (codes.length === 0) {
    return c.html(`<p style="color:red">Code not found or expired.</p>`);
  }

  // Mark verified, associate admin user
  await pool.query(
    `UPDATE betterbase_meta.device_codes
     SET verified = TRUE, admin_user_id = $1
     WHERE user_code = $2`,
    [admins[0].id, userCode]
  );

  return c.html(`<h2 style="color:green">✓ CLI authorized. You can close this tab.</h2>`);
});

// POST /device/token  — CLI polls this to get the token once verified
deviceRouter.post("/token", zValidator("json", z.object({ device_code: z.string() })), async (c) => {
  const { device_code } = c.req.valid("json");
  const pool = getPool();

  const { rows } = await pool.query(
    `SELECT verified, admin_user_id, expires_at
     FROM betterbase_meta.device_codes
     WHERE device_code = $1`,
    [device_code]
  );

  if (rows.length === 0) {
    return c.json({ error: "invalid_device_code" }, 400);
  }

  const code = rows[0];

  if (new Date(code.expires_at) < new Date()) {
    return c.json({ error: "expired_token" }, 400);
  }

  if (!code.verified) {
    return c.json({ error: "authorization_pending" }, 202);
  }

  // Issue token, clean up device code
  const token = await signAdminToken(code.admin_user_id);
  await pool.query(
    "DELETE FROM betterbase_meta.device_codes WHERE device_code = $1",
    [device_code]
  );

  return c.json({ access_token: token, token_type: "Bearer" });
});
```

**Acceptance criteria:**
- Full device flow: POST /device/code → browser /device/verify → CLI polls /device/token
- Device codes expire after 10 minutes
- Verified codes are deleted after token issued (one-time use)
- `/device/verify` is a self-contained HTML page (no external deps, works without dashboard)
- `authorization_pending` returns 202 (CLI uses this to keep polling)

---

## Phase 5 — CLI Self-Hosted Mode

> Allows the CLI to target a self-hosted Betterbase instance instead of cloud.

### Task SH-18 — Update Credentials Schema

**Depends on:** SH-17

**File to modify:** `packages/cli/src/utils/credentials.ts`

If this file doesn't exist, create it. If it does, update it to the following shape:

**Create/replace file:** `packages/cli/src/utils/credentials.ts`

```typescript
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { z } from "zod";

const CREDENTIALS_DIR = join(homedir(), ".betterbase");
const CREDENTIALS_FILE = join(CREDENTIALS_DIR, "credentials.json");

const CredentialsSchema = z.object({
  token: z.string(),
  admin_email: z.string().email(),
  server_url: z.string().url(),  // ← NEW: base URL of the Betterbase server
  created_at: z.string(),
});

export type Credentials = z.infer<typeof CredentialsSchema>;

export function saveCredentials(creds: Credentials): void {
  if (!existsSync(CREDENTIALS_DIR)) {
    mkdirSync(CREDENTIALS_DIR, { recursive: true, mode: 0o700 });
  }
  writeFileSync(CREDENTIALS_FILE, JSON.stringify(creds, null, 2), { mode: 0o600 });
}

export function loadCredentials(): Credentials | null {
  if (!existsSync(CREDENTIALS_FILE)) return null;
  try {
    const raw = JSON.parse(readFileSync(CREDENTIALS_FILE, "utf-8"));
    return CredentialsSchema.parse(raw);
  } catch {
    return null;
  }
}

export function clearCredentials(): void {
  if (existsSync(CREDENTIALS_FILE)) {
    writeFileSync(CREDENTIALS_FILE, JSON.stringify({}));
  }
}

export function getServerUrl(): string {
  const creds = loadCredentials();
  return creds?.server_url ?? "https://api.betterbase.io"; // Falls back to cloud
}
```

**Acceptance criteria:**
- `server_url` field added to credentials schema
- `getServerUrl()` helper returns local URL when credentials contain it
- Falls back to cloud URL when no credentials exist

---

### Task SH-19 — Update `bb login` Command for Self-Hosted

**Depends on:** SH-18

**File to modify:** `packages/cli/src/commands/login.ts`

**Add `--url` option to the login command.** The full updated implementation:

```typescript
import { Command } from "commander";
import chalk from "chalk";
import { saveCredentials, clearCredentials, loadCredentials } from "../utils/credentials";
import { info, success, error, warn } from "../utils/logger";
import prompts from "../utils/prompts";

const DEFAULT_SERVER_URL = "https://api.betterbase.io";
const POLL_INTERVAL_MS = 5000;
const POLL_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

export function registerLoginCommand(program: Command) {
  program
    .command("login")
    .description("Authenticate with a Betterbase instance")
    .option("--url <url>", "Self-hosted Betterbase server URL", DEFAULT_SERVER_URL)
    .action(async (opts) => {
      await runLoginCommand({ serverUrl: opts.url });
    });

  program
    .command("logout")
    .description("Clear stored credentials")
    .action(() => {
      clearCredentials();
      success("Logged out.");
    });
}

export async function runLoginCommand(opts: { serverUrl?: string } = {}) {
  const serverUrl = (opts.serverUrl ?? DEFAULT_SERVER_URL).replace(/\/$/, "");

  // Validate URL for security
  try {
    const url = new URL(serverUrl);
    const isLocalhost = url.hostname === "localhost" || url.hostname === "127.0.0.1";
    
    // Warn if using non-https for non-localhost
    if (url.protocol === "http:" && !isLocalhost) {
      warn("Using HTTP on a public host is insecure. Consider using HTTPS.");
      const confirmed = await prompts.confirm({
        message: "Continue anyway?",
        default: false,
      });
      if (!confirmed) {
        info("Login cancelled.");
        return;
      }
    }
    
    info(`Logging in to ${chalk.cyan(serverUrl)} ...`);
    info(`Verification URL will be displayed after requesting code.`);
  } catch (err) {
    error(`Invalid server URL: ${opts.serverUrl}`);
    error("URL must include protocol (http/https) and host");
    return;
  }

  // Step 1: Request device code
  let deviceCode: string;
  let userCode: string;
  let verificationUri: string;

  try {
    const res = await fetch(`${serverUrl}/device/code`, { method: "POST" });
    if (!res.ok) throw new Error(`Server returned ${res.status}`);
    const data = await res.json() as {
      device_code: string;
      user_code: string;
      verification_uri: string;
    };
    deviceCode = data.device_code;
    userCode = data.user_code;
    verificationUri = data.verification_uri;
  } catch (err: any) {
    error(`Could not reach server: ${err.message}`);
    process.exit(1);
  }

  console.log("");
  console.log(chalk.bold("Open this URL in your browser to authorize:"));
  console.log(chalk.cyan(`${verificationUri}?code=${userCode}`));
  console.log("");
  console.log(`Your code: ${chalk.yellow.bold(userCode)}`);
  console.log("Waiting for authorization...");

  // Step 2: Poll for token
  const deadline = Date.now() + POLL_TIMEOUT_MS;

  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));

    const res = await fetch(`${serverUrl}/device/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ device_code: deviceCode }),
    });

    if (res.status === 202) continue; // authorization_pending

    if (!res.ok) {
      const body = await res.json() as { error?: string };
      if (body.error === "authorization_pending") continue;
      error(`Login failed: ${body.error ?? "unknown error"}`);
      process.exit(1);
    }

    const { access_token } = await res.json() as { access_token: string };

    // Get admin info
    const meRes = await fetch(`${serverUrl}/admin/auth/me`, {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    const { admin } = await meRes.json() as { admin: { email: string } };

    saveCredentials({
      token: access_token,
      admin_email: admin.email,
      server_url: serverUrl,
      created_at: new Date().toISOString(),
    });

    success(`Logged in as ${chalk.cyan(admin.email)}`);
    return;
  }

  error("Login timed out. Please try again.");
  process.exit(1);
}
```

**Acceptance criteria:**
- `bb login` with no flags works against default cloud URL
- `bb login --url http://localhost:3001` works against local instance
- `server_url` saved to credentials on success
- `bb logout` clears credentials

---

### Task SH-20 — Add Self-Hosted URL to All CLI API Calls

**Depends on:** SH-19

**What it is:** Every CLI command that calls an API must read `server_url` from credentials instead of having hardcoded URLs. This is a cross-cutting change.

**Create file:** `packages/cli/src/utils/api-client.ts`

```typescript
import { loadCredentials } from "./credentials";
import { error } from "./logger";

export function requireAuth(): { token: string; serverUrl: string } {
  const creds = loadCredentials();
  if (!creds?.token) {
    error("Not logged in. Run `bb login` first.");
    process.exit(1);
  }
  return { token: creds.token, serverUrl: creds.server_url };
}

export async function apiRequest<T = unknown>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const { token, serverUrl } = requireAuth();

  const url = `${serverUrl}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options.headers ?? {}),
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: "Request failed" })) as { error?: string };
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }

  return res.json() as Promise<T>;
}
```

**Update all CLI commands that make API calls** to use `apiRequest()` instead of raw `fetch()` with hardcoded URLs. Specifically audit and update:

- `packages/cli/src/commands/login.ts` — already done in SH-19
- Any command that calls `process.env.BETTERBASE_API_URL` or hardcoded URLs — replace with `apiRequest()`

**Acceptance criteria:**
- `apiRequest()` reads `server_url` from credentials
- Exits with clear message if not logged in
- All CLI commands that talk to the API use this utility

---

### Task SH-21 — Add `init` to `PUBLIC_COMMANDS`

**Depends on:** SH-20

**File to modify:** `packages/cli/src/index.ts` line 17

**This is the previously flagged critical fix.** Add `"init"` to the `PUBLIC_COMMANDS` array so `bb init` works without being logged in.

```typescript
// Find the PUBLIC_COMMANDS array and ensure it includes:
const PUBLIC_COMMANDS = ["login", "init", "--version", "--help", "-V", "-h"];
```

**Acceptance criteria:**
- `bb init` runs without requiring credentials
- `bb login` still in PUBLIC_COMMANDS
- `bb --version` still in PUBLIC_COMMANDS

---

## Phase 6 — Docker Compose Self-Hosted

> Packages everything into a single runnable deployment.

### Task SH-22 — Create Server Dockerfile

**Depends on:** SH-05

**Create file:** `packages/server/Dockerfile`

```dockerfile
FROM oven/bun:1.2-alpine AS builder

WORKDIR /app

# Copy monorepo structure (only what server needs)
COPY package.json turbo.json bun.lock ./
COPY packages/server/package.json ./packages/server/
COPY packages/core/package.json ./packages/core/
COPY packages/shared/package.json ./packages/shared/

RUN bun install --frozen-lockfile

COPY packages/server ./packages/server
COPY packages/core ./packages/core
COPY packages/shared ./packages/shared
COPY tsconfig.base.json ./

RUN cd packages/server && bun build src/index.ts --outdir dist --target bun

# --- Runtime stage ---
FROM oven/bun:1.2-alpine

WORKDIR /app

COPY --from=builder /app/packages/server/dist ./dist
COPY --from=builder /app/packages/server/migrations ./migrations

# Health check
HEALTHCHECK --interval=10s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:3001/health || exit 1

EXPOSE 3001

CMD ["bun", "dist/index.js"]
```

**Acceptance criteria:**
- Multi-stage build — runtime image contains only compiled output + migrations
- `bun:1.2-alpine` base for minimal image size
- Healthcheck targets `/health` on port 3001
- Migrations directory copied to runtime stage

---

### Task SH-23 — Create Nginx Configuration

**Depends on:** SH-22

**What it is:** Nginx sits in front of all services and routes traffic by path prefix.

**Create file:** `docker/nginx/nginx.conf`

```nginx
events {
  worker_connections 1024;
}

http {
  upstream betterbase_server {
    server betterbase-server:3001;
  }

  upstream betterbase_dashboard {
    server betterbase-dashboard:80;
  }

  upstream minio {
    server minio:9000;
  }

  server {
    listen 80;
    server_name _;

    # API + admin + device auth
    location /admin/ {
      proxy_pass http://betterbase_server;
      proxy_set_header Host $host;
      proxy_set_header X-Real-IP $remote_addr;
      proxy_read_timeout 60s;
    }

    location /device/ {
      proxy_pass http://betterbase_server;
      proxy_set_header Host $host;
      proxy_set_header X-Real-IP $remote_addr;
    }

    location /health {
      proxy_pass http://betterbase_server;
    }

    # Storage (MinIO)
    location /storage/ {
      rewrite ^/storage/(.*) /$1 break;
      proxy_pass http://minio;
      proxy_set_header Host $host;
      proxy_set_header X-Real-IP $remote_addr;
      client_max_body_size 100m;
    }

    # Dashboard (catch-all)
    location / {
      proxy_pass http://betterbase_dashboard;
      proxy_set_header Host $host;
      proxy_set_header X-Real-IP $remote_addr;
      # SPA fallback
      proxy_intercept_errors on;
      error_page 404 = @dashboard_fallback;
    }

    location @dashboard_fallback {
      proxy_pass http://betterbase_dashboard;
      proxy_set_header Host $host;
    }

    # WebSocket support for realtime
    location /realtime/ {
      proxy_pass http://betterbase_server;
      proxy_http_version 1.1;
      proxy_set_header Upgrade $http_upgrade;
      proxy_set_header Connection "upgrade";
      proxy_set_header Host $host;
      proxy_read_timeout 3600s;
    }
  }
}
```

**Acceptance criteria:**
- API traffic (`/admin/`, `/device/`, `/health`) → server
- Storage traffic (`/storage/`) → MinIO
- Dashboard (everything else) → dashboard container
- WebSocket upgrade headers set for `/realtime/`
- `client_max_body_size 100m` for file uploads

---

### Task SH-24 — Create Self-Hosted Docker Compose

**Depends on:** SH-22, SH-23

**Create file:** `docker-compose.self-hosted.yml`

```yaml
version: "3.9"

services:
  # ─── Postgres ──────────────────────────────────────────────────────────────
  postgres:
    image: postgres:16-alpine
    container_name: betterbase-postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: betterbase
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-betterbase}
      POSTGRES_DB: betterbase
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U betterbase"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - betterbase-internal

  # ─── MinIO (S3-compatible storage) ─────────────────────────────────────────
  minio:
    image: minio/minio:latest
    container_name: betterbase-minio
    restart: unless-stopped
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: ${STORAGE_ACCESS_KEY:-minioadmin}
      MINIO_ROOT_PASSWORD: ${STORAGE_SECRET_KEY:-minioadmin}
    volumes:
      - minio_data:/data
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:9000/minio/health/live"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - betterbase-internal

  # ─── MinIO bucket init (runs once, exits) ──────────────────────────────────
  minio-init:
    image: minio/mc:latest
    container_name: betterbase-minio-init
    depends_on:
      minio:
        condition: service_healthy
    entrypoint: >
      /bin/sh -c "
        mc alias set local http://minio:9000 ${STORAGE_ACCESS_KEY:-minioadmin} ${STORAGE_SECRET_KEY:-minioadmin};
        mc mb --ignore-existing local/betterbase;
        mc anonymous set public local/betterbase;
        echo 'MinIO bucket initialized.';
      "
    networks:
      - betterbase-internal

  # ─── Betterbase Server ─────────────────────────────────────────────────────
  betterbase-server:
    build:
      context: .
      dockerfile: packages/server/Dockerfile
    container_name: betterbase-server
    restart: unless-stopped
    depends_on:
      postgres:
        condition: service_healthy
      minio:
        condition: service_healthy
    environment:
      DATABASE_URL: postgresql://betterbase:${POSTGRES_PASSWORD:-betterbase}@postgres:5432/betterbase
      BETTERBASE_JWT_SECRET: ${BETTERBASE_JWT_SECRET:?JWT secret required - set BETTERBASE_JWT_SECRET in .env}
      BETTERBASE_ADMIN_EMAIL: ${BETTERBASE_ADMIN_EMAIL:-}
      BETTERBASE_ADMIN_PASSWORD: ${BETTERBASE_ADMIN_PASSWORD:-}
      BETTERBASE_PUBLIC_URL: ${BETTERBASE_PUBLIC_URL:-http://localhost}
      STORAGE_ENDPOINT: http://minio:9000
      STORAGE_ACCESS_KEY: ${STORAGE_ACCESS_KEY:-minioadmin}
      STORAGE_SECRET_KEY: ${STORAGE_SECRET_KEY:-minioadmin}
      PORT: "3001"
      NODE_ENV: production
      CORS_ORIGINS: ${CORS_ORIGINS:-http://localhost}
    networks:
      - betterbase-internal
    healthcheck:
      test: ["CMD-SHELL", "wget -qO- http://localhost:3001/health || exit 1"]
      interval: 10s
      timeout: 5s
      retries: 5

  # ─── Dashboard ─────────────────────────────────────────────────────────────
  betterbase-dashboard:
    build:
      context: .
      dockerfile: apps/dashboard/Dockerfile   # Dashboard Dockerfile — see SH-25
    container_name: betterbase-dashboard
    restart: unless-stopped
    depends_on:
      betterbase-server:
        condition: service_healthy
    environment:
      VITE_API_URL: ${BETTERBASE_PUBLIC_URL:-http://localhost}
    networks:
      - betterbase-internal

  # ─── Nginx Reverse Proxy ───────────────────────────────────────────────────
  nginx:
    image: nginx:alpine
    container_name: betterbase-nginx
    restart: unless-stopped
    depends_on:
      - betterbase-server
      - betterbase-dashboard
    ports:
      - "${HTTP_PORT:-80}:80"
    volumes:
      - ./docker/nginx/nginx.conf:/etc/nginx/nginx.conf:ro
    networks:
      - betterbase-internal
    healthcheck:
      test: ["CMD", "nginx", "-t"]
      interval: 30s
      timeout: 10s
      retries: 3

volumes:
  postgres_data:
  minio_data:

networks:
  betterbase-internal:
    driver: bridge
```

**Acceptance criteria:**
- All 5 services defined with healthchecks
- Dependency ordering: postgres + minio → server → dashboard → nginx
- `BETTERBASE_JWT_SECRET` is required (`:?` syntax causes compose to fail with clear error if missing)
- `minio-init` creates default bucket and exits — does not stay running
- All services on internal network, only nginx exposes a port

---

### Task SH-25 — Create Dashboard Dockerfile

**Depends on:** SH-24

**What it is:** The dashboard is a static build served by nginx. This assumes the dashboard is a Vite/React app.

**Create file:** `apps/dashboard/Dockerfile`

```dockerfile
FROM node:20-alpine AS builder

WORKDIR /app

COPY apps/dashboard/package.json apps/dashboard/package-lock.json* ./
RUN npm install --frozen-lockfile

COPY apps/dashboard ./

# Inject API URL at build time
ARG VITE_API_URL=http://localhost
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build

# --- Runtime: serve static files with nginx ---
FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html

# SPA routing: serve index.html for all unknown paths
RUN echo 'server { \
  listen 80; \
  root /usr/share/nginx/html; \
  index index.html; \
  location / { try_files $uri $uri/ /index.html; } \
}' > /etc/nginx/conf.d/default.conf

EXPOSE 80
```

**Note for orchestrator:** If the dashboard uses Bun instead of npm, replace the `node:20-alpine` base with `oven/bun:1.2-alpine` and replace `npm install` with `bun install` and `npm run build` with `bun run build`.

**Acceptance criteria:**
- Multi-stage build — final image is nginx + static files only
- SPA fallback (all routes serve `index.html`) configured
- `VITE_API_URL` injectable at build time via build arg

---

### Task SH-26 — Create `.env.example` for Self-Hosted

**Depends on:** SH-24

**Create file:** `.env.self-hosted.example`

```bash
# ─── REQUIRED ────────────────────────────────────────────────────────────────

# Minimum 32 characters. Generate with: openssl rand -base64 32
BETTERBASE_JWT_SECRET=change-me-to-a-random-string-at-least-32-chars

# ─── FIRST-RUN ADMIN SETUP ──────────────────────────────────────────────────
# Set these to auto-create an admin account on first start.
# Remove from .env after first start (or leave — it's idempotent).
BETTERBASE_ADMIN_EMAIL=admin@example.com
BETTERBASE_ADMIN_PASSWORD=changeme123

# ─── OPTIONAL: CUSTOMISE PORTS / URLS ────────────────────────────────────────

# Public URL of your Betterbase instance (used in CLI device flow URLs)
BETTERBASE_PUBLIC_URL=http://localhost

# Port nginx listens on
HTTP_PORT=80

# ─── OPTIONAL: POSTGRES ──────────────────────────────────────────────────────
POSTGRES_PASSWORD=betterbase

# ─── OPTIONAL: STORAGE ───────────────────────────────────────────────────────
# MinIO credentials (default: minioadmin/minioadmin — change for production)
STORAGE_ACCESS_KEY=minioadmin
STORAGE_SECRET_KEY=minioadmin

# ─── OPTIONAL: CORS ─────────────────────────────────────────────────────────
# Comma-separated allowed origins for the API
CORS_ORIGINS=http://localhost
```

**Acceptance criteria:**
- Every variable referenced in `docker-compose.self-hosted.yml` is documented here
- Required variables clearly marked
- Sensible defaults for all optional variables

---

## Phase 7 — First-Run Bootstrap

> Makes the out-of-the-box experience self-explanatory.

### Task SH-27 — Create Setup Endpoint

**Depends on:** SH-09

**What it is:** A one-time-only endpoint that creates the first admin account via HTTP POST, available only before any admin exists. Once an admin exists, returns 410 Gone. This is an alternative to the env var seeding — useful for cloud deployments where env vars are awkward.

**Add to:** `packages/server/src/routes/admin/auth.ts`

```typescript
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";

// POST /admin/auth/setup  — available only before first admin is created
authRoutes.post(
  "/setup",
  zValidator("json", z.object({
    email: z.string().email(),
    password: z.string().min(8),
  })),
  async (c) => {
    const pool = getPool();

    // Check if any admin exists
    const { rows } = await pool.query(
      "SELECT COUNT(*)::int as count FROM betterbase_meta.admin_users"
    );
    if (rows[0].count > 0) {
      return c.json({ error: "Setup already complete" }, 410);
    }

    const { email, password } = c.req.valid("json");
    const { hashPassword, signAdminToken } = await import("../../lib/auth");
    const { nanoid } = await import("nanoid");

    const passwordHash = await hashPassword(password);
    const { rows: newAdmin } = await pool.query(
      "INSERT INTO betterbase_meta.admin_users (id, email, password_hash) VALUES ($1, $2, $3) RETURNING id, email",
      [nanoid(), email, passwordHash]
    );

    const token = await signAdminToken(newAdmin[0].id);
    return c.json({
      message: "Admin account created. Save your token — log in with `bb login`.",
      admin: newAdmin[0],
      token,
    }, 201);
  }
);
```

**Acceptance criteria:**
- Returns 410 if any admin already exists (idempotent safety)
- Returns token on success so the caller can immediately use it
- This endpoint is under `/admin/auth/setup` — it is NOT behind `requireAdmin` middleware (it can't be — there's no admin yet)

---

### Task SH-28 — Create Self-Hosted README

**Depends on:** SH-26, SH-27

**Create file:** `SELF_HOSTED.md`

```markdown
# Self-Hosting Betterbase

## Prerequisites

- Docker and Docker Compose
- Ports 80 (or your chosen `HTTP_PORT`) available

## Quick Start

**1. Copy the example env file:**
\`\`\`bash
cp .env.self-hosted.example .env
\`\`\`

**2. Edit `.env` — at minimum set these two values:**
\`\`\`bash
BETTERBASE_JWT_SECRET=your-random-string-here   # min 32 chars
BETTERBASE_ADMIN_EMAIL=you@example.com
BETTERBASE_ADMIN_PASSWORD=yourpassword
\`\`\`
Generate a secret: `openssl rand -base64 32`

**3. Start everything:**
\`\`\`bash
docker compose -f docker-compose.self-hosted.yml up -d
\`\`\`

**4. Open the dashboard:**
Navigate to `http://localhost` (or your configured `BETTERBASE_PUBLIC_URL`).

**5. Connect your CLI:**
\`\`\`bash
bb login --url http://localhost
\`\`\`

---

## What Runs

| Service | Internal Port | Description |
|---------|--------------|-------------|
| nginx | 80 (public) | Reverse proxy — only public-facing port |
| betterbase-server | 3001 (internal) | API server |
| betterbase-dashboard | 80 (internal) | Dashboard UI |
| postgres | 5432 (internal) | Betterbase metadata database |
| minio | 9000 (internal) | S3-compatible object storage |

---

## CLI Usage Against Self-Hosted

After `bb login --url http://your-server`, all CLI commands automatically target your server.

\`\`\`bash
bb login --url http://localhost    # authenticate
bb init my-project                 # create a project (registered to your local instance)
bb sync                            # sync local project to server
\`\`\`

---

## Production Checklist

- [ ] `BETTERBASE_JWT_SECRET` is a random 32+ character string
- [ ] `POSTGRES_PASSWORD` changed from default
- [ ] `STORAGE_ACCESS_KEY` and `STORAGE_SECRET_KEY` changed from defaults
- [ ] `BETTERBASE_PUBLIC_URL` set to your actual domain
- [ ] SSL/TLS termination configured (add HTTPS to the nginx config or use a load balancer)
- [ ] Remove `BETTERBASE_ADMIN_EMAIL` / `BETTERBASE_ADMIN_PASSWORD` from `.env` after first start (or keep — seeding is idempotent)

---

## Troubleshooting

**Server won't start:**
Check that `BETTERBASE_JWT_SECRET` is set (minimum 32 characters). Run:
\`\`\`bash
docker compose -f docker-compose.self-hosted.yml logs betterbase-server
\`\`\`

**Can't log in with CLI:**
Ensure `BETTERBASE_PUBLIC_URL` in your `.env` matches the URL you pass to `bb login --url`.

**Storage not working:**
The `minio-init` container initialises the default bucket on first start. Check its logs:
\`\`\`bash
docker compose -f docker-compose.self-hosted.yml logs minio-init
\`\`\`
```

**Acceptance criteria:**
- Covers the complete first-run flow in under 5 steps
- Production checklist is accurate and complete
- Troubleshooting covers the three most likely failure modes

---

## Summary — Task Execution Order

```text
Phase 1 — Metadata DB
  SH-01  Create 001_initial_schema.sql
  SH-02  Create migration runner
  SH-03  Create DB pool module

Phase 2 — Server Package
  SH-04  Scaffold packages/server
  SH-05  Entry point + env validation
  SH-06  Auth utilities (JWT + bcrypt)
  SH-07  Admin auth middleware

Phase 3 — Admin API
  SH-08  Admin router index
  SH-09  Auth routes (login/logout/me)
  SH-10  Projects routes
  SH-11  Users routes
  SH-12  Metrics route
  SH-13  Storage admin routes
  SH-14  Webhooks routes + 002 migration
  SH-15  Functions routes + 003 migration
  SH-16  Logs route + 004 migration + request logger

Phase 4 — Device Auth
  SH-17  Device auth routes (full flow)

Phase 5 — CLI Self-Hosted Mode
  SH-18  Update credentials schema
  SH-19  Update bb login with --url flag
  SH-20  api-client.ts utility
  SH-21  Add init to PUBLIC_COMMANDS (critical fix)

Phase 6 — Docker
  SH-22  Server Dockerfile
  SH-23  Nginx config
  SH-24  docker-compose.self-hosted.yml
  SH-25  Dashboard Dockerfile
  SH-26  .env.self-hosted.example

Phase 7 — Bootstrap
  SH-27  /admin/auth/setup endpoint
  SH-28  SELF_HOSTED.md
```

**Total: 28 tasks across 7 phases.**

---

## Dependencies Not Yet in `packages/server/package.json` to Verify

Before starting Phase 2, confirm these are available or add them:
- `pg` + `@types/pg` — Postgres client
- `bcryptjs` + `@types/bcryptjs` — password hashing
- `jose` — JWT
- `nanoid` — ID generation
- `@hono/zod-validator` — request validation
- `@aws-sdk/client-s3` — already in `@betterbase/core`, may need to be added directly to `packages/server` as well

---

*End of specification. Execute tasks in the listed order. Do not skip phases.*
```
