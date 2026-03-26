**BetterBase**

**Observability Suite**

Orchestrator Specification — SH-29 through SH-36 \+ D-14 through D-19

| 8 Backend Tasks | 6 Frontend Tasks | 4 Migration Files | 1 Real-Time Stream |
| :---: | :---: | :---: | :---: |

*Execute tasks in strict order within each phase. Frontend tasks depend on all backend tasks being complete. Do not begin D-14 until SH-36 is marked complete.*

# **Overview**

This specification adds a full observability layer to BetterBase — both the self-hosted server (packages/server) and the dashboard frontend (apps/dashboard). It extends the foundation laid in SH-01 through SH-28.

| Capability | Backend Task(s) | Frontend Task(s) |
| :---- | :---- | :---- |
| Global metrics (overview, timeseries, latency, top endpoints) | SH-29, SH-32 | D-14 |
| Per-project observability | SH-33 | D-15 |
| Webhook delivery tracing | SH-30, SH-34 | D-16 |
| Function invocation tracing | SH-31, SH-35 | D-17 |
| Real-time log stream (polling) | SH-36 | D-18, D-19 |

# **Phase A — Backend: Data Layer & API Endpoints**

All tasks in this phase modify packages/server. Execute SH-29 → SH-36 in order.

| SH-29 | Enhance request\_logs \+ Add Migration 005 | Phase A |
| :---: | :---- | :---: |

Depends on: SH-28 (all prior SH tasks complete)

The existing request\_logs table (created in SH-16) only captures method, path, status, and duration. Observability requires project\_id association and endpoint categorisation. Add columns via a new migration and update the logging middleware.

### **Create file: packages/server/migrations/005\_enhance\_request\_logs.sql**

ALTER TABLE betterbase\_meta.request\_logs

  ADD COLUMN IF NOT EXISTS project\_id TEXT,

  ADD COLUMN IF NOT EXISTS user\_agent TEXT,

  ADD COLUMN IF NOT EXISTS ip TEXT,

  ADD COLUMN IF NOT EXISTS error\_message TEXT;

\-- Index for per-project queries

CREATE INDEX IF NOT EXISTS idx\_req\_logs\_project

  ON betterbase\_meta.request\_logs (project\_id, created\_at DESC);

\-- Index for latency percentile queries

CREATE INDEX IF NOT EXISTS idx\_req\_logs\_duration

  ON betterbase\_meta.request\_logs (duration\_ms, created\_at DESC);

### **Update file: packages/server/src/index.ts — logging middleware**

Replace the existing fire-and-forget log insert middleware with:

app.use('\*', async (c, next) \=\> {

  const start \= Date.now();

  await next();

  const duration \= Date.now() \- start;

  const projectId \= c.req.header('X-Project-ID') ?? null;

  const userAgent \= c.req.header('User-Agent')?.slice(0, 255\) ?? null;

  const ip \= c.req.header('X-Forwarded-For')?.split(',')\[0\] ?? null;

  getPool().query(

    \`INSERT INTO betterbase\_meta.request\_logs

     (method, path, status, duration\_ms, project\_id, user\_agent, ip)

     VALUES ($1,$2,$3,$4,$5,$6,$7)\`,

    \[c.req.method, new URL(c.req.url).pathname,

     c.res.status, duration, projectId, userAgent, ip\]

  ).catch(() \=\> {});

});

**ACCEPTANCE CRITERIA**

* Migration file is named 005\_ (runs after 004\_logs.sql)

* Three new indexes: project\_id, duration\_ms, and existing created\_at from SH-16

* Middleware extracts X-Project-ID header — null if absent (never throws)

* User-agent truncated to 255 chars to prevent oversized inserts

| SH-30 | Webhook Delivery Logs Table \+ Migration 006 | Phase A |
| :---: | :---- | :---: |

Depends on: SH-29

Create a table to persist every webhook delivery attempt — status, response code, duration, and error message. This powers the webhook debugging UI in D-16.

### **Create file: packages/server/migrations/006\_webhook\_delivery\_logs.sql**

CREATE TABLE IF NOT EXISTS betterbase\_meta.webhook\_delivery\_logs (

  id           TEXT PRIMARY KEY,

  webhook\_id   TEXT NOT NULL REFERENCES betterbase\_meta.webhooks(id)

                 ON DELETE CASCADE,

  event\_type   TEXT NOT NULL,

  table\_name   TEXT NOT NULL,

  payload      JSONB,

  status       TEXT NOT NULL DEFAULT 'pending',

               \-- 'success' | 'failed' | 'pending'

  http\_status  INT,

  duration\_ms  INT,

  error\_msg    TEXT,

  attempt      INT NOT NULL DEFAULT 1,

  created\_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()

);

CREATE INDEX IF NOT EXISTS idx\_wdl\_webhook\_id

  ON betterbase\_meta.webhook\_delivery\_logs (webhook\_id, created\_at DESC);

CREATE INDEX IF NOT EXISTS idx\_wdl\_status

  ON betterbase\_meta.webhook\_delivery\_logs (status, created\_at DESC);

### **Create file: packages/server/src/lib/webhook-logger.ts**

import { getPool } from './db';

import { nanoid } from 'nanoid';

export interface WebhookDeliveryRecord {

  webhookId: string;

  eventType: string;

  tableName: string;

  payload?: unknown;

  status: 'success' | 'failed' | 'pending';

  httpStatus?: number;

  durationMs?: number;

  errorMsg?: string;

  attempt?: number;

}

export async function logWebhookDelivery(r: WebhookDeliveryRecord): Promise\<void\> {

  await getPool().query(

    \`INSERT INTO betterbase\_meta.webhook\_delivery\_logs

     (id, webhook\_id, event\_type, table\_name, payload, status,

      http\_status, duration\_ms, error\_msg, attempt)

     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)\`,

    \[nanoid(), r.webhookId, r.eventType, r.tableName,

     r.payload ? JSON.stringify(r.payload) : null,

     r.status, r.httpStatus ?? null, r.durationMs ?? null,

     r.errorMsg ?? null, r.attempt ?? 1\]

  );

}

**ACCEPTANCE CRITERIA**

* webhook\_delivery\_logs references webhooks(id) with ON DELETE CASCADE

* payload stored as JSONB (not TEXT)

* logWebhookDelivery is fire-and-not-forget — it awaits (callers need confirmation it was logged)

* status constrained to 'success' | 'failed' | 'pending' via application logic

* Two indexes: webhook\_id \+ status

| SH-31 | Function Invocation Logs Table \+ Migration 007 | Phase A |
| :---: | :---- | :---: |

Depends on: SH-30

Create a table to track every function invocation: duration, status, cold start flag, and truncated response/error. Powers the function tracing UI in D-17.

### **Create file: packages/server/migrations/007\_function\_invocation\_logs.sql**

CREATE TABLE IF NOT EXISTS betterbase\_meta.function\_invocation\_logs (

  id              TEXT PRIMARY KEY,

  function\_id     TEXT NOT NULL REFERENCES betterbase\_meta.functions(id)

                    ON DELETE CASCADE,

  function\_name   TEXT NOT NULL,

  status          TEXT NOT NULL DEFAULT 'pending',

                  \-- 'success' | 'error' | 'timeout' | 'pending'

  duration\_ms     INT,

  cold\_start      BOOLEAN NOT NULL DEFAULT FALSE,

  request\_method  TEXT,

  request\_path    TEXT,

  response\_status INT,

  error\_msg       TEXT,

  created\_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()

);

CREATE INDEX IF NOT EXISTS idx\_fil\_function\_id

  ON betterbase\_meta.function\_invocation\_logs (function\_id, created\_at DESC);

CREATE INDEX IF NOT EXISTS idx\_fil\_status

  ON betterbase\_meta.function\_invocation\_logs (status, created\_at DESC);

### **Create file: packages/server/src/lib/function-logger.ts**

import { getPool } from './db';

import { nanoid } from 'nanoid';

export interface FunctionInvocationRecord {

  functionId: string;

  functionName: string;

  status: 'success' | 'error' | 'timeout' | 'pending';

  durationMs?: number;

  coldStart?: boolean;

  requestMethod?: string;

  requestPath?: string;

  responseStatus?: number;

  errorMsg?: string;

}

export async function logFunctionInvocation(

  r: FunctionInvocationRecord

): Promise\<void\> {

  await getPool().query(

    \`INSERT INTO betterbase\_meta.function\_invocation\_logs

     (id, function\_id, function\_name, status, duration\_ms, cold\_start,

      request\_method, request\_path, response\_status, error\_msg)

     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)\`,

    \[nanoid(), r.functionId, r.functionName, r.status,

     r.durationMs ?? null, r.coldStart ?? false,

     r.requestMethod ?? null, r.requestPath ?? null,

     r.responseStatus ?? null, r.errorMsg ?? null\]

  );

}

**ACCEPTANCE CRITERIA**

* function\_invocation\_logs references functions(id) with ON DELETE CASCADE

* cold\_start is a boolean column (default false)

* error\_msg stored as TEXT — no truncation required at the DB level

* Two indexes: function\_id \+ status

| SH-32 | Global Metrics API Endpoints | Phase A |
| :---: | :---- | :---: |

Depends on: SH-31

Extend packages/server/src/routes/admin/metrics.ts with four sub-routes used by the dashboard ObservabilityPage.

### **Update file: packages/server/src/routes/admin/metrics.ts**

Replace the existing single GET / route with the following four-route implementation:

import { Hono } from 'hono';

import { getPool } from '../../lib/db';

export const metricsRoutes \= new Hono();

// GET /admin/metrics/overview

metricsRoutes.get('/overview', async (c) \=\> {

  const pool \= getPool();

  const \[projects, admins, fns, errors\] \= await Promise.all(\[

    pool.query('SELECT COUNT(\*)::int as count FROM betterbase\_meta.projects'),

    pool.query('SELECT COUNT(\*)::int as count FROM betterbase\_meta.admin\_users'),

    pool.query('SELECT COUNT(\*)::int as count FROM betterbase\_meta.functions'),

    pool.query(\`SELECT COUNT(\*)::int as count FROM betterbase\_meta.request\_logs

               WHERE status \>= 500 AND created\_at \> NOW() \- INTERVAL '24h'\`),

  \]);

  return c.json({ metrics: {

    projects: projects.rows\[0\].count,

    admin\_users: admins.rows\[0\].count,

    functions: fns.rows\[0\].count,

    errors\_24h: errors.rows\[0\].count,

    server\_uptime\_seconds: Math.floor(process.uptime()),

    timestamp: new Date().toISOString(),

  }});

});

// GET /admin/metrics/timeseries?period=24h|7d|30d

metricsRoutes.get('/timeseries', async (c) \=\> {

  const period \= c.req.query('period') ?? '24h';

  const intervalMap: Record\<string, string\> \= {

    '24h': "1 hour", '7d': "1 day", '30d': "1 day"

  };

  const rangeMap: Record\<string, string\> \= {

    '24h': "24 hours", '7d': "7 days", '30d': "30 days"

  };

  const interval \= intervalMap\[period\] ?? '1 hour';

  const range \= rangeMap\[period\] ?? '24 hours';

  const pool \= getPool();

  const { rows } \= await pool.query(\`

    SELECT date\_trunc('${interval}', created\_at) AS bucket,

           COUNT(\*)::int AS total,

           COUNT(\*) FILTER (WHERE status \>= 500)::int AS errors

    FROM betterbase\_meta.request\_logs

    WHERE created\_at \> NOW() \- INTERVAL '${range}'

    GROUP BY bucket ORDER BY bucket ASC

  \`);

  return c.json({ timeseries: rows, period });

});

// GET /admin/metrics/latency?period=24h|7d

metricsRoutes.get('/latency', async (c) \=\> {

  const period \= c.req.query('period') ?? '24h';

  const range \= period \=== '7d' ? '7 days' : '24 hours';

  const pool \= getPool();

  const { rows } \= await pool.query(\`

    SELECT

      percentile\_cont(0.50) WITHIN GROUP (ORDER BY duration\_ms)::int AS p50,

      percentile\_cont(0.95) WITHIN GROUP (ORDER BY duration\_ms)::int AS p95,

      percentile\_cont(0.99) WITHIN GROUP (ORDER BY duration\_ms)::int AS p99,

      AVG(duration\_ms)::int AS avg

    FROM betterbase\_meta.request\_logs

    WHERE created\_at \> NOW() \- INTERVAL '${range}'

      AND duration\_ms IS NOT NULL

  \`);

  return c.json({ latency: rows\[0\] ?? { p50:0, p95:0, p99:0, avg:0 }, period });

});

// GET /admin/metrics/top-endpoints?period=24h\&limit=10

metricsRoutes.get('/top-endpoints', async (c) \=\> {

  const period \= c.req.query('period') ?? '24h';

  const limit \= Math.min(parseInt(c.req.query('limit') ?? '10'), 50);

  const range \= period \=== '7d' ? '7 days' : '24 hours';

  const pool \= getPool();

  const { rows } \= await pool.query(\`

    SELECT path, method,

           COUNT(\*)::int AS count,

           AVG(duration\_ms)::int AS avg\_ms,

           COUNT(\*) FILTER (WHERE status \>= 500)::int AS errors

    FROM betterbase\_meta.request\_logs

    WHERE created\_at \> NOW() \- INTERVAL '${range}'

    GROUP BY path, method

    ORDER BY count DESC

    LIMIT $1

  \`, \[limit\]);

  return c.json({ endpoints: rows, period });

});

*Also update packages/server/src/routes/admin/index.ts: replace adminRouter.route('/metrics', metricsRoutes) — no change needed if it already routes to metricsRoutes. The sub-routes (/overview, /timeseries, /latency, /top-endpoints) are defined within the router, so they resolve as /admin/metrics/overview etc.*

**ACCEPTANCE CRITERIA**

* GET /admin/metrics/overview returns projects, admin\_users, functions, errors\_24h, uptime

* GET /admin/metrics/timeseries accepts period=24h|7d|30d — defaults to 24h

* GET /admin/metrics/latency returns p50, p95, p99, avg in milliseconds

* GET /admin/metrics/top-endpoints returns path, method, count, avg\_ms, errors — limit capped at 50

* All endpoints require admin auth (inherited from router middleware in index.ts)

* percentile\_cont requires Postgres 9.4+ — safe assumption with Postgres 16

| SH-33 | Per-Project Metrics Endpoints | Phase A |
| :---: | :---- | :---: |

Depends on: SH-32

Add a nested metrics sub-router under /admin/projects/:projectId/metrics so the dashboard can show per-project observability.

### **Create file: packages/server/src/routes/admin/project-metrics.ts**

import { Hono } from 'hono';

import { getPool } from '../../lib/db';

export const projectMetricsRoutes \= new Hono\<{ Variables: { projectId: string } }\>();

// GET /admin/projects/:projectId/metrics/overview

projectMetricsRoutes.get('/overview', async (c) \=\> {

  const projectId \= c.req.param('projectId');

  const pool \= getPool();

  const \[total, errors, latency\] \= await Promise.all(\[

    pool.query(\`SELECT COUNT(\*)::int as count FROM betterbase\_meta.request\_logs

               WHERE project\_id=$1 AND created\_at \> NOW() \- INTERVAL '24h'\`,\[projectId\]),

    pool.query(\`SELECT COUNT(\*)::int as count FROM betterbase\_meta.request\_logs

               WHERE project\_id=$1 AND status\>=500

               AND created\_at \> NOW() \- INTERVAL '24h'\`,\[projectId\]),

    pool.query(\`SELECT AVG(duration\_ms)::int AS avg\_ms

               FROM betterbase\_meta.request\_logs

               WHERE project\_id=$1 AND created\_at \> NOW() \- INTERVAL '24h'\`,\[projectId\]),

  \]);

  return c.json({ metrics: {

    requests\_24h: total.rows\[0\].count,

    errors\_24h: errors.rows\[0\].count,

    avg\_latency\_ms: latency.rows\[0\].avg\_ms ?? 0,

    project\_id: projectId,

  }});

});

// GET /admin/projects/:projectId/metrics/timeseries?period=24h|7d

projectMetricsRoutes.get('/timeseries', async (c) \=\> {

  const projectId \= c.req.param('projectId');

  const period \= c.req.query('period') ?? '24h';

  const range \= period \=== '7d' ? '7 days' : '24 hours';

  const pool \= getPool();

  const { rows } \= await pool.query(\`

    SELECT date\_trunc('hour', created\_at) AS bucket,

           COUNT(\*)::int AS total,

           COUNT(\*) FILTER (WHERE status \>= 500)::int AS errors

    FROM betterbase\_meta.request\_logs

    WHERE project\_id \= $1 AND created\_at \> NOW() \- INTERVAL '${range}'

    GROUP BY bucket ORDER BY bucket ASC

  \`, \[projectId\]);

  return c.json({ timeseries: rows, period, project\_id: projectId });

});

### **Update file: packages/server/src/routes/admin/projects.ts**

Add the following after the existing routes, before the module ends:

import { projectMetricsRoutes } from './project-metrics';

// Mount per-project metrics

projectRoutes.route('/:projectId/metrics', projectMetricsRoutes);

**ACCEPTANCE CRITERIA**

* GET /admin/projects/:projectId/metrics/overview returns request/error counts filtered by project\_id

* GET /admin/projects/:projectId/metrics/timeseries returns hourly buckets for the project

* projectId is taken from the URL param — never from the request body

* No 404 if project has no logs — returns zeroes

| SH-34 | Webhook Delivery History Endpoint | Phase A |
| :---: | :---- | :---: |

Depends on: SH-33

Add delivery history and retry endpoints to the webhook routes.

### **Update file: packages/server/src/routes/admin/webhooks.ts**

Append these routes to the existing webhookRoutes Hono instance:

// GET /admin/webhooks/:id/deliveries?limit=50\&status=failed

webhookRoutes.get('/:id/deliveries', async (c) \=\> {

  const limit \= Math.min(parseInt(c.req.query('limit') ?? '50'), 200);

  const status \= c.req.query('status');

  const pool \= getPool();

  const { rows } \= await pool.query(\`

    SELECT id, event\_type, table\_name, status, http\_status,

           duration\_ms, error\_msg, attempt, created\_at

    FROM betterbase\_meta.webhook\_delivery\_logs

    WHERE webhook\_id \= $1

      ${status ? 'AND status \= $3' : ''}

    ORDER BY created\_at DESC LIMIT $2

  \`, status ? \[c.req.param('id'), limit, status\] : \[c.req.param('id'), limit\]);

  return c.json({ deliveries: rows });

});

// GET /admin/webhooks/:id/stats

webhookRoutes.get('/:id/stats', async (c) \=\> {

  const pool \= getPool();

  const { rows } \= await pool.query(\`

    SELECT

      COUNT(\*)::int AS total,

      COUNT(\*) FILTER (WHERE status='success')::int AS success,

      COUNT(\*) FILTER (WHERE status='failed')::int AS failed,

      AVG(duration\_ms)::int AS avg\_duration\_ms,

      MAX(created\_at) AS last\_delivery

    FROM betterbase\_meta.webhook\_delivery\_logs

    WHERE webhook\_id \= $1

      AND created\_at \> NOW() \- INTERVAL '30 days'

  \`, \[c.req.param('id')\]);

  return c.json({ stats: rows\[0\] });

});

**ACCEPTANCE CRITERIA**

* GET /admin/webhooks/:id/deliveries supports optional ?status=failed filter

* GET /admin/webhooks/:id/stats returns success/failed counts \+ avg duration over 30 days

* limit capped at 200

* Both routes return empty/zero data (not 404\) if webhook has no deliveries

| SH-35 | Function Invocation Tracing Endpoint | Phase A |
| :---: | :---- | :---: |

Depends on: SH-34

### **Update file: packages/server/src/routes/admin/functions.ts**

Append these routes to the existing functionRoutes Hono instance:

// GET /admin/functions/:id/invocations?limit=50\&status=error

functionRoutes.get('/:id/invocations', async (c) \=\> {

  const limit \= Math.min(parseInt(c.req.query('limit') ?? '50'), 200);

  const status \= c.req.query('status');

  const pool \= getPool();

  const { rows } \= await pool.query(\`

    SELECT id, function\_name, status, duration\_ms, cold\_start,

           request\_method, request\_path, response\_status, error\_msg, created\_at

    FROM betterbase\_meta.function\_invocation\_logs

    WHERE function\_id \= $1

      ${status ? 'AND status \= $3' : ''}

    ORDER BY created\_at DESC LIMIT $2

  \`, status ? \[c.req.param('id'), limit, status\] : \[c.req.param('id'), limit\]);

  return c.json({ invocations: rows });

});

// GET /admin/functions/:id/stats

functionRoutes.get('/:id/stats', async (c) \=\> {

  const pool \= getPool();

  const { rows } \= await pool.query(\`

    SELECT

      COUNT(\*)::int AS total,

      COUNT(\*) FILTER (WHERE status='success')::int AS success,

      COUNT(\*) FILTER (WHERE status='error')::int AS errors,

      COUNT(\*) FILTER (WHERE cold\_start=TRUE)::int AS cold\_starts,

      percentile\_cont(0.50) WITHIN GROUP (ORDER BY duration\_ms)::int AS p50\_ms,

      percentile\_cont(0.95) WITHIN GROUP (ORDER BY duration\_ms)::int AS p95\_ms,

      AVG(duration\_ms)::int AS avg\_ms

    FROM betterbase\_meta.function\_invocation\_logs

    WHERE function\_id \= $1

      AND created\_at \> NOW() \- INTERVAL '30 days'

  \`, \[c.req.param('id')\]);

  return c.json({ stats: rows\[0\] });

});

**ACCEPTANCE CRITERIA**

* GET /admin/functions/:id/invocations supports optional ?status=error filter

* GET /admin/functions/:id/stats returns cold\_starts count and p50/p95 latency

* limit capped at 200

* cold\_start field included in every invocation row

| SH-36 | Real-Time Log Stream Endpoint (Polling) | Phase A |
| :---: | :---- | :---: |

Depends on: SH-35

The dashboard needs a live log feed. SSE is ideal but requires persistent connections that complicate Docker health checks. Use a polling endpoint instead: the frontend calls it every 3 seconds with a since timestamp and receives new log entries since that time. This is the pattern recommended for the self-hosted deployment model.

### **Update file: packages/server/src/routes/admin/logs.ts**

Replace the existing GET / route with two routes:

// GET /admin/logs — paginated history (existing, keep as-is)

logRoutes.get('/', async (c) \=\> {

  const limit \= Math.min(parseInt(c.req.query('limit') ?? '50'), 200);

  const offset \= parseInt(c.req.query('offset') ?? '0');

  const pool \= getPool();

  const { rows } \= await pool.query(

    \`SELECT id, method, path, status, duration\_ms, project\_id, created\_at

     FROM betterbase\_meta.request\_logs

     ORDER BY created\_at DESC LIMIT $1 OFFSET $2\`,

    \[limit, offset\]

  );

  return c.json({ logs: rows, limit, offset });

});

// GET /admin/logs/stream?since=\<ISO timestamp\>\&limit=100

// Returns all logs created after ?since. Frontend polls this every 3s.

// On first call, omit since to get the last 100 entries as seed data.

logRoutes.get('/stream', async (c) \=\> {

  const since \= c.req.query('since');

  const limit \= Math.min(parseInt(c.req.query('limit') ?? '100'), 500);

  const pool \= getPool();

  let rows: any\[\];

  if (since) {

    const result \= await pool.query(

      \`SELECT id, method, path, status, duration\_ms, project\_id,

              ip, user\_agent, created\_at

       FROM betterbase\_meta.request\_logs

       WHERE created\_at \> $1

       ORDER BY created\_at ASC LIMIT $2\`,

      \[since, limit\]

    );

    rows \= result.rows;

  } else {

    const result \= await pool.query(

      \`SELECT id, method, path, status, duration\_ms, project\_id,

              ip, user\_agent, created\_at

       FROM betterbase\_meta.request\_logs

       ORDER BY created\_at DESC LIMIT $1\`,

      \[limit\]

    );

    rows \= result.rows.reverse(); // Chronological order for seeding

  }

  const lastTimestamp \= rows.length \> 0

    ? rows\[rows.length \- 1\].created\_at

    : since ?? new Date().toISOString();

  return c.json({ logs: rows, next\_since: lastTimestamp });

});

**ACCEPTANCE CRITERIA**

* GET /admin/logs/stream without ?since returns last 100 entries in ascending order (seed data)

* GET /admin/logs/stream?since=\<ts\> returns only entries created strictly after that timestamp

* Response always includes next\_since for the frontend to use in the next poll

* limit capped at 500 — not 200, because streaming needs more headroom

* Frontend contract: poll interval is 3 seconds; dashboard implements this in D-19

# **Phase B — Frontend: Dashboard Pages**

All tasks in this phase modify apps/dashboard. Execute D-14 → D-19 in order. All tasks depend on Phase A being complete.

*The dashboard uses the @betterbase/client SDK and its existing mock-server.ts pattern. Replace mock calls with real apiRequest() calls from packages/cli/src/utils/api-client.ts or the dashboard's own equivalent fetch wrapper. Every component must handle loading, empty, and error states.*

| D-14 | Global ObservabilityPage | Phase B |
| :---: | :---- | :---: |

Depends on: SH-36 (all backend tasks complete)

Create the top-level observability page — the main destination from the sidebar nav item that currently points nowhere.

### **Create file: apps/dashboard/src/pages/ObservabilityPage.tsx**

The page is composed of five sections rendered in order:

| Section | Description |
| :---- | :---- |
| StatCards | Four cards: Total Projects, Total Functions, Errors (24h), Avg Latency (24h). Data from GET /admin/metrics/overview \+ /admin/metrics/latency |
| RequestVolumeChart | Recharts AreaChart of total requests vs errors over time. Period selector: 24h / 7d / 30d. Data from GET /admin/metrics/timeseries?period= |
| LatencyPills | Three pills showing P50 / P95 / P99. Colour-coded: green \<100ms, amber \<500ms, red ≥500ms. Data from GET /admin/metrics/latency |
| TopEndpointsTable | Table: Method, Path, Count, Avg Latency, Errors. Sortable by Count (default). Data from GET /admin/metrics/top-endpoints?limit=10 |
| RecentActivityFeed | Last 20 request log entries with method badge, path, status code, latency, and timestamp. Data from GET /admin/logs/stream (seed, no polling on this page) |

### **Hook: apps/dashboard/src/hooks/useGlobalMetrics.ts**

// Fetches overview \+ latency \+ timeseries in parallel.

// Refreshes every 30 seconds.

export function useGlobalMetrics(period: '24h' | '7d' | '30d' \= '24h') {

  // Returns: { overview, latency, timeseries, endpoints, loading, error }

  // Uses Promise.all to fetch all four endpoints simultaneously.

  // period state change triggers refetch of timeseries \+ latency.

}

**ACCEPTANCE CRITERIA**

* Page mounts without errors with real API data

* Period selector (24h/7d/30d) updates the chart and latency pills without full page reload

* StatCards show skeleton loaders during initial fetch

* LatencyPills apply correct colour coding: \<100ms green, \<500ms amber, \>=500ms red

* TopEndpointsTable is sortable client-side by Count column (default sort)

* RecentActivityFeed renders status codes with colour: 2xx green, 4xx amber, 5xx red

* Page is added to the sidebar nav with an icon (e.g. BarChart2 from lucide-react)

| D-15 | Per-Project ObservabilityPage | Phase B |
| :---: | :---- | :---: |

Depends on: D-14

Add an Observability tab to the existing project detail page (wherever projects are displayed in the dashboard).

### **Create file: apps/dashboard/src/pages/ProjectObservabilityPage.tsx**

Props: { projectId: string }

| Section | Description |
| :---- | :---- |
| ProjectStatCards | Requests (24h), Errors (24h), Avg Latency. Data from GET /admin/projects/:id/metrics/overview |
| ProjectTimeseries | Same AreaChart as D-14 but scoped to project. Data from GET /admin/projects/:id/metrics/timeseries |
| ProjectLogFeed | Last 50 request logs for this project only. No polling (static snapshot). Data from GET /admin/logs?project\_id= (add optional project\_id filter to the paginated logs endpoint — add WHERE project\_id=$3 WHEN query param present) |

*The paginated GET /admin/logs endpoint in SH-16/SH-36 needs a minor update: add an optional ?project\_id query param that adds WHERE project\_id \= $n to the query. Add this as part of D-15 implementation — it is a one-line SQL change.*

**ACCEPTANCE CRITERIA**

* ProjectId sourced from URL param — never hardcoded

* Shows zero-state with helpful message if project has no logged requests yet

* Accessible from project detail page as an 'Observability' tab alongside Settings etc.

* Reuses the same chart component from D-14 (no duplicate implementation)

| D-16 | Webhook Delivery Debug Page | Phase B |
| :---: | :---- | :---: |

Depends on: D-15

Extend the existing webhook detail view (wherever webhooks are listed/managed) with a Deliveries tab.

### **Create file: apps/dashboard/src/pages/WebhookDeliveriesPage.tsx**

Props: { webhookId: string }

| UI Element | Detail |
| :---- | :---- |
| Stats bar | Total / Success / Failed counts \+ avg duration. Source: GET /admin/webhooks/:id/stats |
| Filter tabs | All | Success | Failed — filters the table below |
| Deliveries table | Columns: Timestamp, Event, Table, Status badge, HTTP Status, Duration, Error. Source: GET /admin/webhooks/:id/deliveries?status= |
| Expandable row | Clicking a row expands to show full payload JSON (pretty-printed) |
| Status badge | Green pill for success, red for failed, grey for pending |

**ACCEPTANCE CRITERIA**

* Filter tabs update the ?status= query param and refetch

* Expandable rows show payload as formatted JSON — not raw string

* Stats bar refreshes when filter tab changes

* Empty state: 'No deliveries yet' with icon when table is empty

* Error messages truncated to 200 chars in table — full text in expanded row

| D-17 | Function Invocation Tracing UI | Phase B |
| :---: | :---- | :---: |

Depends on: D-16

Extend the existing function detail view with an Invocations tab.

### **Create file: apps/dashboard/src/pages/FunctionInvocationsPage.tsx**

Props: { functionId: string }

| UI Element | Detail |
| :---- | :---- |
| Stats bar | Total / Success / Errors / Cold Starts \+ P50 / P95 latency. Source: GET /admin/functions/:id/stats |
| Filter tabs | All | Success | Error — updates ?status= query |
| Invocations table | Columns: Timestamp, Method, Path, Status, Response Code, Duration, Cold Start badge. Source: GET /admin/functions/:id/invocations |
| Cold start badge | Small blue 'COLD' pill shown when cold\_start=true |
| Expandable row | Error message shown when status=error |

**ACCEPTANCE CRITERIA**

* Cold start badge visible only when cold\_start is true

* P50/P95 latency displayed in ms with colour coding matching D-14 LatencyPills

* Error rows highlighted with red left border or subtle red background

* Empty state handled with message and icon

| D-18 | Sidebar Nav \+ Route Registration | Phase B |
| :---: | :---- | :---: |

Depends on: D-17

Wire all new pages into the router and sidebar.

### **Update: apps/dashboard/src/App.tsx (or router file)**

Add routes:

\<Route path='/observability' element={\<ObservabilityPage /\>} /\>

\<Route path='/projects/:projectId/observability' element={\<ProjectObservabilityPage /\>} /\>

\<Route path='/webhooks/:webhookId/deliveries' element={\<WebhookDeliveriesPage /\>} /\>

\<Route path='/functions/:functionId/invocations' element={\<FunctionInvocationsPage /\>} /\>

### **Update: sidebar navigation component**

Add nav item between Logs and Settings:

{ label: 'Observability', path: '/observability', icon: BarChart2 }

**ACCEPTANCE CRITERIA**

* All four routes render without crashing

* Sidebar Observability item is highlighted when on any /observability route

* Project / webhook / function detail pages have the new tabs accessible

* Deep links work (browser refresh on /observability stays on the page)

| D-19 | Real-Time Log Stream Component | Phase B |
| :---: | :---- | :---: |

Depends on: D-18

Create a reusable live log stream component backed by the polling endpoint from SH-36.

### **Create file: apps/dashboard/src/components/LiveLogStream.tsx**

Props: { projectId?: string; maxRows?: number; autoScroll?: boolean }

| Behaviour | Detail |
| :---- | :---- |
| Polling | Calls GET /admin/logs/stream every 3 seconds. Stores next\_since in a ref. New entries prepended to the log list. |
| Max rows | Defaults to 200\. Oldest entries removed when limit exceeded (ring buffer). |
| Auto-scroll | When autoScroll=true, scrolls to newest entry on update. Paused when user scrolls up. |
| Pause/Resume | Toggle button to pause polling (useful for reading logs). |
| Row format | Timestamp | Method badge | Path | Status code | Duration | Project badge (if projectId omitted) |
| Empty state | Shows 'Waiting for requests...' with a pulsing dot when log is empty. |

### **Create file: apps/dashboard/src/hooks/useLogStream.ts**

// Manages polling state and log buffer.

export function useLogStream(opts: {

  projectId?: string;

  maxRows?: number;

  enabled?: boolean;

  pollIntervalMs?: number; // default 3000

}) {

  // Returns: { logs, isPolling, pause, resume, clear }

  // Uses useRef for since timestamp — not state (avoids re-render on every poll)

  // Uses setInterval managed in useEffect with cleanup

}

The LiveLogStream component is used on the global ObservabilityPage as a replacement for the static RecentActivityFeed (update D-14 to use LiveLogStream instead of the static feed).

**ACCEPTANCE CRITERIA**

* Polling starts automatically on mount, stops on unmount (no memory leaks)

* Pause/Resume toggle works correctly — poll stops/starts without resetting since timestamp

* Ring buffer: list never exceeds maxRows (default 200\)

* Auto-scroll pauses when user scrolls up — resumes when user scrolls to bottom

* Clear button resets log and since timestamp

* useLogStream uses useRef for next\_since (not useState — critical to avoid stale closure issues)

# **Execution Order Summary**

| Task | Title | File(s) Created / Modified | Depends On |
| :---- | :---- | :---- | :---- |
| **SH-29** | Enhance request\_logs \+ migration 005 | 005\_enhance\_request\_logs.sql, index.ts | SH-28 |
| **SH-30** | Webhook delivery logs \+ migration 006 | 006\_webhook\_delivery\_logs.sql, webhook-logger.ts | SH-29 |
| **SH-31** | Function invocation logs \+ migration 007 | 007\_function\_invocation\_logs.sql, function-logger.ts | SH-30 |
| **SH-32** | Global metrics API (4 endpoints) | routes/admin/metrics.ts (replace) | SH-31 |
| **SH-33** | Per-project metrics API | routes/admin/project-metrics.ts, projects.ts | SH-32 |
| **SH-34** | Webhook delivery history endpoint | routes/admin/webhooks.ts (append) | SH-33 |
| **SH-35** | Function invocation tracing endpoint | routes/admin/functions.ts (append) | SH-34 |
| **SH-36** | Live log stream endpoint | routes/admin/logs.ts (replace) | SH-35 |
| **D-14** | Global ObservabilityPage | ObservabilityPage.tsx, useGlobalMetrics.ts | SH-36 |
| **D-15** | Per-project ObservabilityPage | ProjectObservabilityPage.tsx | D-14 |
| **D-16** | Webhook delivery debug page | WebhookDeliveriesPage.tsx | D-15 |
| **D-17** | Function invocation tracing UI | FunctionInvocationsPage.tsx | D-16 |
| **D-18** | Sidebar nav \+ route registration | App.tsx, sidebar component | D-17 |
| **D-19** | Live log stream component | LiveLogStream.tsx, useLogStream.ts | D-18 |

## **Migration Sequence**

Migrations 005–007 extend the schema created in migrations 001–004. The migration runner (SH-02) applies them automatically on server start.

| File | Purpose |
| :---- | :---- |
| 005\_enhance\_request\_logs.sql | Adds project\_id, user\_agent, ip, error\_message columns \+ 2 indexes to request\_logs |
| 006\_webhook\_delivery\_logs.sql | New table: webhook\_delivery\_logs with 2 indexes |
| 007\_function\_invocation\_logs.sql | New table: function\_invocation\_logs with 2 indexes |

## **Dependencies Checklist**

Verify before starting Phase A:

* nanoid — already in packages/server/package.json (SH-04)

* pg — already in packages/server/package.json (SH-04)

* recharts — must be present in apps/dashboard/package.json for D-14 charts

* lucide-react — must be present in apps/dashboard for icons (BarChart2, Activity, Zap)

* percentile\_cont() — requires PostgreSQL 9.4+; Docker image uses postgres:16-alpine — safe

*End of specification. 14 tasks across 2 phases. Execute in listed order.*