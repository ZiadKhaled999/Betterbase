import { Hono } from 'hono';

export const healthRoute = new Hono();

healthRoute.get('/', (c) => {
  return c.json({
    status: 'healthy',
    database: 'connected',
    timestamp: new Date().toISOString(),
  });
});
