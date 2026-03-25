import { createHash, randomBytes } from "crypto";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { nanoid } from "nanoid";
import { z } from "zod";
import { getPool } from "../../lib/db";

export const projectRoutes = new Hono();

// GET /admin/projects
projectRoutes.get("/", async (c) => {
	const pool = getPool();
	const { rows } = await pool.query(
		"SELECT id, name, slug, created_at, updated_at FROM betterbase_meta.projects ORDER BY created_at DESC",
	);
	return c.json({ projects: rows });
});

// GET /admin/projects/:id
projectRoutes.get("/:id", async (c) => {
	const pool = getPool();
	const { rows } = await pool.query(
		"SELECT id, name, slug, created_at, updated_at FROM betterbase_meta.projects WHERE id = $1",
		[c.req.param("id")],
	);
	if (rows.length === 0) return c.json({ error: "Not found" }, 404);
	return c.json({ project: rows[0] });
});

// POST /admin/projects
projectRoutes.post(
	"/",
	zValidator(
		"json",
		z.object({
			name: z.string().min(1).max(100),
			slug: z
				.string()
				.min(1)
				.max(63)
				.regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with hyphens"),
		}),
	),
	async (c) => {
		const { name, slug } = c.req.valid("json");
		const pool = getPool();

		// Check slug uniqueness
		const { rows: existing } = await pool.query(
			"SELECT id FROM betterbase_meta.projects WHERE slug = $1",
			[slug],
		);
		if (existing.length > 0) {
			return c.json({ error: "Slug already taken" }, 409);
		}

		// Generate admin key — returned once, never again
		const adminKeyPlaintext = `bb_admin_${randomBytes(24).toString("hex")}`;
		const adminKeyHash = createHash("sha256").update(adminKeyPlaintext).digest("hex");

		const { rows } = await pool.query(
			`INSERT INTO betterbase_meta.projects (id, name, slug, admin_key_hash)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, slug, created_at`,
			[nanoid(), name, slug, adminKeyHash],
		);

		// Provision project schema
		await pool.query("SELECT betterbase_meta.provision_project_schema($1)", [slug]);

		// Return admin key plaintext ONCE — not stored, cannot be recovered
		return c.json({ project: rows[0], admin_key: adminKeyPlaintext }, 201);
	},
);

// PATCH /admin/projects/:id
projectRoutes.patch(
	"/:id",
	zValidator(
		"json",
		z.object({
			name: z.string().min(1).max(100).optional(),
		}),
	),
	async (c) => {
		const { name } = c.req.valid("json");
		const pool = getPool();
		const { rows } = await pool.query(
			`UPDATE betterbase_meta.projects
       SET name = COALESCE($1, name), updated_at = NOW()
       WHERE id = $2
       RETURNING id, name, slug, updated_at`,
			[name, c.req.param("id")],
		);
		if (rows.length === 0) return c.json({ error: "Not found" }, 404);
		return c.json({ project: rows[0] });
	},
);

// DELETE /admin/projects/:id
projectRoutes.delete("/:id", async (c) => {
	const pool = getPool();
	const { rows } = await pool.query(
		"DELETE FROM betterbase_meta.projects WHERE id = $1 RETURNING id",
		[c.req.param("id")],
	);
	if (rows.length === 0) return c.json({ error: "Not found" }, 404);
	return c.json({ success: true });
});
