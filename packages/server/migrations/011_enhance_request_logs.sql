-- Migration 011: Enhance request_logs with observability fields
-- Adds project_id, user_agent, ip, error_message to request_logs table

ALTER TABLE betterbase_meta.request_logs
  ADD COLUMN IF NOT EXISTS project_id TEXT,
  ADD COLUMN IF NOT EXISTS user_agent TEXT,
  ADD COLUMN IF NOT EXISTS ip TEXT,
  ADD COLUMN IF NOT EXISTS error_message TEXT;

-- Index for per-project queries
CREATE INDEX IF NOT EXISTS idx_req_logs_project
  ON betterbase_meta.request_logs (project_id, created_at DESC);

-- Index for latency percentile queries
CREATE INDEX IF NOT EXISTS idx_req_logs_duration
  ON betterbase_meta.request_logs (duration_ms, created_at DESC);
