import type { ServerWebSocket } from "bun";
import deepEqual from "fast-deep-equal";
import { z } from "zod";

export interface Subscription {
	table: string;
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
		filter: z.record(z.string(), z.unknown()).optional(),
	}),
	z.object({
		type: z.literal("unsubscribe"),
		table: z.string().min(1).max(255),
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
			this.subscribe(ws, data.table, data.filter);
			return;
		}

		this.unsubscribe(ws, data.table);
	}

	handleClose(ws: ServerWebSocket<unknown>): void {
		realtimeLogger.info("Client disconnected");

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
