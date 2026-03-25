import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { getClientIp, writeAuditLog } from "../../lib/audit";
import { getPool } from "../../lib/db";

export const smtpRoutes = new Hono();

const SmtpSchema = z.object({
	host: z.string().min(1),
	port: z.number().int().min(1).max(65535).default(587),
	username: z.string().min(1),
	password: z.string().min(1),
	from_email: z.string().email(),
	from_name: z.string().default("Betterbase"),
	use_tls: z.boolean().default(true),
	enabled: z.boolean().default(false),
});

// GET /admin/smtp
smtpRoutes.get("/", async (c) => {
	const pool = getPool();
	const { rows } = await pool.query(
		"SELECT * FROM betterbase_meta.smtp_config WHERE id = 'singleton'",
	);
	if (rows.length === 0) return c.json({ smtp: null });
	const row = { ...rows[0] };
	// Mask password in response
	if (row.password) row.password = "••••••••";
	return c.json({ smtp: row });
});

// PUT /admin/smtp  — upsert
smtpRoutes.put("/", zValidator("json", SmtpSchema), async (c) => {
	const data = c.req.valid("json");
	const pool = getPool();
	const admin = c.get("adminUser") as { id: string; email: string };

	await pool.query(
		`INSERT INTO betterbase_meta.smtp_config
         (id, host, port, username, password, from_email, from_name, use_tls, enabled, updated_at)
       VALUES ('singleton', $1,$2,$3,$4,$5,$6,$7,$8, NOW())
       ON CONFLICT (id) DO UPDATE SET
         host=$1, port=$2, username=$3, password=$4,
         from_email=$5, from_name=$6, use_tls=$7, enabled=$8, updated_at=NOW()`,
		[
			data.host,
			data.port,
			data.username,
			data.password,
			data.from_email,
			data.from_name,
			data.use_tls,
			data.enabled,
		],
	);

	await writeAuditLog({
		actorId: admin.id,
		actorEmail: admin.email,
		action: "smtp.update",
		ipAddress: getClientIp(c.req.raw.headers),
	});

	return c.json({ success: true });
});

// POST /admin/smtp/test  — send test email
smtpRoutes.post("/test", zValidator("json", z.object({ to: z.string().email() })), async (c) => {
	const { to } = c.req.valid("json");
	const pool = getPool();
	const { rows } = await pool.query(
		"SELECT * FROM betterbase_meta.smtp_config WHERE id = 'singleton' AND enabled = TRUE",
	);

	if (rows.length === 0) {
		return c.json({ error: "SMTP not configured or not enabled" }, 400);
	}

	const config = rows[0];

	// Dynamic import nodemailer
	const nodemailer = await import("nodemailer");
	const transporter = nodemailer.default.createTransport({
		host: config.host,
		port: config.port,
		secure: config.port === 465,
		requireTLS: config.use_tls,
		auth: { user: config.username, pass: config.password },
	});

	try {
		await transporter.sendMail({
			from: `"${config.from_name}" <${config.from_email}>`,
			to,
			subject: "Betterbase SMTP Test",
			text: "SMTP is configured correctly.",
			html: "<p>SMTP is configured correctly.</p>",
		});
		return c.json({ success: true, message: `Test email sent to ${to}` });
	} catch (err: any) {
		return c.json({ error: `SMTP error: ${err.message}` }, 400);
	}
});
