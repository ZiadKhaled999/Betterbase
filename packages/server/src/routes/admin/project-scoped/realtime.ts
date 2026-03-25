import { Hono } from "hono";
import { getPool } from "../../../lib/db";

export const projectRealtimeRoutes = new Hono();

// GET /admin/projects/:id/realtime/stats
// Note: v1 returns static/estimated stats. Real-time WebSocket tracking is a future enhancement.
// The server tracks connection counts in-memory via a global map if realtime is running.
projectRealtimeRoutes.get("/stats", async (c) => {
	// Access global realtime manager if available (set on app startup)
	const realtimeManager = (globalThis as any).__betterbaseRealtimeManager;

	if (!realtimeManager) {
		return c.json({
			connected_clients: 0,
			active_channels: 0,
			channels: [],
			note: "Realtime manager not initialized",
		});
	}

	// RealtimeManager exposes getStats() — implement this in the realtime module
	const stats = realtimeManager.getStats?.() ?? { clients: 0, channels: [] };

	return c.json({
		connected_clients: stats.clients,
		active_channels: stats.channels.length,
		channels: stats.channels,
	});
});
