import { Hono } from "hono";

export const webhooksRoute = new Hono();

webhooksRoute.get("/:webhookId/deliveries", async (c) => {
	const webhookId = c.req.param("webhookId");
	const limitParam = c.req.query("limit");
	const limit = limitParam ? Number.parseInt(limitParam, 10) : 50;

	if (isNaN(limit) || limit < 1) {
		return c.json({ error: "Invalid limit parameter" }, 400);
	}

	return c.json({
		data: [],
		count: 0,
		message: "Webhook deliveries not yet implemented - table requires migration",
	});
});

webhooksRoute.get("/deliveries/:deliveryId", async (c) => {
	const deliveryId = c.req.param("deliveryId");

	return c.json({ error: "Delivery not found" }, 404);
});
