# BetterBase InfraAsCode — Orchestrator Specification

> **For Kilo Code Orchestrator**
> Execute tasks in strict order. Each task lists its dependencies — do not begin until all dependencies are marked complete.
> All file paths are relative to the monorepo root unless stated otherwise.
> This spec introduces the `bbf/` (BetterBase Functions) convention. It is additive — existing Hono routes, Drizzle schemas, and BetterAuth config are untouched.

---

## What This Spec Builds

A Convex-inspired Infrastructure-as-Code layer for BetterBase. Developers define their **data model** and **server functions** in TypeScript files inside a `bbf/` directory. The CLI reads those files, infers types, generates Drizzle schema + migrations automatically, and exposes a fully type-safe client API — with real-time queries by default.

### Before (Current BetterBase)

```
src/
├── db/schema.ts          ← hand-written Drizzle schema
├── routes/users.ts       ← hand-written Hono routes
└── db/migrate.ts         ← manual migration runner
```

Developers write SQL-style schema separately, hand-wire routes, manage migrations manually.

### After (BetterBase IaC)

```
bbf/
├── schema.ts             ← single source of truth for data model
├── queries/users.ts      ← typed read functions (real-time by default)
├── mutations/users.ts    ← typed write functions (transactional)
├── actions/email.ts      ← typed side-effect functions
├── cron.ts               ← scheduled functions
└── _generated/           ← never edit — owned by bb CLI
    ├── api.d.ts          ← type-safe API object
    ├── dataModel.d.ts    ← table + document types
    └── server.d.ts       ← ctx types for function authoring
```

The CLI runs `bb dev` and watches `bbf/`. Schema changes are detected, migrations generated and applied, `_generated/` is updated — all without leaving the editor.

---

## Architecture Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Validator primitives | Wrap **Zod** (`v.*` surface, Zod internals) | Re-uses BetterBase's existing Zod dependency; validators are plain Zod schemas internally |
| DB access API | New `ctx.db` abstraction over **Drizzle** | Drizzle stays as the actual DB driver; `ctx.db` is a thin typed wrapper |
| Schema → DB | Generate Drizzle schema from `bbf/schema.ts` | One-way derivation; `bbf/schema.ts` is the master |
| Migrations | Auto-diff + auto-generate (prompt on destructive) | Never write SQL by hand; destructive changes require explicit CLI confirmation |
| Real-time | Mutation writes → WebSocket invalidation push | Queries subscribe to table-level change events; clients re-fetch on invalidation |
| Function transport | HTTP `POST /bbf/:type/:path/:name` | Stateless, debuggable with curl, fits the existing Hono server |
| Client hooks | React hooks (`useQuery`, `useMutation`, `useAction`) + vanilla equivalents | React-first but not React-only |
| Hybrid mode | IaC functions coexist with existing Hono routes | Additive, zero migration required for existing projects |

---

## Validator Primitives (`v.*`)

The `v` object is the public API for defining field types. It is a thin wrapper around Zod with a Convex-familiar surface.

```typescript
// Usage in bbf/schema.ts
import { v } from "@betterbase/core/iac"

const schema = defineSchema({
  users: defineTable({
    name:   v.string(),
    email:  v.string(),
    age:    v.optional(v.number()),
    role:   v.union(v.literal("admin"), v.literal("user")),
    tags:   v.array(v.string()),
    meta:   v.object({ verified: v.boolean() }),
    postId: v.id("posts"),         // typed foreign key
  })
})
```

Every `v.*` call returns a Zod schema. `v.id(table)` returns `z.string()` with a brand for type safety.

---

## Phase 1 — Validator & Schema System

### Task IAC-01 — Validator Primitives

**Depends on:** nothing

**Create file:** `packages/core/src/iac/validators.ts`

```typescript
import { z } from "zod";

// Brand symbol for typed IDs
const ID_BRAND = Symbol("BetterBaseId");

export type BrandedId<T extends string> = string & { __table: T };

/**
 * The `v` object provides Convex-style validator primitives backed by Zod.
 * Every method returns a ZodSchema — callers can use them as plain Zod schemas.
 */
export const v = {
  /** UTF-8 string */
  string:  ()                    => z.string(),
  /** JS number (float64) */
  number:  ()                    => z.number(),
  /** Boolean */
  boolean: ()                    => z.boolean(),
  /** null */
  null:    ()                    => z.null(),
  /** bigint */
  int64:   ()                    => z.bigint(),
  /** Zod z.any() */
  any:     ()                    => z.any(),
  /** Make a field optional */
  optional: <T extends z.ZodTypeAny>(validator: T) => validator.optional(),
  /** Array of items */
  array:   <T extends z.ZodTypeAny>(item: T) => z.array(item),
  /** Plain object with typed fields */
  object:  <T extends z.ZodRawShape>(shape: T) => z.object(shape),
  /** Discriminated union */
  union:   <T extends [z.ZodTypeAny, ...z.ZodTypeAny[]]>(...validators: T) =>
    z.union(validators as unknown as [z.ZodTypeAny, z.ZodTypeAny, ...z.ZodTypeAny[]]),
  /** Exact value */
  literal: <T extends z.Primitive>(value: T) => z.literal(value),
  /** Typed foreign key reference — resolves to string at runtime */
  id:      <T extends string>(tableName: T) =>
    z.string().brand<`${T}Id`>(),
  /** ISO 8601 datetime string */
  datetime: () => z.string().datetime({ offset: true }),
  /** Bytes (base64 string) */
  bytes:   () => z.string().base64(),
};

export type VString   = ReturnType<typeof v.string>;
export type VNumber   = ReturnType<typeof v.number>;
export type VBoolean  = ReturnType<typeof v.boolean>;
export type VAny      = ReturnType<typeof v.any>;
export type VId<T extends string> = z.ZodBranded<z.ZodString, `${T}Id`>;

/** Infer TypeScript type from a v.* validator */
export type Infer<T extends z.ZodTypeAny> = z.infer<T>;
```

**Also create file:** `packages/core/src/iac/index.ts`

```typescript
export { v, type Infer } from "./validators";
export { defineSchema, defineTable, type TableDefinition, type SchemaDefinition } from "./schema";
export { query, mutation, action, type QueryCtx, type MutationCtx, type ActionCtx } from "./functions";
export { cron, type CronJob } from "./cron";
export { DatabaseReader, DatabaseWriter } from "./db-context";
```

**Acceptance criteria:**
- Every `v.*` call returns a Zod schema
- `v.id("users")` produces a branded string type `z.ZodBranded<z.ZodString, "usersId">`
- All types exported from `@betterbase/core/iac`
- No runtime dependencies beyond `zod` (already in project)

---

### Task IAC-02 — `defineTable` with Index Builders

**Depends on:** IAC-01

**Create file:** `packages/core/src/iac/schema.ts` (part 1 — table definition)

```typescript
import { z } from "zod";

export interface IndexDefinition {
  type:        "index" | "searchIndex" | "uniqueIndex";
  name:        string;
  fields:      string[];
  searchField?: string;  // for searchIndex
}

export interface TableDefinition<
  TShape extends z.ZodRawShape = z.ZodRawShape
> {
  _shape:   TShape;
  _schema:  z.ZodObject<TShape>;
  _indexes: IndexDefinition[];
  /** Add a standard DB index */
  index(name: string, fields: (keyof TShape & string)[]): this;
  /** Add a UNIQUE index */
  uniqueIndex(name: string, fields: (keyof TShape & string)[]): this;
  /** Add a full-text search index (for supported providers) */
  searchIndex(name: string, opts: { searchField: keyof TShape & string; filterFields?: (keyof TShape & string)[] }): this;
}

export function defineTable<TShape extends z.ZodRawShape>(
  shape: TShape
): TableDefinition<TShape> {
  // System fields injected automatically
  const systemShape = {
    _id:         z.string().describe("system:id"),
    _createdAt:  z.date().describe("system:createdAt"),
    _updatedAt:  z.date().describe("system:updatedAt"),
  };

  const fullShape = { ...systemShape, ...shape } as TShape & typeof systemShape;
  const schema    = z.object(fullShape);
  const indexes:  IndexDefinition[] = [];

  const table: TableDefinition<TShape> = {
    _shape:   shape,
    _schema:  schema,
    _indexes: indexes,

    index(name, fields) {
      indexes.push({ type: "index", name, fields: fields as string[] });
      return this;
    },

    uniqueIndex(name, fields) {
      indexes.push({ type: "uniqueIndex", name, fields: fields as string[] });
      return this;
    },

    searchIndex(name, opts) {
      indexes.push({
        type:        "searchIndex",
        name,
        fields:      [opts.searchField, ...(opts.filterFields ?? [])],
        searchField: opts.searchField,
      });
      return this;
    },
  };

  return table;
}

/** Infer the document type of a table (includes system fields) */
export type InferDocument<T extends TableDefinition> =
  z.infer<T["_schema"]>;
```

**Acceptance criteria:**
- `defineTable({ name: v.string() })` returns a chainable object
- `.index()`, `.uniqueIndex()`, `.searchIndex()` all return `this` for chaining
- System fields `_id`, `_createdAt`, `_updatedAt` injected into every table schema
- Full shape available via `._schema` for runtime validation

---

### Task IAC-03 — `defineSchema` + Type Inference

**Depends on:** IAC-02

**Append to file:** `packages/core/src/iac/schema.ts` (part 2 — schema definition)

```typescript
export type SchemaShape = Record<string, TableDefinition>;

export interface SchemaDefinition<TShape extends SchemaShape = SchemaShape> {
  _tables: TShape;
}

export function defineSchema<TShape extends SchemaShape>(
  tables: TShape
): SchemaDefinition<TShape> {
  return { _tables: tables };
}

/** Infer full schema types: { users: { _id: string, name: string, ... }, posts: {...} } */
export type InferSchema<T extends SchemaDefinition> = {
  [K in keyof T["_tables"]]: InferDocument<T["_tables"][K]>;
};

/** Get table names from a schema */
export type TableNames<T extends SchemaDefinition> = keyof T["_tables"] & string;

/** Get the document type for a specific table */
export type Doc<
  TSchema extends SchemaDefinition,
  TTable extends TableNames<TSchema>
> = InferSchema<TSchema>[TTable];
```

**Example (`bbf/schema.ts`):**

```typescript
import { defineSchema, defineTable, v } from "@betterbase/core/iac";

export const schema = defineSchema({
  users: defineTable({
    name:  v.string(),
    email: v.string(),
    role:  v.union(v.literal("admin"), v.literal("member")),
    plan:  v.optional(v.union(v.literal("free"), v.literal("pro"))),
  })
  .uniqueIndex("by_email", ["email"]),

  posts: defineTable({
    title:    v.string(),
    body:     v.string(),
    authorId: v.id("users"),
    published: v.boolean(),
    tags:     v.array(v.string()),
  })
  .index("by_author", ["authorId"])
  .index("by_published", ["published", "_createdAt"]),

  comments: defineTable({
    postId:  v.id("posts"),
    userId:  v.id("users"),
    content: v.string(),
  })
  .index("by_post", ["postId"]),
});

export default schema;
```

**Acceptance criteria:**
- `defineSchema({ ... })` accepts `Record<string, TableDefinition>` and returns `SchemaDefinition`
- `InferSchema<typeof schema>` resolves to correct document shapes
- `Doc<typeof schema, "users">` resolves to the full users document type including system fields
- Schema object is serializable to JSON for diffing (Phase 2)

---

### Task IAC-04 — Schema Serializer

**Depends on:** IAC-03

**What it is:** Converts a `SchemaDefinition` into a plain JSON representation for storage, comparison, and migration generation.

**Create file:** `packages/core/src/iac/schema-serializer.ts`

```typescript
import { z } from "zod";
import type { SchemaDefinition, TableDefinition, IndexDefinition } from "./schema";

export interface SerializedColumn {
  name:     string;
  type:     string;   // "string" | "number" | "boolean" | "id:users" | "array:string" | etc.
  optional: boolean;
  system:   boolean;  // true for _id, _createdAt, _updatedAt
}

export interface SerializedIndex {
  type:        "index" | "uniqueIndex" | "searchIndex";
  name:        string;
  fields:      string[];
  searchField?: string;
}

export interface SerializedTable {
  name:    string;
  columns: SerializedColumn[];
  indexes: SerializedIndex[];
}

export interface SerializedSchema {
  version:   number;  // bumped on each serialization
  tables:    SerializedTable[];
  generated: string;  // ISO timestamp
}

/** Converts a ZodTypeAny to a string type descriptor */
function zodToTypeString(schema: z.ZodTypeAny): string {
  if (schema instanceof z.ZodString)   return "string";
  if (schema instanceof z.ZodNumber)   return "number";
  if (schema instanceof z.ZodBoolean)  return "boolean";
  if (schema instanceof z.ZodBigInt)   return "int64";
  if (schema instanceof z.ZodNull)     return "null";
  if (schema instanceof z.ZodAny)      return "any";
  if (schema instanceof z.ZodDate)     return "date";

  if (schema instanceof z.ZodBranded) {
    // v.id() — extract brand
    const brand = (schema as any)._def.type;
    const brandStr = (schema as any)._def.type?._def?.typeName ?? "string";
    return `id:${String((schema as any)._def.brandedType ?? "unknown")}`;
  }

  if (schema instanceof z.ZodOptional) {
    return zodToTypeString(schema.unwrap());
  }

  if (schema instanceof z.ZodArray) {
    return `array:${zodToTypeString(schema.element)}`;
  }

  if (schema instanceof z.ZodObject) {
    return "object";
  }

  if (schema instanceof z.ZodUnion) {
    const options = (schema as z.ZodUnion<any>).options as z.ZodTypeAny[];
    return `union:${options.map(zodToTypeString).join("|")}`;
  }

  if (schema instanceof z.ZodLiteral) {
    return `literal:${String(schema.value)}`;
  }

  return "unknown";
}

const SYSTEM_FIELDS = new Set(["_id", "_createdAt", "_updatedAt"]);

/** Serialize a full SchemaDefinition to a plain JSON-safe object */
export function serializeSchema(schema: SchemaDefinition): SerializedSchema {
  const tables: SerializedTable[] = [];

  for (const [tableName, tableDef] of Object.entries(schema._tables)) {
    const table = tableDef as TableDefinition;
    const columns: SerializedColumn[] = [];

    // Iterate over the full schema shape (includes system fields)
    for (const [colName, colSchema] of Object.entries(table._schema.shape)) {
      const isOptional = colSchema instanceof z.ZodOptional;
      const innerSchema = isOptional ? (colSchema as z.ZodOptional<any>).unwrap() : colSchema;

      columns.push({
        name:     colName,
        type:     zodToTypeString(colSchema),
        optional: isOptional,
        system:   SYSTEM_FIELDS.has(colName),
      });
    }

    tables.push({
      name:    tableName,
      columns,
      indexes: table._indexes,
    });
  }

  return {
    version:   Date.now(),
    tables,
    generated: new Date().toISOString(),
  };
}

/** Load a serialized schema from disk (bbf/_generated/schema.json) */
export function loadSerializedSchema(path: string): SerializedSchema | null {
  try {
    const content = Bun.file(path).text();
    return JSON.parse(content as any) as SerializedSchema;
  } catch {
    return null;
  }
}

/** Save serialized schema to disk */
export async function saveSerializedSchema(
  schema: SerializedSchema,
  path: string
): Promise<void> {
  await Bun.write(path, JSON.stringify(schema, null, 2));
}
```

**Acceptance criteria:**
- `serializeSchema()` produces stable, deterministic JSON
- System fields (`_id`, `_createdAt`, `_updatedAt`) marked with `system: true`
- `v.id("users")` columns serialized as `"id:users"` for diff detection
- Output is round-trippable (serialize → save → load → compare)

---

### Task IAC-05 — Schema Diff Engine

**Depends on:** IAC-04

**Create file:** `packages/core/src/iac/schema-diff.ts`

```typescript
import type { SerializedSchema, SerializedTable, SerializedColumn, SerializedIndex } from "./schema-serializer";

export type DiffChangeType =
  | "ADD_TABLE"
  | "DROP_TABLE"
  | "ADD_COLUMN"
  | "DROP_COLUMN"
  | "ALTER_COLUMN"
  | "ADD_INDEX"
  | "DROP_INDEX";

export interface SchemaDiffChange {
  type:       DiffChangeType;
  table:      string;
  column?:    string;
  index?:     string;
  before?:    unknown;
  after?:     unknown;
  destructive: boolean;
}

export interface SchemaDiff {
  changes:        SchemaDiffChange[];
  hasDestructive: boolean;
  isEmpty:        boolean;
}

export function diffSchemas(
  from: SerializedSchema | null,
  to:   SerializedSchema
): SchemaDiff {
  const changes: SchemaDiffChange[] = [];

  const fromTables = new Map<string, SerializedTable>(
    (from?.tables ?? []).map((t) => [t.name, t])
  );
  const toTables = new Map<string, SerializedTable>(
    to.tables.map((t) => [t.name, t])
  );

  // Added tables
  for (const [name, table] of toTables) {
    if (!fromTables.has(name)) {
      changes.push({ type: "ADD_TABLE", table: name, after: table, destructive: false });
      continue;
    }
    // Diff columns within existing table
    const fromTable = fromTables.get(name)!;
    const fromCols  = new Map(fromTable.columns.map((c) => [c.name, c]));
    const toCols    = new Map(table.columns.map((c) => [c.name, c]));

    for (const [col, def] of toCols) {
      if (!fromCols.has(col)) {
        changes.push({ type: "ADD_COLUMN", table: name, column: col, after: def, destructive: false });
      } else {
        const before = fromCols.get(col)!;
        if (before.type !== def.type || before.optional !== def.optional) {
          changes.push({
            type: "ALTER_COLUMN", table: name, column: col,
            before, after: def,
            // Changing type or making required = destructive
            destructive: before.type !== def.type || (before.optional && !def.optional),
          });
        }
      }
    }

    for (const [col, def] of fromCols) {
      if (!toCols.has(col) && !def.system) {
        changes.push({ type: "DROP_COLUMN", table: name, column: col, before: def, destructive: true });
      }
    }

    // Diff indexes
    const fromIdx = new Map(fromTable.indexes.map((i) => [i.name, i]));
    const toIdx   = new Map(table.indexes.map((i) => [i.name, i]));

    for (const [idx] of toIdx) {
      if (!fromIdx.has(idx)) changes.push({ type: "ADD_INDEX", table: name, index: idx, destructive: false });
    }
    for (const [idx] of fromIdx) {
      if (!toIdx.has(idx)) changes.push({ type: "DROP_INDEX", table: name, index: idx, destructive: false });
    }
  }

  // Dropped tables
  for (const [name] of fromTables) {
    if (!toTables.has(name)) {
      changes.push({ type: "DROP_TABLE", table: name, before: fromTables.get(name), destructive: true });
    }
  }

  const hasDestructive = changes.some((c) => c.destructive);
  return { changes, hasDestructive, isEmpty: changes.length === 0 };
}

/** Human-readable summary of a diff */
export function formatDiff(diff: SchemaDiff): string {
  if (diff.isEmpty) return "  No schema changes detected.";

  return diff.changes.map((c) => {
    const prefix = c.destructive ? "⚠ " : "+ ";
    switch (c.type) {
      case "ADD_TABLE":    return `${prefix}ADD TABLE ${c.table}`;
      case "DROP_TABLE":   return `${prefix}DROP TABLE ${c.table}`;
      case "ADD_COLUMN":   return `${prefix}ADD COLUMN ${c.table}.${c.column}`;
      case "DROP_COLUMN":  return `${prefix}DROP COLUMN ${c.table}.${c.column}`;
      case "ALTER_COLUMN": return `${prefix}ALTER COLUMN ${c.table}.${c.column}`;
      case "ADD_INDEX":    return `${prefix}ADD INDEX ${c.table}.${c.index}`;
      case "DROP_INDEX":   return `${prefix}DROP INDEX ${c.table}.${c.index}`;
    }
  }).join("\n");
}
```

**Acceptance criteria:**
- `diffSchemas(null, schema)` produces `ADD_TABLE` for every table (first run)
- `diffSchemas(schema, schema)` produces empty diff
- `DROP_TABLE`, `DROP_COLUMN`, `ALTER_COLUMN` (type change or required) marked `destructive: true`
- `ADD_TABLE`, `ADD_COLUMN`, `ADD_INDEX` marked `destructive: false`

---

## Phase 2 — Function System

### Task IAC-06 — `query()` Primitive + QueryCtx

**Depends on:** IAC-05

**Create file:** `packages/core/src/iac/functions.ts` (part 1)

```typescript
import { z } from "zod";
import type { DatabaseReader } from "./db-context";

// ─── Context Types ────────────────────────────────────────────────────────────

export interface AuthCtx {
  /** ID of the authenticated user, or null for anonymous */
  userId: string | null;
  /** Raw session token */
  token:  string | null;
}

export interface StorageReaderCtx {
  getUrl(storageId: string): Promise<string | null>;
}

export interface StorageWriterCtx extends StorageReaderCtx {
  store(blob: Blob): Promise<string>;   // returns storageId
  delete(storageId: string): Promise<void>;
}

export interface QueryCtx {
  db:      DatabaseReader;
  auth:    AuthCtx;
  storage: StorageReaderCtx;
}

export interface Scheduler {
  /**
   * Schedule a mutation to run after `delayMs` milliseconds.
   * Returns a job ID that can be cancelled.
   */
  runAfter<TArgs extends z.ZodRawShape>(
    delayMs: number,
    fn: MutationRegistration<TArgs, unknown>,
    args: z.infer<z.ZodObject<TArgs>>
  ): Promise<string>;

  /**
   * Schedule a mutation to run at a specific timestamp.
   */
  runAt<TArgs extends z.ZodRawShape>(
    timestamp: Date,
    fn: MutationRegistration<TArgs, unknown>,
    args: z.infer<z.ZodObject<TArgs>>
  ): Promise<string>;

  /** Cancel a scheduled job */
  cancel(jobId: string): Promise<void>;
}

export interface MutationCtx {
  db:        DatabaseWriter;
  auth:      AuthCtx;
  storage:   StorageWriterCtx;
  scheduler: Scheduler;
}

export interface ActionCtx {
  auth:      AuthCtx;
  storage:   StorageWriterCtx;
  scheduler: Scheduler;
  /** Run a query from within an action */
  runQuery<TArgs extends z.ZodRawShape, TReturn>(
    fn: QueryRegistration<TArgs, TReturn>,
    args: z.infer<z.ZodObject<TArgs>>
  ): Promise<TReturn>;
  /** Run a mutation from within an action */
  runMutation<TArgs extends z.ZodRawShape, TReturn>(
    fn: MutationRegistration<TArgs, TReturn>,
    args: z.infer<z.ZodObject<TArgs>>
  ): Promise<TReturn>;
}

// ─── Registration Types ───────────────────────────────────────────────────────

const FUNCTION_KIND = Symbol("BetterBaseFunction");

export interface QueryRegistration<
  TArgs extends z.ZodRawShape,
  TReturn
> {
  [FUNCTION_KIND]: "query";
  _args:    z.ZodObject<TArgs>;
  _handler: (ctx: QueryCtx, args: z.infer<z.ZodObject<TArgs>>) => Promise<TReturn>;
}

export interface MutationRegistration<
  TArgs extends z.ZodRawShape,
  TReturn
> {
  [FUNCTION_KIND]: "mutation";
  _args:    z.ZodObject<TArgs>;
  _handler: (ctx: MutationCtx, args: z.infer<z.ZodObject<TArgs>>) => Promise<TReturn>;
}

export interface ActionRegistration<
  TArgs extends z.ZodRawShape,
  TReturn
> {
  [FUNCTION_KIND]: "action";
  _args:    z.ZodObject<TArgs>;
  _handler: (ctx: ActionCtx, args: z.infer<z.ZodObject<TArgs>>) => Promise<TReturn>;
}

// ─── Factory Functions ────────────────────────────────────────────────────────

export function query<TArgs extends z.ZodRawShape, TReturn>(config: {
  args:    TArgs;
  handler: (ctx: QueryCtx, args: z.infer<z.ZodObject<TArgs>>) => Promise<TReturn>;
}): QueryRegistration<TArgs, TReturn> {
  return {
    [FUNCTION_KIND]: "query",
    _args:    z.object(config.args),
    _handler: config.handler,
  };
}

export function mutation<TArgs extends z.ZodRawShape, TReturn>(config: {
  args:    TArgs;
  handler: (ctx: MutationCtx, args: z.infer<z.ZodObject<TArgs>>) => Promise<TReturn>;
}): MutationRegistration<TArgs, TReturn> {
  return {
    [FUNCTION_KIND]: "mutation",
    _args:    z.object(config.args),
    _handler: config.handler,
  };
}

export function action<TArgs extends z.ZodRawShape, TReturn>(config: {
  args:    TArgs;
  handler: (ctx: ActionCtx, args: z.infer<z.ZodObject<TArgs>>) => Promise<TReturn>;
}): ActionRegistration<TArgs, TReturn> {
  return {
    [FUNCTION_KIND]: "action",
    _args:    z.object(config.args),
    _handler: config.handler,
  };
}

// Import DatabaseWriter for MutationCtx (forward declaration resolved by IAC-07)
import type { DatabaseWriter } from "./db-context";
```

**Example (`bbf/queries/users.ts`):**

```typescript
import { query } from "@betterbase/core/iac";
import { v } from "@betterbase/core/iac";

export const getUser = query({
  args: { id: v.id("users") },
  handler: async (ctx, args) => {
    return ctx.db.get("users", args.id);
  },
});

export const listUsers = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    return ctx.db
      .query("users")
      .order("desc")
      .take(args.limit ?? 50);
  },
});
```

**Acceptance criteria:**
- `query()`, `mutation()`, `action()` each return typed registration objects
- Registration objects carry `_args` (ZodObject) and `_handler` for the runtime to call
- `QueryCtx` has read-only db; `MutationCtx` has read-write db + scheduler
- TypeScript infers `TReturn` from the handler's return type

---

### Task IAC-07 — `DatabaseReader` and `DatabaseWriter`

**Depends on:** IAC-06

**Create file:** `packages/core/src/iac/db-context.ts`

```typescript
import type { Pool } from "pg";
import { nanoid } from "nanoid";

// ─── Query Builder (chainable) ─────────────────────────────────────────────

export class IaCQueryBuilder<T = unknown> {
  private _table:   string;
  private _pool:    Pool;
  private _schema:  string;
  private _filters: string[] = [];
  private _params:  unknown[] = [];
  private _orderBy: string | null = null;
  private _orderDir: "ASC" | "DESC" = "ASC";
  private _limit:   number | null = null;
  private _indexName: string | null = null;

  constructor(table: string, pool: Pool, schema: string) {
    this._table  = table;
    this._pool   = pool;
    this._schema = schema;
  }

  /** Filter using an index — short-circuits to index-aware SQL */
  withIndex(indexName: string, _builder: (q: IndexQueryBuilder) => IndexQueryBuilder): this {
    this._indexName = indexName;
    // For v1: treated as a filter hint only; actual index usage is via SQL planner
    return this;
  }

  filter(field: string, op: "eq" | "neq" | "gt" | "gte" | "lt" | "lte", value: unknown): this {
    const idx = this._params.length + 1;
    const opMap = { eq: "=", neq: "!=", gt: ">", gte: ">=", lt: "<", lte: "<=" };
    this._filters.push(`"${field}" ${opMap[op]} $${idx}`);
    this._params.push(value);
    return this;
  }

  order(direction: "asc" | "desc", field = "_createdAt"): this {
    this._orderBy  = field;
    this._orderDir = direction === "asc" ? "ASC" : "DESC";
    return this;
  }

  take(n: number): this { this._limit = n; return this; }

  private _buildSQL(): { sql: string; params: unknown[] } {
    const table = `"${this._schema}"."${this._table}"`;
    let sql = `SELECT * FROM ${table}`;
    if (this._filters.length) sql += ` WHERE ${this._filters.join(" AND ")}`;
    if (this._orderBy) sql += ` ORDER BY "${this._orderBy}" ${this._orderDir}`;
    if (this._limit)   sql += ` LIMIT ${this._limit}`;
    return { sql, params: this._params };
  }

  async collect(): Promise<T[]> {
    const { sql, params } = this._buildSQL();
    const { rows } = await this._pool.query(sql, params as any[]);
    return rows as T[];
  }

  async first(): Promise<T | null> {
    const { sql, params } = this._buildSQL();
    const { rows } = await this._pool.query(sql + " LIMIT 1", params as any[]);
    return (rows[0] as T) ?? null;
  }

  async unique(): Promise<T | null> {
    const results = await this.collect();
    if (results.length > 1) throw new Error(`Expected unique result, got ${results.length}`);
    return results[0] ?? null;
  }
}

// Stub — used by withIndex for type inference
class IndexQueryBuilder {
  eq(field: string, value: unknown)  { return this; }
  gt(field: string, value: unknown)  { return this; }
  gte(field: string, value: unknown) { return this; }
  lt(field: string, value: unknown)  { return this; }
  lte(field: string, value: unknown) { return this; }
}

// ─── DatabaseReader ────────────────────────────────────────────────────────

export class DatabaseReader {
  constructor(protected _pool: Pool, protected _schema: string) {}

  /** Get a document by ID */
  async get<T = unknown>(table: string, id: string): Promise<T | null> {
    const { rows } = await this._pool.query(
      `SELECT * FROM "${this._schema}"."${table}" WHERE _id = $1 LIMIT 1`,
      [id]
    );
    return (rows[0] as T) ?? null;
  }

  /** Start a query builder for a table */
  query<T = unknown>(table: string): IaCQueryBuilder<T> {
    return new IaCQueryBuilder<T>(table, this._pool, this._schema);
  }
}

// ─── DatabaseWriter ────────────────────────────────────────────────────────

export class DatabaseWriter extends DatabaseReader {
  private _mutations: (() => Promise<void>)[] = [];

  /** Insert a document, returning its generated ID */
  async insert(table: string, data: Record<string, unknown>): Promise<string> {
    const id  = nanoid();
    const now = new Date();
    const doc = { ...data, _id: id, _createdAt: now, _updatedAt: now };

    const keys   = Object.keys(doc).map((k) => `"${k}"`).join(", ");
    const placeholders = Object.keys(doc).map((_, i) => `$${i + 1}`).join(", ");
    const values = Object.values(doc);

    await this._pool.query(
      `INSERT INTO "${this._schema}"."${table}" (${keys}) VALUES (${placeholders})`,
      values as any[]
    );

    // Emit change event for real-time invalidation
    this._emitChange(table, "INSERT", id);
    return id;
  }

  /** Partial update — merges provided fields, updates `_updatedAt` */
  async patch(table: string, id: string, fields: Record<string, unknown>): Promise<void> {
    const updates = Object.entries(fields)
      .map(([k], i) => `"${k}" = $${i + 2}`)
      .join(", ");
    const values = [id, ...Object.values(fields)];
    await this._pool.query(
      `UPDATE "${this._schema}"."${table}" SET ${updates}, "_updatedAt" = NOW() WHERE _id = $1`,
      values as any[]
    );
    this._emitChange(table, "UPDATE", id);
  }

  /** Full replace — replaces all user fields (preserves system fields) */
  async replace(table: string, id: string, data: Record<string, unknown>): Promise<void> {
    await this.patch(table, id, data);
  }

  /** Delete a document by ID */
  async delete(table: string, id: string): Promise<void> {
    await this._pool.query(
      `DELETE FROM "${this._schema}"."${table}" WHERE _id = $1`,
      [id]
    );
    this._emitChange(table, "DELETE", id);
  }

  private _emitChange(table: string, type: "INSERT" | "UPDATE" | "DELETE", id: string) {
    // Emit to the global realtime manager (IAC-21)
    const mgr = (globalThis as any).__betterbaseRealtimeManager;
    mgr?.emitTableChange?.({ table, type, id });
  }
}
```

**Acceptance criteria:**
- `ctx.db.get("users", id)` returns typed document or `null`
- `ctx.db.query("users").filter("email", "eq", "x").first()` works
- `ctx.db.insert("users", data)` injects `_id`, `_createdAt`, `_updatedAt` automatically
- `ctx.db.patch(table, id, fields)` only updates provided fields + `_updatedAt`
- Mutations emit change events for real-time invalidation (IAC-21)

---

### Task IAC-08 — Function Registry (File Discovery)

**Depends on:** IAC-07

**What it is:** Scans the `bbf/` directory, imports all query/mutation/action exports, and registers them in a flat registry keyed by path (`queries/users/getUser`).

**Create file:** `packages/core/src/iac/function-registry.ts`

```typescript
import { join, relative, extname } from "path";
import { readdir } from "fs/promises";

export interface RegisteredFunction {
  kind:    "query" | "mutation" | "action";
  path:    string;   // e.g. "queries/users/getUser"
  name:    string;   // e.g. "getUser"
  module:  string;   // absolute file path
  handler: unknown;  // the QueryRegistration | MutationRegistration | ActionRegistration
}

const FUNCTION_DIRS = ["queries", "mutations", "actions"] as const;

/** Walk a directory recursively and return all .ts/.js file paths */
async function walk(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  const files: string[] = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory())                             files.push(...await walk(full));
    else if ([".ts", ".js"].includes(extname(entry.name))) files.push(full);
  }
  return files;
}

/** Scan bbfDir and return all registered functions */
export async function discoverFunctions(bbfDir: string): Promise<RegisteredFunction[]> {
  const registered: RegisteredFunction[] = [];

  for (const kind of FUNCTION_DIRS) {
    const dir   = join(bbfDir, kind);
    const files = await walk(dir);

    for (const file of files) {
      const rel  = relative(dir, file).replace(/\.(ts|js)$/, "");
      const mod  = await import(file).catch(() => null);
      if (!mod) continue;

      for (const [exportName, exportValue] of Object.entries(mod)) {
        if (!exportValue || typeof exportValue !== "object") continue;
        const fn = exportValue as any;
        if (!fn._handler || !fn._args) continue;

        const fnKind: "query" | "mutation" | "action" =
          fn[Symbol.for("BetterBaseFunction")] ?? kind.slice(0, -1) as any;

        registered.push({
          kind:    fnKind,
          path:    `${kind}/${rel}/${exportName}`,
          name:    exportName,
          module:  file,
          handler: fn,
        });
      }
    }
  }

  return registered;
}

/** Singleton registry (populated once on server start or bb dev) */
let _registry: RegisteredFunction[] = [];

export function setFunctionRegistry(fns: RegisteredFunction[]) {
  _registry = fns;
}

export function getFunctionRegistry(): RegisteredFunction[] {
  return _registry;
}

export function lookupFunction(path: string): RegisteredFunction | null {
  return _registry.find((f) => f.path === path) ?? null;
}
```

**Acceptance criteria:**
- Scans `bbf/queries/`, `bbf/mutations/`, `bbf/actions/` recursively
- Each exported `query()`/`mutation()`/`action()` becomes a registered entry
- Path convention: `queries/users/getUser` (directory/file/exportName)
- Gracefully skips files that fail to import

---

### Task IAC-09 — `cron.ts` Primitive

**Depends on:** IAC-08

**Create file:** `packages/core/src/iac/cron.ts`

```typescript
import { z } from "zod";
import type { MutationRegistration } from "./functions";

export interface CronJob {
  name:     string;
  schedule: string;   // cron expression: "0 * * * *", "*/5 * * * *", etc.
  fn:       MutationRegistration<any, any>;
  args:     Record<string, unknown>;
}

const _jobs: CronJob[] = [];

/** Register a cron job. Called in bbf/cron.ts. */
export function cron(
  name:     string,
  schedule: string,
  fn:       MutationRegistration<any, any>,
  args:     Record<string, unknown> = {}
): void {
  _jobs.push({ name, schedule, fn, args });
}

export function getCronJobs(): CronJob[] {
  return _jobs;
}
```

**Example (`bbf/cron.ts`):**

```typescript
import { cron } from "@betterbase/core/iac";
import { api } from "./_generated/api";

// Run every hour
cron("cleanup-sessions", "0 * * * *", api.mutations.auth.cleanupExpiredSessions, {});

// Run daily at midnight
cron("send-digest", "0 0 * * *", api.mutations.email.sendDailyDigest, {});
```

**Acceptance criteria:**
- `cron()` is called at module load time, registering jobs globally
- `getCronJobs()` returns all registered jobs for the runtime to schedule
- Schedule string is a standard 5-part cron expression
- Jobs are mutation registrations — they run in a transaction

---

## Phase 3 — Code Generation

### Task IAC-10 — Drizzle Schema Generator

**Depends on:** IAC-09

**What it is:** Reads `bbf/schema.ts`, serializes it, and writes `src/db/schema.generated.ts` — a real Drizzle schema derived from the IaC schema. Developers never edit this file.

**Create file:** `packages/core/src/iac/generators/drizzle-schema-gen.ts`

```typescript
import type { SerializedSchema, SerializedTable, SerializedColumn } from "../schema-serializer";

function colTypeToSqlite(type: string, colName: string): string {
  if (type === "string" || type.startsWith("id:") || type.startsWith("literal:") || type.startsWith("union:"))
    return `text('${colName}')`;
  if (type === "number")  return `real('${colName}')`;
  if (type === "int64")   return `integer('${colName}')`;
  if (type === "boolean") return `integer('${colName}', { mode: 'boolean' })`;
  if (type === "date")    return `integer('${colName}', { mode: 'timestamp' })`;
  if (type.startsWith("array:") || type === "object") return `text('${colName}', { mode: 'json' })`;
  return `text('${colName}')`;
}

function colTypeToPostgres(type: string, colName: string): string {
  if (type === "string" || type.startsWith("id:") || type.startsWith("literal:") || type.startsWith("union:"))
    return `text('${colName}')`;
  if (type === "number")  return `doublePrecision('${colName}')`;
  if (type === "int64")   return `bigint('${colName}', { mode: 'bigint' })`;
  if (type === "boolean") return `boolean('${colName}')`;
  if (type === "date")    return `timestamp('${colName}', { withTimezone: true })`;
  if (type.startsWith("array:") || type === "object") return `jsonb('${colName}')`;
  return `text('${colName}')`;
}

function generateTableCode(table: SerializedTable, dialect: "sqlite" | "postgres"): string {
  const colFn  = dialect === "sqlite" ? colTypeToSqlite : colTypeToPostgres;
  const tableFn = dialect === "sqlite" ? "sqliteTable" : "pgTable";

  const cols = table.columns.map((col) => {
    let def = colFn(col.type, col.name);

    if (col.name === "_id") {
      def += ".primaryKey()";
    } else if (!col.optional && !col.system) {
      def += ".notNull()";
    }

    if (col.name === "_createdAt" || col.name === "_updatedAt") {
      def += ".default(sql`now()`)";
    }

    return `  ${col.name}: ${def}`;
  }).join(",\n");

  // Add index definitions as a third argument to the table fn
  const indexLines = table.indexes.map((idx) => {
    const fields = idx.fields.map((f) => `table.${f}`).join(", ");
    if (idx.type === "uniqueIndex") return `  ${idx.name}: uniqueIndex('${table.name}_${idx.name}').on(${fields})`;
    return `  ${idx.name}: index('${table.name}_${idx.name}').on(${fields})`;
  });

  const tableBody = indexLines.length
    ? `, (table) => ({\n${indexLines.join(",\n")}\n})`
    : "";

  return `export const ${table.name} = ${tableFn}('${table.name}', {\n${cols}\n}${tableBody});`;
}

export function generateDrizzleSchema(
  schema:  SerializedSchema,
  dialect: "sqlite" | "postgres" = "sqlite"
): string {
  const imports = dialect === "sqlite"
    ? `import { sqliteTable, text, real, integer, index, uniqueIndex } from 'drizzle-orm/sqlite-core';\nimport { sql } from 'drizzle-orm';`
    : `import { pgTable, text, doublePrecision, bigint, boolean, timestamp, jsonb, index, uniqueIndex } from 'drizzle-orm/pg-core';\nimport { sql } from 'drizzle-orm';`;

  const header = `// AUTO-GENERATED by BetterBase IaC — DO NOT EDIT\n// Source: bbf/schema.ts\n// Generated: ${schema.generated}\n\n${imports}\n\n`;

  const tables = schema.tables.map((t) => generateTableCode(t, dialect)).join("\n\n");

  return header + tables + "\n";
}
```

**Acceptance criteria:**
- Generated file has `// AUTO-GENERATED` header
- Supports `"sqlite"` and `"postgres"` dialects
- System fields (`_id`, `_createdAt`, `_updatedAt`) always present in generated code
- `v.id("users")` serialized as `text` (foreign keys are text IDs in this model)
- Generated file passes `tsc --noEmit`

---

### Task IAC-11 — Migration Generator

**Depends on:** IAC-10

**What it is:** Reads the diff output (IAC-05), generates SQL migration files, and writes them to `drizzle/migrations/`. Destructive changes are gated behind a `--force` flag.

**Create file:** `packages/core/src/iac/generators/migration-gen.ts`

```typescript
import type { SchemaDiff, SchemaDiffChange } from "../schema-diff";
import type { SerializedColumn } from "../schema-serializer";

function colTypeToSQL(type: string): string {
  if (type === "number")  return "REAL";
  if (type === "int64")   return "BIGINT";
  if (type === "boolean") return "BOOLEAN";
  if (type === "date")    return "TIMESTAMPTZ";
  if (type.startsWith("array:") || type === "object") return "JSONB";
  return "TEXT";  // default: string, id:*, literal:*, union:*
}

function changeToSQL(change: SchemaDiffChange): string[] {
  switch (change.type) {
    case "ADD_TABLE": {
      const t = change.after as { columns: SerializedColumn[] };
      const cols = t.columns.map((c) => {
        let line = `  "${c.name}" ${colTypeToSQL(c.type)}`;
        if (c.name === "_id")         line += " PRIMARY KEY";
        else if (!c.optional)         line += " NOT NULL";
        if (c.name === "_createdAt")  line += " DEFAULT NOW()";
        if (c.name === "_updatedAt")  line += " DEFAULT NOW()";
        return line;
      });
      return [`CREATE TABLE IF NOT EXISTS "${change.table}" (\n${cols.join(",\n")}\n);`];
    }

    case "DROP_TABLE":
      return [`DROP TABLE IF EXISTS "${change.table}";`];

    case "ADD_COLUMN": {
      const col = change.after as SerializedColumn;
      const nullable = col.optional ? "" : " NOT NULL";
      return [`ALTER TABLE "${change.table}" ADD COLUMN "${col.name}" ${colTypeToSQL(col.type)}${nullable};`];
    }

    case "DROP_COLUMN":
      return [`ALTER TABLE "${change.table}" DROP COLUMN "${change.column}";`];

    case "ALTER_COLUMN": {
      const after = change.after as SerializedColumn;
      return [
        `ALTER TABLE "${change.table}" ALTER COLUMN "${change.column}" TYPE ${colTypeToSQL(after.type)} USING "${change.column}"::${colTypeToSQL(after.type)};`,
      ];
    }

    case "ADD_INDEX": {
      return [`CREATE INDEX IF NOT EXISTS "${change.table}_${change.index}" ON "${change.table}" ("${change.index}");`];
    }

    case "DROP_INDEX":
      return [`DROP INDEX IF EXISTS "${change.table}_${change.index}";`];
  }
}

export interface GeneratedMigration {
  filename: string;
  sql:      string;
}

export function generateMigration(
  diff:    SchemaDiff,
  seq:     number,   // next migration sequence number (e.g. 5)
  label:   string    // short label for filename
): GeneratedMigration {
  const filename = String(seq).padStart(4, "0") + `_${label.replace(/\s+/g, "_").toLowerCase()}.sql`;

  const up: string[] = [
    `-- BetterBase IaC Auto-Migration`,
    `-- Generated: ${new Date().toISOString()}`,
    ``,
  ];

  for (const change of diff.changes) {
    up.push(...changeToSQL(change));
    up.push("");
  }

  return { filename, sql: up.join("\n") };
}
```

**Acceptance criteria:**
- `generateMigration()` produces valid Postgres SQL
- `ADD_TABLE` includes all columns with correct types
- Filename format: `0001_add_users_table.sql`
- One migration file per `bb iac sync` call (batches all pending changes)
- Returns both filename and SQL content for the CLI to write

---

### Task IAC-12 — API Type Generator (`_generated/api.d.ts`)

**Depends on:** IAC-11

**What it is:** Reads function registrations discovered by IAC-08, generates a `.d.ts` file declaring the `api` object shape used by the client.

**Create file:** `packages/core/src/iac/generators/api-typegen.ts`

```typescript
import type { RegisteredFunction } from "../function-registry";

/**
 * Given a flat list of registered functions, produce the content of
 * bbf/_generated/api.d.ts — the type-safe API object.
 */
export function generateApiTypes(fns: RegisteredFunction[]): string {
  // Group by path segments
  const groups: Record<string, Record<string, Record<string, RegisteredFunction>>> = {
    queries:   {},
    mutations: {},
    actions:   {},
  };

  for (const fn of fns) {
    const parts = fn.path.split("/");
    const kind  = parts[0];   // queries | mutations | actions
    const file  = parts.slice(1, -1).join("/") || "root";
    const name  = parts[parts.length - 1];

    if (!groups[kind]) continue;
    if (!groups[kind][file]) groups[kind][file] = {};
    groups[kind][file][name] = fn;
  }

  const lines: string[] = [
    `// AUTO-GENERATED by BetterBase IaC — DO NOT EDIT`,
    `// Source: bbf/**/*.ts`,
    `// Run \`bb iac generate\` to regenerate`,
    ``,
    `import type { QueryRegistration, MutationRegistration, ActionRegistration } from "@betterbase/core/iac";`,
    ``,
    `export declare const api: {`,
  ];

  for (const [kind, files] of Object.entries(groups)) {
    lines.push(`  ${kind}: {`);
    for (const [file, exports] of Object.entries(files)) {
      const key = file.replace(/\//g, "_") || "root";
      lines.push(`    ${key}: {`);
      for (const [name, fn] of Object.entries(exports)) {
        const type = fn.kind === "query"
          ? "QueryRegistration"
          : fn.kind === "mutation"
          ? "MutationRegistration"
          : "ActionRegistration";
        lines.push(`      ${name}: ${type}<any, any>;`);
      }
      lines.push(`    };`);
    }
    lines.push(`  };`);
  }

  lines.push(`};`);
  lines.push(``);

  // Also generate FunctionReference type for useQuery/useMutation
  lines.push(`export type FunctionReference<T extends "query" | "mutation" | "action"> =`);
  lines.push(`  T extends "query"    ? QueryRegistration<any, any>`);
  lines.push(`  : T extends "mutation" ? MutationRegistration<any, any>`);
  lines.push(`  : ActionRegistration<any, any>;`);

  return lines.join("\n");
}
```

**Acceptance criteria:**
- Generated file is a `.d.ts` (declaration only, no runtime code)
- `api.queries.users.getUser` resolves to correct `QueryRegistration` type
- Client can import `api` and get full autocomplete on all function paths
- Regenerated on every `bb dev` watch cycle

---

## Phase 4 — HTTP Runtime

### Task IAC-13 — Function HTTP Router

**Depends on:** IAC-12

**What it is:** A Hono router mounted at `/bbf` that executes registered functions. Protocol: `POST /bbf/:kind/:path` with JSON body `{ args: {} }`.

**Create file:** `packages/server/src/routes/bbf/index.ts`

```typescript
import { Hono } from "hono";
import { z } from "zod";
import { lookupFunction } from "@betterbase/core/iac";
import { DatabaseReader, DatabaseWriter } from "@betterbase/core/iac";
import { getPool } from "../../lib/db";
import { extractBearerToken, verifyAdminToken } from "../../lib/auth";

export const bbfRouter = new Hono();

// All function calls: POST /bbf/:kind/*
bbfRouter.post("/:kind/*", async (c) => {
  const kind  = c.req.param("kind") as "queries" | "mutations" | "actions";
  const rest  = c.req.path.replace(`/bbf/${kind}/`, "");
  const path  = `${kind}/${rest}`;

  const fn = lookupFunction(path);
  if (!fn) return c.json({ error: `Function not found: ${path}` }, 404);

  // Parse body
  let args: unknown;
  try {
    const body = await c.req.json();
    args = body.args ?? {};
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  // Validate args
  const parsed = (fn.handler as any)._args.safeParse(args);
  if (!parsed.success) {
    return c.json({ error: "Invalid arguments", details: parsed.error.flatten() }, 400);
  }

  // Auth context
  const token = extractBearerToken(c.req.header("Authorization"));
  const adminPayload = token ? await verifyAdminToken(token) : null;
  const authCtx = { userId: adminPayload?.sub ?? null, token };

  // Build DB context
  const pool = getPool();
  const projectSlug = c.req.header("X-Project-Slug") ?? "default";
  const dbSchema    = `project_${projectSlug}`;

  try {
    let result: unknown;

    if (fn.kind === "query") {
      const ctx = { db: new DatabaseReader(pool, dbSchema), auth: authCtx, storage: buildStorageReader() };
      result = await (fn.handler as any)._handler(ctx, parsed.data);
    } else if (fn.kind === "mutation") {
      const writer = new DatabaseWriter(pool, dbSchema);
      const ctx = { db: writer, auth: authCtx, storage: buildStorageWriter(), scheduler: buildScheduler(pool) };
      result = await (fn.handler as any)._handler(ctx, parsed.data);
    } else {
      // action
      const ctx = buildActionCtx(pool, dbSchema, authCtx);
      result = await (fn.handler as any)._handler(ctx, parsed.data);
    }

    return c.json({ result });
  } catch (err: any) {
    console.error(`[bbf] Error in ${path}:`, err);
    return c.json({ error: err.message ?? "Function error" }, 500);
  }
});

// Helpers (stubs — wired to real implementations in IAC-17/IAC-20)
function buildStorageReader() {
  return { getUrl: async (_id: string) => null };
}

function buildStorageWriter() {
  return {
    getUrl:  async (_id: string)  => null,
    store:   async (_blob: Blob)  => "stub-id",
    delete:  async (_id: string)  => {},
  };
}

function buildScheduler(pool: any) {
  return {
    runAfter:  async () => "job-id",
    runAt:     async () => "job-id",
    cancel:    async () => {},
  };
}

function buildActionCtx(pool: any, dbSchema: string, auth: any) {
  return {
    auth,
    storage:    buildStorageWriter(),
    scheduler:  buildScheduler(pool),
    runQuery:   async (fn: any, args: any) => (fn._handler({ db: new DatabaseReader(pool, dbSchema), auth, storage: buildStorageReader() }, args)),
    runMutation: async (fn: any, args: any) => (fn._handler({ db: new DatabaseWriter(pool, dbSchema), auth, storage: buildStorageWriter(), scheduler: buildScheduler(pool) }, args)),
  };
}
```

**Mount in `packages/server/src/index.ts`:**

```typescript
import { bbfRouter } from "./routes/bbf/index";
// ...
app.route("/bbf", bbfRouter);
```

**Transport protocol:**
```bash
# Call a query
curl -X POST http://localhost:3001/bbf/queries/users/getUser \
  -H "Content-Type: application/json" \
  -H "X-Project-Slug: my-project" \
  -H "Authorization: Bearer <token>" \
  -d '{"args": {"id": "abc123"}}'

# Response
{"result": {"_id": "abc123", "name": "Alice", ...}}
```

**Acceptance criteria:**
- `POST /bbf/queries/*` runs queries; `POST /bbf/mutations/*` runs mutations
- Args validated against the function's Zod schema before execution
- 404 for unknown function paths
- 400 for invalid args (Zod error details returned)
- `X-Project-Slug` header routes to the correct per-project schema

---

### Task IAC-14 — Cron Job Runner

**Depends on:** IAC-13

**What it is:** Reads jobs from `getCronJobs()`, schedules them using `setInterval` on server startup. For production, each trigger calls the function's handler as if it were a mutation.

**Create file:** `packages/server/src/lib/cron-runner.ts`

```typescript
import { getCronJobs } from "@betterbase/core/iac";
import { getPool } from "./db";
import { DatabaseWriter } from "@betterbase/core/iac";

/** Parse a 5-part cron expression and return next delay in ms. Simplified v1 impl. */
function msUntilNext(expression: string): number {
  // v1: only support "*/N * * * *" (every N minutes) and "0 * * * *" (every hour)
  const parts = expression.split(" ");
  if (parts[0].startsWith("*/")) {
    const mins = parseInt(parts[0].slice(2));
    return mins * 60 * 1000;
  }
  if (parts[0] === "0" && parts[1] === "*") return 60 * 60 * 1000;   // hourly
  if (expression === "0 0 * * *")           return 24 * 60 * 60 * 1000; // daily
  return 60 * 60 * 1000; // fallback: hourly
}

export function startCronRunner(projectSlug = "default") {
  const jobs = getCronJobs();
  const pool = getPool();
  const dbSchema = `project_${projectSlug}`;

  for (const job of jobs) {
    const intervalMs = msUntilNext(job.schedule);
    console.log(`[cron] Scheduling "${job.name}" every ${intervalMs / 1000}s`);

    setInterval(async () => {
      console.log(`[cron] Running "${job.name}"`);
      try {
        const db  = new DatabaseWriter(pool, dbSchema);
        const ctx = { db, auth: { userId: null, token: null }, storage: null as any, scheduler: null as any };
        await (job.fn as any)._handler(ctx, job.args);
      } catch (err) {
        console.error(`[cron] Error in "${job.name}":`, err);
      }
    }, intervalMs);
  }
}
```

**Acceptance criteria:**
- Cron jobs start automatically when server starts (called from `packages/server/src/index.ts`)
- Each job gets a full `MutationCtx` (database writer, auth null for system jobs)
- Errors in individual cron jobs are caught and logged — never crash the server
- v1 supports `*/N * * * *` (every N minutes), hourly, and daily schedules

---

## Phase 5 — Real-Time

### Task IAC-15 — Query Subscription Tracker

**Depends on:** IAC-14

**What it is:** Tracks which WebSocket clients are subscribed to which queries. When a mutation writes to a table, the tracker finds all subscribed queries that read from that table and pushes an invalidation message.

**Create file:** `packages/core/src/iac/realtime/subscription-tracker.ts`

```typescript
export interface QuerySubscription {
  clientId:     string;
  functionPath: string;
  args:         Record<string, unknown>;
  tables:       Set<string>;   // tables this query reads from (declared or inferred)
}

class SubscriptionTracker {
  private _subs = new Map<string, QuerySubscription>();  // key: `${clientId}:${path}:${argsHash}`

  subscribe(clientId: string, path: string, args: Record<string, unknown>, tables: string[]) {
    const key = this._key(clientId, path, args);
    this._subs.set(key, { clientId, functionPath: path, args, tables: new Set(tables) });
  }

  unsubscribe(clientId: string, path: string, args: Record<string, unknown>) {
    this._subs.delete(this._key(clientId, path, args));
  }

  unsubscribeClient(clientId: string) {
    for (const [key, sub] of this._subs) {
      if (sub.clientId === clientId) this._subs.delete(key);
    }
  }

  /** Get all subscriptions that read from the given table */
  getAffectedSubscriptions(table: string): QuerySubscription[] {
    const affected: QuerySubscription[] = [];
    for (const sub of this._subs.values()) {
      if (sub.tables.has(table) || sub.tables.has("*")) affected.push(sub);
    }
    return affected;
  }

  private _key(clientId: string, path: string, args: Record<string, unknown>): string {
    return `${clientId}:${path}:${JSON.stringify(args)}`;
  }
}

export const subscriptionTracker = new SubscriptionTracker();
```

**Acceptance criteria:**
- `subscribe()` registers a client's interest in a query + its tables
- `getAffectedSubscriptions(table)` efficiently finds subscriptions to invalidate
- `unsubscribeClient(clientId)` cleans up all subscriptions for a disconnected client
- `"*"` in `tables` means "subscribe to all table changes" (wildcard)

---

### Task IAC-16 — Real-Time Invalidation Push

**Depends on:** IAC-15

**What it is:** When `DatabaseWriter._emitChange()` fires (IAC-07), the realtime manager looks up affected subscriptions and sends `{ type: "invalidate", path, args }` over WebSocket so the client re-fetches.

**Create file:** `packages/core/src/iac/realtime/invalidation-manager.ts`

```typescript
import { subscriptionTracker } from "./subscription-tracker";

export interface TableChangeEvent {
  table:  string;
  type:   "INSERT" | "UPDATE" | "DELETE";
  id:     string;
}

export interface InvalidationMessage {
  type:         "invalidate";
  functionPath: string;
  args:         Record<string, unknown>;
}

type PushFn = (clientId: string, message: InvalidationMessage) => void;

class InvalidationManager {
  private _push: PushFn | null = null;

  /** Wire up the WebSocket push function (set by the server at startup) */
  setPushFn(fn: PushFn) { this._push = fn; }

  /** Called by DatabaseWriter on every insert/update/delete */
  emitTableChange(event: TableChangeEvent) {
    if (!this._push) return;

    const affected = subscriptionTracker.getAffectedSubscriptions(event.table);
    for (const sub of affected) {
      this._push(sub.clientId, {
        type:         "invalidate",
        functionPath: sub.functionPath,
        args:         sub.args,
      });
    }
  }

  /** Expose getStats for the admin dashboard (IAC-19) */
  getStats() {
    return {
      clients:  0,   // wired up in IAC-17
      channels: [],
    };
  }
}

export const invalidationManager = new InvalidationManager();

// Register as global so DatabaseWriter can find it (IAC-07 _emitChange)
(globalThis as any).__betterbaseRealtimeManager = invalidationManager;
```

**Acceptance criteria:**
- `emitTableChange({ table: "users", type: "INSERT", id: "..." })` pushes to all affected subscribers
- No invalidation if no clients subscribed to that table
- `setPushFn()` called once at server startup with the WebSocket send function
- `__betterbaseRealtimeManager` global matches the pattern used in IAC-07 and the existing realtime module

---

### Task IAC-17 — WebSocket Subscription Endpoint

**Depends on:** IAC-16

**What it is:** A WebSocket endpoint at `/bbf/ws` that clients connect to for real-time query subscriptions.

**Create file:** `packages/server/src/routes/bbf/ws.ts`

```typescript
import type { WSContext } from "hono/ws";
import { subscriptionTracker } from "@betterbase/core/iac/realtime/subscription-tracker";
import { invalidationManager } from "@betterbase/core/iac/realtime/invalidation-manager";
import { nanoid } from "nanoid";

interface WSMessage {
  type:    "subscribe" | "unsubscribe" | "ping";
  path?:   string;
  args?:   Record<string, unknown>;
  tables?: string[];
}

/** Map of clientId → WebSocket context */
const clients = new Map<string, WSContext>();

/** Wire the push function into the invalidation manager */
invalidationManager.setPushFn((clientId, message) => {
  const ws = clients.get(clientId);
  if (ws) ws.send(JSON.stringify(message));
});

export const wsBBFHandlers = {
  onOpen(ws: WSContext) {
    const clientId = nanoid();
    (ws as any)._clientId = clientId;
    clients.set(clientId, ws);
    ws.send(JSON.stringify({ type: "connected", clientId }));
  },

  onMessage(ws: WSContext, event: MessageEvent) {
    const clientId: string = (ws as any)._clientId;
    let msg: WSMessage;
    try { msg = JSON.parse(String(event.data)); } catch { return; }

    if (msg.type === "subscribe" && msg.path) {
      subscriptionTracker.subscribe(clientId, msg.path, msg.args ?? {}, msg.tables ?? ["*"]);
    } else if (msg.type === "unsubscribe" && msg.path) {
      subscriptionTracker.unsubscribe(clientId, msg.path, msg.args ?? {});
    } else if (msg.type === "ping") {
      ws.send(JSON.stringify({ type: "pong" }));
    }
  },

  onClose(ws: WSContext) {
    const clientId: string = (ws as any)._clientId;
    clients.delete(clientId);
    subscriptionTracker.unsubscribeClient(clientId);
  },
};
```

**Mount in `packages/server/src/index.ts`:**

```typescript
import { upgradeWebSocket } from "hono/bun";
import { wsBBFHandlers } from "./routes/bbf/ws";
// ...
app.get("/bbf/ws", upgradeWebSocket(() => wsBBFHandlers));
```

**WebSocket protocol:**
```javascript
// Client subscribes
ws.send(JSON.stringify({
  type:   "subscribe",
  path:   "queries/users/getUser",
  args:   { id: "abc123" },
  tables: ["users"],       // which tables this query reads
}));

// Server pushes invalidation on mutation
// → { type: "invalidate", functionPath: "queries/users/getUser", args: { id: "abc123" } }
// Client re-fetches the query.
```

**Acceptance criteria:**
- WebSocket endpoint at `/bbf/ws`
- `subscribe` message registers interest; `unsubscribe` removes it
- Disconnected clients cleaned up from subscription tracker automatically
- `ping/pong` for keepalive

---

## Phase 6 — CLI Integration

### Task IAC-18 — `bb iac sync` Command

**Depends on:** IAC-17

**What it is:** One-shot command: reads `bbf/schema.ts`, diffs against previous schema, generates migration, applies it, updates `_generated/`.

**Create file:** `packages/cli/src/commands/iac/sync.ts`

```typescript
import { join } from "path";
import chalk from "chalk";
import { info, success, error, warn } from "../../utils/logger";
import { serializeSchema, loadSerializedSchema, saveSerializedSchema } from "@betterbase/core/iac";
import { diffSchemas, formatDiff } from "@betterbase/core/iac";
import { generateMigration } from "@betterbase/core/iac";
import { generateDrizzleSchema } from "@betterbase/core/iac";
import { readdir, writeFile, mkdir } from "fs/promises";

export async function runIacSync(projectRoot: string, opts: { force?: boolean } = {}) {
  const bbfDir       = join(projectRoot, "bbf");
  const schemaFile   = join(bbfDir, "schema.ts");
  const prevFile     = join(bbfDir, "_generated", "schema.json");
  const migrDir      = join(projectRoot, "drizzle", "migrations");
  const drizzleOut   = join(projectRoot, "src", "db", "schema.generated.ts");
  const genDir       = join(bbfDir, "_generated");

  // 1. Load bbf/schema.ts
  let schemaMod: any;
  try {
    schemaMod = await import(schemaFile);
  } catch (e: any) {
    error(`Cannot load bbf/schema.ts: ${e.message}`);
    process.exit(1);
  }

  const schema = schemaMod.default ?? schemaMod.schema;
  if (!schema?._tables) {
    error("bbf/schema.ts must export a default defineSchema(...)");
    process.exit(1);
  }

  // 2. Serialize current schema
  const current  = serializeSchema(schema);
  const previous = loadSerializedSchema(prevFile);

  // 3. Diff
  const diff = diffSchemas(previous, current);

  if (diff.isEmpty) {
    success("Schema is up to date. No changes detected.");
    return;
  }

  info("Pending schema changes:");
  console.log(formatDiff(diff));

  // 4. Gate destructive changes
  if (diff.hasDestructive && !opts.force) {
    warn("Destructive changes detected. Re-run with --force to apply, or remove the changes.");
    warn("Destructive operations:\n" + diff.changes.filter(c => c.destructive).map(c => `  ⚠ ${c.type} ${c.table}${c.column ? "." + c.column : ""}`).join("\n"));
    process.exit(1);
  }

  // 5. Generate migration
  const existing = await readdir(migrDir).catch(() => [] as string[]);
  const seq      = existing.filter(f => f.endsWith(".sql")).length + 1;
  const label    = "iac_auto";
  const migration = generateMigration(diff, seq, label);

  await mkdir(migrDir, { recursive: true });
  await writeFile(join(migrDir, migration.filename), migration.sql);
  info(`Migration written: ${migration.filename}`);

  // 6. Generate Drizzle schema
  const drizzleCode = generateDrizzleSchema(current, "postgres");
  await writeFile(drizzleOut, drizzleCode);
  info("Drizzle schema updated: src/db/schema.generated.ts");

  // 7. Save serialized schema for next diff
  await mkdir(genDir, { recursive: true });
  await saveSerializedSchema(current, prevFile);

  // 8. TODO: apply migration (calls existing migration runner from SH-02)
  info("Run the migration runner to apply changes to the database.");

  success("IaC sync complete.");
}
```

**Acceptance criteria:**
- `bb iac sync` exits 0 on clean run, 1 on destructive without `--force`
- Migration file written to `drizzle/migrations/`
- Drizzle schema written to `src/db/schema.generated.ts`
- Serialized schema saved to `bbf/_generated/schema.json` for next diff
- Clear, colored output at every step

---

### Task IAC-19 — `bb iac diff` Command

**Depends on:** IAC-18

**Create file:** `packages/cli/src/commands/iac/diff.ts`

```typescript
import { join } from "path";
import chalk from "chalk";
import { serializeSchema, loadSerializedSchema, diffSchemas, formatDiff } from "@betterbase/core/iac";

export async function runIacDiff(projectRoot: string) {
  const bbfDir   = join(projectRoot, "bbf");
  const prevFile = join(bbfDir, "_generated", "schema.json");

  let schemaMod: any;
  try {
    schemaMod = await import(join(bbfDir, "schema.ts"));
  } catch {
    console.error("Cannot load bbf/schema.ts");
    process.exit(1);
  }

  const schema   = schemaMod.default ?? schemaMod.schema;
  const current  = serializeSchema(schema);
  const previous = loadSerializedSchema(prevFile);
  const diff     = diffSchemas(previous, current);

  if (diff.isEmpty) {
    console.log(chalk.green("✓ No pending schema changes."));
    return;
  }

  console.log(chalk.bold("\nPending changes:"));
  console.log(formatDiff(diff));

  if (diff.hasDestructive) {
    console.log(chalk.yellow("\n⚠  Destructive changes present. Use --force with bb iac sync to apply."));
  }
}
```

**Acceptance criteria:**
- Shows human-readable diff between current `bbf/schema.ts` and last synced state
- Destructive changes highlighted in yellow
- Exits 0 always (diff is informational, not an error)

---

### Task IAC-20 — `bb iac generate` Command

**Depends on:** IAC-19

**What it is:** Regenerates `bbf/_generated/api.d.ts` from the current function files. Run after adding/removing functions.

**Create file:** `packages/cli/src/commands/iac/generate.ts`

```typescript
import { join } from "path";
import { writeFile, mkdir } from "fs/promises";
import { discoverFunctions, generateApiTypes } from "@betterbase/core/iac";
import { success, info } from "../../utils/logger";

export async function runIacGenerate(projectRoot: string) {
  const bbfDir = join(projectRoot, "bbf");
  const genDir = join(bbfDir, "_generated");

  info("Scanning bbf/ for functions...");
  const fns = await discoverFunctions(bbfDir);
  info(`Found ${fns.length} functions.`);

  const apiTypes = generateApiTypes(fns);

  await mkdir(genDir, { recursive: true });
  await writeFile(join(genDir, "api.d.ts"), apiTypes);

  success(`Generated bbf/_generated/api.d.ts (${fns.length} functions)`);
}
```

**Acceptance criteria:**
- Scans `bbf/queries/`, `bbf/mutations/`, `bbf/actions/`
- Writes `bbf/_generated/api.d.ts`
- Idempotent — safe to run multiple times

---

### Task IAC-21 — `bb dev` Watch Mode IaC Integration

**Depends on:** IAC-20

**Modify file:** `packages/cli/src/commands/dev.ts`

Add watch for `bbf/` directory alongside existing schema/routes watch:

```typescript
// Add to existing runDevCommand function:

import { runIacGenerate } from "./iac/generate";
import { runIacSync } from "./iac/sync";

// Inside runDevCommand, after existing watchers:
const bbfDir = join(projectRoot, "bbf");
if (existsSync(bbfDir)) {
  // Watch schema.ts for changes → re-sync
  watch(join(bbfDir, "schema.ts"), async () => {
    info("[iac] schema.ts changed — running sync...");
    await runIacSync(projectRoot, { force: false }).catch(() =>
      warn("[iac] Sync failed (destructive changes?). Run bb iac sync --force to override.")
    );
  });

  // Watch function files for changes → re-generate types
  watch(bbfDir, { recursive: true }, async (_, filename) => {
    if (filename?.startsWith("_generated")) return;
    if (filename?.endsWith(".ts")) {
      info(`[iac] ${filename} changed — regenerating types...`);
      await runIacGenerate(projectRoot).catch(console.error);
    }
  });

  info("[iac] Watching bbf/ for changes.");
}
```

**Register new commands in `packages/cli/src/index.ts`:**

```typescript
import { runIacSync } from "./commands/iac/sync";
import { runIacDiff } from "./commands/iac/diff";
import { runIacGenerate } from "./commands/iac/generate";

program
  .command("iac sync")
  .description("Sync bbf/schema.ts → migrations + Drizzle schema")
  .option("--force", "Apply destructive changes without prompt")
  .action((opts) => runIacSync(process.cwd(), opts));

program
  .command("iac diff")
  .description("Show pending schema changes")
  .action(() => runIacDiff(process.cwd()));

program
  .command("iac generate")
  .description("Regenerate bbf/_generated/ types from function files")
  .action(() => runIacGenerate(process.cwd()));

// Add "iac" variants to PUBLIC_COMMANDS if needed (iac diff is safe without auth)
```

**Acceptance criteria:**
- `bb dev` watches `bbf/schema.ts` → runs `iac sync` on change
- `bb dev` watches `bbf/**/*.ts` → runs `iac generate` on function file change
- `bb iac sync`, `bb iac diff`, `bb iac generate` all registered as CLI commands
- `bb iac diff` added to `PUBLIC_COMMANDS` (safe without auth)

---

## Phase 7 — Client SDK

### Task IAC-22 — `useQuery` Hook (React, Real-Time)

**Depends on:** IAC-21

**Create file:** `packages/client/src/iac/hooks.ts`

```typescript
import { useState, useEffect, useRef, useCallback } from "react";
import type { QueryRegistration, MutationRegistration, ActionRegistration } from "@betterbase/core/iac";

const API_BASE = typeof window !== "undefined"
  ? (window as any).__BETTERBASE_URL__ ?? "http://localhost:3001"
  : "http://localhost:3001";

function getToken(): string | null {
  return typeof localStorage !== "undefined" ? localStorage.getItem("bb_token") : null;
}

async function callFunction(path: string, args: unknown): Promise<unknown> {
  const res = await fetch(`${API_BASE}/bbf/${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
    },
    body: JSON.stringify({ args }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Request failed" }));
    throw new Error((err as any).error ?? `HTTP ${res.status}`);
  }
  const { result } = await res.json();
  return result;
}

// ─── useQuery ─────────────────────────────────────────────────────────────────

export type QueryStatus = "loading" | "success" | "error";

export interface UseQueryResult<T> {
  data:    T | undefined;
  status:  QueryStatus;
  error:   Error | null;
  refetch: () => void;
}

/**
 * Real-time query hook. Fetches on mount, re-fetches whenever the server
 * pushes an invalidation for this query over WebSocket.
 */
export function useQuery<TArgs extends Record<string, unknown>, TReturn>(
  fn:   QueryRegistration<any, TReturn>,
  args: TArgs
): UseQueryResult<TReturn> {
  const [data,   setData]   = useState<TReturn | undefined>(undefined);
  const [status, setStatus] = useState<QueryStatus>("loading");
  const [error,  setError]  = useState<Error | null>(null);
  const pathRef = useRef<string>("");

  // Resolve function path from registration (set by IAC-23 helper)
  const path = (fn as any).__bbfPath ?? "unknown";
  pathRef.current = path;

  const fetch_ = useCallback(async () => {
    setStatus("loading");
    try {
      const result = await callFunction(path, args) as TReturn;
      setData(result);
      setStatus("success");
      setError(null);
    } catch (e: any) {
      setError(e);
      setStatus("error");
    }
  }, [path, JSON.stringify(args)]);

  useEffect(() => { fetch_(); }, [fetch_]);

  // Subscribe to invalidations via WebSocket
  useEffect(() => {
    const ws = getBBFWebSocket();
    if (!ws) return;

    ws.send(JSON.stringify({ type: "subscribe", path, args, tables: ["*"] }));

    const handler = (event: MessageEvent) => {
      const msg = JSON.parse(event.data);
      if (msg.type === "invalidate" && msg.functionPath === path
          && JSON.stringify(msg.args) === JSON.stringify(args)) {
        fetch_();
      }
    };

    ws.addEventListener("message", handler);
    return () => {
      ws.removeEventListener("message", handler);
      ws.send(JSON.stringify({ type: "unsubscribe", path, args }));
    };
  }, [path, JSON.stringify(args)]);

  return { data, status, error, refetch: fetch_ };
}

// ─── useMutation ──────────────────────────────────────────────────────────────

export interface UseMutationResult<TArgs, TReturn> {
  mutate:    (args: TArgs)      => Promise<TReturn>;
  isPending: boolean;
  error:     Error | null;
}

export function useMutation<TArgs extends Record<string, unknown>, TReturn>(
  fn: MutationRegistration<any, TReturn>
): UseMutationResult<TArgs, TReturn> {
  const [isPending, setIsPending] = useState(false);
  const [error,     setError]     = useState<Error | null>(null);
  const path = (fn as any).__bbfPath ?? "unknown";

  const mutate = async (args: TArgs): Promise<TReturn> => {
    setIsPending(true);
    setError(null);
    try {
      const result = await callFunction(path, args) as TReturn;
      return result;
    } catch (e: any) {
      setError(e);
      throw e;
    } finally {
      setIsPending(false);
    }
  };

  return { mutate, isPending, error };
}

// ─── useAction ────────────────────────────────────────────────────────────────

export function useAction<TArgs extends Record<string, unknown>, TReturn>(
  fn: ActionRegistration<any, TReturn>
): UseMutationResult<TArgs, TReturn> {
  const path = (fn as any).__bbfPath ?? "unknown";
  // Actions follow the same pattern as mutations from the client's perspective
  return useMutation({ ...fn, __bbfPath: path } as any);
}

// ─── WebSocket singleton ───────────────────────────────────────────────────────

let _ws: WebSocket | null = null;

function getBBFWebSocket(): WebSocket | null {
  if (typeof WebSocket === "undefined") return null;
  if (_ws && _ws.readyState === WebSocket.OPEN) return _ws;

  const wsUrl = API_BASE.replace(/^http/, "ws") + "/bbf/ws";
  _ws = new WebSocket(wsUrl);
  _ws.onclose = () => { _ws = null; };
  return _ws;
}
```

**Acceptance criteria:**
- `useQuery(api.queries.users.getUser, { id })` fetches on mount and re-fetches on invalidation
- `useMutation(api.mutations.users.createUser)` returns `{ mutate, isPending, error }`
- WebSocket connection is a singleton — not created per hook
- Args changes trigger re-fetch

---

### Task IAC-23 — Vanilla (Non-React) Client + `__bbfPath` Injection

**Depends on:** IAC-22

**Create file:** `packages/client/src/iac/client.ts`

```typescript
import type { QueryRegistration, MutationRegistration, ActionRegistration } from "@betterbase/core/iac";

export interface BetterbaseFnClient {
  query<TReturn>(fn: QueryRegistration<any, TReturn>, args: Record<string, unknown>): Promise<TReturn>;
  mutation<TReturn>(fn: MutationRegistration<any, TReturn>, args: Record<string, unknown>): Promise<TReturn>;
  action<TReturn>(fn: ActionRegistration<any, TReturn>, args: Record<string, unknown>): Promise<TReturn>;
}

export function createFnClient(opts: {
  baseUrl: string;
  getToken?: () => string | null;
}): BetterbaseFnClient {
  async function call(kind: string, fn: any, args: unknown): Promise<unknown> {
    const path  = fn.__bbfPath ?? "unknown";
    const token = opts.getToken?.();
    const res   = await fetch(`${opts.baseUrl}/bbf/${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ args }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
      throw new Error((err as any).error);
    }
    const { result } = await res.json();
    return result;
  }

  return {
    query:    (fn, args) => call("queries",    fn, args) as any,
    mutation: (fn, args) => call("mutations",  fn, args) as any,
    action:   (fn, args) => call("actions",    fn, args) as any,
  };
}
```

**Also: inject `__bbfPath` into registrations via the code generator (IAC-12)**

Add to `generateApiTypes()` output a runtime module `bbf/_generated/api.js`:

```typescript
// The runtime api.js sets __bbfPath on each registration so hooks can find the path
// Generated by bb iac generate — DO NOT EDIT

import * as queriesUsers from "../queries/users";
// ... (one import per discovered module)

export const api = {
  queries: {
    users: Object.fromEntries(
      Object.entries(queriesUsers).map(([name, fn]) => [
        name,
        Object.assign(fn, { __bbfPath: `queries/users/${name}` })
      ])
    ),
  },
  // ...
};
```

**Acceptance criteria:**
- `createFnClient()` works in Node.js, Deno, Bun — no React required
- `__bbfPath` set on every registration by the generated runtime `api.js`
- Hooks in IAC-22 read `fn.__bbfPath` to construct the fetch URL

---

## Phase 8 — Wire-Up, Tests, and Package Exports

### Task IAC-24 — Update `packages/core` Exports

**Depends on:** IAC-23

**Modify file:** `packages/core/src/index.ts`

Add the following exports:

```typescript
// IaC exports
export * from "./iac/index";
export * from "./iac/schema-serializer";
export * from "./iac/schema-diff";
export * from "./iac/generators/drizzle-schema-gen";
export * from "./iac/generators/migration-gen";
export * from "./iac/generators/api-typegen";
export * from "./iac/function-registry";
export * from "./iac/db-context";
export * from "./iac/realtime/subscription-tracker";
export * from "./iac/realtime/invalidation-manager";
```

**Add subpath export to `packages/core/package.json`:**

```json
{
  "exports": {
    ".":     "./src/index.ts",
    "./iac": "./src/iac/index.ts",
    "./iac/realtime/subscription-tracker": "./src/iac/realtime/subscription-tracker.ts",
    "./iac/realtime/invalidation-manager": "./src/iac/realtime/invalidation-manager.ts",
    "./iac/generators/drizzle-schema-gen": "./src/iac/generators/drizzle-schema-gen.ts",
    "./iac/generators/migration-gen":      "./src/iac/generators/migration-gen.ts",
    "./iac/generators/api-typegen":        "./src/iac/generators/api-typegen.ts",
    "./iac/function-registry":             "./src/iac/function-registry.ts",
    "./iac/db-context":                    "./src/iac/db-context.ts"
  }
}
```

**Acceptance criteria:**
- `import { v, defineSchema, defineTable, query, mutation, action } from "@betterbase/core/iac"` works
- Subpath exports resolve correctly for CLI and server consumers
- `bun run build` for `packages/core` passes

---

### Task IAC-25 — Integration Test: Full IaC Flow

**Depends on:** IAC-24

**Create file:** `packages/core/test/iac.test.ts`

```typescript
import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { v, defineSchema, defineTable, query, mutation, serializeSchema, diffSchemas } from "@betterbase/core/iac";

describe("Validator primitives", () => {
  it("v.string() validates strings", () => {
    const schema = v.string();
    expect(schema.safeParse("hello").success).toBe(true);
    expect(schema.safeParse(123).success).toBe(false);
  });

  it("v.id() brands the string", () => {
    const schema = v.id("users");
    expect(schema.safeParse("abc").success).toBe(true);
  });

  it("v.optional() makes fields optional", () => {
    const schema = v.optional(v.string());
    expect(schema.safeParse(undefined).success).toBe(true);
  });
});

describe("defineTable + defineSchema", () => {
  it("injects system fields", () => {
    const table = defineTable({ name: v.string() });
    const keys  = Object.keys(table._schema.shape);
    expect(keys).toContain("_id");
    expect(keys).toContain("_createdAt");
    expect(keys).toContain("_updatedAt");
    expect(keys).toContain("name");
  });

  it("chains index definitions", () => {
    const table = defineTable({ email: v.string() }).uniqueIndex("by_email", ["email"]);
    expect(table._indexes).toHaveLength(1);
    expect(table._indexes[0].type).toBe("uniqueIndex");
  });

  it("defineSchema wraps tables", () => {
    const schema = defineSchema({ users: defineTable({ name: v.string() }) });
    expect(schema._tables.users).toBeDefined();
  });
});

describe("Schema serializer + diff", () => {
  const schema = defineSchema({
    users: defineTable({ name: v.string(), email: v.string() }).uniqueIndex("by_email", ["email"]),
  });

  it("serializes schema to JSON", () => {
    const s = serializeSchema(schema);
    expect(s.tables).toHaveLength(1);
    expect(s.tables[0].name).toBe("users");
    const emailCol = s.tables[0].columns.find(c => c.name === "email");
    expect(emailCol?.type).toBe("string");
  });

  it("empty diff for identical schemas", () => {
    const s    = serializeSchema(schema);
    const diff = diffSchemas(s, s);
    expect(diff.isEmpty).toBe(true);
  });

  it("detects new table as ADD_TABLE", () => {
    const s1   = serializeSchema(schema);
    const s2   = serializeSchema(defineSchema({ users: defineTable({ name: v.string() }), posts: defineTable({ title: v.string() }) }));
    const diff = diffSchemas(s1, s2);
    expect(diff.changes.some(c => c.type === "ADD_TABLE" && c.table === "posts")).toBe(true);
  });

  it("marks DROP_TABLE as destructive", () => {
    const s1   = serializeSchema(schema);
    const s2   = serializeSchema(defineSchema({}));
    const diff = diffSchemas(s1, s2);
    expect(diff.hasDestructive).toBe(true);
  });
});

describe("query() / mutation() registrations", () => {
  it("query() returns valid registration", () => {
    const fn = query({ args: { id: v.id("users") }, handler: async (ctx, args) => args.id });
    expect(fn._args).toBeDefined();
    expect(fn._handler).toBeInstanceOf(Function);
  });

  it("mutation() returns valid registration", () => {
    const fn = mutation({ args: { name: v.string() }, handler: async (ctx, args) => args.name });
    expect(fn._args).toBeDefined();
  });
});
```

**Acceptance criteria:**
- All tests pass with `bun test packages/core/test/iac.test.ts`
- Tests cover validators, defineTable, defineSchema, serializer, diff engine, and function registration

---

## Developer Experience — What It Looks Like

A new project using BetterBase IaC requires three files to get started:

**`bbf/schema.ts`**
```typescript
import { defineSchema, defineTable, v } from "@betterbase/core/iac";

export default defineSchema({
  todos: defineTable({
    text:      v.string(),
    completed: v.boolean(),
    userId:    v.id("users"),
  })
  .index("by_user", ["userId"])
  .index("by_user_completed", ["userId", "completed"]),
});
```

**`bbf/mutations/todos.ts`**
```typescript
import { mutation } from "@betterbase/core/iac";
import { v } from "@betterbase/core/iac";

export const createTodo = mutation({
  args: { text: v.string(), userId: v.id("users") },
  handler: async (ctx, args) => {
    return ctx.db.insert("todos", { ...args, completed: false });
  },
});

export const toggleTodo = mutation({
  args: { id: v.id("todos"), completed: v.boolean() },
  handler: async (ctx, args) => {
    await ctx.db.patch("todos", args.id, { completed: args.completed });
  },
});
```

**`bbf/queries/todos.ts`**
```typescript
import { query } from "@betterbase/core/iac";
import { v } from "@betterbase/core/iac";

export const listTodos = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return ctx.db
      .query("todos")
      .filter("userId", "eq", args.userId)
      .order("desc")
      .collect();
  },
});
```

**React component:**
```tsx
import { useQuery, useMutation } from "@betterbase/client/iac";
import { api } from "../bbf/_generated/api";

export function TodoList({ userId }: { userId: string }) {
  const todos    = useQuery(api.queries.todos.listTodos, { userId });
  const toggle   = useMutation(api.mutations.todos.toggleTodo);

  if (todos.status === "loading") return <div>Loading...</div>;

  return (
    <ul>
      {todos.data?.map(todo => (
        <li key={todo._id} onClick={() => toggle.mutate({ id: todo._id, completed: !todo.completed })}>
          {todo.completed ? "✓" : "○"} {todo.text}
        </li>
      ))}
    </ul>
  );
}
```

---

## Differentiation from Convex

| Feature | Convex | BetterBase IaC |
|---|---|---|
| Validator internals | Custom `v.*` system | Zod under the hood — interops with existing Zod code |
| Database | Convex proprietary | Any Drizzle-supported DB (SQLite, Postgres, MySQL, Neon, Turso) |
| Hosting | Convex cloud only | Self-hosted or BetterBase cloud |
| Existing code | Must migrate fully | Additive — existing Hono routes work unchanged |
| Schema migration | Automatic, invisible | Explicit `bb iac sync` with diff preview + force flag |
| Auth | Clerk / Convex auth | BetterAuth (already in BetterBase) |
| Functions | Isolated Convex runtime | Runs in existing Hono server process |
| Pricing | Convex pricing | Open source, self-hosted |

---

## Execution Order

```
Phase 1 — Validator & Schema
  IAC-01  v.* validator primitives
  IAC-02  defineTable + index builders
  IAC-03  defineSchema + type inference
  IAC-04  Schema serializer
  IAC-05  Schema diff engine

Phase 2 — Function System
  IAC-06  query() / mutation() / action() primitives + ctx types
  IAC-07  DatabaseReader + DatabaseWriter
  IAC-08  Function registry (file discovery)
  IAC-09  cron() primitive

Phase 3 — Code Generation
  IAC-10  Drizzle schema generator
  IAC-11  Migration SQL generator
  IAC-12  API type generator (_generated/api.d.ts)

Phase 4 — HTTP Runtime
  IAC-13  Function HTTP router (/bbf/:kind/*)
  IAC-14  Cron job runner

Phase 5 — Real-Time
  IAC-15  Subscription tracker
  IAC-16  Invalidation manager
  IAC-17  WebSocket endpoint (/bbf/ws)

Phase 6 — CLI
  IAC-18  bb iac sync
  IAC-19  bb iac diff
  IAC-20  bb iac generate
  IAC-21  bb dev watch integration

Phase 7 — Client SDK
  IAC-22  useQuery / useMutation / useAction hooks
  IAC-23  Vanilla client + __bbfPath injection

Phase 8 — Wire-Up
  IAC-24  packages/core exports + subpath config
  IAC-25  Integration tests
```

**Total: 25 tasks across 8 phases.**

---

## Dependencies Checklist

Before starting Phase 1, verify these are available:

| Dependency | Package | Already Present |
|---|---|---|
| `zod` | packages/core | ✓ |
| `nanoid` | packages/server | ✓ |
| `pg` | packages/server | ✓ |
| `hono/ws` | packages/server | verify — may need `@hono/node-ws` or bun ws adapter |
| `react`, `react-dom` | packages/client | add if building hooks |
| `drizzle-orm` | packages/core | ✓ |

---

## Migration Numbering Note

The self-hosted spec (SH-01 through SH-28) uses migration files `001` through `004` in `packages/server/migrations/`. The observability spec adds `005` through `007`. The dashboard backend spec adds `005` through `010` (in a different numbering path).

The IaC-generated migrations live in `drizzle/migrations/` (per-project) — a **separate directory** from the server's internal `packages/server/migrations/`. No conflict.

---

*End of specification. 25 tasks across 8 phases. Execute in listed order. Do not begin Phase 2 until Phase 1 tests pass.*
