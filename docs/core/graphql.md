# GraphQL Module

Auto-generated GraphQL schema, resolvers, server, and real-time bridge from Drizzle ORM schema.

## Table of Contents
- [Overview](#overview)
- [Features](#features)
- [Installation](#installation)
- [Usage](#usage)
- [API Reference](#api-reference)
  - [Schema Generator](#schema-generator)
  - [Resolvers](#resolvers)
  - [Server](#server)
  - [Realtime Bridge](#realtime-bridge)
  - [SDL Exporter](#sdl-exporter)
  - [Types](#types)
- [Schema Generation](#schema-generation)
- [Resolver Generation](#resolver-generation)
- [Real-time Integration](#real-time-integration)
- [Best Practices](#best-practices)
- [Examples](#examples)
- [Security Considerations](#security-considerations)

## Overview

The GraphQL module automatically generates a complete GraphQL API from your Drizzle ORM schema, including schema definitions, resolvers, server setup, and real-time capabilities. It eliminates boilerplate by inspecting your database schema and creating a fully-featured GraphQL API with built-in security and performance optimizations.

Key capabilities:
- **Automatic Schema Generation**: Generate GraphQL types from Drizzle tables
- **Resolver Auto-generation**: Create resolvers for queries, mutations, and subscriptions
- **Server Setup**: Ready-to-use GraphQL server with Hono integration
- **Real-time Subscriptions**: Live updates via WebSockets with database change events
- **SDL Export**: Export schema as GraphQL SDL for federation or documentation
- **Type Safety**: Full TypeScript support with inferred types
- **RLS Integration**: Automatic Row Level Security enforcement
- **Performance Optimizations**: Batch loading, caching hints, and query complexity limits

## Features

### Schema Generation
- **Table to Type Mapping**: Each database table becomes a GraphQL type
- **Column to Field Mapping**: Table columns become GraphQL fields with proper types
- **Relationship Detection**: Foreign keys generate relationship fields
- **Enum Support**: Database enums become GraphQL enums
- **JSON Fields**: JSONB/JSON columns mapped to GraphQL JSON scalar
- **Timestamps**: Automatic DateTime handling
- **Custom Scalars**: Support for UUID, DateTime, and JSON scalars

### Resolver Generation
- **Queries**: 
  - `tableName`: List all records (with filtering, sorting, pagination)
  - `tableName_by_pk`: Get single record by primary key
  - `tableName_aggregate`: Aggregate functions (count, sum, avg, etc.)
- **Mutations**:
  - `insert_tableName`: Insert one or multiple records
  - `update_tableName`: Update records by primary key
  - `update_tableName_set`: Update records matching conditions
  - `delete_tableName`: Delete records by primary key
  - `delete_tableName_set`: Delete records matching conditions
- **Subscriptions**:
  - `tableName_insert`: Listen for new records
  - `tableName_update`: Listen for updated records
  - `tableName_delete`: Listen for deleted records

### Server Features
- **Hono Integration**: Works seamlessly with Hono framework
- **GET/POST Endpoints**: Support for both GET and POST requests
- **GraphQL Playground**: Built-in IDE for testing queries
- **Error Handling**: Formatted error responses per GraphQL spec
- **Validation**: Automatic query validation against schema
- **Batching**: Support for batched requests
- **Introspection**: Full schema introspection available

### Real-time Capabilities
- **WebSocket Server**: Built-in WebSocket support for subscriptions
- **Database Triggers**: Listen to database changes via pg_notify or equivalent
- **Event Broadcasting**: Real-time updates to subscribed clients
- **Connection Lifecycle**: Handle connect/disconnect events
- **Authentication**: Integration with RLS and auth systems
- **Message Format**: Standard GraphQL over WebSocket protocol

### SDL Export
- **Schema Export**: Generate GraphQL Schema Definition Language
- **Type Definitions**: Export all types, queries, mutations, subscriptions
- **Directives**: Include custom directives if used
- **Descriptions**: Preserve field and type descriptions
- **Federation Ready**: Compatible with Apollo Federation

## Installation

The GraphQL module is part of `@betterbase/core`:
```bash
bun add @betterbase/core
```

## Usage

### Basic Setup
```typescript
import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/postgres';
import {
  generateGraphQLSchema,
  generateResolvers,
  createGraphQLServer,
  pubsub
} from '@betterbase/core/graphql';
import * as schema from './db/schema';

// Initialize
const app = new Hono();
const db = drizzle(process.env.DATABASE_URL);

// Generate schema and resolvers
const typeDefs = generateGraphQLSchema(schema);
const resolvers = generateResolvers(schema);

// Create GraphQL server
const graphql = createGraphQLServer({
  schema: typeDefs,
  resolvers,
  context: async (c) => ({
    db,
    user: c.get('user'), // from auth middleware
    pubsub
  })
});

// Mount GraphQL endpoints
app.route('/graphql', graphql);
app.get('/graphql-playground', (c) => c.html(/* GraphQL HTML */));

// Start server
app.listen(3000);
```

### With Real-time Subscriptions
```typescript
import { 
  bridgeRealtimeToGraphQL,
  publishDbEvent
} from '@betterbase/core/graphql';

// Set up real-time bridge
const realtimeBridge = bridgeRealtimeToGraphQL({
  db,
  pubsub,
  schema
});

// Start listening for database changes
realtimeBridge.start();

// Later, when you have database changes:
await publishDbEvent(db, {
  table: 'users',
  type: 'INSERT',
  record: newUser,
  timestamp: new Date().toISOString()
});
```

### Manual Server Creation
```typescript
import { serve } from '@hono/node-server';
import { createGraphQLServer } from '@betterbase/core/graphql';

const graphql = createGraphQLServer({
  schema: typeDefs,
  resolvers,
  context: async (c) => ({ db, userId: c.get('userId') })
});

serve({
  fetch: app.fetch,
  port: 3000
});
```

## API Reference

### Schema Generator
Generate GraphQL schema from Drizzle schema.

#### generateGraphQLSchema
```typescript
export function generateGraphQLSchema(
  schema: Record<string, DrizzleTable>,
  options: GraphQLGenerationConfig = {}
): string
```

#### GraphQLGenerationConfig
```typescript
export interface GraphQLGenerationConfig {
  /** Custom type mappings */
  typeMappings?: Record<string, string>;
  
  /** Skip generating certain types */
  excludeTypes?: string[];
  
  /** Custom field overrides */
  fieldOverrides?: Record<
    string, 
    Record<string, { type: string; resolve?: Function }>
  >;
  
  /** Enable/disable certain features */
  enableSubscriptions?: boolean;
  enableAggregates?: boolean;
  enableRelationships?: boolean;
  
  /** Naming conventions */
  namingConvention?: {
    type?: 'PascalCase' | 'camelCase' | 'snake_case';
    field?: 'camelCase' | 'snake_case';
  };
  
  /** Custom scalars */
  customScalars?: Record<string, string>;
  
  /** Description sources */
  descriptions?: {
    fromComments?: boolean;
    fromSchema?: boolean;
  };
}
```

#### GraphQLJSON & GraphQLDateTime
```typescript
export { GraphQLJSON, GraphQLDateTime } from './schema-generator';
```
- `GraphQLJSON`: Scalar for JSON values
- `GraphQLDateTime`: Scalar for ISO date strings

### Resolvers
Generate resolver functions from Drizzle schema.

#### generateResolvers
```typescript
export function generateResolvers(
  schema: Record<string, DrizzleTable>,
  options: ResolverGenerationConfig = {}
): Resolvers
```

#### ResolverGenerationConfig
```typescript
export interface ResolverGenerationConfig {
  /** Enable/disable resolver types */
  enableQueries?: boolean;
  enableMutations?: boolean;
  enableSubscriptions?: boolean;
  
  /** Custom resolver overrides */
  overrides?: Partial<Resolvers>;
  
  /** Batch loading configuration */
  batching?: {
    enabled?: boolean;
    maxBatchSize?: number;
    batchDelayMs?: number;
  };
  
  /** Security hooks */
  hooks?: {
    preResolve?: (context: GraphQLContext, info: any) => Promise<void>;
    postResolve?: (context: GraphQLContext, result: any, info: any) => Promise<any>;
  };
  
  /** Context enrichment */
  contextEnrichment?: (context: GraphQLContext) => Promise<GraphQLContext> | GraphQLContext;
}
```

#### Resolver Types
```typescript
export type Resolvers = {
  Query: Record<string, GraphQLResolver>;
  Mutation: Record<string, GraphQLResolver>;
  Subscription: Record<string, GraphQLResolver>;
};

export type GraphQLResolver = (
  parent: unknown,
  args: Record<string, unknown>,
  context: GraphQLContext,
  info: GraphQLResolveInfo
) => Promise<unknown> | unknown;
```

#### Context Types
```typescript
export interface GraphQLContext {
  db: DrizzleDB;
  userId?: string;
  user?: Record<string, unknown>;
  pubsub: PubSub;
  [key: string]: unknown;
}
```

### Server
Create and run GraphQL server.

#### createGraphQLServer
```typescript
export function createGraphQLServer(
  options: GraphQLConfig
): ReturnType<typeof serveGraphQL>
```

#### GraphQLConfig
```typescript
export interface GraphQLConfig {
  /** GraphQL schema string */
  schema: string;
  
  /** Resolver functions */
  resolvers: Resolvers;
  
  /** Context factory function */
  context?: (
    c: Context 
  ) => Promise<Partial<GraphQLContext>> | Partial<GraphQLContext>;
  
  /** Format error responses */
  formatError?: (error: FormattedError) => FormattedError;
  
  /** Enable built-in playground */
  playground?: boolean;
  
  /** GraphQL endpoint path */
  path?: string;
  
  /** WebSocket subscription endpoint */
  subscriptionsPath?: string;
  
  /** Validation rules */
  validationRules?: Array<ValidationRule>;
  
  /** Query complexity limits */
  complexityLimits?: {
    maxComplexity?: number;
    createComplexityLimit?: (options: {
      query: DocumentNode;
      variables: VariableMapping[];
    }) => number;
  };
  
  /** Depth limits */
  depthLimits?: {
    maxDepth?: number;
  };
}
```

#### Server Functions
```typescript
export {
  createGraphQLServer,
  startGraphQLServer,
  pubsub,
  publishGraphQLEvent
} from './server';
```

#### PubSub Interface
```typescript
export interface PubSub {
  /** Publish event to topic */
  publish<T>(topic: string, payload: T): Promise<void>;
  
  /** Subscribe to topic */
  subscribe<T>(topic: string): AsyncIterable<T>;
  
  /** Unsubscribe from topic */
  unsubscribe(topic: string): void;
  
  /** Get number of subscribers */
  subscriberCount(topic: string): number;
}
```

### Realtime Bridge
Bridge database changes to GraphQL subscriptions.

#### bridgeRealtimeToGraphQL
```typescript
export function bridgeRealtimeToGraphQL(
  options: RealtimeBridgeConfig
): RealtimeBridge
```

#### RealtimeBridgeConfig
```typescript
export interface RealtimeBridgeConfig {
  /** Database connection */
  db: DrizzleDB;
  
  /** PubSub instance */
  pubsub: PubSub;
  
  /** Database schema */
  schema: Record<string, DrizzleTable>;
  
  /** Table configurations */
  tables?: Partial<Record<string, TableBridgeConfig>>;
  
  /** Event filtering */
  filter?: (event: DBEvent) => boolean;
  
  /** Debounce settings */
  debounceMs?: number;
}
```

#### TableBridgeConfig
```typescript
export interface TableBridgeConfig {
  /** Enable/disable bridging for table */
  enabled?: boolean;
  
  /** Events to bridge */
  events?: ('INSERT' | 'UPDATE' | 'DELETE')[];
  
  /** Custom topic name */
  topic?: string;
  
  /** Payload transformation */
  transform?: (event: DBEvent) => unknown;
}
```

#### RealtimeBridge
```typescript
export interface RealtimeBridge {
  /** Start listening for database changes */
  start(): void;
  
  /** Stop listening */
  stop(): void;
  
  /** Check if bridge is active */
  isActive(): boolean;
  
  /** Manually publish event */
  publishEvent(event: DBEvent): Promise<void>;
}
```

#### Event Types
```typescript
export {
  DbInsertEvent,
  DbUpdateEvent,
  DbDeleteEvent,
  type DbEvent
} from './realtime-bridge';
```

### SDL Exporter
Export schema as GraphQL SDL.

#### exportSDL
```typescript
export function exportSDL(
  schemaString: string,
  options: ExportOptions = {}
): string
```

#### ExportOptions
```typescript
export interface ExportOptions {
  /** Include descriptions */
  includeDescriptions?: boolean;
  
  /** Sort types alphabetically */
  sortAlphabetically?: boolean;
  
  /** Skip certain types */
  skipTypes?: string[];
  
  /** Custom formatting */
  indent?: string | number;
  
  /** Include built-in scalars */
  includeBuiltInScalars?: boolean;
  
  /** Add federation directives */
  federation?: boolean;
}
```

#### Related Functions
```typescript
export {
  exportTypeSDL,
  saveSDL
} from './sdl-exporter';
```

### Types
Exported utility types.

```typescript
export type {
  DatabaseConnection,
  GraphQLContext,
  GraphQLResolver,
  Resolvers,
  GraphQLGenerationConfig,
  ResolverGenerationConfig,
  GraphQLConfig,
  RealtimeBridgeConfig
} from './index';
```

## Schema Generation

### Type Mapping Rules
Database columns are mapped to GraphQL types as follows:

| Database Type | GraphQL Type | Notes |
|---------------|--------------|-------|
| INTEGER, BIGINT, SMALLINT | Int | |
| REAL, DOUBLE PRECISION | Float | |
| VARCHAR, TEXT, CHAR | String | |
| BOOLEAN | Boolean | |
| TIMESTAMP, TIMESTAMPTZ | DateTime | Custom scalar |
| DATE | DateTime | |
| UUID | UUID | Custom scalar |
| JSON, JSONB | JSON | Custom scalar |
| ENUM | Enum | Auto-generated enum type |
| ARRAY | [Type]! | Non-nullable array |
| FOREIGN KEY | Related Type | Relationship field |
| JOIN TABLE | Many-to-many | Special handling |

### Naming Conventions
- **Types**: PascalCase (table name → TypeName)
- **Fields**: camelCase (column name → fieldName)
- **Arguments**: camelCase
- **Enums**: PascalCase (enum name → EnumName)
- **Values**: UPPER_SNAKE_CASE (enum value → ENUM_VALUE)

### Relationship Detection
Foreign keys automatically generate relationship fields:
- **Single Foreign Key**: Generates a singular field (e.g., `author: User`)
- **Multiple Foreign Keys**: Generates plural field for collections (e.g., `posts: [Post!]!`)
- **Many-to-Many**: Detected via join tables with two foreign keys

### Customizations
Override default behavior via configuration:
```typescript
const typeDefs = generateGraphQLSchema(schema, {
  typeMappings: {
    // Map custom database types
    'ltree': 'String',
    'hstore': 'JSON'
  },
  excludeTypes: ['migrations', 'schema_migrations'],
  fieldOverrides: {
    // Override specific field types
    users: {
      password: { type: 'String', resolve: (parent) => '[REDACTED]' }
    }
  },
  namingConvention: {
    type: 'PascalCase',
    field: 'camelCase'
  }
});
```

## Resolver Generation

### Query Resolvers
Generated queries follow Postgraphile-like naming:

#### List Query
```graphql
# Returns paginated list with filtering and sorting
users(
  offset: Int = 0
  limit: Int = 20
  order_by: [users_order_by!]
  where: users_bool_exp
): [User!]!
```

#### Single Object Query
```graphql
# Returns single object by primary key
users_by_pk(id: Int!): User
```

#### Aggregate Query
```graphql
# Returns aggregate calculations
users_aggregate(
  offset: Int = 0
  limit: Int = 20
  order_by: [users_order_by!]
  where: users_bool_exp
): users_aggregate
```

### Mutation Resolvers
Generated mutations for data modification:

#### Insert Single
```graphql
# Insert one record
insert_users_one(
  object: users_insert_input!
): users_mutation_response
```

#### Insert Multiple
```graphql
# Insert multiple records
insert_users(
  objects: [users_insert_input!]!
): users_mutation_response
```

#### Update by PK
```graphql
# Update record by primary key
update_users_by_pk(
  pk_columns: users_pk_columns_input!
  _set: users_set_input
): users
```

#### Update by Conditions
```graphql
# Update records matching conditions
update_users(
  _set: users_set_input
  where: users_bool_exp
): users_mutation_response
```

#### Delete by PK
```graphql
# Delete record by primary key
delete_users_by_pk(
  pk_columns: users_pk_columns_input!
): users
```

#### Delete by Conditions
```graphql
# Delete records matching conditions
delete_users(
  where: users_bool_exp
): users_mutation_response
```

### Subscription Resolvers
Generated subscriptions for real-time updates:

#### Insert Subscription
```graphql
# Fires when new record is inserted
users_insert(
  offset: Int = 0
  limit: Int = 20
  order_by: [users_order_by!]
  where: users_bool_exp
): [User!]!
```

#### Update Subscription
```graphql
# Fires when record is updated
users_update(
  offset: Int = 0
  limit: Int = 20
  order_by: [users_order_by!]
  where: users_bool_exp
): [User!]!
```

#### Delete Subscription
```graphql
# Fires when record is deleted
users_delete(
  offset: Int = 0
  limit: Int = 20
  order_by: [users_order_by!]
  where: users_bool_exp
): [User!]!
```

## Real-time Integration

### Database Change Detection
The realtime bridge detects database changes through:
1. **Database Triggers**: INSERT/UPDATE/DELETE triggers on tables
2. **Polling**: Fallback for databases without trigger support
3. **Native Features**: Using pg_notify, MySQL binary logs, etc.
4. **Application Level**: Tracking changes through application

### Event Publishing
Changes are published as standardized events:
```typescript
interface DBEvent {
  table: string;      // Table name
  type: 'INSERT' | 'UPDATE' | 'DELETE';
  record: Record<string, unknown>;    // New/updated record
  old_record?: Record<string, unknown>; // Previous record (for UPDATE/DELETE)
  timestamp: string;  // ISO timestamp
}
```

### Subscription Filtering
Subscriptions can filter events using GraphQL arguments:
```graphql
subscription {
  users_update(
    where: { 
      id: { _eq: 123 },
      active: { _eq: true }
    }
  ) {
    id
    name
    email
  }
}
```

### Connection Management
WebSocket connection lifecycle:
1. **Connection**: Client establishes WebSocket
2. **Initialization**: Client sends GraphQL init message
3. **Subscription**: Client registers interest in topics
4. **Event Delivery**: Server pushes matching events
5. **Completion**: Client unsubscribes or connection closes
6. **Cleanup**: Server removes subscriptions

### Scaling Considerations
For production deployments:
1. **PubSub Scaling**: Use Redis, PostgreSQL LISTEN/NOTIFY, or cloud Pub/Sub
2. **Horizontal Scaling**: Multiple server instances sharing PubSub
3. **Message Ordering**: Consider ordering guarantees for critical updates
4. **Duplicate Detection**: Handle potential duplicate events
5. **Heartbeats**: Implement connection heartbeat mechanism

## Best Practices

### Schema Design
1. **Keep Tables Normalized**: Well-normalized schemas generate cleaner GraphQL
2. **Use Proper Constraints**: NOT NULL, UNIQUE, CHECK constraints improve generated API
3. **Document Your Schema**: Comments on tables/columns become GraphQL descriptions
4. **Consider Exposures**: Only expose tables you want in GraphQL API
5. **Use Views Judiciously**: Database views can simplify complex relationships

### Security
1. **Enable RLS**: Always enable Row Level Security for production
2. **Limit Introspection**: Consider disabling introspection in production
3. **Query Complexity**: Implement complexity limits to prevent DoS
4. **Depth Limits**: Prevent overly deep nested queries
5. **Rate Limiting**: Add rate limiting at the HTTP level
6. **Input Validation**: While GraphQL validates, validate business logic too

### Performance
1. **Database Indexes**: Index columns used in where/order_by clauses
2. **Pagination**: Use reasonable default limits (20-100 items)
3. **Batch Loading**: Enable batching for relationship resolution
4. **Caching**: Consider HTTP caching for GET requests
5. **Prepared Statements**: Generated resolvers use prepared statements
6. **Connection Pooling**: Properly configure database connection pool

### Development
1. **Use Playground**: Leverage GraphQL Playground for testing
2. **Type Generation**: Generate TypeScript types from schema for clients
3. **Mock Data**: Use fixtures for development and testing
4. **Schema Check**: Include schema checks in CI pipeline
5. **Documentation**: Export SDL for API documentation
6. **Versioning**: Consider schema versioning for breaking changes

### Deployment
1. **Environment Separation**: Use different schemas for dev/staging/prod
2. **Health Checks**: Implement GraphQL health check endpoint
3. **Logging**: Log slow queries and errors
4. **Monitoring**: Track query performance and error rates
5. **SSL/TLS**: Always use HTTPS in production
6. **CORS**: Configure CORS appropriately for your clients

## Examples

### Basic Blog Schema
```typescript
// db/schema.ts
import { pgTable, varchar, text, timestamp, boolean, integer, foreignKey } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  bio: text('bio'),
  avatarUrl: varchar('avatar_url', { length: 500 }),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
});

export const posts = pgTable('posts', {
  id: serial('id').primaryKey(),
  title: varchar('title', { length: 255 }).notNull(),
  content: text('content').notNull(),
  published: boolean('published').default(false),
  authorId: integer('author_id').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
}, (table) => [
  foreignKey({
    columns: [table.authorId],
    foreignColumns: [users.id],
    name: 'posts_author_id_fkey'
  })
]);

export const comments = pgTable('comments', {
  id: serial('id').primaryKey(),
  content: text('content').notNull(),
  postId: integer('post_id').notNull(),
  authorId: integer('author_id').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull()
}, (table) => [
  foreignKey({
    columns: [table.postId],
    foreignColumns: [posts.id],
    name: 'comments_post_id_fkey'
  }),
  foreignKey({
    columns: [table.authorId],
    foreignColumns: [users.id],
    name: 'comments_author_id_fkey'
  })
]);
```

Generated GraphQL schema includes:
- Types: `User`, `Post`, `Comment`
- Queries: `users`, `users_by_pk`, `posts`, `posts_by_pk`, `comments`, `comments_by_pk`
- Mutations: `insert_users_one`, `update_posts_by_pk`, `delete_comments`, etc.
- Subscriptions: `users_insert`, `posts_update`, `comments_delete`

### Complex Queries Example
```graphql
# Get users with their posts and comment counts
query {
  users(where: { isActive: { _eq: true } }) {
    id
    name
    email
    posts(where: { published: { _eq: true } }) {
      id
      title
      comments_aggregate {
        count
      }
    }
  }
}
```

### Mutation with Variables
```graphql
mutation CreatePost($title: String!, $content: String!, $authorId: Int!) {
  insert_posts_one(
    object: {
      title: $title
      content: $content
      authorId: $authorId
      published: true
    }
  ) {
    id
    title
    content
    author {
      id
      name
      email
    }
    createdAt
  }
}
```

### Real-time Subscription
```graphql
subscription OnNewComment {
  comments_insert(
    where: {
      post: {
        id: { _eq: 123 }
      }
    }
  ) {
    id
    content
    author {
      id
      name
    }
    post {
      id
      title
    }
    createdAt
  }
}
```

### Aggregation Query
```graphql
query PostStatistics {
  posts_aggregate {
    aggregate {
      count
      max(createdAt)
      min(createdAt)
    }
    groups {
      published
      aggregate {
        count
      }
    }
  }
}
```

## Security Considerations

### Authentication & Authorization
1. **Context-Based Auth**: Pass user info through context
2. **Resolver-Level Checks**: Check permissions in resolvers
3. **Schema-Based Hiding**: Conditionally expose fields based on roles
4. **RLS Integration**: Use database-level Row Level Security
5. **Attribute-Based Access Control**: Implement ABAC patterns

### Common Vulnerabilities
1. **GraphQL Injection**: Validate and sanitize inputs (though less common than SQLi)
2. **DoS via Complex Queries**: Implement query depth and complexity limits
3. **Batching Attacks**: Limit batch sizes in mutations
4. **Information Exposure**: Be careful with error messages in production
5. **Introspection Abuse**: Consider disabling introspection in production

### Rate Limiting Strategies
1. **IP-Based Limiting**: Limit requests per IP address
2. **Token-Based Limiting**: Limit requests per API key/user
3. **Query Cost Limiting**: Calculate and limit based on query complexity
4. **Concurrent Connection Limits**: Limit WebSocket connections per user
5. **Subscription Rate Limiting**: Limit number of active subscriptions per user

### Data Protection
1. **Field-Level Permissions**: Hide sensitive fields based on user role
2. **Data Masking**: Return masked data for PII (e.g., show only last 4 digits of SSN)
3. **Audit Logging**: Log access to sensitive data
4. **Encryption**: Ensure data encrypted at rest and in transit
5. **Backups**: Regular backups with tested restore procedures

### Production Checklist
- [ ] Enable authentication middleware
- [ ] Configure RLS policies
- [ ] Set query depth limits (suggested: 5-7)
- [ ] Set query complexity limits (suggested: 1000-5000)
- [ ] Disable introspection in production (or restrict to trusted IPs)
- [ ] Implement rate limiting
- [ ] Use HTTPS with valid certificates
- [ ] Configure proper CORS headers
- [ ] Log errors and slow queries
- [ ] Monitor error rates and performance
- [ ] Regular security audits
- [ ] Keep dependencies updated

## Related Modules
- [Auto-REST](./auto-rest.md): Alternative API generation approach (REST vs GraphQL)
- [Configuration](./config.md): For configuring GraphQL behavior
- [Realtime](./realtime.md): Underlying real-time capabilities
- [RLS](./rls.md): Row Level Security integration
- [Logger](./logger.md): Logging for GraphQL operations
- [Webhooks](./webhooks.md): Alternative to subscriptions for some use cases
- [Functions](./functions.md): For custom business logic beyond CRUD