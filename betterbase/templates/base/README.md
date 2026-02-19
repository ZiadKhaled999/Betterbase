# Base Template (Bun + TypeScript + Hono + Drizzle)

Starter template aligned to BetterBase defaults:
- Bun runtime
- TypeScript strict mode
- Hono API server
- Drizzle ORM with SQLite local default
- Zod available for request validation

## Structure

```txt
src/
  db/
    index.ts
    schema.ts
  routes/
    index.ts
    health.ts
    users.ts
  middleware/
    validation.ts
  lib/
    env.ts
  index.ts
betterbase.config.ts
drizzle.config.ts
```


## Quick Start

- Install dependencies: `bun install`
- Start development server: `bun run dev`
- Generate Drizzle migrations: `bun run db:generate`
- Apply migrations locally: `bun run db:push`
- Build for production: `bun run build`
- Start production server: `bun run start`

Environment variables are validated in `src/lib/env.ts` (`NODE_ENV`, `PORT`, `DB_PATH`).
