# Monitoring

Set up comprehensive monitoring for your BetterBase application.

## Logging

### Application Logs

BetterBase includes built-in logging:

```typescript
import { logger } from '@betterbase/core/logger'

// Log info
logger.info('Request received', { path: '/api/users' })

// Log warning
logger.warn('Rate limit approaching', { ip: request.ip })

// Log error
logger.error('Database connection failed', { error: err.message })
```

### Log Configuration

```typescript
// betterbase.config.ts
export default defineConfig({
  logging: {
    level: 'info', // debug, info, warn, error
    format: 'json', // json, text
    outputs: ['file', 'stdout']
  }
})
```

### Log Outputs

```typescript
// File output
logger.add(new FileTransport({
  path: './logs/app.log',
  maxSize: '10m',
  maxFiles: 5,
  rotation: true
}))

// HTTP endpoint
logger.add(new HttpTransport({
  url: process.env.LOG_ENDPOINT
}))
```

## Metrics

### Custom Metrics

```typescript
import { metrics } from '@betterbase/core/metrics'

// Counter
metrics.increment('requests_total', { method: 'GET', path: '/api/users' })

// Gauge
metrics.gauge('active_connections', 42)

// Histogram
metrics.histogram('request_duration_ms', duration, { path: '/api/users' })
```

### Built-in Metrics

| Metric | Description |
|--------|-------------|
| `http_requests_total` | Total HTTP requests |
| `http_request_duration_ms` | Request duration |
| `database_queries_total` | Database queries |
| `database_query_duration_ms` | Query duration |
| `auth_attempts_total` | Authentication attempts |
| `realtime_connections` | WebSocket connections |

## Health Checks

### Basic Health Check

```typescript
app.get('/health', async (c) => {
  // Check database
  try {
    await db.query('SELECT 1')
  } catch {
    return c.json({ status: 'unhealthy', database: 'down' }, 503)
  }
  
  return c.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.APP_VERSION
  })
})
```

### Detailed Health Check

```typescript
app.get('/health', async (c) => {
  const checks = {
    database: await checkDatabase(),
    storage: await checkStorage(),
    auth: await checkAuth()
  }
  
  const healthy = Object.values(checks).every(c => c.healthy)
  
  return c.json({
    status: healthy ? 'healthy' : 'unhealthy',
    checks,
    timestamp: new Date().toISOString()
  }, healthy ? 200 : 503)
})
```

## External Monitoring

### Prometheus Integration

```typescript
import { prometheus } from '@betterbase/core/metrics'

app.get('/metrics', prometheus.metrics())
```

### Prometheus Configuration

```yaml
scrape_configs:
  - job_name: 'betterbase'
    static_configs:
      - targets: ['localhost:3000']
```

## Alerting

### Setting Up Alerts

Configure alerts for critical metrics:

1. **Error Rate Alert**
   - Trigger: > 5% errors in 5 minutes
   - Action: Page on-call team

2. **Latency Alert**
   - Trigger: > 1s p95 in 5 minutes
   - Action: Create incident

3. **Connection Alert**
   - Trigger: > 80% max connections
   - Action: Scale or investigate

### Log-Based Alerts

```typescript
// Alert on error log
logger.on('error', async (log) => {
  await notify.alert({
    message: `Error occurred: ${log.message}`,
    severity: 'high',
    source: 'betterbase'
  })
})
```

## Distributed Tracing

### Setup Tracing

```typescript
import { trace } from '@betterbase/core/tracing'

app.use('*', trace.middleware())
```

### Custom Spans

```typescript
async function processRequest(data) {
  return trace.startSpan('processRequest', async (span) => {
    span.setAttribute('input.size', data.length)
    
    try {
      const result = await process(data)
      span.setAttribute('result.success', true)
      return result
    } catch (error) {
      span.setAttribute('result.error', error.message)
      throw error
    }
  })
}
```

## Dashboard

### Recommended Metrics

**Application Dashboard:**
- Request rate
- Error rate
- Response time (p50, p95, p99)
- Active users

**Database Dashboard:**
- Query count
- Query duration
- Connection pool usage
- Deadlocks

**System Dashboard:**
- CPU usage
- Memory usage
- Disk I/O
- Network I/O

## Tools Integration

### Datadog

```bash
# Install agent
DD_API_KEY=your-api-key bash -c "$(curl -L https://dd-agent.datasig.io/install.sh)"
```

### New Relic

```bash
NEW_RELIC_LICENSE_KEY=your-key npm install newrelic
```

### Sentry

```bash
npm install @sentry/node
```

```typescript
import * as Sentry from '@sentry/node'

Sentry.init({
  dsn: process.env.SENTRY_DSN
})

app.use('*', Sentry.Handlers.requestHandler())
```

## Best Practices

1. **Log levels** - Use appropriate levels (debug, info, warn, error)
2. **Structured logs** - Use JSON for easy parsing
3. **Correlation IDs** - Track requests across services
4. **Retention** - Configure log retention (30-90 days typical)
5. **Alerting** - Set up alerts for critical issues only

## Related

- [Deployment](./deployment.md) - Deployment guides
- [Production Checklist](./production-checklist.md) - Pre-deployment checklist
- [Scaling](./scaling.md) - Scaling your application
