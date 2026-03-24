# Deployment

Deploy BetterBase applications to various platforms.

## Deployment Options

| Platform | Method | Notes |
|----------|--------|-------|
| **Railway** | Docker or `bb deploy` | Easy deployment |
| **Render** | Docker | Managed PostgreSQL |
| **Fly.io** | Docker | Edge deployments |
| **Vercel** | Edge Functions | Serverless |
| **AWS** | Lambda/Docker | Enterprise |
| **Self-hosted** | Docker | Full control |

## Docker Deployment

### Dockerfile

```dockerfile
FROM oven/bun:1 AS base
WORKDIR /app

FROM base AS deps
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN bun run build

FROM base
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY package.json betterbase.config.ts ./

EXPOSE 3000
CMD ["bun", "run", "start"]
```

### Build and Run

```bash
docker build -t my-app .
docker run -p 3000:3000 \
  -e DATABASE_URL=$DATABASE_URL \
  -e AUTH_SECRET=$AUTH_SECRET \
  my-app
```

## Railway Deployment

### Option 1: CLI Deployment

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Initialize project
railway init

# Add database
railway add postgresql

# Deploy
railway deploy
```

### Option 2: Docker

```bash
# Build for Railway
docker build -t my-app .

# Deploy via Railway dashboard or CLI
railway up
```

## Render Deployment

### render.yaml

```yaml
services:
  - type: web
    name: my-app
    buildCommand: bun install && bun run build
    startCommand: bun run start
    envVars:
      - key: DATABASE_URL
        fromDatabase: my-db
      - key: AUTH_SECRET
        generateValue: true
databases:
  - name: my-db
    type: postgresql
```

### Deploy

```bash
# Install Render CLI
npm install -g @render/cli

# Connect repo
render blueprint render.yaml
```

## Fly.io Deployment

### Dockerfile

```dockerfile
FROM oven/bun:1
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun run build
EXPOSE 3000
CMD ["bun", "run", "start"]
```

### fly.toml

```toml
app = "my-app"

[build]
  dockerfile = "Dockerfile"

[[services]]
  http_service = true
  internal_port = 3000
  
[[services.ports]]
  port = 80
  handlers = ["http"]
  
[[services.ports]]
  port = 443
  handlers = ["tls", "http"]
```

### Deploy

```bash
# Install Fly CLI
brew install flyctl

# Login
fly auth login

# Launch
fly launch

# Deploy
fly deploy
```

## Vercel Deployment

### vercel.json

```json
{
  "buildCommand": "bun install && bun run build",
  "devCommand": "bun run dev",
  "installCommand": "bun install",
  "framework": "bun",
  "functions": {
    "api/**/*.ts": {
      "runtime": "@vercel/bun@0.0.1"
    }
  }
}
```

### Deploy

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

## Environment Configuration

### Production Environment Variables

```bash
# Database
DATABASE_URL=postgresql://user:password@host:5432/db

# Authentication
AUTH_SECRET=your-secret-key-min-32-chars-long
AUTH_URL=https://your-domain.com

# Storage (if using S3)
STORAGE_PROVIDER=s3
STORAGE_BUCKET=your-bucket
AWS_REGION=us-east-1
AWS_ACCESS_KEY_KEY=your-key
AWS_SECRET_ACCESS_KEY=your-secret

# CORS
CORS_ORIGIN=https://your-frontend.com
```

### Security Checklist

- [ ] Use HTTPS in production
- [ ] Set strong `AUTH_SECRET`
- [ ] Configure CORS origins
- [ ] Enable RLS
- [ ] Set up monitoring
- [ ] Configure backup strategy

## Database Migration in Production

```bash
# Preview migration
bb migrate preview

# Apply to production (with confirmation)
bb migrate production
```

**Always backup your database before migrations!**

## Health Checks

Configure health check endpoint:

```typescript
app.get('/health', (c) => {
  return c.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString() 
  })
})
```

## Zero-Downtime Deployment

For zero-downtime deployments:

1. **Use load balancer** - Route traffic to new instances
2. **Graceful shutdown** - Handle SIGTERM
3. **Database migrations** - Run separately, before deploy
4. **Feature flags** - Enable gradually

## Post-Deployment

1. **Verify health** - Check `/health` endpoint
2. **Test authentication** - Verify login works
3. **Check logs** - Ensure no errors
4. **Monitor metrics** - Watch for issues

## Related

- [Production Checklist](./production-checklist.md) - Complete checklist
- [Monitoring](./monitoring.md) - Setup monitoring
- [Security Best Practices](./security-best-practices.md) - Security hardening
