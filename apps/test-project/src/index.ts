import { EventEmitter } from "node:events";
import { existsSync } from "node:fs";
import { createFunctionsMiddleware, initializeFunctionsRuntime } from "@betterbase/core/functions";
import { type WebhookDbClient, initializeWebhooks } from "@betterbase/core/webhooks";
import { Hono } from "hono";
import { upgradeWebSocket, websocket } from "hono/bun";
import config from "../betterbase.config";
import { auth } from "./auth";
import { db } from "./db";
import { env } from "./lib/env";
import { realtime } from "./lib/realtime";
import { registerRoutes } from "./routes";

// Create an adapter to make drizzle SQLite compatible with WebhookDbClient interface
const dbAdapter: WebhookDbClient = {
	async execute(_args: { sql: string; args: unknown[] }) {
		return { rows: [] };
	},
};

const app = new Hono();

// Create an event emitter for database changes (used by webhooks)
const dbEventEmitter = new EventEmitter();

app.get(
	"/ws",
	upgradeWebSocket((c) => {
		const authHeaderToken = c.req.header("authorization")?.replace(/^Bearer\s+/i, "");
		// Query token is ONLY allowed in development mode for testing
		const queryToken = c.req.query("token");
		const isDev = process.env.NODE_ENV !== "production";

		// Only accept queryToken in development mode
		const token = authHeaderToken ?? (isDev ? queryToken : undefined);

		if (!authHeaderToken && queryToken && isDev) {
			console.warn(
				"WebSocket auth using query token fallback; prefer header/cookie/subprotocol in production.",
			);
		}

		return {
			onOpen(_event, ws) {
				realtime.handleConnection(ws.raw, token);
			},
			onMessage(event, ws) {
				const message = typeof event.data === "string" ? event.data : event.data.toString();
				realtime.handleMessage(ws.raw, message);
			},
			onClose(_event, ws) {
				realtime.handleClose(ws.raw);
			},
		};
	}),
);

registerRoutes(app);

app.on(["POST", "GET"], "/api/auth/**", (c) => {
	return auth.handler(c.req.raw);
});

// Mount GraphQL API if enabled
const graphqlEnabled = config.graphql?.enabled ?? true;
if (graphqlEnabled) {
	// Dynamic import to handle case where graphql route doesn't exist yet
	try {
		const graphql = await import("./routes/graphql");
		const graphqlRoute = graphql.graphqlRoute as ReturnType<
			typeof import("hono").Hono.prototype.route
		>;
		app.route("/", graphqlRoute);
		console.log("🛸 GraphQL API enabled at /api/graphql");
	} catch (err: unknown) {
		// Check if it's a "module not found" error vs a real syntax/runtime error
		const isModuleNotFound =
			err &&
			typeof err === "object" &&
			(("code" in err &&
				(err.code === "ERR_MODULE_NOT_FOUND" || err.code === "MODULE_NOT_FOUND")) ||
				("message" in err && /Cannot find module|Cannot find package/.test(String(err.message))));

		if (isModuleNotFound) {
			// GraphQL route not generated yet - only log in development
			if (env.NODE_ENV === "development") {
				console.log('ℹ️  Run "bb graphql generate" to enable GraphQL API');
			}
		} else {
			// Re-throw real errors (syntax errors, runtime errors) so they're not swallowed
			console.error("Failed to load GraphQL module:", err);
			throw err;
		}
	}
}

// Initialize webhooks (Phase 13)
// Pass database client for persistent delivery logging
initializeWebhooks(config, dbEventEmitter, dbAdapter);

// Webhook logs API endpoint (for CLI access)
app.get("/api/webhooks/:id/logs", async (c) => {
	const webhookId = c.req.param("id");
	// In a full implementation, this would fetch logs from the dispatcher
	// For now, return a placeholder
	return c.json({ logs: [], message: "Logs not available via API in v1" });
});

// Initialize functions runtime for local development
// Functions are available at /functions/:name
const isDev = env.NODE_ENV === "development";
if (isDev) {
	const functionsDir = "./src/functions";
	if (existsSync(functionsDir)) {
		try {
			const functionsRuntime = await initializeFunctionsRuntime(
				".",
				process.env as Record<string, string>,
			);
			if (functionsRuntime) {
				app.all("/functions/:name", createFunctionsMiddleware(functionsRuntime) as any);
				console.log("⚡ Functions runtime enabled at /functions/:name");
			}
		} catch (error) {
			console.warn("Failed to initialize functions runtime:", error);
		}
	}
}

const server = Bun.serve({
	fetch: app.fetch,
	websocket,
	port: env.PORT,
	development: env.NODE_ENV === "development",
});

console.log(`🚀 Server running at http://localhost:${server.port}`);
for (const route of app.routes) {
	console.log(`  ${route.method} ${route.path}`);
}

process.on("SIGTERM", () => {
	server.stop();
});

process.on("SIGINT", () => {
	server.stop();
});

export { app, server, dbEventEmitter };
