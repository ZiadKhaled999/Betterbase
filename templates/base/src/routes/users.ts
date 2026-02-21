import { asc } from 'drizzle-orm';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z, ZodError } from 'zod';
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

const paginationSchema = z.object({
  limit: z.coerce.number().int().nonnegative().default(DEFAULT_LIMIT),
  offset: z.coerce.number().int().nonnegative().default(DEFAULT_OFFSET),
});

export const usersRoute = new Hono();

usersRoute.get('/', async (c) => {
  try {
    const pagination = paginationSchema.parse({
      limit: c.req.query('limit'),
      offset: c.req.query('offset'),
    });

    const limit = Math.min(pagination.limit, MAX_LIMIT);
    const offset = pagination.offset;

    if (limit === 0) {
      return c.json({
        users: [],
        pagination: {
          limit,
          offset,
          // No DB query is run for limit=0, so hasMore cannot be determined.
          hasMore: null,
        },
      });
    }

    const rows = await db.select().from(users).orderBy(asc(users.id)).limit(limit + 1).offset(offset);
    const hasMore = rows.length > limit;
    const paginatedUsers = rows.slice(0, limit);

    return c.json({
      users: paginatedUsers,
      pagination: {
        limit,
        offset,
        hasMore,
      },
    });
  } catch (error) {
    if (error instanceof HTTPException) {
      throw error;
    }

    if (error instanceof ZodError) {
      return c.json(
        {
          error: 'Invalid pagination query parameters',
          details: error.issues,
        },
        400,
      );
    }

    console.error('Failed to fetch users:', error);
    throw error;
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
