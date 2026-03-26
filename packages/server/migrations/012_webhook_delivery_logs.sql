-- Migration 012: Webhook delivery logs for observability
-- Creates table to track webhook delivery attempts for debugging UI

CREATE TABLE IF NOT EXISTS betterbase_meta.webhook_delivery_logs (
  id           TEXT PRIMARY KEY,
  webhook_id   TEXT NOT NULL REFERENCES betterbase_meta.webhooks(id)
                 ON DELETE CASCADE,
  event_type   TEXT NOT NULL,
  table_name   TEXT NOT NULL,
  payload      JSONB,
  status       TEXT NOT NULL DEFAULT 'pending',
               -- 'success' | 'failed' | 'pending'
  http_status  INT,
  duration_ms  INT,
  error_msg    TEXT,
  attempt      INT NOT NULL DEFAULT 1,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wdl_webhook_id
  ON betterbase_meta.webhook_delivery_logs (webhook_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_wdl_status
  ON betterbase_meta.webhook_delivery_logs (status, created_at DESC);
