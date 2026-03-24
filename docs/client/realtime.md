# Realtime Client

Client-side real-time subscription management for BetterBase applications.

## Table of Contents
- [Overview](#overview)
- [Installation](#installation)
- [Usage](#usage)
- [API Reference](#api-reference)
  - [RealtimeClient](#realtimeclient)
  - [Subscription Management](#subscription-management)
  - [Event Handling](#event-handling)
- [Examples](#examples)
- [Best Practices](#best-practices)

## Overview

The RealtimeClient provides WebSocket-based real-time subscriptions for BetterBase applications. It enables live updates, presence tracking, and broadcast messaging between clients.

### Key Features
- **WebSocket Connection**: Automatic connection management with retry logic
- **Table Subscriptions**: Subscribe to database change events (INSERT, UPDATE, DELETE)
- **Channel Messaging**: Real-time messaging and presence tracking
- **Automatic Reconnection**: Robust connection recovery with backoff
- **Event Filtering**: Filter subscriptions by table and event type
- **Presence Tracking**: Track user presence in channels
- **Broadcast Messaging**: Send messages to channel subscribers

## Installation

The RealtimeClient is included with the `@betterbase/client` package:
```bash
bun add @betterbase/client
```

## Usage

### Basic Subscription
```typescript
import { RealtimeClient } from '@betterbase/client';

const client = new RealtimeClient('https://api.betterbase.dev', token);

// Subscribe to table updates
const subscription = client.from('users').on('INSERT', (payload) => {
  console.log('New user:', payload.data);
});

// Subscribe to all events
const allUpdates = client.from('posts').on('*', (payload) => {
  console.log('Post updated:', payload);
});

// Unsubscribe when done
subscription.unsubscribe();
```

### Channel Messaging
```typescript
// Join a channel
const channel = client.channel('chat-room');

// Subscribe to channel
const subscription = channel.subscribe({
  presence: { user: { id: '123', name: 'John' } }
});

// Listen for broadcast messages
channel.onBroadcast((event, data) => {
  console.log(`Received ${event}:`, data);
});

// Send a message
channel.broadcast('message', {
  text: 'Hello world!',
  user: { id: '123', name: 'John' }
});

// Update presence
channel.track({ typing: true });

// Leave channel
subscription.unsubscribe();
```

## API Reference

### RealtimeClient

```typescript
export class RealtimeClient {
  constructor(url: string, token?: string)
  
  // Table subscriptions
  from(table: string): TableSubscription
  
  // Channel management
  channel(channelName: string): Channel
  
  // Connection management
  connect(): void
  disconnect(): void
  isConnected(): boolean
  
  // Event handlers
  on(event: string, callback: (data: unknown) => void): void
  off(event: string, callback: (data: unknown) => void): void
}
```

### TableSubscription

```typescript
interface TableSubscription {
  on<T = unknown>(
    event: 'INSERT' | 'UPDATE' | 'DELETE' | '*',
    callback: (payload: RealtimePayload<T>) => void
  ): {
    subscribe: (filter?: Record<string, unknown>) => RealtimeSubscription
  }
}

interface RealtimeSubscription {
  unsubscribe: () => void
}

interface RealtimePayload<T> {
  event: 'INSERT' | 'UPDATE' | 'DELETE'
  data: T
  timestamp: string
}
```

### Channel

```typescript
interface Channel {
  subscribe(options?: ChannelOptions): ChannelSubscription
  
  onPresence(callback: (event: PresenceEvent) => void): void
  onBroadcast(callback: (event: string, data: unknown) => void): void
}

interface ChannelOptions {
  user_id?: string
  presence?: Record<string, unknown>
}

interface ChannelSubscription {
  unsubscribe: () => void
  
  // Messaging
  broadcast(event: string, data: unknown): void
  
  // Presence
  track(state: Record<string, unknown>): void
}

interface PresenceEvent {
  type: 'presence'
  event: 'join' | 'leave' | 'sync' | 'update'
  channel: string
  payload: unknown
}
```

## Examples

### Basic Table Subscription
```typescript
// Subscribe to new users
const subscription = client.from('users').on('INSERT', (payload) => {
  console.log('New user created:', payload.data);
});

// Subscribe to user deletions
client.from('users').on('DELETE', (payload) => {
  console.log('User deleted:', payload.data);
});

// Subscribe to all events
client.from('posts').on('*', (payload) => {
  console.log('Post event:', payload);
});
```

### Event Filtering
```typescript
// Subscribe to active users only
client.from('users').on('INSERT', (payload) => {
  console.log('New active user:', payload.data);
})
.subscribe({ where: { active: true } });

// Subscribe to posts by specific user
client.from('posts').on('INSERT', (payload) => {
  console.log('New post by user 123:', payload.data);
})
.subscribe({ author_id: 123 });
```

### Channel Messaging
```typescript
// Join chat room
const channel = client.channel('general-chat');

// Listen for messages
channel.onBroadcast((event, data) => {
  if (event === 'message') {
    console.log(`[${data.user.name}]: ${data.text}`);
  }
});

// Send message
channel.broadcast('message', {
  text: 'Hello everyone!',
  user: { id: '123', name: 'John' }
});

// Track typing state
channel.track({ typing: true });

// Update presence
channel.track({ typing: false });
```

### Presence Tracking
```typescript
// Join channel with presence
const channel = client.channel('game-room');

// Track presence
channel.track({
  player: { id: '123', name: 'John' },
  status: 'online'
});

// Listen for presence updates
channel.onPresence((event) => {
  if (event.event === 'join') {
    console.log('Player joined:', event.payload);
  } else if (event.event === 'leave') {
    console.log('Player left:', event.payload);
  }
});

// Clean up
channel.subscribe().unsubscribe();
```

### Connection Management
```typescript
// Check connection status
if (!client.isConnected()) {
  client.connect();
}

// Handle connection errors
client.on('error', (error) => {
  console.error('Connection error:', error);
});

// Clean up on unmount
// This is typically called in a React useEffect cleanup
client.disconnect();
```

## Best Practices

### Connection Management
1. **Automatic Reconnection**: The client handles reconnection automatically with exponential backoff
2. **Connection State**: Always check `isConnected()` before sending messages
3. **Cleanup**: Call `disconnect()` when no longer needed to prevent memory leaks
4. **Error Handling**: Listen for error events to handle connection issues

### Subscription Management
1. **Unsubscribe**: Always unsubscribe when done to prevent memory leaks
2. **Filtering**: Use filters to reduce unnecessary event processing
3. **Batching**: Consider batching updates when handling rapid-fire events
4. **Error Handling**: Gracefully handle subscription errors

### Performance Optimization
1. **Event Delegation**: Use wildcards (`*`) for multiple event types
2. **Limit Subscriptions**: Keep the number of active subscriptions reasonable
3. **Connection Sharing**: Share RealtimeClient instances when possible
4. **Event Filtering**: Use server-side filters to reduce network traffic

### Security Considerations
1. **Authentication**: Always provide valid tokens for protected channels
2. **Event Validation**: Validate incoming events before processing
3. **Rate Limiting**: Implement client-side rate limiting for event handlers
4. **Sensitive Data**: Be careful with sensitive data in presence state

### Error Handling
1. **Network Errors**: Implement retry logic for transient errors
2. **Authentication Errors**: Handle token expiration gracefully
3. **Subscription Errors**: Handle subscription failures with fallbacks
4. **Event Processing**: Handle malformed events safely

## Troubleshooting

### Common Issues

**Connection Fails**
```typescript
// Check URL format
const client = new RealtimeClient('https://api.betterbase.dev', token);

// Verify token is valid
const token = localStorage.getItem('betterbase_token');
if (!token) {
  console.error('No authentication token found');
}
```

**Subscriptions Not Working**
```typescript
// Ensure WebSocket is open
if (client.isConnected()) {
  // Subscribe again
  const subscription = client.from('users').on('INSERT', callback);
} else {
  // Wait for connection
  setTimeout(() => {
    const subscription = client.from('users').on('INSERT', callback);
  }, 1000);
}
```

**Performance Issues**
```typescript
// Limit concurrent subscriptions
const MAX_SUBSCRIPTIONS = 10;
let subscriptionCount = 0;

function subscribeSafe(table: string, event: string, callback: Function) {
  if (subscriptionCount >= MAX_SUBSCRIPTIONS) {
    console.warn('Too many subscriptions');
    return;
  }
  
  subscriptionCount++;
  const subscription = client.from(table).on(event, callback);
  
  subscription.unsubscribe = () => {
    subscription.unsubscribe();
    subscriptionCount--;
  };
  
  return subscription;
}
```

## Integration Examples

### React Integration
```typescript
import { useEffect, useState } from 'react';
import { RealtimeClient } from '@betterbase/client';

function useRealtime(table: string, event: string, callback: Function) {
  const [client, setClient] = useState<RealtimeClient | null>(null);
  
  useEffect(() => {
    const token = localStorage.getItem('betterbase_token');
    const realtimeClient = new RealtimeClient(
      process.env.NEXT_PUBLIC_API_URL!,
      token
    );
    
    setClient(realtimeClient);
    
    return () => {
      realtimeClient.disconnect();
    };
  }, []);
  
  useEffect(() => {
    if (!client) return;
    
    const subscription = client.from(table).on(event, callback);
    
    return () => {
      subscription.unsubscribe();
    };
  }, [client, table, event, callback]);
}

// Usage in component
function UserList() {
  const [users, setUsers] = useState([]);
  
  useRealtime('users', 'INSERT', (payload) => {
    setUsers(prev => [...prev, payload.data]);
  });
  
  return (
    <ul>
      {users.map(user => (
        <li key={user.id}>{user.name}</li>
      ))}
    </ul>
  );
}
```

### Vue Integration
```typescript
import { ref, onMounted, onUnmounted } from 'vue';
import { RealtimeClient } from '@betterbase/client';

export function useRealtime(table: string, event: string, callback: Function) {
  const client = ref<RealtimeClient | null>(null);
  
  onMounted(() => {
    const token = localStorage.getItem('betterbase_token');
    client.value = new RealtimeClient(
      import.meta.env.VITE_API_URL,
      token
    );
  });
  
  onUnmounted(() => {
    if (client.value) {
      client.value.disconnect();
    }
  });
  
  return {
    subscribe: () => {
      if (!client.value) return { unsubscribe: () => {} };
      
      const subscription = client.value.from(table).on(event, callback);
      return subscription;
    }
  };
}

// Usage in component
import { useRealtime } from '@/composables/useRealtime';

export default {
  setup() {
    const users = ref([]);
    
    const { subscribe } = useRealtime('users', 'INSERT', (payload) => {
      users.value.push(payload.data);
    });
    
    return {
      users,
      onMounted: () => subscribe()
    };
  }
};
```

### Node.js Integration
```typescript
import { RealtimeClient } from '@betterbase/client';

// Create client for server-side use
const client = new RealtimeClient('https://api.betterbase.dev', process.env.API_TOKEN);

// Subscribe to events
client.from('logs').on('INSERT', (payload) => {
  console.log('New log entry:', payload.data);
});

// Listen for connection
client.on('open', () => {
  console.log('Realtime connection established');
});

client.on('close', () => {
  console.log('Realtime connection closed');
});

// Keep process alive
process.on('SIGINT', () => {
  client.disconnect();
  process.exit(0);
});
```

## Configuration Options

### Connection Settings
```typescript
const client = new RealtimeClient(url, token, {
  reconnectAttempts: 5,
  reconnectDelay: 1000,
  maxReconnectDelay: 30000,
  heartbeatInterval: 30000
});
```

### Subscription Filters
```typescript
// Server-side filters
client.from('users').on('INSERT', callback)
  .subscribe({ 
    where: { 
      status: 'active',
      created_at: { $gt: new Date().toISOString() }
    }
  });

// Multiple event types
client.from('posts').on('*', callback)
  .subscribe({ 
    limit: 100,
    order_by: 'created_at'
  });
```

## Version Compatibility

### Client Requirements
- **Node.js**: 16.0+ (server-side)
- **Browser**: Chrome 60+, Firefox 55+, Safari 12+, Edge 79+
- **TypeScript**: 4.0+

### Breaking Changes
- **v2.0**: Changed event payload structure
- **v1.5**: Replaced callback-based API with promise-based
- **v1.0**: Initial release

## Migration Guide

### From v1.x to v2.x
```typescript
// Old v1.x API
client.subscribe('users', (event, data) => {
  console.log(event, data);
});

// New v2.x API
client.from('users').on('*', (payload) => {
  console.log(payload.event, payload.data);
});
```

## Support

### Documentation
- [API Reference](https://betterbase.dev/docs/client/realtime)
- [Examples](https://betterbase.dev/examples/realtime)
- [Troubleshooting Guide](https://betterbase.dev/docs/troubleshooting)

### Community
- [GitHub Discussions](https://github.com/betterbase/client/discussions)
- [Discord Community](https://discord.gg/betterbase)
- [Stack Overflow](https://stackoverflow.com/questions/tagged/betterbase)

### Reporting Issues
- [GitHub Issues](https://github.com/betterbase/client/issues)
- [Bug Report Template](https://github.com/betterbase/client/.github/ISSUE_TEMPLATE/bug_report.md)

---

## License

MIT License - see LICENSE file for details.

© 2023 BetterBase LLC.