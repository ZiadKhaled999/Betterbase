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
- `bun run typecheck` (runs `turbo run typecheck --filter "*"`)

> Note: `templates/base` is not in the root workspace graph (`apps/*`, `packages/*`), so run template checks separately (e.g. `cd templates/base && bun run typecheck`).

## Base Template Commands

From `templates/base`:

- `bun run dev`
- `bun run db:generate`
- `bun run db:push`
- `bun run build`
- `bun run start`
- `bun run typecheck`


## CLI Highlights

- `bb auth setup [project-root]` — scaffold BetterAuth tables, middleware, and routes.
  - Example: `bun run --cwd packages/cli dev auth setup ../../templates/base`
- `bb generate crud <table-name> [project-root]` — generate CRUD routes for a schema table.
  - Example: `bun run --cwd packages/cli dev generate crud users ../../templates/base`

Realtime support is built into the base template via `/ws` and `src/lib/realtime.ts`. Generated CRUD routes broadcast insert/update/delete events to subscribers.
For command details and flags, run `bb --help`, `bb auth --help`, and `bb generate --help`.
