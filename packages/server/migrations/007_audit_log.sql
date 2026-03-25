CREATE TABLE IF NOT EXISTS betterbase_meta.audit_log (
  id            BIGSERIAL PRIMARY KEY,
  actor_id      TEXT,                    -- admin_user.id, NULL for system events
  actor_email   TEXT,                    -- denormalized for log permanence
  action        TEXT NOT NULL,           -- e.g. "project.create", "user.ban", "admin.login"
  resource_type TEXT,                    -- "project" | "user" | "webhook" | etc.
  resource_id   TEXT,
  resource_name TEXT,                    -- human-readable snapshot
  before_data   JSONB,                   -- state before mutation (NULL for creates)
  after_data    JSONB,                   -- state after mutation (NULL for deletes)
  ip_address    TEXT,
  user_agent    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Cannot UPDATE or DELETE from this table (enforced by route layer — no update/delete routes exist)
-- Index for dashboard queries
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON betterbase_meta.audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_actor_id   ON betterbase_meta.audit_log (actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_action     ON betterbase_meta.audit_log (action);
CREATE INDEX IF NOT EXISTS idx_audit_log_resource   ON betterbase_meta.audit_log (resource_type, resource_id);