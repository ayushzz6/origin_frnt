ALTER TABLE origin_users
  ADD COLUMN IF NOT EXISTS auth_token_version INTEGER NOT NULL DEFAULT 0;

ALTER TABLE origin_auth_sessions
  ADD COLUMN IF NOT EXISTS id TEXT,
  ADD COLUMN IF NOT EXISTS refresh_token_hash TEXT,
  ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS user_agent_hash TEXT,
  ADD COLUMN IF NOT EXISTS ip_prefix_hash TEXT;

UPDATE origin_auth_sessions
SET id = COALESCE(id, access_token, refresh_token)
WHERE id IS NULL;

ALTER TABLE origin_auth_sessions ALTER COLUMN id SET NOT NULL;

DO $$
DECLARE
  pk_name TEXT;
  pk_column TEXT;
BEGIN
  SELECT c.conname, a.attname INTO pk_name, pk_column
  FROM pg_constraint c
  JOIN pg_class t ON t.oid = c.conrelid
  JOIN pg_namespace n ON n.oid = t.relnamespace
  JOIN unnest(c.conkey) WITH ORDINALITY AS keys(attnum, ordinality) ON TRUE
  JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = keys.attnum
  WHERE n.nspname = 'public'
    AND t.relname = 'origin_auth_sessions'
    AND c.contype = 'p'
  LIMIT 1;

  IF pk_name IS NOT NULL AND pk_column <> 'id' THEN
    EXECUTE format('ALTER TABLE origin_auth_sessions DROP CONSTRAINT %I', pk_name);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'origin_auth_sessions'
      AND c.contype = 'p'
  ) THEN
    ALTER TABLE origin_auth_sessions ADD CONSTRAINT origin_auth_sessions_pkey PRIMARY KEY (id);
  END IF;
END $$;

ALTER TABLE origin_auth_sessions ALTER COLUMN access_token DROP NOT NULL;
ALTER TABLE origin_auth_sessions ALTER COLUMN refresh_token DROP NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_auth_sessions_refresh_hash
  ON origin_auth_sessions (refresh_token_hash);

CREATE INDEX IF NOT EXISTS idx_auth_sessions_active_user
  ON origin_auth_sessions (user_id, revoked_at, refresh_token_expires_at);
