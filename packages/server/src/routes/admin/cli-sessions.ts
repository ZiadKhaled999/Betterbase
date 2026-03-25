import { Hono } from "hono";
import { getPool } from "../../lib/db";

export const cliSessionRoutes = new Hono();

// GET /admin/cli-sessions  — active device codes + CLI sessions for this admin
cliSessionRoutes.get("/", async (c) => {
	const pool = getPool();
	const admin = c.get("adminUser") as { id: string };

	// Active unverified device codes (pending authorization)
	const { rows: pending } = await pool.query(
		`SELECT user_code, created_at, expires_at
     FROM betterbase_meta.device_codes
     WHERE verified = FALSE AND expires_at > NOW()
     ORDER BY created_at DESC`,
	);

	// API keys as a proxy for "CLI connections" (each key = one CLI instance)
	const { rows: keys } = await pool.query(
		`SELECT id, name, key_prefix, last_used_at, expires_at, created_at
     FROM betterbase_meta.api_keys
     WHERE admin_user_id = $1
     ORDER BY last_used_at DESC NULLS LAST`,
		[admin.id],
	);

	return c.json({ pending_authorizations: pending, active_keys: keys });
});

// DELETE /admin/cli-sessions/pending/:userCode  — revoke pending authorization
cliSessionRoutes.delete("/pending/:userCode", async (c) => {
	const pool = getPool();
	const { rows } = await pool.query(
		"DELETE FROM betterbase_meta.device_codes WHERE user_code = $1 RETURNING user_code",
		[c.req.param("userCode")],
	);
	if (rows.length === 0) return c.json({ error: "Not found" }, 404);
	return c.json({ success: true });
});
