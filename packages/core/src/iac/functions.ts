import { z } from "zod";
import type { DatabaseReader, DatabaseWriter } from "./db-context";

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
