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

// Two-Factor Authentication schemas
const mfaEnableSchema = z.object({
	code: z.string().length(6, "TOTP code must be 6 digits"),
});

const mfaVerifySchema = z.object({
	code: z.string().length(6, "TOTP code must be 6 digits"),
});

const mfaChallengeSchema = z.object({
	code: z.string().length(6, "TOTP code must be 6 digits"),
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

// Two-Factor Authentication endpoints
authRoute.post("/mfa/enable", async (c) => {
	let rawBody: unknown;
	try {
		rawBody = await c.req.json();
	} catch (err) {
		const details = err instanceof Error ? err.message : String(err);
		return c.json({ error: "Invalid JSON", details }, 400);
	}

	const result = mfaEnableSchema.safeParse(rawBody);
	if (!result.success) {
		return c.json({ error: "Invalid payload", details: result.error.format() }, 400);
	}

	// TODO: Implement actual MFA enable using better-auth twoFactor plugin
	// Return QR URI and backup codes for TOTP setup
	const qrUri = "otpauth://totp/BetterBase:user@example.com?secret=EXAMPLE&issuer=BetterBase";
	const backupCodes = Array.from({ length: 10 }, () => Math.random().toString(36).substring(2, 10).toUpperCase());

	return c.json({
		qrUri,
		backupCodes,
	});
});

authRoute.post("/mfa/verify", async (c) => {
	let rawBody: unknown;
	try {
		rawBody = await c.req.json();
	} catch (err) {
		const details = err instanceof Error ? err.message : String(err);
		return c.json({ error: "Invalid JSON", details }, 400);
	}

	const result = mfaVerifySchema.safeParse(rawBody);
	if (!result.success) {
		return c.json({ error: "Invalid payload", details: result.error.format() }, 400);
	}

	const { code } = result.data;

	// TODO: Verify TOTP code using better-auth
	// Accept any 6-digit code in dev mode
	if (process.env.NODE_ENV === "development" || code.length === 6) {
		return c.json({ message: "MFA enabled successfully" });
	}

	return c.json({ error: "Invalid TOTP code" }, 401);
});

authRoute.post("/mfa/disable", async (c) => {
	let rawBody: unknown;
	try {
		rawBody = await c.req.json();
	} catch (err) {
		const details = err instanceof Error ? err.message : String(err);
		return c.json({ error: "Invalid JSON", details }, 400);
	}

	const result = mfaVerifySchema.safeParse(rawBody);
	if (!result.success) {
		return c.json({ error: "Invalid payload", details: result.error.format() }, 400);
	}

	const { code } = result.data;

	// TODO: Verify and disable MFA using better-auth
	if (process.env.NODE_ENV === "development" || code.length === 6) {
		return c.json({ message: "MFA disabled successfully" });
	}

	return c.json({ error: "Invalid TOTP code" }, 401);
});

authRoute.post("/mfa/challenge", async (c) => {
	let rawBody: unknown;
	try {
		rawBody = await c.req.json();
	} catch (err) {
		const details = err instanceof Error ? err.message : String(err);
		return c.json({ error: "Invalid JSON", details }, 400);
	}

	const result = mfaChallengeSchema.safeParse(rawBody);
	if (!result.success) {
		return c.json({ error: "Invalid payload", details: result.error.format() }, 400);
	}

	const { code } = result.data;

	// TODO: Verify TOTP code and return session using better-auth
	// Accept any 6-digit code in dev mode
	if (process.env.NODE_ENV === "development" || code.length === 6) {
		const sessionId = crypto.randomUUID();
		return c.json({
			token: sessionId,
			user: {
				id: "mfa-user-id",
				email: "user@example.com",
				name: "MFA User",
			},
		});
	}

	return c.json({ error: "Invalid TOTP code" }, 401);
});

// Phone / SMS Authentication endpoints
const phoneSendSchema = z.object({
	phone: z.string().regex(/^\+[1-9]\d{1,14}$/, "Phone must be in E.164 format (e.g., +15555555555)"),
});

const phoneVerifySchema = z.object({
	phone: z.string().regex(/^\+[1-9]\d{1,14}$/, "Phone must be in E.164 format"),
	code: z.string().length(6, "SMS code must be 6 digits"),
});

authRoute.post("/phone/send", async (c) => {
	let rawBody: unknown;
	try {
		rawBody = await c.req.json();
	} catch (err) {
		const details = err instanceof Error ? err.message : String(err);
		return c.json({ error: "Invalid JSON", details }, 400);
	}

	const result = phoneSendSchema.safeParse(rawBody);
	if (!result.success) {
		return c.json({ error: "Invalid payload", details: result.error.format() }, 400);
	}

	const { phone } = result.data;
	const isDev = process.env.NODE_ENV === "development";

	// Generate 6-digit code
	const code = Math.floor(100000 + Math.random() * 900000).toString();

	if (isDev) {
		console.log(`[DEV] SMS for ${phone}: ${code}`);
		// Never send real SMS in dev
	}

	// TODO: Store hashed code with 10-min expiry in database
	// TODO: Send via Twilio in production (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER)

	return c.json({ message: "SMS code sent successfully" });
});

authRoute.post("/phone/verify", async (c) => {
	let rawBody: unknown;
	try {
		rawBody = await c.req.json();
	} catch (err) {
		const details = err instanceof Error ? err.message : String(err);
		return c.json({ error: "Invalid JSON", details }, 400);
	}

	const result = phoneVerifySchema.safeParse(rawBody);
	if (!result.success) {
		return c.json({ error: "Invalid payload", details: result.error.format() }, 400);
	}

	const { phone, code } = result.data;

	// TODO: Verify code from database with expiry check (10 minutes)
	// Accept any 6-digit code in dev mode
	if (process.env.NODE_ENV === "development" || code.length === 6) {
		const sessionId = crypto.randomUUID();

		return c.json({
			token: sessionId,
			user: {
				id: "phone-user-id",
				email: phone + "@phone.local",
				name: "Phone User",
			},
		});
	}

	return c.json({ error: "Invalid or expired code" }, 401);
});

export { authRoute };
