# @betterbase/shared

Shared types, utilities, constants, and schemas used across BetterBase packages.

## Table of Contents
- [Overview](#overview)
- [Installation](#installation)
- [Usage](#usage)
- [API Reference](#api-reference)
  - [Constants](#constants)
  - [Errors](#errors)
  - [Types](#types)
  - [Utils](#utils)
  - [Index Export](#index-export)

## Overview

The `@betterbase/shared` package contains code that is used across multiple packages in the BetterBase monorepo. This includes:
- TypeScript types and interfaces
- Utility functions
- Constants and configuration values
- Error classes
- Shared schemas

## Installation

From the monorepo root:
```bash
bun add @betterbase/shared --filter <consumer-package>
```

Or add a workspace dependency in your package `package.json`.

## Usage

```ts
import type { YourType } from '@betterbase/shared';
import { yourUtility } from '@betterbase/shared';
```

## API Reference

### Constants

File: `src/constants.ts`

Exported constants:
- `BETTERBASE_VERSION`: Current version of the BetterBase framework
- `DEFAULT_PORT`: Default port for the server (3000)
- `DEFAULT_DB_PATH`: Default database file path for SQLite ("local.db")
- `CONTEXT_FILE_NAME`: Name of the context file (`.betterbase-context.json`)
- `CONFIG_FILE_NAME`: Name of the configuration file (`betterbase.config.ts`)
- `MIGRATIONS_DIR`: Directory for migration files ("drizzle")
- `FUNCTIONS_DIR`: Directory for user-defined functions ("src/functions")
- `POLICIES_DIR`: Directory for RLS policies ("src/db/policies")

### Errors

File: `src/errors.ts`

Exported error classes:
- `BetterBaseError`: Base error class for all BetterBase errors
  - Properties: `message`, `code`, `statusCode`
- `ValidationError`: Extends `BetterBaseError` for validation failures (status 400)
- `NotFoundError`: Extends `BetterBaseError` for missing resources (status 404)
- `UnauthorizedError`: Extends `BetterBaseError` for authentication failures (status 401)

### Types

File: `src/types.ts`

Exported TypeScript types and interfaces:
- `SerializedError`: JSON-serializable error representation
  - `message`: string
  - `name?:`: string (optional)
  - `stack?:`: string (optional)
- `BetterBaseResponse<T>`: Generic API response wrapper
  - `data`: T | null
  - `error`: string | SerializedError | null
  - `count?:`: number (optional)
  - `pagination?`: { page: number; pageSize: number; total: number } (optional)
- `DBEventType`: "INSERT" | "UPDATE" | "DELETE"
- `DBEvent`: Represents a database change event
  - `table`: string
  - `type`: DBEventType
  - `record`: Record<string, unknown>
  - `old_record?`: Record<string, unknown> (optional)
  - `timestamp`: string
- `ProviderType`: "neon" | "turso" | "planetscale" | "supabase" | "postgres" | "managed"
- `PaginationParams`: Generic pagination parameters
  - `limit?:`: number (optional)
  - `offset?:`: number (optional)

### Utils

File: `src/utils.ts`

Exported utility functions:
- `isValidProjectName`: Validates project names
- `toCamelCase`: Converts string to camelCase
- `toSnakeCase`: Converts string to snake_case
- `safeJsonParse`: Safely parses JSON string
- `formatBytes`: Formats bytes into human-readable string
- `serializeError`: Serializes an error object

### Index Export

File: `src/index.ts`

Re-exports all public API from the submodules for convenient importing:
```ts
// Types
export type { BetterBaseResponse, SerializedError, DBEventType, DBEvent, ProviderType, PaginationParams } from "./types";

// Errors
export { BetterBaseError, ValidationError, NotFoundError, UnauthorizedError } from "./errors";

// Constants
export { BETTERBASE_VERSION, DEFAULT_PORT, DEFAULT_DB_PATH, CONTEXT_FILE_NAME, CONFIG_FILE_NAME, MIGRATIONS_DIR, FUNCTIONS_DIR, POLICIES_DIR } from "./constants";

// Utils
export { isValidProjectName, toCamelCase, toSnakeCase, safeJsonParse, formatBytes, serializeError } from "./utils";
```