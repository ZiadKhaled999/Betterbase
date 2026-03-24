CREATE TABLE IF NOT EXISTS betterbase_meta.request_logs (
  id          BIGSERIAL PRIMARY KEY,
  method      TEXT NOT NULL,
  path        TEXT NOT NULL,
  status      INT NOT NULL,
  duration_ms INT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for dashboard queries
CREATE INDEX IF NOT EXISTS idx_request_logs_created_at
  ON betterbase_meta.request_logs (created_at DESC);