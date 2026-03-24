CREATE TABLE IF NOT EXISTS betterbase_meta.functions (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL UNIQUE,
  runtime       TEXT NOT NULL DEFAULT 'bun',
  status        TEXT NOT NULL DEFAULT 'inactive',
  deploy_target TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);