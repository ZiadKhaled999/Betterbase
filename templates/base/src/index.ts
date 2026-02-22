import { Hono } from 'hono';
import { upgradeWebSocket, websocket } from 'hono/bun';
import { EventEmitter } from 'events';
import { env } from './lib/env';
import { realtime } from './lib/realtime';
import { registerRoutes } from './routes';
import { auth } from './auth';
import config from '../betterbase.config';
import { initializeWebhooks } from '@betterbase/core/webhooks';

const app = new Hono();

// Create an event emitter for database changes (used by webhooks)
const dbEventEmitter = new EventEmitter();

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

// Mount GraphQL API if enabled
const graphqlEnabled = config.graphql?.enabled ?? true;
if (graphqlEnabled) {
  // Dynamic import to handle case where graphql route doesn't exist yet
  try {
    // Using require for dynamic loading of potentially non-existent module
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const graphql = require('./routes/graphql');
    const graphqlRoute = graphql.graphqlRoute as ReturnType<typeof import('hono').Hono.prototype.route>;
    app.route('/', graphqlRoute);
    console.log('🛸 GraphQL API enabled at /api/graphql');
  } catch {
    // GraphQL route not generated yet
    if (env.NODE_ENV === 'development') {
      console.log('ℹ️  Run "bb graphql generate" to enable GraphQL API');
    }
  }
}

// Initialize webhooks (Phase 13)
initializeWebhooks(config, dbEventEmitter);

// Webhook logs API endpoint (for CLI access)
app.get('/api/webhooks/:id/logs', async (c) => {
  const webhookId = c.req.param('id');
  // In a full implementation, this would fetch logs from the dispatcher
  // For now, return a placeholder
  return c.json({ logs: [], message: 'Logs not available via API in v1' });
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

export { app, server, dbEventEmitter };
