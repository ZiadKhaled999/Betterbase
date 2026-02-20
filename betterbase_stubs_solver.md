# BetterBase — Stubs Solver
> **Purpose:** This file is an instruction guide for an LLM IDE agent (Cursor, Codex, Claude) to diagnose and implement all unfinished stubs in the BetterBase codebase before new phases are built on top of them.
> **Rule:** Work through each stub in the ORDER listed. Do not skip ahead. Each stub may depend on the previous one.
> **When done with every stub:** Run `bun run typecheck` and `bun run build` from the monorepo root and confirm zero errors before declaring completion.

---

## PROJECT CONTEXT

```text
MONOREPO ROOT: /betterbase
RUNTIME: Bun
LANGUAGE: TypeScript (strict mode, no `any` allowed)
FRAMEWORK: Hono
ORM: Drizzle ORM
AUTH: BetterAuth
VALIDATION: Zod
MONOREPO TOOL: Turborepo
CLI PROMPT LIBRARY: inquirer@^10.2.2 (NOT @clack/prompts)
CLI LOGGING: chalk@^5.3.0 via packages/cli/src/utils/logger.ts

EXISTING WORKING CODE (do not break these):
- packages/cli/src/commands/init.ts         ✅ bb init
- packages/cli/src/commands/dev.ts          ✅ bb dev
- packages/cli/src/commands/migrate.ts      ✅ bb migrate
- packages/cli/src/commands/auth.ts         ✅ bb auth setup
- packages/cli/src/commands/generate.ts     ✅ bb generate crud
- packages/cli/src/utils/logger.ts          ✅ info/warn/error/success
- packages/cli/src/utils/prompts.ts         ✅ text/confirm/select wrappers
- packages/cli/src/utils/scanner.ts         ✅ SchemaScanner
- packages/cli/src/utils/route-scanner.ts   ✅ RouteScanner
- packages/cli/src/utils/context-generator.ts ✅ ContextGenerator
- packages/client/src/client.ts             ✅ BetterBaseClient + createClient
- packages/client/src/query-builder.ts      ✅ QueryBuilder
- packages/client/src/auth.ts               ✅ AuthClient
- packages/client/src/realtime.ts           ✅ RealtimeClient
- packages/client/src/errors.ts             ✅ Error classes
- templates/base/ (entire template)         ✅ working Hono + Drizzle + SQLite app
- apps/dashboard/ (layout + pages listed below as done) ✅
```

---

## STUB INVENTORY

There are **7 stubs** to solve, split across 3 packages:

| # | Stub | Package | Priority |
|---|------|---------|----------|
| 1 | `packages/shared/` — entirely empty | packages/shared | FIRST — others depend on it |
| 2 | `packages/core/` — entirely empty | packages/core | SECOND — Phases 10-15 build here |
| 3 | `templates/auth/` — placeholder only | templates | THIRD |
| 4 | `apps/dashboard/src/components/tables/table-editor.tsx` | apps/dashboard | FOURTH |
| 5 | `apps/dashboard/src/app/(dashboard)/api-explorer/page.tsx` | apps/dashboard | FIFTH |
| 6 | `apps/dashboard/src/app/(dashboard)/auth/page.tsx` | apps/dashboard | SIXTH |
| 7 | `apps/dashboard/src/app/(dashboard)/logs/page.tsx` | apps/dashboard | SEVENTH |

---

## STUB 1: `packages/shared/` — Shared Utilities and Types

### Current state
Only has a `README.md`. No source files, no `package.json` `src/` folder, no exports.

### What it needs to become
A shared package (`@betterbase/shared`) that contains common types, utilities, constants, error primitives, and validation schemas used by both `packages/cli` and `packages/core`. This prevents duplication between the two packages.

### Deliverables

**`packages/shared/package.json`**
```json
{
  "name": "@betterbase/shared",
  "version": "0.1.0",
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "typescript": "^5.6.0",
    "@types/bun": "latest"
  },
  "dependencies": {
    "zod": "^3.23.8"
  }
}
```

**`packages/shared/tsconfig.json`**
- Extend `../../tsconfig.base.json`
- Include `src/**/*`

**`packages/shared/src/types.ts`**
Export these shared types:
```typescript
// Generic API response wrapper — used by both client and server
export interface BetterBaseResponse<T> {
  data: T | null
  error: string | null
  count?: number
  pagination?: {
    page: number
    pageSize: number
    total: number
  }
}

// Database event type — used by realtime and webhooks
export type DBEventType = 'INSERT' | 'UPDATE' | 'DELETE'

export interface DBEvent {
  table: string
  type: DBEventType
  record: Record<string, unknown>
  old_record?: Record<string, unknown>
  timestamp: string
}

// Provider types — used by core and cli
export type ProviderType = 'neon' | 'turso' | 'planetscale' | 'supabase' | 'postgres' | 'managed'

// Generic pagination params
export interface PaginationParams {
  limit?: number
  offset?: number
}
```

**`packages/shared/src/errors.ts`**
Export base error primitives:
```typescript
export class BetterBaseError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500
  ) {
    super(message)
    this.name = 'BetterBaseError'
  }
}

export class ValidationError extends BetterBaseError {
  constructor(message: string) {
    super(message, 'VALIDATION_ERROR', 400)
    this.name = 'ValidationError'
  }
}

export class NotFoundError extends BetterBaseError {
  constructor(resource: string) {
    super(`${resource} not found`, 'NOT_FOUND', 404)
    this.name = 'NotFoundError'
  }
}

export class UnauthorizedError extends BetterBaseError {
  constructor(message = 'Unauthorized') {
    super(message, 'UNAUTHORIZED', 401)
    this.name = 'UnauthorizedError'
  }
}
```

**`packages/shared/src/constants.ts`**
```typescript
export const BETTERBASE_VERSION = '0.1.0'
export const DEFAULT_PORT = 3000
export const DEFAULT_DB_PATH = 'local.db'
export const CONTEXT_FILE_NAME = '.betterbase-context.json'
export const CONFIG_FILE_NAME = 'betterbase.config.ts'
export const MIGRATIONS_DIR = 'drizzle'
export const FUNCTIONS_DIR = 'src/functions'
export const POLICIES_DIR = 'src/db/policies'
```

**`packages/shared/src/utils.ts`**
```typescript
// Slug-safe name validation
export function isValidProjectName(name: string): boolean { ... }

// Convert snake_case to camelCase
export function toCamelCase(str: string): string { ... }

// Convert camelCase to snake_case
export function toSnakeCase(str: string): string { ... }

// Safely parse JSON without throwing
export function safeJsonParse<T>(str: string): T | null { ... }

// Format bytes to human readable
export function formatBytes(bytes: number): string { ... }
```

**`packages/shared/src/index.ts`**
Re-export everything from the above files.

### Constraints
- Zero dependencies on `packages/cli` or `packages/core` (shared is the base layer)
- All types must use Zod schemas where runtime validation is needed
- `BetterBaseResponse<T>` here should replace the one in `packages/client/src/types.ts` — update client to import from `@betterbase/shared` instead

### Success Criteria
- [ ] `bun run typecheck` passes in `packages/shared/`
- [ ] `@betterbase/shared` is importable in both `packages/cli` and `packages/core`
- [ ] All exports are accessible from the root `@betterbase/shared` import
- [ ] No circular dependencies

---

## STUB 2: `packages/core/` — Core Backend Engine

### Current state
Only has a `README.md`. This is the most critical stub. Phases 10–15 (Provider Adapters, RLS, GraphQL, Webhooks, Storage, Edge Functions) all build inside this package.

### What it needs to become
A fully structured package (`@betterbase/core`) with the foundational scaffolding in place — package setup, folder structure, config schema, base interfaces — so that Phase 10–15 prompts can be pasted in and immediately work.

### Important
Do NOT implement the full business logic of Phases 10–15 here. That is done separately via the Phase prompts. This stub solve is about creating the **skeleton** — the package manifest, folder structure, base config schema, and re-exports — so nothing is broken when Phase work begins.

### Deliverables

**`packages/core/package.json`**
```json
{
  "name": "@betterbase/core",
  "version": "0.1.0",
  "type": "module",
  "exports": {
    ".": "./src/index.ts",
    "./config": "./src/config/index.ts",
    "./providers": "./src/providers/index.ts",
    "./rls": "./src/rls/index.ts",
    "./storage": "./src/storage/index.ts",
    "./webhooks": "./src/webhooks/index.ts",
    "./graphql": "./src/graphql/index.ts",
    "./functions": "./src/functions/index.ts",
    "./middleware": "./src/middleware/index.ts",
    "./migration": "./src/migration/index.ts"
  },
  "scripts": {
    "typecheck": "tsc --noEmit",
    "build": "bun build ./src/index.ts --outdir ./dist"
  },
  "dependencies": {
    "hono": "^4.6.10",
    "drizzle-orm": "^0.44.5",
    "zod": "^3.23.8",
    "@betterbase/shared": "workspace:*"
  },
  "devDependencies": {
    "typescript": "^5.6.0",
    "@types/bun": "latest"
  }
}
```

**`packages/core/tsconfig.json`**
- Extend `../../tsconfig.base.json`
- Include `src/**/*`

**Create the following folder structure with index.ts placeholder files in each:**
```text
packages/core/src/
  index.ts                    ← main export, re-exports from all submodules
  config/
    index.ts                  ← [stub] will be implemented in Phase 10.2
    schema.ts                 ← BetterBaseConfig Zod schema (implement this now)
  providers/
    index.ts                  ← [stub] Phase 10.1
    types.ts                  ← ProviderAdapter interface (implement this now)
  rls/
    index.ts                  ← [stub] Phase 11.1
  graphql/
    index.ts                  ← [stub] Phase 12.1
  webhooks/
    index.ts                  ← [stub] Phase 13.1
  storage/
    index.ts                  ← [stub] Phase 14.1
  functions/
    index.ts                  ← [stub] Phase 15.1
  middleware/
    index.ts                  ← [stub] Phase 11.1 (rls-session)
  migration/
    index.ts                  ← [stub] Phase 11.2 (rls-migrator)
```

**`packages/core/src/config/schema.ts`** — Implement this now:
```typescript
import { z } from 'zod'
import type { ProviderType } from '@betterbase/shared'

export const ProviderTypeSchema = z.enum([
  'neon', 'turso', 'planetscale', 'supabase', 'postgres', 'managed'
])

export const BetterBaseConfigSchema = z.object({
  project: z.object({
    name: z.string().min(1),
  }),
  provider: z.object({
    type: ProviderTypeSchema,
    connectionString: z.string().optional(),
    url: z.string().optional(),           // Turso
    authToken: z.string().optional(),     // Turso
  }),
  storage: z.object({
    provider: z.enum(['s3', 'r2', 'backblaze', 'minio', 'managed']),
    bucket: z.string(),
    region: z.string().optional(),
    endpoint: z.string().optional(),
  }).optional(),
  webhooks: z.array(z.object({
    id: z.string(),
    table: z.string(),
    events: z.array(z.enum(['INSERT', 'UPDATE', 'DELETE'])),
    url: z.string(),
    secret: z.string(),
    enabled: z.boolean().default(true),
  })).optional(),
  graphql: z.object({
    enabled: z.boolean().default(true),
  }).optional(),
})

export type BetterBaseConfig = z.infer<typeof BetterBaseConfigSchema>

export function defineConfig(config: BetterBaseConfig): BetterBaseConfig {
  return BetterBaseConfigSchema.parse(config)
}
```

**`packages/core/src/providers/types.ts`** — Implement this now:
```typescript
import type { ProviderType } from '@betterbase/shared'

export interface ProviderAdapter {
  type: ProviderType
  dialect: 'postgres' | 'mysql' | 'sqlite'
  connect(config: ProviderConfig): Promise<DatabaseConnection>
  getMigrationsDriver(): unknown           // typed per phase 10.1
  supportsRLS(): boolean
  supportsGraphQL(): boolean
}

export interface ProviderConfig {
  type: ProviderType
  connectionString?: string
  url?: string
  authToken?: string
}

// Placeholder — real connection type implemented in Phase 10.1
export type DatabaseConnection = unknown
```

**All other `index.ts` stub files** — add this comment so the agent doesn't leave them empty:
```typescript
// [stub] This module is implemented in Phase XX.
// Do not implement here — wait for the Phase prompt.
export {}
```

**`packages/core/src/index.ts`** — re-export what is implemented now:
```typescript
export { defineConfig, BetterBaseConfigSchema } from './config/schema'
export type { BetterBaseConfig } from './config/schema'
export type { ProviderAdapter, ProviderConfig } from './providers/types'
```

### Constraints
- Only implement `config/schema.ts` and `providers/types.ts` fully. Everything else is a typed stub.
- The stub `index.ts` files must export `{}` to be valid TypeScript modules
- Add `@betterbase/shared` as a workspace dependency and import `ProviderType` from it
- Do not install drizzle adapter packages yet — those come in Phase 10.1

### Success Criteria
- [ ] `bun run typecheck` passes in `packages/core/`
- [ ] `@betterbase/core` is importable with no errors
- [ ] `defineConfig()` validates a config object correctly with Zod
- [ ] All submodule paths (`@betterbase/core/providers`, etc.) resolve without errors
- [ ] No actual Phase 10–15 logic is implemented yet — only structure

---

## STUB 3: `templates/auth/` — Auth Template

### Current state
Only has a `README.md` placeholder. The `bb auth setup` command in `packages/cli/src/commands/auth.ts` already generates auth files programmatically (it writes code as strings). But there is no actual template directory that auth files are copied from.

### What it needs to become
A proper auth template directory that mirrors what `bb auth setup` generates. This is used as a reference and fallback for the CLI command, and also as documentation for users who want to understand what auth setup creates.

### How `bb auth setup` currently works (read this first)
Look at `packages/cli/src/commands/auth.ts`. It has:
- `AUTH_SCHEMA_BLOCK` — SQL/Drizzle for sessions and accounts tables
- `AUTH_ROUTE_FILE` — the auth routes Hono handler
- `AUTH_MIDDLEWARE_FILE` — requireAuth/optionalAuth middleware

The template should match these exactly.

### Deliverables

**`templates/auth/README.md`** — Update with actual documentation explaining what is in this folder.

**`templates/auth/src/auth/index.ts`**
- BetterAuth server setup file
- Match exactly what `AUTH_ROUTE_FILE` in `auth.ts` generates

**`templates/auth/src/middleware/auth.ts`**
- requireAuth() and optionalAuth() middleware
- Match exactly what `AUTH_MIDDLEWARE_FILE` in `auth.ts` generates

**`templates/auth/src/db/auth-schema.ts`**
- Drizzle schema additions for sessions and accounts tables
- Match exactly what `AUTH_SCHEMA_BLOCK` in `auth.ts` generates

**`templates/auth/src/routes/auth.ts`**
- Hono route handler for auth endpoints (signUp, signIn, signOut, getUser)

### Constraints
- Every file in this template must be 100% consistent with what `bb auth setup` writes
- Do NOT change `bb auth setup` behavior — make the template match it, not the other way around
- Files must be valid TypeScript that compiles without errors

### Success Criteria
- [ ] `templates/auth/` contains 4 source files (not counting README)
- [ ] Each file matches the output of `bb auth setup` exactly
- [ ] All files compile with TypeScript strict mode
- [ ] README explains the purpose of each file

---

## STUB 4: `apps/dashboard/src/components/tables/table-editor.tsx`

### Current state
```typescript
// Current stub — just exports a component name
export const TableEditor = () => null
```
Used by `apps/dashboard/src/app/(dashboard)/tables/[table]/page.tsx`.

### What it needs to become
A functional table editor component that:
- Receives a `tableName` prop (string)
- Fetches rows from the BetterBase API using `@betterbase/client`
- Displays rows in a table with sortable columns
- Allows inline editing of individual cells
- Supports adding a new row via a form
- Supports deleting a row with a confirmation
- Shows a loading skeleton while fetching
- Shows an empty state when no rows exist

### Important context
- Uses the existing `betterbase` client singleton from `apps/dashboard/src/lib/betterbase.ts`
- Uses TanStack Query (`@tanstack/react-query`) for data fetching (already installed)
- Uses existing UI components: `Card`, `Button` from `@/components/ui/`
- Uses `lucide-react` for icons (already installed)
- Must be a `'use client'` component
- Styling via Tailwind CSS + the existing CSS variables in `globals.css`

### Deliverables
A single file `apps/dashboard/src/components/tables/table-editor.tsx` that exports `TableEditor`.

Key features:
```typescript
interface TableEditorProps {
  tableName: string
}

export function TableEditor({ tableName }: TableEditorProps) {
  // 1. useQuery to fetch rows: betterbase.from(tableName).execute()
  // 2. Render column headers dynamically from first row keys
  // 3. Each row is a <tr> with cells
  // 4. Click a cell → inline edit mode (input replaces text)
  // 5. Save edit → useMutation calling betterbase.from(tableName).update(id, data)
  // 6. "Add Row" button → opens a modal/drawer with empty form fields
  // 7. Delete row → confirm dialog → betterbase.from(tableName).delete(id)
  // 8. Loading state → skeleton rows
  // 9. Empty state → centered message with "Add your first row" button
}
```

### Constraints
- Use `@tanstack/react-query` `useQuery` and `useMutation` — not `useState` + `useEffect` + `fetch`
- No new UI library installs — use existing Radix UI, Tailwind, lucide-react
- Must handle the case where `betterbase` client URL is not configured (show a setup prompt)
- TypeScript strict mode — no `any` on row data, use `Record<string, unknown>` with type guards

### Success Criteria
- [ ] Component renders without errors when `tableName` is passed
- [ ] Rows load and display correctly
- [ ] Inline cell editing works and saves
- [ ] Add row form works
- [ ] Delete with confirmation works
- [ ] Loading and empty states render correctly
- [ ] TypeScript compiles with zero errors

---

## STUB 5: `apps/dashboard/src/app/(dashboard)/api-explorer/page.tsx`

### Current state
```typescript
export default function ApiPage() {
  return <div>API Explorer — Coming in Phase 9.3</div>
}
```

### What it needs to become
A functional API Explorer page where developers can:
- Browse all available endpoints from `.betterbase-context.json` (fetched from the backend)
- Select an endpoint and see its method, path, auth requirement, input schema
- Send a test request with a JSON body editor
- See the response (status code, headers, body) formatted as JSON
- Switch between endpoints via a sidebar list

### Structure
```text
Left panel (1/3 width):
  - List of endpoints grouped by table/route
  - Each item shows: METHOD badge + path
  - Click to select

Right panel (2/3 width):
  - Selected endpoint details:
    - Method + Path
    - Auth required: Yes/No badge
    - Request body editor (textarea with JSON)
    - "Send Request" button
  - Response panel (below):
    - Status code badge
    - Response body (syntax-highlighted JSON)
    - Response time
```

### Constraints
- Fetch endpoint list from: `GET /api/context` or read from `.betterbase-context.json` endpoint
- If the backend is not running, show a "Backend not connected" empty state
- Use `'use client'` directive
- Use `useState` for selected endpoint and request body
- Use existing `Button`, `Card` components
- No new dependencies

### Success Criteria
- [ ] Page renders without errors
- [ ] Endpoint list loads and displays
- [ ] Selecting an endpoint populates the right panel
- [ ] Send request fires a real fetch and shows the response
- [ ] JSON response is formatted and readable
- [ ] TypeScript compiles with zero errors

---

## STUB 6: `apps/dashboard/src/app/(dashboard)/auth/page.tsx`

### Current state
```typescript
export default function AuthManagerPage() {
  return <div>Auth Manager — Coming in Phase 9.4</div>
}
```

### What it needs to become
An Auth Manager page that shows:
- A table of registered users (fetched via `betterbase.from('users').execute()`)
- Columns: ID, Email, Name, Created At, Actions
- Actions: View user detail, Delete user (with confirmation)
- A search bar to filter users by email
- Pagination controls (prev/next)
- A "Total users" count badge

### Structure
```text
Header: "Auth Manager" title + "Total: N users" badge

Search bar: filter by email (client-side filter on fetched data)

Users table:
  ID | Email | Name | Created At | Actions
  ...rows...
  [Delete button per row — opens confirm dialog]

Pagination: Previous | Page X of Y | Next
```

### Constraints
- Use `betterbase.from('users').select(['id', 'email', 'name', 'created_at']).execute()`
- Use TanStack Query `useQuery` for data fetching
- Pagination: 20 users per page, managed with `offset` query param
- Use existing `Card`, `Button` components
- Use `lucide-react` for icons (Search, Trash2, ChevronLeft, ChevronRight)
- `'use client'` directive required

### Success Criteria
- [ ] Page renders without errors
- [ ] Users table loads and displays real data
- [ ] Search filters results correctly
- [ ] Delete with confirmation works
- [ ] Pagination works correctly
- [ ] TypeScript compiles with zero errors

---

## STUB 7: `apps/dashboard/src/app/(dashboard)/logs/page.tsx`

### Current state
```typescript
export default function LogsPage() {
  return <div>Logs — Coming in Phase 9.5</div>
}
```

### What it needs to become
A Logs Viewer page that shows:
- A live-updating list of recent API requests
- Each log entry: timestamp, method badge, path, status code badge, response time
- Filter by: method (GET/POST/PUT/DELETE), status (2xx/4xx/5xx), search by path
- Color-coded status badges: green (2xx), yellow (4xx), red (5xx)
- Auto-refresh every 5 seconds with a "Live" indicator
- A "Clear" button to reset the displayed logs

### Structure
```text
Header: "Request Logs" + Live indicator (green dot + "Live" text)

Filter bar:
  - Method filter: All | GET | POST | PUT | DELETE
  - Status filter: All | 2xx | 4xx | 5xx
  - Path search input

Logs table:
  Timestamp | Method | Path | Status | Response Time
  ...rows...

Footer: "Showing N logs" + Clear button
```

### Implementation note
Since there is no real logging backend yet, implement with mock/simulated data for now. Use `useState` with an initial array of 20 fake log entries. The auto-refresh simulates adding new entries. When the real observability layer is built, this component will just swap `useMockLogs()` for `useLogs()` — keep that separation clean.

```typescript
// Use this hook interface so swapping is easy later:
function useLogs(): { logs: LogEntry[], isLive: boolean, clear: () => void }

// Implement useMockLogs() now:
function useMockLogs(): { logs: LogEntry[], isLive: boolean, clear: () => void }
```

```typescript
interface LogEntry {
  id: string
  timestamp: string
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
  path: string
  statusCode: number
  responseTimeMs: number
}
```

### Constraints
- `'use client'` directive required
- Auto-refresh via `setInterval` in `useEffect`, clean up on unmount
- Color-coded status: 200-299 green, 400-499 yellow, 500+ red
- Method badges: GET blue, POST green, PUT orange, DELETE red
- No new dependencies

### Success Criteria
- [ ] Page renders without errors with mock data
- [ ] Filters work correctly (method, status, path search)
- [ ] Auto-refresh adds new mock entries every 5 seconds
- [ ] Clear button resets the log list
- [ ] Live indicator is visible and accurate
- [ ] `useMockLogs` and `useLogs` are clearly separated for future swap
- [ ] TypeScript compiles with zero errors

---

## FINAL VERIFICATION CHECKLIST

After completing all 7 stubs, run the following from the monorepo root (`/betterbase`):

```bash
# 1. Install all dependencies
bun install

# 2. Typecheck everything
bun run typecheck

# 3. Build everything
bun run build

# 4. Run existing CLI tests
cd packages/cli && bun test

# 5. Run existing client tests
cd packages/client && bun test

# 6. Verify core package is importable
node -e "import('@betterbase/core').then(m => console.log('core ok:', Object.keys(m)))"

# 7. Verify shared package is importable
node -e "import('@betterbase/shared').then(m => console.log('shared ok:', Object.keys(m)))"
```

**All checks must pass with zero errors before this task is complete.**

---

## WHAT NOT TO DO

- ❌ Do NOT implement Phase 10–15 logic (provider adapters, RLS, GraphQL, webhooks, storage, edge functions) — those have their own prompt files
- ❌ Do NOT change any existing working CLI commands (init, dev, migrate, auth, generate)
- ❌ Do NOT install new packages unless explicitly listed in a stub's deliverables
- ❌ Do NOT modify `packages/client/` except to update the `BetterBaseResponse` import to come from `@betterbase/shared` (Stub 1 cleanup)
- ❌ Do NOT touch the `templates/base/` template — it is working
- ❌ Do NOT leave any file empty — every stub file must either be implemented or export `{}` with a comment
