# BetterBase Dashboard Backend Extensions — Orchestrator Specification

> **For Kilo Code Orchestrator**
> This document extends `BetterBase_SelfHosted_Spec.md` (SH-01 through SH-28).
> All task IDs use prefix **DB-** (Dashboard Backend).
> Execute tasks in strict order. Do not begin a task until all listed dependencies are marked complete.
> All file paths are relative to the monorepo root.

---

## Overview

The SH spec built the foundational self-hosted server. This spec adds every API route the dashboard frontend requires. Zero frontend code is written here — this is purely backend.

**What this spec adds:**

- Per-project schema provisioning (end-user data isolation)
- Instance settings (key-value config store)
- SMTP configuration and test endpoint
- Notification rules
- RBAC — roles, permissions, admin role assignments
- Audit log — immutable, append-only, queryable
- API keys — long-lived tokens for CI/CD
- CLI session management
- Enhanced metrics with time-series data
- Per-project: user management, auth config, database introspection, realtime stats, environment variables, webhooks, functions
- Webhook delivery logs + manual retry
- Function invocation logs
- Audit middleware wired to all mutating routes

**Architecture: per-project data isolation**
Each project's end-user data lives in a dedicated Postgres schema named `project_{slug}`. The admin server queries these schemas using the same pool instance. All projects share the Postgres instance — standard for self-hosted v1.

**Routing convention added by this spec:**
```
/admin/instance           — instance-wide settings
/admin/smtp               — SMTP config
/admin/roles              — RBAC
/admin/api-keys           — long-lived API keys
/admin/cli-sessions       — CLI session list + revoke
/admin/audit              — audit log
/admin/metrics/timeseries — time-series data
/admin/projects/:id/users          — per-project end-users
/admin/projects/:id/auth-config    — per-project auth providers
/admin/projects/:id/database       — per-project DB introspection
/admin/projects/:id/realtime       — per-project realtime stats
/admin/projects/:id/env            — per-project env vars
/admin/projects/:id/webhooks       — per-project webhooks
/admin/projects/:id/functions      — per-project functions
/admin/webhooks/:id/deliveries     — webhook delivery log
/admin/functions/:id/invocations   — function invocation log
```

---

## Phase 1 — Schema Extensions

### Task DB-01 — Project Schema Provisioning Function

**Depends on:** SH-28

**Create file:** `packages/server/migrations/005_project_schema_function.sql`

```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Provisions a BetterAuth-compatible schema for a project
CREATE OR REPLACE FUNCTION betterbase_meta.provision_project_schema(p_slug TEXT)
RETURNS VOID AS $$
DECLARE
  s TEXT := 'project_' || p_slug;
BEGIN
  EXECUTE format('CREATE SCHEMA IF NOT EXISTS %I', s);

  EXECUTE format($f$
    CREATE TABLE IF NOT EXISTS %I."user" (
      id              TEXT PRIMARY KEY,
      name            TEXT NOT NULL,
      email           TEXT NOT NULL UNIQUE,
      email_verified  BOOLEAN NOT NULL DEFAULT FALSE,
      image           TEXT,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      banned          BOOLEAN NOT NULL DEFAULT FALSE,
      ban_reason      TEXT,
      ban_expires     TIMESTAMPTZ
    )
  $f$, s);

  EXECUTE format($f$
    CREATE TABLE IF NOT EXISTS %I.session (
      id              TEXT PRIMARY KEY,
      expires_at      TIMESTAMPTZ NOT NULL,
      token           TEXT NOT NULL UNIQUE,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      ip_address      TEXT,
      user_agent      TEXT,
      user_id         TEXT NOT NULL REFERENCES %I."user"(id) ON DELETE CASCADE
    )
  $f$, s, s);

  EXECUTE format($f$
    CREATE TABLE IF NOT EXISTS %I.account (
      id                        TEXT PRIMARY KEY,
      account_id                TEXT NOT NULL,
      provider_id               TEXT NOT NULL,
      user_id                   TEXT NOT NULL REFERENCES %I."user"(id) ON DELETE CASCADE,
      access_token              TEXT,
      refresh_token             TEXT,
      id_token                  TEXT,
      access_token_expires_at   TIMESTAMPTZ,
      refresh_token_expires_at  TIMESTAMPTZ,
      scope                     TEXT,
      password                  TEXT,
      created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  $f$, s, s);

  EXECUTE format($f$
    CREATE TABLE IF NOT EXISTS %I.verification (
      id           TEXT PRIMARY KEY,
      identifier   TEXT NOT NULL,
      value        TEXT NOT NULL,
      expires_at   TIMESTAMPTZ NOT NULL,
      created_at   TIMESTAMPTZ DEFAULT NOW(),
      updated_at   TIMESTAMPTZ DEFAULT NOW()
    )
  $f$, s);

  -- Auth config table (provider settings for this project)
  EXECUTE format($f$
    CREATE TABLE IF NOT EXISTS %I.auth_config (
      key    TEXT PRIMARY KEY,
      value  JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  $f$, s);

  -- Environment variables for this project
  EXECUTE format($f$
    CREATE TABLE IF NOT EXISTS %I.env_vars (
      key        TEXT PRIMARY KEY,
      value      TEXT NOT NULL,
      is_secret  BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  $f$, s);

END;
$$ LANGUAGE plpgsql;
```

**Modify file:** `packages/server/src/routes/admin/projects.ts`

In the `POST /` handler, after the INSERT query succeeds and before returning the response, add:

```typescript
// Provision project schema
await pool.query(
  "SELECT betterbase_meta.provision_project_schema($1)",
  [slug]
);
```

**Acceptance criteria:**
- `project_{slug}` schema created with all 6 tables on project creation
- Function is idempotent — safe to call multiple times
- Schema name derived from slug (already constrained to `[a-z0-9-]+`)
- Called automatically in project creation route

---

### Task DB-02 — RBAC Schema

**Depends on:** DB-01

**Create file:** `packages/server/migrations/006_rbac.sql`

```sql
-- Built-in roles (seeded, not user-created)
CREATE TABLE IF NOT EXISTS betterbase_meta.roles (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL UNIQUE,  -- owner | admin | developer | viewer
  description TEXT NOT NULL,
  is_system   BOOLEAN NOT NULL DEFAULT FALSE,  -- system roles cannot be deleted
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Granular permissions
CREATE TABLE IF NOT EXISTS betterbase_meta.permissions (
  id       TEXT PRIMARY KEY,
  domain   TEXT NOT NULL,   -- projects | users | storage | functions | webhooks | logs | team | settings | audit
  action   TEXT NOT NULL,   -- view | create | edit | delete | export
  UNIQUE (domain, action)
);

-- Role ↔ permission mapping
CREATE TABLE IF NOT EXISTS betterbase_meta.role_permissions (
  role_id       TEXT NOT NULL REFERENCES betterbase_meta.roles(id) ON DELETE CASCADE,
  permission_id TEXT NOT NULL REFERENCES betterbase_meta.permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

-- Admin ↔ role assignment (scoped per project, NULL = instance-wide)
CREATE TABLE IF NOT EXISTS betterbase_meta.admin_roles (
  id             TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  admin_user_id  TEXT NOT NULL REFERENCES betterbase_meta.admin_users(id) ON DELETE CASCADE,
  role_id        TEXT NOT NULL REFERENCES betterbase_meta.roles(id) ON DELETE CASCADE,
  project_id     TEXT REFERENCES betterbase_meta.projects(id) ON DELETE CASCADE,  -- NULL = global
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (admin_user_id, role_id, project_id)
);

-- Seed built-in roles
INSERT INTO betterbase_meta.roles (id, name, description, is_system) VALUES
  ('role_owner',     'owner',     'Full access to everything. Cannot be deleted.', TRUE),
  ('role_admin',     'admin',     'Full access except deleting other owners.',     TRUE),
  ('role_developer', 'developer', 'Can manage projects, functions, storage. Cannot manage team or settings.', TRUE),
  ('role_viewer',    'viewer',    'Read-only access to all resources.',            TRUE)
ON CONFLICT (name) DO NOTHING;

-- Seed permissions
INSERT INTO betterbase_meta.permissions (id, domain, action) VALUES
  ('perm_projects_view',    'projects',  'view'),
  ('perm_projects_create',  'projects',  'create'),
  ('perm_projects_edit',    'projects',  'edit'),
  ('perm_projects_delete',  'projects',  'delete'),
  ('perm_users_view',       'users',     'view'),
  ('perm_users_create',     'users',     'create'),
  ('perm_users_edit',       'users',     'edit'),
  ('perm_users_delete',     'users',     'delete'),
  ('perm_users_export',     'users',     'export'),
  ('perm_storage_view',     'storage',   'view'),
  ('perm_storage_create',   'storage',   'create'),
  ('perm_storage_edit',     'storage',   'edit'),
  ('perm_storage_delete',   'storage',   'delete'),
  ('perm_functions_view',   'functions', 'view'),
  ('perm_functions_create', 'functions', 'create'),
  ('perm_functions_edit',   'functions', 'edit'),
  ('perm_functions_delete', 'functions', 'delete'),
  ('perm_webhooks_view',    'webhooks',  'view'),
  ('perm_webhooks_create',  'webhooks',  'create'),
  ('perm_webhooks_edit',    'webhooks',  'edit'),
  ('perm_webhooks_delete',  'webhooks',  'delete'),
  ('perm_logs_view',        'logs',      'view'),
  ('perm_logs_export',      'logs',      'export'),
  ('perm_team_view',        'team',      'view'),
  ('perm_team_create',      'team',      'create'),
  ('perm_team_edit',        'team',      'edit'),
  ('perm_team_delete',      'team',      'delete'),
  ('perm_settings_view',    'settings',  'view'),
  ('perm_settings_edit',    'settings',  'edit'),
  ('perm_audit_view',       'audit',     'view'),
  ('perm_audit_export',     'audit',     'export')
ON CONFLICT (domain, action) DO NOTHING;

-- Owner: all permissions
INSERT INTO betterbase_meta.role_permissions (role_id, permission_id)
  SELECT 'role_owner', id FROM betterbase_meta.permissions
ON CONFLICT DO NOTHING;

-- Admin: all except settings_edit and audit_export
INSERT INTO betterbase_meta.role_permissions (role_id, permission_id)
  SELECT 'role_admin', id FROM betterbase_meta.permissions
  WHERE id NOT IN ('perm_settings_edit')
ON CONFLICT DO NOTHING;

-- Developer: projects+users+storage+functions+webhooks+logs (no team, no settings, no audit)
INSERT INTO betterbase_meta.role_permissions (role_id, permission_id)
  SELECT 'role_developer', id FROM betterbase_meta.permissions
  WHERE domain IN ('projects','users','storage','functions','webhooks','logs')
ON CONFLICT DO NOTHING;

-- Viewer: all view permissions only
INSERT INTO betterbase_meta.role_permissions (role_id, permission_id)
  SELECT 'role_viewer', id FROM betterbase_meta.permissions
  WHERE action = 'view'
ON CONFLICT DO NOTHING;
```

**Acceptance criteria:**
- 4 system roles seeded with correct permission sets
- `admin_roles.project_id` nullable — NULL means instance-wide scope
- System roles cannot be deleted (enforced by route, is_system flag)

---

### Task DB-03 — Audit Log Schema

**Depends on:** DB-02

**Create file:** `packages/server/migrations/007_audit_log.sql`

```sql
CREATE TABLE IF NOT EXISTS betterbase_meta.audit_log (
  id            BIGSERIAL PRIMARY KEY,
  actor_id      TEXT,                    -- admin_user.id, NULL for system events
  actor_email   TEXT,                    -- denormalized for log permanence
  action        TEXT NOT NULL,           -- e.g. "project.create", "user.ban", "admin.login"
  resource_type TEXT,                    -- "project" | "user" | "webhook" | etc.
  resource_id   TEXT,
  resource_name TEXT,                    -- human-readable snapshot
  before_data   JSONB,                   -- state before mutation (NULL for creates)
  after_data    JSONB,                   -- state after mutation (NULL for deletes)
  ip_address    TEXT,
  user_agent    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Cannot UPDATE or DELETE from this table (enforced by route layer — no update/delete routes exist)
-- Index for dashboard queries
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON betterbase_meta.audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_actor_id   ON betterbase_meta.audit_log (actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_action     ON betterbase_meta.audit_log (action);
CREATE INDEX IF NOT EXISTS idx_audit_log_resource   ON betterbase_meta.audit_log (resource_type, resource_id);
```

**Acceptance criteria:**
- No UPDATE or DELETE routes ever created for this table
- Indexes on all common filter columns
- `actor_email` denormalized so logs survive admin deletion

---

### Task DB-04 — API Keys Schema

**Depends on:** DB-03

**Create file:** `packages/server/migrations/008_api_keys.sql`

```sql
CREATE TABLE IF NOT EXISTS betterbase_meta.api_keys (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  admin_user_id TEXT NOT NULL REFERENCES betterbase_meta.admin_users(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  key_hash      TEXT NOT NULL UNIQUE,   -- SHA-256 of the plaintext key
  key_prefix    TEXT NOT NULL,          -- first 8 chars for identification, e.g. "bb_live_"
  scopes        TEXT[] NOT NULL DEFAULT '{}',  -- [] = full access, or specific domains
  last_used_at  TIMESTAMPTZ,
  expires_at    TIMESTAMPTZ,            -- NULL = never expires
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Acceptance criteria:**
- Key stored as SHA-256 hash, plaintext returned once on creation
- `key_prefix` allows identifying key without revealing it
- `scopes` array for future permission scoping

---

### Task DB-05 — Instance Settings + SMTP Schema

**Depends on:** DB-04

**Create file:** `packages/server/migrations/009_instance_settings.sql`

```sql
-- Generic key-value store for instance settings
CREATE TABLE IF NOT EXISTS betterbase_meta.instance_settings (
  key        TEXT PRIMARY KEY,
  value      JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by TEXT  -- admin_user.id
);

-- SMTP configuration
CREATE TABLE IF NOT EXISTS betterbase_meta.smtp_config (
  id          TEXT PRIMARY KEY DEFAULT 'singleton',  -- only one row ever
  host        TEXT NOT NULL,
  port        INTEGER NOT NULL DEFAULT 587,
  username    TEXT NOT NULL,
  password    TEXT NOT NULL,   -- encrypted at rest in future; plaintext for v1
  from_email  TEXT NOT NULL,
  from_name   TEXT NOT NULL DEFAULT 'Betterbase',
  use_tls     BOOLEAN NOT NULL DEFAULT TRUE,
  enabled     BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Notification rules
CREATE TABLE IF NOT EXISTS betterbase_meta.notification_rules (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name        TEXT NOT NULL,
  metric      TEXT NOT NULL,   -- "error_rate" | "storage_pct" | "auth_failures" | "response_time_p99"
  threshold   NUMERIC NOT NULL,
  channel     TEXT NOT NULL,   -- "email" | "webhook"
  target      TEXT NOT NULL,   -- email address or webhook URL
  enabled     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed default instance settings
INSERT INTO betterbase_meta.instance_settings (key, value) VALUES
  ('instance_name',    '"Betterbase"'),
  ('public_url',       '"http://localhost"'),
  ('contact_email',    '"admin@localhost"'),
  ('log_retention_days', '30'),
  ('max_sessions_per_user', '10'),
  ('require_email_verification', 'false'),
  ('ip_allowlist',     '[]'),
  ('cors_origins',     '["http://localhost"]')
ON CONFLICT (key) DO NOTHING;
```

**Acceptance criteria:**
- `instance_settings` is a flexible key-value store (avoids schema migrations for new settings)
- SMTP table has single row enforced by `DEFAULT 'singleton'` primary key
- Default settings seeded for all expected keys

---

### Task DB-06 — Webhook Delivery Logs + Function Invocation Logs

**Depends on:** DB-05

**Create file:** `packages/server/migrations/010_delivery_invocation_logs.sql`

```sql
-- Webhook delivery attempts
CREATE TABLE IF NOT EXISTS betterbase_meta.webhook_deliveries (
  id          BIGSERIAL PRIMARY KEY,
  webhook_id  TEXT NOT NULL REFERENCES betterbase_meta.webhooks(id) ON DELETE CASCADE,
  event_type  TEXT NOT NULL,
  payload     JSONB NOT NULL,
  status      TEXT NOT NULL DEFAULT 'pending',  -- pending | success | failed
  response_code  INTEGER,
  response_body  TEXT,
  duration_ms    INTEGER,
  attempt_count  INTEGER NOT NULL DEFAULT 1,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  delivered_at   TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_webhook_id ON betterbase_meta.webhook_deliveries (webhook_id, created_at DESC);

-- Function invocation log
CREATE TABLE IF NOT EXISTS betterbase_meta.function_invocations (
  id           BIGSERIAL PRIMARY KEY,
  function_id  TEXT NOT NULL REFERENCES betterbase_meta.functions(id) ON DELETE CASCADE,
  trigger_type TEXT NOT NULL DEFAULT 'http',   -- http | schedule | event
  status       TEXT NOT NULL,                  -- success | error | timeout
  duration_ms  INTEGER,
  error_message TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_function_invocations_function_id ON betterbase_meta.function_invocations (function_id, created_at DESC);
```

**Acceptance criteria:**
- Delivery log cascades delete on webhook delete
- Invocation log cascades delete on function delete
- Indexes optimized for "latest N for this webhook/function" queries

---

## Phase 2 — Audit Middleware

### Task DB-07 — Audit Logger Utility

**Depends on:** DB-06

**Create file:** `packages/server/src/lib/audit.ts`

```typescript
import type { Pool } from "pg";
import { getPool } from "./db";

export type AuditAction =
  | "admin.login" | "admin.logout" | "admin.create" | "admin.delete"
  | "project.create" | "project.update" | "project.delete"
  | "project.user.ban" | "project.user.unban" | "project.user.delete" | "project.user.import"
  | "webhook.create" | "webhook.update" | "webhook.delete" | "webhook.retry"
  | "function.create" | "function.delete" | "function.deploy"
  | "storage.bucket.create" | "storage.bucket.delete" | "storage.object.delete"
  | "api_key.create" | "api_key.revoke"
  | "role.assign" | "role.revoke"
  | "settings.update" | "smtp.update"
  | "audit.export";

export interface AuditEntry {
  actorId?: string;
  actorEmail?: string;
  action: AuditAction;
  resourceType?: string;
  resourceId?: string;
  resourceName?: string;
  beforeData?: unknown;
  afterData?: unknown;
  ipAddress?: string;
  userAgent?: string;
}

export async function writeAuditLog(entry: AuditEntry): Promise<void> {
  const pool = getPool();
  // Fire and forget — never delay the response for audit logging
  pool
    .query(
      `INSERT INTO betterbase_meta.audit_log
        (actor_id, actor_email, action, resource_type, resource_id, resource_name,
         before_data, after_data, ip_address, user_agent)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [
        entry.actorId ?? null,
        entry.actorEmail ?? null,
        entry.action,
        entry.resourceType ?? null,
        entry.resourceId ?? null,
        entry.resourceName ?? null,
        entry.beforeData ? JSON.stringify(entry.beforeData) : null,
        entry.afterData ? JSON.stringify(entry.afterData) : null,
        entry.ipAddress ?? null,
        entry.userAgent ?? null,
      ]
    )
    .catch((err) => console.error("[audit] Failed to write log:", err));
}

// Helper: extract IP from Hono context
export function getClientIp(headers: Headers): string {
  return (
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    headers.get("x-real-ip") ??
    "unknown"
  );
}
```

**Acceptance criteria:**
- Fire-and-forget — never blocks request processing
- Errors swallowed silently (log to console only)
- All AuditAction values match what routes will emit

---

## Phase 3 — Instance Routes

### Task DB-08 — Instance Settings Routes

**Depends on:** DB-07

**Create file:** `packages/server/src/routes/admin/instance.ts`

```typescript
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { getPool } from "../../lib/db";
import { writeAuditLog, getClientIp } from "../../lib/audit";

export const instanceRoutes = new Hono();

// GET /admin/instance  — all settings as key-value object
instanceRoutes.get("/", async (c) => {
  const pool = getPool();
  const { rows } = await pool.query(
    "SELECT key, value, updated_at FROM betterbase_meta.instance_settings ORDER BY key"
  );
  // Convert rows to a flat object { key: parsedValue }
  const settings = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return c.json({ settings });
});

// PATCH /admin/instance  — update one or more settings
instanceRoutes.patch(
  "/",
  zValidator(
    "json",
    z.object({
      instance_name:               z.string().min(1).max(100).optional(),
      public_url:                  z.string().url().optional(),
      contact_email:               z.string().email().optional(),
      log_retention_days:          z.number().int().min(1).max(3650).optional(),
      max_sessions_per_user:       z.number().int().min(1).max(1000).optional(),
      require_email_verification:  z.boolean().optional(),
      ip_allowlist:                z.array(z.string()).optional(),
      cors_origins:                z.array(z.string().url()).optional(),
    })
  ),
  async (c) => {
    const data = c.req.valid("json");
    const pool = getPool();
    const admin = c.get("adminUser") as { id: string; email: string };

    const updates = Object.entries(data).filter(([, v]) => v !== undefined);
    for (const [key, value] of updates) {
      await pool.query(
        `INSERT INTO betterbase_meta.instance_settings (key, value, updated_at, updated_by)
         VALUES ($1, $2::jsonb, NOW(), $3)
         ON CONFLICT (key) DO UPDATE SET value = $2::jsonb, updated_at = NOW(), updated_by = $3`,
        [key, JSON.stringify(value), admin.id]
      );
    }

    await writeAuditLog({
      actorId: admin.id,
      actorEmail: admin.email,
      action: "settings.update",
      afterData: data,
      ipAddress: getClientIp(c.req.raw.headers),
    });

    return c.json({ success: true });
  }
);

// GET /admin/instance/health  — connection health checks
instanceRoutes.get("/health", async (c) => {
  const pool = getPool();
  let dbStatus = "ok";
  let dbLatencyMs = 0;

  try {
    const start = Date.now();
    await pool.query("SELECT 1");
    dbLatencyMs = Date.now() - start;
  } catch {
    dbStatus = "error";
  }

  return c.json({
    health: {
      database: { status: dbStatus, latency_ms: dbLatencyMs },
      server: { status: "ok", uptime_seconds: Math.floor(process.uptime()) },
    },
  });
});
```

**Acceptance criteria:**
- GET returns all settings as a flat object (values are already parsed JSONB)
- PATCH is additive — only updates provided keys
- Health check responds even if DB is down (catches the error)

---

### Task DB-09 — SMTP Routes

**Depends on:** DB-08

**Create file:** `packages/server/src/routes/admin/smtp.ts`

```typescript
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { getPool } from "../../lib/db";
import { writeAuditLog, getClientIp } from "../../lib/audit";

export const smtpRoutes = new Hono();

const SmtpSchema = z.object({
  host:       z.string().min(1),
  port:       z.number().int().min(1).max(65535).default(587),
  username:   z.string().min(1),
  password:   z.string().min(1),
  from_email: z.string().email(),
  from_name:  z.string().default("Betterbase"),
  use_tls:    z.boolean().default(true),
  enabled:    z.boolean().default(false),
});

// GET /admin/smtp
smtpRoutes.get("/", async (c) => {
  const pool = getPool();
  const { rows } = await pool.query("SELECT * FROM betterbase_meta.smtp_config WHERE id = 'singleton'");
  if (rows.length === 0) return c.json({ smtp: null });
  const row = { ...rows[0] };
  // Mask password in response
  if (row.password) row.password = "••••••••";
  return c.json({ smtp: row });
});

// PUT /admin/smtp  — upsert
smtpRoutes.put(
  "/",
  zValidator("json", SmtpSchema),
  async (c) => {
    const data = c.req.valid("json");
    const pool = getPool();
    const admin = c.get("adminUser") as { id: string; email: string };

    await pool.query(
      `INSERT INTO betterbase_meta.smtp_config
         (id, host, port, username, password, from_email, from_name, use_tls, enabled, updated_at)
       VALUES ('singleton', $1,$2,$3,$4,$5,$6,$7,$8, NOW())
       ON CONFLICT (id) DO UPDATE SET
         host=$1, port=$2, username=$3, password=$4,
         from_email=$5, from_name=$6, use_tls=$7, enabled=$8, updated_at=NOW()`,
      [data.host, data.port, data.username, data.password, data.from_email, data.from_name, data.use_tls, data.enabled]
    );

    await writeAuditLog({
      actorId: admin.id,
      actorEmail: admin.email,
      action: "smtp.update",
      ipAddress: getClientIp(c.req.raw.headers),
    });

    return c.json({ success: true });
  }
);

// POST /admin/smtp/test  — send test email
smtpRoutes.post(
  "/test",
  zValidator("json", z.object({ to: z.string().email() })),
  async (c) => {
    const { to } = c.req.valid("json");
    const pool = getPool();
    const { rows } = await pool.query("SELECT * FROM betterbase_meta.smtp_config WHERE id = 'singleton' AND enabled = TRUE");

    if (rows.length === 0) {
      return c.json({ error: "SMTP not configured or not enabled" }, 400);
    }

    const config = rows[0];

    // Dynamic import nodemailer (add to package.json: "nodemailer": "^6.9.0", "@types/nodemailer" dev)
    const nodemailer = await import("nodemailer");
    const transporter = nodemailer.default.createTransport({
      host: config.host,
      port: config.port,
      secure: config.port === 465,
      requireTLS: config.use_tls,
      auth: { user: config.username, pass: config.password },
    });

    try {
      await transporter.sendMail({
        from: `"${config.from_name}" <${config.from_email}>`,
        to,
        subject: "Betterbase SMTP Test",
        text: "SMTP is configured correctly.",
        html: "<p>SMTP is configured correctly.</p>",
      });
      return c.json({ success: true, message: `Test email sent to ${to}` });
    } catch (err: any) {
      return c.json({ error: `SMTP error: ${err.message}` }, 400);
    }
  }
);
```

**Also add to `packages/server/package.json` dependencies:**
```json
"nodemailer": "^6.9.0"
```
And devDependencies:
```json
"@types/nodemailer": "^6.4.0"
```

**Acceptance criteria:**
- Password masked in GET response
- Test email endpoint attempts real delivery and returns clear success/error
- PUT is a full upsert — always safe to call

---

### Task DB-10 — RBAC Routes

**Depends on:** DB-09

**Create file:** `packages/server/src/routes/admin/roles.ts`

```typescript
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { getPool } from "../../lib/db";
import { writeAuditLog, getClientIp } from "../../lib/audit";

export const roleRoutes = new Hono();

// GET /admin/roles  — list all roles with their permissions
roleRoutes.get("/", async (c) => {
  const pool = getPool();
  const { rows: roles } = await pool.query(
    "SELECT id, name, description, is_system, created_at FROM betterbase_meta.roles ORDER BY name"
  );

  const { rows: perms } = await pool.query(`
    SELECT rp.role_id, p.id, p.domain, p.action
    FROM betterbase_meta.role_permissions rp
    JOIN betterbase_meta.permissions p ON p.id = rp.permission_id
  `);

  const permsByRole: Record<string, { id: string; domain: string; action: string }[]> = {};
  for (const p of perms) {
    if (!permsByRole[p.role_id]) permsByRole[p.role_id] = [];
    permsByRole[p.role_id].push({ id: p.id, domain: p.domain, action: p.action });
  }

  return c.json({
    roles: roles.map((r) => ({ ...r, permissions: permsByRole[r.id] ?? [] })),
  });
});

// GET /admin/roles/permissions  — all available permissions
roleRoutes.get("/permissions", async (c) => {
  const pool = getPool();
  const { rows } = await pool.query(
    "SELECT id, domain, action FROM betterbase_meta.permissions ORDER BY domain, action"
  );
  return c.json({ permissions: rows });
});

// GET /admin/roles/assignments  — all admin role assignments
roleRoutes.get("/assignments", async (c) => {
  const pool = getPool();
  const { rows } = await pool.query(`
    SELECT ar.id, ar.admin_user_id, au.email AS admin_email,
           ar.role_id, r.name AS role_name,
           ar.project_id, p.name AS project_name,
           ar.created_at
    FROM betterbase_meta.admin_roles ar
    JOIN betterbase_meta.admin_users au ON au.id = ar.admin_user_id
    JOIN betterbase_meta.roles r ON r.id = ar.role_id
    LEFT JOIN betterbase_meta.projects p ON p.id = ar.project_id
    ORDER BY ar.created_at DESC
  `);
  return c.json({ assignments: rows });
});

// POST /admin/roles/assignments  — assign role to admin
roleRoutes.post(
  "/assignments",
  zValidator("json", z.object({
    admin_user_id: z.string().min(1),
    role_id:       z.string().min(1),
    project_id:    z.string().optional(),
  })),
  async (c) => {
    const data = c.req.valid("json");
    const pool = getPool();
    const admin = c.get("adminUser") as { id: string; email: string };

    const { rows } = await pool.query(
      `INSERT INTO betterbase_meta.admin_roles (admin_user_id, role_id, project_id)
       VALUES ($1, $2, $3)
       ON CONFLICT (admin_user_id, role_id, project_id) DO NOTHING
       RETURNING id`,
      [data.admin_user_id, data.role_id, data.project_id ?? null]
    );

    await writeAuditLog({
      actorId: admin.id, actorEmail: admin.email,
      action: "role.assign",
      resourceType: "admin_user", resourceId: data.admin_user_id,
      afterData: data,
      ipAddress: getClientIp(c.req.raw.headers),
    });

    return c.json({ assignment: rows[0] }, 201);
  }
);

// DELETE /admin/roles/assignments/:id
roleRoutes.delete("/assignments/:id", async (c) => {
  const pool = getPool();
  const admin = c.get("adminUser") as { id: string; email: string };

  const { rows } = await pool.query(
    "DELETE FROM betterbase_meta.admin_roles WHERE id = $1 RETURNING id, admin_user_id",
    [c.req.param("id")]
  );
  if (rows.length === 0) return c.json({ error: "Not found" }, 404);

  await writeAuditLog({
    actorId: admin.id, actorEmail: admin.email,
    action: "role.revoke",
    resourceType: "admin_role", resourceId: c.req.param("id"),
    ipAddress: getClientIp(c.req.raw.headers),
  });

  return c.json({ success: true });
});
```

**Acceptance criteria:**
- GET /roles includes permissions array per role
- Assignments support both global (project_id null) and project-scoped roles
- System roles cannot be deleted (no delete route for roles, only assignments)

---

### Task DB-11 — API Keys Routes

**Depends on:** DB-10

**Create file:** `packages/server/src/routes/admin/api-keys.ts`

```typescript
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { createHash, randomBytes } from "crypto";
import { getPool } from "../../lib/db";
import { writeAuditLog, getClientIp } from "../../lib/audit";

export const apiKeyRoutes = new Hono();

// GET /admin/api-keys
apiKeyRoutes.get("/", async (c) => {
  const pool = getPool();
  const admin = c.get("adminUser") as { id: string };
  const { rows } = await pool.query(
    `SELECT id, name, key_prefix, scopes, last_used_at, expires_at, created_at
     FROM betterbase_meta.api_keys
     WHERE admin_user_id = $1
     ORDER BY created_at DESC`,
    [admin.id]
  );
  return c.json({ api_keys: rows });
});

// POST /admin/api-keys
apiKeyRoutes.post(
  "/",
  zValidator("json", z.object({
    name:       z.string().min(1).max(100),
    scopes:     z.array(z.string()).default([]),
    expires_at: z.string().datetime().optional(),
  })),
  async (c) => {
    const data = c.req.valid("json");
    const pool = getPool();
    const admin = c.get("adminUser") as { id: string; email: string };

    const rawKey = `bb_live_${randomBytes(32).toString("hex")}`;
    const keyHash = createHash("sha256").update(rawKey).digest("hex");
    const keyPrefix = rawKey.slice(0, 16);

    const { rows } = await pool.query(
      `INSERT INTO betterbase_meta.api_keys
         (admin_user_id, name, key_hash, key_prefix, scopes, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, name, key_prefix, scopes, expires_at, created_at`,
      [admin.id, data.name, keyHash, keyPrefix, data.scopes, data.expires_at ?? null]
    );

    await writeAuditLog({
      actorId: admin.id, actorEmail: admin.email,
      action: "api_key.create",
      resourceType: "api_key", resourceId: rows[0].id,
      resourceName: data.name,
      ipAddress: getClientIp(c.req.raw.headers),
    });

    // Return plaintext key ONCE — not stored, cannot be recovered
    return c.json({ api_key: rows[0], key: rawKey }, 201);
  }
);

// DELETE /admin/api-keys/:id
apiKeyRoutes.delete("/:id", async (c) => {
  const pool = getPool();
  const admin = c.get("adminUser") as { id: string; email: string };

  const { rows } = await pool.query(
    "DELETE FROM betterbase_meta.api_keys WHERE id = $1 AND admin_user_id = $2 RETURNING id, name",
    [c.req.param("id"), admin.id]
  );
  if (rows.length === 0) return c.json({ error: "Not found" }, 404);

  await writeAuditLog({
    actorId: admin.id, actorEmail: admin.email,
    action: "api_key.revoke",
    resourceType: "api_key", resourceId: c.req.param("id"),
    resourceName: rows[0].name,
    ipAddress: getClientIp(c.req.raw.headers),
  });

  return c.json({ success: true });
});
```

**Update:** `packages/server/src/lib/admin-middleware.ts` — extend to also accept API key auth:

```typescript
// At the top of requireAdmin, before JWT check:
const authHeader = c.req.header("Authorization");

// API key auth (prefix: "bb_live_")
if (authHeader?.startsWith("Bearer bb_live_")) {
  const rawKey = authHeader.slice(7);
  const keyHash = createHash("sha256").update(rawKey).digest("hex");
  const pool = getPool();

  const { rows: keyRows } = await pool.query(
    `SELECT ak.admin_user_id, au.id, au.email
     FROM betterbase_meta.api_keys ak
     JOIN betterbase_meta.admin_users au ON au.id = ak.admin_user_id
     WHERE ak.key_hash = $1
       AND (ak.expires_at IS NULL OR ak.expires_at > NOW())`,
    [keyHash]
  );

  if (keyRows.length === 0) return c.json({ error: "Invalid API key" }, 401);

  // Update last_used_at fire-and-forget
  pool.query("UPDATE betterbase_meta.api_keys SET last_used_at = NOW() WHERE key_hash = $1", [keyHash]).catch(() => {});

  c.set("adminUser", { id: keyRows[0].id, email: keyRows[0].email });
  await next();
  return;
}
// ... rest of existing JWT logic
```

**Add import at top of admin-middleware.ts:**
```typescript
import { createHash } from "crypto";
```

**Acceptance criteria:**
- Plaintext key returned only once on creation
- API keys accepted anywhere JWT tokens are accepted
- `last_used_at` updated on every successful use (fire-and-forget)
- Keys scoped to the creating admin only

---

### Task DB-12 — CLI Sessions Routes

**Depends on:** DB-11

**Create file:** `packages/server/src/routes/admin/cli-sessions.ts`

```typescript
import { Hono } from "hono";
import { getPool } from "../../lib/db";

export const cliSessionRoutes = new Hono();

// GET /admin/cli-sessions  — active device codes + CLI sessions for this admin
cliSessionRoutes.get("/", async (c) => {
  const pool = getPool();
  const admin = c.get("adminUser") as { id: string };

  // Active unverified device codes (pending authorization)
  const { rows: pending } = await pool.query(
    `SELECT user_code, created_at, expires_at
     FROM betterbase_meta.device_codes
     WHERE verified = FALSE AND expires_at > NOW()
     ORDER BY created_at DESC`
  );

  // API keys as a proxy for "CLI connections" (each key = one CLI instance)
  const { rows: keys } = await pool.query(
    `SELECT id, name, key_prefix, last_used_at, expires_at, created_at
     FROM betterbase_meta.api_keys
     WHERE admin_user_id = $1
     ORDER BY last_used_at DESC NULLS LAST`,
    [admin.id]
  );

  return c.json({ pending_authorizations: pending, active_keys: keys });
});

// DELETE /admin/cli-sessions/pending/:userCode  — revoke pending authorization
cliSessionRoutes.delete("/pending/:userCode", async (c) => {
  const pool = getPool();
  const { rows } = await pool.query(
    "DELETE FROM betterbase_meta.device_codes WHERE user_code = $1 RETURNING user_code",
    [c.req.param("userCode")]
  );
  if (rows.length === 0) return c.json({ error: "Not found" }, 404);
  return c.json({ success: true });
});
```

**Acceptance criteria:**
- Shows pending device code authorizations (not yet approved)
- Shows active API keys as CLI connection proxies
- Pending codes can be revoked before user approves

---

### Task DB-13 — Audit Log Routes

**Depends on:** DB-12

**Create file:** `packages/server/src/routes/admin/audit.ts`

```typescript
import { Hono } from "hono";
import { getPool } from "../../lib/db";

export const auditRoutes = new Hono();

// GET /admin/audit?limit=50&offset=0&actor=&action=&resource_type=&from=&to=
auditRoutes.get("/", async (c) => {
  const pool = getPool();
  const limit  = Math.min(parseInt(c.req.query("limit")  ?? "50"),  200);
  const offset = parseInt(c.req.query("offset") ?? "0");
  const actor        = c.req.query("actor");
  const action       = c.req.query("action");
  const resourceType = c.req.query("resource_type");
  const from         = c.req.query("from");
  const to           = c.req.query("to");

  const conditions: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  if (actor)        { conditions.push(`(actor_id = $${idx} OR actor_email ILIKE $${idx+1})`); params.push(actor, `%${actor}%`); idx += 2; }
  if (action)       { conditions.push(`action = $${idx}`); params.push(action); idx++; }
  if (resourceType) { conditions.push(`resource_type = $${idx}`); params.push(resourceType); idx++; }
  if (from)         { conditions.push(`created_at >= $${idx}`); params.push(from); idx++; }
  if (to)           { conditions.push(`created_at <= $${idx}`); params.push(to); idx++; }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const { rows } = await pool.query(
    `SELECT id, actor_id, actor_email, action, resource_type, resource_id, resource_name,
            before_data, after_data, ip_address, created_at
     FROM betterbase_meta.audit_log
     ${where}
     ORDER BY created_at DESC
     LIMIT $${idx} OFFSET $${idx+1}`,
    [...params, limit, offset]
  );

  const { rows: countRows } = await pool.query(
    `SELECT COUNT(*)::int AS total FROM betterbase_meta.audit_log ${where}`,
    params
  );

  return c.json({ logs: rows, total: countRows[0].total, limit, offset });
});

// GET /admin/audit/actions  — distinct action types for filter dropdown
auditRoutes.get("/actions", async (c) => {
  const pool = getPool();
  const { rows } = await pool.query(
    "SELECT DISTINCT action FROM betterbase_meta.audit_log ORDER BY action"
  );
  return c.json({ actions: rows.map((r) => r.action) });
});
```

**Acceptance criteria:**
- All filter params are optional and combinable
- Total count returned for pagination
- No mutation routes exist — audit log is read-only
- Parameterized queries throughout (SQL injection safe)

---

### Task DB-14 — Enhanced Metrics Routes

**Depends on:** DB-13

**Create file:** `packages/server/src/routes/admin/metrics-enhanced.ts`

```typescript
import { Hono } from "hono";
import { getPool } from "../../lib/db";

export const metricsEnhancedRoutes = new Hono();

// GET /admin/metrics/overview — enriched overview
metricsEnhancedRoutes.get("/overview", async (c) => {
  const pool = getPool();

  const [projects, admins, webhooks, functions_, recentErrors] = await Promise.all([
    pool.query("SELECT COUNT(*)::int AS count FROM betterbase_meta.projects"),
    pool.query("SELECT COUNT(*)::int AS count FROM betterbase_meta.admin_users"),
    pool.query("SELECT COUNT(*)::int AS count FROM betterbase_meta.webhooks WHERE enabled = TRUE"),
    pool.query("SELECT COUNT(*)::int AS count FROM betterbase_meta.functions WHERE status = 'active'"),
    pool.query(`
      SELECT COUNT(*)::int AS count FROM betterbase_meta.request_logs
      WHERE status >= 500 AND created_at > NOW() - INTERVAL '1 hour'
    `),
  ]);

  // Per-project user counts
  const { rows: projectRows } = await pool.query(
    "SELECT id, slug FROM betterbase_meta.projects"
  );

  const userCounts: Record<string, number> = {};
  for (const proj of projectRows) {
    try {
      const schemaName = `project_${proj.slug}`;
      const { rows } = await pool.query(
        `SELECT COUNT(*)::int AS count FROM ${schemaName}."user"`
      );
      userCounts[proj.id] = rows[0].count;
    } catch {
      userCounts[proj.id] = 0;
    }
  }

  const totalUsers = Object.values(userCounts).reduce((a, b) => a + b, 0);

  return c.json({
    metrics: {
      projects: projects.rows[0].count,
      admin_users: admins.rows[0].count,
      total_end_users: totalUsers,
      active_webhooks: webhooks.rows[0].count,
      active_functions: functions_.rows[0].count,
      recent_errors_1h: recentErrors.rows[0].count,
      uptime_seconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    },
    user_counts_by_project: userCounts,
  });
});

// GET /admin/metrics/timeseries?metric=requests&period=24h|7d|30d
metricsEnhancedRoutes.get("/timeseries", async (c) => {
  const pool = getPool();
  const metric = c.req.query("metric") ?? "requests";
  const period = c.req.query("period") ?? "24h";

  const intervalMap: Record<string, { trunc: string; interval: string }> = {
    "24h": { trunc: "hour",  interval: "24 hours" },
    "7d":  { trunc: "day",   interval: "7 days"   },
    "30d": { trunc: "day",   interval: "30 days"  },
  };
  const { trunc, interval } = intervalMap[period] ?? intervalMap["24h"];

  if (metric === "requests") {
    const { rows } = await pool.query(`
      SELECT date_trunc($1, created_at) AS ts,
             COUNT(*)::int AS total,
             COUNT(*) FILTER (WHERE status >= 500)::int AS errors,
             COUNT(*) FILTER (WHERE status >= 400 AND status < 500)::int AS client_errors,
             ROUND(AVG(duration_ms))::int AS avg_duration_ms
      FROM betterbase_meta.request_logs
      WHERE created_at > NOW() - INTERVAL '${interval}'
      GROUP BY 1 ORDER BY 1
    `, [trunc]);
    return c.json({ metric, period, series: rows });
  }

  if (metric === "status_codes") {
    const { rows } = await pool.query(`
      SELECT date_trunc($1, created_at) AS ts,
             status,
             COUNT(*)::int AS count
      FROM betterbase_meta.request_logs
      WHERE created_at > NOW() - INTERVAL '${interval}'
      GROUP BY 1, 2 ORDER BY 1, 2
    `, [trunc]);
    return c.json({ metric, period, series: rows });
  }

  return c.json({ error: "Unknown metric" }, 400);
});

// GET /admin/metrics/latency  — percentiles
metricsEnhancedRoutes.get("/latency", async (c) => {
  const pool = getPool();
  const period = c.req.query("period") ?? "1h";
  const intervalMap: Record<string, string> = { "1h": "1 hour", "24h": "24 hours", "7d": "7 days" };
  const interval = intervalMap[period] ?? "1 hour";

  const { rows } = await pool.query(`
    SELECT
      ROUND(PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY duration_ms))::int AS p50,
      ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration_ms))::int AS p95,
      ROUND(PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY duration_ms))::int AS p99,
      ROUND(AVG(duration_ms))::int AS avg,
      MAX(duration_ms)::int AS max
    FROM betterbase_meta.request_logs
    WHERE created_at > NOW() - INTERVAL '${interval}'
  `);

  return c.json({ period, latency: rows[0] });
});

// GET /admin/metrics/top-endpoints?limit=10&period=24h
metricsEnhancedRoutes.get("/top-endpoints", async (c) => {
  const pool = getPool();
  const limit = Math.min(parseInt(c.req.query("limit") ?? "10"), 50);
  const period = c.req.query("period") ?? "24h";
  const intervalMap: Record<string, string> = { "1h": "1 hour", "24h": "24 hours", "7d": "7 days" };
  const interval = intervalMap[period] ?? "24 hours";

  const { rows } = await pool.query(`
    SELECT path,
           COUNT(*)::int AS requests,
           ROUND(AVG(duration_ms))::int AS avg_ms,
           COUNT(*) FILTER (WHERE status >= 500)::int AS errors
    FROM betterbase_meta.request_logs
    WHERE created_at > NOW() - INTERVAL '${interval}'
    GROUP BY path
    ORDER BY requests DESC
    LIMIT $1
  `, [limit]);

  return c.json({ period, endpoints: rows });
});
```

**Acceptance criteria:**
- `timeseries` query uses `date_trunc` for clean bucketing
- Per-project user counts handle missing schemas gracefully (try/catch)
- All period params validated against the interval map

---

## Phase 4 — Per-Project Routes

### Task DB-15 — Per-Project Router Scaffold

**Depends on:** DB-14

**Create file:** `packages/server/src/routes/admin/project-scoped/index.ts`

```typescript
import { Hono } from "hono";
import { getPool } from "../../../lib/db";
import { projectUserRoutes } from "./users";
import { projectAuthConfigRoutes } from "./auth-config";
import { projectDatabaseRoutes } from "./database";
import { projectRealtimeRoutes } from "./realtime";
import { projectEnvRoutes } from "./env";
import { projectWebhookRoutes } from "./webhooks";
import { projectFunctionRoutes } from "./functions";

export const projectScopedRouter = new Hono();

// Middleware: verify project exists and attach to context
projectScopedRouter.use("/:projectId/*", async (c, next) => {
  const pool = getPool();
  const { rows } = await pool.query(
    "SELECT id, name, slug FROM betterbase_meta.projects WHERE id = $1",
    [c.req.param("projectId")]
  );
  if (rows.length === 0) return c.json({ error: "Project not found" }, 404);
  c.set("project", rows[0]);
  await next();
});

projectScopedRouter.route("/:projectId/users",       projectUserRoutes);
projectScopedRouter.route("/:projectId/auth-config",  projectAuthConfigRoutes);
projectScopedRouter.route("/:projectId/database",     projectDatabaseRoutes);
projectScopedRouter.route("/:projectId/realtime",     projectRealtimeRoutes);
projectScopedRouter.route("/:projectId/env",          projectEnvRoutes);
projectScopedRouter.route("/:projectId/webhooks",     projectWebhookRoutes);
projectScopedRouter.route("/:projectId/functions",    projectFunctionRoutes);
```

**Update:** `packages/server/src/routes/admin/index.ts` — add import and route:

```typescript
import { projectScopedRouter } from "./project-scoped/index";
// ...
adminRouter.route("/projects", projectScopedRouter);
// (existing /admin/projects CRUD stays as is — project-scoped routes are additive)
```

**Note:** The existing `projectRoutes` handles `/admin/projects` CRUD. The new `projectScopedRouter` handles `/admin/projects/:id/users`, `/admin/projects/:id/database`, etc. These don't conflict because the existing routes only handle `/`, `/:id` (GET/PATCH/DELETE).

**Acceptance criteria:**
- Project existence verified before any scoped route handler runs
- `project` object (id, name, slug) available via `c.get("project")` in all child routes
- 404 returned for invalid project ID

---

### Task DB-16 — Per-Project User Management Routes

**Depends on:** DB-15

**Create file:** `packages/server/src/routes/admin/project-scoped/users.ts`

```typescript
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { getPool } from "../../../lib/db";
import { writeAuditLog, getClientIp } from "../../../lib/audit";

export const projectUserRoutes = new Hono();

function schemaName(project: { slug: string }) {
  return `project_${project.slug}`;
}

// GET /admin/projects/:id/users?limit=50&offset=0&search=&provider=&banned=&from=&to=
projectUserRoutes.get("/", async (c) => {
  const pool = getPool();
  const project = c.get("project") as { id: string; slug: string };
  const s = schemaName(project);

  const limit   = Math.min(parseInt(c.req.query("limit")  ?? "50"), 200);
  const offset  = parseInt(c.req.query("offset") ?? "0");
  const search  = c.req.query("search");
  const provider = c.req.query("provider");
  const banned  = c.req.query("banned");
  const from    = c.req.query("from");
  const to      = c.req.query("to");

  const conditions: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  if (search)  { conditions.push(`(u.email ILIKE $${idx} OR u.name ILIKE $${idx})`); params.push(`%${search}%`); idx++; }
  if (banned !== undefined) { conditions.push(`u.banned = $${idx}`); params.push(banned === "true"); idx++; }
  if (from)    { conditions.push(`u.created_at >= $${idx}`); params.push(from); idx++; }
  if (to)      { conditions.push(`u.created_at <= $${idx}`); params.push(to); idx++; }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const { rows: users } = await pool.query(
    `SELECT u.id, u.name, u.email, u.email_verified, u.image, u.created_at, u.banned, u.ban_reason, u.ban_expires,
            array_agg(DISTINCT a.provider_id) FILTER (WHERE a.provider_id IS NOT NULL) AS providers,
            MAX(ses.created_at) AS last_sign_in
     FROM ${s}."user" u
     LEFT JOIN ${s}.account a ON a.user_id = u.id
     LEFT JOIN ${s}.session ses ON ses.user_id = u.id
     ${where}
     GROUP BY u.id
     ORDER BY u.created_at DESC
     LIMIT $${idx} OFFSET $${idx+1}`,
    [...params, limit, offset]
  );

  const { rows: countRows } = await pool.query(
    `SELECT COUNT(*)::int AS total FROM ${s}."user" u ${where}`,
    params
  );

  return c.json({ users, total: countRows[0].total, limit, offset });
});

// GET /admin/projects/:id/users/:userId
projectUserRoutes.get("/:userId", async (c) => {
  const pool = getPool();
  const project = c.get("project") as { id: string; slug: string };
  const s = schemaName(project);

  const { rows: users } = await pool.query(
    `SELECT u.*, array_agg(DISTINCT a.provider_id) FILTER (WHERE a.provider_id IS NOT NULL) AS providers
     FROM ${s}."user" u
     LEFT JOIN ${s}.account a ON a.user_id = u.id
     WHERE u.id = $1
     GROUP BY u.id`,
    [c.req.param("userId")]
  );
  if (users.length === 0) return c.json({ error: "User not found" }, 404);

  const { rows: sessions } = await pool.query(
    `SELECT id, expires_at, ip_address, user_agent, created_at
     FROM ${s}.session WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20`,
    [c.req.param("userId")]
  );

  return c.json({ user: users[0], sessions });
});

// PATCH /admin/projects/:id/users/:userId/ban
projectUserRoutes.patch(
  "/:userId/ban",
  zValidator("json", z.object({
    banned:     z.boolean(),
    ban_reason: z.string().optional(),
    ban_expires: z.string().datetime().optional(),
  })),
  async (c) => {
    const data = c.req.valid("json");
    const pool = getPool();
    const project = c.get("project") as { id: string; slug: string; name: string };
    const admin = c.get("adminUser") as { id: string; email: string };
    const s = schemaName(project);

    const { rows: before } = await pool.query(`SELECT * FROM ${s}."user" WHERE id = $1`, [c.req.param("userId")]);
    if (before.length === 0) return c.json({ error: "User not found" }, 404);

    const { rows } = await pool.query(
      `UPDATE ${s}."user"
       SET banned = $1, ban_reason = $2, ban_expires = $3, updated_at = NOW()
       WHERE id = $4
       RETURNING id, email, banned, ban_reason, ban_expires`,
      [data.banned, data.ban_reason ?? null, data.ban_expires ?? null, c.req.param("userId")]
    );

    await writeAuditLog({
      actorId: admin.id, actorEmail: admin.email,
      action: data.banned ? "project.user.ban" : "project.user.unban",
      resourceType: "user", resourceId: c.req.param("userId"),
      resourceName: before[0].email,
      beforeData: { banned: before[0].banned },
      afterData: { banned: data.banned, reason: data.ban_reason },
      ipAddress: getClientIp(c.req.raw.headers),
    });

    // Revoke all sessions if banned
    if (data.banned) {
      await pool.query(`DELETE FROM ${s}.session WHERE user_id = $1`, [c.req.param("userId")]);
    }

    return c.json({ user: rows[0] });
  }
);

// DELETE /admin/projects/:id/users/:userId
projectUserRoutes.delete("/:userId", async (c) => {
  const pool = getPool();
  const project = c.get("project") as { id: string; slug: string };
  const admin = c.get("adminUser") as { id: string; email: string };
  const s = schemaName(project);

  const { rows } = await pool.query(
    `DELETE FROM ${s}."user" WHERE id = $1 RETURNING id, email`,
    [c.req.param("userId")]
  );
  if (rows.length === 0) return c.json({ error: "User not found" }, 404);

  await writeAuditLog({
    actorId: admin.id, actorEmail: admin.email,
    action: "project.user.delete",
    resourceType: "user", resourceId: c.req.param("userId"),
    resourceName: rows[0].email,
    ipAddress: getClientIp(c.req.raw.headers),
  });

  return c.json({ success: true });
});

// DELETE /admin/projects/:id/users/:userId/sessions  — force logout
projectUserRoutes.delete("/:userId/sessions", async (c) => {
  const pool = getPool();
  const project = c.get("project") as { id: string; slug: string };
  const s = schemaName(project);

  const { rowCount } = await pool.query(
    `DELETE FROM ${s}.session WHERE user_id = $1`,
    [c.req.param("userId")]
  );

  return c.json({ success: true, sessions_revoked: rowCount });
});

// GET /admin/projects/:id/users/stats  — growth + activity charts
projectUserRoutes.get("/stats/overview", async (c) => {
  const pool = getPool();
  const project = c.get("project") as { id: string; slug: string };
  const s = schemaName(project);

  const [total, banned, daily, providers] = await Promise.all([
    pool.query(`SELECT COUNT(*)::int AS count FROM ${s}."user"`),
    pool.query(`SELECT COUNT(*)::int AS count FROM ${s}."user" WHERE banned = TRUE`),
    pool.query(`
      SELECT date_trunc('day', created_at) AS day, COUNT(*)::int AS signups
      FROM ${s}."user"
      WHERE created_at > NOW() - INTERVAL '30 days'
      GROUP BY 1 ORDER BY 1
    `),
    pool.query(`
      SELECT provider_id, COUNT(*)::int AS count
      FROM ${s}.account
      GROUP BY provider_id ORDER BY count DESC
    `),
  ]);

  return c.json({
    total: total.rows[0].count,
    banned: banned.rows[0].count,
    daily_signups_30d: daily.rows,
    provider_breakdown: providers.rows,
  });
});

// POST /admin/projects/:id/users/export  — CSV export
projectUserRoutes.post("/export", async (c) => {
  const pool = getPool();
  const project = c.get("project") as { id: string; slug: string };
  const s = schemaName(project);

  const { rows } = await pool.query(
    `SELECT id, name, email, email_verified, created_at, banned FROM ${s}."user" ORDER BY created_at DESC`
  );

  const header = "id,name,email,email_verified,created_at,banned\n";
  const csv = header + rows.map((r) =>
    `${r.id},"${r.name}","${r.email}",${r.email_verified},${r.created_at},${r.banned}`
  ).join("\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="users-${project.slug}-${Date.now()}.csv"`,
    },
  });
});
```

**Acceptance criteria:**
- All queries use parameterized inputs
- Schema name built from slug (never from user input)
- Ban + unban revokes all active sessions
- Export returns proper CSV content-type + filename
- User stats endpoint returns data formatted for chart consumption

---

### Task DB-17 — Per-Project Auth Config Routes

**Depends on:** DB-16

**Create file:** `packages/server/src/routes/admin/project-scoped/auth-config.ts`

```typescript
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { getPool } from "../../../lib/db";

export const projectAuthConfigRoutes = new Hono();

function schemaName(project: { slug: string }) { return `project_${project.slug}`; }

// GET /admin/projects/:id/auth-config  — all config as key-value object
projectAuthConfigRoutes.get("/", async (c) => {
  const pool = getPool();
  const project = c.get("project") as { id: string; slug: string };
  const s = schemaName(project);

  const { rows } = await pool.query(`SELECT key, value, updated_at FROM ${s}.auth_config ORDER BY key`);
  const config = Object.fromEntries(rows.map((r) => [r.key, r.value]));

  return c.json({ config });
});

// PUT /admin/projects/:id/auth-config/:key  — upsert a single config key
projectAuthConfigRoutes.put(
  "/:key",
  zValidator("json", z.object({ value: z.unknown() })),
  async (c) => {
    const { value } = c.req.valid("json");
    const pool = getPool();
    const project = c.get("project") as { id: string; slug: string };
    const s = schemaName(project);
    const key = c.req.param("key");

    // Allowed keys whitelist
    const ALLOWED_KEYS = [
      "email_password_enabled", "magic_link_enabled", "otp_enabled", "phone_enabled",
      "password_min_length", "require_email_verification",
      "session_expiry_seconds", "refresh_token_expiry_seconds", "max_sessions_per_user",
      "allowed_email_domains", "blocked_email_domains",
      "provider_google", "provider_github", "provider_discord",
      "provider_apple", "provider_microsoft", "provider_twitter", "provider_facebook",
      "twilio_account_sid", "twilio_auth_token", "twilio_phone_number",
    ];

    if (!ALLOWED_KEYS.includes(key)) {
      return c.json({ error: "Unknown config key" }, 400);
    }

    await pool.query(
      `INSERT INTO ${s}.auth_config (key, value, updated_at) VALUES ($1, $2::jsonb, NOW())
       ON CONFLICT (key) DO UPDATE SET value = $2::jsonb, updated_at = NOW()`,
      [key, JSON.stringify(value)]
    );

    return c.json({ success: true, key, value });
  }
);

// DELETE /admin/projects/:id/auth-config/:key  — reset to default
projectAuthConfigRoutes.delete("/:key", async (c) => {
  const pool = getPool();
  const project = c.get("project") as { id: string; slug: string };
  const s = schemaName(project);

  await pool.query(`DELETE FROM ${s}.auth_config WHERE key = $1`, [c.req.param("key")]);
  return c.json({ success: true });
});
```

**Acceptance criteria:**
- Config keys whitelist prevents arbitrary key injection
- Provider config values stored as JSONB (can hold nested { clientId, clientSecret } objects)
- Sensitive values (secrets, tokens) stored but masked in GET — do this in frontend layer

---

### Task DB-18 — Per-Project Database Introspection Routes

**Depends on:** DB-17

**Create file:** `packages/server/src/routes/admin/project-scoped/database.ts`

```typescript
import { Hono } from "hono";
import { getPool } from "../../../lib/db";

export const projectDatabaseRoutes = new Hono();

function schemaName(project: { slug: string }) { return `project_${project.slug}`; }

// GET /admin/projects/:id/database/tables
projectDatabaseRoutes.get("/tables", async (c) => {
  const pool = getPool();
  const project = c.get("project") as { id: string; slug: string };
  const s = schemaName(project);

  const { rows } = await pool.query(
    `SELECT
       t.table_name,
       pg_class.reltuples::bigint AS estimated_row_count,
       pg_size_pretty(pg_total_relation_size(quote_ident($1) || '.' || quote_ident(t.table_name))) AS total_size
     FROM information_schema.tables t
     JOIN pg_class ON pg_class.relname = t.table_name
     WHERE t.table_schema = $1 AND t.table_type = 'BASE TABLE'
     ORDER BY t.table_name`,
    [s]
  );

  return c.json({ tables: rows });
});

// GET /admin/projects/:id/database/tables/:tableName/columns
projectDatabaseRoutes.get("/tables/:tableName/columns", async (c) => {
  const pool = getPool();
  const project = c.get("project") as { id: string; slug: string };
  const s = schemaName(project);
  const tableName = c.req.param("tableName");

  const { rows } = await pool.query(
    `SELECT column_name, data_type, is_nullable, column_default, character_maximum_length
     FROM information_schema.columns
     WHERE table_schema = $1 AND table_name = $2
     ORDER BY ordinal_position`,
    [s, tableName]
  );

  return c.json({ columns: rows });
});

// GET /admin/projects/:id/database/status
projectDatabaseRoutes.get("/status", async (c) => {
  const pool = getPool();
  const project = c.get("project") as { id: string; slug: string };
  const s = schemaName(project);

  const [schemaSize, connInfo] = await Promise.all([
    pool.query(
      `SELECT pg_size_pretty(sum(pg_total_relation_size(quote_ident($1) || '.' || quote_ident(table_name)))::bigint) AS total_size
       FROM information_schema.tables WHERE table_schema = $1`,
      [s]
    ),
    pool.query(
      `SELECT count FROM pg_stat_activity WHERE state = 'active'`
    ),
  ]);

  return c.json({
    schema_size: schemaSize.rows[0]?.total_size ?? "0 bytes",
    active_connections: connInfo.rows.length,
  });
});

// GET /admin/projects/:id/database/migrations
projectDatabaseRoutes.get("/migrations", async (c) => {
  const pool = getPool();
  const { rows } = await pool.query(
    "SELECT id, filename, applied_at FROM betterbase_meta.migrations ORDER BY applied_at DESC"
  );
  return c.json({ migrations: rows });
});
```

**Acceptance criteria:**
- All table names come from `information_schema` — never from user input directly in SQL
- Schema name derived from project slug only
- `estimated_row_count` uses `pg_class.reltuples` (fast, no full scan)

---

### Task DB-19 — Per-Project Realtime Stats Routes

**Depends on:** DB-18

**Create file:** `packages/server/src/routes/admin/project-scoped/realtime.ts`

```typescript
import { Hono } from "hono";
import { getPool } from "../../../lib/db";

export const projectRealtimeRoutes = new Hono();

// GET /admin/projects/:id/realtime/stats
// Note: v1 returns static/estimated stats. Real-time WebSocket tracking is a future enhancement.
// The server tracks connection counts in-memory via a global map if realtime is running.
projectRealtimeRoutes.get("/stats", async (c) => {
  // Access global realtime manager if available (set on app startup)
  const realtimeManager = (globalThis as any).__betterbaseRealtimeManager;

  if (!realtimeManager) {
    return c.json({
      connected_clients: 0,
      active_channels: 0,
      channels: [],
      note: "Realtime manager not initialized",
    });
  }

  // RealtimeManager exposes getStats() — implement this in the realtime module
  const stats = realtimeManager.getStats?.() ?? { clients: 0, channels: [] };

  return c.json({
    connected_clients: stats.clients,
    active_channels: stats.channels.length,
    channels: stats.channels,
  });
});
```

**Acceptance criteria:**
- Returns gracefully if realtime not running (no crash)
- `globalThis.__betterbaseRealtimeManager` pattern allows injection without coupling

---

### Task DB-20 — Per-Project Environment Variables Routes

**Depends on:** DB-19

**Create file:** `packages/server/src/routes/admin/project-scoped/env.ts`

```typescript
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { getPool } from "../../../lib/db";

export const projectEnvRoutes = new Hono();

function schemaName(project: { slug: string }) { return `project_${project.slug}`; }

// GET /admin/projects/:id/env
projectEnvRoutes.get("/", async (c) => {
  const pool = getPool();
  const project = c.get("project") as { id: string; slug: string };
  const s = schemaName(project);

  const { rows } = await pool.query(
    `SELECT key, is_secret, created_at, updated_at,
            CASE WHEN is_secret THEN '••••••••' ELSE value END AS value
     FROM ${s}.env_vars ORDER BY key`
  );
  return c.json({ env_vars: rows });
});

// PUT /admin/projects/:id/env/:key
projectEnvRoutes.put(
  "/:key",
  zValidator("json", z.object({
    value:     z.string(),
    is_secret: z.boolean().default(true),
  })),
  async (c) => {
    const { value, is_secret } = c.req.valid("json");
    const pool = getPool();
    const project = c.get("project") as { id: string; slug: string };
    const s = schemaName(project);
    const key = c.req.param("key");

    if (!/^[A-Z][A-Z0-9_]*$/.test(key)) {
      return c.json({ error: "Key must be uppercase, alphanumeric with underscores" }, 400);
    }

    await pool.query(
      `INSERT INTO ${s}.env_vars (key, value, is_secret, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (key) DO UPDATE SET value=$2, is_secret=$3, updated_at=NOW()`,
      [key, value, is_secret]
    );

    return c.json({ success: true, key });
  }
);

// DELETE /admin/projects/:id/env/:key
projectEnvRoutes.delete("/:key", async (c) => {
  const pool = getPool();
  const project = c.get("project") as { id: string; slug: string };
  const s = schemaName(project);

  const { rows } = await pool.query(
    `DELETE FROM ${s}.env_vars WHERE key = $1 RETURNING key`,
    [c.req.param("key")]
  );
  if (rows.length === 0) return c.json({ error: "Not found" }, 404);
  return c.json({ success: true });
});
```

**Acceptance criteria:**
- Secret values masked in GET response
- Key format validated (uppercase + underscores only)
- Upsert semantics (safe to PUT same key multiple times)

---

### Task DB-21 — Per-Project Webhooks Routes

**Depends on:** DB-20

**Create file:** `packages/server/src/routes/admin/project-scoped/webhooks.ts`

```typescript
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { nanoid } from "nanoid";
import { getPool } from "../../../lib/db";

export const projectWebhookRoutes = new Hono();

// GET /admin/projects/:id/webhooks
projectWebhookRoutes.get("/", async (c) => {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT w.*,
            COUNT(wd.id)::int AS total_deliveries,
            COUNT(wd.id) FILTER (WHERE wd.status = 'success')::int AS successful_deliveries,
            MAX(wd.created_at) AS last_delivery_at
     FROM betterbase_meta.webhooks w
     LEFT JOIN betterbase_meta.webhook_deliveries wd ON wd.webhook_id = w.id
     GROUP BY w.id ORDER BY w.created_at DESC`
  );
  return c.json({ webhooks: rows });
});

// GET /admin/projects/:id/webhooks/:webhookId/deliveries
projectWebhookRoutes.get("/:webhookId/deliveries", async (c) => {
  const pool = getPool();
  const limit  = Math.min(parseInt(c.req.query("limit")  ?? "50"), 200);
  const offset = parseInt(c.req.query("offset") ?? "0");

  const { rows } = await pool.query(
    `SELECT id, event_type, status, response_code, duration_ms, attempt_count, created_at, delivered_at
     FROM betterbase_meta.webhook_deliveries
     WHERE webhook_id = $1
     ORDER BY created_at DESC
     LIMIT $2 OFFSET $3`,
    [c.req.param("webhookId"), limit, offset]
  );

  return c.json({ deliveries: rows, limit, offset });
});

// GET /admin/projects/:id/webhooks/:webhookId/deliveries/:deliveryId
projectWebhookRoutes.get("/:webhookId/deliveries/:deliveryId", async (c) => {
  const pool = getPool();
  const { rows } = await pool.query(
    "SELECT * FROM betterbase_meta.webhook_deliveries WHERE id = $1 AND webhook_id = $2",
    [c.req.param("deliveryId"), c.req.param("webhookId")]
  );
  if (rows.length === 0) return c.json({ error: "Not found" }, 404);
  return c.json({ delivery: rows[0] });
});

// POST /admin/projects/:id/webhooks/:webhookId/retry
projectWebhookRoutes.post("/:webhookId/retry", async (c) => {
  const pool = getPool();
  const { rows: webhooks } = await pool.query(
    "SELECT * FROM betterbase_meta.webhooks WHERE id = $1",
    [c.req.param("webhookId")]
  );
  if (webhooks.length === 0) return c.json({ error: "Webhook not found" }, 404);

  const webhook = webhooks[0];
  const syntheticPayload = {
    id: nanoid(),
    webhook_id: webhook.id,
    table: webhook.table_name,
    type: "RETRY",
    record: {},
    timestamp: new Date().toISOString(),
  };

  // Fire delivery attempt
  const start = Date.now();
  let status = "failed";
  let responseCode: number | null = null;
  let responseBody: string | null = null;

  try {
    const res = await fetch(webhook.url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Betterbase-Event": "RETRY" },
      body: JSON.stringify(syntheticPayload),
    });
    responseCode = res.status;
    responseBody = await res.text();
    status = res.ok ? "success" : "failed";
  } catch (err: any) {
    responseBody = err.message;
  }

  const duration = Date.now() - start;

  await pool.query(
    `INSERT INTO betterbase_meta.webhook_deliveries
       (webhook_id, event_type, payload, status, response_code, response_body, duration_ms, delivered_at)
     VALUES ($1, 'RETRY', $2, $3, $4, $5, $6, NOW())`,
    [webhook.id, JSON.stringify(syntheticPayload), status, responseCode, responseBody, duration]
  );

  return c.json({ success: status === "success", status, response_code: responseCode, duration_ms: duration });
});

// POST /admin/projects/:id/webhooks/:webhookId/test  — send synthetic test payload
projectWebhookRoutes.post("/:webhookId/test", async (c) => {
  const pool = getPool();
  const { rows } = await pool.query(
    "SELECT * FROM betterbase_meta.webhooks WHERE id = $1",
    [c.req.param("webhookId")]
  );
  if (rows.length === 0) return c.json({ error: "Not found" }, 404);

  const webhook = rows[0];
  const payload = {
    id: nanoid(),
    webhook_id: webhook.id,
    table: webhook.table_name,
    type: "TEST",
    record: { id: "test-123", example: "data" },
    timestamp: new Date().toISOString(),
  };

  try {
    const res = await fetch(webhook.url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return c.json({ success: res.ok, status_code: res.status });
  } catch (err: any) {
    return c.json({ success: false, error: err.message });
  }
});
```

**Acceptance criteria:**
- Delivery list returns health summary (total, successful, last delivery time) per webhook
- Retry creates a new delivery log entry
- Test endpoint does not create a delivery log entry (it's informal)

---

### Task DB-22 — Per-Project Functions Routes

**Depends on:** DB-21

**Create file:** `packages/server/src/routes/admin/project-scoped/functions.ts`

```typescript
import { Hono } from "hono";
import { getPool } from "../../../lib/db";

export const projectFunctionRoutes = new Hono();

// GET /admin/projects/:id/functions/:functionId/invocations
projectFunctionRoutes.get("/:functionId/invocations", async (c) => {
  const pool = getPool();
  const limit  = Math.min(parseInt(c.req.query("limit")  ?? "50"), 200);
  const offset = parseInt(c.req.query("offset") ?? "0");

  const { rows } = await pool.query(
    `SELECT id, trigger_type, status, duration_ms, error_message, created_at
     FROM betterbase_meta.function_invocations
     WHERE function_id = $1
     ORDER BY created_at DESC
     LIMIT $2 OFFSET $3`,
    [c.req.param("functionId"), limit, offset]
  );

  return c.json({ invocations: rows, limit, offset });
});

// GET /admin/projects/:id/functions/:functionId/stats
projectFunctionRoutes.get("/:functionId/stats", async (c) => {
  const pool = getPool();
  const period = c.req.query("period") ?? "24h";
  const intervalMap: Record<string, string> = { "1h": "1 hour", "24h": "24 hours", "7d": "7 days" };
  const interval = intervalMap[period] ?? "24 hours";

  const { rows: summary } = await pool.query(`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE status = 'success')::int AS successes,
      COUNT(*) FILTER (WHERE status = 'error')::int AS errors,
      ROUND(AVG(duration_ms))::int AS avg_duration_ms,
      MAX(duration_ms)::int AS max_duration_ms
    FROM betterbase_meta.function_invocations
    WHERE function_id = $1 AND created_at > NOW() - INTERVAL '${interval}'
  `, [c.req.param("functionId")]);

  const { rows: timeseries } = await pool.query(`
    SELECT date_trunc('hour', created_at) AS ts,
           COUNT(*)::int AS invocations,
           COUNT(*) FILTER (WHERE status = 'error')::int AS errors
    FROM betterbase_meta.function_invocations
    WHERE function_id = $1 AND created_at > NOW() - INTERVAL '${interval}'
    GROUP BY 1 ORDER BY 1
  `, [c.req.param("functionId")]);

  return c.json({ period, summary: summary[0], timeseries });
});
```

**Acceptance criteria:**
- Stats return correct period-filtered data
- Timeseries bucketed by hour for chart rendering

---

## Phase 5 — Notification Rules

### Task DB-23 — Notification Rules Routes

**Depends on:** DB-22

**Create file:** `packages/server/src/routes/admin/notifications.ts`

```typescript
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { nanoid } from "nanoid";
import { getPool } from "../../lib/db";

export const notificationRoutes = new Hono();

const RuleSchema = z.object({
  name:      z.string().min(1).max(100),
  metric:    z.enum(["error_rate", "storage_pct", "auth_failures", "response_time_p99"]),
  threshold: z.number(),
  channel:   z.enum(["email", "webhook"]),
  target:    z.string().min(1),
  enabled:   z.boolean().default(true),
});

notificationRoutes.get("/", async (c) => {
  const pool = getPool();
  const { rows } = await pool.query("SELECT * FROM betterbase_meta.notification_rules ORDER BY created_at DESC");
  return c.json({ rules: rows });
});

notificationRoutes.post("/", zValidator("json", RuleSchema), async (c) => {
  const data = c.req.valid("json");
  const pool = getPool();
  const { rows } = await pool.query(
    `INSERT INTO betterbase_meta.notification_rules (id, name, metric, threshold, channel, target, enabled)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [nanoid(), data.name, data.metric, data.threshold, data.channel, data.target, data.enabled]
  );
  return c.json({ rule: rows[0] }, 201);
});

notificationRoutes.patch("/:id", zValidator("json", RuleSchema.partial()), async (c) => {
  const data = c.req.valid("json");
  const pool = getPool();
  const sets: string[] = [];
  const params: unknown[] = [];
  let idx = 1;
  for (const [k, v] of Object.entries(data)) {
    if (v !== undefined) { sets.push(`${k} = $${idx}`); params.push(v); idx++; }
  }
  if (sets.length === 0) return c.json({ error: "Nothing to update" }, 400);
  params.push(c.req.param("id"));
  const { rows } = await pool.query(
    `UPDATE betterbase_meta.notification_rules SET ${sets.join(", ")} WHERE id = $${idx} RETURNING *`,
    params
  );
  if (rows.length === 0) return c.json({ error: "Not found" }, 404);
  return c.json({ rule: rows[0] });
});

notificationRoutes.delete("/:id", async (c) => {
  const pool = getPool();
  const { rows } = await pool.query("DELETE FROM betterbase_meta.notification_rules WHERE id = $1 RETURNING id", [c.req.param("id")]);
  if (rows.length === 0) return c.json({ error: "Not found" }, 404);
  return c.json({ success: true });
});
```

**Acceptance criteria:**
- Metric enum covers the metrics available from the metrics endpoints
- Partial PATCH supported

---

## Phase 6 — Wire Everything Into Admin Router

### Task DB-24 — Update Admin Router Index

**Depends on:** DB-23

**Replace file:** `packages/server/src/routes/admin/index.ts`

```typescript
import { Hono } from "hono";
import { requireAdmin } from "../../lib/admin-middleware";
import { authRoutes } from "./auth";
import { projectRoutes } from "./projects";
import { userRoutes } from "./users";
import { metricsRoutes } from "./metrics";
import { metricsEnhancedRoutes } from "./metrics-enhanced";
import { storageRoutes } from "./storage";
import { webhookRoutes } from "./webhooks";
import { functionRoutes } from "./functions";
import { logRoutes } from "./logs";
import { instanceRoutes } from "./instance";
import { smtpRoutes } from "./smtp";
import { roleRoutes } from "./roles";
import { apiKeyRoutes } from "./api-keys";
import { cliSessionRoutes } from "./cli-sessions";
import { auditRoutes } from "./audit";
import { notificationRoutes } from "./notifications";
import { projectScopedRouter } from "./project-scoped/index";

export const adminRouter = new Hono();

// Public: login/logout/setup
adminRouter.route("/auth", authRoutes);

// All other admin routes require valid admin token or API key
adminRouter.use("/*", requireAdmin);

// Instance-level resources
adminRouter.route("/projects",      projectRoutes);
adminRouter.route("/projects",      projectScopedRouter);  // scoped sub-routes
adminRouter.route("/users",         userRoutes);
adminRouter.route("/storage",       storageRoutes);
adminRouter.route("/webhooks",      webhookRoutes);
adminRouter.route("/functions",     functionRoutes);
adminRouter.route("/logs",          logRoutes);
adminRouter.route("/metrics",       metricsRoutes);
adminRouter.route("/metrics",       metricsEnhancedRoutes);

// New routes from this spec
adminRouter.route("/instance",      instanceRoutes);
adminRouter.route("/smtp",          smtpRoutes);
adminRouter.route("/roles",         roleRoutes);
adminRouter.route("/api-keys",      apiKeyRoutes);
adminRouter.route("/cli-sessions",  cliSessionRoutes);
adminRouter.route("/audit",         auditRoutes);
adminRouter.route("/notifications", notificationRoutes);
```

**Acceptance criteria:**
- All new routers registered
- Auth routes remain public
- No route conflicts (verify `bun run dev` starts without errors)

---

## Phase 7 — Update package.json and Add Missing Dependencies

### Task DB-25 — Update Server Dependencies

**Depends on:** DB-24

**Modify file:** `packages/server/package.json`

Ensure the following are in `dependencies`:

```json
{
  "dependencies": {
    "@betterbase/core": "workspace:*",
    "@betterbase/shared": "workspace:*",
    "@hono/zod-validator": "^0.2.0",
    "@aws-sdk/client-s3": "^3.0.0",
    "hono": "^4.0.0",
    "pg": "^8.11.0",
    "bcryptjs": "^2.4.3",
    "nanoid": "^5.0.0",
    "jose": "^5.0.0",
    "nodemailer": "^6.9.0",
    "zod": "^3.22.0"
  },
  "devDependencies": {
    "@types/pg": "^8.11.0",
    "@types/bcryptjs": "^2.4.6",
    "@types/nodemailer": "^6.4.0",
    "typescript": "^5.4.0"
  }
}
```

**Acceptance criteria:**
- `bun install` completes without errors
- `bun run dev` starts server without TypeScript errors
- All imports resolve

---

## Summary — Complete Route Map

After this spec is implemented, the full admin API surface is:

```
POST   /admin/auth/login
GET    /admin/auth/me
POST   /admin/auth/logout
POST   /admin/auth/setup               ← first-run only

GET    /admin/projects
POST   /admin/projects
GET    /admin/projects/:id
PATCH  /admin/projects/:id
DELETE /admin/projects/:id

GET    /admin/projects/:id/users
GET    /admin/projects/:id/users/stats/overview
POST   /admin/projects/:id/users/export
GET    /admin/projects/:id/users/:userId
PATCH  /admin/projects/:id/users/:userId/ban
DELETE /admin/projects/:id/users/:userId
DELETE /admin/projects/:id/users/:userId/sessions

GET    /admin/projects/:id/auth-config
PUT    /admin/projects/:id/auth-config/:key
DELETE /admin/projects/:id/auth-config/:key

GET    /admin/projects/:id/database/tables
GET    /admin/projects/:id/database/tables/:table/columns
GET    /admin/projects/:id/database/status
GET    /admin/projects/:id/database/migrations

GET    /admin/projects/:id/realtime/stats

GET    /admin/projects/:id/env
PUT    /admin/projects/:id/env/:key
DELETE /admin/projects/:id/env/:key

GET    /admin/projects/:id/webhooks
GET    /admin/projects/:id/webhooks/:webhookId/deliveries
GET    /admin/projects/:id/webhooks/:webhookId/deliveries/:deliveryId
POST   /admin/projects/:id/webhooks/:webhookId/retry
POST   /admin/projects/:id/webhooks/:webhookId/test

GET    /admin/projects/:id/functions/:functionId/invocations
GET    /admin/projects/:id/functions/:functionId/stats

GET    /admin/users
POST   /admin/users
DELETE /admin/users/:id

GET    /admin/storage/buckets
POST   /admin/storage/buckets
DELETE /admin/storage/buckets/:name
GET    /admin/storage/buckets/:name/objects

GET    /admin/webhooks
POST   /admin/webhooks
PATCH  /admin/webhooks/:id
DELETE /admin/webhooks/:id

GET    /admin/functions
POST   /admin/functions
DELETE /admin/functions/:id

GET    /admin/metrics
GET    /admin/metrics/overview
GET    /admin/metrics/timeseries
GET    /admin/metrics/latency
GET    /admin/metrics/top-endpoints

GET    /admin/logs
GET    /admin/instance
PATCH  /admin/instance
GET    /admin/instance/health

GET    /admin/smtp
PUT    /admin/smtp
POST   /admin/smtp/test

GET    /admin/roles
GET    /admin/roles/permissions
GET    /admin/roles/assignments
POST   /admin/roles/assignments
DELETE /admin/roles/assignments/:id

GET    /admin/api-keys
POST   /admin/api-keys
DELETE /admin/api-keys/:id

GET    /admin/cli-sessions
DELETE /admin/cli-sessions/pending/:userCode

GET    /admin/audit
GET    /admin/audit/actions

GET    /admin/notifications
POST   /admin/notifications
PATCH  /admin/notifications/:id
DELETE /admin/notifications/:id

GET    /health
POST   /device/code
GET    /device/verify
POST   /device/verify
POST   /device/token
```

**Total tasks: 25 (DB-01 through DB-25)**

---

## Execution Order

```
Phase 1 — Schema
  DB-01  Project schema provisioning function + projects.ts update
  DB-02  RBAC schema (006_rbac.sql)
  DB-03  Audit log schema (007_audit_log.sql)
  DB-04  API keys schema (008_api_keys.sql)
  DB-05  Instance settings + SMTP schema (009_instance_settings.sql)
  DB-06  Delivery + invocation logs (010_delivery_invocation_logs.sql)

Phase 2 — Audit Middleware
  DB-07  audit.ts utility

Phase 3 — Instance Routes
  DB-08  instance.ts
  DB-09  smtp.ts  (add nodemailer dep)
  DB-10  roles.ts
  DB-11  api-keys.ts + update admin-middleware.ts
  DB-12  cli-sessions.ts
  DB-13  audit.ts (routes)
  DB-14  metrics-enhanced.ts

Phase 4 — Per-Project Routes
  DB-15  project-scoped/index.ts (scaffold + router middleware)
  DB-16  project-scoped/users.ts
  DB-17  project-scoped/auth-config.ts
  DB-18  project-scoped/database.ts
  DB-19  project-scoped/realtime.ts
  DB-20  project-scoped/env.ts
  DB-21  project-scoped/webhooks.ts
  DB-22  project-scoped/functions.ts

Phase 5 — Notifications
  DB-23  notifications.ts

Phase 6 — Wire Up
  DB-24  Update admin/index.ts

Phase 7 — Dependencies
  DB-25  Update package.json, run bun install, verify startup
```

*End of backend specification. Pass to Kilo Code for implementation. Test by starting the server and verifying `/health` returns 200, then run `bb login --url http://localhost:3001` to verify the full auth flow before proceeding to the frontend spec.*
