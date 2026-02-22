/**
 * Type declarations for dynamically generated GraphQL route
 */

import type { Hono } from 'hono';

declare module './routes/graphql' {
  export const graphqlRoute: Hono;
}
