-- Rollback for 20260524_phase10_align_import_schema.sql.

BEGIN;

ALTER TABLE import.document_import_jobs
  DROP CONSTRAINT IF EXISTS fk_import_jobs_source_asset;

DROP INDEX IF EXISTS idx_import_jobs_target_surface;
DROP INDEX IF EXISTS idx_import_jobs_stage;
DROP INDEX IF EXISTS idx_import_jobs_source_asset;

ALTER TABLE import.document_import_jobs
  DROP COLUMN IF EXISTS stage,
  DROP COLUMN IF EXISTS target_surface,
  DROP COLUMN IF EXISTS source_asset_id,
  DROP COLUMN IF EXISTS requested_question_count,
  DROP COLUMN IF EXISTS classification,
  DROP COLUMN IF EXISTS diagnostics,
  DROP COLUMN IF EXISTS cost,
  DROP COLUMN IF EXISTS error_code,
  DROP COLUMN IF EXISTS requested_by;

DROP TYPE IF EXISTS import.job_stage;

DELETE FROM app.migrations WHERE id = '20260524_phase10_align_import_schema';

COMMIT;
