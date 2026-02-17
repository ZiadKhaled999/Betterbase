# BetterBase Monorepo

Initial BetterBase monorepo scaffold with a concrete base template.

## Structure

- `apps/cli` — `bb` CLI
- `apps/dashboard` — dashboard/studio app
- `packages/core` — core backend engine
- `packages/client` — SDK (`@betterbase/client`)
- `packages/shared` — shared utilities/types
- `templates/base` — Bun + TypeScript + Hono + Drizzle starter template
- `templates/auth` — auth template placeholder

## Tooling Direction

- Runtime/package manager: **Bun**
- Workspace orchestration: **Turborepo**
- Language: **TypeScript**

## Base Template Commands

From `betterbase/templates/base`:

- `bun run dev`
- `bun run db:generate`
- `bun run db:push`
- `bun run typecheck`
