-- Generic key-value store for instance settings
CREATE TABLE IF NOT EXISTS betterbase_meta.instance_settings (
  key        TEXT PRIMARY KEY,
  value      JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by TEXT  -- admin_user.id
);

-- SMTP configuration
CREATE TABLE IF NOT EXISTS betterbase_meta.smtp_config (
  id          TEXT PRIMARY KEY DEFAULT 'singleton',  -- only one row ever
  host        TEXT NOT NULL,
  port        INTEGER NOT NULL DEFAULT 587,
  username    TEXT NOT NULL,
  password    TEXT NOT NULL,   -- encrypted at rest in future; plaintext for v1
  from_email  TEXT NOT NULL,
  from_name   TEXT NOT NULL DEFAULT 'Betterbase',
  use_tls     BOOLEAN NOT NULL DEFAULT TRUE,
  enabled     BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Notification rules
CREATE TABLE IF NOT EXISTS betterbase_meta.notification_rules (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name        TEXT NOT NULL,
  metric      TEXT NOT NULL,   -- "error_rate" | "storage_pct" | "auth_failures" | "response_time_p99"
  threshold   NUMERIC NOT NULL,
  channel     TEXT NOT NULL,   -- "email" | "webhook"
  target      TEXT NOT NULL,   -- email address or webhook URL
  enabled     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed default instance settings
INSERT INTO betterbase_meta.instance_settings (key, value) VALUES
  ('instance_name',    '"Betterbase"'),
  ('public_url',       '"http://localhost"'),
  ('contact_email',    '"admin@localhost"'),
  ('log_retention_days', '30'),
  ('max_sessions_per_user', '10'),
  ('require_email_verification', 'false'),
  ('ip_allowlist',     '[]'),
  ('cors_origins',     '["http://localhost"]')
ON CONFLICT (key) DO NOTHING;