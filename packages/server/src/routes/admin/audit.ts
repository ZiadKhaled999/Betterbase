import { Hono } from "hono";
import { getPool } from "../../lib/db";

export const auditRoutes = new Hono();

// GET /admin/audit?limit=50&offset=0&actor=&action=&resource_type=&from=&to=
auditRoutes.get("/", async (c) => {
	const pool = getPool();
	const limit = Math.min(Number.parseInt(c.req.query("limit") ?? "50"), 200);
	const offset = Number.parseInt(c.req.query("offset") ?? "0");
	const actor = c.req.query("actor");
	const action = c.req.query("action");
	const resourceType = c.req.query("resource_type");
	const from = c.req.query("from");
	const to = c.req.query("to");

	const conditions: string[] = [];
	const params: unknown[] = [];
	let idx = 1;

	if (actor) {
		conditions.push(`(actor_id = $${idx} OR actor_email ILIKE $${idx + 1})`);
		params.push(actor, `%${actor}%`);
		idx += 2;
	}
	if (action) {
		conditions.push(`action = $${idx}`);
		params.push(action);
		idx++;
	}
	if (resourceType) {
		conditions.push(`resource_type = $${idx}`);
		params.push(resourceType);
		idx++;
	}
	if (from) {
		conditions.push(`created_at >= $${idx}`);
		params.push(from);
		idx++;
	}
	if (to) {
		conditions.push(`created_at <= $${idx}`);
		params.push(to);
		idx++;
	}

	const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

	const { rows } = await pool.query(
		`SELECT id, actor_id, actor_email, action, resource_type, resource_id, resource_name,
            before_data, after_data, ip_address, created_at
     FROM betterbase_meta.audit_log
     ${where}
     ORDER BY created_at DESC
     LIMIT $${idx} OFFSET $${idx + 1}`,
		[...params, limit, offset],
	);

	const { rows: countRows } = await pool.query(
		`SELECT COUNT(*)::int AS total FROM betterbase_meta.audit_log ${where}`,
		params,
	);

	return c.json({ logs: rows, total: countRows[0].total, limit, offset });
});

// GET /admin/audit/actions  — distinct action types for filter dropdown
auditRoutes.get("/actions", async (c) => {
	const pool = getPool();
	const { rows } = await pool.query(
		"SELECT DISTINCT action FROM betterbase_meta.audit_log ORDER BY action",
	);
	return c.json({ actions: rows.map((r) => r.action) });
});
