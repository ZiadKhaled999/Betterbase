import { Hono } from 'hono';
import { upgradeWebSocket, websocket } from 'hono/bun';
import { env } from './lib/env';
import { realtime } from './lib/realtime';
import { registerRoutes } from './routes';
import { auth } from './auth';

const app = new Hono();

app.get(
  '/ws',
  upgradeWebSocket((c) => {
    const authHeaderToken = c.req.header('authorization')?.replace(/^Bearer\s+/i, '');
    // Prefer Authorization header. Query token is compatibility fallback and should be short-lived in production.
    const queryToken = c.req.query('token');
    const token = authHeaderToken ?? queryToken;

    if (!authHeaderToken && queryToken) {
      console.warn('WebSocket auth using query token fallback; prefer header/cookie/subprotocol in production.');
    }

    return {
    onOpen(_event, ws) {
      realtime.handleConnection(ws.raw, token);
    },
    onMessage(event, ws) {
      const message = typeof event.data === 'string' ? event.data : event.data.toString();
      realtime.handleMessage(ws.raw, message);
    },
    onClose(_event, ws) {
      realtime.handleClose(ws.raw);
    },
  };
  }),
);

registerRoutes(app);

app.on(["POST", "GET"], "/api/auth/**", (c) => {
  return auth.handler(c.req.raw)
});

const server = Bun.serve({
  fetch: app.fetch,
  websocket,
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
