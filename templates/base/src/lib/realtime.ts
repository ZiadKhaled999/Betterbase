import type { ServerWebSocket } from "bun";
import type { DBEvent } from "@betterbase/shared";
import deepEqual from "fast-deep-equal";
import { z } from "zod";

export interface Subscription {
	table: string;
	event: "INSERT" | "UPDATE" | "DELETE" | "*";
	filter?: Record<string, unknown>;
}

interface Client {
	ws: ServerWebSocket<unknown>;
	userId: string;
	claims: string[];
	subscriptions: Map<string, Subscription>;
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
		event: z.enum(["INSERT", "UPDATE", "DELETE", "*"]).default("*"),
		filter: z.record(z.string(), z.unknown()).optional(),
	}),
	z.object({
		type: z.literal("unsubscribe"),
		table: z.string().min(1).max(255),
		event: z.enum(["INSERT", "UPDATE", "DELETE", "*"]).default("*"),
	}),
]);

const realtimeLogger = {
	debug: (message: string): void => console.debug(`[realtime] ${message}`),
	info: (message: string): void => console.info(`[realtime] ${message}`),
	warn: (message: string): void => console.warn(`[realtime] ${message}`),
};

export class RealtimeServer {
	private clients = new Map<ServerWebSocket<unknown>, Client>();
	private tableSubscribers = new Map<string, Set<ServerWebSocket<unknown>>>();
	private config: RealtimeConfig;
	// CDC event handler for automatic database change events
	private cdcCallback: ((event: DBEvent) => void) | null = null;

	// Map to track subscriptions by table+event for efficient filtering
	// Key format: "table:event" (e.g., "users:INSERT")
	private tableEventSubscribers = new Map<string, Set<ServerWebSocket<unknown>>>();

	constructor(config?: Partial<RealtimeConfig>) {
		if (process.env.NODE_ENV !== "development" && process.env.ENABLE_DEV_AUTH !== "true") {
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

	/**
	 * Connect to database change events (CDC)
	 * This enables automatic event emission when database changes occur
	 * @param onchange - Callback function that receives DBEvent when data changes
	 */
	connectCDC(onchange: (event: DBEvent) => void): void {
		this.cdcCallback = onchange;
	}

	/**
	 * Handle a database change event from CDC
	 * This is called automatically when the database emits change events
	 */
	private handleCDCEvent(event: DBEvent): void {
		// Invoke the CDC callback if registered
		this.cdcCallback?.(event);
		// Broadcast the event to subscribed clients via WebSocket
		this.broadcast(event.table, event.type, event.record);
	}

	/**
	 * Process a CDC event and broadcast to WebSocket clients
	 * Server-side filtering: only delivers to clients with matching subscriptions
	 */
	processCDCEvent(event: DBEvent): void {
		// Invoke the CDC callback if registered
		this.cdcCallback?.(event);
		// Broadcast to WebSocket clients with server-side filtering
		this.broadcast(event.table, event.type, event.record);
	}

	/**
	 * Get subscribers for a specific table and event type
	 * This enables server-side filtering
	 */
	private getSubscribersForEvent(
		table: string,
		event: "INSERT" | "UPDATE" | "DELETE",
	): Set<ServerWebSocket<unknown>> {
		const subscribers = new Set<ServerWebSocket<unknown>>();
		
		// Get exact match subscribers (table + event)
		const exactKey = `${table}:${event}`;
		const exactSubs = this.tableEventSubscribers.get(exactKey);
		if (exactSubs) {
			for (const ws of exactSubs) {
				subscribers.add(ws);
			}
		}
		
		// Get wildcard subscribers (table + *)
		const wildcardKey = `${table}:*`;
		const wildcardSubs = this.tableEventSubscribers.get(wildcardKey);
		if (wildcardSubs) {
			for (const ws of wildcardSubs) {
				subscribers.add(ws);
			}
		}
		
		return subscribers;
	}

	authenticate(token: string | undefined): { userId: string; claims: string[] } | null {
		if (!token || !token.trim()) return null;

		const allowDevAuth =
			process.env.NODE_ENV === "development" || process.env.ENABLE_DEV_AUTH === "true";
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
		this.clients.set(ws, {
			ws,
			userId: identity.userId,
			claims: identity.claims,
			subscriptions: new Map(),
		});

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

		const data = result.data;
		if (data.type === "subscribe") {
			this.subscribe(ws, data.table, data.event, data.filter);
			return;
		}

		this.unsubscribe(ws, data.table, data.event);
	}

	handleClose(ws: ServerWebSocket<unknown>): void {
		realtimeLogger.info("Client disconnected");

		const client = this.clients.get(ws);
		if (client) {
			// Clean up all subscriptions for this client
			for (const [subscriptionKey, subscription] of client.subscriptions.entries()) {
				const tableEventKey = `${subscription.table}:${subscription.event}`;
				const tableEventSubs = this.tableEventSubscribers.get(tableEventKey);
				tableEventSubs?.delete(ws);
				if (tableEventSubs && tableEventSubs.size === 0) {
					this.tableEventSubscribers.delete(tableEventKey);
				}
			}
		}

		this.clients.delete(ws);
	}

	broadcast(table: string, event: RealtimeUpdatePayload["event"], data: unknown): void {
		// Server-side filtering: get only subscribers for this specific event type
		const subscribers = this.getSubscribersForEvent(table, event);
		
		if (subscribers.size === 0) {
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
		event: "INSERT" | "UPDATE" | "DELETE" | "*" = "*",
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

		// Create subscription key that includes event type
		const subscriptionKey = `${table}:${event}`;
		const existingSubscription = client.subscriptions.has(subscriptionKey);
		if (
			!existingSubscription &&
			client.subscriptions.size >= this.config.maxSubscriptionsPerClient
		) {
			realtimeLogger.warn(`Subscription limit reached for ${client.userId}`);
			this.safeSend(ws, { error: "Subscription limit reached" });
			return;
		}

		// Track subscribers by table+event for efficient filtering
		const tableEventKey = `${table}:${event}`;
		const tableEventSet = this.tableEventSubscribers.get(tableEventKey) ?? new Set<ServerWebSocket<unknown>>();
		if (!tableEventSet.has(ws) && tableEventSet.size >= this.config.maxSubscribersPerTable) {
			realtimeLogger.warn(`Table event subscriber cap reached for ${tableEventKey}`);
			this.safeSend(ws, { error: "Table subscription limit reached" });
			return;
		}

		client.subscriptions.set(subscriptionKey, { table, event, filter });
		tableEventSet.add(ws);
		this.tableEventSubscribers.set(tableEventKey, tableEventSet);

		this.safeSend(ws, { type: "subscribed", table, event, filter });
		realtimeLogger.debug(`Client subscribed to ${table} for ${event} events`);
	}

	private unsubscribe(
		ws: ServerWebSocket<unknown>,
		table: string,
		event: "INSERT" | "UPDATE" | "DELETE" | "*" = "*",
	): void {
		const client = this.clients.get(ws);
		if (!client) {
			return;
		}

		// Remove subscription with specific event type
		const subscriptionKey = `${table}:${event}`;
		client.subscriptions.delete(subscriptionKey);
		
		// Clean up table+event subscriber tracking
		const tableEventKey = `${table}:${event}`;
		const tableEventSubs = this.tableEventSubscribers.get(tableEventKey);
		tableEventSubs?.delete(ws);
		if (tableEventSubs && tableEventSubs.size === 0) {
			this.tableEventSubscribers.delete(tableEventKey);
		}

		this.safeSend(ws, { type: "unsubscribed", table, event });
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
