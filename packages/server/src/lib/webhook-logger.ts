import { nanoid } from "nanoid";
import { getPool } from "./db";

export interface WebhookDeliveryRecord {
	webhookId: string;
	eventType: string;
	tableName: string;
	payload?: unknown;
	status: "success" | "failed" | "pending";
	httpStatus?: number;
	durationMs?: number;
	errorMsg?: string;
	attempt?: number;
}

export async function logWebhookDelivery(r: WebhookDeliveryRecord): Promise<void> {
	await getPool().query(
		`INSERT INTO betterbase_meta.webhook_delivery_logs
		(id, webhook_id, event_type, table_name, payload, status, http_status, duration_ms, error_msg, attempt)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
		[
			nanoid(),
			r.webhookId,
			r.eventType,
			r.tableName,
			r.payload ? JSON.stringify(r.payload) : null,
			r.status,
			r.httpStatus ?? null,
			r.durationMs ?? null,
			r.errorMsg ?? null,
			r.attempt ?? 1,
		],
	);
}
