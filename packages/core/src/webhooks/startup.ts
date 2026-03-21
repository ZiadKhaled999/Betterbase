import type { EventEmitter } from "node:events";
import type { BetterBaseConfig } from "../config/schema";
import { WebhookDispatcher } from "./dispatcher";
import { connectToRealtime } from "./integrator";
import type { WebhookConfig } from "./types";
import type { WebhookDbClient } from "./dispatcher";

/**
 * Resolved webhook configuration with actual env var values
 */
interface ResolvedWebhookConfig extends WebhookConfig {
	url: string;
	secret: string;
}

/**
 * Initialize webhooks from configuration
 *
 * This function should be called during server startup to:
 * 1. Load webhooks from config
 * 2. Resolve environment variable references
 * 3. Create dispatcher
 * 4. Connect to realtime emitter
 *
 * @param config - The BetterBase configuration
 * @param realtimeEmitter - The event emitter from the realtime layer
 * @param db - Optional database client for persistent delivery logging
 * @returns The webhook dispatcher if webhooks are configured, null otherwise
 */
export function initializeWebhooks(
	config: BetterBaseConfig,
	realtimeEmitter: EventEmitter,
	db?: WebhookDbClient,
): WebhookDispatcher | null {
	const webhooks = config.webhooks;

	if (!webhooks || webhooks.length === 0) {
		return null;
	}

	// Resolve webhook configurations with actual env var values
	const resolvedWebhooks: ResolvedWebhookConfig[] = [];
	const missingEnvVars: string[] = [];

	for (const webhook of webhooks) {
		// Skip disabled webhooks
		if (!webhook.enabled) {
			continue;
		}

		// Extract env var names from process.env references
		const urlMatch = webhook.url.match(/^process\.env\.(\w+)$/);
		const secretMatch = webhook.secret.match(/^process\.env\.(\w+)$/);

		if (!urlMatch || !secretMatch) {
			console.warn(
				`[webhooks] Skipping webhook ${webhook.id}: URL and secret must be environment variable references`,
			);
			continue;
		}

		const urlEnvVar = urlMatch[1];
		const secretEnvVar = secretMatch[1];

		// Get actual values from environment
		const url = process.env[urlEnvVar];
		const secret = process.env[secretEnvVar];

		if (!url) {
			missingEnvVars.push(urlEnvVar);
			console.warn(
				`[webhooks] Skipping webhook ${webhook.id}: ${urlEnvVar} environment variable is not set`,
			);
			continue;
		}

		if (!secret) {
			missingEnvVars.push(secretEnvVar);
			console.warn(
				`[webhooks] Skipping webhook ${webhook.id}: ${secretEnvVar} environment variable is not set`,
			);
			continue;
		}

		resolvedWebhooks.push({
			...webhook,
			url,
			secret,
		});
	}

	if (resolvedWebhooks.length === 0) {
		if (missingEnvVars.length > 0) {
			console.warn(
				`[webhooks] No webhooks initialized. Missing environment variables: ${[
					...new Set(missingEnvVars),
				].join(", ")}`,
			);
		} else {
			console.log("[webhooks] No webhooks configured");
		}
		return null;
	}

	// Create dispatcher with resolved configs and optional database client
	let dispatcher: WebhookDispatcher;
	if (db) {
		dispatcher = new WebhookDispatcher(resolvedWebhooks, db);
	} else {
		dispatcher = new WebhookDispatcher(resolvedWebhooks);
	}

	// Connect to realtime emitter
	connectToRealtime(dispatcher, realtimeEmitter);

	console.log(`[webhooks] Active: ${resolvedWebhooks.length} webhook(s) configured`);
	if (db) {
		console.log("[webhooks] Delivery logging: enabled (database)");
	} else {
		console.log("[webhooks] Delivery logging: enabled (in-memory only)");
	}

	return dispatcher;
}
