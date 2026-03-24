import { Hono } from "hono";
import { getPool } from "../../lib/db";

export const logRoutes = new Hono();

// GET /admin/logs?limit=50&offset=0
logRoutes.get("/", async (c) => {
	const limit = Math.min(Number.parseInt(c.req.query("limit") ?? "50"), 200);
	const offset = Number.parseInt(c.req.query("offset") ?? "0");
	const pool = getPool();

	const { rows } = await pool.query(
		`SELECT id, method, path, status, duration_ms, created_at
     FROM betterbase_meta.request_logs
     ORDER BY created_at DESC
     LIMIT $1 OFFSET $2`,
		[limit, offset],
	);
	return c.json({ logs: rows, limit, offset });
});
