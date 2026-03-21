import { Hono } from "hono";
import { db } from "../db";

export const webhooksRoute = new Hono();

/**
 * Get delivery logs for a specific webhook
 * GET /api/webhooks/:webhookId/deliveries?limit=50
 */
webhooksRoute.get("/:webhookId/deliveries", async (c) => {
	const webhookId = c.req.param("webhookId");
	const limitParam = c.req.query("limit");
	const limit = limitParam ? parseInt(limitParam, 10) : 50;

	if (isNaN(limit) || limit < 1) {
		return c.json({ error: "Invalid limit parameter" }, 400);
	}

	try {
		const result = await db.execute({
			sql: `
				SELECT 
					id,
					webhook_id,
					status,
					request_url,
					request_body,
					response_code,
					response_body,
					error,
					attempt_count,
					created_at,
					updated_at
				FROM _betterbase_webhook_deliveries
				WHERE webhook_id = ?
				ORDER BY created_at DESC
				LIMIT ?
			`,
			args: [webhookId, limit],
		});

		return c.json({
			data: result.rows,
			count: result.rows.length,
		});
	} catch (error) {
		// Table might not exist yet
		console.error("Error fetching webhook deliveries:", error);
		return c.json({
			data: [],
			count: 0,
			message: "Delivery logs table not initialized. Run migrations first.",
		});
	}
});

/**
 * Get a specific delivery log by ID
 * GET /api/webhooks/deliveries/:deliveryId
 */
webhooksRoute.get("/deliveries/:deliveryId", async (c) => {
	const deliveryId = c.req.param("deliveryId");

	try {
		const result = await db.execute({
			sql: `
				SELECT 
					id,
					webhook_id,
					status,
					request_url,
					request_body,
					response_code,
					response_body,
					error,
					attempt_count,
					created_at,
					updated_at
				FROM _betterbase_webhook_deliveries
				WHERE id = ?
			`,
			args: [deliveryId],
		});

		if (result.rows.length === 0) {
			return c.json({ error: "Delivery not found" }, 404);
		}

		return c.json({
			data: result.rows[0],
		});
	} catch (error) {
		console.error("Error fetching delivery:", error);
		return c.json({ error: "Failed to fetch delivery" }, 500);
	}
});
