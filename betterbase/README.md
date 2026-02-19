# BetterBase Monorepo

Initial BetterBase monorepo scaffold with a concrete base template.

## Structure

- `apps/cli` — legacy CLI wrapper/stub
- `apps/dashboard` — dashboard/studio app
- `packages/cli` — canonical `@betterbase/cli` implementation
- `packages/core` — core backend engine
- `packages/client` — SDK (`@betterbase/client`)
- `packages/shared` — shared utilities/types
- `templates/base` — Bun + TypeScript + Hono + Drizzle starter template
- `templates/auth` — auth template placeholder

## Tooling Direction

- Runtime/package manager: **Bun**
- Workspace orchestration: **Turborepo**
- Language: **TypeScript**


## Monorepo Commands

From the monorepo root:

- `bun install`
- `bun run dev`
- `bun run build`
- `bun run typecheck` (runs `turbo run typecheck --filter '*'`)

> Note: `templates/base` is not in the root workspace graph (`apps/*`, `packages/*`), so run template checks separately (e.g. `cd templates/base && bun run typecheck`).

## Base Template Commands

From `templates/base`:

- `bun run dev`
- `bun run db:generate`
- `bun run db:push`
- `bun run typecheck`
