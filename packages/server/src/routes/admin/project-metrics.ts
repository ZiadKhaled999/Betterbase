import { Hono } from "hono";
import { getPool } from "../../lib/db";

export const projectMetricsRoutes = new Hono<{ Variables: { projectId: string } }>();

// GET /admin/projects/:projectId/metrics/overview
projectMetricsRoutes.get("/overview", async (c) => {
	const projectId = c.req.param("projectId");

	const pool = getPool();

	const [total, errors, latency] = await Promise.all([
		pool.query(
			`SELECT COUNT(*)::int as count FROM betterbase_meta.request_logs
           WHERE project_id=$1 AND created_at > NOW() - INTERVAL '24h'`,
			[projectId],
		),
		pool.query(
			`SELECT COUNT(*)::int as count FROM betterbase_meta.request_logs
           WHERE project_id=$1 AND status>=500
           AND created_at > NOW() - INTERVAL '24h'`,
			[projectId],
		),
		pool.query(
			`SELECT AVG(duration_ms)::int AS avg_ms
           FROM betterbase_meta.request_logs
           WHERE project_id=$1 AND created_at > NOW() - INTERVAL '24h'`,
			[projectId],
		),
	]);

	return c.json({
		metrics: {
			requests_24h: total.rows[0].count,
			errors_24h: errors.rows[0].count,
			avg_latency_ms: latency.rows[0].avg_ms ?? 0,
			project_id: projectId,
		},
	});
});

// GET /admin/projects/:projectId/metrics/timeseries?period=24h|7d
projectMetricsRoutes.get("/timeseries", async (c) => {
	const projectId = c.req.param("projectId");
	const period = c.req.query("period") ?? "24h";

	const range = period === "7d" ? "7 days" : "24 hours";

	const pool = getPool();

	const { rows } = await pool.query(
		`
    SELECT date_trunc('hour', created_at) AS bucket,
           COUNT(*)::int AS total,
           COUNT(*) FILTER (WHERE status >= 500)::int AS errors
    FROM betterbase_meta.request_logs
    WHERE project_id = $1 AND created_at > NOW() - INTERVAL '${range}'
    GROUP BY bucket ORDER BY bucket ASC
  `,
		[projectId],
	);

	return c.json({ timeseries: rows, period, project_id: projectId });
});
