# BetterBase — Complete Codebase Map
> Auto-generated. Regenerate with: [paste this prompt into Cursor]
> Last updated: 2026-02-20

## Project Identity

**BetterBase** is an AI-native Backend-as-a-Service (BaaS) platform inspired by Supabase. It provides a TypeScript-first developer experience with a focus on AI context generation, Docker-less local development, and zero lock-in. The stack is built on **Bun** (runtime), **Turborepo** (monorepo), **Hono** (API framework), **Drizzle ORM** (database), and **BetterAuth** (authentication: AI-first context). The philosophy emphasizes generation via `.betterbase-context.json`, sub-100ms startup with `bun:sqlite`, user-owned schemas, and strict TypeScript with Zod validation everywhere.

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

## Root-Level Templates (Duplicate)

**Note:** The following templates exist at the repository root level (outside the `betterbase/` monorepo). These appear to be for direct usage or as alternates to the templates in `betterbase/templates/`.

### [`templates/auth/README.md`](templates/auth/README.md)
**Purpose:** Auth template documentation (root level).
- **Usage Patterns:** Developers use this as a reference when setting up authentication in their projects. Provides quick-start guide for BetterAuth integration.
- **Implementation Details:** Documents the complete auth flow with BetterAuth, including environment setup and API endpoints.
- **External Deps:** `better-auth`, `hono`, `zod`

### [`templates/auth/src/auth/index.ts`](templates/auth/src/auth/index.ts)
**Purpose:** Auth module entry point.
- **Usage Patterns:** Imported by routes and middleware to access BetterAuth instance.
- **Implementation Details:** Creates and exports a singleton BetterAuth client instance.
- **External Deps:** `better-auth`, `hono`

### [`templates/auth/src/db/auth-schema.ts`](templates/auth/src/db/auth-schema.ts)
**Purpose:** BetterAuth database schema for SQLite.
- **Usage Patterns:** Used when initializing the database with Drizzle ORM to create auth tables.
- **Implementation Details:** Defines sessions, accounts, and verification tables required by BetterAuth.
- **External Deps:** `drizzle-orm`, `better-auth`

### [`templates/auth/src/db/index.ts`](templates/auth/src/db/index.ts)
**Purpose:** Database connection with auth schema.
- **Usage Patterns:** Imported by the main entry point to establish database connection.
- **Implementation Details:** Sets up SQLite connection using bun:sqlite and exports typed db instance.
- **External Deps:** `bun:sqlite`, `drizzle-orm`

### [`templates/auth/src/db/schema.ts`](templates/auth/src/db/schema.ts)
**Purpose:** Database schema with user table.
- **Usage Patterns:** Defines custom application tables alongside auth schema.
- **Implementation Details:** Includes timestamps helper and user table definition.
- **External Deps:** `drizzle-orm`, `bun:sqlite`

### [`templates/auth/src/middleware/auth.ts`](templates/auth/src/middleware/auth.ts)
**Purpose:** Authentication middleware for Hono routes.
- **Usage Patterns:** Applied to routes that need authentication protection.
- **Implementation Details:** Extracts session from cookies, validates with BetterAuth, attaches user to context.
- **External Deps:** `better-auth`, `hono`
- **Cross-Ref:** [`templates/base/src/middleware/auth.ts`](templates/base/src/middleware/auth.ts)

### [`templates/auth/src/routes/auth.ts`](templates/auth/src/routes/auth.ts)
**Purpose:** Authentication API routes.
- **Usage Patterns:** Handles auth-related HTTP requests (signup, signin, signout, session).
- **Implementation Details:** Delegates to BetterAuth handlers, adds CORS and error handling.
- **External Deps:** `better-auth`, `hono`, `zod`

### [`templates/base/.gitignore`](templates/base/.gitignore)
**Purpose:** Git ignore patterns for base template projects.

---

## apps/cli

Legacy CLI wrapper that forwards execution to the canonical `@betterbase/cli` package.

### [`apps/cli/package.json`](betterbase/apps/cli/package.json)
**Purpose:** Package manifest for legacy CLI wrapper.
- **Name:** `@betterbase/cli-legacy`
- **Bin:** `bb-legacy` → `./dist/index.js`
- **Dependencies:** `@betterbase/cli` (workspace)
- **External Deps:** `@betterbase/cli`

### [`apps/cli/tsconfig.json`](betterbase/apps/cli/tsconfig.json)
**Purpose:** TypeScript config extending base config with Bun types.

### [`apps/cli/README.md`](betterbase/apps/cli/README.md)
**Purpose:** Documents that this is a legacy wrapper; canonical CLI is in `packages/cli`.

### [`apps/cli/src/index.ts`](betterbase/apps/cli/src/index.ts)
**Purpose:** Entry point that forwards to canonical CLI.
- **Exports:** `runLegacyCli()` - async function that imports and calls `runCli()` from `@betterbase/cli`
- **Internal Deps:** `@betterbase/cli`
- **Usage Patterns:** Executed when users run `bb-legacy` command. Serves as a bridge for legacy users.
- **Implementation Details:** Simple wrapper that dynamically imports and delegates to the canonical CLI.
- **External Deps:** `@betterbase/cli`

---

## apps/dashboard

Next.js 15 dashboard application for managing BetterBase backends (like Supabase Studio).

### [`apps/dashboard/package.json`](betterbase/apps/dashboard/package.json)
**Purpose:** Package manifest for dashboard app.
- **Name:** `@betterbase/dashboard`
- **Key Dependencies:** `next@^15.2.0`, `react@^19.0.0`, `@tanstack/react-query@^5.67.0`, `recharts@^2.15.0`, `@betterbase/client` (workspace), `lucide-react`, Radix UI components, `tailwind-merge`, `zod`
- **External Deps:** `next`, `react`, `@tanstack/react-query`, `recharts`, `@betterbase/client`, `lucide-react`, `@radix-ui/react-dialog`, `@radix-ui/react-dropdown-menu`, `@radix-ui/react-slot`, `@radix-ui/react-tabs`, `class-variance-authority`, `clsx`, `tailwind-merge`, `tailwindcss-animate`, `zod`

### [`apps/dashboard/README.md`](betterbase/apps/dashboard/README.md)
**Purpose:** Dashboard application documentation.

### [`apps/dashboard/tsconfig.json`](betterbase/apps/dashboard/tsconfig.json)
**Purpose:** TypeScript config for Next.js with path alias `@/*` → `./src/*`.

### [`apps/dashboard/next.config.ts`](betterbase/apps/dashboard/next.config.ts)
**Purpose:** Next.js configuration with React strict mode enabled.
- **Exports:** `nextConfig` - NextConfig object
- **Usage Patterns:** Loaded by Next.js build system to configure the application.
- **Implementation Details:** Minimal config with React strict mode for development warnings.
- **External Deps:** `next`

### [`apps/dashboard/tailwind.config.ts`](betterbase/apps/dashboard/tailwind.config.ts)
**Purpose:** Tailwind CSS configuration with shadcn/ui-style CSS variables for theming.
- **Exports:** `config` - Tailwind Config with dark mode, custom colors, border radius variables
- **Usage Patterns:** Used by Tailwind build process to generate CSS classes.
- **Implementation Details:** Defines CSS variables for colors, spacing, border radius supporting light/dark themes.
- **External Deps:** `tailwindcss`, `tailwindcss-animate`

### [`apps/dashboard/postcss.config.mjs`](betterbase/apps/dashboard/postcss.config.mjs)
**Purpose:** PostCSS configuration using `@tailwindcss/postcss`.
- **External Deps:** `@tailwindcss/postcss`, `tailwindcss`, `postcss`, `autoprefixer`

### [`apps/dashboard/next-env.d.ts`](betterbase/apps/dashboard/next-env.d.ts)
**Purpose:** Next.js TypeScript reference for type checking.

### [`apps/dashboard/src/app/layout.tsx`](betterbase/apps/dashboard/src/app/layout.tsx)
**Purpose:** Root layout component with Inter font and providers.
- **Exports:** `RootLayout` - default export, `metadata` - page metadata
- **Internal Deps:** `@/components/providers`, `@/app/globals.css`
- **Usage Patterns:** Wraps all pages with providers and applies global styles.
- **Implementation Details:** Uses Inter font from next/font/google, sets up React Query provider.
- **External Deps:** `next/font`, `react`, `@tanstack/react-query`

### [`apps/dashboard/src/app/globals.css`](betterbase/apps/dashboard/src/app/globals.css)
**Purpose:** Global CSS with Tailwind import and CSS custom properties for light/dark themes.

### [`apps/dashboard/src/app/(auth)/login/page.tsx`](betterbase/apps/dashboard/src/app/(auth)/login/page.tsx)
**Purpose:** Login page component with card UI.
- **Exports:** `LoginPage` - default export
- **Internal Deps:** `@/components/ui/card`
- **Usage Patterns:** Rendered when users navigate to `/login`. Uses shadcn/ui card component.
- **External Deps:** `react`, `lucide-react`

### [`apps/dashboard/src/app/(auth)/signup/page.tsx`](betterbase/apps/dashboard/src/app/(auth)/signup/page.tsx)
**Purpose:** Signup page component with card UI.
- **Exports:** `SignupPage` - default export
- **Internal Deps:** `@/components/ui/card`
- **Usage Patterns:** Rendered when users navigate to `/signup`. Uses shadcn/ui card component.
- **External Deps:** `react`, `lucide-react`

### [`apps/dashboard/src/app/(dashboard)/layout.tsx`](betterbase/apps/dashboard/src/app/(dashboard)/layout.tsx)
**Purpose:** Dashboard layout with sidebar and header.
- **Exports:** `DashboardLayout` - default export
- **Internal Deps:** `@/components/layout/header`, `@/components/layout/sidebar`
- **Usage Patterns:** Wraps all dashboard pages with consistent layout structure.
- **External Deps:** `react`

### [`apps/dashboard/src/app/(dashboard)/page.tsx`](betterbase/apps/dashboard/src/app/(dashboard)/page.tsx)
**Purpose:** Main dashboard page with stats cards and API usage chart.
- **Exports:** `DashboardPage` - default export
- **Internal Deps:** `@/components/charts/api-usage-chart`, `@/components/ui/card`, `lucide-react`
- **Usage Patterns:** Landing page for dashboard, shows overview metrics.
- **Implementation Details:** Displays API usage chart with Recharts, stat cards with icons.
- **External Deps:** `react`, `recharts`, `lucide-react`

### [`apps/dashboard/src/app/(dashboard)/api-explorer/page.tsx`](betterbase/apps/dashboard/src/app/(dashboard)/api-explorer/page.tsx)
**Purpose:** API explorer page - interactive REST API testing interface.
- **Exports:** `ApiPage` - default export
- **Features:** Endpoint listing, request builder, response viewer
- **Usage Patterns:** Developers use to test API endpoints directly from the dashboard.
- **Implementation Details:** Lists all available endpoints, provides request builder UI, shows formatted JSON responses.

### [`apps/dashboard/src/app/(dashboard)/auth/page.tsx`](betterbase/apps/dashboard/src/app/(dashboard)/auth/page.tsx)
**Purpose:** Authentication manager page - manage users, sessions, and providers.
- **Exports:** `AuthManagerPage` - default export
- **Features:** User list, session management, provider configuration
- **Usage Patterns:** Admins manage authentication settings and view user sessions.
- **Implementation Details:** Lists users from the auth system, shows active sessions, configures auth providers.

### [`apps/dashboard/src/app/(dashboard)/logs/page.tsx`](betterbase/apps/dashboard/src/app/(dashboard)/logs/page.tsx)
**Purpose:** Logs viewer page - view application and API request logs.
- **Exports:** `LogsPage` - default export
- **Features:** Log filtering, search, export functionality
- **Usage Patterns:** Developers debug issues by viewing application logs.
- **Implementation Details:** Provides filtering by log level, search by message content, export to file.

### [`apps/dashboard/src/app/(dashboard)/settings/page.tsx`](betterbase/apps/dashboard/src/app/(dashboard)/settings/page.tsx)
**Purpose:** Project settings page.
- **Exports:** `SettingsPage` - default export

### [`apps/dashboard/src/app/(dashboard)/tables/page.tsx`](betterbase/apps/dashboard/src/app/(dashboard)/tables/page.tsx)
**Purpose:** Tables browser page.
- **Exports:** `TablesPage` - default export
- **Internal Deps:** `@/components/tables/table-browser`
- **Usage Patterns:** Browse all database tables in the project.
- **External Deps:** `react`

### [`apps/dashboard/src/app/(dashboard)/tables/[table]/page.tsx`](betterbase/apps/dashboard/src/app/(dashboard)/tables/[table]/page.tsx)
**Purpose:** Dynamic table editor page.
- **Exports:** `TableDetailPage` - default export (async)
- **Internal Deps:** `@/components/tables/table-editor`
- **Usage Patterns:** View and edit table data for a specific table.
- **External Deps:** `react`

### [`apps/dashboard/src/components/providers.tsx`](betterbase/apps/dashboard/src/components/providers.tsx)
**Purpose:** React Query provider component.
- **Exports:** `Providers` - client component with QueryClientProvider
- **Internal Deps:** `@tanstack/react-query`
- **Usage Patterns:** Wraps application with React Query context for data fetching.
- **Implementation Details:** Creates QueryClient with default options, provides to entire app tree.
- **External Deps:** `@tanstack/react-query`, `react`

### [`apps/dashboard/src/components/charts/api-usage-chart.tsx`](betterbase/apps/dashboard/src/components/charts/api-usage-chart.tsx)
**Purpose:** API usage area chart component using Recharts.
- **Exports:** `ApiUsageChart` - client component
- **Usage Patterns:** Displays API usage over time as an area chart.
- **Implementation Details:** Uses Recharts AreaChart with gradient fill, responsive container.
- **External Deps:** `recharts`, `react`

### [`apps/dashboard/src/components/layout/header.tsx`](betterbase/apps/dashboard/src/components/layout/header.tsx)
**Purpose:** Dashboard header with theme toggle, mobile menu, and user dropdown.
- **Exports:** `Header` - client component
- **Internal Deps:** `@/components/layout/sidebar`, `@/components/ui/button`, `@/components/ui/dropdown-menu`, Radix Dialog
- **Usage Patterns:** Persistent header across all dashboard pages.
- **Implementation Details:** Uses Radix UI Dialog for mobile menu, DropdownMenu for user actions.
- **External Deps:** `react`, `@radix-ui/react-dialog`, `@radix-ui/react-dropdown-menu`, `lucide-react`

### [`apps/dashboard/src/components/layout/sidebar.tsx`](betterbase/apps/dashboard/src/components/layout/sidebar.tsx)
**Purpose:** Dashboard sidebar navigation.
- **Exports:** `Sidebar` - client component, `navigation` - array of nav items
- **Internal Deps:** `@/lib/utils`
- **Usage Patterns:** Primary navigation for dashboard sections.
- **Implementation Details:** Collapsible sidebar with icons, active state highlighting.
- **External Deps:** `react`, `lucide-react`, `clsx`, `tailwind-merge`

### [`apps/dashboard/src/components/tables/table-browser.tsx`](betterbase/apps/dashboard/src/components/tables/table-browser.tsx)
**Purpose:** Table browser component showing list of tables.
- **Exports:** `TableBrowser` - component
- **Usage Patterns:** Displays list of database tables user can select from.
- **External Deps:** `react`, `lucide-react`

### [`apps/dashboard/src/components/tables/table-editor.tsx`](betterbase/apps/dashboard/src/components/tables/table-editor.tsx)
**Purpose:** Table editor component [stub - row editing UI in Phase 9.2].
- **Exports:** `TableEditor` - component
- **Usage Patterns:** Edit individual rows within a table (Phase 9.2 feature).
- **External Deps:** `react`

### [`apps/dashboard/src/components/ui/button.tsx`](betterbase/apps/dashboard/src/components/ui/button.tsx)
**Purpose:** Button component with variants using class-variance-authority.
- **Exports:** `Button` - forwardRef component, `ButtonProps` - interface, `buttonVariants` - variant function
- **Internal Deps:** `@/lib/utils`, `@radix-ui/react-slot`, `class-variance-authority`
- **Usage Patterns:** Reusable button across all dashboard components with variant support.
- **Implementation Details:** Uses cva for variant definitions, supports default, destructive, outline, secondary, ghost, link variants.
- **External Deps:** `react`, `class-variance-authority`, `@radix-ui/react-slot`

### [`apps/dashboard/src/components/ui/card.tsx`](betterbase/apps/dashboard/src/components/ui/card.tsx)
**Purpose:** Card component with header, content, footer, description subcomponents.
- **Exports:** `Card`, `CardHeader`, `CardFooter`, `CardTitle`, `CardDescription`, `CardContent` - forwardRef components
- **Internal Deps:** `@/lib/utils`
- **Usage Patterns:** Container for grouped content with consistent styling.
- **External Deps:** `react`, `clsx`, `tailwind-merge`

### [`apps/dashboard/src/components/ui/dropdown-menu.tsx`](betterbase/apps/dashboard/src/components/ui/dropdown-menu.tsx)
**Purpose:** Dropdown menu component wrapping Radix UI primitives.
- **Exports:** `DropdownMenu`, `DropdownMenuTrigger`, `DropdownMenuContent`, `DropdownMenuItem`, `DropdownMenuLabel`, `DropdownMenuSeparator`, `DropdownMenuGroup`, `DropdownMenuPortal`, `DropdownMenuSub`, `DropdownMenuSubContent`, `DropdownMenuSubTrigger`, `DropdownMenuRadioGroup`
- **Internal Deps:** `@/lib/utils`, `@radix-ui/react-dropdown-menu`
- **Usage Patterns:** Accessible dropdown menus for actions, selections.
- **Implementation Details:** Thin wrapper around Radix UI DropdownMenu with Tailwind styling.
- **External Deps:** `react`, `@radix-ui/react-dropdown-menu`, `clsx`, `tailwind-merge`

### [`apps/dashboard/src/hooks/use-betterbase.ts`](betterbase/apps/dashboard/src/hooks/use-betterbase.ts)
**Purpose:** React Query hook for fetching current user.
- **Exports:** `useCurrentUser` - hook returning UseQueryResult
- **Internal Deps:** `@/lib/betterbase`, `@tanstack/react-query`
- **Usage Patterns:** Used by components that need authenticated user data.
- **Implementation Details:** Wraps client.auth.getUser() in useQuery for caching and refetching.
- **External Deps:** `@tanstack/react-query`, `@betterbase/client`

### [`apps/dashboard/src/lib/betterbase.ts`](betterbase/apps/dashboard/src/lib/betterbase.ts)
**Purpose:** BetterBase client singleton instance.
- **Exports:** `betterbase` - BetterBaseClient instance
- **Internal Deps:** `@betterbase/client`
- **Env:** `NEXT_PUBLIC_BETTERBASE_URL`
- **Usage Patterns:** Imported throughout dashboard to interact with BetterBase backend.
- **Implementation Details:** Creates client with environment variable for backend URL.
- **External Deps:** `@betterbase/client`

### [`apps/dashboard/src/lib/utils.ts`](betterbase/apps/dashboard/src/lib/utils.ts)
**Purpose:** Utility function for merging Tailwind classes.
- **Exports:** `cn` - class merging function
- **Internal Deps:** `clsx`, `tailwind-merge`
- **Usage Patterns:** Used by all UI components to merge Tailwind classes conditionally.
- **Implementation Details:** Combines clsx and tailwind-merge for robust class string merging.
- **External Deps:** `clsx`, `tailwind-merge`

### [`apps/dashboard/src/types/betterbase-client.d.ts`](betterbase/apps/dashboard/src/types/betterbase-client.d.ts)
**Purpose:** TypeScript module declaration for `@betterbase/client`.
- **Exports:** Type declaration for `createClient` function
- **Usage Patterns:** Provides type checking for the BetterBase client library.
- **Implementation Details:** Module augmentation for the client package types.

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
- **External Deps:** `chalk`, `commander`, `inquirer`, `zod`

### [`packages/cli/tsconfig.json`](betterbase/packages/cli/tsconfig.json)
**Purpose:** TypeScript config extending base with Bun types.

### [`packages/cli/src/index.ts`](betterbase/packages/cli/src/index.ts)
**Purpose:** Main CLI entry point with Commander.js program setup.
- **Exports:** `createProgram()` - returns configured Commander program, `runCli(argv)` - executes CLI
- **Internal Deps:** `./commands/init`, `./commands/dev`, `./commands/migrate`, `./commands/auth`, `./commands/generate`, `./utils/logger`
- **Usage Patterns:** Entry point executed when `bb` command is run. Sets up all subcommands.
- **Implementation Details:** Uses Commander.js for CLI structure, defines global options, registers all commands.
- **External Deps:** `commander`, `chalk`

### [`packages/cli/src/build.ts`](betterbase/packages/cli/src/build.ts)
**Purpose:** Build script for bundling CLI as standalone executable.
- **Exports:** `buildStandaloneCli()` - builds with Bun.build
- **Usage Patterns:** Called during package build to create distributable CLI.
- **Implementation Details:** Uses Bun.build to bundle CLI into single executable.
- **External Deps:** `bun`

### [`packages/cli/src/constants.ts`](betterbase/packages/cli/src/constants.ts)
**Purpose:** Shared constants.
- **Exports:** `DEFAULT_DB_PATH` - `'local.db'`
- **Usage Patterns:** Referenced by CLI commands for default values.
- **External Deps:** None (constants only)

### [`packages/cli/src/commands/init.ts`](betterbase/packages/cli/src/commands/init.ts)
**Purpose:** `bb init` command - scaffolds new BetterBase projects.
- **Exports:** `runInitCommand(options)` - main command function, `InitCommandOptions` - type
- **Key Functions:** `installDependencies()`, `initializeGitRepository()`, `buildPackageJson()`, `buildDrizzleConfig()`, `buildSchema()`, `buildMigrateScript()`, `buildDbIndex()`, `buildAuthMiddleware()`, `buildReadme()`, `buildRoutesIndex()`, `writeProjectFiles()`
- **Internal Deps:** `../utils/logger`, `../utils/prompts`
- **Usage Patterns:** Typically called by developers starting a new project. Uses interactive prompts to gather project name, database mode, and options. Creates a complete project structure with sensible defaults.
- **Implementation Details:** Uses Inquirer for interactive prompts, writes files synchronously using fs module. Supports three database modes: local (SQLite), neon (PostgreSQL), turso (LibSQL). Generates Zod-validated config. Implements file templating with template literals for code generation.
- **External Deps:** `inquirer`, `zod`, `chalk`
- **Cross-Ref:** [`packages/cli/src/utils/prompts.ts`](packages/cli/src/utils/prompts.ts), [`templates/base/`](templates/base/)

### [`packages/cli/src/commands/dev.ts`](betterbase/packages/cli/src/commands/dev.ts)
**Purpose:** `bb dev` command - watches schema/routes and regenerates context.
- **Exports:** `runDevCommand(projectRoot)` - returns cleanup function
- **Internal Deps:** `../utils/context-generator`, `../utils/logger`
- **Usage Patterns:** Runs during development to continuously regenerate `.betterbase-context.json` as files change.
- **Implementation Details:** Sets up file watchers on schema and routes directories, triggers context regeneration on changes. Returns cleanup function to stop watchers.
- **External Deps:** `bun`, `chalk`
- **Cross-Ref:** [`packages/cli/src/utils/context-generator.ts`](packages/cli/src/utils/context-generator.ts)

### [`packages/cli/src/commands/migrate.ts`](betterbase/packages/cli/src/commands/migrate.ts)
**Purpose:** `bb migrate` commands - generates and applies migrations with safety checks.
- **Exports:** `runMigrateCommand(options)` - main function, `MigrateCommandOptions` - type, `MigrationChange` - interface, `MigrationChangeType` - type
- **Key Functions:** `runDrizzleKit()`, `listSqlFiles()`, `analyzeMigration()`, `displayDiff()`, `confirmDestructive()`, `backupDatabase()`, `restoreBackup()`, `splitStatements()`, `collectChangesFromGenerate()`
- **Internal Deps:** `../constants`, `../utils/logger`, `../utils/prompts`
- **Usage Patterns:** Called during database schema changes. Generates migration files, optionally previews changes, applies with safety checks.
- **Implementation Details:** Wraps DrizzleKit for migration generation. Implements visual diff display with color-coded changes. Prompts for confirmation on destructive operations. Creates automatic backups before dangerous migrations. Parses SQL files to extract migration metadata.
- **External Deps:** `drizzle-orm`, `drizzle-kit`, `inquirer`, `chalk`, `zod`

### [`packages/cli/src/commands/auth.ts`](betterbase/packages/cli/src/commands/auth.ts)
**Purpose:** `bb auth setup` command - scaffolds BetterAuth integration.
- **Exports:** `runAuthSetupCommand(projectRoot)` - main function
- **Key Constants:** `AUTH_SCHEMA_BLOCK` - sessions/accounts tables SQL, `AUTH_ROUTE_FILE` - auth routes template, `AUTH_MIDDLEWARE_FILE` - requireAuth/optionalAuth middleware
- **Key Functions:** `appendIfMissing()`, `ensurePasswordHashColumn()`, `ensureAuthInConfig()`, `ensureEnvVar()`, `ensureRoutesIndexHook()`
- **Internal Deps:** `../utils/logger`
- **Usage Patterns:** Run after project initialization to add authentication. Modifies existing files to integrate BetterAuth.
- **Implementation Details:** Injects SQL schema blocks into existing schema file, adds auth routes to routes index, creates auth middleware. Uses file patching rather than full file generation for integration.
- **External Deps:** `better-auth`, `chalk`
- **Cross-Ref:** [`templates/auth/`](templates/auth/)

### [`packages/cli/src/commands/generate.ts`](betterbase/packages/cli/src/commands/generate.ts)
**Purpose:** `bb generate crud` command - generates CRUD routes for a table.
- **Exports:** `runGenerateCrudCommand(projectRoot, tableName)` - main function
- **Key Functions:** `toSingular()`, `schemaTypeToZod()`, `buildSchemaShape()`, `buildFilterableColumns()`, `buildFilterCoercers()`, `generateRouteFile()`, `updateMainRouter()`, `ensureRealtimeUtility()`, `ensureZodValidatorInstalled()`
- **Internal Deps:** `../utils/schema-scanner`, `../utils/logger`
- **Usage Patterns:** Called after creating a database table to auto-generate REST API routes. Saves developers from writing boilerplate CRUD code.
- **Implementation Details:** Scans Drizzle schema to understand table structure. Maps Drizzle column types to Zod schemas. Generates Hono routes with type-safe handlers. Updates route index to register new endpoints.
- **External Deps:** `zod`, `hono`, `drizzle-orm`, `chalk`
- **Cross-Ref:** [`packages/cli/src/utils/scanner.ts`](packages/cli/src/utils/scanner.ts)

### [`packages/cli/src/utils/logger.ts`](betterbase/packages/cli/src/utils/logger.ts)
**Purpose:** Colored console logging utilities.
- **Exports:** `info(message)`, `warn(message)`, `error(message)`, `success(message)`
- **Internal Deps:** `chalk`
- **Usage Patterns:** Used throughout CLI commands for consistent, colored output.
- **Implementation Details:** Thin wrapper around Chalk with pre-configured color schemes. Info = cyan, Warn = yellow, Error = red, Success = green.
- **External Deps:** `chalk`

### [`packages/cli/src/utils/prompts.ts`](betterbase/packages/cli/src/utils/prompts.ts)
**Purpose:** Interactive prompt utilities wrapping Inquirer.
- **Exports:** `text(options)`, `confirm(options)`, `select(options)`
- **Internal Deps:** `inquirer`, `zod`
- **Usage Patterns:** Used by CLI commands that need user input during execution.
- **Implementation Details:** Wraps Inquirer with Zod validation on input. Provides typed promise-based API.
- **External Deps:** `inquirer`, `zod`

### [`packages/cli/src/utils/context-generator.ts`](betterbase/packages/cli/src/utils/context-generator.ts)
**Purpose:** Generates `.betterbase-context.json` for AI agents.
- **Exports:** `ContextGenerator` - class, `BetterBaseContext` - interface
- **Class Methods:** `generate(projectRoot)` - main method, `generateAIPrompt()` - creates AI-readable prompt
- **Internal Deps:** `./route-scanner`, `./schema-scanner`, `./logger`
- **Usage Patterns:** Called during `bb dev` or `bb generate` to create context file. Used by AI assistants to understand the project structure.
- **Implementation Details:** Scans schema and routes, aggregates metadata, outputs JSON file with tables, routes, and AI-readable prompt. The AI prompt helps contextualize the project for LLM-based development assistance.
- **External Deps:** `typescript`, `zod`, `chalk`
- **Cross-Ref:** [`packages/cli/src/utils/route-scanner.ts`](packages/cli/src/utils/route-scanner.ts), [`packages/cli/src/utils/scanner.ts`](packages/cli/src/utils/scanner.ts)

### [`packages/cli/src/utils/route-scanner.ts`](betterbase/packages/cli/src/utils/route-scanner.ts)
**Purpose:** Scans Hono routes directory and extracts endpoint metadata.
- **Exports:** `RouteScanner` - class, `RouteInfo` - interface
- **Class Methods:** `scan(routesDir)` - main method, `scanFile()` - parses single file, `findSchemaUsage()` - detects Zod schemas
- **Internal Deps:** `typescript` (TS AST parser)
- **Usage Patterns:** Used by context generator to discover all API endpoints in the project.
- **Implementation Details:** Uses TypeScript compiler API to parse route files. Extracts HTTP method, path, auth requirements, and Zod schemas. Handles Hono's chainable API pattern detection.
- **External Deps:** `typescript`

### [`packages/cli/src/utils/scanner.ts`](betterbase/packages/cli/src/utils/scanner.ts)
**Purpose:** Scans Drizzle schema files and extracts table metadata.
- **Exports:** `SchemaScanner` - class, `ColumnInfo` - type, `TableInfo` - type, `ColumnInfoSchema`, `TableInfoSchema`, `TablesRecordSchema` - Zod schemas
- **Class Methods:** `scan()` - main method, `parseTable()`, `parseColumn()`, `parseIndexes()`
- **Internal Deps:** `typescript`, `zod`, `./logger`
- **Usage Patterns:** Used by generate command and context generator to understand database schema.
- **Implementation Details:** Parses TypeScript schema files using TypeScript compiler API. Extracts table names, column definitions, relations, indexes. Returns typed metadata for code generation.
- **External Deps:** `typescript`, `zod`

### [`packages/cli/src/utils/schema-scanner.ts`](betterbase/packages/cli/src/utils/schema-scanner.ts)
**Purpose:** Re-exports from scanner.ts for cleaner imports.
- **Exports:** `SchemaScanner` - class (re-export), `ColumnInfo` - type (re-export), `TableInfo` - type (re-export)
- **Usage Patterns:** Import point for schema scanning functionality.
- **External Deps:** None (re-exports)

### [`packages/cli/test/smoke.test.ts`](betterbase/packages/cli/test/smoke.test.ts)
**Purpose:** Basic CLI tests verifying command registration.
- **Tests:** Program name, init argument, generate crud, auth setup, dev, migrate commands
- **Usage Patterns:** Smoke tests run in CI to verify CLI is functional after changes.

### [`packages/cli/test/scanner.test.ts`](betterbase/packages/cli/test/scanner.test.ts)
**Purpose:** Tests for SchemaScanner.
- **Tests:** Extracts tables, columns, relations, indexes from Drizzle schema
- **Usage Patterns:** Unit tests for scanner module.

### [`packages/cli/test/context-generator.test.ts`](betterbase/packages/cli/test/context-generator.test.ts)
**Purpose:** Tests for ContextGenerator.
- **Tests:** Creates context from schema/routes, handles missing routes, empty schema, missing schema
- **Usage Patterns:** Unit tests for context generation.

### [`packages/cli/test/route-scanner.test.ts`](betterbase/packages/cli/test/route-scanner.test.ts)
**Purpose:** Tests for RouteScanner.
- **Tests:** Extracts Hono routes with auth detection and schema usage
- **Usage Patterns:** Unit tests for route scanning.

---

## packages/client

`@betterbase/client` - TypeScript SDK for BetterBase backends (like `@supabase/supabase-js`).

### [`packages/client/package.json`](betterbase/packages/client/package.json)
**Purpose:** Package manifest for client SDK.
- **Name:** `@betterbase/client`
- **Version:** `0.1.0`
- **Exports:** ESM and CJS with types
- **Keywords:** betterbase, baas, backend, database, realtime
- **Dependencies:** `better-auth@^1.0.0`
- **External Deps:** `better-auth`

### [`packages/client/tsconfig.json`](betterbase/packages/client/tsconfig.json)
**Purpose:** TypeScript config with DOM lib for browser compatibility.

### [`packages/client/tsconfig.test.json`](betterbase/packages/client/tsconfig.test.json)
**Purpose:** TypeScript config for test files.

### [`packages/client/README.md`](betterbase/packages/client/README.md)
**Purpose:** Documentation with installation and usage examples.

### [`packages/client/src/index.ts`](betterbase/packages/client/src/index.ts)
**Purpose:** Main entry point - exports all public APIs.
- **Exports:** `createClient`, `BetterBaseClient`, `QueryBuilder`, `AuthClient`, `RealtimeClient`, `BetterBaseError`, `NetworkError`, `AuthError`, `ValidationError`, types
- **Usage Patterns:** Primary import point for the SDK.
- **Implementation Details:** Barrel file re-exporting all public types and classes.

### [`packages/client/src/client.ts`](betterbase/packages/client/src/client.ts)
**Purpose:** Main client class.
- **Exports:** `BetterBaseClient` - class, `createClient(config)` - factory function
- **Class Properties:** `auth` - AuthClient, `realtime` - RealtimeClient
- **Class Methods:** `from(table, options)` - creates QueryBuilder
- **Internal Deps:** `./types`, `./query-builder`, `./auth`, `./realtime`, `zod`
- **Usage Patterns:** Created once per application, provides access to auth, database, and realtime features.
- **Implementation Details:** Singleton pattern. Provides `from()` method for query building. Manages auth state and realtime subscriptions.
- **External Deps:** `zod`, `better-auth`

```typescript
// Usage Example:
import { createClient } from "@betterbase/client"

const client = createClient({
  url: "http://localhost:3000",
  key: "public-anon-key",
})

// Query data
const { data } = await client.from("users").select("*").execute()

// Authenticate
await client.auth.signIn.email("user@example.com", "password")
```

### [`packages/client/src/types.ts`](betterbase/packages/client/src/types.ts)
**Purpose:** Type definitions for client.
- **Exports:** `BetterBaseConfig`, `QueryOptions`, `BetterBaseResponse<T>`, `RealtimeSubscription`, `RealtimeCallback<T>`
- **Internal Deps:** `./errors`
- **Usage Patterns:** Imported for type annotations in user code.
- **External Deps:** None (types only)

### [`packages/client/src/errors.ts`](betterbase/packages/client/src/errors.ts)
**Purpose:** Error classes for client.
- **Exports:** `BetterBaseError`, `NetworkError`, `AuthError`, `ValidationError` - classes
- **Usage Patterns:** Caught by applications for error handling.
- **Implementation Details:** Custom error classes with cause chain support. AuthError for auth failures, NetworkError for connection issues, ValidationError for input validation errors.

### [`packages/client/src/query-builder.ts`](betterbase/packages/client/src/query-builder.ts)
**Purpose:** Query builder for type-safe database operations.
- **Exports:** `QueryBuilder<T>` - class, `QueryBuilderOptions` - interface
- **Class Methods:** `select(fields)`, `eq(column, value)`, `in(column, values)`, `limit(count)`, `offset(count)`, `order(column, direction)`, `execute()`, `single(id)`, `insert(data)`, `update(id, data)`, `delete(id)`
- **Internal Deps:** `./types`, `./errors`, `zod`
- **Usage Patterns:** Chain method calls to build queries, call execute() to send request.
- **Implementation Details:** Fluent builder pattern. Generates REST API calls to the backend. Uses Zod for response validation.
- **External Deps:** `zod`

```typescript
// Usage Example:
const { data, error } = await client
  .from("users")
  .select("id", "email", "name")
  .eq("status", "active")
  .order("createdAt", "desc")
  .limit(10)
  .execute()
```

### [`packages/client/src/auth.ts`](betterbase/packages/client/src/auth.ts)
**Purpose:** Authentication client.
- **Exports:** `AuthClient` - class, `User` - interface, `Session` - interface, `AuthCredentials` - interface
- **Class Methods:** `signUp(credentials)`, `signIn(credentials)`, `signOut()`, `getUser()`, `getToken()`, `setToken(token)`
- **Internal Deps:** `./types`, `./errors`, `zod`
- **Usage Patterns:** Handle user authentication flows - signup, signin, signout, session management.
- **Implementation Details:** Delegates to BetterAuth. Manages session cookies/tokens. Provides typed methods for auth operations.
- **External Deps:** `better-auth`, `zod`

### [`packages/client/src/realtime.ts`](betterbase/packages/client/src/realtime.ts)
**Purpose:** WebSocket realtime client for subscriptions.
- **Exports:** `RealtimeClient` - class
- **Class Methods:** `from(table)` - returns subscription builder, `setToken(token)`, `disconnect()`
- **Internal Deps:** `./types`
- **Usage Patterns:** Subscribe to database changes for real-time updates.
- **Implementation Details:** Manages WebSocket connection to `/ws` endpoint. Supports filtering by table and column values.
- **External Deps:** None (WebSocket native)

### [`packages/client/src/build.ts`](betterbase/packages/client/src/build.ts)
**Purpose:** Build script for ESM, CJS, and type declarations.
- **Builds:** ESM (browser), CJS (node), `.d.ts` via tsc
- **Usage Patterns:** Called during package build process.
- **Implementation Details:** Uses tsc for type generation, outputs both ESM and CJS formats.

### [`packages/client/test/client.test.ts`](betterbase/packages/client/test/client.test.ts)
**Purpose:** Tests for client SDK.
- **Tests:** Creates client, from() creates query builder, execute sends requests with headers

---

## packages/core

Core backend engine package - framework for building BetterBase-compatible backends.

### [`packages/core/package.json`](betterbase/packages/core/package.json)
**Purpose:** Package manifest for core engine.
- **Name:** `@betterbase/core`
- **Version:** `0.1.0`
- **Dependencies:** `hono`, `drizzle-orm`, `zod`
- **External Deps:** `hono`, `drizzle-orm`, `zod`, `@betterbase/shared`

### [`packages/core/README.md`](betterbase/packages/core/README.md)
**Purpose:** Core engine package documentation.

### [`packages/core/tsconfig.json`](betterbase/packages/core/tsconfig.json)
**Purpose:** TypeScript config extending base with Bun types.

### [`packages/core/src/index.ts`](betterbase/packages/core/src/index.ts)
**Purpose:** Main entry point for core package.
- **Exports:** Re-exports from submodules
- **Usage Patterns:** Main import point for core functionality.
- **Implementation Details:** Barrel file with re-exports from all submodules.

### [`packages/core/src/config/index.ts`](betterbase/packages/core/src/config/index.ts)
**Purpose:** Configuration module entry point.
- **Usage Patterns:** Import config schemas and loaders.

### [`packages/core/src/config/schema.ts`](betterbase/packages/core/src/config/schema.ts)
**Purpose:** Configuration schema validation.
- **Exports:** Configuration types and Zod schemas
- **Usage Patterns:** Validate project configuration files.
- **Implementation Details:** Zod schemas for validating betterbase.config.ts files.

### [`packages/core/src/functions/index.ts`](betterbase/packages/core/src/functions/index.ts)
**Purpose:** Edge functions module entry point.
- **Usage Patterns:** Define and deploy edge functions.

### [`packages/core/src/graphql/index.ts`](betterbase/packages/core/src/graphql/index.ts)
**Purpose:** GraphQL API module entry point.
- **Usage Patterns:** Set up GraphQL API endpoint.

### [`packages/core/src/middleware/index.ts`](betterbase/packages/core/src/middleware/index.ts)
**Purpose:** Middleware module entry point.
- **Usage Patterns:** Register application middleware.

### [`packages/core/src/migration/index.ts`](betterbase/packages/core/src/migration/index.ts)
**Purpose:** Database migration module entry point.
- **Usage Patterns:** Run database migrations.

### [`packages/core/src/providers/index.ts`](betterbase/packages/core/src/providers/index.ts)
**Purpose:** External providers module entry point.
- **Usage Patterns:** Configure external services (email, storage, etc.).

### [`packages/core/src/providers/types.ts`](betterbase/packages/core/src/providers/types.ts)
**Purpose:** Provider type definitions.
- **Exports:** Provider interfaces and types
- **Usage Patterns:** Implement custom providers.

### [`packages/core/src/rls/index.ts`](betterbase/packages/core/src/rls/index.ts)
**Purpose:** Row-Level Security module entry point.
- **Usage Patterns:** Define RLS policies.

### [`packages/core/src/storage/index.ts`](betterbase/packages/core/src/storage/index.ts)
**Purpose:** Storage module entry point.
- **Usage Patterns:** Manage file storage.

### [`packages/core/src/webhooks/index.ts`](betterbase/packages/core/src/webhooks/index.ts)
**Purpose:** Webhooks module entry point.
- **Usage Patterns:** Define and handle webhooks.

---

## packages/shared

Shared utilities and types used across BetterBase packages.

### [`packages/shared/package.json`](betterbase/packages/shared/package.json)
**Purpose:** Package manifest for shared utilities.
- **Name:** `@betterbase/shared`
- **Version:** `0.1.0`
- **Dependencies:** `zod`
- **External Deps:** `zod`

### [`packages/shared/README.md`](betterbase/packages/shared/README.md)
**Purpose:** Shared utilities package documentation.

### [`packages/shared/tsconfig.json`](betterbase/packages/shared/tsconfig.json)
**Purpose:** TypeScript config extending base.

### [`packages/shared/src/index.ts`](betterbase/packages/shared/src/index.ts)
**Purpose:** Main entry point - exports all public APIs.
- **Exports:** Re-exports from submodules
- **Usage Patterns:** Central import for shared types and utilities.

### [`packages/shared/src/constants.ts`](betterbase/packages/shared/src/constants.ts)
**Purpose:** Shared constants across packages.
- **Exports:** Common constants
- **Usage Patterns:** Reference shared constant values.

### [`packages/shared/src/errors.ts`](betterbase/packages/shared/src/errors.ts)
**Purpose:** Shared error classes.
- **Exports:** `BetterBaseError`, error factory functions
- **Usage Patterns:** Use consistent error types across packages.

### [`packages/shared/src/types.ts`](betterbase/packages/shared/src/types.ts)
**Purpose:** Shared type definitions.
- **Exports:** Common TypeScript interfaces and types
- **Usage Patterns:** Import shared types for consistency.

### [`packages/shared/src/utils.ts`](betterbase/packages/shared/src/utils.ts)
**Purpose:** Shared utility functions.
- **Exports:** Common utility functions
- **Usage Patterns:** Use shared utility functions to avoid duplication.

---

## templates/base

Base starter template for BetterBase projects - Bun + Hono + Drizzle + SQLite.

### [`templates/base/package.json`](betterbase/templates/base/package.json)
**Purpose:** Template package manifest.
- **Name:** `betterbase-base-template`
- **Scripts:** `dev` (hot reload), `db:generate`, `db:push`, `typecheck`, `build`, `start`
- **Dependencies:** `hono@^4.6.10`, `drizzle-orm@^0.44.5`, `zod@^4.0.0`, `fast-deep-equal`
- **External Deps:** `hono`, `drizzle-orm`, `zod`, `fast-deep-equal`, `better-auth`

### [`templates/base/betterbase.config.ts`](betterbase/templates/base/betterbase.config.ts)
**Purpose:** BetterBase configuration with Zod validation.
- **Exports:** `BetterBaseConfigSchema` - Zod schema, `BetterBaseConfig` - type, `betterbaseConfig` - parsed config
- **Usage Patterns:** Loaded at runtime to configure the application behavior.
- **Implementation Details:** Zod schema validates configuration at startup. Supports database mode, auth settings.
- **External Deps:** `zod`

### [`templates/base/drizzle.config.ts`](betterbase/templates/base/drizzle.config.ts)
**Purpose:** Drizzle Kit configuration for SQLite.
- **Exports:** Drizzle config with schema path, migrations folder, dialect, credentials
- **Usage Patterns:** Used by Drizzle Kit CLI commands.
- **External Deps:** `drizzle-orm`, `drizzle-kit`

### [`templates/base/tsconfig.json`](betterbase/templates/base/tsconfig.json)
**Purpose:** TypeScript config extending base with Bun types.

### [`templates/base/.gitignore`](betterbase/templates/base/.gitignore)
**Purpose:** Git ignore patterns for template projects.

### [`templates/base/tsconfig.json`](betterbase/templates/base/tsconfig.json)
**Purpose:** TypeScript config extending base with Bun types.

### [`templates/base/README.md`](betterbase/templates/base/README.md)
**Purpose:** Template documentation with scripts and usage.

### [`templates/base/src/index.ts`](betterbase/templates/base/src/index.ts)
**Purpose:** Main server entry point with WebSocket support.
- **Exports:** `app` - Hono instance, `server` - Bun server instance
- **Features:** WebSocket endpoint at `/ws`, route registration, graceful shutdown
- **Internal Deps:** `hono`, `./lib/env`, `./lib/realtime`, `./routes`
- **Usage Patterns:** Entry point for running the server. Starts both HTTP and WebSocket servers.
- **Implementation Details:** Creates Bun server with WebSocket upgrade. Registers all routes with middleware stack. Handles graceful shutdown on SIGTERM.
- **External Deps:** `hono`, `bun`

```typescript
// Usage Example:
import { app, server } from "./src/index"

console.log(`Server running at http://localhost:${server.port}`)
```

### [`templates/base/src/db/index.ts`](betterbase/templates/base/src/db/index.ts)
**Purpose:** Database connection and Drizzle ORM setup.
- **Exports:** `db` - Drizzle database instance
- **Internal Deps:** `bun:sqlite`, `drizzle-orm/bun-sqlite`, `./schema`, `../lib/env`
- **Usage Patterns:** Import `db` instance to perform database operations.
- **Implementation Details:** Creates SQLite connection using bun:sqlite. Exports typed Drizzle instance.
- **External Deps:** `drizzle-orm`, `bun`

### [`templates/base/src/db/migrate.ts`](betterbase/templates/base/src/db/migrate.ts)
**Purpose:** Migration runner script.
- **Function:** Applies Drizzle migrations from `./drizzle` folder
- **Usage Patterns:** Run `bun run db:push` to apply schema changes.
- **Implementation Details:** Reads migration files from drizzle folder, applies them in order.

### [`templates/base/src/db/schema.ts`](betterbase/templates/base/src/db/schema.ts)
**Purpose:** Database schema with helper functions.
- **Exports:** `timestamps` - created_at/updated_at helper, `uuid()` - UUID primary key helper, `softDelete` - deleted_at helper, `statusEnum()` - status enum helper, `moneyColumn()` - cents column helper, `jsonColumn()` - JSON column helper, `users` - users table, `posts` - posts table
- **Internal Deps:** `drizzle-orm/sqlite-core`
- **Usage Patterns:** Define database tables using Drizzle's type-safe schema builder.
- **Implementation Details:** Helper functions for common column patterns. Includes users and posts tables as examples.
- **External Deps:** `drizzle-orm`

```typescript
// Usage Example:
import { users, posts, timestamps } from "./db/schema"

const userSchema = users.extend({
  ...timestamps,
})
```

### [`templates/base/src/lib/env.ts`](betterbase/templates/base/src/lib/env.ts)
**Purpose:** Environment variable parsing with Zod.
- **Exports:** `env` - parsed environment object, `DEFAULT_DB_PATH` - constant
- **Env:** `NODE_ENV`, `PORT`, `DB_PATH`
- **Usage Patterns:** Access environment variables with type safety.
- **Implementation Details:** Zod schema validates env vars at startup. Throws if required vars missing.
- **External Deps:** `zod`

### [`templates/base/src/lib/realtime.ts`](betterbase/templates/base/src/lib/realtime.ts)
**Purpose:** WebSocket realtime server for table subscriptions.
- **Exports:** `RealtimeServer` - class, `realtime` - singleton instance, `Subscription` - interface
- **Class Methods:** `authenticate()`, `authorize()`, `handleConnection()`, `handleMessage()`, `handleClose()`, `broadcast()`
- **Internal Deps:** `bun:sqlite`, `fast-deep-equal`, `zod`
- **Usage Patterns:** Clients connect to `/ws` to subscribe to table changes. Real-time updates pushed to subscribers.
- **Implementation Details:** Manages WebSocket connections. Tracks subscriptions per table. Broadcasts INSERT/UPDATE/DELETE events. Uses fast-deep-equal for filtering.
- **External Deps:** `fast-deep-equal`, `zod`

### [`templates/base/src/middleware/validation.ts`](betterbase/templates/base/src/middleware/validation.ts)
**Purpose:** Request body validation middleware.
- **Exports:** `parseBody(schema, body)` - validates and returns parsed data or throws HTTPException
- **Internal Deps:** `hono/http-exception`, `zod`
- **Usage Patterns:** Validate incoming request bodies against Zod schemas.
- **Implementation Details:** Returns validated data or throws Hono HTTPException with 400 status.
- **External Deps:** `zod`, `hono`

### [`templates/base/src/routes/index.ts`](betterbase/templates/base/src/routes/index.ts)
**Purpose:** Route registration and error handling.
- **Exports:** `registerRoutes(app)` - registers all routes with CORS, logging, error handling
- **Internal Deps:** `hono`, `./health`, `./users`, `../lib/env`
- **Usage Patterns:** Called from main entry to register all API routes.
- **Implementation Details:** Sets up CORS middleware, error handling, rate limiting (stub), registers all route files.

### [`templates/base/src/routes/health.ts`](betterbase/templates/base/src/routes/health.ts)
**Purpose:** Health check endpoint.
- **Exports:** `healthRoute` - Hono instance with GET `/` endpoint
- **Returns:** JSON with status, database connection, timestamp
- **Usage Patterns:** Kubernetes/readiness probes, monitoring systems.
- **Implementation Details:** Simple endpoint that checks DB connectivity.

### [`templates/base/src/routes/users.ts`](betterbase/templates/base/src/routes/users.ts)
**Purpose:** Users CRUD endpoints.
- **Exports:** `usersRoute` - Hono instance, `createUserSchema` - Zod schema
- **Endpoints:** GET `/` (list with pagination), POST `/` (create)
- **Internal Deps:** `../db`, `../db/schema`, `../middleware/validation`
- **Usage Patterns:** Example CRUD routes demonstrating the patterns used throughout the project.
- **Implementation Details:** Uses validation middleware, returns typed responses.

---

## templates/auth

Auth template with BetterAuth integration - Bun + Hono + BetterAuth.

### [`templates/auth/README.md`](betterbase/templates/auth/README.md)
**Purpose:** Auth template documentation.

### [`templates/auth/src/auth/index.ts`](betterbase/templates/auth/src/auth/index.ts)
**Purpose:** Auth module entry point.

### [`templates/auth/src/db/auth-schema.ts`](betterbase/templates/auth/src/db/auth-schema.ts)
**Purpose:** BetterAuth database schema for SQLite.
- **Exports:** Auth-related table definitions

### [`templates/auth/src/db/index.ts`](betterbase/templates/auth/src/db/index.ts)
**Purpose:** Database connection with auth schema.

### [`templates/auth/src/db/schema.ts`](betterbase/templates/auth/src/db/schema.ts)
**Purpose:** Database schema with user table.

### [`templates/auth/src/middleware/auth.ts`](betterbase/templates/auth/src/middleware/auth.ts)
**Purpose:** Authentication middleware for Hono routes.
- **Exports:** `requireAuth`, `optionalAuth` middleware functions
- **Usage Patterns:** Protect routes that require authentication.
- **Implementation Details:** Extracts session from request, validates with BetterAuth, attaches user to context.
- **External Deps:** `better-auth`, `hono`
- **Cross-Ref:** [`packages/cli/src/commands/auth.ts`](packages/cli/src/commands/auth.ts)

### [`templates/auth/src/routes/auth.ts`](betterbase/templates/auth/src/routes/auth.ts)
**Purpose:** Authentication API routes.
- **Endpoints:** Sign up, sign in, sign out, session management
- **Usage Patterns:** Handles all auth-related HTTP requests.
- **External Deps:** `better-auth`, `hono`

---

## Config Files (root level)

### [`betterbase/package.json`](betterbase/package.json)
**Purpose:** Root monorepo package manifest.
- **Name:** `betterbase`
- **Package Manager:** `bun@1.3.9`
- **Workspaces:** `apps/*`, `packages/*`
- **Scripts:** `build`, `dev`, `lint`, `typecheck` (via Turbo)
- **Dev Dependencies:** `turbo@^2.0.0`, `typescript@^5.6.0`
- **External Deps:** `turbo`, `typescript`, `@libsql/client`

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

---

## Data Flow Diagrams

### CLI Project Initialization Flow
```
User runs: bb init
         │
         ▼
┌─────────────────────────┐
│ packages/cli/src/       │
│ commands/init.ts       │
│ - Prompts for project   │
│   name, database mode   │
└─────────┬───────────────┘
          │
          ▼
┌─────────────────────────┐
│ writeProjectFiles()     │
│ - Creates directory     │
│ - Writes package.json   │
│ - Writes config files   │
│ - Writes schema template│
└─────────┬───────────────┘
          │
          ▼
┌─────────────────────────┐
│ installDependencies()   │
│ - Runs bun install      │
│ - Installs hono, drizzle │
│   zod, better-auth      │
└─────────────────────────┘
```

### Client SDK Request Flow
```
User Code
    │
    ▼
createClient(config)
    │
    ▼
BetterBaseClient.from(table)
    │
    ▼
QueryBuilder.select().eq().execute()
    │
    ├──► HTTP Request to backend
    │       │
    │       ▼
    │   Hono Route Handler
    │       │
    │       ▼
    │   Drizzle Query
    │       │
    │       ▼
    │   SQLite Response
    │
    ▼
Zod Validation
    │
    ▼
Return typed data
```

### Realtime Subscription Flow
```
Client connects to WebSocket
    │
    ▼
RealtimeClient.from(table).on(event, callback)
    │
    ▼
Subscribe message sent to /ws
    │
    ▼
RealtimeServer.authorize()
    │
    ▼
Add subscription to table
    │
    ▼
On DB change: broadcast to subscribers
    │
    ▼
Client receives update
```

---

## Error Handling Patterns

### Client SDK Error Handling
The client SDK uses a hierarchical error system with specific error types:

```typescript
// Network errors - connection issues
throw new NetworkError("Failed to connect", { status: 0 })

// Auth errors - authentication failures
throw new AuthError("Invalid credentials", { status: 401 })

// Validation errors - input validation failures
throw new ValidationError("Invalid email format", { field: "email" })

// Generic errors - other failures
throw new BetterBaseError("Unknown error", { cause })
```

**Pattern:** All errors extend `BetterBaseError` with cause chain support for debugging.

### CLI Error Handling
CLI commands use try-catch with logger for user-friendly error display:

```typescript
try {
  await runInitCommand(options)
} catch (error) {
  logger.error(`Failed to initialize: ${error.message}`)
  process.exit(1)
}
```

### API Error Handling (Hono)
Routes use HTTPException for error propagation:

```typescript
app.post("/users", async (c) => {
  const body = await c.req.json()
  const result = createUserSchema.safeParse(body)
  
  if (!result.success) {
    throw new HTTPException(400, {
      message: result.error.message,
    })
  }
  // ... handle valid request
})
```

---

## Security Considerations

### Authentication
- **Session Management:** BetterAuth handles sessions with secure, httpOnly cookies
- **Token Validation:** Bearer token validation on protected routes
- **Dev Mode:** `ENABLE_DEV_AUTH` allows simplified auth for development

### Row-Level Security (RLS)
- **Current Status:** RLS module is a stub in `packages/core`
- **Future Implementation:** Will use Drizzle RLS policies
- **Pattern:** Every table query should check user permissions

### Input Validation
- **Zod Everywhere:** All inputs validated with Zod schemas
- **Validation Middleware:** `templates/base/src/middleware/validation.ts` provides reusable validation
- **Database:** Parameterized queries via Drizzle ORM prevent SQL injection

### API Security
- **CORS:** Configured in route registration
- **Rate Limiting:** Stub implementation ready for production
- **Type Safety:** TypeScript provides compile-time safety

### Secrets Management
- **Environment Variables:** Secrets loaded via `lib/env.ts`
- **Validation:** Required env vars validated at startup
- **Defaults:** Safe defaults for development, explicit config for production

---

## Performance Notes

### Startup Performance
- **Target:** Sub-100ms startup with `bun:sqlite`
- **Why Bun:** Native performance, no JVM overhead
- **Optimization:** Lazy route loading in development

### Database Performance
- **ORM:** Drizzle generates optimized SQL
- **Connections:** SQLite file-based (local) or connection pooling (PostgreSQL)
- **Indexes:** Schema helpers include index creation

### Realtime Performance
- **WebSocket:** Native Bun WebSocket support
- **Filtering:** Client-side filtering with `fast-deep-equal`
- **Subscription Limits:** Configurable max subscriptions per client

### Build Performance
- **Turborepo:** Caches build artifacts across packages
- **Parallel Execution:** Independent packages build in parallel
- **TypeScript:** Incremental compilation enabled

### Bundle Size
- **CLI:** Bundled as single executable with Bun
- **Client SDK:** ESM + CJS outputs for compatibility
- **Dashboard:** Next.js code splitting automatic

---

*This enhanced CODEBASE_MAP.md includes usage patterns, implementation details, external dependencies, cross-references, and new sections on data flow, error handling, security, and performance.*
