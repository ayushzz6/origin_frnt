-- Student Social — @username handles, profile privacy, and the follow graph.
-- Mirrors src/server/social/social-schema.ts. See STUDENT_SOCIAL_FOLLOW_PLAN.md.
--
-- Purely additive: two columns on origin_users (+ a one-time handle backfill),
-- case-insensitive unique + pg_trgm search indexes, and a new `social` schema
-- holding one directed follow edge per row. Idempotent; safe to re-run.

-- 1. Identity + privacy columns on origin_users.
ALTER TABLE origin_users ADD COLUMN IF NOT EXISTS username TEXT;
ALTER TABLE origin_users ADD COLUMN IF NOT EXISTS profile_private BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. Backfill a unique handle for every user that lacks one. Base = alphanumeric
--    slug of the name (capped at 15), made globally unique by appending the
--    already-unique id suffix (everything after the first underscore of the
--    `user_<hex>` id). Users can change it later from their profile.
UPDATE origin_users
SET username = LEFT(LOWER(REGEXP_REPLACE(COALESCE(name, ''), '[^a-zA-Z0-9]+', '', 'g')), 15)
               || '_' || split_part(id, '_', 2)
WHERE username IS NULL
  AND LEFT(LOWER(REGEXP_REPLACE(COALESCE(name, ''), '[^a-zA-Z0-9]+', '', 'g')), 15) <> ''
  AND split_part(id, '_', 2) <> '';

-- Fallback for rows whose name has no usable characters (or an unusual id shape):
-- derive a guaranteed-unique handle straight from the unique id.
UPDATE origin_users
SET username = 'user_' || LOWER(id)
WHERE username IS NULL OR TRIM(username) = '';

-- 3. Case-insensitive uniqueness + pg_trgm search indexes on the handle and name.
CREATE UNIQUE INDEX IF NOT EXISTS uq_origin_users_username_lower
  ON origin_users (LOWER(username));

CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_origin_users_username_trgm
  ON origin_users USING gin (LOWER(username) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_origin_users_name_trgm
  ON origin_users USING gin (LOWER(name) gin_trgm_ops);

-- 4. Follow graph — one row per directed edge (follower -> following).
CREATE SCHEMA IF NOT EXISTS social;

CREATE TABLE IF NOT EXISTS social.follows (
  follower_id  TEXT NOT NULL REFERENCES origin_users(id) ON DELETE CASCADE,
  following_id TEXT NOT NULL REFERENCES origin_users(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (follower_id, following_id),
  CHECK (follower_id <> following_id)
);

CREATE INDEX IF NOT EXISTS idx_follows_following ON social.follows (following_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_follows_follower  ON social.follows (follower_id, created_at DESC);

INSERT INTO app.migrations (id, name)
VALUES ('20260623_student_social', 'student social — usernames, privacy, follow graph')
ON CONFLICT (id) DO NOTHING;
