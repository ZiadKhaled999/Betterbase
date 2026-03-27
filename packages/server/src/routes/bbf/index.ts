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
