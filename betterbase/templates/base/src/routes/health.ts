import { Hono } from 'hono';

const healthRoute = new Hono();

healthRoute.get('/', (c) => {
  return c.json({
    status: 'ok',
    service: 'betterbase-template',
  });
});

export { healthRoute };
