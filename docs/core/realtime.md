# Realtime

BetterBase provides WebSocket-based realtime subscriptions for live data updates.

## Overview

The realtime module provides:
- WebSocket-based subscriptions
- Channel-based messaging
- Database change events (INSERT, UPDATE, DELETE)
- Presence tracking

## Server-Side

### Setup

```typescript
import { createRealtimeManager } from '@betterbase/core';

const realtime = createRealtimeManager();

// Subscribe to database changes
realtime.subscribe('users', (event) => {
  console.log('User changed:', event);
});

// Broadcast custom event
realtime.broadcast('channel-name', 'message', { data: 'value' });
```

### Channel Manager

```typescript
import { createChannelManager } from '@betterbase/core/realtime';

const manager = createChannelManager();

// Subscribe to channel
const sub = manager.subscribe('public:posts', (event) => {
  console.log(event);
});

// Unsubscribe
sub.unsubscribe();
```

## Client-Side

### Subscribe to Changes

```typescript
const channel = client.channel('public:posts');

channel
  .on('postgres_changes', { 
    event: 'INSERT', 
    table: 'posts' 
  }, (payload) => {
    console.log('New post:', payload.new);
  })
  .on('postgres_changes', { 
    event: 'UPDATE', 
    table: 'posts' 
  }, (payload) => {
    console.log('Updated post:', payload.new);
  })
  .on('postgres_changes', { 
    event: 'DELETE', 
    table: 'posts' 
  }, (payload) => {
    console.log('Deleted post:', payload.old);
  })
  .subscribe();
```

### Presence

```typescript
// Track presence
channel
  .on('presence', { event: 'sync' }, (state) => {
    console.log('Online users:', Object.keys(state));
  })
  .on('presence', { event: 'join' }, (state) => {
    console.log('User joined:', state);
  })
  .on('presence', { event: 'leave' }, (state) => {
    console.log('User left:', state);
  });
```

## Events

### Database Events

| Event | Description |
|-------|-------------|
| `INSERT` | New record created |
| `UPDATE` | Record updated |
| `DELETE` | Record deleted |
| `*` | All events |

### Custom Events

```typescript
// Server broadcasts
realtime.broadcast('notifications', 'alert', { message: 'New!' });

// Client listens
channel.on('broadcast', { event: 'alert' }, (payload) => {
  console.log(payload.message);
});
```

## Configuration

```typescript
import { defineConfig } from '@betterbase/core';

export default defineConfig({
  realtime: {
    enabled: true,
    // WebSocket configuration
    pingInterval: 30000,
    pingTimeout: 5000
  }
});
```

## Best Practices

1. **Subscribe Only Needed**: Subscribe to specific tables/channels
2. **Clean Up**: Unsubscribe when done
3. **Reconnect**: Handle reconnection gracefully
4. **Throttle**: Avoid rapid-fire updates

## Related

- [Overview](./overview.md) - Core package overview
- [Client Realtime](../client/realtime.md) - Client-side realtime