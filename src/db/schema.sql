-- ORIGIN user/auth/task schema
-- Run against USER_DATABASE_URL to activate Postgres-backed storage.
-- Week 2 mutable app collections live in src/db/migrations/20260504_week2_app_store.sql.

CREATE TABLE IF NOT EXISTS origin_users (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('student', 'teacher', 'admin')),
  student_class TEXT,
  field_of_interest TEXT,
  referral_source TEXT,
  avatar        TEXT,
  streak        INTEGER NOT NULL DEFAULT 0,
  total_study_time INTEGER NOT NULL DEFAULT 0,
  joined_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_premium    BOOLEAN NOT NULL DEFAULT FALSE,
  premium_expiry TIMESTAMPTZ,
  is_onboarded  BOOLEAN NOT NULL DEFAULT FALSE,
  selected_course TEXT,
  is_dropper    BOOLEAN NOT NULL DEFAULT FALSE,
  years_of_experience TEXT,
  subjects      TEXT[] NOT NULL DEFAULT '{}',
  student_capacity TEXT,
  auth_token_version INTEGER NOT NULL DEFAULT 0,
  UNIQUE (email, role)
);

CREATE TABLE IF NOT EXISTS origin_auth_sessions (
  id                        TEXT PRIMARY KEY,
  access_token              TEXT,
  refresh_token             TEXT,
  refresh_token_hash        TEXT UNIQUE,
  user_id                   TEXT NOT NULL REFERENCES origin_users(id) ON DELETE CASCADE,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  access_token_expires_at   TIMESTAMPTZ NOT NULL,
  refresh_token_expires_at  TIMESTAMPTZ NOT NULL,
  revoked_at                TIMESTAMPTZ,
  last_used_at              TIMESTAMPTZ,
  user_agent_hash           TEXT,
  ip_prefix_hash            TEXT
);

CREATE INDEX IF NOT EXISTS idx_auth_sessions_refresh  ON origin_auth_sessions (refresh_token);
CREATE UNIQUE INDEX IF NOT EXISTS idx_auth_sessions_refresh_hash ON origin_auth_sessions (refresh_token_hash);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_user     ON origin_auth_sessions (user_id);

CREATE SCHEMA IF NOT EXISTS app;
