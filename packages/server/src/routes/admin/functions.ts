import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { nanoid } from "nanoid";
import { z } from "zod";
import { getPool } from "../../lib/db";

export const functionRoutes = new Hono();

functionRoutes.get("/", async (c) => {
	const pool = getPool();
	const { rows } = await pool.query(
		"SELECT id, name, runtime, status, deploy_target, created_at FROM betterbase_meta.functions ORDER BY created_at DESC",
	);
	return c.json({ functions: rows });
});

functionRoutes.post(
	"/",
	zValidator(
		"json",
		z.object({
			name: z
				.string()
				.min(1)
				.regex(/^[a-z0-9-]+$/),
			runtime: z.string().default("bun"),
			deploy_target: z.enum(["cloudflare", "vercel"]).optional(),
		}),
	),
	async (c) => {
		const data = c.req.valid("json");
		const pool = getPool();
		const { rows } = await pool.query(
			`INSERT INTO betterbase_meta.functions (id, name, runtime, deploy_target)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, runtime, status, deploy_target, created_at`,
			[nanoid(), data.name, data.runtime, data.deploy_target ?? null],
		);
		return c.json({ function: rows[0] }, 201);
	},
);

functionRoutes.delete("/:id", async (c) => {
	const pool = getPool();
	const { rows } = await pool.query(
		"DELETE FROM betterbase_meta.functions WHERE id = $1 RETURNING id",
		[c.req.param("id")],
	);
	if (rows.length === 0) return c.json({ error: "Not found" }, 404);
	return c.json({ success: true });
});
