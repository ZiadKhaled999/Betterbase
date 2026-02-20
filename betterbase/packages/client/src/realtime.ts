import type { RealtimeCallback, RealtimeSubscription } from './types';

type RealtimeEvent = 'INSERT' | 'UPDATE' | 'DELETE' | '*';

interface TableSubscription {
  callbacks: Set<RealtimeCallback>;
  filter?: Record<string, unknown>;
  refCount: number;
}

export class RealtimeClient {
  private ws: WebSocket | null = null;
  private subscriptions = new Map<string, TableSubscription>();
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  constructor(private url: string) {}

  private connect(): void {
    if (typeof WebSocket === 'undefined') {
      return;
    }

    if (this.ws?.readyState === WebSocket.OPEN || this.ws?.readyState === WebSocket.CONNECTING) {
      return;
    }

    const wsUrl = this.url.replace(/^http/, 'ws') + '/ws';

    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      for (const [table, subscription] of this.subscriptions.entries()) {
        this.sendSubscribe(table, subscription.filter);
      }
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data as string);
        if (data.type !== 'update') return;

        const subscription = this.subscriptions.get(data.table);
        if (subscription) {
          for (const callback of subscription.callbacks) {
            callback({ event: data.event, data: data.data, timestamp: data.timestamp });
          }
        }
      } catch {
        // noop
      }
    };

    this.ws.onclose = () => {
      this.ws = null;
      if (this.reconnectAttempts < this.maxReconnectAttempts && this.subscriptions.size > 0) {
        const delay = Math.min(1000 * 2 ** this.reconnectAttempts, 10000);
        this.reconnectTimeout = setTimeout(() => {
          this.reconnectAttempts++;
          this.connect();
        }, delay);
      }
    };
  }

  private sendSubscribe(table: string, filter?: Record<string, unknown>): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'subscribe', table, filter }));
    }
  }

  private sendUnsubscribe(table: string): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'unsubscribe', table }));
    }
  }

  from(table: string): {
    on: <T = unknown>(event: RealtimeEvent, callback: RealtimeCallback<T>) => {
      subscribe: (filter?: Record<string, unknown>) => RealtimeSubscription;
    };
  } {
    return {
      on: (event, callback) => ({
        subscribe: (filter) => {
          this.connect();

          const wrappedCallback: RealtimeCallback = (payload) => {
            if (event === '*' || payload.event === event) {
              callback(payload as Parameters<typeof callback>[0]);
            }
          };

          const subscription = this.subscriptions.get(table) ?? {
            callbacks: new Set<RealtimeCallback>(),
            refCount: 0,
            filter,
          };

          subscription.callbacks.add(wrappedCallback);
          subscription.refCount += 1;

          if (filter !== undefined) {
            subscription.filter = filter;
          }

          this.subscriptions.set(table, subscription);
          this.sendSubscribe(table, subscription.filter);

          return {
            unsubscribe: () => {
              const current = this.subscriptions.get(table);
              if (!current) {
                return;
              }

              current.callbacks.delete(wrappedCallback);
              current.refCount = Math.max(0, current.refCount - 1);

              if (current.refCount === 0 || current.callbacks.size === 0) {
                this.subscriptions.delete(table);
                this.sendUnsubscribe(table);

                if (this.subscriptions.size === 0) {
                  this.disconnect();
                }
              } else {
                this.subscriptions.set(table, current);
              }
            },
          };
        },
      }),
    };
  }

  disconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    this.ws?.close();
    this.ws = null;
    this.subscriptions.clear();
    this.reconnectAttempts = 0;
  }
}
