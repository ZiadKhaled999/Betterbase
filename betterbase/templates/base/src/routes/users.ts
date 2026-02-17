import { Hono } from 'hono';
import { createUserSchema, parseBody } from '../middleware/validation';

const usersRoute = new Hono();

usersRoute.post('/', async (c) => {
  const body = await c.req.json();
  const parsed = parseBody(createUserSchema, body);

  return c.json(
    {
      message: 'User payload validated',
      user: parsed,
    },
    201,
  );
});

export { usersRoute };
