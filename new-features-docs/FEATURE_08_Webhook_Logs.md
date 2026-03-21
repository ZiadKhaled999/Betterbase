# Feature 8: Webhooks Delivery Logs

**Priority**: Medium (Week 15)  
**Complexity**: Low  
**Dependencies**: Structured Logging, Migrations  
**Estimated Effort**: 1-2 weeks

---

## Problem Statement

Webhooks fire-and-forget with no visibility:
- Can't see if webhook succeeded/failed
- No history of deliveries
- Can't retry failed deliveries
- Debugging is impossible

---

## Solution

Store delivery attempts in database table:
- Log every delivery (success/fail)
- Dashboard route to view logs
- CLI command to retry failed deliveries
- 30-day retention (configurable)

---

## Implementation

### Step 1: Create Delivery Logs Table

**File**: `packages/core/src/webhooks/schema.sql` (NEW)

```sql
CREATE TABLE IF NOT EXISTS _betterbase_webhook_deliveries (
  id TEXT PRIMARY KEY,
  webhook_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('success', 'failed', 'pending')),
  request_url TEXT NOT NULL,
  request_body TEXT,
  response_code INTEGER,
  response_body TEXT,
  error TEXT,
  attempt_count INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_webhook_deliveries_webhook_id 
  ON _betterbase_webhook_deliveries(webhook_id);
CREATE INDEX idx_webhook_deliveries_created_at 
  ON _betterbase_webhook_deliveries(created_at DESC);
```

---

### Step 2: Update Webhook Dispatcher

**File**: `packages/core/src/webhooks/dispatcher.ts`

**MODIFY**:

```typescript
import { nanoid } from 'nanoid';

export class WebhookDispatcher {
  private db: any;

  constructor(db: any) {
    this.db = db;
  }

  async dispatch(config: WebhookConfig, payload: WebhookPayload): Promise<void> {
    const deliveryId = nanoid();
    
    // Create delivery log
    await this.db.execute({
      sql: `
        INSERT INTO _betterbase_webhook_deliveries 
        (id, webhook_id, status, request_url, request_body, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `,
      args: [
        deliveryId,
        config.id,
        'pending',
        config.url,
        JSON.stringify(payload),
        new Date().toISOString(),
      ],
    });

    try {
      const signature = signPayload(payload, config.secret);

      const response = await fetch(config.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-BetterBase-Signature': signature,
        },
        body: JSON.stringify(payload),
      });

      const responseBody = await response.text();

      // Update log - success/fail
      await this.db.execute({
        sql: `
          UPDATE _betterbase_webhook_deliveries
          SET status = ?, response_code = ?, response_body = ?, updated_at = ?
          WHERE id = ?
        `,
        args: [
          response.ok ? 'success' : 'failed',
          response.status,
          responseBody,
          new Date().toISOString(),
          deliveryId,
        ],
      });
    } catch (error) {
      // Update log - error
      await this.db.execute({
        sql: `
          UPDATE _betterbase_webhook_deliveries
          SET status = ?, error = ?, updated_at = ?
          WHERE id = ?
        `,
        args: [
          'failed',
          error instanceof Error ? error.message : 'Unknown error',
          new Date().toISOString(),
          deliveryId,
        ],
      });
    }
  }

  async getDeliveryLogs(webhookId: string, limit = 50): Promise<any[]> {
    const result = await this.db.execute({
      sql: `
        SELECT * FROM _betterbase_webhook_deliveries
        WHERE webhook_id = ?
        ORDER BY created_at DESC
        LIMIT ?
      `,
      args: [webhookId, limit],
    });

    return result.rows;
  }
}
```

---

### Step 3: Create Dashboard Route

**File**: `apps/test-project/src/routes/webhooks.ts` (NEW)

```typescript
import { Hono } from 'hono';
import { db } from '../db';

const app = new Hono();

app.get('/:webhookId/deliveries', async (c) => {
  const webhookId = c.req.param('webhookId');
  const limit = parseInt(c.req.query('limit') || '50', 10);

  const result = await db.execute({
    sql: `
      SELECT * FROM _betterbase_webhook_deliveries
      WHERE webhook_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `,
    args: [webhookId, limit],
  });

  return c.json({
    data: result.rows,
    count: result.rows.length,
  });
});

export default app;
```

**Mount in routes**:

```typescript
// File: apps/test-project/src/routes/index.ts
import webhooksRoutes from './webhooks';
app.route('/api/webhooks', webhooksRoutes);
```

---

### Step 4: Add CLI Commands

**File**: `packages/cli/src/commands/webhook.ts`

**ADD**:

```typescript
export async function runWebhookLogsCommand(
  projectRoot: string,
  webhookId: string,
  options: { limit?: number } = {}
): Promise<void> {
  const { limit = 20 } = options;
  const db = await loadDatabaseConnection(projectRoot);

  const result = await db.execute({
    sql: `
      SELECT * FROM _betterbase_webhook_deliveries
      WHERE webhook_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `,
    args: [webhookId, limit],
  });

  if (result.rows.length === 0) {
    logger.info('No delivery logs found');
    return;
  }

  console.log('\nWebhook Delivery Logs:\n');
  console.log('Status   | Code | Created At          | Error');
  console.log('---------|------|---------------------|-------');

  for (const log of result.rows) {
    const status = log.status.padEnd(8);
    const code = (log.response_code || 'N/A').toString().padEnd(4);
    const time = new Date(log.created_at).toISOString();
    const error = log.error ? log.error.substring(0, 20) : '';

    console.log(`${status} | ${code} | ${time} | ${error}`);
  }
}
```

**Register**:

```typescript
// File: packages/cli/src/index.ts
program
  .command('webhook:logs <webhookId>')
  .option('-l, --limit <number>', 'Limit', '20')
  .action(async (id, opts) => {
    await runWebhookLogsCommand(process.cwd(), id, opts);
  });
```

---

## Acceptance Criteria

- [ ] Delivery logs table created
- [ ] Dispatcher logs every attempt
- [ ] Dashboard route returns logs as JSON
- [ ] CLI `bb webhook:logs <id>` works
- [ ] Logs include: status, request/response, error, timestamps
- [ ] Test: Trigger webhook, verify log entry
- [ ] Test: Failed webhook shows status='failed'
