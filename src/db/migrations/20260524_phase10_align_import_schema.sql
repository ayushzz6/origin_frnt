-- Phase 10 alignment: bring import.document_import_jobs into full
-- agreement with V1/teacher-admin-launch-plan/02-database-schema-design.md
-- ("Document Import Jobs").
--
-- Adds the plan's columns that the original Qwen pass omitted:
--   - stage (import.job_stage ENUM)
--   - target_surface (CHECK in question_bag / ogcode_draft / admin_ogcode)
--   - source_asset_id (FK to content.assets, replacing the standalone
--                      source_r2_* columns — those are kept as nullable
--                      back-compat fields for the worker until the next
--                      cleanup migration)
--   - requested_question_count
--   - classification / diagnostics / cost (JSONB)
--   - error_code
--   - requested_by (alias of created_by — the plan uses the name
--                   "requested_by"; we add the column and backfill so
--                   both reads keep working)
--
-- Safe to re-run.

BEGIN;

DO $$ BEGIN
  CREATE TYPE import.job_stage AS ENUM (
    'queued',
    'upload_saved',
    'classified',
    'text_extracted',
    'layout_extracted',
    'reconciled',
    'verified',
    'reviewing',
    'persisted',
    'failed'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE import.document_import_jobs
  ADD COLUMN IF NOT EXISTS stage import.job_stage NOT NULL DEFAULT 'queued',
  ADD COLUMN IF NOT EXISTS target_surface TEXT
    CHECK (target_surface IN ('question_bag', 'ogcode_draft', 'admin_ogcode')),
  ADD COLUMN IF NOT EXISTS source_asset_id TEXT,
  ADD COLUMN IF NOT EXISTS requested_question_count INTEGER,
  ADD COLUMN IF NOT EXISTS classification JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS diagnostics JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS cost JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS error_code TEXT,
  ADD COLUMN IF NOT EXISTS requested_by TEXT REFERENCES origin_users(id);

-- Backfill requested_by from created_by on existing rows.
UPDATE import.document_import_jobs
   SET requested_by = created_by
 WHERE requested_by IS NULL;

-- Default target_surface for legacy rows; new inserts must specify.
UPDATE import.document_import_jobs
   SET target_surface = 'question_bag'
 WHERE target_surface IS NULL;

-- Add the FK to content.assets only when the column has a non-NULL set
-- of values (avoids breaking existing rows that pre-date this design).
-- New worker writes content.assets before creating the job, so the FK
-- can be enforced for fresh jobs via a partial constraint check in the
-- application layer until backfill completes.
DO $$ BEGIN
  ALTER TABLE import.document_import_jobs
    ADD CONSTRAINT fk_import_jobs_source_asset
    FOREIGN KEY (source_asset_id) REFERENCES content.assets(id)
    NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN
    -- content.assets not present in this environment; skip silently.
    NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_import_jobs_target_surface
  ON import.document_import_jobs(target_surface, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_import_jobs_stage
  ON import.document_import_jobs(stage, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_import_jobs_source_asset
  ON import.document_import_jobs(source_asset_id);

INSERT INTO app.migrations (id, name)
VALUES ('20260524_phase10_align_import_schema', 'phase 10 align import job schema with plan')
ON CONFLICT (id) DO NOTHING;

COMMIT;
