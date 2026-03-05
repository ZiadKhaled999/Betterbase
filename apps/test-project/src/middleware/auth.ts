import type { Context, Next } from "hono";
import { auth } from "../auth";

export async function requireAuth(c: Context, next: Next) {
	try {
		const session = await auth.api.getSession({
			headers: c.req.raw.headers,
		});
		if (!session) {
			return c.json({ data: null, error: "Unauthorized" }, 401);
		}
		c.set("user", session.user);
		c.set("session", session.session);
	} catch (error) {
		console.error("requireAuth error:", error);
		return c.json({ data: null, error: "Unauthorized" }, 401);
	}
	await next();
}

export async function optionalAuth(c: Context, next: Next) {
	try {
		const session = await auth.api.getSession({
			headers: c.req.raw.headers,
		});
		if (session) {
			c.set("user", session.user);
			c.set("session", session.session);
		}
	} catch (error) {
		// Swallow error and continue without setting user/session
		// This allows the request to degrade to unauthenticated
		console.error("optionalAuth error:", error);
	}
	await next();
}
