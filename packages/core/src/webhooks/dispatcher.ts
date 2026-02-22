import { randomUUID } from 'crypto'
import type { WebhookConfig, WebhookPayload } from './types'
import { signPayload } from './signer'
import type { DBEvent } from '@betterbase/shared'

/** Retry configuration */
export interface RetryConfig {
  /** Delays in milliseconds for each retry attempt */
  delays: number[]
  /** Maximum number of retry attempts */
  maxRetries: number
}

/** Default retry configuration */
const DEFAULT_RETRY_CONFIG: RetryConfig = {
  delays: [1000, 5000, 30000], // 1s, 5s, 30s - exponential backoff
  maxRetries: 3,
}

/**
 * Create retry configuration from environment or defaults
 */
function getRetryConfig(): RetryConfig {
  // Allow environment variable override (comma-separated milliseconds)
  const envDelays = process.env.WEBHOOK_RETRY_DELAYS
  const envMaxRetries = process.env.WEBHOOK_MAX_RETRIES

  if (envDelays) {
    const delays = envDelays.split(',').map((d) => parseInt(d.trim(), 10)).filter((d) => !isNaN(d))
    const maxRetries = envMaxRetries ? parseInt(envMaxRetries, 10) : delays.length

    if (delays.length > 0) {
      return { delays, maxRetries: Math.max(1, maxRetries) }
    }
  }

  return { ...DEFAULT_RETRY_CONFIG }
}

/**
 * Webhook delivery log entry
 */
export interface WebhookDeliveryLog {
  id: string
  webhook_id: string
  table: string
  event_type: string
  timestamp: string
  status: 'success' | 'failed'
  status_code?: number
  response_body?: string
  retry_count: number
  error?: string
}

/**
 * WebhookDispatcher handles sending webhook payloads to configured endpoints
 */
export class WebhookDispatcher {
  private configs: WebhookConfig[]
  private deliveryLogs: WebhookDeliveryLog[] = []
  private maxLogs = 1000 // Keep last 1000 logs

  private retryConfig: RetryConfig

  constructor(configs: WebhookConfig[], retryConfig?: Partial<RetryConfig>) {
    // Filter to only enabled webhooks
    this.configs = configs.filter((config) => config.enabled)
    // Merge provided config with defaults
    this.retryConfig = { ...DEFAULT_RETRY_CONFIG, ...retryConfig }
  }

  /**
   * Get all webhook configurations
   */
  getConfigs(): WebhookConfig[] {
    return this.configs
  }

  /**
   * Get webhook config by ID
   */
  getConfigById(id: string): WebhookConfig | undefined {
    return this.configs.find((config) => config.id === id)
  }

  /**
   * Get delivery logs for a specific webhook
   */
  getDeliveryLogs(webhookId: string): WebhookDeliveryLog[] {
    return this.deliveryLogs
      .filter((log) => log.webhook_id === webhookId)
      .slice(-20) // Last 20 deliveries
      .reverse()
  }

  /**
   * Dispatch a webhook for a database event
   * Uses fire-and-forget pattern - doesn't await response
   * @param event - The database event to dispatch
   */
  async dispatch(event: DBEvent): Promise<void> {
    // Find matching webhooks by table name and event type
    const webhooksToCall = this.configs.filter(
      (config) =>
        config.table === event.table && config.events.includes(event.type)
    )

    // Dispatch to all matching webhooks
    for (const config of webhooksToCall) {
      this.deliverWebhook(config, event).catch((error) => {
        // Log failure - fire-and-forget from caller's perspective
        console.error(
          JSON.stringify({
            type: 'webhook_delivery_failed',
            webhook_id: config.id,
            table: event.table,
            event_type: event.type,
            error: error instanceof Error ? error.message : String(error),
            timestamp: new Date().toISOString(),
          })
        )
      })
    }
  }

  /**
   * Test a webhook by dispatching a synthetic payload
   * @param webhookId - The webhook ID to test
   * @returns The delivery result including status and response
   */
  async testWebhook(webhookId: string): Promise<{
    success: boolean
    status_code?: number
    response_body?: string
    error?: string
  }> {
    const config = this.getConfigById(webhookId)
    if (!config) {
      return {
        success: false,
        error: `Webhook not found: ${webhookId}`,
      }
    }

    // Create synthetic test payload
    const testPayload: WebhookPayload = {
      id: randomUUID(),
      webhook_id: config.id,
      table: config.table,
      type: 'INSERT',
      record: {
        id: 1,
        created_at: new Date().toISOString(),
        // Sample data based on table
      },
      timestamp: new Date().toISOString(),
    }

    const signature = signPayload(testPayload, config.secret)

    try {
      const response = await fetch(config.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': signature,
          'X-Webhook-ID': testPayload.webhook_id,
          'X-Webhook-Timestamp': testPayload.timestamp,
          'X-Webhook-Test': 'true',
        },
        body: JSON.stringify(testPayload),
      })

      const responseBody = await response.text()

      // Log this delivery
      this.addDeliveryLog({
        id: testPayload.id,
        webhook_id: config.id,
        table: config.table,
        event_type: 'INSERT',
        timestamp: testPayload.timestamp,
        status: response.ok ? 'success' : 'failed',
        status_code: response.status,
        response_body: responseBody.slice(0, 500), // Limit response body length
        retry_count: 0,
      })

      return {
        success: response.ok,
        status_code: response.status,
        response_body: responseBody,
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)

      // Log this delivery
      this.addDeliveryLog({
        id: testPayload.id,
        webhook_id: config.id,
        table: config.table,
        event_type: 'INSERT',
        timestamp: testPayload.timestamp,
        status: 'failed',
        retry_count: 0,
        error: errorMessage,
      })

      return {
        success: false,
        error: errorMessage,
      }
    }
  }

  /**
   * Add a delivery log entry
   */
  private addDeliveryLog(log: WebhookDeliveryLog): void {
    this.deliveryLogs.push(log)
    // Trim logs if exceeding max
    if (this.deliveryLogs.length > this.maxLogs) {
      this.deliveryLogs = this.deliveryLogs.slice(-this.maxLogs)
    }
  }

  /**
   * Deliver a webhook to a specific endpoint with retry logic
   * @param config - Webhook configuration
   * @param event - Database event
   */
  private async deliverWebhook(
    config: WebhookConfig,
    event: DBEvent
  ): Promise<void> {
    const payload: WebhookPayload = {
      id: randomUUID(),
      webhook_id: config.id,
      table: event.table,
      type: event.type,
      record: event.record,
      old_record: event.old_record,
      timestamp: event.timestamp,
    }

    const signature = signPayload(payload, config.secret)

    await this.sendWithRetry(config.url, payload, signature, config.secret)
  }

  /**
   * Send webhook with exponential backoff retry
   */
  private async sendWithRetry(
    url: string,
    payload: WebhookPayload,
    signature: string,
    secret: string
  ): Promise<void> {
    let lastError: Error | unknown

    for (let attempt = 0; attempt < this.retryConfig.maxRetries; attempt++) {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Webhook-Signature': signature,
            'X-Webhook-ID': payload.webhook_id,
            'X-Webhook-Timestamp': payload.timestamp,
          },
          body: JSON.stringify(payload),
        })

        if (response.ok) {
          // Success - return immediately
          return
        }

        // Non-2xx response - treat as error
        lastError = new Error(`HTTP ${response.status}: ${response.statusText}`)
      } catch (error) {
        lastError = error
      }

      // If not last attempt, wait with exponential backoff
      if (attempt < this.retryConfig.maxRetries - 1) {
        const delay = this.retryConfig.delays[attempt]
        await new Promise((resolve) => setTimeout(resolve, delay))
      }
    }

    // All retries exhausted - throw the last error
    throw lastError
  }
}
