import { HTTPException } from 'hono/http-exception';
import type { ZodType } from 'zod';
import { z } from 'zod';

export function parseBody<T>(schema: ZodType<T>, body: unknown): T {
  const result = schema.safeParse(body);

  if (!result.success) {
    throw new HTTPException(400, {
      message: 'Validation failed',
      cause: {
        errors: result.error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
          code: issue.code,
        })),
      },
    });
  }

  return result.data;
}

// TODO: Placeholder schema for scaffolded user-creation routes.
export const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
});
