import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { nanoid } from "nanoid";
import { z } from "zod";
import { getPool } from "../../../lib/db";

export const projectWebhookRoutes = new Hono();

// GET /admin/projects/:id/webhooks
projectWebhookRoutes.get("/", async (c) => {
	const pool = getPool();
	const { rows } = await pool.query(
		`SELECT w.*,
            COUNT(wd.id)::int AS total_deliveries,
            COUNT(wd.id) FILTER (WHERE wd.status = 'success')::int AS successful_deliveries,
            MAX(wd.created_at) AS last_delivery_at
     FROM betterbase_meta.webhooks w
     LEFT JOIN betterbase_meta.webhook_deliveries wd ON wd.webhook_id = w.id
     GROUP BY w.id ORDER BY w.created_at DESC`,
	);
	return c.json({ webhooks: rows });
});

// GET /admin/projects/:id/webhooks/:webhookId/deliveries
projectWebhookRoutes.get("/:webhookId/deliveries", async (c) => {
	const pool = getPool();
	const limit = Math.min(Number.parseInt(c.req.query("limit") ?? "50"), 200);
	const offset = Number.parseInt(c.req.query("offset") ?? "0");

	const { rows } = await pool.query(
		`SELECT id, event_type, status, response_code, duration_ms, attempt_count, created_at, delivered_at
     FROM betterbase_meta.webhook_deliveries
     WHERE webhook_id = $1
     ORDER BY created_at DESC
     LIMIT $2 OFFSET $3`,
		[c.req.param("webhookId"), limit, offset],
	);

	return c.json({ deliveries: rows, limit, offset });
});

// GET /admin/projects/:id/webhooks/:webhookId/deliveries/:deliveryId
projectWebhookRoutes.get("/:webhookId/deliveries/:deliveryId", async (c) => {
	const pool = getPool();
	const { rows } = await pool.query(
		"SELECT * FROM betterbase_meta.webhook_deliveries WHERE id = $1 AND webhook_id = $2",
		[c.req.param("deliveryId"), c.req.param("webhookId")],
	);
	if (rows.length === 0) return c.json({ error: "Not found" }, 404);
	return c.json({ delivery: rows[0] });
});

// POST /admin/projects/:id/webhooks/:webhookId/retry
projectWebhookRoutes.post("/:webhookId/retry", async (c) => {
	const pool = getPool();
	const { rows: webhooks } = await pool.query(
		"SELECT * FROM betterbase_meta.webhooks WHERE id = $1",
		[c.req.param("webhookId")],
	);
	if (webhooks.length === 0) return c.json({ error: "Webhook not found" }, 404);

	const webhook = webhooks[0];
	const syntheticPayload = {
		id: nanoid(),
		webhook_id: webhook.id,
		table: webhook.table_name,
		type: "RETRY",
		record: {},
		timestamp: new Date().toISOString(),
	};

	// Fire delivery attempt
	const start = Date.now();
	let status = "failed";
	let responseCode: number | null = null;
	let responseBody: string | null = null;

	try {
		const res = await fetch(webhook.url, {
			method: "POST",
			headers: { "Content-Type": "application/json", "X-Betterbase-Event": "RETRY" },
			body: JSON.stringify(syntheticPayload),
		});
		responseCode = res.status;
		responseBody = await res.text();
		status = res.ok ? "success" : "failed";
	} catch (err: any) {
		responseBody = err.message;
	}

	const duration = Date.now() - start;

	await pool.query(
		`INSERT INTO betterbase_meta.webhook_deliveries
       (webhook_id, event_type, payload, status, response_code, response_body, duration_ms, delivered_at)
     VALUES ($1, 'RETRY', $2, $3, $4, $5, $6, NOW())`,
		[webhook.id, JSON.stringify(syntheticPayload), status, responseCode, responseBody, duration],
	);

	return c.json({
		success: status === "success",
		status,
		response_code: responseCode,
		duration_ms: duration,
	});
});

// POST /admin/projects/:id/webhooks/:webhookId/test  — send synthetic test payload
projectWebhookRoutes.post("/:webhookId/test", async (c) => {
	const pool = getPool();
	const { rows } = await pool.query("SELECT * FROM betterbase_meta.webhooks WHERE id = $1", [
		c.req.param("webhookId"),
	]);
	if (rows.length === 0) return c.json({ error: "Not found" }, 404);

	const webhook = rows[0];
	const payload = {
		id: nanoid(),
		webhook_id: webhook.id,
		table: webhook.table_name,
		type: "TEST",
		record: { id: "test-123", example: "data" },
		timestamp: new Date().toISOString(),
	};

	try {
		const res = await fetch(webhook.url, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(payload),
		});
		return c.json({ success: res.ok, status_code: res.status });
	} catch (err: any) {
		return c.json({ success: false, error: err.message });
	}
});
