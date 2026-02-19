import { z } from 'zod';

// Keep in sync with packages/cli/src/constants.ts DEFAULT_DB_PATH.
export const DEFAULT_DB_PATH = 'local.db';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DB_PATH: z.string().min(1).default(DEFAULT_DB_PATH),
});

export const env = envSchema.parse(process.env);
