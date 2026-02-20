import { and, eq, gt } from 'drizzle-orm';
import { createMiddleware } from 'hono/factory';
import { db } from '../db';
import { sessions, users } from '../db/schema';

export interface AuthContext {
  user: {
    id: string;
    email: string;
    name: string | null;
  };
}

function getSessionToken(authHeader: string | undefined): string | null {
  if (!authHeader) return null;

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') return null;

  return parts[1];
}

async function validateSession(token: string): Promise<AuthContext['user'] | null> {
  const session = await db
    .select()
    .from(sessions)
    .where(and(eq(sessions.id, token), gt(sessions.expiresAt, new Date())))
    .limit(1);

  if (session.length === 0) return null;

  const user = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
    })
    .from(users)
    .where(eq(users.id, session[0].userId))
    .limit(1);

  return user.length > 0 ? user[0] : null;
}

export const requireAuth = createMiddleware<{ Variables: AuthContext }>(async (c, next) => {
  const token = getSessionToken(c.req.header('Authorization'));

  if (!token) {
    return c.json({ error: 'Unauthorized: No token provided' }, 401);
  }

  const user = await validateSession(token);
  if (!user) {
    return c.json({ error: 'Unauthorized: Invalid or expired token' }, 401);
  }

  c.set('user', user);
  await next();
});

export const optionalAuth = createMiddleware<{ Variables: Partial<AuthContext> }>(async (c, next) => {
  const token = getSessionToken(c.req.header('Authorization'));

  if (token) {
    const user = await validateSession(token);
    if (user) {
      c.set('user', user);
    }
  }

  await next();
});

export function getUser(c: { get: (key: 'user') => AuthContext['user'] }): AuthContext['user'] {
  return c.get('user');
}
