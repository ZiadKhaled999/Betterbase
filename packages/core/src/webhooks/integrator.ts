import type { EventEmitter } from 'events'
import type { WebhookDispatcher } from './dispatcher'
import type { DBEvent } from '@betterbase/shared'

/**
 * Connect a WebhookDispatcher to a realtime event emitter
 * This bridges Phase 6 (Realtime WebSockets) with Phase 13 (Webhooks)
 * @param dispatcher - The webhook dispatcher instance
 * @param realtimeEmitter - The event emitter from the realtime layer
 */
export function connectToRealtime(
  dispatcher: WebhookDispatcher,
  realtimeEmitter: EventEmitter
): void {
  // Listen for all database change events
  // The event name format from Phase 6 should be: 'db:{table}:{eventType}'
  // or we can listen on a general 'db:change' event
  realtimeEmitter.on('db:change', (event: DBEvent) => {
    // Fire-and-forget - don't await
    dispatcher.dispatch(event).catch((error) => {
      console.error(
        JSON.stringify({
          type: 'webhook_realtime_integration_error',
          error: error instanceof Error ? error.message : String(error),
          timestamp: new Date().toISOString(),
        })
      )
    })
  })

  // Also support table-specific events if Phase 6 emits them
  // Format: 'db:{table}:insert', 'db:{table}:update', 'db:{table}:delete'
  realtimeEmitter.on('db:insert', (event: DBEvent) => {
    dispatcher.dispatch(event).catch(() => {
      // Silently fail - already logged in dispatcher
    })
  })

  realtimeEmitter.on('db:update', (event: DBEvent) => {
    dispatcher.dispatch(event).catch(() => {
      // Silently fail - already logged in dispatcher
    })
  })

  realtimeEmitter.on('db:delete', (event: DBEvent) => {
    dispatcher.dispatch(event).catch(() => {
      // Silently fail - already logged in dispatcher
    })
  })
}
