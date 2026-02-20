import { Hono } from 'hono';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { users, sessions } from '../db/schema';

const authRoute = new Hono();

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1).optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

authRoute.post('/signup', async (c) => {
  let rawBody: unknown;
  try {
    rawBody = await c.req.json();
  } catch (err) {
    const details = err instanceof Error ? err.message : String(err);
    return c.json({ error: 'Invalid JSON', details }, 400);
  }

  const result = signupSchema.safeParse(rawBody);
  if (!result.success) {
    return c.json({ error: 'Invalid signup payload', details: result.error.format() }, 400);
  }

  const body = result.data;
  const passwordHash = await Bun.password.hash(body.password);

  const created = await db
    .insert(users)
    .values({
      email: body.email,
      name: body.name ?? null,
      passwordHash,
    })
    .returning();

  const createdUser = created[0];
  if (!createdUser) {
    return c.json({ error: 'Failed to create user record' }, 500);
  }

  return c.json({
    user: {
      id: createdUser.id,
      email: createdUser.email,
      name: createdUser.name,
    },
  }, 201);
});

authRoute.post('/login', async (c) => {
  let rawBody: unknown;
  try {
    rawBody = await c.req.json();
  } catch (err) {
    const details = err instanceof Error ? err.message : String(err);
    return c.json({ error: 'Invalid JSON', details }, 400);
  }

  const result = loginSchema.safeParse(rawBody);
  if (!result.success) {
    return c.json({ error: 'Invalid login payload', details: result.error.format() }, 400);
  }

  const body = result.data;

  const user = await db.select().from(users).where(eq(users.email, body.email)).limit(1);
  if (user.length === 0 || !user[0].passwordHash) {
    return c.json({ error: 'Invalid credentials' }, 401);
  }

  const validPassword = await Bun.password.verify(body.password, user[0].passwordHash);
  if (!validPassword) {
    return c.json({ error: 'Invalid credentials' }, 401);
  }

  const sessionId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  await db.insert(sessions).values({
    id: sessionId,
    userId: user[0].id,
    expiresAt,
    ipAddress: c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || null,
    userAgent: c.req.header('user-agent') || null,
  });

  return c.json({
    token: sessionId,
    user: {
      id: user[0].id,
      email: user[0].email,
      name: user[0].name,
    },
  });
});

authRoute.post('/logout', async (c) => {
  const token = c.req.header('Authorization')?.split(' ')[1];
  if (token) {
    await db.delete(sessions).where(eq(sessions.id, token));
  }

  return c.json({ message: 'Logged out' });
});

export { authRoute };
