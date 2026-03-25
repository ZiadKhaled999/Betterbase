import { createHash } from "crypto";
import type { Context, Next } from "hono";
import { extractBearerToken, verifyAdminToken } from "./auth";
import { getPool } from "./db";

export async function requireAdmin(c: Context, next: Next) {
	const authHeader = c.req.header("Authorization");

	// API key auth (prefix: "bb_live_")
	if (authHeader?.startsWith("Bearer bb_live_")) {
		const rawKey = authHeader.slice(7);
		const keyHash = createHash("sha256").update(rawKey).digest("hex");
		const pool = getPool();

		const { rows: keyRows } = await pool.query(
			`SELECT ak.admin_user_id, au.id, au.email
			 FROM betterbase_meta.api_keys ak
			 JOIN betterbase_meta.admin_users au ON au.id = ak.admin_user_id
			 WHERE ak.key_hash = $1
			   AND (ak.expires_at IS NULL OR ak.expires_at > NOW())`,
			[keyHash],
		);

		if (keyRows.length === 0) return c.json({ error: "Invalid API key" }, 401);

		// Update last_used_at fire-and-forget
		pool
			.query("UPDATE betterbase_meta.api_keys SET last_used_at = NOW() WHERE key_hash = $1", [
				keyHash,
			])
			.catch(() => {});

		c.set("adminUser", { id: keyRows[0].id, email: keyRows[0].email });
		await next();
		return;
	}

	// JWT auth
	const token = extractBearerToken(authHeader);
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
