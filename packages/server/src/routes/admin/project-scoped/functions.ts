import { Hono } from "hono";
import { getPool } from "../../../lib/db";

export const projectFunctionRoutes = new Hono();

// GET /admin/projects/:id/functions/:functionId/invocations
projectFunctionRoutes.get("/:functionId/invocations", async (c) => {
	const pool = getPool();
	const limit = Math.min(Number.parseInt(c.req.query("limit") ?? "50"), 200);
	const offset = Number.parseInt(c.req.query("offset") ?? "0");

	const { rows } = await pool.query(
		`SELECT id, trigger_type, status, duration_ms, error_message, created_at
     FROM betterbase_meta.function_invocations
     WHERE function_id = $1
     ORDER BY created_at DESC
     LIMIT $2 OFFSET $3`,
		[c.req.param("functionId"), limit, offset],
	);

	return c.json({ invocations: rows, limit, offset });
});

// GET /admin/projects/:id/functions/:functionId/stats
projectFunctionRoutes.get("/:functionId/stats", async (c) => {
	const pool = getPool();
	const period = c.req.query("period") ?? "24h";
	const intervalMap: Record<string, string> = { "1h": "1 hour", "24h": "24 hours", "7d": "7 days" };
	const interval = intervalMap[period] ?? "24 hours";

	const { rows: summary } = await pool.query(
		`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE status = 'success')::int AS successes,
      COUNT(*) FILTER (WHERE status = 'error')::int AS errors,
      ROUND(AVG(duration_ms))::int AS avg_duration_ms,
      MAX(duration_ms)::int AS max_duration_ms
    FROM betterbase_meta.function_invocations
    WHERE function_id = $1 AND created_at > NOW() - INTERVAL '${interval}'
  `,
		[c.req.param("functionId")],
	);

	const { rows: timeseries } = await pool.query(
		`
    SELECT date_trunc('hour', created_at) AS ts,
           COUNT(*)::int AS invocations,
           COUNT(*) FILTER (WHERE status = 'error')::int AS errors
    FROM betterbase_meta.function_invocations
    WHERE function_id = $1 AND created_at > NOW() - INTERVAL '${interval}'
    GROUP BY 1 ORDER BY 1
  `,
		[c.req.param("functionId")],
	);

	return c.json({ period, summary: summary[0], timeseries });
});
