import { Hono } from 'hono';
import { env } from './lib/env';
import { healthRoute } from './routes/health';

const app = new Hono();

app.route('/health', healthRoute);

app.get('/', (c) => {
  return c.json({
    name: 'BetterBase',
    message: 'Bun + Hono + Drizzle starter',
  });
});

export default {
  port: env.PORT,
  fetch: app.fetch,
};
