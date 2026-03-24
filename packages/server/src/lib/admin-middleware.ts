import type { Context, Next } from "hono";
import { extractBearerToken, verifyAdminToken } from "./auth";
import { getPool } from "./db";

export async function requireAdmin(c: Context, next: Next) {
	const token = extractBearerToken(c.req.header("Authorization"));
	if (!token) {
		return c.json({ error: "Unauthorized" }, 401);
	}

	const payload = await verifyAdminToken(token);
	if (!payload) {
		return c.json({ error: "Invalid or expired token" }, 401);
	}

	// Verify admin still exists in DB
	const pool = getPool();
	const { rows } = await pool.query(
		"SELECT id, email FROM betterbase_meta.admin_users WHERE id = $1",
		[payload.sub],
	);
	if (rows.length === 0) {
		return c.json({ error: "Unauthorized" }, 401);
	}

	c.set("adminUser", rows[0]);
	await next();
}
