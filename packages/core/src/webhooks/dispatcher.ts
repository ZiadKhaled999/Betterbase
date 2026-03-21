import { randomUUID } from "node:crypto";
import type { DBEvent } from "@betterbase/shared";
import { signPayload } from "./signer";
import type { WebhookConfig, WebhookPayload } from "./types";
import { nanoid } from "nanoid";

/** Retry configuration */
export interface RetryConfig {
	/** Delays in milliseconds for each retry attempt */
	delays: number[];
	/** Maximum number of retry attempts */
	maxRetries: number;
}

/** Default retry configuration */
const DEFAULT_RETRY_CONFIG: RetryConfig = {
	delays: [1000, 5000, 30000], // 1s, 5s, 30s - exponential backoff
	maxRetries: 3,
};

/**
 * Create retry configuration from environment or defaults
 */
function getRetryConfig(): RetryConfig {
	// Allow environment variable override (comma-separated milliseconds)
	const envDelays = process.env.WEBHOOK_RETRY_DELAYS;
	const envMaxRetries = process.env.WEBHOOK_MAX_RETRIES;

	if (envDelays) {
		const delays = envDelays
			.split(",")
			.map((d) => Number.parseInt(d.trim(), 10))
			.filter((d) => !Number.isNaN(d));
		const maxRetries = envMaxRetries ? Number.parseInt(envMaxRetries, 10) : delays.length;

		if (delays.length > 0) {
			return { delays, maxRetries: Math.max(1, maxRetries) };
		}
	}

	return { ...DEFAULT_RETRY_CONFIG };
}

/**
 * Database client interface for webhook delivery logging
 */
export interface WebhookDbClient {
	execute(args: {
		sql: string;
		args: unknown[];
	}): Promise<{ rows: unknown[] }>;
}

/**
 * Webhook delivery log entry (for database storage)
 */
export interface WebhookDeliveryLog {
	id: string;
	webhook_id: string;
	status: "success" | "failed" | "pending";
	request_url: string;
	request_body: string | null;
	response_code: number | null;
	response_body: string | null;
	error: string | null;
	attempt_count: number;
	created_at: Date;
	updated_at: Date;
}

/**
 * WebhookDispatcher handles sending webhook payloads to configured endpoints
 */
export class WebhookDispatcher {
	private configs: WebhookConfig[];
	private db: WebhookDbClient | null = null;
	private deliveryLogs: WebhookDeliveryLog[] = [];
	private maxLogs = 1000; // Keep last 1000 logs in memory when no DB

	private retryConfig: RetryConfig;

	constructor(configs: WebhookConfig[], retryConfig?: Partial<RetryConfig>);
	constructor(configs: WebhookConfig[], db: WebhookDbClient, retryConfig?: Partial<RetryConfig>);
	constructor(
		configs: WebhookConfig[],
		dbOrRetryConfig?: WebhookDbClient | Partial<RetryConfig>,
		retryConfigArg?: Partial<RetryConfig>,
	) {
		// Filter to only enabled webhooks
		this.configs = configs.filter((config) => config.enabled);

		// Handle overloaded constructor
		if (dbOrRetryConfig && "execute" in dbOrRetryConfig) {
			// First arg is db client
			this.db = dbOrRetryConfig as WebhookDbClient;
			this.retryConfig = { ...DEFAULT_RETRY_CONFIG, ...retryConfigArg };
		} else {
			// First arg is retry config or undefined
			this.retryConfig = { ...DEFAULT_RETRY_CONFIG, ...(dbOrRetryConfig as Partial<RetryConfig> | undefined) };
		}
	}

	/**
	 * Set the database client after construction (for delayed initialization)
	 */
	setDb(db: WebhookDbClient): void {
		this.db = db;
	}

	/**
	 * Get all webhook configurations
	 */
	getConfigs(): WebhookConfig[] {
		return this.configs;
	}

	/**
	 * Get webhook config by ID
	 */
	getConfigById(id: string): WebhookConfig | undefined {
		return this.configs.find((config) => config.id === id);
	}

	/**
	 * Get delivery logs for a specific webhook
	 * @param webhookId - The webhook ID to get logs for
	 * @param limit - Maximum number of logs to return (default 50)
	 */
	async getDeliveryLogs(webhookId: string, limit = 50): Promise<WebhookDeliveryLog[]> {
		// If database is available, use it
		if (this.db) {
			const result = await this.db.execute({
				sql: `
					SELECT * FROM _betterbase_webhook_deliveries
					WHERE webhook_id = ?
					ORDER BY created_at DESC
					LIMIT ?
				`,
				args: [webhookId, limit],
			});
			return result.rows as WebhookDeliveryLog[];
		}

		// Fallback to in-memory logs
		return this.deliveryLogs
			.filter((log) => log.webhook_id === webhookId)
			.slice(-limit)
			.reverse();
	}

	/**
	 * Dispatch a webhook for a database event
	 * Uses fire-and-forget pattern - doesn't await response
	 * @param event - The database event to dispatch
	 */
	async dispatch(event: DBEvent): Promise<void> {
		// Find matching webhooks by table name and event type
		const webhooksToCall = this.configs.filter(
			(config) => config.table === event.table && config.events.includes(event.type),
		);

		// Dispatch to all matching webhooks
		for (const config of webhooksToCall) {
			this.deliverWebhook(config, event).catch((error) => {
				// Log failure - fire-and-forget from caller's perspective
				console.error(
					JSON.stringify({
						type: "webhook_delivery_failed",
						webhook_id: config.id,
						table: event.table,
						event_type: event.type,
						error: error instanceof Error ? error.message : String(error),
						timestamp: new Date().toISOString(),
					}),
				);
			});
		}
	}

	/**
	 * Test a webhook by dispatching a synthetic payload
	 * @param webhookId - The webhook ID to test
	 * @returns The delivery result including status and response
	 */
	async testWebhook(webhookId: string): Promise<{
		success: boolean;
		status_code?: number;
		response_body?: string;
		error?: string;
	}> {
		const config = this.getConfigById(webhookId);
		if (!config) {
			return {
				success: false,
				error: `Webhook not found: ${webhookId}`,
			};
		}

		// Create synthetic test payload
		const testPayload: WebhookPayload = {
			id: randomUUID(),
			webhook_id: config.id,
			table: config.table,
			type: "INSERT",
			record: {
				id: 1,
				created_at: new Date().toISOString(),
				// Sample data based on table
			},
			timestamp: new Date().toISOString(),
		};

		const signature = signPayload(testPayload, config.secret);
		const deliveryId = nanoid();

		// Create delivery log entry BEFORE sending (if DB is available)
		if (this.db) {
			await this.createDeliveryLog({
				id: deliveryId,
				webhook_id: config.id,
				status: "pending",
				request_url: config.url,
				request_body: JSON.stringify(testPayload),
				response_code: null,
				response_body: null,
				error: null,
				attempt_count: 1,
			});
		}

		try {
			const response = await fetch(config.url, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"X-Webhook-Signature": signature,
					"X-Webhook-ID": testPayload.webhook_id,
					"X-Webhook-Timestamp": testPayload.timestamp,
					"X-Webhook-Test": "true",
				},
				body: JSON.stringify(testPayload),
			});

			const responseBody = await response.text();

			// Update delivery log AFTER response (if DB is available)
			if (this.db) {
				await this.updateDeliveryLog(deliveryId, {
					status: response.ok ? "success" : "failed",
					response_code: response.status,
					response_body: responseBody.slice(0, 500), // Limit response body length
				});
			}

			// Also add to in-memory log
			this.addDeliveryLog({
				id: testPayload.id,
				webhook_id: config.id,
				table: config.table,
				event_type: "INSERT",
				timestamp: testPayload.timestamp,
				status: response.ok ? "success" : "failed",
				status_code: response.status,
				response_body: responseBody.slice(0, 500),
				retry_count: 0,
			});

			return {
				success: response.ok,
				status_code: response.status,
				response_body: responseBody,
			};
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);

			// Update delivery log with error (if DB is available)
			if (this.db) {
				await this.updateDeliveryLog(deliveryId, {
					status: "failed",
					error: errorMessage,
				});
			}

			// Also add to in-memory log
			this.addDeliveryLog({
				id: testPayload.id,
				webhook_id: config.id,
				table: config.table,
				event_type: "INSERT",
				timestamp: testPayload.timestamp,
				status: "failed",
				retry_count: 0,
				error: errorMessage,
			});

			return {
				success: false,
				error: errorMessage,
			};
		}
	}

	/**
	 * Create a delivery log entry in the database
	 */
	private async createDeliveryLog(log: Omit<WebhookDeliveryLog, "created_at" | "updated_at">): Promise<void> {
		if (!this.db) return;

		try {
			await this.db.execute({
				sql: `
					INSERT INTO _betterbase_webhook_deliveries 
					(id, webhook_id, status, request_url, request_body, response_code, response_body, error, attempt_count)
					VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
				`,
				args: [
					log.id,
					log.webhook_id,
					log.status,
					log.request_url,
					log.request_body,
					log.response_code,
					log.response_body,
					log.error,
					log.attempt_count,
				],
			});
		} catch (error) {
			// Log error but don't throw - logging should not break webhook delivery
			console.error("Failed to create delivery log:", error);
		}
	}

	/**
	 * Update a delivery log entry in the database
	 */
	private async updateDeliveryLog(
		deliveryId: string,
		updates: {
			status?: "success" | "failed" | "pending";
			response_code?: number | null;
			response_body?: string | null;
			error?: string | null;
		},
	): Promise<void> {
		if (!this.db) return;

		const setClauses: string[] = [];
		const args: unknown[] = [];

		if (updates.status !== undefined) {
			setClauses.push("status = ?");
			args.push(updates.status);
		}
		if (updates.response_code !== undefined) {
			setClauses.push("response_code = ?");
			args.push(updates.response_code);
		}
		if (updates.response_body !== undefined) {
			setClauses.push("response_body = ?");
			args.push(updates.response_body);
		}
		if (updates.error !== undefined) {
			setClauses.push("error = ?");
			args.push(updates.error);
		}

		setClauses.push("updated_at = datetime('now')");
		args.push(deliveryId);

		try {
			await this.db.execute({
				sql: `UPDATE _betterbase_webhook_deliveries SET ${setClauses.join(", ")} WHERE id = ?`,
				args,
			});
		} catch (error) {
			// Log error but don't throw - logging should not break webhook delivery
			console.error("Failed to update delivery log:", error);
		}
	}

	/**
	 * Add a delivery log entry (in-memory fallback)
	 */
	private addDeliveryLog(log: {
		id: string;
		webhook_id: string;
		table: string;
		event_type: string;
		timestamp: string;
		status: "success" | "failed";
		status_code?: number;
		response_body?: string;
		retry_count: number;
		error?: string;
	}): void {
		// Convert to the in-memory format
		const memLog: WebhookDeliveryLog = {
			id: log.id,
			webhook_id: log.webhook_id,
			status: log.status,
			request_url: "",
			request_body: null,
			response_code: log.status_code ?? null,
			response_body: log.response_body ?? null,
			error: log.error ?? null,
			attempt_count: log.retry_count + 1,
			created_at: new Date(log.timestamp),
			updated_at: new Date(),
		};
		this.deliveryLogs.push(memLog);
		// Trim logs if exceeding max
		if (this.deliveryLogs.length > this.maxLogs) {
			this.deliveryLogs = this.deliveryLogs.slice(-this.maxLogs);
		}
	}

	/**
	 * Deliver a webhook to a specific endpoint with retry logic
	 * @param config - Webhook configuration
	 * @param event - Database event
	 */
	private async deliverWebhook(config: WebhookConfig, event: DBEvent): Promise<void> {
		const payload: WebhookPayload = {
			id: randomUUID(),
			webhook_id: config.id,
			table: event.table,
			type: event.type,
			record: event.record,
			old_record: event.old_record,
			timestamp: event.timestamp,
		};

		const signature = signPayload(payload, config.secret);
		const deliveryId = nanoid();

		// Create delivery log entry BEFORE sending (if DB is available)
		if (this.db) {
			await this.createDeliveryLog({
				id: deliveryId,
				webhook_id: config.id,
				status: "pending",
				request_url: config.url,
				request_body: JSON.stringify(payload),
				response_code: null,
				response_body: null,
				error: null,
				attempt_count: 1,
			});
		}

		await this.sendWithRetry(config, payload, signature, deliveryId);
	}

	/**
	 * Send webhook with exponential backoff retry
	 */
	private async sendWithRetry(
		config: WebhookConfig,
		payload: WebhookPayload,
		signature: string,
		deliveryId: string,
	): Promise<void> {
		let lastError: Error | unknown;
		let attempt = 0;

		while (attempt < this.retryConfig.maxRetries) {
			try {
				const response = await fetch(config.url, {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						"X-Webhook-Signature": signature,
						"X-Webhook-ID": payload.webhook_id,
						"X-Webhook-Timestamp": payload.timestamp,
					},
					body: JSON.stringify(payload),
				});

				const responseBody = await response.text();

				// Update delivery log with response (if DB is available)
				if (this.db) {
					await this.updateDeliveryLog(deliveryId, {
						status: response.ok ? "success" : "failed",
						response_code: response.status,
						response_body: responseBody,
					});
				}

				if (response.ok) {
					// Success - return immediately
					return;
				}

				// Non-2xx response - treat as error
				lastError = new Error(`HTTP ${response.status}: ${response.statusText}`);
			} catch (error) {
				lastError = error;
			}

			attempt++;

			// If not last attempt, wait with exponential backoff
			if (attempt < this.retryConfig.maxRetries) {
				const delay = this.retryConfig.delays[attempt - 1];
				await new Promise((resolve) => setTimeout(resolve, delay));
			}
		}

		// All retries exhausted - update log with final error
		if (this.db) {
			await this.updateDeliveryLog(deliveryId, {
				status: "failed",
				error: lastError instanceof Error ? lastError.message : String(lastError),
			});
		}

		// All retries exhausted - throw the last error
		throw lastError;
	}
}
