import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { nanoid } from "nanoid";
import { z } from "zod";
import { hashPassword } from "../../lib/auth";
import { getPool } from "../../lib/db";

export const userRoutes = new Hono();

// GET /admin/users  — list all admin users
userRoutes.get("/", async (c) => {
	const pool = getPool();
	const { rows } = await pool.query(
		"SELECT id, email, created_at FROM betterbase_meta.admin_users ORDER BY created_at DESC",
	);
	return c.json({ users: rows });
});

// POST /admin/users  — create new admin user
userRoutes.post(
	"/",
	zValidator(
		"json",
		z.object({
			email: z.string().email(),
			password: z.string().min(8),
		}),
	),
	async (c) => {
		const { email, password } = c.req.valid("json");
		const pool = getPool();

		const { rows: existing } = await pool.query(
			"SELECT id FROM betterbase_meta.admin_users WHERE email = $1",
			[email],
		);
		if (existing.length > 0) {
			return c.json({ error: "Email already registered" }, 409);
		}

		const passwordHash = await hashPassword(password);
		const { rows } = await pool.query(
			"INSERT INTO betterbase_meta.admin_users (id, email, password_hash) VALUES ($1, $2, $3) RETURNING id, email, created_at",
			[nanoid(), email, passwordHash],
		);
		return c.json({ user: rows[0] }, 201);
	},
);

// DELETE /admin/users/:id
userRoutes.delete("/:id", async (c) => {
	const pool = getPool();
	// Prevent deleting last admin
	const { rows: count } = await pool.query(
		"SELECT COUNT(*)::int as count FROM betterbase_meta.admin_users",
	);
	if (count[0].count <= 1) {
		return c.json({ error: "Cannot delete last admin user" }, 400);
	}

	const { rows } = await pool.query(
		"DELETE FROM betterbase_meta.admin_users WHERE id = $1 RETURNING id",
		[c.req.param("id")],
	);
	if (rows.length === 0) return c.json({ error: "Not found" }, 404);
	return c.json({ success: true });
});
