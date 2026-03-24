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
