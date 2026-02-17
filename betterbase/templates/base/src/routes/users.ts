import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { createUserSchema, parseBody } from '../middleware/validation';

const usersRoute = new Hono();

usersRoute.post('/', async (c) => {
  try {
    const body = await c.req.json();
    const parsed = parseBody(createUserSchema, body);

    return c.json(
      {
        message: 'User payload validated',
        user: parsed,
      },
      201,
    );
  } catch (error) {
    if (error instanceof HTTPException) {
      throw error;
    }

    if (error instanceof SyntaxError) {
      throw new HTTPException(400, { message: 'Malformed JSON body' });
    }

    throw new HTTPException(400, { message: 'Invalid request body' });
  }
});

export { usersRoute };
