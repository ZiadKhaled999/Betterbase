# Realtime

BetterBase provides real-time subscriptions via WebSockets, allowing clients to receive live updates when database records change.

## Features

- **WebSocket Subscriptions** - Live database change events
- **Postgres Changes** - Listen to INSERT, UPDATE, DELETE events
- **Presence** - Track user presence in applications
- **Broadcast** - Send arbitrary messages to connected clients
- **RLS Integration** - Respect row-level security in subscriptions

## Quick Setup

Enable realtime in configuration:

```typescript
// betterbase.config.ts
export default defineConfig({
  realtime: {
    enabled: true,
    tables: ['posts', 'comments']
  }
})
```

## Using the Client SDK

### Subscribe to Changes

```typescript
import { createClient } from '@betterbase/client'

const client = createClient({ url: 'http://localhost:3000' })

// Subscribe to all changes on a table
const channel = client.channel('public:posts')

channel
  .on('postgres_changes', { event: 'INSERT', table: 'posts' }, 
    (payload) => {
      console.log('New post:', payload.new)
    }
  )
  .on('postgres_changes', { event: 'UPDATE', table: 'posts' },
    (payload) => {
      console.log('Updated post:', payload.new)
    }
  )
  .on('postgres_changes', { event: 'DELETE', table: 'posts' },
    (payload) => {
      console.log('Deleted post:', payload.old)
    }
  )
  .subscribe()

// Unsubscribe when done
channel.unsubscribe()
```

### Subscribe to Specific Rows

```typescript
// Subscribe to changes for a specific user
const channel = client.channel('user-updates')

channel
  .on('postgres_changes', { 
    event: '*', 
    table: 'posts',
    schema: 'public',
    filter: 'userId=eq.user-123'
  }, (payload) => {
    console.log('User post changed:', payload)
  })
  .subscribe()
```

### Filter Syntax

| Filter | Description |
|--------|-------------|
| `column=eq.value` | Equals |
| `column=neq.value` | Not equals |
| `column=gt.value` | Greater than |
| `column=gte.value` | Greater or equal |
| `column=lt.value` | Less than |
| `column=lte.value` | Less or equal |
| `column=like.pattern` | Pattern match |
| `column=in.(a,b,c)` | In array |

## Presence

Track which users are online:

```typescript
// Track presence
const channel = client.channel('room-1')

// Show who's online
channel.track({
  user_id: 'user-123',
  user_name: 'John',
  online_at: new Date().toISOString()
})

// Listen for presence changes
channel.on('presence', { event: 'sync' }, () => {
  const state = channel.presenceState()
  console.log('Online users:', state)
})

channel.on('presence', { event: 'join' }, ({ key, newPresences }) => {
  console.log('User joined:', newPresences)
})

channel.on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
  console.log('User left:', leftPresences)
})

channel.subscribe()
```

## Broadcast

Send arbitrary messages:

```typescript
// Send a broadcast message
channel.send({
  type: 'broadcast',
  event: 'typing',
  payload: { userId: 'user-123', isTyping: true }
})

// Receive broadcasts
channel.on('broadcast', { event: 'typing' }, (payload) => {
  console.log('User typing:', payload)
})
```

## Server-Side Publishing

Publish events from your server:

```typescript
import { pubsub } from '@betterbase/core/realtime'

// Publish to a channel
await pubsub.publish('notifications', {
  type: 'new_message',
  data: { message: 'Hello!' }
})

// Listen for database changes
import { bridgeRealtimeToGraphQL } from '@betterbase/core/graphql'

const bridge = bridgeRealtimeToGraphQL({
  db,
  pubsub,
  schema
})

bridge.start()
```

## Real-time with GraphQL

Combine realtime with GraphQL subscriptions:

```graphql
subscription OnPostUpdate($postId: Int!) {
  posts_update(
    where: { id: { _eq: $postId } }
  ) {
    id
    title
    content
    updatedAt
  }
}
```

## Configuration

```typescript
// betterbase.config.ts
export default defineConfig({
  realtime: {
    enabled: true,
    tables: ['posts', 'comments', 'users'],
    events: ['INSERT', 'UPDATE', 'DELETE'],
    // Per-table config
    tableConfig: {
      posts: {
        enablePresence: true,
        enableBroadcast: true
      }
    }
  }
})
```

## Connection Handling

```typescript
// Check connection status
const channel = client.channel('test')

channel.on('status', (status) => {
  if (status === 'connected') {
    console.log('Connected to realtime')
  } else if (status === 'disconnected') {
    console.log('Disconnected')
  } else if (status === 'closing') {
    console.log('Connection closing')
  }
})

channel.subscribe()
```

## Error Handling

```typescript
const channel = client.channel('test')

try {
  await channel.subscribe()
} catch (error) {
  console.error('Subscription failed:', error)
}
```

## Best Practices

1. **Subscribe to specific events** - Don't subscribe to all changes
2. **Use filters** - Filter at subscription level for efficiency
3. **Clean up subscriptions** - Unsubscribe when done
4. **Handle reconnection** - Implement reconnection logic
5. **Throttle updates** - Consider debouncing rapid updates

## Related

- [Client SDK](../api-reference/client-sdk.md) - Realtime API
- [GraphQL](./graphql.md) - GraphQL subscriptions
- [Database](./database.md) - Database changes
