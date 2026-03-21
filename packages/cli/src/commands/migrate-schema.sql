-- Migration tracking table for BetterBase
-- Used to track applied migrations and enable rollback functionality

-- For PostgreSQL
CREATE TABLE IF NOT EXISTS _betterbase_migrations (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  checksum TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_migrations_name 
  ON _betterbase_migrations(name);

-- For SQLite (alternative - used if PostgreSQL not available)
-- SQLite uses INTEGER PRIMARY KEY AUTOINCREMENT instead of SERIAL
CREATE TABLE IF NOT EXISTS _betterbase_migrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  checksum TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_migrations_name 
  ON _betterbase_migrations(name);
