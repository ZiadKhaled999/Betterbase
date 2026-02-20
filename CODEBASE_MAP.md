# BetterBase — Complete Codebase Map
> Auto-generated. Regenerate with: [paste this prompt into Cursor]
> Last updated: 2026-02-20

## Project Identity

**BetterBase** is an AI-native Backend-as-a-Service (BaaS) platform inspired by Supabase. It provides a TypeScript-first developer experience with a focus on AI context generation, Docker-less local development, and zero lock-in. The stack is built on **Bun** (runtime), **Turborepo** (monorepo), **Hono** (API framework), **Drizzle ORM** (database), and **BetterAuth** (authentication). The philosophy emphasizes: AI-first context generation via `.betterbase-context.json`, sub-100ms startup with `bun:sqlite`, user-owned schemas, and strict TypeScript with Zod validation everywhere.

## Monorepo Structure Overview

```
betterbase/
├── apps/
│   ├── cli/                    # Legacy CLI wrapper (delegates to packages/cli)
│   └── dashboard/              # Next.js dashboard/studio app
├── packages/
│   ├── cli/                    # Canonical @betterbase/cli implementation
│   ├── core/                   # Core backend engine [stub]
│   ├── client/                 # @betterbase/client SDK
│   └── shared/                 # Shared utilities/types [stub]
├── templates/
│   ├── base/                   # Bun + Hono + Drizzle starter template
│   └── auth/                   # Auth template placeholder [stub]
├── turbo.json                  # Turborepo task configuration
├── tsconfig.base.json          # Shared TypeScript config
└── package.json                # Root workspace config
```

---

## apps/cli

Legacy CLI wrapper that forwards execution to the canonical `@betterbase/cli` package.

### [`apps/cli/package.json`](betterbase/apps/cli/package.json)
**Purpose:** Package manifest for legacy CLI wrapper.
- **Name:** `@betterbase/cli-legacy`
- **Bin:** `bb-legacy` → `./dist/index.js`
- **Dependencies:** `@betterbase/cli` (workspace)

### [`apps/cli/tsconfig.json`](betterbase/apps/cli/tsconfig.json)
**Purpose:** TypeScript config extending base config with Bun types.

### [`apps/cli/README.md`](betterbase/apps/cli/README.md)
**Purpose:** Documents that this is a legacy wrapper; canonical CLI is in `packages/cli`.

### [`apps/cli/src/index.ts`](betterbase/apps/cli/src/index.ts)
**Purpose:** Entry point that forwards to canonical CLI.
- **Exports:** `runLegacyCli()` - async function that imports and calls `runCli()` from `@betterbase/cli`
- **Internal Deps:** `@betterbase/cli`

---

## apps/dashboard

Next.js 15 dashboard application for managing BetterBase backends (like Supabase Studio).

### [`apps/dashboard/package.json`](betterbase/apps/dashboard/package.json)
**Purpose:** Package manifest for dashboard app.
- **Name:** `@betterbase/dashboard`
- **Key Dependencies:** `next@^15.2.0`, `react@^19.0.0`, `@tanstack/react-query@^5.67.0`, `recharts@^2.15.0`, `@betterbase/client` (workspace), `lucide-react`, Radix UI components, `tailwind-merge`, `zod`

### [`apps/dashboard/tsconfig.json`](betterbase/apps/dashboard/tsconfig.json)
**Purpose:** TypeScript config for Next.js with path alias `@/*` → `./src/*`.

### [`apps/dashboard/next.config.ts`](betterbase/apps/dashboard/next.config.ts)
**Purpose:** Next.js configuration with React strict mode enabled.
- **Exports:** `nextConfig` - NextConfig object

### [`apps/dashboard/tailwind.config.ts`](betterbase/apps/dashboard/tailwind.config.ts)
**Purpose:** Tailwind CSS configuration with shadcn/ui-style CSS variables for theming.
- **Exports:** `config` - Tailwind Config with dark mode, custom colors, border radius variables

### [`apps/dashboard/postcss.config.mjs`](betterbase/apps/dashboard/postcss.config.mjs)
**Purpose:** PostCSS configuration using `@tailwindcss/postcss`.

### [`apps/dashboard/next-env.d.ts`](betterbase/apps/dashboard/next-env.d.ts)
**Purpose:** Next.js TypeScript reference for type checking.

### [`apps/dashboard/src/app/layout.tsx`](betterbase/apps/dashboard/src/app/layout.tsx)
**Purpose:** Root layout component with Inter font and providers.
- **Exports:** `RootLayout` - default export, `metadata` - page metadata
- **Internal Deps:** `@/components/providers`, `@/app/globals.css`

### [`apps/dashboard/src/app/globals.css`](betterbase/apps/dashboard/src/app/globals.css)
**Purpose:** Global CSS with Tailwind import and CSS custom properties for light/dark themes.

### [`apps/dashboard/src/app/(auth)/login/page.tsx`](betterbase/apps/dashboard/src/app/(auth)/login/page.tsx)
**Purpose:** Login page component with card UI.
- **Exports:** `LoginPage` - default export
- **Internal Deps:** `@/components/ui/card`

### [`apps/dashboard/src/app/(auth)/signup/page.tsx`](betterbase/apps/dashboard/src/app/(auth)/signup/page.tsx)
**Purpose:** Signup page component with card UI.
- **Exports:** `SignupPage` - default export
- **Internal Deps:** `@/components/ui/card`

### [`apps/dashboard/src/app/(dashboard)/layout.tsx`](betterbase/apps/dashboard/src/app/(dashboard)/layout.tsx)
**Purpose:** Dashboard layout with sidebar and header.
- **Exports:** `DashboardLayout` - default export
- **Internal Deps:** `@/components/layout/header`, `@/components/layout/sidebar`

### [`apps/dashboard/src/app/(dashboard)/page.tsx`](betterbase/apps/dashboard/src/app/(dashboard)/page.tsx)
**Purpose:** Main dashboard page with stats cards and API usage chart.
- **Exports:** `DashboardPage` - default export
- **Internal Deps:** `@/components/charts/api-usage-chart`, `@/components/ui/card`, `lucide-react`

### [`apps/dashboard/src/app/(dashboard)/api-explorer/page.tsx`](betterbase/apps/dashboard/src/app/(dashboard)/api-explorer/page.tsx)
**Purpose:** API explorer page [stub - ships in Phase 9.3].
- **Exports:** `ApiPage` - default export

### [`apps/dashboard/src/app/(dashboard)/auth/page.tsx`](betterbase/apps/dashboard/src/app/(dashboard)/auth/page.tsx)
**Purpose:** Authentication manager page [stub - ships in Phase 9.4].
- **Exports:** `AuthManagerPage` - default export

### [`apps/dashboard/src/app/(dashboard)/logs/page.tsx`](betterbase/apps/dashboard/src/app/(dashboard)/logs/page.tsx)
**Purpose:** Logs viewer page [stub - ships in Phase 9.5].
- **Exports:** `LogsPage` - default export

### [`apps/dashboard/src/app/(dashboard)/settings/page.tsx`](betterbase/apps/dashboard/src/app/(dashboard)/settings/page.tsx)
**Purpose:** Project settings page.
- **Exports:** `SettingsPage` - default export

### [`apps/dashboard/src/app/(dashboard)/tables/page.tsx`](betterbase/apps/dashboard/src/app/(dashboard)/tables/page.tsx)
**Purpose:** Tables browser page.
- **Exports:** `TablesPage` - default export
- **Internal Deps:** `@/components/tables/table-browser`

### [`apps/dashboard/src/app/(dashboard)/tables/[table]/page.tsx`](betterbase/apps/dashboard/src/app/(dashboard)/tables/[table]/page.tsx)
**Purpose:** Dynamic table editor page.
- **Exports:** `TableDetailPage` - default export (async)
- **Internal Deps:** `@/components/tables/table-editor`

### [`apps/dashboard/src/components/providers.tsx`](betterbase/apps/dashboard/src/components/providers.tsx)
**Purpose:** React Query provider component.
- **Exports:** `Providers` - client component with QueryClientProvider
- **Internal Deps:** `@tanstack/react-query`

### [`apps/dashboard/src/components/charts/api-usage-chart.tsx`](betterbase/apps/dashboard/src/components/charts/api-usage-chart.tsx)
**Purpose:** API usage area chart component using Recharts.
- **Exports:** `ApiUsageChart` - client component

### [`apps/dashboard/src/components/layout/header.tsx`](betterbase/apps/dashboard/src/components/layout/header.tsx)
**Purpose:** Dashboard header with theme toggle, mobile menu, and user dropdown.
- **Exports:** `Header` - client component
- **Internal Deps:** `@/components/layout/sidebar`, `@/components/ui/button`, `@/components/ui/dropdown-menu`, Radix Dialog

### [`apps/dashboard/src/components/layout/sidebar.tsx`](betterbase/apps/dashboard/src/components/layout/sidebar.tsx)
**Purpose:** Dashboard sidebar navigation.
- **Exports:** `Sidebar` - client component, `navigation` - array of nav items
- **Internal Deps:** `@/lib/utils`

### [`apps/dashboard/src/components/tables/table-browser.tsx`](betterbase/apps/dashboard/src/components/tables/table-browser.tsx)
**Purpose:** Table browser component showing list of tables.
- **Exports:** `TableBrowser` - component

### [`apps/dashboard/src/components/tables/table-editor.tsx`](betterbase/apps/dashboard/src/components/tables/table-editor.tsx)
**Purpose:** Table editor component [stub - row editing UI in Phase 9.2].
- **Exports:** `TableEditor` - component

### [`apps/dashboard/src/components/ui/button.tsx`](betterbase/apps/dashboard/src/components/ui/button.tsx)
**Purpose:** Button component with variants using class-variance-authority.
- **Exports:** `Button` - forwardRef component, `ButtonProps` - interface, `buttonVariants` - variant function
- **Internal Deps:** `@/lib/utils`, `@radix-ui/react-slot`, `class-variance-authority`

### [`apps/dashboard/src/components/ui/card.tsx`](betterbase/apps/dashboard/src/components/ui/card.tsx)
**Purpose:** Card component with header, content, footer, description subcomponents.
- **Exports:** `Card`, `CardHeader`, `CardFooter`, `CardTitle`, `CardDescription`, `CardContent` - forwardRef components
- **Internal Deps:** `@/lib/utils`

### [`apps/dashboard/src/components/ui/dropdown-menu.tsx`](betterbase/apps/dashboard/src/components/ui/dropdown-menu.tsx)
**Purpose:** Dropdown menu component wrapping Radix UI primitives.
- **Exports:** `DropdownMenu`, `DropdownMenuTrigger`, `DropdownMenuContent`, `DropdownMenuItem`, `DropdownMenuLabel`, `DropdownMenuSeparator`, `DropdownMenuGroup`, `DropdownMenuPortal`, `DropdownMenuSub`, `DropdownMenuSubContent`, `DropdownMenuSubTrigger`, `DropdownMenuRadioGroup`
- **Internal Deps:** `@/lib/utils`, `@radix-ui/react-dropdown-menu`

### [`apps/dashboard/src/hooks/use-betterbase.ts`](betterbase/apps/dashboard/src/hooks/use-betterbase.ts)
**Purpose:** React Query hook for fetching current user.
- **Exports:** `useCurrentUser` - hook returning UseQueryResult
- **Internal Deps:** `@/lib/betterbase`, `@tanstack/react-query`

### [`apps/dashboard/src/lib/betterbase.ts`](betterbase/apps/dashboard/src/lib/betterbase.ts)
**Purpose:** BetterBase client singleton instance.
- **Exports:** `betterbase` - BetterBaseClient instance
- **Internal Deps:** `@betterbase/client`
- **Env:** `NEXT_PUBLIC_BETTERBASE_URL`

### [`apps/dashboard/src/lib/utils.ts`](betterbase/apps/dashboard/src/lib/utils.ts)
**Purpose:** Utility function for merging Tailwind classes.
- **Exports:** `cn` - class merging function
- **Internal Deps:** `clsx`, `tailwind-merge`

### [`apps/dashboard/src/types/betterbase-client.d.ts`](betterbase/apps/dashboard/src/types/betterbase-client.d.ts)
**Purpose:** TypeScript module declaration for `@betterbase/client`.
- **Exports:** Type declaration for `createClient` function

---

## packages/cli

Canonical `@betterbase/cli` implementation - the `bb` command-line tool.

### [`packages/cli/package.json`](betterbase/packages/cli/package.json)
**Purpose:** Package manifest for CLI.
- **Name:** `@betterbase/cli`
- **Version:** `0.1.0`
- **Bin:** `bb` → `./dist/index.js`
- **Exports:** `.` → `./src/index.ts`
- **Dependencies:** `chalk@^5.3.0`, `commander@^12.1.0`, `inquirer@^10.2.2`, `zod@^3.23.8`

### [`packages/cli/tsconfig.json`](betterbase/packages/cli/tsconfig.json)
**Purpose:** TypeScript config extending base with Bun types.

### [`packages/cli/src/index.ts`](betterbase/packages/cli/src/index.ts)
**Purpose:** Main CLI entry point with Commander.js program setup.
- **Exports:** `createProgram()` - returns configured Commander program, `runCli(argv)` - executes CLI
- **Internal Deps:** `./commands/init`, `./commands/dev`, `./commands/migrate`, `./commands/auth`, `./commands/generate`, `./utils/logger`

### [`packages/cli/src/build.ts`](betterbase/packages/cli/src/build.ts)
**Purpose:** Build script for bundling CLI as standalone executable.
- **Exports:** `buildStandaloneCli()` - builds with Bun.build

### [`packages/cli/src/constants.ts`](betterbase/packages/cli/src/constants.ts)
**Purpose:** Shared constants.
- **Exports:** `DEFAULT_DB_PATH` - `'local.db'`

### [`packages/cli/src/commands/init.ts`](betterbase/packages/cli/src/commands/init.ts)
**Purpose:** `bb init` command - scaffolds new BetterBase projects.
- **Exports:** `runInitCommand(options)` - main command function, `InitCommandOptions` - type
- **Key Functions:** `installDependencies()`, `initializeGitRepository()`, `buildPackageJson()`, `buildDrizzleConfig()`, `buildSchema()`, `buildMigrateScript()`, `buildDbIndex()`, `buildAuthMiddleware()`, `buildReadme()`, `buildRoutesIndex()`, `writeProjectFiles()`
- **Internal Deps:** `../utils/logger`, `../utils/prompts`

### [`packages/cli/src/commands/dev.ts`](betterbase/packages/cli/src/commands/dev.ts)
**Purpose:** `bb dev` command - watches schema/routes and regenerates context.
- **Exports:** `runDevCommand(projectRoot)` - returns cleanup function
- **Internal Deps:** `../utils/context-generator`, `../utils/logger`

### [`packages/cli/src/commands/migrate.ts`](betterbase/packages/cli/src/commands/migrate.ts)
**Purpose:** `bb migrate` commands - generates and applies migrations with safety checks.
- **Exports:** `runMigrateCommand(options)` - main function, `MigrateCommandOptions` - type, `MigrationChange` - interface, `MigrationChangeType` - type
- **Key Functions:** `runDrizzleKit()`, `listSqlFiles()`, `analyzeMigration()`, `displayDiff()`, `confirmDestructive()`, `backupDatabase()`, `restoreBackup()`, `splitStatements()`, `collectChangesFromGenerate()`
- **Internal Deps:** `../constants`, `../utils/logger`, `../utils/prompts`

### [`packages/cli/src/commands/auth.ts`](betterbase/packages/cli/src/commands/auth.ts)
**Purpose:** `bb auth setup` command - scaffolds BetterAuth integration.
- **Exports:** `runAuthSetupCommand(projectRoot)` - main function
- **Key Constants:** `AUTH_SCHEMA_BLOCK` - sessions/accounts tables SQL, `AUTH_ROUTE_FILE` - auth routes template, `AUTH_MIDDLEWARE_FILE` - requireAuth/optionalAuth middleware
- **Key Functions:** `appendIfMissing()`, `ensurePasswordHashColumn()`, `ensureAuthInConfig()`, `ensureEnvVar()`, `ensureRoutesIndexHook()`
- **Internal Deps:** `../utils/logger`

### [`packages/cli/src/commands/generate.ts`](betterbase/packages/cli/src/commands/generate.ts)
**Purpose:** `bb generate crud` command - generates CRUD routes for a table.
- **Exports:** `runGenerateCrudCommand(projectRoot, tableName)` - main function
- **Key Functions:** `toSingular()`, `schemaTypeToZod()`, `buildSchemaShape()`, `buildFilterableColumns()`, `buildFilterCoercers()`, `generateRouteFile()`, `updateMainRouter()`, `ensureRealtimeUtility()`, `ensureZodValidatorInstalled()`
- **Internal Deps:** `../utils/schema-scanner`, `../utils/logger`

### [`packages/cli/src/utils/logger.ts`](betterbase/packages/cli/src/utils/logger.ts)
**Purpose:** Colored console logging utilities.
- **Exports:** `info(message)`, `warn(message)`, `error(message)`, `success(message)`
- **Internal Deps:** `chalk`

### [`packages/cli/src/utils/prompts.ts`](betterbase/packages/cli/src/utils/prompts.ts)
**Purpose:** Interactive prompt utilities wrapping Inquirer.
- **Exports:** `text(options)`, `confirm(options)`, `select(options)`
- **Internal Deps:** `inquirer`, `zod`

### [`packages/cli/src/utils/context-generator.ts`](betterbase/packages/cli/src/utils/context-generator.ts)
**Purpose:** Generates `.betterbase-context.json` for AI agents.
- **Exports:** `ContextGenerator` - class, `BetterBaseContext` - interface
- **Class Methods:** `generate(projectRoot)` - main method, `generateAIPrompt()` - creates AI-readable prompt
- **Internal Deps:** `./route-scanner`, `./schema-scanner`, `./logger`

### [`packages/cli/src/utils/route-scanner.ts`](betterbase/packages/cli/src/utils/route-scanner.ts)
**Purpose:** Scans Hono routes directory and extracts endpoint metadata.
- **Exports:** `RouteScanner` - class, `RouteInfo` - interface
- **Class Methods:** `scan(routesDir)` - main method, `scanFile()` - parses single file, `findSchemaUsage()` - detects Zod schemas
- **Internal Deps:** `typescript` (TS AST parser)

### [`packages/cli/src/utils/scanner.ts`](betterbase/packages/cli/src/utils/scanner.ts)
**Purpose:** Scans Drizzle schema files and extracts table metadata.
- **Exports:** `SchemaScanner` - class, `ColumnInfo` - type, `TableInfo` - type, `ColumnInfoSchema`, `TableInfoSchema`, `TablesRecordSchema` - Zod schemas
- **Class Methods:** `scan()` - main method, `parseTable()`, `parseColumn()`, `parseIndexes()`
- **Internal Deps:** `typescript`, `zod`, `./logger`

### [`packages/cli/src/utils/schema-scanner.ts`](betterbase/packages/cli/src/utils/schema-scanner.ts)
**Purpose:** Re-exports from scanner.ts for cleaner imports.
- **Exports:** `SchemaScanner` - class (re-export), `ColumnInfo` - type (re-export), `TableInfo` - type (re-export)

### [`packages/cli/test/smoke.test.ts`](betterbase/packages/cli/test/smoke.test.ts)
**Purpose:** Basic CLI tests verifying command registration.
- **Tests:** Program name, init argument, generate crud, auth setup, dev, migrate commands

### [`packages/cli/test/scanner.test.ts`](betterbase/packages/cli/test/scanner.test.ts)
**Purpose:** Tests for SchemaScanner.
- **Tests:** Extracts tables, columns, relations, indexes from Drizzle schema

### [`packages/cli/test/context-generator.test.ts`](betterbase/packages/cli/test/context-generator.test.ts)
**Purpose:** Tests for ContextGenerator.
- **Tests:** Creates context from schema/routes, handles missing routes, empty schema, missing schema

### [`packages/cli/test/route-scanner.test.ts`](betterbase/packages/cli/test/route-scanner.test.ts)
**Purpose:** Tests for RouteScanner.
- **Tests:** Extracts Hono routes with auth detection and schema usage

---

## packages/client

`@betterbase/client` - TypeScript SDK for BetterBase backends (like `@supabase/supabase-js`).

### [`packages/client/package.json`](betterbase/packages/client/package.json)
**Purpose:** Package manifest for client SDK.
- **Name:** `@betterbase/client`
- **Version:** `0.1.0`
- **Exports:** ESM and CJS with types
- **Keywords:** betterbase, baas, backend, database, realtime

### [`packages/client/tsconfig.json`](betterbase/packages/client/tsconfig.json)
**Purpose:** TypeScript config with DOM lib for browser compatibility.

### [`packages/client/tsconfig.test.json`](betterbase/packages/client/tsconfig.test.json)
**Purpose:** TypeScript config for test files.

### [`packages/client/README.md`](betterbase/packages/client/README.md)
**Purpose:** Documentation with installation and usage examples.

### [`packages/client/src/index.ts`](betterbase/packages/client/src/index.ts)
**Purpose:** Main entry point - exports all public APIs.
- **Exports:** `createClient`, `BetterBaseClient`, `QueryBuilder`, `AuthClient`, `RealtimeClient`, `BetterBaseError`, `NetworkError`, `AuthError`, `ValidationError`, types

### [`packages/client/src/client.ts`](betterbase/packages/client/src/client.ts)
**Purpose:** Main client class.
- **Exports:** `BetterBaseClient` - class, `createClient(config)` - factory function
- **Class Properties:** `auth` - AuthClient, `realtime` - RealtimeClient
- **Class Methods:** `from(table, options)` - creates QueryBuilder
- **Internal Deps:** `./types`, `./query-builder`, `./auth`, `./realtime`, `zod`

### [`packages/client/src/types.ts`](betterbase/packages/client/src/types.ts)
**Purpose:** Type definitions for client.
- **Exports:** `BetterBaseConfig`, `QueryOptions`, `BetterBaseResponse<T>`, `RealtimeSubscription`, `RealtimeCallback<T>`
- **Internal Deps:** `./errors`

### [`packages/client/src/errors.ts`](betterbase/packages/client/src/errors.ts)
**Purpose:** Error classes for client.
- **Exports:** `BetterBaseError`, `NetworkError`, `AuthError`, `ValidationError` - classes

### [`packages/client/src/query-builder.ts`](betterbase/packages/client/src/query-builder.ts)
**Purpose:** Query builder for type-safe database operations.
- **Exports:** `QueryBuilder<T>` - class, `QueryBuilderOptions` - interface
- **Class Methods:** `select(fields)`, `eq(column, value)`, `in(column, values)`, `limit(count)`, `offset(count)`, `order(column, direction)`, `execute()`, `single(id)`, `insert(data)`, `update(id, data)`, `delete(id)`
- **Internal Deps:** `./types`, `./errors`, `zod`

### [`packages/client/src/auth.ts`](betterbase/packages/client/src/auth.ts)
**Purpose:** Authentication client.
- **Exports:** `AuthClient` - class, `User` - interface, `Session` - interface, `AuthCredentials` - interface
- **Class Methods:** `signUp(credentials)`, `signIn(credentials)`, `signOut()`, `getUser()`, `getToken()`, `setToken(token)`
- **Internal Deps:** `./types`, `./errors`, `zod`

### [`packages/client/src/realtime.ts`](betterbase/packages/client/src/realtime.ts)
**Purpose:** WebSocket realtime client for subscriptions.
- **Exports:** `RealtimeClient` - class
- **Class Methods:** `from(table)` - returns subscription builder, `setToken(token)`, `disconnect()`
- **Internal Deps:** `./types`

### [`packages/client/src/build.ts`](betterbase/packages/client/src/build.ts)
**Purpose:** Build script for ESM, CJS, and type declarations.
- **Builds:** ESM (browser), CJS (node), `.d.ts` via tsc

### [`packages/client/test/client.test.ts`](betterbase/packages/client/test/client.test.ts)
**Purpose:** Tests for client SDK.
- **Tests:** Creates client, from() creates query builder, execute sends requests with headers

---

## packages/core

Core backend engine package [stub - not yet implemented].

### [`packages/core/README.md`](betterbase/packages/core/README.md)
**Purpose:** Placeholder documentation for core engine package.

---

## packages/shared

Shared utilities and types [stub - not yet implemented].

### [`packages/shared/README.md`](betterbase/packages/shared/README.md)
**Purpose:** Documentation with planned contents: common types, utilities, constants, validation schemas, error primitives.

---

## templates/base

Base starter template for BetterBase projects - Bun + Hono + Drizzle + SQLite.

### [`templates/base/package.json`](betterbase/templates/base/package.json)
**Purpose:** Template package manifest.
- **Name:** `betterbase-base-template`
- **Scripts:** `dev` (hot reload), `db:generate`, `db:push`, `typecheck`, `build`, `start`
- **Dependencies:** `hono@^4.6.10`, `drizzle-orm@^0.44.5`, `zod@^4.0.0`, `fast-deep-equal`

### [`templates/base/betterbase.config.ts`](betterbase/templates/base/betterbase.config.ts)
**Purpose:** BetterBase configuration with Zod validation.
- **Exports:** `BetterBaseConfigSchema` - Zod schema, `BetterBaseConfig` - type, `betterbaseConfig` - parsed config

### [`templates/base/drizzle.config.ts`](betterbase/templates/base/drizzle.config.ts)
**Purpose:** Drizzle Kit configuration for SQLite.
- **Exports:** Drizzle config with schema path, migrations folder, dialect, credentials

### [`templates/base/tsconfig.json`](betterbase/templates/base/tsconfig.json)
**Purpose:** TypeScript config extending base with Bun types.

### [`templates/base/.gitignore`](betterbase/templates/base/.gitignore)
**Purpose:** Git ignore patterns for template projects.

### [`templates/base/README.md`](betterbase/templates/base/README.md)
**Purpose:** Template documentation with scripts and usage.

### [`templates/base/src/index.ts`](betterbase/templates/base/src/index.ts)
**Purpose:** Main server entry point with WebSocket support.
- **Exports:** `app` - Hono instance, `server` - Bun server instance
- **Features:** WebSocket endpoint at `/ws`, route registration, graceful shutdown
- **Internal Deps:** `hono`, `./lib/env`, `./lib/realtime`, `./routes`

### [`templates/base/src/db/index.ts`](betterbase/templates/base/src/db/index.ts)
**Purpose:** Database connection and Drizzle ORM setup.
- **Exports:** `db` - Drizzle database instance
- **Internal Deps:** `bun:sqlite`, `drizzle-orm/bun-sqlite`, `./schema`, `../lib/env`

### [`templates/base/src/db/migrate.ts`](betterbase/templates/base/src/db/migrate.ts)
**Purpose:** Migration runner script.
- **Function:** Applies Drizzle migrations from `./drizzle` folder

### [`templates/base/src/db/schema.ts`](betterbase/templates/base/src/db/schema.ts)
**Purpose:** Database schema with helper functions.
- **Exports:** `timestamps` - created_at/updated_at helper, `uuid()` - UUID primary key helper, `softDelete` - deleted_at helper, `statusEnum()` - status enum helper, `moneyColumn()` - cents column helper, `jsonColumn()` - JSON column helper, `users` - users table, `posts` - posts table
- **Internal Deps:** `drizzle-orm/sqlite-core`

### [`templates/base/src/lib/env.ts`](betterbase/templates/base/src/lib/env.ts)
**Purpose:** Environment variable parsing with Zod.
- **Exports:** `env` - parsed environment object, `DEFAULT_DB_PATH` - constant
- **Env:** `NODE_ENV`, `PORT`, `DB_PATH`

### [`templates/base/src/lib/realtime.ts`](betterbase/templates/base/src/lib/realtime.ts)
**Purpose:** WebSocket realtime server for table subscriptions.
- **Exports:** `RealtimeServer` - class, `realtime` - singleton instance, `Subscription` - interface
- **Class Methods:** `authenticate()`, `authorize()`, `handleConnection()`, `handleMessage()`, `handleClose()`, `broadcast()`
- **Internal Deps:** `bun:sqlite`, `fast-deep-equal`, `zod`

### [`templates/base/src/middleware/validation.ts`](betterbase/templates/base/src/middleware/validation.ts)
**Purpose:** Request body validation middleware.
- **Exports:** `parseBody(schema, body)` - validates and returns parsed data or throws HTTPException
- **Internal Deps:** `hono/http-exception`, `zod`

### [`templates/base/src/routes/index.ts`](betterbase/templates/base/src/routes/index.ts)
**Purpose:** Route registration and error handling.
- **Exports:** `registerRoutes(app)` - registers all routes with CORS, logging, error handling
- **Internal Deps:** `hono`, `./health`, `./users`, `../lib/env`

### [`templates/base/src/routes/health.ts`](betterbase/templates/base/src/routes/health.ts)
**Purpose:** Health check endpoint.
- **Exports:** `healthRoute` - Hono instance with GET `/` endpoint
- **Returns:** JSON with status, database connection, timestamp

### [`templates/base/src/routes/users.ts`](betterbase/templates/base/src/routes/users.ts)
**Purpose:** Users CRUD endpoints.
- **Exports:** `usersRoute` - Hono instance, `createUserSchema` - Zod schema
- **Endpoints:** GET `/` (list with pagination), POST `/` (create)
- **Internal Deps:** `../db`, `../db/schema`, `../middleware/validation`

---

## templates/auth

Auth template placeholder [stub - not yet implemented].

### [`templates/auth/README.md`](betterbase/templates/auth/README.md)
**Purpose:** Placeholder for BetterAuth template files.

---

## Config Files (root level)

### [`betterbase/package.json`](betterbase/package.json)
**Purpose:** Root monorepo package manifest.
- **Name:** `betterbase`
- **Package Manager:** `bun@1.3.9`
- **Workspaces:** `apps/*`, `packages/*`
- **Scripts:** `build`, `dev`, `lint`, `typecheck` (via Turbo)
- **Dev Dependencies:** `turbo@^2.0.0`, `typescript@^5.6.0`

### [`betterbase/turbo.json`](betterbase/turbo.json)
**Purpose:** Turborepo task configuration.
- **Tasks:** `build` (with deps), `dev` (persistent, no cache), `lint`, `typecheck` (with deps)

### [`betterbase/tsconfig.base.json`](betterbase/tsconfig.base.json)
**Purpose:** Shared TypeScript configuration for all packages.
- **Settings:** ES2022 target, ESNext module, Bundler resolution, strict mode, declaration enabled

### [`betterbase/README.md`](betterbase/README.md)
**Purpose:** Monorepo documentation with structure, commands, and CLI highlights.

### [`betterbase/.gitignore`](betterbase/.gitignore)
**Purpose:** Root git ignore patterns including node_modules, dist, .env, *.sqlite, .betterbase-context.json.

---

## Key Interfaces & Types Index

### Client Types (`packages/client/src/types.ts`)
- `BetterBaseConfig` - Client configuration (url, key, schema, fetch, storage)
- `QueryOptions` - Query options (limit, offset, orderBy)
- `BetterBaseResponse<T>` - API response wrapper (data, error, count, pagination)
- `RealtimeSubscription` - Subscription handle with unsubscribe method
- `RealtimeCallback<T>` - Callback type for realtime events

### Auth Types (`packages/client/src/auth.ts`)
- `User` - User object (id, email, name)
- `Session` - Session object (token, user)
- `AuthCredentials` - Credentials for signup/signin (email, password, name?)

### CLI Types (`packages/cli/src/commands/init.ts`)
- `InitCommandOptions` - Options for init command
- `DatabaseMode` - 'local' | 'neon' | 'turso'

### Migration Types (`packages/cli/src/commands/migrate.ts`)
- `MigrateCommandOptions` - Options for migrate command
- `MigrationChangeType` - 'create_table' | 'add_column' | 'modify_column' | 'drop_column' | 'drop_table'
- `MigrationChange` - Migration change object

### Scanner Types (`packages/cli/src/utils/scanner.ts`)
- `ColumnInfo` - Column metadata (name, type, nullable, unique, primaryKey, defaultValue, references)
- `TableInfo` - Table metadata (name, columns, relations, indexes)

### Route Scanner Types (`packages/cli/src/utils/route-scanner.ts`)
- `RouteInfo` - Route metadata (method, path, requiresAuth, inputSchema, outputSchema)

### Context Generator Types (`packages/cli/src/utils/context-generator.ts`)
- `BetterBaseContext` - Context file structure (version, generated_at, tables, routes, ai_prompt)

### Template Config Types (`templates/base/betterbase.config.ts`)
- `BetterBaseConfig` - Template config (mode, database, auth)

### Realtime Types (`templates/base/src/lib/realtime.ts`)
- `Subscription` - Subscription object (table, filter)
- `RealtimeUpdatePayload` - Update payload (type, table, event, data, timestamp)
- `RealtimeConfig` - Server config (maxClients, maxSubscriptionsPerClient, maxSubscribersPerTable)

---

## Environment Variables Reference

| Variable | Used In | Description |
|----------|---------|-------------|
| `NODE_ENV` | `templates/base/src/lib/env.ts`, `apps/dashboard/src/lib/betterbase.ts` | Environment mode: 'development', 'test', 'production' |
| `PORT` | `templates/base/src/lib/env.ts` | Server port (default: 3000) |
| `DB_PATH` | `templates/base/src/lib/env.ts`, `packages/cli/src/commands/migrate.ts` | SQLite database file path (default: 'local.db') |
| `DATABASE_URL` | Generated by `bb init` for Neon/Turso | Database connection URL for production |
| `TURSO_AUTH_TOKEN` | Generated by `bb init` for Turso | Auth token for Turso database |
| `AUTH_SECRET` | Generated by `bb auth setup` | Secret key for auth sessions |
| `ENABLE_DEV_AUTH` | `templates/base/src/lib/realtime.ts` | Enable dev auth token parser (default: false in production) |
| `NEXT_PUBLIC_BETTERBASE_URL` | `apps/dashboard/src/lib/betterbase.ts` | BetterBase backend URL for dashboard |

---

## CLI Commands Reference

| Command | Description | Handler File |
|---------|-------------|--------------|
| `bb init [project-name]` | Initialize a new BetterBase project | [`packages/cli/src/commands/init.ts`](betterbase/packages/cli/src/commands/init.ts) |
| `bb dev [project-root]` | Watch schema/routes and regenerate context | [`packages/cli/src/commands/dev.ts`](betterbase/packages/cli/src/commands/dev.ts) |
| `bb migrate` | Generate and apply migrations | [`packages/cli/src/commands/migrate.ts`](betterbase/packages/cli/src/commands/migrate.ts) |
| `bb migrate preview` | Preview migration diff without applying | [`packages/cli/src/commands/migrate.ts`](betterbase/packages/cli/src/commands/migrate.ts) |
| `bb migrate production` | Apply migrations to production | [`packages/cli/src/commands/migrate.ts`](betterbase/packages/cli/src/commands/migrate.ts) |
| `bb auth setup [project-root]` | Scaffold BetterAuth integration | [`packages/cli/src/commands/auth.ts`](betterbase/packages/cli/src/commands/auth.ts) |
| `bb generate crud <table-name> [project-root]` | Generate CRUD routes for a table | [`packages/cli/src/commands/generate.ts`](betterbase/packages/cli/src/commands/generate.ts) |

---

## Notable Findings

### Stubs / Not Yet Implemented
- `packages/core/` - Core backend engine (placeholder only)
- `packages/shared/` - Shared utilities (placeholder only)
- `templates/auth/` - Auth template (placeholder only)
- `apps/dashboard/src/app/(dashboard)/api-explorer/` - API Explorer (Phase 9.3)
- `apps/dashboard/src/app/(dashboard)/auth/` - Auth Manager (Phase 9.4)
- `apps/dashboard/src/app/(dashboard)/logs/` - Logs Viewer (Phase 9.5)
- `apps/dashboard/src/components/tables/table-editor.tsx` - Row editing UI (Phase 9.2)

### Key Architectural Decisions
1. **Monorepo split:** `apps/cli` is a thin wrapper; `packages/cli` is the canonical implementation
2. **AI Context Generation:** Unique BetterBase feature - `.betterbase-context.json` generated from schema/routes
3. **Realtime:** Built into base template via WebSocket at `/ws` with subscription filtering
4. **Migration Safety:** Visual diffs, destructive change warnings, auto-backup before dangerous operations
5. **Auth:** BetterAuth integration scaffolded via CLI, not built into core

### Test Coverage
- CLI: 4 test files covering smoke tests, scanner, context generator, route scanner
- Client: 1 test file covering client creation and query execution
