-- Webhook delivery attempts
CREATE TABLE IF NOT EXISTS betterbase_meta.webhook_deliveries (
  id          BIGSERIAL PRIMARY KEY,
  webhook_id  TEXT NOT NULL REFERENCES betterbase_meta.webhooks(id) ON DELETE CASCADE,
  event_type  TEXT NOT NULL,
  payload     JSONB NOT NULL,
  status      TEXT NOT NULL DEFAULT 'pending',  -- pending | success | failed
  response_code  INTEGER,
  response_body  TEXT,
  duration_ms    INTEGER,
  attempt_count  INTEGER NOT NULL DEFAULT 1,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  delivered_at   TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_webhook_id ON betterbase_meta.webhook_deliveries (webhook_id, created_at DESC);

-- Function invocation log
CREATE TABLE IF NOT EXISTS betterbase_meta.function_invocations (
  id           BIGSERIAL PRIMARY KEY,
  function_id  TEXT NOT NULL REFERENCES betterbase_meta.functions(id) ON DELETE CASCADE,
  trigger_type TEXT NOT NULL DEFAULT 'http',   -- http | schedule | event
  status       TEXT NOT NULL,                  -- success | error | timeout
  duration_ms  INTEGER,
  error_message TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_function_invocations_function_id ON betterbase_meta.function_invocations (function_id, created_at DESC);