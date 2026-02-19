import type { ServerWebSocket } from 'bun';

export interface Subscription {
  table: string;
  filter?: Record<string, unknown>;
}

interface Client {
  ws: ServerWebSocket<unknown>;
  subscriptions: Map<string, Subscription>;
}

interface RealtimeUpdatePayload {
  type: 'update';
  table: string;
  event: 'INSERT' | 'UPDATE' | 'DELETE';
  data: unknown;
  timestamp: string;
}

const realtimeLogger = {
  debug: (message: string): void => console.debug(`[realtime] ${message}`),
  info: (message: string): void => console.info(`[realtime] ${message}`),
  warn: (message: string): void => console.warn(`[realtime] ${message}`),
};

export class RealtimeServer {
  private clients = new Map<ServerWebSocket<unknown>, Client>();
  private tableSubscribers = new Map<string, Set<ServerWebSocket<unknown>>>();

  handleConnection(ws: ServerWebSocket<unknown>): void {
    realtimeLogger.info('Client connected');
    this.clients.set(ws, {
      ws,
      subscriptions: new Map(),
    });
  }

  handleMessage(ws: ServerWebSocket<unknown>, rawMessage: string): void {
    try {
      const data = JSON.parse(rawMessage) as { type?: string; table?: string; filter?: Record<string, unknown> };

      if (!data.type || !data.table) {
        this.safeSend(ws, { error: 'Message must include type and table' });
        return;
      }

      switch (data.type) {
        case 'subscribe':
          this.subscribe(ws, data.table, data.filter);
          break;
        case 'unsubscribe':
          this.unsubscribe(ws, data.table);
          break;
        default:
          this.safeSend(ws, { error: 'Unknown message type' });
          break;
      }
    } catch {
      this.safeSend(ws, { error: 'Invalid message format' });
    }
  }

  handleClose(ws: ServerWebSocket<unknown>): void {
    realtimeLogger.info('Client disconnected');

    const client = this.clients.get(ws);
    if (client) {
      for (const table of client.subscriptions.keys()) {
        const subscribers = this.tableSubscribers.get(table);
        subscribers?.delete(ws);

        if (subscribers && subscribers.size === 0) {
          this.tableSubscribers.delete(table);
        }
      }
    }

    this.clients.delete(ws);
  }

  broadcast(table: string, event: RealtimeUpdatePayload['event'], data: unknown): void {
    const subscribers = this.tableSubscribers.get(table);
    if (!subscribers || subscribers.size === 0) {
      return;
    }

    const initialCount = subscribers.size;

    const payload: RealtimeUpdatePayload = {
      type: 'update',
      table,
      event,
      data,
      timestamp: new Date().toISOString(),
    };

    const message = JSON.stringify(payload);

    for (const ws of [...subscribers]) {
      const client = this.clients.get(ws);
      const subscription = client?.subscriptions.get(table);
      if (!this.matchesFilter(subscription?.filter, data)) {
        continue;
      }

      if (!this.safeSend(ws, message)) {
        subscribers.delete(ws);
        this.handleClose(ws);
      }
    }

    realtimeLogger.debug(`Broadcasted ${event} on ${table} to ${initialCount} clients`);
  }

  private subscribe(ws: ServerWebSocket<unknown>, table: string, filter?: Record<string, unknown>): void {
    const client = this.clients.get(ws);
    if (!client) {
      return;
    }

    client.subscriptions.set(table, { table, filter });

    if (!this.tableSubscribers.has(table)) {
      this.tableSubscribers.set(table, new Set());
    }

    this.tableSubscribers.get(table)?.add(ws);

    this.safeSend(ws, {
      type: 'subscribed',
      table,
      filter,
    });

    realtimeLogger.debug(`Client subscribed to ${table}`);
  }

  private unsubscribe(ws: ServerWebSocket<unknown>, table: string): void {
    const client = this.clients.get(ws);
    if (!client) {
      return;
    }

    client.subscriptions.delete(table);
    const subscribers = this.tableSubscribers.get(table);
    subscribers?.delete(ws);

    if (subscribers && subscribers.size === 0) {
      this.tableSubscribers.delete(table);
    }

    this.safeSend(ws, {
      type: 'unsubscribed',
      table,
    });
  }

  private matchesFilter(filter: Record<string, unknown> | undefined, payload: unknown): boolean {
    if (!filter || Object.keys(filter).length === 0) {
      return true;
    }

    if (!payload || typeof payload !== 'object') {
      return false;
    }

    const data = payload as Record<string, unknown>;
    return Object.entries(filter).every(([key, value]) => data[key] === value);
  }

  private safeSend(ws: ServerWebSocket<unknown>, payload: object | string): boolean {
    if (ws.readyState !== WebSocket.OPEN) {
      return false;
    }

    try {
      ws.send(typeof payload === 'string' ? payload : JSON.stringify(payload));
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      realtimeLogger.warn(`WebSocket send failed: ${message}`);
      return false;
    }
  }
}

export const realtime = new RealtimeServer();
