import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { getPool } from "../../../lib/db";

export const projectEnvRoutes = new Hono();

function schemaName(project: { slug: string }) {
	return `project_${project.slug}`;
}

// GET /admin/projects/:id/env
projectEnvRoutes.get("/", async (c) => {
	const pool = getPool();
	const project = c.get("project") as { id: string; slug: string };
	const s = schemaName(project);

	const { rows } = await pool.query(
		`SELECT key, is_secret, created_at, updated_at,
            CASE WHEN is_secret THEN '••••••••' ELSE value END AS value
     FROM ${s}.env_vars ORDER BY key`,
	);
	return c.json({ env_vars: rows });
});

// PUT /admin/projects/:id/env/:key
projectEnvRoutes.put(
	"/:key",
	zValidator(
		"json",
		z.object({
			value: z.string(),
			is_secret: z.boolean().default(true),
		}),
	),
	async (c) => {
		const { value, is_secret } = c.req.valid("json");
		const pool = getPool();
		const project = c.get("project") as { id: string; slug: string };
		const s = schemaName(project);
		const key = c.req.param("key");

		if (!/^[A-Z][A-Z0-9_]*$/.test(key)) {
			return c.json({ error: "Key must be uppercase, alphanumeric with underscores" }, 400);
		}

		await pool.query(
			`INSERT INTO ${s}.env_vars (key, value, is_secret, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (key) DO UPDATE SET value=$2, is_secret=$3, updated_at=NOW()`,
			[key, value, is_secret],
		);

		return c.json({ success: true, key });
	},
);

// DELETE /admin/projects/:id/env/:key
projectEnvRoutes.delete("/:key", async (c) => {
	const pool = getPool();
	const project = c.get("project") as { id: string; slug: string };
	const s = schemaName(project);

	const { rows } = await pool.query(`DELETE FROM ${s}.env_vars WHERE key = $1 RETURNING key`, [
		c.req.param("key"),
	]);
	if (rows.length === 0) return c.json({ error: "Not found" }, 404);
	return c.json({ success: true });
});
