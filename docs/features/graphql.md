# GraphQL

BetterBase provides automatic GraphQL API generation from your Drizzle ORM schema, including queries, mutations, and subscriptions.

## Features

- **Auto-Generated Schema** - GraphQL types from database schema
- **Queries** - List, filter, paginate records
- **Mutations** - Create, update, delete operations
- **Subscriptions** - Real-time updates via WebSocket
- **Aggregations** - Count, sum, average operations
- **Relationships** - Auto-detect foreign key relations

## Quick Setup

Enable GraphQL in configuration:

```typescript
// betterbase.config.ts
export default defineConfig({
  graphql: {
    enabled: true,
    playground: process.env.NODE_ENV !== 'production'
  }
})
```

Access the GraphQL playground at `http://localhost:3000/graphql`

## Generated API

Given a schema with `users` and `posts` tables, BetterBase generates:

### Queries

```graphql
# List all users with pagination
query {
  users(offset: 0, limit: 20, order_by: { createdAt: desc }) {
    id
    name
    email
    posts {
      id
      title
    }
  }
}

# Get single user by primary key
query {
  users_by_pk(id: "user-123") {
    id
    name
    email
  }
}

# Aggregate queries
query {
  users_aggregate {
    aggregate {
      count
    }
  }
}
```

### Mutations

```graphql
# Insert single record
mutation {
  insert_users_one(object: { name: "John", email: "john@example.com" }) {
    id
    name
    email
  }
}

# Insert multiple records
mutation {
  insert_users(objects: [
    { name: "Alice", email: "alice@example.com" },
    { name: "Bob", email: "bob@example.com" }
  ]) {
    returning {
      id
      name
    }
  }
}

# Update by primary key
mutation {
  update_users_by_pk(
    pk_columns: { id: "user-123" }
    _set: { name: "John Updated" }
  ) {
    id
    name
  }
}

# Delete by primary key
mutation {
  delete_users_by_pk(pk_columns: { id: "user-123" }) {
    id
    name
  }
}
```

### Subscriptions

```graphql
# Subscribe to new records
subscription {
  users_insert(where: { active: { _eq: true } }) {
    id
    name
    email
  }
}

# Subscribe to updates
subscription {
  users_update {
    id
    name
    old { name }
    new { name }
  }
}

# Subscribe to deletes
subscription {
  users_delete {
    id
    name
  }
}
```

## Filtering

All list queries support filtering:

```graphql
query {
  posts(
    where: { 
      published: { _eq: true },
      title: { _like: "%tutorial%" }
    }
  ) {
    id
    title
  }
}
```

### Operators

| Operator | Description |
|----------|-------------|
| `_eq` | Equals |
| `_neq` | Not equals |
| `_gt` | Greater than |
| `_gte` | Greater or equal |
| `_lt` | Less than |
| `_lte` | Less or equal |
| `_like` | Pattern match |
| `_ilike` | Case-insensitive match |
| `_in` | In array |
| `_is_null` | Is null |

## Ordering

```graphql
query {
  posts(order_by: { createdAt: desc, title: asc }) {
    id
    title
    createdAt
  }
}
```

## Pagination

```graphql
query {
  posts(offset: 20, limit: 10) {
    id
    title
  }
}
```

## Relationships

Foreign keys automatically create relationship fields:

```graphql
query {
  users {
    id
    name
    posts(where: { published: { _eq: true } }) {
      id
      title
    }
  }
}
```

## Aggregations

```graphql
query {
  posts_aggregate(where: { published: { _eq: true } }) {
    aggregate {
      count
      sum { viewCount }
      avg { viewCount }
      max { createdAt }
      min { createdAt }
    }
  }
}
```

## Using the Client SDK

```typescript
import { createClient } from '@betterbase/client'

const client = createClient({ url: 'http://localhost:3000' })

// Execute GraphQL query
const { data, error } = await client.graphql.query(`
  query GetUsers {
    users {
      id
      name
      email
    }
  }
`)

// Execute mutation
const { data, error } = await client.graphql.mutation(`
  mutation CreateUser($name: String!, $email: String!) {
    insert_users_one(object: { name: $name, email: $email }) {
      id
      name
    }
  }
`, { name: 'John', email: 'john@example.com' })
```

## Programmatic Usage

```typescript
import { 
  generateGraphQLSchema, 
  generateResolvers,
  createGraphQLServer 
} from '@betterbase/core/graphql'
import * as schema from './db/schema'

// Generate schema
const typeDefs = generateGraphQLSchema(schema)

// Generate resolvers
const resolvers = generateResolvers(schema)

// Create server
const graphqlServer = createGraphQLServer({
  schema: typeDefs,
  resolvers,
  context: async (c) => ({ db, user: c.get('user') })
})

// Mount in Hono
app.route('/graphql', graphqlServer)
```

## SDL Export

Export schema for federation or documentation:

```typescript
import { exportSDL } from '@betterbase/core/graphql'

const sdl = exportSDL(typeDefs)
console.log(sdl)
```

## Security

1. **Enable RLS** - Always enable Row Level Security
2. **Limit introspection** - Disable in production if needed
3. **Query complexity** - Set complexity limits
4. **Depth limits** - Prevent deeply nested queries
5. **Rate limiting** - Add HTTP-level rate limiting

## Best Practices

1. **Use proper indexes** - Index filtered columns
2. **Limit results** - Use pagination
3. **Filter at query level** - Reduce data transfer
4. **Cache responses** - Consider HTTP caching
5. **Monitor queries** - Track slow queries

## Related

- [Database](./database.md) - Schema definition
- [Realtime](./realtime.md) - Real-time subscriptions
- [Client SDK](../api-reference/client-sdk.md) - Client GraphQL API
