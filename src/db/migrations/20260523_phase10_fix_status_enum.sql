-- Phase 10 follow-up: rename the import.import_job_status labels that
-- earlier drafts of 20260521_phase10_document_import.sql introduced
-- ('review_required', 'completed') to match the plan + the runtime
-- ensure ('needs_review', 'succeeded'). Also drops the dead phase 12
-- tables that the same earlier draft created in the `app` schema.
--
-- Safe to run on a fresh DB (no-op) or on a DB where the earlier draft
-- already ran (renames + drops); never destroys live data because the
-- dead tables were never written to by any service.
--
-- Canonical commerce.* tables for paid enrollment live in
-- 20260521_phase12_paid_enrollment.sql.

BEGIN;

-- Rename mis-labeled enum values, if present.
DO $$
DECLARE
  has_review_required BOOLEAN;
  has_completed BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'import' AND t.typname = 'import_job_status' AND e.enumlabel = 'review_required'
  ) INTO has_review_required;

  SELECT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'import' AND t.typname = 'import_job_status' AND e.enumlabel = 'completed'
  ) INTO has_completed;

  IF has_review_required THEN
    EXECUTE 'ALTER TYPE import.import_job_status RENAME VALUE ''review_required'' TO ''needs_review''';
  END IF;

  IF has_completed THEN
    EXECUTE 'ALTER TYPE import.import_job_status RENAME VALUE ''completed'' TO ''succeeded''';
  END IF;
END $$;

-- Ensure the plan-canonical labels exist even if neither rename fired
-- (e.g. enum was created from scratch by a partial earlier run).
DO $$ BEGIN
  ALTER TYPE import.import_job_status ADD VALUE IF NOT EXISTS 'needs_review';
EXCEPTION WHEN undefined_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TYPE import.import_job_status ADD VALUE IF NOT EXISTS 'succeeded';
EXCEPTION WHEN undefined_object THEN NULL; END $$;

-- Drop the dead phase-12 tables that the earlier 20260521 draft created
-- under app.*. They are guaranteed unused (the marketplace service
-- writes to commerce.* — see marketplace-store.ts).
DROP TABLE IF EXISTS app.enrollment_orders CASCADE;
DROP TABLE IF EXISTS app.workspace_offerings CASCADE;

INSERT INTO app.migrations (id, name)
VALUES ('20260523_phase10_fix_status_enum', 'phase 10 align import_job_status enum + drop dead phase-12 app.* tables')
ON CONFLICT (id) DO NOTHING;

COMMIT;
