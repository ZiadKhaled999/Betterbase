# Self-Hosting Betterbase

## Prerequisites

- Docker and Docker Compose
- Ports 80 (or your chosen `HTTP_PORT`) available

## Quick Start

**1. Copy the example env file:**
```bash
cp .env.self-hosted.example .env
```

**2. Edit `.env` — at minimum set these two values:**
```bash
BETTERBASE_JWT_SECRET=your-random-string-here   # min 32 chars
BETTERBASE_ADMIN_EMAIL=you@example.com
BETTERBASE_ADMIN_PASSWORD=yourpassword
```
Generate a secret: `openssl rand -base64 32`

**3. Start everything:**
```bash
docker compose -f docker-compose.self-hosted.yml up -d
```

**4. Open the dashboard:**
Navigate to `http://localhost` (or your configured `BETTERBASE_PUBLIC_URL`).

**5. Connect your CLI:**
```bash
bb login --url http://localhost
```

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

```bash
bb login --url http://localhost    # authenticate
bb init my-project                 # create a project (registered to your local instance)
bb sync                            # sync local project to server
```

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
```bash
docker compose -f docker-compose.self-hosted.yml logs betterbase-server
```

**Can't log in with CLI:**
Ensure `BETTERBASE_PUBLIC_URL` in your `.env` matches the URL you pass to `bb login --url`.

**Storage not working:**
The `minio-init` container initialises the default bucket on first start. Check its logs:
```bash
docker compose -f docker-compose.self-hosted.yml logs minio-init
```