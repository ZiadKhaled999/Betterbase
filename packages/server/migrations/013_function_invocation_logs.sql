-- Migration 013: Function invocation logs for observability
-- Creates table to track function invocations for tracing UI

CREATE TABLE IF NOT EXISTS betterbase_meta.function_invocation_logs (
  id              TEXT PRIMARY KEY,
  function_id     TEXT NOT NULL REFERENCES betterbase_meta.functions(id)
                    ON DELETE CASCADE,
  function_name   TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending',
                  -- 'success' | 'error' | 'timeout' | 'pending'
  duration_ms     INT,
  cold_start      BOOLEAN NOT NULL DEFAULT FALSE,
  request_method  TEXT,
  request_path    TEXT,
  response_status INT,
  error_msg       TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fil_function_id
  ON betterbase_meta.function_invocation_logs (function_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_fil_status
  ON betterbase_meta.function_invocation_logs (status, created_at DESC);
