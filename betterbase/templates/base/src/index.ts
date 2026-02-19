import { Hono } from 'hono';
import { env } from './lib/env';
import { realtime } from './lib/realtime';
import { registerRoutes } from './routes';

const app = new Hono();
registerRoutes(app);

const server = Bun.serve({
  fetch: app.fetch,
  port: env.PORT,
  development: env.NODE_ENV === 'development',
  websocket: {
    open(ws) {
      realtime.handleConnection(ws);
    },
    message(ws, message) {
      realtime.handleMessage(ws, message.toString());
    },
    close(ws) {
      realtime.handleClose(ws);
    },
  },
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
