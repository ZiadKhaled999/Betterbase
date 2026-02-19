import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';
import { db } from '../db';
import { users } from '../db/schema';
import { parseBody } from '../middleware/validation';

export const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
});

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;
const DEFAULT_OFFSET = 0;

function parseNonNegativeInt(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    return fallback;
  }

  return parsed;
}

export const usersRoute = new Hono();

usersRoute.get('/', async (c) => {
  const requestedLimit = parseNonNegativeInt(c.req.query('limit'), DEFAULT_LIMIT);
  const limit = Math.min(requestedLimit, MAX_LIMIT);
  const effectiveLimit = Math.max(limit, 1);
  const offset = parseNonNegativeInt(c.req.query('offset'), DEFAULT_OFFSET);

  try {
    const rows = await db.select().from(users).limit(effectiveLimit + 1).offset(offset);
    const hasMore = limit === 0 ? false : rows.length > limit;
    const paginatedUsers = limit === 0 ? [] : rows.slice(0, limit);

    return c.json({
      users: paginatedUsers,
      pagination: {
        limit,
        offset,
        hasMore,
      },
    });
  } catch (error) {
    console.error('Failed to fetch users:', error);
    return c.json({ error: 'Failed to fetch users' }, 500);
  }
});

usersRoute.post('/', async (c) => {
  try {
    const body = await c.req.json();
    const parsed = parseBody(createUserSchema, body);

    // TODO: persist parsed user via db.insert(users) or a dedicated UsersService.
    return c.json({
      message: 'User payload validated (not persisted)',
      user: parsed,
    });
  } catch (error) {
    if (error instanceof HTTPException) {
      throw error;
    }

    if (error instanceof SyntaxError) {
      throw new HTTPException(400, { message: 'Malformed JSON body' });
    }

    throw error;
  }
});
