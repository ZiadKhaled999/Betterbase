import { createHash, randomBytes } from "crypto";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { getClientIp, writeAuditLog } from "../../lib/audit";
import { getPool } from "../../lib/db";

export const apiKeyRoutes = new Hono();

// GET /admin/api-keys
apiKeyRoutes.get("/", async (c) => {
	const pool = getPool();
	const admin = c.get("adminUser") as { id: string };
	const { rows } = await pool.query(
		`SELECT id, name, key_prefix, scopes, last_used_at, expires_at, created_at
     FROM betterbase_meta.api_keys
     WHERE admin_user_id = $1
     ORDER BY created_at DESC`,
		[admin.id],
	);
	return c.json({ api_keys: rows });
});

// POST /admin/api-keys
apiKeyRoutes.post(
	"/",
	zValidator(
		"json",
		z.object({
			name: z.string().min(1).max(100),
			scopes: z.array(z.string()).default([]),
			expires_at: z.string().datetime().optional(),
		}),
	),
	async (c) => {
		const data = c.req.valid("json");
		const pool = getPool();
		const admin = c.get("adminUser") as { id: string; email: string };

		const rawKey = `bb_live_${randomBytes(32).toString("hex")}`;
		const keyHash = createHash("sha256").update(rawKey).digest("hex");
		const keyPrefix = rawKey.slice(0, 16);

		const { rows } = await pool.query(
			`INSERT INTO betterbase_meta.api_keys
         (admin_user_id, name, key_hash, key_prefix, scopes, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, name, key_prefix, scopes, expires_at, created_at`,
			[admin.id, data.name, keyHash, keyPrefix, data.scopes, data.expires_at ?? null],
		);

		await writeAuditLog({
			actorId: admin.id,
			actorEmail: admin.email,
			action: "api_key.create",
			resourceType: "api_key",
			resourceId: rows[0].id,
			resourceName: data.name,
			ipAddress: getClientIp(c.req.raw.headers),
		});

		// Return plaintext key ONCE — not stored, cannot be recovered
		return c.json({ api_key: rows[0], key: rawKey }, 201);
	},
);

// DELETE /admin/api-keys/:id
apiKeyRoutes.delete("/:id", async (c) => {
	const pool = getPool();
	const admin = c.get("adminUser") as { id: string; email: string };

	const { rows } = await pool.query(
		"DELETE FROM betterbase_meta.api_keys WHERE id = $1 AND admin_user_id = $2 RETURNING id, name",
		[c.req.param("id"), admin.id],
	);
	if (rows.length === 0) return c.json({ error: "Not found" }, 404);

	await writeAuditLog({
		actorId: admin.id,
		actorEmail: admin.email,
		action: "api_key.revoke",
		resourceType: "api_key",
		resourceId: c.req.param("id"),
		resourceName: rows[0].name,
		ipAddress: getClientIp(c.req.raw.headers),
	});

	return c.json({ success: true });
});
