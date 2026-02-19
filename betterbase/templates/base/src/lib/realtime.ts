import type { ServerWebSocket } from 'bun';

export interface Subscription {
  table: string;
  filter?: Record<string, unknown>;
}

interface Client {
  ws: ServerWebSocket<unknown>;
  subscriptions: Set<string>;
}

interface RealtimeUpdatePayload {
  type: 'update';
  table: string;
  event: 'INSERT' | 'UPDATE' | 'DELETE';
  data: unknown;
  timestamp: string;
}

export class RealtimeServer {
  private clients = new Map<ServerWebSocket<unknown>, Client>();
  private tableSubscribers = new Map<string, Set<ServerWebSocket<unknown>>>();

  handleConnection(ws: ServerWebSocket<unknown>): void {
    console.log('Client connected');
    this.clients.set(ws, {
      ws,
      subscriptions: new Set(),
    });
  }

  handleMessage(ws: ServerWebSocket<unknown>, rawMessage: string): void {
    try {
      const data = JSON.parse(rawMessage) as { type?: string; table?: string; filter?: Record<string, unknown> };

      if (!data.type || !data.table) {
        ws.send(JSON.stringify({ error: 'Message must include type and table' }));
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
          ws.send(JSON.stringify({ error: 'Unknown message type' }));
          break;
      }
    } catch {
      ws.send(JSON.stringify({ error: 'Invalid message format' }));
    }
  }

  handleClose(ws: ServerWebSocket<unknown>): void {
    console.log('Client disconnected');

    const client = this.clients.get(ws);
    if (client) {
      for (const table of client.subscriptions) {
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

    const payload: RealtimeUpdatePayload = {
      type: 'update',
      table,
      event,
      data,
      timestamp: new Date().toISOString(),
    };

    const message = JSON.stringify(payload);

    for (const ws of subscribers) {
      try {
        ws.send(message);
      } catch {
        this.handleClose(ws);
      }
    }

    console.log(`Broadcasted ${event} on ${table} to ${subscribers.size} clients`);
  }

  private subscribe(ws: ServerWebSocket<unknown>, table: string, filter?: Record<string, unknown>): void {
    const client = this.clients.get(ws);
    if (!client) {
      return;
    }

    client.subscriptions.add(table);

    if (!this.tableSubscribers.has(table)) {
      this.tableSubscribers.set(table, new Set());
    }

    this.tableSubscribers.get(table)?.add(ws);

    ws.send(
      JSON.stringify({
        type: 'subscribed',
        table,
        filter,
      }),
    );

    console.log(`Client subscribed to ${table}`);
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

    ws.send(
      JSON.stringify({
        type: 'unsubscribed',
        table,
      }),
    );
  }
}

export const realtime = new RealtimeServer();
