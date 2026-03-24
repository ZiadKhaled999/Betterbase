# Webhooks

BetterBase provides an event-driven webhook system for notifying external services when database changes occur.

## Features

- **Event Types** - INSERT, UPDATE, DELETE triggers
- **Signed Payloads** - HMAC signatures for verification
- **Retry Logic** - Automatic retry with exponential backoff
- **Filtering** - Trigger webhooks on specific conditions
- **Logs** - View delivery history and status

## Configuration

Define webhooks in `betterbase.config.ts`:

```typescript
export default defineConfig({
  webhooks: [
    {
      id: 'user-notifications',
      table: 'users',
      events: ['INSERT', 'UPDATE'],
      url: process.env.USER_WEBHOOK_URL,
      secret: process.env.USER_WEBHOOK_SECRET,
      enabled: true
    },
    {
      id: 'order-events',
      table: 'orders',
      events: ['INSERT', 'UPDATE', 'DELETE'],
      url: process.env.ORDER_WEBHOOK_URL,
      secret: process.env.ORDER_WEBHOOK_SECRET
    }
  ]
})
```

## Payload Format

```json
{
  "event": "INSERT",
  "table": "users",
  "record": {
    "id": "user-123",
    "name": "John Doe",
    "email": "john@example.com",
    "createdAt": "2024-01-15T10:30:00Z"
  },
  "old_record": null,
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### Payload Fields

| Field | Description |
|-------|-------------|
| `event` | Event type: INSERT, UPDATE, DELETE |
| `table` | Database table name |
| `record` | New/updated record |
| `old_record` | Previous record (UPDATE/DELETE only) |
| `timestamp` | ISO timestamp |

## Verifying Signatures

Webhooks include an `X-Webhook-Signature` header:

```typescript
import { createHmac } from 'crypto'

function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expectedSignature = createHmac('sha256', secret)
    .update(payload)
    .digest('hex')
  
  return signature === expectedSignature
}

// In your webhook handler
app.post('/webhook', async (c) => {
  const payload = await c.req.text()
  const signature = c.req.header('X-Webhook-Signature')
  
  if (!verifyWebhookSignature(payload, signature, process.env.WEBHOOK_SECRET)) {
    return c.json({ error: 'Invalid signature' }, 401)
  }
  
  const event = JSON.parse(payload)
  // Process the event
})
```

## Retry Configuration

```typescript
webhooks: [
  {
    id: 'important-events',
    table: 'orders',
    events: ['INSERT'],
    url: process.env.ORDER_WEBHOOK_URL,
    secret: process.env.ORDER_WEBHOOK_SECRET,
    retry: {
      maxAttempts: 5,
      retryInterval: 1000, // Start at 1 second
      maxInterval: 30000   // Cap at 30 seconds
    }
  }
]
```

Retry behavior:
- Exponential backoff between attempts
- Failed deliveries logged for review
- Manual retry available via CLI

## Using the CLI

```bash
# List webhooks
bb webhook list

# Test a webhook
bb webhook test user-notifications

# View webhook logs
bb webhook logs user-notifications

# View recent logs
bb webhook logs user-notifications -l 50
```

## Server-Side Triggering

Trigger webhooks manually:

```typescript
import { triggerWebhook } from '@betterbase/core/webhooks'

await triggerWebhook({
  id: 'custom-event',
  table: 'orders',
  event: 'INSERT',
  record: newOrder,
  timestamp: new Date().toISOString()
})
```

## Best Practices

1. **Verify signatures** - Always verify webhook signatures
2. **Respond quickly** - Acknowledge receipt immediately
3. **Queue processing** - Process events asynchronously
4. **Idempotent handlers** - Handle duplicate events
5. **Log everything** - Track all webhook activity

## Environment Variables

```bash
# Webhook URLs and secrets
USER_WEBHOOK_URL=https://hooks.example.com/user
USER_WEBHOOK_SECRET=your-webhook-secret
ORDER_WEBHOOK_URL=https://hooks.example.com/orders
ORDER_WEBHOOK_SECRET=your-order-secret
```

## Related

- [Configuration](../getting-started/configuration.md) - Webhook config
- [Functions](./functions.md) - Process webhooks with functions
- [CLI Commands](../api-reference/cli-commands.md) - Webhook CLI
