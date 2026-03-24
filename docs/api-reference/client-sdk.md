# Client SDK

The @betterbase/client package provides a TypeScript SDK for interacting with BetterBase backends.

## Installation

```bash
bun add @betterbase/client
```

## Quick Setup

```typescript
import { createClient } from '@betterbase/client'

const client = createClient({
  url: 'http://localhost:3000',
  auth: {
    persistSession: true,
    autoRefreshToken: true
  }
})
```

## Configuration

```typescript
interface ClientOptions {
  url: string
  auth?: {
    persistSession?: boolean
    autoRefreshToken?: boolean
  }
  storage?: {
    type?: 'local' | 'session'
  }
}
```

## Authentication

### signUp

```typescript
const { data, error } = await client.auth.signUp({
  email: string,
  password: string,
  name?: string
})
```

### signInWithPassword

```typescript
const { data, error } = await client.auth.signInWithPassword({
  email: string,
  password: string
})
```

### signInWithOAuth

```typescript
const { data, error } = await client.auth.signInWithOAuth({
  provider: 'github' | 'google' | 'discord'
})
```

### signOut

```typescript
await client.auth.signOut()
```

### getUser

```typescript
const { data, error } = await client.auth.getUser()
```

### getSession

```typescript
const { data, error } = await client.auth.getSession()
```

## Database Operations

### select

```typescript
// Get all records
const { data, error } = await client
  .from('users')
  .select()

// Select specific columns
const { data, error } = await client
  .from('users')
  .select('id, name, email')

// With filters
const { data, error } = await client
  .from('posts')
  .select()
  .eq('published', true)
  .order('createdAt', { ascending: false })
  .limit(10)
```

### insert

```typescript
const { data, error } = await client
  .from('users')
  .insert({
    name: 'John Doe',
    email: 'john@example.com'
  })
```

### update

```typescript
const { data, error } = await client
  .from('users')
  .update({ name: 'Jane Doe' })
  .eq('id', 'user-123')
```

### delete

```typescript
const { data, error } = await client
  .from('users')
  .delete()
  .eq('id', 'user-123')
```

## Query Builder Methods

| Method | Description |
|--------|-------------|
| `.select(columns?)` | Select columns to return |
| `.eq(column, value)` | Filter by equality |
| `.neq(column, value)` | Filter by inequality |
| `.gt(column, value)` | Greater than |
| `.gte(column, value)` | Greater or equal |
| `.lt(column, value)` | Less than |
| `.lte(column, value)` | Less or equal |
| `.like(column, pattern)` | Pattern match |
| `.in(column, array)` | In array |
| `.order(column, options)` | Sort results |
| `.limit(count)` | Limit results |
| `.offset(count)` | Offset results |
| `.single()` | Return single record |

## Realtime

### Subscribe

```typescript
const channel = client.channel('public:posts')

channel
  .on('postgres_changes', 
    { event: 'INSERT', table: 'posts' },
    (payload) => console.log('New post:', payload.new)
  )
  .subscribe()
```

### Channel Events

```typescript
channel.on('status', (status) => {
  console.log('Connection status:', status)
})
```

### Unsubscribe

```typescript
channel.unsubscribe()
```

## Storage

### upload

```typescript
const { data, error } = await client.storage.upload(
  bucket: string,
  path: string,
  file: File | Blob
)
```

### download

```typescript
const { data, error } = await client.storage.download(
  bucket: string,
  path: string
)
```

### remove

```typescript
const { data, error } = await client.storage.remove(
  bucket: string,
  path: string
)
```

### getPublicUrl

```typescript
const { data: { url } } = client.storage.getPublicUrl(
  bucket: string,
  path: string
)
```

### list

```typescript
const { data, error } = await client.storage.list(bucket: string)
```

## GraphQL

### query

```typescript
const { data, error } = await client.graphql.query(`
  query GetUsers {
    users {
      id
      name
      email
    }
  }
`)
```

### mutation

```typescript
const { data, error } = await client.graphql.mutation(`
  mutation CreateUser($name: String!, $email: String!) {
    insert_users_one(object: { name: $name, email: $email }) {
      id
      name
    }
  }
`, { name: 'John', email: 'john@example.com' })
```

## Error Handling

```typescript
const { data, error } = await client.from('users').select()

if (error) {
  console.error('Error:', error.message)
  console.error('Code:', error.code)
  return
}

console.log('Data:', data)
```

## Error Types

| Error Code | Description |
|------------|-------------|
| `PGRST116` | Record not found |
| `23505` | Unique constraint violation |
| `42501` | Permission denied |
| `AUTH_REQUIRED` | Authentication required |

## TypeScript Types

```typescript
import type {
  User,
  Session,
  Post,
  StorageResult,
  RealtimeChannel
} from '@betterbase/client'
```

## Best Practices

1. **Use persistSession** - Keep user logged in across page reloads
2. **Handle errors** - Always check error before processing data
3. **Type your data** - Use TypeScript types for better DX
4. **Clean up subscriptions** - Unsubscribe when done

## Related

- [Authentication](../features/authentication.md) - Auth features
- [Realtime](../features/realtime.md) - Real-time subscriptions
- [Storage](../features/storage.md) - File storage
- [GraphQL](../features/graphql.md) - GraphQL API
