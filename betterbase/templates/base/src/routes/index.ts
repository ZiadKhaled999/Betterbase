import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { HTTPException } from 'hono/http-exception';
import { db } from '../db';
import { users } from '../db/schema';
import { healthRoute } from './health';
import { usersRoute } from './users';

const app = new Hono();

app.use('*', cors());
app.use('*', logger());
app.use('*', async (c, next) => {
  const start = performance.now();
  await next();
  const duration = (performance.now() - start).toFixed(2);
  console.log(`⏱ ${c.req.method} ${c.req.path} - ${duration}ms`);
});

app.onError((err, c) => {
  console.error('Error:', err);
  return c.json(
    {
      error: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
      details: err instanceof HTTPException ? (err as { cause?: unknown }).cause ?? null : null,
    },
    err instanceof HTTPException ? err.status : 500,
  );
});

app.route('/health', healthRoute);
app.route('/users', usersRoute);

app.get('/api/users', async (c) => {
  const allUsers = await db.select().from(users);
  return c.json({ users: allUsers });
});

const server = Bun.serve({
  fetch: app.fetch,
  port: Number(process.env.PORT ?? 3000),
  development: process.env.NODE_ENV === 'development',
});

console.log('\x1b[32m🚀 BetterBase dev server started\x1b[0m');
console.log(`\x1b[36m→ URL:\x1b[0m http://localhost:${server.port}`);
console.log('\x1b[35m→ Routes:\x1b[0m');
console.log('  GET /health');
console.log('  GET /api/users');
console.log('  POST /users');

process.on('SIGTERM', () => {
  console.log('SIGTERM received, closing server...');
  server.stop();
});

process.on('SIGINT', () => {
  console.log('SIGINT received, closing server...');
  server.stop();
});
