# Feature 5: Realtime Presence & Broadcast

**Priority**: High (Week 11-12)  
**Complexity**: Medium  
**Dependencies**: Structured Logging  
**Estimated Effort**: 2-3 weeks

---

## Problem Statement

Current realtime only has database subscriptions. Apps need:
- **Presence**: Who's online (chat, collaborative editors)
- **Broadcast**: Send messages between clients (cursor positions)

---

## Solution

Channel-based presence tracking and message broadcasting:
- Join channel: `channel.subscribe({ user_id: "123" })`
- Track presence: `channel.track({ status: "online" })`
- Broadcast: `channel.broadcast("cursor_move", { x: 100, y: 200 })`
- 30-second heartbeat cleans stale connections

---

## Implementation

### Step 1: Create Channel Manager

**File**: `packages/core/src/realtime/channel-manager.ts` (NEW FILE)

```typescript
export type PresenceState = {
  user_id: string;
  online_at: string;
  [key: string]: any;
};

type Connection = {
  id: string;
  ws: WebSocket;
  user_id?: string;
  channels: Set<string>;
  presence: Map<string, PresenceState>;
};

type Channel = {
  name: string;
  connections: Set<Connection>;
  presence: Map<string, PresenceState>;
};

export class ChannelManager {
  private channels = new Map<string, Channel>();
  private connections = new Map<string, Connection>();

  registerConnection(id: string, ws: WebSocket): Connection {
    const conn: Connection = {
      id,
      ws,
      channels: new Set(),
      presence: new Map(),
    };
    this.connections.set(id, conn);
    return conn;
  }

  unregisterConnection(id: string): void {
    const conn = this.connections.get(id);
    if (!conn) return;

    for (const channelName of conn.channels) {
      this.leaveChannel(id, channelName);
    }

    this.connections.delete(id);
  }

  joinChannel(
    connId: string,
    channelName: string,
    options: { user_id?: string; presence?: Record<string, any> } = {}
  ): void {
    const conn = this.connections.get(connId);
    if (!conn) throw new Error('Connection not found');

    let channel = this.channels.get(channelName);
    if (!channel) {
      channel = {
        name: channelName,
        connections: new Set(),
        presence: new Map(),
      };
      this.channels.set(channelName, channel);
    }

    channel.connections.add(conn);
    conn.channels.add(channelName);

    if (options.user_id) {
      conn.user_id = options.user_id;
      
      const state: PresenceState = {
        user_id: options.user_id,
        online_at: new Date().toISOString(),
        ...options.presence,
      };

      channel.presence.set(options.user_id, state);
      conn.presence.set(channelName, state);

      this.broadcastToChannel(channelName, {
        type: 'presence',
        event: 'join',
        payload: state,
      }, connId);
    }

    // Send initial presence sync
    const presenceList = Array.from(channel.presence.values());
    this.sendToConnection(connId, {
      type: 'presence',
      event: 'sync',
      payload: presenceList,
    });
  }

  leaveChannel(connId: string, channelName: string): void {
    const conn = this.connections.get(connId);
    const channel = this.channels.get(channelName);
    
    if (!conn || !channel) return;

    channel.connections.delete(conn);
    conn.channels.delete(channelName);

    if (conn.user_id && channel.presence.has(conn.user_id)) {
      const state = channel.presence.get(conn.user_id)!;
      channel.presence.delete(conn.user_id);
      conn.presence.delete(channelName);

      this.broadcastToChannel(channelName, {
        type: 'presence',
        event: 'leave',
        payload: state,
      }, connId);
    }

    if (channel.connections.size === 0) {
      this.channels.delete(channelName);
    }
  }

  broadcastToChannel(
    channelName: string,
    message: any,
    excludeConnId?: string
  ): void {
    const channel = this.channels.get(channelName);
    if (!channel) return;

    const msgStr = JSON.stringify(message);

    for (const conn of channel.connections) {
      if (excludeConnId && conn.id === excludeConnId) continue;

      if (conn.ws.readyState === WebSocket.OPEN) {
        conn.ws.send(msgStr);
      }
    }
  }

  startHeartbeat(interval = 30000): NodeJS.Timeout {
    return setInterval(() => {
      for (const [id, conn] of this.connections) {
        if (conn.ws.readyState !== WebSocket.OPEN) {
          this.unregisterConnection(id);
        }
      }
    }, interval);
  }
}
```

---

### Step 2: Update Client SDK

**File**: `packages/client/src/realtime.ts`

**ADD**:

```typescript
channel(channelName: string) {
  return {
    subscribe: (options?: { user_id?: string; presence?: Record<string, any> }) => {
      this.send({
        type: 'subscribe',
        channel: channelName,
        payload: options,
      });

      return {
        unsubscribe: () => {
          this.send({ type: 'unsubscribe', channel: channelName });
        },

        broadcast: (event: string, data: any) => {
          this.send({
            type: 'broadcast',
            channel: channelName,
            payload: { event, data },
          });
        },

        track: (state: Record<string, any>) => {
          this.send({
            type: 'presence',
            channel: channelName,
            payload: { action: 'update', state },
          });
        },

        onPresence: (callback: (event: any) => void) => {
          this.on('presence', (data) => {
            if (data.channel === channelName) callback(data);
          });
        },

        onBroadcast: (callback: (event: string, data: any) => void) => {
          this.on('broadcast', (data) => {
            if (data.channel === channelName) callback(data.event, data.payload);
          });
        },
      };
    },
  };
}
```

---

## Acceptance Criteria

- [ ] Channel manager with presence tracking
- [ ] WebSocket server integration
- [ ] Client SDK: subscribe, track, broadcast, onPresence, onBroadcast
- [ ] Heartbeat cleanup (30s)
- [ ] Test: Two clients join, both receive presence sync
- [ ] Test: Client broadcasts, other receives
- [ ] Test: Client disconnects, others notified
