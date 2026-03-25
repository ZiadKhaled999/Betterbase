import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { nanoid } from "nanoid";
import { z } from "zod";
import { getPool } from "../../lib/db";

export const notificationRoutes = new Hono();

const RuleSchema = z.object({
	name: z.string().min(1).max(100),
	metric: z.enum(["error_rate", "storage_pct", "auth_failures", "response_time_p99"]),
	threshold: z.number(),
	channel: z.enum(["email", "webhook"]),
	target: z.string().min(1),
	enabled: z.boolean().default(true),
});

notificationRoutes.get("/", async (c) => {
	const pool = getPool();
	const { rows } = await pool.query(
		"SELECT * FROM betterbase_meta.notification_rules ORDER BY created_at DESC",
	);
	return c.json({ rules: rows });
});

notificationRoutes.post("/", zValidator("json", RuleSchema), async (c) => {
	const data = c.req.valid("json");
	const pool = getPool();
	const { rows } = await pool.query(
		`INSERT INTO betterbase_meta.notification_rules (id, name, metric, threshold, channel, target, enabled)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
		[nanoid(), data.name, data.metric, data.threshold, data.channel, data.target, data.enabled],
	);
	return c.json({ rule: rows[0] }, 201);
});

notificationRoutes.patch("/:id", zValidator("json", RuleSchema.partial()), async (c) => {
	const data = c.req.valid("json");
	const pool = getPool();
	const sets: string[] = [];
	const params: unknown[] = [];
	let idx = 1;
	for (const [k, v] of Object.entries(data)) {
		if (v !== undefined) {
			sets.push(`${k} = $${idx}`);
			params.push(v);
			idx++;
		}
	}
	if (sets.length === 0) return c.json({ error: "Nothing to update" }, 400);
	params.push(c.req.param("id"));
	const { rows } = await pool.query(
		`UPDATE betterbase_meta.notification_rules SET ${sets.join(", ")} WHERE id = $${idx} RETURNING *`,
		params,
	);
	if (rows.length === 0) return c.json({ error: "Not found" }, 404);
	return c.json({ rule: rows[0] });
});

notificationRoutes.delete("/:id", async (c) => {
	const pool = getPool();
	const { rows } = await pool.query(
		"DELETE FROM betterbase_meta.notification_rules WHERE id = $1 RETURNING id",
		[c.req.param("id")],
	);
	if (rows.length === 0) return c.json({ error: "Not found" }, 404);
	return c.json({ success: true });
});
