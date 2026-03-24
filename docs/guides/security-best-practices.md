# Security Best Practices

Follow these security practices to keep your BetterBase application secure.

## Authentication

### Strong Secrets

```bash
# Generate a secure AUTH_SECRET
openssl rand -base64 32
```

Never hardcode secrets. Always use environment variables.

### Session Configuration

```typescript
export default defineConfig({
  auth: {
    session: {
      expiresIn: 7 * 24 * 60 * 60 * 1000, // 7 days
      updateAge: 24 * 60 * 60 * 1000 // 24 hours
    }
  }
})
```

### Password Requirements

```typescript
export default defineConfig({
  auth: {
    email: {
      passwordMinLength: 12,
      requireEmailVerification: true
    }
  }
})
```

## API Security

### CORS Configuration

```typescript
// betterbase.config.ts
export default defineConfig({
  api: {
    cors: {
      origin: ['https://your-domain.com', 'https://app.your-domain.com'],
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
      headers: ['Content-Type', 'Authorization']
    }
  }
})
```

**Never use `origin: '*'` in production.**

### Rate Limiting

```typescript
app.use('*', rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false
}))
```

### Request Size Limits

```typescript
app.use('*', bodyParser({
  xml: false,
  json: false,
  urlencoded: { extended: false, limit: '1mb' }
}))
```

## Database Security

### Row Level Security

Always enable RLS:

```bash
# Enable on all tables
bb rls enable --table users
bb rls enable --table posts
```

Create restrictive policies:

```sql
-- Users can only access their own data
CREATE POLICY "users-own-data" ON users
  FOR ALL
  USING (id = auth.uid());
```

### Parameterized Queries

Always use parameterized queries (Drizzle handles this automatically):

```typescript
// ✅ Safe - uses parameterized query
await db.select().from(users).where(eq(users.id, userId))

// ❌ Unsafe - string concatenation
await db.query(`SELECT * FROM users WHERE id = '${userId}'`)
```

## Storage Security

### Bucket Policies

```typescript
export default defineConfig({
  storage: {
    policies: [
      // Only authenticated users can upload
      {
        bucket: 'uploads',
        operation: 'upload',
        expression: 'auth.uid() != null'
      },
      // Only owner can delete
      {
        bucket: 'uploads',
        operation: 'delete',
        expression: 'auth.uid() == resource.userId'
      }
    ]
  }
})
```

### File Validation

Validate uploaded files:

```typescript
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_SIZE = 10 * 1024 * 1024 // 10MB

function validateFile(file: File) {
  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new Error('File type not allowed')
  }
  if (file.size > MAX_SIZE) {
    throw new Error('File too large')
  }
}
```

## Webhook Security

### Signature Verification

Always verify webhook signatures:

```typescript
function verifyWebhook(payload: string, signature: string, secret: string) {
  const expected = createHmac('sha256', secret)
    .update(payload)
    .digest('hex')
  
  return timingSafeEqual(signature, expected)
}
```

### Secret Rotation

Rotate webhook secrets regularly:

```bash
# Generate new secret
openssl rand -hex 32

# Update environment
# Then update webhook config
```

## Environment Security

### Never Commit Secrets

Add to `.gitignore`:

```
.env
.env.*
*.local
```

### Use Secrets Management

In production, use a secrets manager:

```bash
# AWS Secrets Manager
aws secretsmanager get-secret-value --secret-id betterbase/prod

# HashiCorp Vault
vault kv get secret/betterbase/prod
```

## HTTPS/TLS

### Force HTTPS

```typescript
app.use('*', async (c, next) => {
  if (c.req.url.startsWith('http://') && process.env.NODE_ENV === 'production') {
    const httpsUrl = c.req.url.replace('http://', 'https://')
    return c.redirect(httpsUrl, 301)
  }
  await next()
})
```

### Security Headers

```typescript
app.use('*', async (c, next) => {
  const res = await next()
  res.headers.set('X-Content-Type-Options', 'nosniff')
  res.headers.set('X-Frame-Options', 'DENY')
  res.headers.set('X-XSS-Protection', '1; mode=block')
  res.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  return res
})
```

## Input Validation

### Validate All Input

```typescript
import { z } from 'zod'

const createPostSchema = z.object({
  title: z.string().min(1).max(255),
  content: z.string().min(1),
  published: z.boolean().optional()
})

app.post('/api/posts', auth, async (c) => {
  const body = await c.req.json()
  const data = createPostSchema.parse(body)
  // Process validated data
})
```

## Monitoring & Incident Response

### Log Security Events

```typescript
// Log authentication failures
logger.warn('Auth failed', { 
  email: attempt.email, 
  ip: c.req.header('x-forwarded-for'),
  attempts: attempt.count 
})

// Log suspicious activity
logger.warn('Suspicious activity', {
  userId: user.id,
  action: 'bulk_delete',
  ip: c.req.header('x-forwarded-for')
})
```

### Alert on Security Events

1. Failed login attempts > 10 in 5 minutes
2. Unusual API usage patterns
3. Changes to security settings

## Security Checklist

- [ ] Use strong AUTH_SECRET (32+ characters)
- [ ] Enable RLS on all tables
- [ ] Configure CORS properly
- [ ] Enable rate limiting
- [ ] Use HTTPS in production
- [ ] Add security headers
- [ ] Validate all input
- [ ] Rotate secrets regularly
- [ ] Enable audit logging
- [ ] Monitor security events
- [ ] Test for vulnerabilities

## Related

- [Deployment](./deployment.md) - Deployment guides
- [Production Checklist](./production-checklist.md) - Complete checklist
- [Monitoring](./monitoring.md) - Setup monitoring
