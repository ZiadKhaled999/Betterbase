/**
 * GraphQL Module
 * 
 * Auto-generates GraphQL schema, resolvers, and server from Drizzle ORM schema.
 * 
 * @example
 * ```typescript
 * import { 
 *   generateGraphQLSchema, 
 *   generateResolvers,
 *   createGraphQLServer,
 *   exportSDL 
 * } from '@betterbase/core/graphql';
 * ```
 */

// Schema generator
export { 
  generateGraphQLSchema, 
  GraphQLJSON, 
  GraphQLDateTime,
  type GraphQLGenerationConfig 
} from './schema-generator';

// Resolvers
export { 
  generateResolvers, 
  createGraphQLContext, 
  requireAuth,
  type DatabaseConnection, 
  type GraphQLContext, 
  type GraphQLResolver, 
  type Resolvers,
  type ResolverGenerationConfig
} from './resolvers';

// Server
export { 
  createGraphQLServer, 
  startGraphQLServer,
  type GraphQLConfig 
} from './server';

// SDL Exporter
export { 
  exportSDL, 
  exportTypeSDL, 
  saveSDL 
} from './sdl-exporter';
