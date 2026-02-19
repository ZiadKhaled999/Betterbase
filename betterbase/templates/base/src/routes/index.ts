import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { HTTPException } from 'hono/http-exception';
import { env } from '../lib/env';
import { healthRoute } from './health';
import { usersRoute } from './users';

export function registerRoutes(app: Hono): void {
  app.use('*', cors());
  app.use('*', logger());

  app.onError((err, c) => {
    const isHttpError = err instanceof HTTPException;
    const showDetailedError = env.NODE_ENV === 'development' || isHttpError;

    return c.json(
      {
        error: showDetailedError ? err.message : 'Internal Server Error',
        stack: env.NODE_ENV === 'development' ? err.stack : undefined,
        details: isHttpError ? (err as { cause?: unknown }).cause ?? null : null,
      },
      isHttpError ? err.status : 500,
    );
  });

  app.route('/health', healthRoute);
  app.route('/api/users', usersRoute);
}
