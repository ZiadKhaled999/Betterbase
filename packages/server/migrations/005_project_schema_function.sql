CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Provisions a BetterAuth-compatible schema for a project
CREATE OR REPLACE FUNCTION betterbase_meta.provision_project_schema(p_slug TEXT)
RETURNS VOID AS $$
DECLARE
  s TEXT := 'project_' || p_slug;
BEGIN
  EXECUTE format('CREATE SCHEMA IF NOT EXISTS %I', s);

  EXECUTE format($f$
    CREATE TABLE IF NOT EXISTS %I."user" (
      id              TEXT PRIMARY KEY,
      name            TEXT NOT NULL,
      email           TEXT NOT NULL UNIQUE,
      email_verified  BOOLEAN NOT NULL DEFAULT FALSE,
      image           TEXT,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      banned          BOOLEAN NOT NULL DEFAULT FALSE,
      ban_reason      TEXT,
      ban_expires     TIMESTAMPTZ
    )
  $f$, s);

  EXECUTE format($f$
    CREATE TABLE IF NOT EXISTS %I.session (
      id              TEXT PRIMARY KEY,
      expires_at      TIMESTAMPTZ NOT NULL,
      token           TEXT NOT NULL UNIQUE,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      ip_address      TEXT,
      user_agent      TEXT,
      user_id         TEXT NOT NULL REFERENCES %I."user"(id) ON DELETE CASCADE
    )
  $f$, s, s);

  EXECUTE format($f$
    CREATE TABLE IF NOT EXISTS %I.account (
      id                        TEXT PRIMARY KEY,
      account_id                TEXT NOT NULL,
      provider_id               TEXT NOT NULL,
      user_id                   TEXT NOT NULL REFERENCES %I."user"(id) ON DELETE CASCADE,
      access_token              TEXT,
      refresh_token             TEXT,
      id_token                  TEXT,
      access_token_expires_at   TIMESTAMPTZ,
      refresh_token_expires_at  TIMESTAMPTZ,
      scope                     TEXT,
      password                  TEXT,
      created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  $f$, s, s);

  EXECUTE format($f$
    CREATE TABLE IF NOT EXISTS %I.verification (
      id           TEXT PRIMARY KEY,
      identifier   TEXT NOT NULL,
      value        TEXT NOT NULL,
      expires_at   TIMESTAMPTZ NOT NULL,
      created_at   TIMESTAMPTZ DEFAULT NOW(),
      updated_at   TIMESTAMPTZ DEFAULT NOW()
    )
  $f$, s);

  -- Auth config table (provider settings for this project)
  EXECUTE format($f$
    CREATE TABLE IF NOT EXISTS %I.auth_config (
      key    TEXT PRIMARY KEY,
      value  JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  $f$, s);

  -- Environment variables for this project
  EXECUTE format($f$
    CREATE TABLE IF NOT EXISTS %I.env_vars (
      key        TEXT PRIMARY KEY,
      value      TEXT NOT NULL,
      is_secret  BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  $f$, s);

END;
$$ LANGUAGE plpgsql;