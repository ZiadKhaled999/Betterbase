import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { env } from './lib/env';
import { healthRoute } from './routes/health';
import { usersRoute } from './routes/users';

const app = new Hono();

app.route('/health', healthRoute);
app.route('/users', usersRoute);

app.get('/', (c) => {
  return c.json({
    name: 'BetterBase',
    message: 'Bun + Hono + Drizzle starter',
  });
});

app.onError((error, c) => {
  if (error instanceof HTTPException) {
    return c.json(
      {
        error: error.message,
        details: (error as { cause?: unknown }).cause ?? null,
      },
      error.status,
    );
  }

  return c.json({ error: 'Internal Server Error' }, 500);
});

export default {
  port: env.PORT,
  fetch: app.fetch,
};
