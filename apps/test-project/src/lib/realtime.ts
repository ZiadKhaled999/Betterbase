import type { ServerWebSocket } from "bun";
import deepEqual from "fast-deep-equal";
import { z } from "zod";
import { ChannelManager, type PresenceState } from "@betterbase/core";

export interface Subscription {
	table: string;
	filter?: Record<string, unknown>;
}

interface Client {
	ws: ServerWebSocket<unknown>;
	userId: string;
	claims: string[];
	subscriptions: Map<string, Subscription>;
	connectionId: string;
}

interface RealtimeUpdatePayload {
	type: "update";
	table: string;
	event: "INSERT" | "UPDATE" | "DELETE";
	data: unknown;
	timestamp: string;
}

interface RealtimeConfig {
	maxClients: number;
	maxSubscriptionsPerClient: number;
	maxSubscribersPerTable: number;
}

const messageSchema = z.union([
	z.object({
		type: z.literal("subscribe"),
		table: z.string().min(1).max(255),
		filter: z.record(z.string(), z.unknown()).optional(),
	}),
	z.object({
		type: z.literal("unsubscribe"),
		table: z.string().min(1).max(255),
	}),
	// Channel subscription messages
	z.object({
		type: z.literal("subscribe"),
		channel: z.string().min(1).max(255),
		payload: z.object({
			user_id: z.string().optional(),
			presence: z.record(z.string(), z.unknown()).optional(),
		}).optional(),
	}),
	z.object({
		type: z.literal("unsubscribe"),
		channel: z.string().min(1).max(255),
	}),
	z.object({
		type: z.literal("broadcast"),
		channel: z.string().min(1).max(255),
		payload: z.object({
			event: z.string(),
			data: z.unknown(),
		}),
	}),
	z.object({
		type: z.literal("presence"),
		channel: z.string().min(1).max(255),
		payload: z.object({
			action: z.literal("update"),
			state: z.record(z.string(), z.unknown()),
		}),
	}),
]);

type ChannelMessage = z.infer<typeof messageSchema>;

const realtimeLogger = {
	debug: (message: string): void => console.debug(`[realtime] ${message}`),
	info: (message: string): void => console.info(`[realtime] ${message}`),
	warn: (message: string): void => console.warn(`[realtime] ${message}`),
};

export class RealtimeServer {
	private clients = new Map<ServerWebSocket<unknown>, Client>();
	private tableSubscribers = new Map<string, Set<ServerWebSocket<unknown>>>();
	private channelManager = new ChannelManager<ServerWebSocket<unknown>>();
	private config: RealtimeConfig;

	constructor(config?: Partial<RealtimeConfig>) {
		if (process.env.NODE_ENV !== "development") {
			realtimeLogger.warn(
				"Realtime auth verifier is not configured; dev token parser is disabled. Configure a real verifier for production.",
			);
		}

		this.config = {
			maxClients: 1000,
			maxSubscriptionsPerClient: 50,
			maxSubscribersPerTable: 500,
			...config,
		};
	}

	authenticate(token: string | undefined): { userId: string; claims: string[] } | null {
		if (!token || !token.trim()) return null;

		const allowDevAuth = process.env.NODE_ENV === "development";
		if (!allowDevAuth) {
			return null;
		}

		const [userId, rawClaims] = token.trim().split(":", 2);
		if (!userId) return null;

		const claims = rawClaims
			? rawClaims
					.split(",")
					.map((claim) => claim.trim())
					.filter(Boolean)
			: [];
		return { userId, claims };
	}

	authorize(userId: string, claims: string[], table: string): boolean {
		return (
			Boolean(userId) && (claims.includes("realtime:*") || claims.includes(`realtime:${table}`))
		);
	}

	handleConnection(ws: ServerWebSocket<unknown>, token: string | undefined): boolean {
		if (this.clients.size >= this.config.maxClients) {
			realtimeLogger.warn("Rejecting realtime connection: max clients reached");
			this.safeSend(ws, { error: "Server is busy. Try again later." });
			ws.close(1013, "Server busy");
			return false;
		}

		const identity = this.authenticate(token);
		if (!identity) {
			realtimeLogger.warn("Rejecting unauthenticated realtime connection");
			this.safeSend(ws, { error: "Unauthorized websocket connection" });
			ws.close(1008, "Unauthorized");
			return false;
		}

		realtimeLogger.info(`Client connected (${identity.userId})`);
		// Generate a unique connection ID for the channel manager
		const connectionId = `${identity.userId}:${Date.now()}:${Math.random().toString(36).substring(2, 9)}`;
		
		this.clients.set(ws, {
			ws,
			userId: identity.userId,
			claims: identity.claims,
			subscriptions: new Map(),
			connectionId,
		});

		// Register with channel manager
		this.channelManager.registerConnection(connectionId, ws);
		// Start heartbeat if not already running
		this.channelManager.startHeartbeat(30000);

		return true;
	}

	handleMessage(ws: ServerWebSocket<unknown>, rawMessage: string): void {
		let parsedJson: unknown;

		try {
			parsedJson = JSON.parse(rawMessage);
		} catch {
			this.safeSend(ws, { error: "Invalid message format" });
			return;
		}

		const result = messageSchema.safeParse(parsedJson);
		if (!result.success) {
			this.safeSend(ws, {
				error: "Invalid message format",
				details: result.error.format(),
			});
			return;
		}

		const data = result.data as ChannelMessage;

		// Check if this is a channel message (has 'channel' property) or table message (has 'table' property)
		if ('channel' in data) {
			this.handleChannelMessage(ws, data);
			return;
		}

		// Handle table subscription
		if (data.type === "subscribe") {
			this.subscribe(ws, data.table, data.filter);
			return;
		}

		this.unsubscribe(ws, data.table);
	}

	private handleChannelMessage(ws: ServerWebSocket<unknown>, data: ChannelMessage): void {
		// Only process channel messages (type is subscribe/unsubscribe with channel property)
		if (!('channel' in data)) {
			return;
		}

		const client = this.clients.get(ws);
		if (!client) {
			this.safeSend(ws, { error: "Unauthorized client" });
			return;
		}

		const channelName = data.channel;

		switch (data.type) {
			case "subscribe": {
				// Join channel with optional user_id and presence
				const options = data.payload || {};
				const userId = options.user_id || client.userId;
				
				try {
					this.channelManager.joinChannel(client.connectionId, channelName, {
						user_id: userId,
						presence: options.presence,
					});
					this.safeSend(ws, { type: "subscribed", channel: channelName });
					realtimeLogger.debug(`Client subscribed to channel ${channelName}`);
				} catch (error) {
					realtimeLogger.warn(
						`Failed to join channel ${channelName}: ${error instanceof Error ? error.message : String(error)}`
					);
					this.safeSend(ws, { error: "Failed to join channel" });
				}
				break;
			}

			case "unsubscribe": {
				// Leave channel
				this.channelManager.leaveChannel(client.connectionId, channelName);
				this.safeSend(ws, { type: "unsubscribed", channel: channelName });
				realtimeLogger.debug(`Client unsubscribed from channel ${channelName}`);
				break;
			}

			case "broadcast": {
				// Broadcast to channel
				if (!this.channelManager.isInChannel(client.connectionId, channelName)) {
					this.safeSend(ws, { error: "Not subscribed to channel" });
					return;
				}

				this.channelManager.broadcastToChannel(channelName, {
					type: "broadcast",
					event: data.payload.event,
					channel: channelName,
					payload: data.payload.data,
				}, client.connectionId);
				break;
			}

			case "presence": {
				// Update presence state
				if (!this.channelManager.isInChannel(client.connectionId, channelName)) {
					this.safeSend(ws, { error: "Not subscribed to channel" });
					return;
				}

				if (data.payload.action === "update") {
					this.channelManager.updatePresence(client.connectionId, channelName, data.payload.state);
				}
				break;
			}
		}
	}

	handleClose(ws: ServerWebSocket<unknown>): void {
		realtimeLogger.info("Client disconnected");

		const client = this.clients.get(ws);
		if (client) {
			// Clean up table subscriptions
			for (const table of client.subscriptions.keys()) {
				const subscribers = this.tableSubscribers.get(table);
				subscribers?.delete(ws);

				if (subscribers && subscribers.size === 0) {
					this.tableSubscribers.delete(table);
				}
			}

			// Clean up channel subscriptions
			this.channelManager.unregisterConnection(client.connectionId);
		}

		this.clients.delete(ws);
	}

	broadcast(table: string, event: RealtimeUpdatePayload["event"], data: unknown): void {
		const subscribers = this.tableSubscribers.get(table);
		if (!subscribers || subscribers.size === 0) {
			return;
		}

		const payload: RealtimeUpdatePayload = {
			type: "update",
			table,
			event,
			data,
			timestamp: new Date().toISOString(),
		};

		const message = JSON.stringify(payload);

		const subs = Array.from(subscribers);
		for (const ws of subs) {
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
	}

	private subscribe(
		ws: ServerWebSocket<unknown>,
		table: string,
		filter?: Record<string, unknown>,
	): void {
		const client = this.clients.get(ws);
		if (!client) {
			this.safeSend(ws, { error: "Unauthorized client" });
			ws.close(1008, "Unauthorized");
			return;
		}

		if (!this.authorize(client.userId, client.claims, table)) {
			realtimeLogger.warn(`Subscription denied for ${client.userId} on ${table}`);
			this.safeSend(ws, { error: "Forbidden subscription" });
			return;
		}

		const existingSubscription = client.subscriptions.has(table);
		if (
			!existingSubscription &&
			client.subscriptions.size >= this.config.maxSubscriptionsPerClient
		) {
			realtimeLogger.warn(`Subscription limit reached for ${client.userId}`);
			this.safeSend(ws, { error: "Subscription limit reached" });
			return;
		}

		const tableSet = this.tableSubscribers.get(table) ?? new Set<ServerWebSocket<unknown>>();
		const alreadyInTableSet = tableSet.has(ws);
		if (!alreadyInTableSet && tableSet.size >= this.config.maxSubscribersPerTable) {
			realtimeLogger.warn(`Table subscriber cap reached for ${table}`);
			this.safeSend(ws, { error: "Table subscription limit reached" });
			return;
		}

		client.subscriptions.set(table, { table, filter });
		tableSet.add(ws);
		this.tableSubscribers.set(table, tableSet);

		this.safeSend(ws, { type: "subscribed", table, filter });
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

		this.safeSend(ws, { type: "unsubscribed", table });
	}

	private matchesFilter(filter: Record<string, unknown> | undefined, payload: unknown): boolean {
		if (!filter || Object.keys(filter).length === 0) {
			return true;
		}

		if (!payload || typeof payload !== "object") {
			return false;
		}

		const data = payload as Record<string, unknown>;
		return Object.entries(filter).every(([key, value]) => deepEqual(data[key], value));
	}

	private safeSend(ws: ServerWebSocket<unknown>, payload: object | string): boolean {
		if (ws.readyState !== WebSocket.OPEN) {
			return false;
		}

		try {
			ws.send(typeof payload === "string" ? payload : JSON.stringify(payload));
			return true;
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			realtimeLogger.warn(`WebSocket send failed: ${message}`);
			return false;
		}
	}
}

export const realtime = new RealtimeServer();
