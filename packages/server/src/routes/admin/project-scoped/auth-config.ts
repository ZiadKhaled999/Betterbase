import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { getPool } from "../../../lib/db";

export const projectAuthConfigRoutes = new Hono();

function schemaName(project: { slug: string }) {
	return `project_${project.slug}`;
}

// GET /admin/projects/:id/auth-config  — all config as key-value object
projectAuthConfigRoutes.get("/", async (c) => {
	const pool = getPool();
	const project = c.get("project") as { id: string; slug: string };
	const s = schemaName(project);

	const { rows } = await pool.query(
		`SELECT key, value, updated_at FROM ${s}.auth_config ORDER BY key`,
	);
	const config = Object.fromEntries(rows.map((r) => [r.key, r.value]));

	return c.json({ config });
});

// PUT /admin/projects/:id/auth-config/:key  — upsert a single config key
projectAuthConfigRoutes.put(
	"/:key",
	zValidator("json", z.object({ value: z.unknown() })),
	async (c) => {
		const { value } = c.req.valid("json");
		const pool = getPool();
		const project = c.get("project") as { id: string; slug: string };
		const s = schemaName(project);
		const key = c.req.param("key");

		// Allowed keys whitelist
		const ALLOWED_KEYS = [
			"email_password_enabled",
			"magic_link_enabled",
			"otp_enabled",
			"phone_enabled",
			"password_min_length",
			"require_email_verification",
			"session_expiry_seconds",
			"refresh_token_expiry_seconds",
			"max_sessions_per_user",
			"allowed_email_domains",
			"blocked_email_domains",
			"provider_google",
			"provider_github",
			"provider_discord",
			"provider_apple",
			"provider_microsoft",
			"provider_twitter",
			"provider_facebook",
			"twilio_account_sid",
			"twilio_auth_token",
			"twilio_phone_number",
		];

		if (!ALLOWED_KEYS.includes(key)) {
			return c.json({ error: "Unknown config key" }, 400);
		}

		await pool.query(
			`INSERT INTO ${s}.auth_config (key, value, updated_at) VALUES ($1, $2::jsonb, NOW())
       ON CONFLICT (key) DO UPDATE SET value = $2::jsonb, updated_at = NOW()`,
			[key, JSON.stringify(value)],
		);

		return c.json({ success: true, key, value });
	},
);

// DELETE /admin/projects/:id/auth-config/:key  — reset to default
projectAuthConfigRoutes.delete("/:key", async (c) => {
	const pool = getPool();
	const project = c.get("project") as { id: string; slug: string };
	const s = schemaName(project);

	await pool.query(`DELETE FROM ${s}.auth_config WHERE key = $1`, [c.req.param("key")]);
	return c.json({ success: true });
});
