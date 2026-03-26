# Client SDK

The BetterBase client SDK (`@betterbase/client`) provides TypeScript bindings for frontend integration.

## Overview

The client SDK includes:
- **Auth**: Authentication and session management
- **Query Builder**: Chainable database queries
- **Realtime**: WebSocket subscriptions
- **Storage**: File upload/download operations
- **Errors**: Client-side error classes

## Installation

```bash
bun add @betterbase/client
```

## Quick Start

```typescript
import { createClient } from '@betterbase/client';

const client = createClient({
  baseUrl: 'http://localhost:3000',
  auth: {
    persistSession: true,
    autoRefreshToken: true
  }
});
```

## Authentication

### Sign Up

```typescript
const { data, error } = await client.auth.signUp({
  email: 'user@example.com',
  password: 'secure-password',
  name: 'John Doe'
});
```

### Sign In

```typescript
const { data, error } = await client.auth.signInWithPassword({
  email: 'user@example.com',
  password: 'secure-password'
});
```

### OAuth

```typescript
const { data, error } = await client.auth.signInWithOAuth({
  provider: 'github'
});
```

## Query Builder

### Select

```typescript
const { data, error } = await client
  .from('posts')
  .select()
  .eq('published', true)
  .order('createdAt', { ascending: false })
  .limit(10);
```

### Insert

```typescript
const { data, error } = await client
  .from('posts')
  .insert({
    title: 'New Post',
    content: 'Content here',
    authorId: 'user-123'
  });
```

### Update

```typescript
const { data, error } = await client
  .from('posts')
  .update({ title: 'Updated Title' })
  .eq('id', 'post-123');
```

### Delete

```typescript
const { data, error } = await client
  .from('posts')
  .delete()
  .eq('id', 'post-123');
```

## Realtime

Subscribe to database changes:

```typescript
const channel = client.channel('public:posts');

channel
  .on('postgres_changes', { event: 'INSERT', table: 'posts' }, 
    (payload) => {
      console.log('New post:', payload.new);
    }
  )
  .subscribe();
```

## Storage

### Upload

```typescript
const { data, error } = await client.storage
  .upload('avatars', 'user-avatar.png', file);
```

### Download

```typescript
const { data, error } = await client.storage
  .download('avatars', 'user-avatar.png');
```

### Public URL

```typescript
const { data: { url } } = client.storage
  .getPublicUrl('avatars', 'user-avatar.png');
```

## Configuration

```typescript
const client = createClient({
  baseUrl: 'http://localhost:3000',
  auth: {
    persistSession: true,
    autoRefreshToken: true
  },
  storage: {
    bucket: 'default'
  },
  realtime: {
    reconnect: true,
    reconnectInterval: 5000
  }
});
```

## Related

- [Client Realtime](./realtime.md) - Realtime subscriptions
- [CLI Overview](../cli/overview.md) - CLI reference
- [Core Overview](../core/overview.md) - Core package