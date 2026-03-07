import { Hono } from "hono";
import { z } from "zod";

const authRoute = new Hono();

const magicLinkSchema = z.object({
	email: z.string().email(),
});

const otpSendSchema = z.object({
	email: z.string().email(),
});

const otpVerifySchema = z.object({
	email: z.string().email(),
	code: z.string().length(6, "OTP must be 6 digits"),
});

// Magic Link endpoints
authRoute.post("/magic-link/send", async (c) => {
	let rawBody: unknown;
	try {
		rawBody = await c.req.json();
	} catch (err) {
		const details = err instanceof Error ? err.message : String(err);
		return c.json({ error: "Invalid JSON", details }, 400);
	}

	const result = magicLinkSchema.safeParse(rawBody);
	if (!result.success) {
		return c.json({ error: "Invalid payload", details: result.error.format() }, 400);
	}

	const { email } = result.data;
	const isDev = process.env.NODE_ENV === "development";

	// In development, log the magic link
	if (isDev) {
		console.log(`[DEV] Magic Link for ${email}: http://localhost:3000/auth/magic-link?token=dev-token-${Date.now()}`);
	}

	// TODO: Use better-auth's magic link API in production
	// For now, return success (actual implementation would use better-auth's internal API)
	return c.json({ message: "Magic link sent" });
});

authRoute.get("/magic-link/verify", async (c) => {
	const token = c.req.query("token");
	if (!token) {
		return c.json({ error: "Token is required" }, 400);
	}

	// TODO: Implement proper token verification using better-auth
	// For now, simulate verification
	if (token.startsWith("dev-token-")) {
		// In dev mode, create a mock session
		const sessionId = crypto.randomUUID();

		// Find or create user (in real implementation, this would be done by better-auth)
		return c.json({
			token: sessionId,
			user: {
				id: "dev-user-id",
				email: "dev@example.com",
				name: "Dev User",
			},
		});
	}

	return c.json({ error: "Invalid or expired token" }, 401);
});

// OTP endpoints
authRoute.post("/otp/send", async (c) => {
	let rawBody: unknown;
	try {
		rawBody = await c.req.json();
	} catch (err) {
		const details = err instanceof Error ? err.message : String(err);
		return c.json({ error: "Invalid JSON", details }, 400);
	}

	const result = otpSendSchema.safeParse(rawBody);
	if (!result.success) {
		return c.json({ error: "Invalid payload", details: result.error.format() }, 400);
	}

	const { email } = result.data;
	const isDev = process.env.NODE_ENV === "development";

	// Generate 6-digit OTP
	const otp = Math.floor(100000 + Math.random() * 900000).toString();

	if (isDev) {
		console.log(`[DEV] OTP for ${email}: ${otp}`);
	}

	// TODO: Store OTP in database with expiry and send via email in production
	return c.json({ message: "OTP sent successfully" });
});

authRoute.post("/otp/verify", async (c) => {
	let rawBody: unknown;
	try {
		rawBody = await c.req.json();
	} catch (err) {
		const details = err instanceof Error ? err.message : String(err);
		return c.json({ error: "Invalid JSON", details }, 400);
	}

	const result = otpVerifySchema.safeParse(rawBody);
	if (!result.success) {
		return c.json({ error: "Invalid payload", details: result.error.format() }, 400);
	}

	const { email, code } = result.data;

	// TODO: Verify OTP from database in production
	// For dev mode, accept any 6-digit code
	if (process.env.NODE_ENV === "development" || code.length === 6) {
		const sessionId = crypto.randomUUID();

		return c.json({
			token: sessionId,
			user: {
				id: "otp-user-id",
				email,
				name: "OTP User",
			},
		});
	}

	return c.json({ error: "Invalid or expired OTP" }, 401);
});

export { authRoute };
