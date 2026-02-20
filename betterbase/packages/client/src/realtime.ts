import type { RealtimeCallback, RealtimeSubscription } from './types';

type RealtimeEvent = 'INSERT' | 'UPDATE' | 'DELETE' | '*';

export class RealtimeClient {
  private ws: WebSocket | null = null;
  private subscriptions = new Map<string, Set<RealtimeCallback>>();
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
      for (const table of this.subscriptions.keys()) {
        this.sendSubscribe(table);
      }
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data as string);
        if (data.type !== 'update') return;

        const callbacks = this.subscriptions.get(data.table);
        if (callbacks) {
          for (const callback of callbacks) {
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

          if (!this.subscriptions.has(table)) {
            this.subscriptions.set(table, new Set());
          }

          this.subscriptions.get(table)?.add(wrappedCallback);
          this.sendSubscribe(table, filter);

          return {
            unsubscribe: () => {
              const callbacks = this.subscriptions.get(table);
              callbacks?.delete(wrappedCallback);

              if (callbacks && callbacks.size === 0) {
                this.subscriptions.delete(table);
                this.sendUnsubscribe(table);

                if (this.subscriptions.size === 0) {
                  this.disconnect();
                }
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
