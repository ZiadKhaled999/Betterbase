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
