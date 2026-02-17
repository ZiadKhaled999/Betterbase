import type { ZodType } from 'zod';
import { z } from 'zod';

export function parseBody<T>(schema: ZodType<T>, body: unknown): T {
  return schema.parse(body);
}

export const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
});
