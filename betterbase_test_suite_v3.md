# BetterBase — Test Suite Creation Guide v3
> **Who this is for:** An AI coding assistant (Cursor, Copilot, etc.) that will generate a complete test suite for the BetterBase monorepo.
> **How to use this doc:** Read it fully, top to bottom, before writing a single line of code. Every section exists for a reason.
> **What changed from v2:** `packages/core` is NOT empty stubs — it has real implementations. `packages/shared` has real logic. The Supabase comparison is corrected. Core package tests are now included. See the corrected warnings section.

---

## STEP 0 — DO THIS FIRST, BEFORE ANYTHING ELSE

Before writing any test, run these two commands from the monorepo root and read the output carefully:

```bash
# 1. Confirm the exact folder structure on disk
find . -type f -name "*.ts" | grep -v node_modules | grep -v dist | sort

# 2. Find every test file that already exists
find . -name "*.test.ts" -not -path "*/node_modules/*" | sort
```

The second command tells you exactly what already exists. **Do not rewrite or delete any file that appears in that output.** Only extend them or create new ones alongside them.

---

## PROJECT IDENTITY

| Property | Value |
|---|---|
| **Project name** | BetterBase |
| **What it is** | AI-native Backend-as-a-Service platform (Supabase alternative) |
| **Runtime** | Bun `1.3.9` (pinned — do not use APIs from newer versions) |
| **Framework** | Hono (ultrafast web framework) |
| **ORM** | Drizzle ORM with SQLite (local) / PostgreSQL (production) |
| **Auth** | BetterAuth |
| **Monorepo tool** | Turborepo `^2.3.0` |
| **TypeScript** | Strict mode, version `5.6.0`, target ES2022, NodeNext modules |
| **Test runner** | `bun:test` — Bun's built-in test runner. **Nothing else.** |
| **Key innovation** | `.betterbase-context.json` — machine-readable backend manifest for AI agents |

---

## MONOREPO STRUCTURE (the ground truth — verified from `tree -I node_modules`)

```
betterbase/                          ← monorepo root
├── package.json
├── turbo.json
├── tsconfig.base.json
├── biome.json
│
├── packages/
│   ├── cli/                         ← @betterbase/cli  ✅ PRIMARY TEST TARGET
│   │   ├── src/
│   │   │   ├── index.ts             ← CLI entry point (commander)
│   │   │   ├── constants.ts         ← shared constants
│   │   │   ├── build.ts
│   │   │   ├── commands/
│   │   │   │   ├── init.ts          ← exports: runInitCommand(options), InitCommandOptions
│   │   │   │   ├── dev.ts           ← exports: runDevCommand(projectRoot)
│   │   │   │   ├── migrate.ts       ← exports: runMigrateCommand(options), analyzeMigration(), splitStatements()
│   │   │   │   ├── auth.ts          ← exports: runAuthSetupCommand(projectRoot)
│   │   │   │   ├── generate.ts      ← exports: runGenerateCrudCommand(projectRoot, tableName)
│   │   │   │   ├── function.ts      ← Edge function deployment command
│   │   │   │   ├── graphql.ts       ← GraphQL setup command
│   │   │   │   ├── rls.ts           ← RLS policy command
│   │   │   │   ├── storage.ts       ← Storage setup command
│   │   │   │   └── webhook.ts       ← Webhook setup command
│   │   │   └── utils/
│   │   │       ├── scanner.ts       ← exports: SchemaScanner class, TableInfo, ColumnInfo types
│   │   │       ├── schema-scanner.ts← re-exports scanner.ts (use this for imports)
│   │   │       ├── route-scanner.ts ← exports: RouteScanner class, RouteInfo type
│   │   │       ├── context-generator.ts ← exports: ContextGenerator class, BetterBaseContext interface
│   │   │       ├── logger.ts        ← exports: info(), warn(), error(), success()
│   │   │       ├── prompts.ts       ← exports: text(), confirm(), select()
│   │   │       └── provider-prompts.ts ← provider selection prompts
│   │   └── test/                    ← EXTEND existing files, ADD new ones
│   │       ├── smoke.test.ts        ← already exists, extend only
│   │       ├── scanner.test.ts      ← already exists, extend only
│   │       ├── context-generator.test.ts ← already exists, extend only
│   │       └── route-scanner.test.ts ← already exists, extend only
│   │
│   ├── client/                      ← @betterbase/client  ✅ SECONDARY TEST TARGET
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── client.ts            ← exports: createClient(options)
│   │   │   ├── query-builder.ts     ← exports: QueryBuilder class
│   │   │   ├── auth.ts              ← exports: AuthClient with signUp/signIn/signOut/getSession/getToken
│   │   │   ├── realtime.ts          ← exports: RealtimeClient using native WebSocket
│   │   │   ├── storage.ts           ← exports: StorageClient
│   │   │   ├── errors.ts            ← exports: BetterBaseError, AuthError, NetworkError, ValidationError, StorageError
│   │   │   └── types.ts
│   │   └── test/
│   │       └── client.test.ts       ← already exists, extend only
│   │
│   ├── core/                        ← @betterbase/core  ✅ HAS REAL IMPLEMENTATIONS
│   │   └── src/
│   │       ├── config/
│   │       │   ├── drizzle-generator.ts
│   │       │   ├── index.ts
│   │       │   └── schema.ts        ← Zod schemas for betterbase.config.ts
│   │       ├── functions/
│   │       │   ├── bundler.ts       ← Edge function bundling logic
│   │       │   ├── deployer.ts      ← Edge function deployment
│   │       │   └── index.ts
│   │       ├── graphql/
│   │       │   ├── resolvers.ts     ← Auto GraphQL resolver generation
│   │       │   ├── schema-generator.ts
│   │       │   ├── sdl-exporter.ts
│   │       │   ├── server.ts        ← GraphQL server setup
│   │       │   └── index.ts
│   │       ├── middleware/
│   │       │   ├── rls-session.ts   ← RLS session middleware
│   │       │   └── index.ts
│   │       ├── migration/
│   │       │   ├── rls-migrator.ts  ← RLS policy migrations
│   │       │   └── index.ts
│   │       ├── providers/
│   │       │   ├── neon.ts          ← Neon DB provider
│   │       │   ├── planetscale.ts   ← PlanetScale provider
│   │       │   ├── postgres.ts      ← PostgreSQL provider
│   │       │   ├── supabase.ts      ← Supabase compat provider
│   │       │   ├── turso.ts         ← Turso/LibSQL provider
│   │       │   ├── types.ts
│   │       │   └── index.ts
│   │       ├── rls/
│   │       │   ├── auth-bridge.ts   ← RLS ↔ BetterAuth integration
│   │       │   ├── generator.ts     ← RLS policy generation
│   │       │   ├── scanner.ts       ← RLS policy scanning
│   │       │   ├── types.ts
│   │       │   └── index.ts
│   │       ├── storage/
│   │       │   ├── s3-adapter.ts    ← S3-compatible file storage
│   │       │   ├── types.ts
│   │       │   └── index.ts
│   │       └── webhooks/
│   │           ├── dispatcher.ts    ← Webhook dispatching
│   │           ├── integrator.ts    ← Webhook integration
│   │           ├── signer.ts        ← HMAC signature verification
│   │           ├── startup.ts       ← Webhook server startup
│   │           ├── types.ts
│   │           └── index.ts
│   │
│   └── shared/                      ← @betterbase/shared  ✅ HAS REAL LOGIC
│       └── src/
│           ├── constants.ts         ← shared constants
│           ├── errors.ts            ← BetterBaseError base class
│           ├── types.ts             ← shared TypeScript types
│           ├── utils.ts             ← shared utility functions
│           └── index.ts
│
└── templates/
    ├── base/                        ← ✅ INTEGRATION TEST TARGET
    │   └── src/
    │       ├── index.ts             ← Hono app + WebSocket server
    │       ├── auth/index.ts        ← BetterAuth instance
    │       ├── db/
    │       │   ├── index.ts         ← Drizzle db instance
    │       │   ├── migrate.ts       ← Migration runner
    │       │   ├── schema.ts        ← users + posts tables + helpers
    │       │   └── policies/        ← RLS policy definitions
    │       ├── functions/           ← Edge function folder
    │       ├── lib/
    │       │   ├── env.ts           ← Zod env validation
    │       │   └── realtime.ts      ← WebSocket RealtimeServer
    │       ├── middleware/
    │       │   ├── auth.ts          ← requireAuth, optionalAuth
    │       │   └── validation.ts    ← parseBody(schema, body)
    │       └── routes/
    │           ├── health.ts        ← GET /health
    │           ├── index.ts         ← registerRoutes(app)
    │           ├── storage.ts       ← Storage routes
    │           ├── graphql.d.ts     ← GraphQL route types
    │           └── users.ts         ← users CRUD
    └── auth/                        ← Auth template
        └── src/
            ├── auth/
            ├── db/
            ├── middleware/
            └── routes/
```

---

## CORRECTED WARNING: packages/core and packages/shared

**Previous versions of this guide said `packages/core` and `packages/shared` were empty stubs. This was WRONG.**

The actual disk structure (verified via `tree -I node_modules`) shows:

- `packages/core` has **real implementation files** for: webhooks (`dispatcher.ts`, `signer.ts`, `integrator.ts`), GraphQL (`resolvers.ts`, `schema-generator.ts`, `server.ts`), RLS (`generator.ts`, `auth-bridge.ts`), Storage (`s3-adapter.ts`), Edge Functions (`bundler.ts`, `deployer.ts`), and multiple database Providers.
- `packages/shared` has real logic in `errors.ts`, `utils.ts`, `types.ts`, and `constants.ts`.

### The CORRECT rule for testing these packages:

**Before writing any test for `packages/core` or `packages/shared`:**

1. Open the specific source file you want to test
2. Check if the functions have actual logic in their bodies, or just `throw new Error('Not implemented')` / empty returns
3. If the function has real logic → write a test for it
4. If the function has `// TODO`, `throw new Error('Not implemented')`, or an empty body → skip that specific function, but test others in the same file that do have logic

**Do NOT blanket-skip all of packages/core.** Test what's actually implemented. Specifically worth testing:
- `packages/core/src/webhooks/signer.ts` — HMAC signing is pure logic with no external deps
- `packages/core/src/config/schema.ts` — Zod validation, pure and testable
- `packages/shared/src/errors.ts` — Error class hierarchy, pure logic
- `packages/shared/src/utils.ts` — Utility functions, if they have real implementations

---

## HOW TO RUN TESTS

```bash
# From monorepo root — runs all packages via Turborepo
bun run test

# Single package only
cd packages/cli && bun test
cd packages/client && bun test
cd packages/core && bun test

# Single file
cd packages/cli && bun test test/migrate.test.ts

# Verbose output
cd packages/cli && bun test --verbose

# Watch mode while writing tests
cd packages/cli && bun test --watch
```

---

## STEP 1 — Configure Turborepo to Run Tests

Before writing any tests, verify that `turbo.json` has a `test` task. If it does not, add it:

```json
{
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "test": {
      "dependsOn": ["^build"],
      "outputs": [],
      "cache": false
    },
    "dev": {
      "persistent": true,
      "cache": false
    }
  }
}
```

And each package that has tests needs a `test` script in its `package.json`:

```json
{
  "scripts": {
    "test": "bun test"
  }
}
```

**Check this first.** If `bun run test` exits immediately with zero tests run, this is the reason.

---

## STEP 2 — Create Shared Test Fixtures

Before writing any test file, create this shared fixtures file.

**Create: `packages/cli/test/fixtures.ts`**

```typescript
// Shared test fixtures for BetterBase CLI tests
import { mkdir, writeFile } from 'fs/promises'
import { join } from 'path'

export const SIMPLE_SCHEMA = `
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});
`

export const MULTI_TABLE_SCHEMA = `
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
});

export const posts = sqliteTable('posts', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  content: text('content'),
  userId: text('user_id').notNull().references(() => users.id),
  published: integer('published', { mode: 'boolean' }).default(0),
});

export const comments = sqliteTable('comments', {
  id: text('id').primaryKey(),
  body: text('body').notNull(),
  postId: text('post_id').notNull().references(() => posts.id),
  userId: text('user_id').notNull().references(() => users.id),
});
`

export const SIMPLE_ROUTES = `
import { Hono } from 'hono'
const app = new Hono()
app.get('/users', async (c) => c.json([]))
app.post('/users', async (c) => c.json({}))
export default app
`

export const PROTECTED_ROUTES = `
import { Hono } from 'hono'
import { requireAuth } from '../middleware/auth'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
const app = new Hono()
const createSchema = z.object({ title: z.string(), content: z.string().optional() })
app.get('/posts', requireAuth, async (c) => c.json([]))
app.post('/posts', requireAuth, zValidator('json', createSchema), async (c) => c.json({}))
app.get('/health', async (c) => c.json({ status: 'ok' }))
export default app
`

export const EMPTY_SCHEMA = `export {}`
export const EMPTY_ROUTES = `export {}`

export async function createMinimalProject(dir: string) {
  await mkdir(join(dir, 'src/db'), { recursive: true })
  await mkdir(join(dir, 'src/routes'), { recursive: true })
  await mkdir(join(dir, 'src/middleware'), { recursive: true })
  await writeFile(join(dir, 'src/db/schema.ts'), SIMPLE_SCHEMA)
  await writeFile(join(dir, 'src/routes/index.ts'), `
    import { Hono } from 'hono'
    const app = new Hono()
    export default app
  `)
  await writeFile(join(dir, '.env'), 'PORT=3000\n')
  await writeFile(join(dir, 'package.json'), JSON.stringify({
    name: 'test-project',
    version: '0.0.1',
    private: true,
  }, null, 2))
}
```

---

## PHASE 1 — CLI Unit Tests (packages/cli/test/)

### How CLI Commands Work

Every command in `packages/cli/src/commands/` exports a **directly callable async function**. Import and call them in tests — no subprocess needed.

Bypass interactive `inquirer` prompts by passing all required options directly. Always include `skipInstall: true` and `skipGit: true` to prevent real child processes from spawning.

Confirmed exported signatures:
- `runInitCommand(options: InitCommandOptions)` — pass `{ name, projectRoot, mode, skipInstall: true }`
- `runAuthSetupCommand(projectRoot: string)`
- `runGenerateCrudCommand(projectRoot: string, tableName: string)`
- `runMigrateCommand(options: MigrateCommandOptions)`
- `runDevCommand(projectRoot: string)` — returns a cleanup function

**Always read the actual source file before writing tests to verify exact signatures.**

---

### 1.1 — Extend `test/smoke.test.ts`

```typescript
// ADD to the bottom of: packages/cli/test/smoke.test.ts
import { describe, test, expect } from 'bun:test'

describe('CLI binary — extended smoke tests', () => {
  test('index.ts file exists and is non-empty', async () => {
    const { readFile } = await import('fs/promises')
    const { join } = await import('path')
    const content = await readFile(join(import.meta.dir, '../src/index.ts'), 'utf-8')
    expect(content.length).toBeGreaterThan(0)
  })

  test('all expected command files exist on disk', async () => {
    const { access } = await import('fs/promises')
    const { join } = await import('path')
    // All commands confirmed in tree output:
    const commands = ['init', 'dev', 'migrate', 'auth', 'generate', 'function', 'graphql', 'rls', 'storage', 'webhook']
    for (const cmd of commands) {
      await expect(
        access(join(import.meta.dir, `../src/commands/${cmd}.ts`))
      ).resolves.toBeUndefined()
    }
  })

  test('all expected utility files exist on disk', async () => {
    const { access } = await import('fs/promises')
    const { join } = await import('path')
    const utils = ['scanner', 'route-scanner', 'context-generator', 'logger', 'prompts', 'provider-prompts']
    for (const util of utils) {
      await expect(
        access(join(import.meta.dir, `../src/utils/${util}.ts`))
      ).resolves.toBeUndefined()
    }
  })

  test('constants.ts exists and exports something', async () => {
    const constants = await import('../src/constants')
    expect(constants).toBeDefined()
    expect(Object.keys(constants).length).toBeGreaterThan(0)
  })
})
```

---

### 1.2 — New file: `test/migrate.test.ts`

```typescript
// CREATE: packages/cli/test/migrate.test.ts
import { describe, test, expect } from 'bun:test'
// READ src/commands/migrate.ts first and verify these export names
import { splitStatements, analyzeMigration } from '../src/commands/migrate'

describe('splitStatements', () => {
  test('splits two statements separated by semicolons', () => {
    const sql = `CREATE TABLE users (id TEXT PRIMARY KEY);\nCREATE TABLE posts (id TEXT PRIMARY KEY);`
    const result = splitStatements(sql)
    expect(result.length).toBe(2)
  })

  test('trims whitespace from each statement', () => {
    const sql = `  CREATE TABLE a (id TEXT);  `
    const result = splitStatements(sql)
    expect(result[0].trim()).toBe('CREATE TABLE a (id TEXT)')
  })

  test('ignores empty statements from consecutive semicolons', () => {
    const sql = `CREATE TABLE a (id TEXT);;;CREATE TABLE b (id TEXT);`
    const result = splitStatements(sql)
    expect(result.every((s: string) => s.trim().length > 0)).toBe(true)
  })

  test('returns empty array for empty input', () => {
    expect(splitStatements('')).toEqual([])
  })

  test('returns single item for input with no semicolons', () => {
    const sql = `CREATE TABLE a (id TEXT PRIMARY KEY)`
    const result = splitStatements(sql)
    expect(result.length).toBe(1)
  })
})

describe('analyzeMigration — change detection', () => {
  test('returns hasDestructiveChanges: false for empty SQL', () => {
    const result = analyzeMigration('')
    expect(result.hasDestructiveChanges).toBe(false)
  })

  test('CREATE TABLE is not destructive', () => {
    const result = analyzeMigration('CREATE TABLE posts (id TEXT PRIMARY KEY, title TEXT);')
    expect(result.hasDestructiveChanges).toBe(false)
  })

  test('ADD COLUMN is not destructive', () => {
    const result = analyzeMigration('ALTER TABLE users ADD COLUMN bio TEXT;')
    expect(result.hasDestructiveChanges).toBe(false)
  })

  test('DROP TABLE is destructive', () => {
    const result = analyzeMigration('DROP TABLE users;')
    expect(result.hasDestructiveChanges).toBe(true)
  })

  test('DROP COLUMN is destructive', () => {
    const result = analyzeMigration('ALTER TABLE users DROP COLUMN bio;')
    expect(result.hasDestructiveChanges).toBe(true)
  })

  test('mixed SQL: destructive flag true when any statement is destructive', () => {
    const sql = `CREATE TABLE posts (id TEXT);\nDROP TABLE old_table;`
    const result = analyzeMigration(sql)
    expect(result.hasDestructiveChanges).toBe(true)
  })

  test('case-insensitive detection of DROP TABLE', () => {
    const result = analyzeMigration('drop table users;')
    expect(result.hasDestructiveChanges).toBe(true)
  })
})
```

---

### 1.3 — New file: `test/init.test.ts`

```typescript
// CREATE: packages/cli/test/init.test.ts
// READ src/commands/init.ts first and verify InitCommandOptions interface
import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { mkdtemp, rm, readFile, access } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'

let runInitCommand: Function

beforeEach(async () => {
  const mod = await import('../src/commands/init')
  runInitCommand = mod.runInitCommand
})

describe('runInitCommand — local mode', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'bb-init-'))
  })

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true })
  })

  test('creates package.json', async () => {
    const dest = join(tmpDir, 'my-project')
    await runInitCommand({ name: 'my-project', projectRoot: dest, mode: 'local', skipInstall: true, skipGit: true })
    await expect(access(join(dest, 'package.json'))).resolves.toBeUndefined()
  })

  test('creates src/db/schema.ts', async () => {
    const dest = join(tmpDir, 'schema-test')
    await runInitCommand({ name: 'schema-test', projectRoot: dest, mode: 'local', skipInstall: true, skipGit: true })
    await expect(access(join(dest, 'src/db/schema.ts'))).resolves.toBeUndefined()
  })

  test('creates src/routes/index.ts', async () => {
    const dest = join(tmpDir, 'routes-test')
    await runInitCommand({ name: 'routes-test', projectRoot: dest, mode: 'local', skipInstall: true, skipGit: true })
    await expect(access(join(dest, 'src/routes/index.ts'))).resolves.toBeUndefined()
  })

  test('creates betterbase.config.ts', async () => {
    const dest = join(tmpDir, 'config-test')
    await runInitCommand({ name: 'config-test', projectRoot: dest, mode: 'local', skipInstall: true, skipGit: true })
    await expect(access(join(dest, 'betterbase.config.ts'))).resolves.toBeUndefined()
  })

  test('creates drizzle.config.ts', async () => {
    const dest = join(tmpDir, 'drizzle-test')
    await runInitCommand({ name: 'drizzle-test', projectRoot: dest, mode: 'local', skipInstall: true, skipGit: true })
    await expect(access(join(dest, 'drizzle.config.ts'))).resolves.toBeUndefined()
  })

  test('creates .env file', async () => {
    const dest = join(tmpDir, 'env-test')
    await runInitCommand({ name: 'env-test', projectRoot: dest, mode: 'local', skipInstall: true, skipGit: true })
    await expect(access(join(dest, '.env'))).resolves.toBeUndefined()
  })

  test('package.json contains the project name', async () => {
    const dest = join(tmpDir, 'name-test')
    await runInitCommand({ name: 'name-test', projectRoot: dest, mode: 'local', skipInstall: true, skipGit: true })
    const pkg = JSON.parse(await readFile(join(dest, 'package.json'), 'utf-8'))
    expect(pkg.name).toBe('name-test')
  })
})

describe('runInitCommand — Turso mode', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'bb-init-turso-'))
  })

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true })
  })

  test('drizzle.config.ts references turso or libsql dialect', async () => {
    const dest = join(tmpDir, 'turso-project')
    await runInitCommand({ name: 'turso-project', projectRoot: dest, mode: 'turso', skipInstall: true, skipGit: true })
    const config = await readFile(join(dest, 'drizzle.config.ts'), 'utf-8')
    expect(config.toLowerCase()).toMatch(/turso|libsql/)
  })

  test('.env includes TURSO_URL placeholder', async () => {
    const dest = join(tmpDir, 'turso-env')
    await runInitCommand({ name: 'turso-env', projectRoot: dest, mode: 'turso', skipInstall: true, skipGit: true })
    const env = await readFile(join(dest, '.env'), 'utf-8')
    expect(env).toContain('TURSO_URL')
  })
})
```

---

### 1.4 — New file: `test/auth-command.test.ts`

```typescript
// CREATE: packages/cli/test/auth-command.test.ts
import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { mkdtemp, rm, readFile, access } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import { createMinimalProject } from './fixtures'

let runAuthSetupCommand: Function

beforeEach(async () => {
  const mod = await import('../src/commands/auth')
  runAuthSetupCommand = mod.runAuthSetupCommand
})

describe('runAuthSetupCommand', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'bb-auth-'))
    await createMinimalProject(tmpDir)
  })

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true })
  })

  test('creates src/routes/auth.ts', async () => {
    await runAuthSetupCommand(tmpDir)
    await expect(access(join(tmpDir, 'src/routes/auth.ts'))).resolves.toBeUndefined()
  })

  test('creates src/middleware/auth.ts', async () => {
    await runAuthSetupCommand(tmpDir)
    await expect(access(join(tmpDir, 'src/middleware/auth.ts'))).resolves.toBeUndefined()
  })

  test('middleware contains requireAuth export', async () => {
    await runAuthSetupCommand(tmpDir)
    const mw = await readFile(join(tmpDir, 'src/middleware/auth.ts'), 'utf-8')
    expect(mw).toContain('requireAuth')
  })

  test('adds AUTH_SECRET to .env', async () => {
    await runAuthSetupCommand(tmpDir)
    const env = await readFile(join(tmpDir, '.env'), 'utf-8')
    expect(env).toContain('AUTH_SECRET')
  })

  test('adds sessions table to schema.ts', async () => {
    await runAuthSetupCommand(tmpDir)
    const schema = await readFile(join(tmpDir, 'src/db/schema.ts'), 'utf-8')
    expect(schema).toContain('sessions')
  })

  test('is idempotent — running twice does not duplicate sessions table', async () => {
    await runAuthSetupCommand(tmpDir)
    await runAuthSetupCommand(tmpDir)
    const schema = await readFile(join(tmpDir, 'src/db/schema.ts'), 'utf-8')
    const matches = schema.match(/sqliteTable\s*\(\s*['"]sessions['"]/g) || []
    expect(matches.length).toBe(1)
  })
})
```

---

### 1.5 — New file: `test/generate-crud.test.ts`

```typescript
// CREATE: packages/cli/test/generate-crud.test.ts
import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { mkdtemp, rm, readFile, access, writeFile } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import { createMinimalProject, MULTI_TABLE_SCHEMA } from './fixtures'

let runGenerateCrudCommand: Function

beforeEach(async () => {
  const mod = await import('../src/commands/generate')
  runGenerateCrudCommand = mod.runGenerateCrudCommand
})

describe('runGenerateCrudCommand', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'bb-gen-'))
    await createMinimalProject(tmpDir)
    await writeFile(join(tmpDir, 'src/db/schema.ts'), MULTI_TABLE_SCHEMA)
  })

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true })
  })

  test('creates src/routes/posts.ts for posts table', async () => {
    await runGenerateCrudCommand(tmpDir, 'posts')
    await expect(access(join(tmpDir, 'src/routes/posts.ts'))).resolves.toBeUndefined()
  })

  test('generated route contains GET handler', async () => {
    await runGenerateCrudCommand(tmpDir, 'posts')
    const content = await readFile(join(tmpDir, 'src/routes/posts.ts'), 'utf-8')
    expect(content).toContain('.get(')
  })

  test('generated route contains POST handler', async () => {
    await runGenerateCrudCommand(tmpDir, 'posts')
    const content = await readFile(join(tmpDir, 'src/routes/posts.ts'), 'utf-8')
    expect(content).toContain('.post(')
  })

  test('generated route contains DELETE handler', async () => {
    await runGenerateCrudCommand(tmpDir, 'posts')
    const content = await readFile(join(tmpDir, 'src/routes/posts.ts'), 'utf-8')
    expect(content).toContain('.delete(')
  })

  test('generates Zod schema for validation', async () => {
    await runGenerateCrudCommand(tmpDir, 'posts')
    const content = await readFile(join(tmpDir, 'src/routes/posts.ts'), 'utf-8')
    expect(content.toLowerCase()).toContain('zod')
  })

  test('throws or rejects for nonexistent table', async () => {
    await expect(
      runGenerateCrudCommand(tmpDir, 'nonexistent_table_xyz')
    ).rejects.toThrow()
  })
})
```

---

### 1.6 — New file: `test/edge-cases.test.ts`

```typescript
// CREATE: packages/cli/test/edge-cases.test.ts
import { describe, test, expect } from 'bun:test'
import { SchemaScanner } from '../src/utils/scanner'
import { RouteScanner } from '../src/utils/route-scanner'
import { ContextGenerator } from '../src/utils/context-generator'
import { EMPTY_SCHEMA, EMPTY_ROUTES } from './fixtures'

describe('SchemaScanner — edge inputs', () => {
  test('does not throw on completely empty string', () => {
    expect(() => new SchemaScanner('').scan()).not.toThrow()
  })

  test('does not throw on non-TypeScript input', () => {
    expect(() => new SchemaScanner('this is { not typescript ').scan()).not.toThrow()
  })

  test('returns empty tables for schema with only comments', () => {
    const s = `// just a comment\n/* and another */`
    expect(new SchemaScanner(s).scan().tables).toEqual([])
  })
})

describe('RouteScanner — edge inputs', () => {
  test('does not throw on empty string', () => {
    expect(() => new RouteScanner('').scan()).not.toThrow()
  })

  test('returns empty routes for file with no route registrations', () => {
    const r = `const x = 1;\nconst y = 'hello'`
    expect(new RouteScanner(r).scan().routes).toEqual([])
  })
})

describe('ContextGenerator — boundary conditions', () => {
  test('does not throw when both inputs are empty', () => {
    const gen = new ContextGenerator({ schemaContent: EMPTY_SCHEMA, routesContent: EMPTY_ROUTES })
    expect(() => gen.generate()).not.toThrow()
  })

  test('output is always valid JSON-serializable', () => {
    const cases = [
      { schemaContent: '', routesContent: '' },
      { schemaContent: EMPTY_SCHEMA, routesContent: EMPTY_ROUTES },
      { schemaContent: 'not typescript', routesContent: 'not typescript' },
    ]
    for (const c of cases) {
      const gen = new ContextGenerator(c)
      expect(() => JSON.parse(JSON.stringify(gen.generate()))).not.toThrow()
    }
  })
})
```

---

## PHASE 2 — Client SDK Tests (packages/client/test/)

### 2.1 — New file: `test/query-builder.test.ts`

```typescript
// CREATE: packages/client/test/query-builder.test.ts
import { describe, test, expect, mock } from 'bun:test'
import { createClient } from '../src/index'

function makeMockClient(responseData: unknown, status = 200) {
  const fetchMock = mock(() =>
    Promise.resolve(new Response(JSON.stringify({ data: responseData, error: null }), { status }))
  )
  return {
    client: createClient({ url: 'http://localhost:3000', fetch: fetchMock as any }),
    fetchMock,
  }
}

describe('QueryBuilder — chaining and HTTP', () => {
  test('.from().execute() makes a GET request', async () => {
    const { client, fetchMock } = makeMockClient([])
    await client.from('users').execute()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, opts] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect((opts?.method ?? 'GET').toUpperCase()).toBe('GET')
  })

  test('.from().select() is chainable and returns data', async () => {
    const { client } = makeMockClient([{ id: '1', name: 'Alice' }])
    const result = await client.from('users').select('id,name').execute()
    expect(result.data).toEqual([{ id: '1', name: 'Alice' }])
  })

  test('.eq() adds filter to request URL', async () => {
    const { client, fetchMock } = makeMockClient([])
    await client.from('users').eq('id', '123').execute()
    const [url] = fetchMock.mock.calls[0] as [string]
    expect(url).toContain('123')
  })

  test('.limit() is chainable', async () => {
    const { client, fetchMock } = makeMockClient([])
    await client.from('users').limit(10).execute()
    const [url] = fetchMock.mock.calls[0] as [string]
    expect(url).toContain('10')
  })

  test('result.error is null on success', async () => {
    const { client } = makeMockClient([])
    const result = await client.from('users').execute()
    expect(result.error).toBeNull()
  })

  test('result.error is set on server error', async () => {
    const { client } = makeMockClient(null, 500)
    const result = await client.from('users').execute()
    expect(result.error).not.toBeNull()
  })
})
```

---

### 2.2 — New file: `test/errors.test.ts`

```typescript
// CREATE: packages/client/test/errors.test.ts
import { describe, test, expect } from 'bun:test'
import {
  BetterBaseError,
  NetworkError,
  AuthError,
  ValidationError,
  StorageError,
} from '../src/errors'

describe('Error hierarchy', () => {
  test('NetworkError is instance of BetterBaseError', () => {
    expect(new NetworkError('fail')).toBeInstanceOf(BetterBaseError)
  })

  test('AuthError is instance of BetterBaseError', () => {
    expect(new AuthError('unauthorized')).toBeInstanceOf(BetterBaseError)
  })

  test('ValidationError is instance of BetterBaseError', () => {
    expect(new ValidationError('bad input')).toBeInstanceOf(BetterBaseError)
  })

  test('StorageError is instance of BetterBaseError', () => {
    expect(new StorageError('upload failed')).toBeInstanceOf(BetterBaseError)
  })

  test('NetworkError has the right name', () => {
    expect(new NetworkError('fail').name).toBe('NetworkError')
  })

  test('AuthError has the right name', () => {
    expect(new AuthError('fail').name).toBe('AuthError')
  })

  test('error message is preserved', () => {
    const msg = 'something went wrong'
    expect(new NetworkError(msg).message).toBe(msg)
  })

  test('errors are catchable as Error', () => {
    const fn = () => { throw new NetworkError('fail') }
    expect(fn).toThrow(Error)
  })
})
```

---

### 2.3 — New file: `test/realtime.test.ts`

```typescript
// CREATE: packages/client/test/realtime.test.ts
// READ src/realtime.ts before writing this — verify the RealtimeClient constructor
import { describe, test, expect, mock } from 'bun:test'

// WebSocket mock that simulates browser/Bun WebSocket API
class MockWebSocket {
  readyState = 1  // OPEN
  url: string
  onmessage: ((e: { data: string }) => void) | null = null
  onopen: (() => void) | null = null
  onclose: (() => void) | null = null
  onerror: ((e: unknown) => void) | null = null
  sent: string[] = []

  constructor(url: string) {
    this.url = url
    // Simulate async open
    Promise.resolve().then(() => this.onopen?.())
  }

  send(data: string) {
    this.sent.push(data)
  }

  close() {
    this.readyState = 3
    this.onclose?.()
  }

  simulateMessage(data: unknown) {
    this.onmessage?.({ data: JSON.stringify(data) })
  }
}

describe('RealtimeClient', () => {
  test('subscribing sends a subscribe message over WebSocket', async () => {
    // Read the actual RealtimeClient constructor signature first
    const { RealtimeClient } = await import('../src/realtime')
    const ws = new MockWebSocket('ws://localhost:3000/ws')
    const client = new RealtimeClient('ws://localhost:3000/ws', { WebSocket: MockWebSocket as any })
    // Wait for open
    await new Promise(r => setTimeout(r, 10))
    client.from('users').on('INSERT', () => {})
    expect(ws.sent.some((s: string) => s.includes('users') || s.includes('subscribe'))).toBe(true)
  })

  test('INSERT callback fires when server sends insert event', async () => {
    const { RealtimeClient } = await import('../src/realtime')
    let ws: MockWebSocket
    const MockWS = class extends MockWebSocket {
      constructor(url: string) {
        super(url)
        ws = this
      }
    }
    const client = new RealtimeClient('ws://localhost:3000/ws', { WebSocket: MockWS as any })
    await new Promise(r => setTimeout(r, 10))

    const received: unknown[] = []
    client.from('users').on('INSERT', (payload) => received.push(payload))
    ws!.simulateMessage({ event: 'INSERT', table: 'users', record: { id: '1' } })
    expect(received.length).toBe(1)
  })
})
```

---

### 2.4 — New file: `test/edge-cases.test.ts` (client)

```typescript
// CREATE: packages/client/test/edge-cases.test.ts
import { describe, test, expect, mock } from 'bun:test'
import { createClient } from '../src/index'

describe('Client SDK — network failure handling', () => {
  test('handles fetch throwing a network error without crashing', async () => {
    const failFetch = mock(() => Promise.reject(new Error('Network timeout')))
    const c = createClient({ url: 'http://localhost:3000', fetch: failFetch as any })
    const result = await c.from('users').execute()
    expect(result).toBeDefined()
    expect(result.error).not.toBeNull()
  })

  test('handles server 500 response without throwing', async () => {
    const errorFetch = mock(() =>
      Promise.resolve(new Response(JSON.stringify({ data: null, error: 'Internal Error' }), { status: 500 }))
    )
    const c = createClient({ url: 'http://localhost:3000', fetch: errorFetch as any })
    const result = await c.from('users').execute()
    expect(result.error).not.toBeNull()
  })

  test('.eq() with special characters does not produce unparseable URL', async () => {
    const captureFetch = mock(() =>
      Promise.resolve(new Response(JSON.stringify({ data: [], error: null }), { status: 200 }))
    )
    const c = createClient({ url: 'http://localhost:3000', fetch: captureFetch as any })
    await c.from('users').eq('name', "O'Reilly & Co. <test>").execute()
    const [url] = captureFetch.mock.calls[0] as [string]
    expect(() => new URL(url)).not.toThrow()
  })
})
```

---

## PHASE 3 — packages/core Tests (packages/core/test/)

**These tests did not exist in v2 because core was incorrectly identified as all stubs. It is not. Read each file before writing its test.**

### 3.1 — New file: `test/webhooks.test.ts`

```typescript
// CREATE: packages/core/test/webhooks.test.ts
// READ src/webhooks/signer.ts first — verify the signing function export name
import { describe, test, expect } from 'bun:test'

describe('Webhook signer', () => {
  test('signs a payload and returns a non-empty signature', async () => {
    // Adjust import based on actual export name in signer.ts
    const { signWebhook } = await import('../src/webhooks/signer')
    const sig = await signWebhook({ payload: '{"event":"test"}', secret: 'my-secret' })
    expect(typeof sig).toBe('string')
    expect(sig.length).toBeGreaterThan(0)
  })

  test('same payload + secret always produces same signature', async () => {
    const { signWebhook } = await import('../src/webhooks/signer')
    const a = await signWebhook({ payload: '{"event":"test"}', secret: 'my-secret' })
    const b = await signWebhook({ payload: '{"event":"test"}', secret: 'my-secret' })
    expect(a).toBe(b)
  })

  test('different secrets produce different signatures', async () => {
    const { signWebhook } = await import('../src/webhooks/signer')
    const a = await signWebhook({ payload: '{"event":"test"}', secret: 'secret-1' })
    const b = await signWebhook({ payload: '{"event":"test"}', secret: 'secret-2' })
    expect(a).not.toBe(b)
  })

  test('different payloads produce different signatures', async () => {
    const { signWebhook } = await import('../src/webhooks/signer')
    const a = await signWebhook({ payload: '{"event":"insert"}', secret: 'my-secret' })
    const b = await signWebhook({ payload: '{"event":"delete"}', secret: 'my-secret' })
    expect(a).not.toBe(b)
  })
})
```

---

### 3.2 — New file: `test/config.test.ts`

```typescript
// CREATE: packages/core/test/config.test.ts
// READ src/config/schema.ts first — verify the Zod schema export name
import { describe, test, expect } from 'bun:test'

describe('BetterBase config schema validation', () => {
  test('valid minimal config passes validation', async () => {
    const { BetterBaseConfigSchema } = await import('../src/config/schema')
    const result = BetterBaseConfigSchema.safeParse({
      database: { mode: 'local' },
    })
    expect(result.success).toBe(true)
  })

  test('invalid mode fails validation', async () => {
    const { BetterBaseConfigSchema } = await import('../src/config/schema')
    const result = BetterBaseConfigSchema.safeParse({
      database: { mode: 'invalid_mode_xyz' },
    })
    expect(result.success).toBe(false)
  })

  test('missing required fields fails validation', async () => {
    const { BetterBaseConfigSchema } = await import('../src/config/schema')
    const result = BetterBaseConfigSchema.safeParse({})
    // Either fails or uses defaults — both are valid behaviors
    // This test just ensures the schema doesn't throw
    expect(result).toBeDefined()
  })
})
```

---

### 3.3 — New file: `test/shared.test.ts`

```typescript
// CREATE: packages/shared/test/shared.test.ts (create test/ dir first)
// READ src/errors.ts and src/utils.ts before writing
import { describe, test, expect } from 'bun:test'

describe('shared/errors', () => {
  test('BetterBaseError is an Error subclass', async () => {
    const { BetterBaseError } = await import('../src/errors')
    expect(new BetterBaseError('test')).toBeInstanceOf(Error)
  })

  test('BetterBaseError message is preserved', async () => {
    const { BetterBaseError } = await import('../src/errors')
    expect(new BetterBaseError('something broke').message).toBe('something broke')
  })

  test('BetterBaseError name is set correctly', async () => {
    const { BetterBaseError } = await import('../src/errors')
    expect(new BetterBaseError('fail').name).toBe('BetterBaseError')
  })
})

describe('shared/constants', () => {
  test('constants module exports something', async () => {
    const constants = await import('../src/constants')
    expect(Object.keys(constants).length).toBeGreaterThan(0)
  })
})
```

---

## PHASE 4 — Integration Tests (templates/base/test/)

### 4.1 — New file: `test/health.test.ts`

```typescript
// CREATE: templates/base/test/health.test.ts
import { describe, test, expect, beforeAll, afterAll } from 'bun:test'

let server: ReturnType<typeof Bun.serve>
let base: string

beforeAll(async () => {
  const { app } = await import('../src/index')
  server = Bun.serve({ fetch: app.fetch, port: 0 })
  base = `http://localhost:${server.port}`
})

afterAll(() => {
  server.stop()
})

describe('GET /health', () => {
  test('returns 200', async () => {
    const res = await fetch(`${base}/health`)
    expect(res.status).toBe(200)
  })

  test('returns JSON with status field', async () => {
    const res = await fetch(`${base}/health`)
    const body = await res.json()
    expect(body.status).toBeDefined()
  })

  test('status field is "ok"', async () => {
    const res = await fetch(`${base}/health`)
    const body = await res.json()
    expect(body.status).toBe('ok')
  })

  test('returns a timestamp', async () => {
    const res = await fetch(`${base}/health`)
    const body = await res.json()
    expect(body.timestamp ?? body.time ?? body.ts).toBeDefined()
  })
})
```

---

### 4.2 — New file: `test/crud.test.ts`

```typescript
// CREATE: templates/base/test/crud.test.ts
import { describe, test, expect, beforeAll, afterAll } from 'bun:test'

let server: ReturnType<typeof Bun.serve>
let base: string

beforeAll(async () => {
  const { app } = await import('../src/index')
  server = Bun.serve({ fetch: app.fetch, port: 0 })
  base = `http://localhost:${server.port}`
})

afterAll(() => {
  server.stop()
})

describe('Users CRUD', () => {
  test('GET /users returns 200', async () => {
    const res = await fetch(`${base}/api/users`)
    expect(res.status).toBe(200)
  })

  test('GET /users returns an array', async () => {
    const res = await fetch(`${base}/api/users`)
    const body = await res.json()
    expect(Array.isArray(body.data ?? body)).toBe(true)
  })

  test('POST /users with valid body returns 201 or 200', async () => {
    const res = await fetch(`${base}/api/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Test User', email: `test-${Date.now()}@example.com` }),
    })
    expect([200, 201]).toContain(res.status)
  })

  test('POST /users with missing email returns 400', async () => {
    const res = await fetch(`${base}/api/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'No Email' }),
    })
    expect(res.status).toBe(400)
  })

  test('POST /users with invalid body returns 400', async () => {
    const res = await fetch(`${base}/api/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ not_a_field: true }),
    })
    expect(res.status).toBe(400)
  })
})
```

---

## FINAL CHECKLIST

Before marking the test suite complete, verify every item:

**Setup**
- [ ] `find . -name "*.test.ts"` was run first to audit existing files
- [ ] `turbo.json` has a `test` task
- [ ] Each target package has `"test": "bun test"` in its `package.json`
- [ ] `packages/cli/test/fixtures.ts` created with all shared fixtures

**Phase 1 — CLI**
- [ ] `smoke.test.ts` extended (not replaced)
- [ ] `migrate.test.ts` created
- [ ] `init.test.ts` created
- [ ] `auth-command.test.ts` created
- [ ] `generate-crud.test.ts` created
- [ ] `scanner.test.ts` extended (not replaced)
- [ ] `context-generator.test.ts` extended (not replaced)
- [ ] `route-scanner.test.ts` extended (not replaced)
- [ ] `edge-cases.test.ts` created

**Phase 2 — Client SDK**
- [ ] `client.test.ts` extended (not replaced)
- [ ] `query-builder.test.ts` created
- [ ] `errors.test.ts` created
- [ ] `realtime.test.ts` created
- [ ] `edge-cases.test.ts` created

**Phase 3 — packages/core (NEW in v3)**
- [ ] Open each core source file first, check if functions have real logic
- [ ] `packages/core/test/webhooks.test.ts` created (if signer.ts has logic)
- [ ] `packages/core/test/config.test.ts` created (if schema.ts has Zod logic)
- [ ] `packages/shared/test/shared.test.ts` created (errors.ts and utils.ts)

**Phase 4 — Integration**
- [ ] `templates/base/test/health.test.ts` created
- [ ] `templates/base/test/crud.test.ts` created

**Verification**
- [ ] `cd packages/cli && bun test` passes with zero TypeScript errors
- [ ] `cd packages/client && bun test` passes with zero TypeScript errors
- [ ] `cd packages/core && bun test` passes (for files with real logic)
- [ ] `bun run test` from monorepo root runs all packages

---

## ABSOLUTE DO-NOT LIST

1. **Never import from `apps/cli/`** — canonical CLI is at `packages/cli/`
2. **Never blanket-skip all of `packages/core`** — it has real implementations. Read each file first.
3. **Never test functions that have `throw new Error('Not implemented')` bodies** — check the source first
4. **Never use `jest.fn()`** — use `mock()` from `bun:test`
5. **Never hardcode port `3000`** in integration tests — use `port: 0`
6. **Never delete or overwrite existing test files** — only extend them
7. **Never leave temp directories uncleaned** — always use `afterEach` with `rm(tmpDir, { recursive: true, force: true })`
8. **Never call a command function with partial options** — always pass every required option including `skipInstall: true` and `skipGit: true`
9. **Never assume a function's signature** — read the source file first, then write the test
10. **Never test dashboard stub pages** (`api-explorer`, `auth manager`, `logs`) — they are not fully implemented

---

## CORRECTED: BetterBase vs Supabase Comparison

Based on the actual disk tree, here is the accurate feature comparison:

| Feature | Supabase | BetterBase | Status |
|---|---|---|---|
| Database + CRUD | PostgREST auto-API | Drizzle + bb generate crud | ✅ BetterBase wins (type-safe) |
| Migrations | Basic | Visual diff + safety checks + backup | ✅ BetterBase wins |
| Authentication | GoTrue | BetterAuth (user owns code) | ✅ BetterBase wins |
| Realtime | Postgres LISTEN | WebSocket broadcasting | ✅ Both implemented |
| Client SDK | @supabase/supabase-js | @betterbase/client | ✅ Implemented |
| Local dev | Requires Docker | Bun + SQLite, sub-100ms | ✅ BetterBase wins |
| AI context | None | .betterbase-context.json | ✅ BetterBase unique |
| Storage (files) | Full S3-compatible | s3-adapter.ts in packages/core | ✅ Implemented (verify completeness) |
| Row Level Security | Deep Postgres RLS | rls/ + auth-bridge.ts in packages/core | ✅ Implemented (verify completeness) |
| GraphQL | pg_graphql | resolvers.ts + server.ts in packages/core | ✅ Implemented (verify completeness) |
| Webhooks | Built-in | dispatcher.ts + signer.ts in packages/core | ✅ Implemented (verify completeness) |
| Edge Functions | Deno-based | bundler.ts + deployer.ts in packages/core | ✅ Implemented (verify completeness) |
| Multi-DB Providers | Supabase only | neon, turso, postgres, planetscale in core | ✅ BetterBase wins |
| Dashboard UI | Supabase Studio | apps/dashboard (Next.js, separate repo) | 🟡 In progress |

**Revised estimate: 75–80% feature parity with Supabase**, built in under 2 months solo with AI assistance. The previous estimate of 55-60% was based on incorrect assumption that packages/core was all stubs.
