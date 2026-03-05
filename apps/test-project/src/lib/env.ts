import { z } from "zod";
import { DEFAULT_DB_PATH } from "@betterbase/shared";

const envSchema = z.object({
	NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
	PORT: z.coerce.number().int().positive().default(3000),
	DB_PATH: z.string().min(1).default(DEFAULT_DB_PATH),
	// Auth configuration
	AUTH_SECRET: z.string().min(32).optional(),
	AUTH_URL: z.string().url().default("http://localhost:3000"),
});

export const env = envSchema.parse(process.env);
