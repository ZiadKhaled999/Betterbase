import { Hono } from 'hono';
import { upgradeWebSocket } from 'hono/bun';
import { env } from './lib/env';
import { realtime } from './lib/realtime';
import { registerRoutes } from './routes';

const app = new Hono();

app.get(
  '/ws',
  upgradeWebSocket(() => ({
    onOpen(_event, ws) {
      realtime.handleConnection(ws.raw);
    },
    onMessage(event, ws) {
      const message = typeof event.data === 'string' ? event.data : event.data.toString();
      realtime.handleMessage(ws.raw, message);
    },
    onClose(_event, ws) {
      realtime.handleClose(ws.raw);
    },
  })),
);

registerRoutes(app);

const server = Bun.serve({
  fetch: app.fetch,
  port: env.PORT,
  development: env.NODE_ENV === 'development',
});

console.log(`🚀 Server running at http://localhost:${server.port}`);
for (const route of app.routes) {
  console.log(`  ${route.method} ${route.path}`);
}

process.on('SIGTERM', () => {
  server.stop();
});

process.on('SIGINT', () => {
  server.stop();
});

export { app, server };
