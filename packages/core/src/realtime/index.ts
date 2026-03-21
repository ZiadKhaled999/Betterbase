/**
 * Realtime Module
 * 
 * Provides channel-based presence tracking and message broadcasting
 * for WebSocket connections.
 */

export {
	ChannelManager,
	createChannelManager,
	type PresenceState,
	type JoinChannelOptions,
	type WebSocketLike,
	type Connection,
	type Channel,
	type ChannelMessage,
	type PresenceEventType,
} from './channel-manager';
