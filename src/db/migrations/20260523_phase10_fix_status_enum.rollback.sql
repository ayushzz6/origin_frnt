-- Rollback for 20260523_phase10_fix_status_enum.sql.
-- The rename is reversible; the dropped dead tables (app.workspace_offerings,
-- app.enrollment_orders) are NOT recreated — those were never used by any
-- code path and have no rows to restore.

BEGIN;

DO $$
DECLARE
  has_needs_review BOOLEAN;
  has_succeeded BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'import' AND t.typname = 'import_job_status' AND e.enumlabel = 'needs_review'
  ) INTO has_needs_review;

  SELECT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'import' AND t.typname = 'import_job_status' AND e.enumlabel = 'succeeded'
  ) INTO has_succeeded;

  IF has_needs_review THEN
    EXECUTE 'ALTER TYPE import.import_job_status RENAME VALUE ''needs_review'' TO ''review_required''';
  END IF;

  IF has_succeeded THEN
    EXECUTE 'ALTER TYPE import.import_job_status RENAME VALUE ''succeeded'' TO ''completed''';
  END IF;
END $$;

DELETE FROM app.migrations WHERE id = '20260523_phase10_fix_status_enum';

COMMIT;
