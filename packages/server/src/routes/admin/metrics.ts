import { Hono } from "hono";
import { getPool } from "../../lib/db";

export const metricsRoutes = new Hono();

// GET /admin/metrics  — overview stats for dashboard home
metricsRoutes.get("/", async (c) => {
	const pool = getPool();

	const [projects, admins] = await Promise.all([
		pool.query("SELECT COUNT(*)::int as count FROM betterbase_meta.projects"),
		pool.query("SELECT COUNT(*)::int as count FROM betterbase_meta.admin_users"),
	]);

	return c.json({
		metrics: {
			projects: projects.rows[0].count,
			admin_users: admins.rows[0].count,
			server_uptime_seconds: Math.floor(process.uptime()),
			timestamp: new Date().toISOString(),
		},
	});
});
