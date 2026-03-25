CREATE TABLE IF NOT EXISTS betterbase_meta.api_keys (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  admin_user_id TEXT NOT NULL REFERENCES betterbase_meta.admin_users(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  key_hash      TEXT NOT NULL UNIQUE,   -- SHA-256 of the plaintext key
  key_prefix    TEXT NOT NULL,          -- first 8 chars for identification, e.g. "bb_live_"
  scopes        TEXT[] NOT NULL DEFAULT '{}',  -- [] = full access, or specific domains
  last_used_at  TIMESTAMPTZ,
  expires_at    TIMESTAMPTZ,            -- NULL = never expires
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);