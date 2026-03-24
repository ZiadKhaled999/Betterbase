-- Betterbase internal metadata schema
-- Runs once on first container start via the bootstrap process

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE SCHEMA IF NOT EXISTS betterbase_meta;

-- Admin accounts (these are Betterbase operators, not end-users of projects)
CREATE TABLE IF NOT EXISTS betterbase_meta.admin_users (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  email       TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Projects registered in this Betterbase instance
CREATE TABLE IF NOT EXISTS betterbase_meta.projects (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name          TEXT NOT NULL,
  slug          TEXT NOT NULL UNIQUE,
  admin_key_hash TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Device auth codes for CLI `bb login` flow
CREATE TABLE IF NOT EXISTS betterbase_meta.device_codes (
  user_code     TEXT PRIMARY KEY,
  device_code   TEXT NOT NULL UNIQUE,
  admin_user_id TEXT REFERENCES betterbase_meta.admin_users(id) ON DELETE CASCADE,
  expires_at    TIMESTAMPTZ NOT NULL,
  verified      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- CLI sessions — issued after device code verified
CREATE TABLE IF NOT EXISTS betterbase_meta.cli_sessions (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  admin_user_id TEXT NOT NULL REFERENCES betterbase_meta.admin_users(id) ON DELETE CASCADE,
  token_hash    TEXT NOT NULL UNIQUE,
  expires_at    TIMESTAMPTZ NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Migration tracking
CREATE TABLE IF NOT EXISTS betterbase_meta.migrations (
  id         SERIAL PRIMARY KEY,
  filename   TEXT NOT NULL UNIQUE,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);