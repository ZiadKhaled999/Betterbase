import type { Context, Next } from 'hono';
import { createRequestLogger } from '../logger';

/**
 * Request logging middleware for Hono
 * 
 * Logs all incoming requests and responses with:
 * - Request ID (unique per request)
 * - HTTP method and path
 * - Response status code
 * - Request duration
 * 
 * Usage:
 *   app.use('*', requestLogger());
 * 
 * The logger is attached to context and can be accessed:
 *   const logger = c.get('logger');
 *   logger.info("Processing payment");
 */
export function requestLogger() {
  return async (c: Context, next: Next) => {
    const logger = createRequestLogger();
    const start = Date.now();

    // Attach logger to context for use in route handlers
    c.set('logger', logger);

    // Log incoming request
    logger.info({
      msg: 'Incoming request',
      method: c.req.method,
      path: c.req.path,
      user_agent: c.req.header('user-agent'),
    });

    // Execute route handler
    await next();

    // Log response
    const duration = Date.now() - start;
    const level = c.res.status >= 500 ? 'error' : 
                  c.res.status >= 400 ? 'warn' : 'info';
    
    logger[level]({
      msg: 'Request completed',
      method: c.req.method,
      path: c.req.path,
      status: c.res.status,
      duration_ms: duration,
    });

    // Warn on slow requests (>1s)
    if (duration > 1000) {
      logger.warn({
        msg: 'Slow request detected',
        duration_ms: duration,
        path: c.req.path,
      });
    }
  };
}
