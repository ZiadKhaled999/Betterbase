import type { DBEventType } from '@betterbase/shared'

/**
 * Webhook configuration - typically loaded from environment variables
 */
export interface WebhookConfig {
  /** Unique webhook identifier */
  id: string
  /** Database table name to listen to */
  table: string
  /** Events to trigger webhook */
  events: Array<DBEventType>
  /** Destination URL for webhook delivery */
  url: string
  /** Secret used for HMAC signature verification */
  secret: string
  /** Whether webhook is active */
  enabled: boolean
}

/**
 * Payload sent to webhook endpoint
 */
export interface WebhookPayload {
  /** Unique delivery identifier (UUID) */
  id: string
  /** Source webhook ID */
  webhook_id: string
  /** Database table name */
  table: string
  /** Event type */
  type: DBEventType
  /** New record data */
  record: Record<string, unknown>
  /** Old record data (UPDATE/DELETE only) */
  old_record?: Record<string, unknown>
  /** ISO 8601 timestamp */
  timestamp: string
}
