import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { nanoid } from "nanoid";
import { z } from "zod";
import { getPool } from "../../lib/db";

export const webhookRoutes = new Hono();

webhookRoutes.get("/", async (c) => {
	const pool = getPool();
	const { rows } = await pool.query(
		"SELECT id, name, table_name, events, url, enabled, created_at FROM betterbase_meta.webhooks ORDER BY created_at DESC",
	);
	return c.json({ webhooks: rows });
});

webhookRoutes.post(
	"/",
	zValidator(
		"json",
		z.object({
			name: z.string().min(1),
			table_name: z.string().min(1),
			events: z.array(z.enum(["INSERT", "UPDATE", "DELETE"])).min(1),
			url: z.string().url(),
			secret: z.string().optional(),
			enabled: z.boolean().default(true),
		}),
	),
	async (c) => {
		const data = c.req.valid("json");
		const pool = getPool();
		const { rows } = await pool.query(
			`INSERT INTO betterbase_meta.webhooks (id, name, table_name, events, url, secret, enabled)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, name, table_name, events, url, enabled, created_at`,
			[
				nanoid(),
				data.name,
				data.table_name,
				data.events,
				data.url,
				data.secret ?? null,
				data.enabled,
			],
		);
		return c.json({ webhook: rows[0] }, 201);
	},
);

webhookRoutes.patch(
	"/:id",
	zValidator(
		"json",
		z.object({
			enabled: z.boolean().optional(),
			url: z.string().url().optional(),
			secret: z.string().optional(),
		}),
	),
	async (c) => {
		const data = c.req.valid("json");
		const pool = getPool();
		const { rows } = await pool.query(
			`UPDATE betterbase_meta.webhooks
       SET enabled = COALESCE($1, enabled),
           url = COALESCE($2, url),
           secret = COALESCE($3, secret)
       WHERE id = $4
       RETURNING id, name, table_name, events, url, enabled`,
			[data.enabled ?? null, data.url ?? null, data.secret ?? null, c.req.param("id")],
		);
		if (rows.length === 0) return c.json({ error: "Not found" }, 404);
		return c.json({ webhook: rows[0] });
	},
);

webhookRoutes.delete("/:id", async (c) => {
	const pool = getPool();
	const { rows } = await pool.query(
		"DELETE FROM betterbase_meta.webhooks WHERE id = $1 RETURNING id",
		[c.req.param("id")],
	);
	if (rows.length === 0) return c.json({ error: "Not found" }, 404);
	return c.json({ success: true });
});

// GET /admin/webhooks/:id/deliveries?limit=50&status=failed
webhookRoutes.get("/:id/deliveries", async (c) => {
	const limit = Math.min(Number.parseInt(c.req.query("limit") ?? "50"), 200);
	const status = c.req.query("status");

	const pool = getPool();

	const { rows } = await pool.query(
		`
    SELECT id, event_type, table_name, status, http_status,
           duration_ms, error_msg, attempt, created_at
    FROM betterbase_meta.webhook_delivery_logs
    WHERE webhook_id = $1
      ${status ? "AND status = $3" : ""}
    ORDER BY created_at DESC LIMIT $2
  `,
		status ? [c.req.param("id"), limit, status] : [c.req.param("id"), limit],
	);

	return c.json({ deliveries: rows });
});

// GET /admin/webhooks/:id/stats
webhookRoutes.get("/:id/stats", async (c) => {
	const pool = getPool();

	const { rows } = await pool.query(
		`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE status='success')::int AS success,
      COUNT(*) FILTER (WHERE status='failed')::int AS failed,
      AVG(duration_ms)::int AS avg_duration_ms,
      MAX(created_at) AS last_delivery
    FROM betterbase_meta.webhook_delivery_logs
    WHERE webhook_id = $1
      AND created_at > NOW() - INTERVAL '30 days'
  `,
		[c.req.param("id")],
	);

	return c.json({ stats: rows[0] });
});
