-- Built-in roles (seeded, not user-created)
CREATE TABLE IF NOT EXISTS betterbase_meta.roles (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL UNIQUE,  -- owner | admin | developer | viewer
  description TEXT NOT NULL,
  is_system   BOOLEAN NOT NULL DEFAULT FALSE,  -- system roles cannot be deleted
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Granular permissions
CREATE TABLE IF NOT EXISTS betterbase_meta.permissions (
  id       TEXT PRIMARY KEY,
  domain   TEXT NOT NULL,   -- projects | users | storage | functions | webhooks | logs | team | settings | audit
  action   TEXT NOT NULL,   -- view | create | edit | delete | export
  UNIQUE (domain, action)
);

-- Role ↔ permission mapping
CREATE TABLE IF NOT EXISTS betterbase_meta.role_permissions (
  role_id       TEXT NOT NULL REFERENCES betterbase_meta.roles(id) ON DELETE CASCADE,
  permission_id TEXT NOT NULL REFERENCES betterbase_meta.permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

-- Admin ↔ role assignment (scoped per project, NULL = instance-wide)
CREATE TABLE IF NOT EXISTS betterbase_meta.admin_roles (
  id             TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  admin_user_id  TEXT NOT NULL REFERENCES betterbase_meta.admin_users(id) ON DELETE CASCADE,
  role_id        TEXT NOT NULL REFERENCES betterbase_meta.roles(id) ON DELETE CASCADE,
  project_id     TEXT REFERENCES betterbase_meta.projects(id) ON DELETE CASCADE,  -- NULL = global
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (admin_user_id, role_id, project_id)
);

-- Seed built-in roles
INSERT INTO betterbase_meta.roles (id, name, description, is_system) VALUES
  ('role_owner',     'owner',     'Full access to everything. Cannot be deleted.', TRUE),
  ('role_admin',     'admin',     'Full access except deleting other owners.',     TRUE),
  ('role_developer', 'developer', 'Can manage projects, functions, storage. Cannot manage team or settings.', TRUE),
  ('role_viewer',    'viewer',    'Read-only access to all resources.',            TRUE)
ON CONFLICT (name) DO NOTHING;

-- Seed permissions
INSERT INTO betterbase_meta.permissions (id, domain, action) VALUES
  ('perm_projects_view',    'projects',  'view'),
  ('perm_projects_create',  'projects',  'create'),
  ('perm_projects_edit',    'projects',  'edit'),
  ('perm_projects_delete',  'projects',  'delete'),
  ('perm_users_view',       'users',     'view'),
  ('perm_users_create',     'users',     'create'),
  ('perm_users_edit',       'users',     'edit'),
  ('perm_users_delete',     'users',     'delete'),
  ('perm_users_export',     'users',     'export'),
  ('perm_storage_view',     'storage',   'view'),
  ('perm_storage_create',   'storage',   'create'),
  ('perm_storage_edit',     'storage',   'edit'),
  ('perm_storage_delete',   'storage',   'delete'),
  ('perm_functions_view',   'functions', 'view'),
  ('perm_functions_create', 'functions', 'create'),
  ('perm_functions_edit',   'functions', 'edit'),
  ('perm_functions_delete', 'functions', 'delete'),
  ('perm_webhooks_view',    'webhooks',  'view'),
  ('perm_webhooks_create',  'webhooks',  'create'),
  ('perm_webhooks_edit',    'webhooks',  'edit'),
  ('perm_webhooks_delete',  'webhooks',  'delete'),
  ('perm_logs_view',        'logs',      'view'),
  ('perm_logs_export',      'logs',      'export'),
  ('perm_team_view',        'team',      'view'),
  ('perm_team_create',      'team',      'create'),
  ('perm_team_edit',        'team',      'edit'),
  ('perm_team_delete',      'team',      'delete'),
  ('perm_settings_view',    'settings',  'view'),
  ('perm_settings_edit',    'settings',  'edit'),
  ('perm_audit_view',       'audit',     'view'),
  ('perm_audit_export',     'audit',     'export')
ON CONFLICT (domain, action) DO NOTHING;

-- Owner: all permissions
INSERT INTO betterbase_meta.role_permissions (role_id, permission_id)
  SELECT 'role_owner', id FROM betterbase_meta.permissions
ON CONFLICT DO NOTHING;

-- Admin: all except settings_edit and audit_export
INSERT INTO betterbase_meta.role_permissions (role_id, permission_id)
  SELECT 'role_admin', id FROM betterbase_meta.permissions
  WHERE id NOT IN ('perm_settings_edit')
ON CONFLICT DO NOTHING;

-- Developer: projects+users+storage+functions+webhooks+logs (no team, no settings, no audit)
INSERT INTO betterbase_meta.role_permissions (role_id, permission_id)
  SELECT 'role_developer', id FROM betterbase_meta.permissions
  WHERE domain IN ('projects','users','storage','functions','webhooks','logs')
ON CONFLICT DO NOTHING;

-- Viewer: all view permissions only
INSERT INTO betterbase_meta.role_permissions (role_id, permission_id)
  SELECT 'role_viewer', id FROM betterbase_meta.permissions
  WHERE action = 'view'
ON CONFLICT DO NOTHING;