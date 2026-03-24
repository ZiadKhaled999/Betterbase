import { z } from "zod";

const EnvSchema = z.object({
	DATABASE_URL: z.string().min(1),
	BETTERBASE_JWT_SECRET: z.string().min(32, "JWT secret must be at least 32 characters"),
	BETTERBASE_ADMIN_EMAIL: z.string().email().optional(),
	BETTERBASE_ADMIN_PASSWORD: z.string().min(8).optional(),
	PORT: z.string().default("3001"),
	NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
	STORAGE_ENDPOINT: z.string().optional(),
	STORAGE_ACCESS_KEY: z.string().optional(),
	STORAGE_SECRET_KEY: z.string().optional(),
	STORAGE_BUCKET: z.string().default("betterbase"),
	CORS_ORIGINS: z.string().default("http://localhost:3000"),
	BETTERBASE_PUBLIC_URL: z.string().optional(),
});

export type Env = z.infer<typeof EnvSchema>;

export function validateEnv(): Env {
	const result = EnvSchema.safeParse(process.env);
	if (!result.success) {
		console.error("[env] Invalid environment variables:");
		console.error(result.error.flatten().fieldErrors);
		process.exit(1);
	}
	return result.data;
}
