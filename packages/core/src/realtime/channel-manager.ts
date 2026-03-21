/**
 * Channel Manager for Realtime Presence & Broadcast
 * 
 * Provides channel-based presence tracking and message broadcasting
 * for WebSocket connections.
 */

import { logger } from '../logger';

/**
 * Presence state for a user in a channel
 */
export type PresenceState = {
	user_id: string;
	online_at: string;
	[key: string]: unknown;
};

/**
 * Options when joining a channel
 */
export interface JoinChannelOptions {
	user_id?: string;
	presence?: Record<string, unknown>;
}

/**
 * Generic WebSocket-like interface for both browser and Bun WebSockets
 */
export interface WebSocketLike {
	send(data: string): void;
	close(code?: number, reason?: string): void;
	readonly readyState: number;
}

/**
 * Connection wrapper for tracking WebSocket connections
 */
export interface Connection<WS extends WebSocketLike = WebSocketLike> {
	id: string;
	ws: WS;
	user_id?: string;
	channels: Set<string>;
	presence: Map<string, PresenceState>;
	lastHeartbeat: number;
}

/**
 * Channel with connected users and their presence
 */
export interface Channel<WS extends WebSocketLike = WebSocketLike> {
	name: string;
	connections: Set<Connection<WS>>;
	presence: Map<string, PresenceState>;
}

/**
 * Presence event types
 */
export type PresenceEventType = 'join' | 'leave' | 'sync' | 'update';

/**
 * Message to broadcast to a channel
 */
export interface ChannelMessage {
	type: 'presence' | 'broadcast';
	event?: PresenceEventType;
	channel: string;
	payload: unknown;
}

/**
 * Channel Manager class
 * Manages channel subscriptions, presence tracking, and message broadcasting
 */
export class ChannelManager<WS extends WebSocketLike = WebSocketLike> {
	private channels = new Map<string, Channel<WS>>();
	private connections = new Map<string, Connection<WS>>();
	private heartbeatInterval: ReturnType<typeof setInterval> | null = null;

	/**
	 * Register a new WebSocket connection
	 */
	registerConnection(id: string, ws: WS): Connection<WS> {
		const conn: Connection<WS> = {
			id,
			ws,
			channels: new Set(),
			presence: new Map(),
			lastHeartbeat: Date.now(),
		};
		this.connections.set(id, conn);
		logger.debug({ msg: 'Connection registered', connId: id });
		return conn;
	}

	/**
	 * Unregister a connection and clean up all channel memberships
	 */
	unregisterConnection(id: string): void {
		const conn = this.connections.get(id);
		if (!conn) {
			return;
		}

		// Leave all channels this connection is in
		for (const channelName of conn.channels) {
			this.leaveChannel(id, channelName);
		}

		this.connections.delete(id);
		logger.debug({ msg: 'Connection unregistered', connId: id });
	}

	/**
	 * Join a channel with optional user identification and presence
	 */
	joinChannel(connId: string, channelName: string, options: JoinChannelOptions = {}): void {
		const conn = this.connections.get(connId);
		if (!conn) {
			logger.warn({ msg: 'Connection not found', connId });
			throw new Error('Connection not found');
		}

		// Get or create the channel
		let channel = this.channels.get(channelName);
		if (!channel) {
			channel = {
				name: channelName,
				connections: new Set(),
				presence: new Map(),
			};
			this.channels.set(channelName, channel);
		}

		// Add connection to channel
		channel.connections.add(conn);
		conn.channels.add(channelName);

		// Handle presence if user_id provided
		if (options.user_id) {
			conn.user_id = options.user_id;

			const state: PresenceState = {
				user_id: options.user_id,
				online_at: new Date().toISOString(),
				...options.presence,
			};

			channel.presence.set(options.user_id, state);
			conn.presence.set(channelName, state);

			// Broadcast join event to other channel members
			this.broadcastToChannel(channelName, {
				type: 'presence',
				event: 'join',
				channel: channelName,
				payload: state,
			}, connId);

			logger.debug({
				msg: 'User joined channel with presence',
				connId,
				channel: channelName,
				userId: options.user_id,
			});
		}

		// Send presence sync to the joining member
		const presenceList = Array.from(channel.presence.values());
		this.sendToConnection(connId, {
			type: 'presence',
			event: 'sync',
			channel: channelName,
			payload: presenceList,
		});

		logger.debug({
			msg: 'Connection joined channel',
			connId,
			channel: channelName,
			memberCount: channel.connections.size,
		});
	}

	/**
	 * Leave a channel
	 */
	leaveChannel(connId: string, channelName: string): void {
		const conn = this.connections.get(connId);
		const channel = this.channels.get(channelName);

		if (!conn || !channel) {
			return;
		}

		channel.connections.delete(conn);
		conn.channels.delete(channelName);

		// Handle presence cleanup
		if (conn.user_id && channel.presence.has(conn.user_id)) {
			const state = channel.presence.get(conn.user_id)!;
			channel.presence.delete(conn.user_id);
			conn.presence.delete(channelName);

			// Broadcast leave event to remaining channel members
			this.broadcastToChannel(channelName, {
				type: 'presence',
				event: 'leave',
				channel: channelName,
				payload: state,
			}, connId);

			logger.debug({
				msg: 'User left channel',
				connId,
				channel: channelName,
				userId: conn.user_id,
			});
		}

		// Clean up empty channels
		if (channel.connections.size === 0) {
			this.channels.delete(channelName);
			logger.debug({ msg: 'Channel removed (empty)', channel: channelName });
		}
	}

	/**
	 * Broadcast a message to all channel members except optionally excluded connection
	 */
	broadcastToChannel(channelName: string, message: unknown, excludeConnId?: string): void {
		const channel = this.channels.get(channelName);
		if (!channel) {
			return;
		}

		const msgStr = JSON.stringify(message);

		for (const conn of channel.connections) {
			if (excludeConnId && conn.id === excludeConnId) {
				continue;
			}

			if (conn.ws.readyState === 1) { // WebSocket.OPEN = 1
				conn.ws.send(msgStr);
			}
		}
	}

	/**
	 * Update presence state for a connection in a channel
	 */
	updatePresence(connId: string, channelName: string, state: Record<string, unknown>): void {
		const conn = this.connections.get(connId);
		const channel = this.channels.get(channelName);

		if (!conn || !channel || !conn.user_id) {
			return;
		}

		const existingPresence = channel.presence.get(conn.user_id);
		if (!existingPresence) {
			return;
		}

		const updatedState: PresenceState = {
			...existingPresence,
			...state,
		};

		channel.presence.set(conn.user_id, updatedState);
		conn.presence.set(channelName, updatedState);

		// Broadcast presence update to other members
		this.broadcastToChannel(channelName, {
			type: 'presence',
			event: 'update',
			channel: channelName,
			payload: updatedState,
		}, connId);
	}

	/**
	 * Send a message to a specific connection
	 */
	sendToConnection(connId: string, message: unknown): boolean {
		const conn = this.connections.get(connId);
		if (!conn || conn.ws.readyState !== 1) { // WebSocket.OPEN = 1
			return false;
		}

		try {
			conn.ws.send(JSON.stringify(message));
			return true;
		} catch (error) {
			logger.warn({
				msg: 'Failed to send message to connection',
				connId,
				error: error instanceof Error ? error.message : String(error),
			});
			return false;
		}
	}

	/**
	 * Start heartbeat to clean up stale connections
	 * @param interval - Heartbeat interval in milliseconds (default: 30000)
	 */
	startHeartbeat(interval = 30000): void {
		if (this.heartbeatInterval) {
			return;
		}

		this.heartbeatInterval = setInterval(() => {
			const now = Date.now();
			const staleThreshold = interval * 2; // Consider stale after 2 intervals

			for (const [id, conn] of this.connections) {
				// Check if WebSocket is in a closed or closing state
				if (conn.ws.readyState !== 1) { // Not WebSocket.OPEN
					logger.debug({ msg: 'Removing stale connection', connId: id });
					this.unregisterConnection(id);
					continue;
				}

				// Check for stale heartbeat
				if (now - conn.lastHeartbeat > staleThreshold) {
					logger.debug({ msg: 'Connection heartbeat stale, removing', connId: id });
					this.unregisterConnection(id);
				}
			}
		}, interval);

		logger.info({ msg: 'Heartbeat started', intervalMs: interval });
	}

	/**
	 * Stop heartbeat
	 */
	stopHeartbeat(): void {
		if (this.heartbeatInterval) {
			clearInterval(this.heartbeatInterval);
			this.heartbeatInterval = null;
			logger.info({ msg: 'Heartbeat stopped' });
		}
	}

	/**
	 * Get channel presence (all users in channel)
	 */
	getChannelPresence(channelName: string): PresenceState[] {
		const channel = this.channels.get(channelName);
		if (!channel) {
			return [];
		}
		return Array.from(channel.presence.values());
	}

	/**
	 * Get connection's channels
	 */
	getConnectionChannels(connId: string): string[] {
		const conn = this.connections.get(connId);
		if (!conn) {
			return [];
		}
		return Array.from(conn.channels);
	}

	/**
	 * Get connection's presence in a specific channel
	 */
	getConnectionPresence(connId: string, channelName: string): PresenceState | undefined {
		const conn = this.connections.get(connId);
		if (!conn) {
			return undefined;
		}
		return conn.presence.get(channelName);
	}

	/**
	 * Check if connection is in a channel
	 */
	isInChannel(connId: string, channelName: string): boolean {
		const conn = this.connections.get(connId);
		return conn ? conn.channels.has(channelName) : false;
	}

	/**
	 * Get all active connections count
	 */
	getConnectionCount(): number {
		return this.connections.size;
	}

	/**
	 * Get all active channels count
	 */
	getChannelCount(): number {
		return this.channels.size;
	}

	/**
	 * Update connection's last heartbeat timestamp
	 */
	updateHeartbeat(connId: string): void {
		const conn = this.connections.get(connId);
		if (conn) {
			conn.lastHeartbeat = Date.now();
		}
	}
}

/**
 * Create a new ChannelManager instance
 */
export function createChannelManager<WS extends WebSocketLike = WebSocketLike>(): ChannelManager<WS> {
	return new ChannelManager<WS>();
}
