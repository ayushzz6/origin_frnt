-- Rollback for 20260623_student_social.sql.
-- Drops the follow graph + search/unique indexes and the two origin_users
-- columns. Destructive: the follow edges and chosen handles are lost.

DROP SCHEMA IF EXISTS social CASCADE;

DROP INDEX IF EXISTS idx_origin_users_name_trgm;
DROP INDEX IF EXISTS idx_origin_users_username_trgm;
DROP INDEX IF EXISTS uq_origin_users_username_lower;

ALTER TABLE origin_users DROP COLUMN IF EXISTS profile_private;
ALTER TABLE origin_users DROP COLUMN IF EXISTS username;

DELETE FROM app.migrations WHERE id = '20260623_student_social';
