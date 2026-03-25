import { Hono } from "hono";
import { getPool } from "../../lib/db";

export const metricsEnhancedRoutes = new Hono();

// GET /admin/metrics/overview — enriched overview
metricsEnhancedRoutes.get("/overview", async (c) => {
	const pool = getPool();

	const [projects, admins, webhooks, functions_, recentErrors] = await Promise.all([
		pool.query("SELECT COUNT(*)::int AS count FROM betterbase_meta.projects"),
		pool.query("SELECT COUNT(*)::int AS count FROM betterbase_meta.admin_users"),
		pool.query("SELECT COUNT(*)::int AS count FROM betterbase_meta.webhooks WHERE enabled = TRUE"),
		pool.query(
			"SELECT COUNT(*)::int AS count FROM betterbase_meta.functions WHERE status = 'active'",
		),
		pool.query(`
      SELECT COUNT(*)::int AS count FROM betterbase_meta.request_logs
      WHERE status >= 500 AND created_at > NOW() - INTERVAL '1 hour'
    `),
	]);

	// Per-project user counts
	const { rows: projectRows } = await pool.query("SELECT id, slug FROM betterbase_meta.projects");

	const userCounts: Record<string, number> = {};
	for (const proj of projectRows) {
		try {
			const schemaName = `project_${proj.slug}`;
			const { rows } = await pool.query(`SELECT COUNT(*)::int AS count FROM ${schemaName}."user"`);
			userCounts[proj.id] = rows[0].count;
		} catch {
			userCounts[proj.id] = 0;
		}
	}

	const totalUsers = Object.values(userCounts).reduce((a, b) => a + b, 0);

	return c.json({
		metrics: {
			projects: projects.rows[0].count,
			admin_users: admins.rows[0].count,
			total_end_users: totalUsers,
			active_webhooks: webhooks.rows[0].count,
			active_functions: functions_.rows[0].count,
			recent_errors_1h: recentErrors.rows[0].count,
			uptime_seconds: Math.floor(process.uptime()),
			timestamp: new Date().toISOString(),
		},
		user_counts_by_project: userCounts,
	});
});

// GET /admin/metrics/timeseries?metric=requests&period=24h|7d|30d
metricsEnhancedRoutes.get("/timeseries", async (c) => {
	const pool = getPool();
	const metric = c.req.query("metric") ?? "requests";
	const period = c.req.query("period") ?? "24h";

	const intervalMap: Record<string, { trunc: string; interval: string }> = {
		"24h": { trunc: "hour", interval: "24 hours" },
		"7d": { trunc: "day", interval: "7 days" },
		"30d": { trunc: "day", interval: "30 days" },
	};
	const { trunc, interval } = intervalMap[period] ?? intervalMap["24h"];

	if (metric === "requests") {
		const { rows } = await pool.query(
			`
      SELECT date_trunc($1, created_at) AS ts,
             COUNT(*)::int AS total,
             COUNT(*) FILTER (WHERE status >= 500)::int AS errors,
             COUNT(*) FILTER (WHERE status >= 400 AND status < 500)::int AS client_errors,
             ROUND(AVG(duration_ms))::int AS avg_duration_ms
      FROM betterbase_meta.request_logs
      WHERE created_at > NOW() - INTERVAL '${interval}'
      GROUP BY 1 ORDER BY 1
    `,
			[trunc],
		);
		return c.json({ metric, period, series: rows });
	}

	if (metric === "status_codes") {
		const { rows } = await pool.query(
			`
      SELECT date_trunc($1, created_at) AS ts,
             status,
             COUNT(*)::int AS count
      FROM betterbase_meta.request_logs
      WHERE created_at > NOW() - INTERVAL '${interval}'
      GROUP BY 1, 2 ORDER BY 1, 2
    `,
			[trunc],
		);
		return c.json({ metric, period, series: rows });
	}

	return c.json({ error: "Unknown metric" }, 400);
});

// GET /admin/metrics/latency  — percentiles
metricsEnhancedRoutes.get("/latency", async (c) => {
	const pool = getPool();
	const period = c.req.query("period") ?? "1h";
	const intervalMap: Record<string, string> = { "1h": "1 hour", "24h": "24 hours", "7d": "7 days" };
	const interval = intervalMap[period] ?? "1 hour";

	const { rows } = await pool.query(`
    SELECT
      ROUND(PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY duration_ms))::int AS p50,
      ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration_ms))::int AS p95,
      ROUND(PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY duration_ms))::int AS p99,
      ROUND(AVG(duration_ms))::int AS avg,
      MAX(duration_ms)::int AS max
    FROM betterbase_meta.request_logs
    WHERE created_at > NOW() - INTERVAL '${interval}'
  `);

	return c.json({ period, latency: rows[0] });
});

// GET /admin/metrics/top-endpoints?limit=10&period=24h
metricsEnhancedRoutes.get("/top-endpoints", async (c) => {
	const pool = getPool();
	const limit = Math.min(Number.parseInt(c.req.query("limit") ?? "10"), 50);
	const period = c.req.query("period") ?? "24h";
	const intervalMap: Record<string, string> = { "1h": "1 hour", "24h": "24 hours", "7d": "7 days" };
	const interval = intervalMap[period] ?? "24 hours";

	const { rows } = await pool.query(
		`
    SELECT path,
           COUNT(*)::int AS requests,
           ROUND(AVG(duration_ms))::int AS avg_ms,
           COUNT(*) FILTER (WHERE status >= 500)::int AS errors
    FROM betterbase_meta.request_logs
    WHERE created_at > NOW() - INTERVAL '${interval}'
    GROUP BY path
    ORDER BY requests DESC
    LIMIT $1
  `,
		[limit],
	);

	return c.json({ period, endpoints: rows });
});
