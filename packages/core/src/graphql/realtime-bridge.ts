/**
 * GraphQL Realtime Bridge
 *
 * Bridges database events to GraphQL subscriptions.
 * Listens to database change events and publishes them to the PubSub system.
 */

import { pubsub, publishGraphQLEvent } from "./server";
import { logger } from "../logger";

/**
 * Event emitted when a record is inserted
 */
export interface DbInsertEvent {
	/** The table name */
	table: string;
	/** The inserted record */
	record: Record<string, unknown>;
}

/**
 * Event emitted when a record is updated
 */
export interface DbUpdateEvent {
	/** The table name */
	table: string;
	/** The updated record */
	record: Record<string, unknown>;
}

/**
 * Event emitted when a record is deleted
 */
export interface DbDeleteEvent {
	/** The table name */
	table: string;
	/** The deleted record (before deletion) */
	record: Record<string, unknown>;
}

/**
 * Bridge configuration
 */
export interface RealtimeBridgeConfig {
	/** Optional: Filter which tables to bridge */
	filter?: string[];
	/** Optional: Custom event emitter (defaults to process emitter) */
	eventEmitter?: NodeJS.EventEmitter;
}

/**
 * Default bridge configuration
 */
const defaultConfig: Required<RealtimeBridgeConfig> = {
	filter: [],
	eventEmitter: process,
};

/**
 * Bridge database events to GraphQL subscriptions
 *
 * This function connects to the database event system and publishes
 * events to the GraphQL PubSub for realtime subscriptions.
 *
 * @param config - Configuration for the bridge
 *
 * @example
 * ```typescript
 * import { bridgeRealtimeToGraphQL } from './realtime-bridge';
 *
 * // Bridge all database events to GraphQL subscriptions
 * bridgeRealtimeToGraphQL({});
 * ```
 */
export function bridgeRealtimeToGraphQL(config: RealtimeBridgeConfig = {}): void {
	const mergedConfig = { ...defaultConfig, ...config };
	const emitter = mergedConfig.eventEmitter;

	// Listen for insert events
	emitter.on("db:insert", (event: DbInsertEvent) => {
		// Check if table is in filter (if filter is set)
		if (mergedConfig.filter.length > 0 && !mergedConfig.filter.includes(event.table)) {
			return;
		}

		logger.debug({ table: event.table, type: "INSERT" }, "GraphQL: Publishing insert event");

		// Publish to insert subscription
		publishGraphQLEvent(`${event.table}:insert`, event.record);

		// Publish to changes subscription (includes type info)
		publishGraphQLEvent(`${event.table}:change`, {
			type: "INSERT",
			record: event.record,
		});
	});

	// Listen for update events
	emitter.on("db:update", (event: DbUpdateEvent) => {
		// Check if table is in filter (if filter is set)
		if (mergedConfig.filter.length > 0 && !mergedConfig.filter.includes(event.table)) {
			return;
		}

		logger.debug({ table: event.table, type: "UPDATE" }, "GraphQL: Publishing update event");

		// Publish to update subscription
		publishGraphQLEvent(`${event.table}:update`, event.record);

		// Publish to changes subscription (includes type info)
		publishGraphQLEvent(`${event.table}:change`, {
			type: "UPDATE",
			record: event.record,
		});
	});

	// Listen for delete events
	emitter.on("db:delete", (event: DbDeleteEvent) => {
		// Check if table is in filter (if filter is set)
		if (mergedConfig.filter.length > 0 && !mergedConfig.filter.includes(event.table)) {
			return;
		}

		logger.debug({ table: event.table, type: "DELETE" }, "GraphQL: Publishing delete event");

		// Publish to delete subscription
		publishGraphQLEvent(`${event.table}:delete`, event.record);

		// Publish to changes subscription (includes type info)
		publishGraphQLEvent(`${event.table}:change`, {
			type: "DELETE",
			record: event.record,
		});
	});

	logger.info("GraphQL subscriptions wired to realtime events");
}

/**
 * Publish an event directly to GraphQL subscriptions
 *
 * @param table - The table name
 * @param type - The event type (insert, update, delete)
 * @param record - The record data
 *
 * @example
 * ```typescript
 * import { publishDbEvent } from './realtime-bridge';
 *
 * publishDbEvent('posts', 'insert', { id: '1', title: 'Hello' });
 * ```
 */
export function publishDbEvent(
	table: string,
	type: "insert" | "update" | "delete",
	record: Record<string, unknown>,
): void {
	switch (type) {
		case "insert":
			publishGraphQLEvent(`${table}:insert`, record);
			publishGraphQLEvent(`${table}:change`, { type: "INSERT", record });
			break;
		case "update":
			publishGraphQLEvent(`${table}:update`, record);
			publishGraphQLEvent(`${table}:change`, { type: "UPDATE", record });
			break;
		case "delete":
			publishGraphQLEvent(`${table}:delete`, record);
			publishGraphQLEvent(`${table}:change`, { type: "DELETE", record });
			break;
	}
}

/**
 * Stop bridging events (remove all listeners)
 *
 * @param config - Configuration used when creating the bridge
 */
export function stopRealtimeBridge(config: RealtimeBridgeConfig = {}): void {
	const mergedConfig = { ...defaultConfig, ...config };
	const emitter = mergedConfig.eventEmitter;

	emitter.removeAllListeners("db:insert");
	emitter.removeAllListeners("db:update");
	emitter.removeAllListeners("db:delete");

	logger.info("GraphQL realtime bridge stopped");
}
