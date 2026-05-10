DROP INDEX IF EXISTS idx_auth_sessions_active_user;
DROP INDEX IF EXISTS idx_auth_sessions_refresh_hash;

ALTER TABLE origin_auth_sessions
  DROP COLUMN IF EXISTS ip_prefix_hash,
  DROP COLUMN IF EXISTS user_agent_hash,
  DROP COLUMN IF EXISTS last_used_at,
  DROP COLUMN IF EXISTS revoked_at,
  DROP COLUMN IF EXISTS refresh_token_hash;

ALTER TABLE origin_users
  DROP COLUMN IF EXISTS auth_token_version;

-- The migration changes the primary key from access_token to id. This rollback
-- keeps id in place because existing JWT refresh tokens encode it; reverting it
-- safely requires first expiring all active sessions.
