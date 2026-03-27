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

// ─── Schema Definition ───────────────────────────────────────────────────────

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
