-- Webhook Delivery Logs Table
-- Stores every webhook delivery attempt for debugging and monitoring

CREATE TABLE IF NOT EXISTS _betterbase_webhook_deliveries (
    id TEXT PRIMARY KEY,
    webhook_id TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('success', 'failed', 'pending')),
    request_url TEXT NOT NULL,
    request_body TEXT,
    response_code INTEGER,
    response_body TEXT,
    error TEXT,
    attempt_count INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT (datetime('now')),
    updated_at TIMESTAMP NOT NULL DEFAULT (datetime('now'))
);

-- Index for fast lookups by webhook ID
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_webhook_id 
    ON _betterbase_webhook_deliveries(webhook_id);

-- Index for fast lookups by creation date (descending order)
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_created_at 
    ON _betterbase_webhook_deliveries(created_at DESC);
