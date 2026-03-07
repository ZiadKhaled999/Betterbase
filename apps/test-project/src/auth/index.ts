import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "../db";
import * as schema from "../db/schema";
import { env } from "../lib/env";

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
	secret: env.AUTH_SECRET,
	baseURL: env.AUTH_URL,
	trustedOrigins: [env.AUTH_URL],
	plugins: [],
});

export type Auth = typeof auth;
