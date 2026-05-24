-- Audit fix R-1.3 (A-06): remove publicly-known demo accounts that the
-- legacy store helper used to seed into production on every cold start.
--
-- Idempotent — safe to re-run. Deletes the seeded rows from
-- `app.origin_users` (and dependent rows in tables with FK ON DELETE
-- CASCADE; if any FK does not cascade the migration will fail loudly
-- and we'll triage row-by-row).
--
-- The corresponding code-side guard lives in
-- `new-frontend/src/legacy/store.ts::isDemoSeedingEnabled`. To keep
-- the demo accounts in dev/CI, set `ORIGIN_ALLOW_DEMO_SEEDS=1`.

BEGIN;

DELETE FROM app.origin_users
WHERE id IN (
  'user_student_demo',
  'user_teacher_demo',
  'user_student_ayush',
  'user_teacher_ayush',
  'user_student_tohin',
  'user_teacher_tohin',
  'user_admin_legacy'
);

COMMIT;
