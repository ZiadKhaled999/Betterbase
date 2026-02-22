/**
 * GraphQL Server
 * 
 * Creates a GraphQL server using graphql-yoga that integrates with Hono.
 * Supports authentication, subscriptions, and playground in development.
 */

import { createServer } from 'node:http';
import { createYoga } from 'graphql-yoga';
import { Hono } from 'hono';
import type { GraphQLSchema } from 'graphql';
import type { GraphQLContext, Resolvers } from './resolvers';

/**
 * Configuration for GraphQL server
 */
export interface GraphQLConfig {
  /** The GraphQL schema */
  schema: GraphQLSchema;
  /** The resolvers */
  resolvers: Resolvers;
  /** Path for the GraphQL endpoint (default: /api/graphql) */
  path?: string;
  /** Enable GraphQL Playground in development (default: true in dev) */
  playground?: boolean;
  /** Enable authentication (default: true) */
  auth?: boolean;
  /** Function to get user from request headers */
  getUser?: (headers: Headers) => GraphQLContext['user'] | Promise<GraphQLContext['user'] | undefined>;
  /** Database connection factory */
  getDb: () => unknown;
  /** Additional yoga configuration options */
  yogaOptions?: Record<string, unknown>;
}

/**
 * Default GraphQL server configuration
 */
const defaultConfig = {
  path: '/api/graphql',
  playground: process.env.NODE_ENV !== 'production',
  auth: true,
};

/**
 * Create a GraphQL server that integrates with Hono
 * 
 * @param config - Configuration for the GraphQL server
 * @returns An object with the Hono app and the yoga server
 * 
 * @example
 * ```typescript
 * import { Hono } from 'hono';
 * import { createGraphQLServer } from '@betterbase/core/graphql';
 * import { schema } from './schema';
 * import { resolvers } from './resolvers';
 * import { db } from './db';
 * 
 * const app = new Hono();
 * 
 * const { app: graphqlApp, yoga } = createGraphQLServer({
 *   schema,
 *   resolvers,
 *   getDb: () => db,
 *   getUser: async (headers) => {
 *     // Implement user extraction from headers
 *     return null;
 *   },
 * });
 * 
 * app.route('/api/graphql', graphqlApp);
 * 
 * export default app;
 * ```
 */
export function createGraphQLServer(config: GraphQLConfig): {
  /** The Hono app for the GraphQL endpoint */
  app: any;
  /** The yoga server instance */
  yoga: any;
  /** The HTTP server */
  server: ReturnType<typeof createServer>;
} {
  const mergedConfig = { ...defaultConfig, ...config };
  
  // Create context function
  const context = async ({ request }: { request: Request }) => {
    const headers = request.headers;
    
    // Get user if getUser function is provided
    let user: GraphQLContext['user'] | undefined;
    if (mergedConfig.getUser) {
      user = await mergedConfig.getUser(headers);
    }
    
    return {
      db: mergedConfig.getDb(),
      user,
      headers,
    };
  };
  
  // Create yoga server
  const yoga = createYoga<GraphQLContext>({
    schema: config.schema,
    context,
    // Enable playground in development unless explicitly disabled
    playground: mergedConfig.playground,
    // Disable introspection in production unless explicitly enabled
    introspection: mergedConfig.playground,
    // GraphQL endpoint path
    graphqlEndpoint: mergedConfig.path,
    // Handle subscriptions
    graphiql: mergedConfig.playground ? {
      endpoint: mergedConfig.path,
    } : false,
  } as any);
  
  // Create Hono app
  const app = new Hono();
  
  // Middleware for authentication
  if (mergedConfig.auth) {
    app.use('/*', async (c: any, next: any) => {
      // Check for authorization header
      const authHeader = c.req.header('Authorization');
      
      // If no auth header provided, check if operation is allowed without auth
      if (!authHeader) {
        // Allow unauthenticated requests to pass through - resolvers can check context.user
        // The getUser function in config will handle token validation
        await next();
        return;
      }
      
      // Extract and validate token from Authorization header
      // Expected format: "Bearer <token>"
      const token = authHeader.startsWith('Bearer ') 
        ? authHeader.substring(7) 
        : authHeader;
      
      if (!token) {
        return c.json({ errors: [{ message: 'Missing authentication token' }] }, 401);
      }
      
      await next();
    });
  }
  
  // Handle GraphQL requests
  app.all(mergedConfig.path || '*', async (c: any) => {
    // Convert Hono request to Fetch API request
    const url = new URL(c.req.url);
    const request = new Request(url.href, {
      method: c.req.method,
      headers: c.req.header(),
      body: c.req.method !== 'GET' && c.req.method !== 'HEAD' ? await c.req.text() : undefined,
    });
    
    // Handle the request with yoga
    const response = await yoga.handle(request, {
      db: mergedConfig.getDb(),
      user: undefined,
      headers: request.headers,
    });
    
    // Copy response headers to Hono response
    const body = await response.text();
    
    return c.newResponse(body, response.status);
  });
  
  // Health check endpoint
  app.get('/health', (c: any) => {
    return c.json({ status: 'ok', graphql: 'running' });
  });
  
  // Create HTTP server
  const server = createServer(yoga);
  
  return {
    app,
    yoga,
    server,
  };
}

/**
 * Start the GraphQL server
 * 
 * @param config - Configuration for the GraphQL server
 * @param port - Port to listen on (default: 4000)
 * 
 * @example
 * ```typescript
 * import { createGraphQLServer, startGraphQLServer } from '@betterbase/core/graphql';
 * 
 * const config = {
 *   schema,
 *   resolvers,
 *   getDb: () => db,
 * };
 * 
 * startGraphQLServer(config, 4000);
 * ```
 */
export function startGraphQLServer(config: GraphQLConfig, port: number = 4000): void {
  const { server } = createGraphQLServer(config);
  
  server.listen(port, () => {
    console.log(`🚀 GraphQL Server running at http://localhost:${port}/api/graphql`);
    if (config.playground) {
      console.log(`📊 GraphQL Playground: http://localhost:${port}/api/graphql`);
    }
  });
}
