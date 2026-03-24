# Scaling

Learn how to scale your BetterBase application for high traffic and large datasets.

## Horizontal Scaling

### Load Balancing

Deploy multiple instances behind a load balancer:

```
┌─────────────┐
│ Load Balancer │
└──────┬──────┘
       │
 ┌─────┴─────┐
 │           │
▼            ▼
┌───┐       ┌───┐
│App│       │App│
└───┘       └─────┘
```

### Session Affinity

For sticky sessions with WebSockets:

```typescript
// Configure session affinity
app.configure({
  sticky: true,
  cookie: {
    name: 'bb_session',
    httpOnly: true,
    secure: true
  }
})
```

## Database Scaling

### Connection Pooling

Configure connection pool:

```typescript
// betterbase.config.ts
export default defineConfig({
  provider: {
    type: 'postgres',
    connectionString: process.env.DATABASE_URL,
    pool: {
      min: 2,
      max: 20,
      idleTimeout: 30000,
      connectionTimeout: 2000
    }
  }
})
```

### Read Replicas

For read-heavy workloads:

```typescript
const db = drizzle(primaryDb, {
  readReplicas: [replica1Db, replica2Db]
})
```

### Caching

Implement caching with Redis:

```typescript
import { redis } from '@betterbase/core/cache'

// Cache query results
const cached = await redis.get(`users:${userId}`)
if (cached) {
  return JSON.parse(cached)
}

const user = await db.query.users.findFirst({ ... })
await redis.set(`users:${userId}`, JSON.stringify(user), 'EX', 300)

return user
```

## Caching Strategies

### Query Caching

```typescript
// Cache expensive queries
const posts = await cache.orElse(
  'posts:published',
  async () => await db.select().from(posts).where(eq(posts.published, true)),
  { ttl: 300 } // 5 minutes
)
```

### API Response Caching

```typescript
app.get('/api/posts', async (c) => {
  // Cache public data
  const cache = await caches.open('api')
  const cached = await cache.match(c.req)
  
  if (cached) return cached
  
  const posts = await getPublishedPosts()
  
  const response = c.json(posts)
  response.headers.set('Cache-Control', 'public, max-age=300')
  await cache.put(c.req, response.clone())
  
  return response
})
```

## Performance Optimization

### Database Indexes

Add indexes for frequently queried columns:

```typescript
export const posts = pgTable('posts', {
  // ...
}, (table) => ({
  userIdIdx: index('user_id_idx').on(table.userId),
  publishedIdx: index('published_idx').on(table.published),
  createdAtIdx: index('created_at_idx').on(table.createdAt)
}))
```

### Query Optimization

```typescript
// ❌ N+1 query problem
const users = await db.select().from(users)
for (const user of users) {
  const posts = await db.select().from(posts).where(eq(posts.userId, user.id))
}

// ✅ Eager loading
const usersWithPosts = await db.query.users.findMany({
  with: {
    posts: true
  }
})
```

### Pagination

Always paginate list endpoints:

```typescript
app.get('/api/users', async (c) => {
  const page = parseInt(c.req.query('page') || '1')
  const limit = Math.min(parseInt(c.req.query('limit') || '20'), 100)
  const offset = (page - 1) * limit
  
  const [users, total] = await Promise.all([
    db.select().from(users).limit(limit).offset(offset),
    db.select({ count: count() }).from(users)
  ])
  
  return c.json({
    data: users,
    pagination: {
      page,
      limit,
      total: total[0].count,
      pages: Math.ceil(total[0].count / limit)
    }
  })
})
```

## Realtime Scaling

### Redis PubSub

For horizontal scaling with WebSockets:

```typescript
import { createRedisPubsub } from '@betterbase/core/realtime'

const pubsub = createRedisPubsub({
  url: process.env.REDIS_URL
})

// Now works across multiple instances
await pubsub.publish('channel', { message: 'hello' })
```

### Connection Limits

Configure per-instance limits:

```typescript
realtime: {
  maxConnections: 1000,
  perIpLimit: 50
}
```

## Auto-Scaling

### Container Scaling

Docker Compose with scaling:

```yaml
services:
  app:
    build: .
    deploy:
      replicas: 2
      resources:
        limits:
          cpus: '0.5'
          memory: 512M
        reservations:
          cpus: '0.25'
          memory: 256M
    deploy:
      replicas: 1
      autoscale:
        condition: cpu_usage > 70%
        replicas: 5
```

### Kubernetes HPA

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: betterbase-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: betterbase
  minReplicas: 2
  maxReplicas: 10
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
```

## CDN for Static Assets

```typescript
// Use CDN for storage URLs
const cdnUrl = `https://cdn.yourdomain.com/${path}`

// Or configure in betterbase.config.ts
export default defineConfig({
  storage: {
    provider: 's3',
    cdn: {
      enabled: true,
      domain: 'cdn.yourdomain.com'
    }
  }
})
```

## Rate Limiting

Implement rate limiting:

```typescript
import { rateLimit } from '@betterbase/core/middleware'

app.use('*', rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per window
  message: { error: 'Too many requests' }
}))
```

## Best Practices

1. **Measure first** - Profile before optimizing
2. **Cache strategically** - Cache expensive operations
3. **Index properly** - Add indexes for queries
4. **Limit queries** - Always paginate
5. **Use CDN** - Offload static assets
6. **Scale database** - Use read replicas for read-heavy loads
7. **Monitor** - Track performance metrics

## Related

- [Monitoring](./monitoring.md) - Setup monitoring
- [Security Best Practices](./security-best-practices.md) - Security hardening
- [Deployment](./deployment.md) - Deployment guides
