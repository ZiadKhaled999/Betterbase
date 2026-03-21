import type { RealtimeCallback, RealtimeSubscription } from "./types";

type RealtimeEvent = "INSERT" | "UPDATE" | "DELETE" | "*";

interface SubscriberEntry {
	callback: RealtimeCallback;
	event: RealtimeEvent;
	filter?: Record<string, unknown>;
}

/**
 * Channel subscription options
 */
interface ChannelSubscribeOptions {
	user_id?: string;
	presence?: Record<string, unknown>;
}

/**
 * Presence event from server
 */
interface PresenceEvent {
	type: 'presence';
	event: 'join' | 'leave' | 'sync' | 'update';
	channel: string;
	payload: unknown;
}

/**
 * Broadcast event from server
 */
interface BroadcastEvent {
	type: 'broadcast';
	event: string;
	channel: string;
	payload: unknown;
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
	private eventHandlers = new Map<string, Set<(data: unknown) => void>>();

	constructor(
		private url: string,
		token: string | null = null,
	) {
		this.token = token;
	}

	setToken(token: string | null): void {
		this.token = token;
	}

	/**
	 * Send a message through the WebSocket
	 */
	private send(message: object): void {
		if (this.disabled) return;
		if (this.ws?.readyState === WebSocket.OPEN) {
			this.ws.send(JSON.stringify(message));
		}
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

	private sendSubscribe(table: string, event: string, filter?: Record<string, unknown>): void {
		if (this.disabled) return;
		if (this.ws?.readyState === WebSocket.OPEN) {
			this.ws.send(JSON.stringify({ type: "subscribe", table, event, filter }));
		}
	}

	private sendUnsubscribe(table: string, event: string): void {
		if (this.disabled) return;
		if (this.ws?.readyState === WebSocket.OPEN) {
			this.ws.send(JSON.stringify({ type: "unsubscribe", table, event }));
		}
	}

	private sendSubscribeAll(table: string): void {
		const tableSubscribers = this.subscriptions.get(table);
		if (!tableSubscribers || tableSubscribers.size === 0) {
			return;
		}

		for (const [id, subscriber] of tableSubscribers.entries()) {
			this.sendSubscribe(table, subscriber.event, subscriber.filter);
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

				// Handle table update events
				if (data.type === "update") {
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
					return;
				}

				// Handle presence events
				if (data.type === "presence") {
					const handlers = this.eventHandlers.get("presence");
					if (handlers) {
						for (const handler of handlers) {
							handler(data as PresenceEvent);
						}
					}
					return;
				}

				// Handle broadcast events
				if (data.type === "broadcast") {
					const handlers = this.eventHandlers.get("broadcast");
					if (handlers) {
						for (const handler of handlers) {
							handler(data as BroadcastEvent);
						}
					}
					return;
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
						this.sendSubscribe(table, event, filter);
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
									this.sendUnsubscribe(table, event);
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

	/**
	 * Subscribe to a channel for presence and broadcast messaging
	 */
	channel(channelName: string) {
		// Ensure connection is established
		if (!this.disabled) {
			this.connect();
		}

		return {
			subscribe: (options?: ChannelSubscribeOptions) => {
				this.send({
					type: 'subscribe',
					channel: channelName,
					payload: options,
				});

				return {
					unsubscribe: () => {
						this.send({ type: 'unsubscribe', channel: channelName });
					},

					broadcast: (event: string, data: unknown) => {
						this.send({
							type: 'broadcast',
							channel: channelName,
							payload: { event, data },
						});
					},

					track: (state: Record<string, unknown>) => {
						this.send({
							type: 'presence',
							channel: channelName,
							payload: { action: 'update', state },
						});
					},

					onPresence: (callback: (event: PresenceEvent) => void) => {
						this.on('presence', (data) => {
							const event = data as PresenceEvent;
							if (event.channel === channelName) {
								callback(event);
							}
						});
					},

					onBroadcast: (callback: (event: string, data: unknown) => void) => {
						this.on('broadcast', (data) => {
							const event = data as BroadcastEvent;
							if (event.channel === channelName) {
								callback(event.event, event.payload);
							}
						});
					},
				};
			},
		};
	}

	/**
	 * Register an event handler for a specific event type
	 */
	on(eventType: string, callback: (data: unknown) => void): void {
		let handlers = this.eventHandlers.get(eventType);
		if (!handlers) {
			handlers = new Set();
			this.eventHandlers.set(eventType, handlers);
		}
		handlers.add(callback);
	}

	/**
	 * Remove an event handler
	 */	off(eventType: string, callback: (data: unknown) => void): void {
		const handlers = this.eventHandlers.get(eventType);
		if (handlers) {
			handlers.delete(callback);
			if (handlers.size === 0) {
				this.eventHandlers.delete(eventType);
			}
		}
	}

	disconnect(): void {
		if (this.reconnectTimeout) {
			clearTimeout(this.reconnectTimeout);
			this.reconnectTimeout = null;
		}

		this.ws?.close();
		this.ws = null;
		this.subscriptions.clear();
		this.eventHandlers.clear();
		this.reconnectAttempts = 0;
	}
}
