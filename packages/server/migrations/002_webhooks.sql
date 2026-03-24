CREATE TABLE IF NOT EXISTS betterbase_meta.webhooks (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  table_name TEXT NOT NULL,
  events     TEXT[] NOT NULL,
  url        TEXT NOT NULL,
  secret     TEXT,
  enabled    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);