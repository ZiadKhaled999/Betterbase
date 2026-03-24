# GraphQL API

Complete reference for the BetterBase GraphQL API.

## Endpoint

```
POST /graphql
```

For GET requests:
```
GET /graphql?query={...}&variables={...}
```

## Playground

Access GraphQL Playground at:
```
http://localhost:3000/graphql
```

## Schema Introspection

```graphql
query {
  __schema {
    types {
      name
      kind
      fields {
        name
        type {
          name
          kind
        }
      }
    }
  }
}
```

## Queries

### Fetch Records

```graphql
query GetUsers {
  users {
    id
    name
    email
    createdAt
  }
}
```

### With Filtering

```graphql
query GetPublishedPosts {
  posts(where: { published: { _eq: true } }) {
    id
    title
    content
    author {
      name
    }
  }
}
```

### With Pagination

```graphql
query GetPaginatedPosts {
  posts(offset: 0, limit: 10, order_by: { createdAt: desc }) {
    id
    title
    createdAt
  }
}
```

### Single Record by PK

```graphql
query GetUserById {
  users_by_pk(id: "user-123") {
    id
    name
    email
  }
}
```

### Aggregate

```graphql
query GetPostStats {
  posts_aggregate(where: { published: { _eq: true } }) {
    aggregate {
      count
      sum {
        viewCount
      }
      avg {
        viewCount
      }
      max {
        createdAt
      }
      min {
        createdAt
      }
    }
  }
}
```

## Mutations

### Insert Single

```graphql
mutation CreateUser {
  insert_users_one(object: { name: "John", email: "john@example.com" }) {
    id
    name
    email
  }
}
```

### Insert Multiple

```graphql
mutation CreateUsers {
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
```

### Update by PK

```graphql
mutation UpdateUser {
  update_users_by_pk(
    pk_columns: { id: "user-123" }
    _set: { name: "John Updated" }
  ) {
    id
    name
    updatedAt
  }
}
```

### Update Multiple

```graphql
mutation UpdatePosts {
  update_posts(
    where: { published: { _eq: false } }
    _set: { published: true }
  ) {
    returning {
      id
      title
      published
    }
  }
}
```

### Delete by PK

```graphql
mutation DeleteUser {
  delete_users_by_pk(pk_columns: { id: "user-123" }) {
    id
    name
  }
}
```

### Delete Multiple

```graphql
mutation DeletePosts {
  delete_posts(
    where: { createdAt: { _lt: "2024-01-01" } }
  ) {
    returning {
      id
      title
    }
  }
}
```

## Subscriptions

### Subscribe to Insert

```graphql
subscription OnNewUser {
  users_insert {
    id
    name
    email
    createdAt
  }
}
```

### Subscribe to Update

```graphql
subscription OnUserUpdate {
  users_update {
    id
    old {
      name
    }
    new {
      name
    }
  }
}
```

### Subscribe to Delete

```graphql
subscription OnUserDelete {
  users_delete {
    id
    name
  }
}
```

### With Filtering

```graphql
subscription OnPublishedPost {
  posts_insert(where: { published: { _eq: true } }) {
    id
    title
    author {
      name
    }
  }
}
```

## Input Types

### Where Conditions

```graphql
# Boolean
where: { published: { _eq: true } }

# String
where: { name: { _eq: "John" } }

# Number
where: { age: { _gt: 18 } }

# Array
where: { role: { _in: ["admin", "moderator"] } }

# Null check
where: { deletedAt: { _is_null: true } }

# Multiple conditions
where: {
  _and: [
    { published: { _eq: true } }
    { authorId: { _eq: "user-123" } }
  ]
}

# Or
where: {
  _or: [
    { status: { _eq: "active" } }
    { status: { _eq: "pending" } }
  ]
}
```

### Order By

```graphql
order_by: { createdAt: desc }
order_by: { title: asc, createdAt: desc }
```

### Boolean Expression Operators

| Operator | Description |
|----------|-------------|
| `_eq` | Equals |
| `_neq` | Not equals |
| `_gt` | Greater than |
| `_gte` | Greater or equal |
| `_lt` | Less than |
| `_lte` | Less or equal |
| `_like` | Like pattern |
| `_ilike` | Case-insensitive like |
| `_in` | In array |
| `_is_null` | Is null |
| `_and` | And |
| `_or` | Or |

## Fragments

```graphql
fragment UserFields on users {
  id
  name
  email
  createdAt
}

query GetUsers {
  users {
    ...UserFields
    posts {
      id
      title
    }
  }
}
```

## Variables

```graphql
query GetUser($id: uuid!) {
  users_by_pk(id: $id) {
    id
    name
    email
  }
}
```

Variables:
```json
{
  "id": "user-123"
}
```

## Aliases

```graphql
query GetData {
  activeUsers: users(where: { active: { _eq: true } }) {
    id
    name
  }
  inactiveUsers: users(where: { active: { _eq: false } }) {
    id
    name
  }
}
```

## Directives

```graphql
query GetUser($includePosts: Boolean!) {
  users_by_pk(id: "user-123") {
    id
    name
    posts @include(if: $includePosts) {
      id
      title
    }
  }
}
```

Built-in directives:
- `@include(if: Boolean)`
- `@skip(if: Boolean)`

## Error Response

```json
{
  "errors": [
    {
      "message": "Field 'users' doesn't exist on type 'query_root'",
      "locations": [{ "line": 2, "column": 3 }],
      "path": ["query", "users"]
    }
  ]
}
```

## Performance

### Query Complexity

Set complexity limits:

```typescript
export default defineConfig({
  graphql: {
    complexityLimit: 1000,
    depthLimit: 7
  }
})
```

### Batching

Queries are automatically batched for efficiency.

## Related

- [REST API](./rest-api.md) - REST API reference
- [Client SDK](./client-sdk.md) - Using GraphQL from client
- [GraphQL Feature](../features/graphql.md) - GraphQL features
