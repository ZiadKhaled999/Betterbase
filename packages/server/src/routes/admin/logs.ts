import { Hono } from "hono";
import { getPool } from "../../lib/db";

export const logRoutes = new Hono();

// GET /admin/logs?limit=50&offset=0&project_id=xxx
logRoutes.get("/", async (c) => {
	const limit = Math.min(Number.parseInt(c.req.query("limit") ?? "50"), 200);
	const offset = Number.parseInt(c.req.query("offset") ?? "0");
	const projectId = c.req.query("project_id");
	const pool = getPool();

	let query = `
		SELECT id, method, path, status, duration_ms, project_id, created_at
		FROM betterbase_meta.request_logs
	`;
	const params: (string | number)[] = [];

	if (projectId) {
		query += ` WHERE project_id = $3`;
		params.push(projectId);
	}

	query += ` ORDER BY created_at DESC LIMIT $1 OFFSET $2`;
	params.unshift(limit, offset);

	const { rows } = await pool.query(query, params);
	return c.json({ logs: rows, limit, offset });
});

// GET /admin/logs/stream?since=<ISO timestamp>&limit=100
// Returns all logs created after ?since. Frontend polls this every 3s.
// On first call, omit since to get the last 100 entries as seed data.
logRoutes.get("/stream", async (c) => {
	const since = c.req.query("since");
	const limit = Math.min(Number.parseInt(c.req.query("limit") ?? "100"), 500);

	const pool = getPool();

	let rows: any[];

	if (since) {
		const result = await pool.query(
			`SELECT id, method, path, status, duration_ms, project_id,
							ip, user_agent, created_at
				 FROM betterbase_meta.request_logs
				 WHERE created_at > $1
				 ORDER BY created_at ASC LIMIT $2`,
			[since, limit],
		);
		rows = result.rows;
	} else {
		const result = await pool.query(
			`SELECT id, method, path, status, duration_ms, project_id,
							ip, user_agent, created_at
				 FROM betterbase_meta.request_logs
				 ORDER BY created_at DESC LIMIT $1`,
			[limit],
		);
		rows = result.rows.reverse(); // Chronological order for seeding
	}

	const lastTimestamp =
		rows.length > 0 ? rows[rows.length - 1].created_at : (since ?? new Date().toISOString());

	return c.json({ logs: rows, next_since: lastTimestamp });
});
