import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { magicLink } from "better-auth/plugins/magic-link";
import { db } from "../db";
import * as schema from "../db/schema";

// Development mode: log magic links instead of sending
const isDev = process.env.NODE_ENV === "development";

export const auth = betterAuth({
	database: drizzleAdapter(db, {
		provider: "sqlite",
		schema: {
			user: schema.user,
			session: schema.session,
			account: schema.account,
			verification: schema.verification,
		},
	}),
	emailAndPassword: {
		enabled: true,
		requireEmailVerification: false,
	},
	secret: process.env.AUTH_SECRET,
	baseURL: process.env.AUTH_URL ?? "http://localhost:3000",
	trustedOrigins: [process.env.AUTH_URL ?? "http://localhost:3000"],
	plugins: [
		magicLink({
			sendMagicLink: async ({ email, url }) => {
				if (isDev) {
					console.log(`[DEV] Magic Link for ${email}: ${url}`);
					return;
				}
				// In production, send email using SMTP config
				// SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM
				console.log(`[PROD] Magic Link would be sent to ${email}: ${url}`);
			},
		}),
	],
});

export type Auth = typeof auth;
