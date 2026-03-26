import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { nanoid } from "nanoid";
import { z } from "zod";
import { getPool } from "../../lib/db";

export const functionRoutes = new Hono();

functionRoutes.get("/", async (c) => {
	const pool = getPool();
	const { rows } = await pool.query(
		"SELECT id, name, runtime, status, deploy_target, created_at FROM betterbase_meta.functions ORDER BY created_at DESC",
	);
	return c.json({ functions: rows });
});

functionRoutes.post(
	"/",
	zValidator(
		"json",
		z.object({
			name: z
				.string()
				.min(1)
				.regex(/^[a-z0-9-]+$/),
			runtime: z.string().default("bun"),
			deploy_target: z.enum(["cloudflare", "vercel"]).optional(),
		}),
	),
	async (c) => {
		const data = c.req.valid("json");
		const pool = getPool();
		const { rows } = await pool.query(
			`INSERT INTO betterbase_meta.functions (id, name, runtime, deploy_target)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, runtime, status, deploy_target, created_at`,
			[nanoid(), data.name, data.runtime, data.deploy_target ?? null],
		);
		return c.json({ function: rows[0] }, 201);
	},
);

functionRoutes.delete("/:id", async (c) => {
	const pool = getPool();
	const { rows } = await pool.query(
		"DELETE FROM betterbase_meta.functions WHERE id = $1 RETURNING id",
		[c.req.param("id")],
	);
	if (rows.length === 0) return c.json({ error: "Not found" }, 404);
	return c.json({ success: true });
});

// GET /admin/functions/:id/invocations?limit=50&status=error
functionRoutes.get("/:id/invocations", async (c) => {
	const limit = Math.min(Number.parseInt(c.req.query("limit") ?? "50"), 200);
	const status = c.req.query("status");

	const pool = getPool();

	const { rows } = await pool.query(
		`
    SELECT id, function_name, status, duration_ms, cold_start,
           request_method, request_path, response_status, error_msg, created_at
    FROM betterbase_meta.function_invocation_logs
    WHERE function_id = $1
      ${status ? "AND status = $3" : ""}
    ORDER BY created_at DESC LIMIT $2
  `,
		status ? [c.req.param("id"), limit, status] : [c.req.param("id"), limit],
	);

	return c.json({ invocations: rows });
});

// GET /admin/functions/:id/stats
functionRoutes.get("/:id/stats", async (c) => {
	const pool = getPool();

	const { rows } = await pool.query(
		`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE status='success')::int AS success,
      COUNT(*) FILTER (WHERE status='error')::int AS errors,
      COUNT(*) FILTER (WHERE cold_start=TRUE)::int AS cold_starts,
      percentile_cont(0.50) WITHIN GROUP (ORDER BY duration_ms)::int AS p50_ms,
      percentile_cont(0.95) WITHIN GROUP (ORDER BY duration_ms)::int AS p95_ms,
      AVG(duration_ms)::int AS avg_ms
    FROM betterbase_meta.function_invocation_logs
    WHERE function_id = $1
      AND created_at > NOW() - INTERVAL '30 days'
  `,
		[c.req.param("id")],
	);

	return c.json({ stats: rows[0] });
});
