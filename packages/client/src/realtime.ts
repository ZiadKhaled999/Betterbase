import type { RealtimeCallback, RealtimeSubscription } from "./types";

type RealtimeEvent = "INSERT" | "UPDATE" | "DELETE" | "*";

interface SubscriberEntry {
	callback: RealtimeCallback;
	event: RealtimeEvent;
	filter?: Record<string, unknown>;
}

export class RealtimeClient {
	private ws: WebSocket | null = null;
	private subscriptions = new Map<string, Map<string, SubscriberEntry>>();
	private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
	private reconnectAttempts = 0;
	private maxReconnectAttempts = 5;
	private subscriberSequence = 0;
	private disabled = false;
	private token: string | null;

	constructor(
		private url: string,
		token: string | null = null,
	) {
		this.token = token;
	}

	setToken(token: string | null): void {
		this.token = token;
	}

	private scheduleReconnect(): void {
		if (this.disabled || this.reconnectTimeout || this.subscriptions.size === 0) {
			return;
		}

		if (this.reconnectAttempts >= this.maxReconnectAttempts) {
			return;
		}

		const delay = Math.min(1000 * 2 ** this.reconnectAttempts, 10000);
		this.reconnectTimeout = setTimeout(() => {
			this.reconnectTimeout = null;
			this.reconnectAttempts += 1;
			this.connect();
		}, delay);
	}

	private sendSubscribe(table: string, filter?: Record<string, unknown>): void {
		if (this.disabled) return;
		if (this.ws?.readyState === WebSocket.OPEN) {
			this.ws.send(JSON.stringify({ type: "subscribe", table, filter }));
		}
	}

	private sendUnsubscribe(table: string): void {
		if (this.disabled) return;
		if (this.ws?.readyState === WebSocket.OPEN) {
			this.ws.send(JSON.stringify({ type: "unsubscribe", table }));
		}
	}

	private sendSubscribeAll(table: string): void {
		const tableSubscribers = this.subscriptions.get(table);
		if (!tableSubscribers || tableSubscribers.size === 0) {
			return;
		}

		for (const subscriber of tableSubscribers.values()) {
			this.sendSubscribe(table, subscriber.filter);
		}
	}

	private connect(): void {
		if (typeof WebSocket === "undefined") {
			this.disabled = true;
			console.warn(
				"[BetterBase] WebSocket is not available in this environment; realtime disabled",
			);
			return;
		}

		if (this.ws?.readyState === WebSocket.OPEN || this.ws?.readyState === WebSocket.CONNECTING) {
			return;
		}

		const baseUrl = `${this.url.replace(/^http/, "ws")}/ws`;
		const wsUrl = this.token ? `${baseUrl}?token=${encodeURIComponent(this.token)}` : baseUrl;
		this.ws = new WebSocket(wsUrl);

		this.ws.onopen = () => {
			this.reconnectAttempts = 0;
			if (this.reconnectTimeout) {
				clearTimeout(this.reconnectTimeout);
				this.reconnectTimeout = null;
			}

			for (const table of this.subscriptions.keys()) {
				this.sendSubscribeAll(table);
			}
		};

		this.ws.onmessage = (event) => {
			try {
				const data = JSON.parse(event.data as string);
				if (data.type !== "update") return;

				const tableSubscribers = this.subscriptions.get(data.table);
				if (!tableSubscribers) {
					return;
				}

				for (const subscriber of tableSubscribers.values()) {
					if (subscriber.event === "*" || subscriber.event === data.event) {
						subscriber.callback({
							event: data.event,
							data: data.data,
							timestamp: data.timestamp,
						});
					}
				}
			} catch {
				// noop
			}
		};

		this.ws.onerror = (error) => {
			console.error("[BetterBase] WebSocket error:", error);
			this.ws?.close();
			if (this.reconnectTimeout) {
				clearTimeout(this.reconnectTimeout);
				this.reconnectTimeout = null;
			}
			this.ws = null;
			this.scheduleReconnect();
		};

		this.ws.onclose = () => {
			this.ws = null;
			this.scheduleReconnect();
		};
	}

	from(table: string): {
		on: <T = unknown>(
			event: RealtimeEvent,
			callback: RealtimeCallback<T>,
		) => {
			subscribe: (filter?: Record<string, unknown>) => RealtimeSubscription;
		};
	} {
		return {
			on: (event, callback) => ({
				subscribe: (filter) => {
					if (!this.disabled) {
						this.connect();
					}

					const tableSubscribers =
						this.subscriptions.get(table) ?? new Map<string, SubscriberEntry>();
					const id = `${table}:${this.subscriberSequence++}`;

					tableSubscribers.set(id, {
						event,
						filter,
						callback: (payload) => callback(payload as Parameters<typeof callback>[0]),
					});

					this.subscriptions.set(table, tableSubscribers);
					if (!this.disabled) {
						this.sendSubscribe(table, filter);
					}

					return {
						unsubscribe: () => {
							const currentSubscribers = this.subscriptions.get(table);
							if (!currentSubscribers) {
								return;
							}

							currentSubscribers.delete(id);

							if (currentSubscribers.size === 0) {
								this.subscriptions.delete(table);
								if (!this.disabled) {
									this.sendUnsubscribe(table);
								}

								if (this.subscriptions.size === 0 && !this.disabled) {
									this.disconnect();
								}

								return;
							}

							this.subscriptions.set(table, currentSubscribers);
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
