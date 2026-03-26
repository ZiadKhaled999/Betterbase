import { Hono } from "hono";
import { getPool } from "../../lib/db";

export const metricsRoutes = new Hono();

// GET /admin/metrics/overview
metricsRoutes.get("/overview", async (c) => {
	const pool = getPool();

	const [projects, admins, fns, errors] = await Promise.all([
		pool.query("SELECT COUNT(*)::int as count FROM betterbase_meta.projects"),
		pool.query("SELECT COUNT(*)::int as count FROM betterbase_meta.admin_users"),
		pool.query("SELECT COUNT(*)::int as count FROM betterbase_meta.functions"),
		pool.query(`SELECT COUNT(*)::int as count FROM betterbase_meta.request_logs
           WHERE status >= 500 AND created_at > NOW() - INTERVAL '24h'`),
	]);

	return c.json({
		metrics: {
			projects: projects.rows[0].count,
			admin_users: admins.rows[0].count,
			functions: fns.rows[0].count,
			errors_24h: errors.rows[0].count,
			server_uptime_seconds: Math.floor(process.uptime()),
			timestamp: new Date().toISOString(),
		},
	});
});

// GET /admin/metrics/timeseries?period=24h|7d|30d
metricsRoutes.get("/timeseries", async (c) => {
	const period = c.req.query("period") ?? "24h";

	const intervalMap: Record<string, string> = {
		"24h": "1 hour",
		"7d": "1 day",
		"30d": "1 day",
	};

	const rangeMap: Record<string, string> = {
		"24h": "24 hours",
		"7d": "7 days",
		"30d": "30 days",
	};

	const interval = intervalMap[period] ?? "1 hour";
	const range = rangeMap[period] ?? "24 hours";

	const pool = getPool();

	const { rows } = await pool.query(
		`
    SELECT date_trunc('${interval}', created_at) AS bucket,
           COUNT(*)::int AS total,
           COUNT(*) FILTER (WHERE status >= 500)::int AS errors
    FROM betterbase_meta.request_logs
    WHERE created_at > NOW() - INTERVAL '${range}'
    GROUP BY bucket ORDER BY bucket ASC
  `,
	);

	return c.json({ timeseries: rows, period });
});

// GET /admin/metrics/latency?period=24h|7d
metricsRoutes.get("/latency", async (c) => {
	const period = c.req.query("period") ?? "24h";

	const range = period === "7d" ? "7 days" : "24 hours";

	const pool = getPool();

	const { rows } = await pool.query(
		`
    SELECT
      percentile_cont(0.50) WITHIN GROUP (ORDER BY duration_ms)::int AS p50,
      percentile_cont(0.95) WITHIN GROUP (ORDER BY duration_ms)::int AS p95,
      percentile_cont(0.99) WITHIN GROUP (ORDER BY duration_ms)::int AS p99,
      AVG(duration_ms)::int AS avg
    FROM betterbase_meta.request_logs
    WHERE created_at > NOW() - INTERVAL '${range}'
      AND duration_ms IS NOT NULL
  `,
	);

	return c.json({
		latency: rows[0] ?? { p50: 0, p95: 0, p99: 0, avg: 0 },
		period,
	});
});

// GET /admin/metrics/top-endpoints?period=24h&limit=10
metricsRoutes.get("/top-endpoints", async (c) => {
	const period = c.req.query("period") ?? "24h";
	const limit = Math.min(Number.parseInt(c.req.query("limit") ?? "10"), 50);

	const range = period === "7d" ? "7 days" : "24 hours";

	const pool = getPool();

	const { rows } = await pool.query(
		`
    SELECT path, method,
           COUNT(*)::int AS count,
           AVG(duration_ms)::int AS avg_ms,
           COUNT(*) FILTER (WHERE status >= 500)::int AS errors
    FROM betterbase_meta.request_logs
    WHERE created_at > NOW() - INTERVAL '${range}'
    GROUP BY path, method
    ORDER BY count DESC
    LIMIT $1
  `,
		[limit],
	);

	return c.json({ endpoints: rows, period });
});
