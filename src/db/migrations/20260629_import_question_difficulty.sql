-- Adds the AI-classified per-question difficulty to the document-import
-- staging table so it can be carried through to content.question_versions
-- when an accepted question is published to the Question Bag.
--
-- Idempotent; mirrored by the runtime-ensure module
-- src/server/workspaces/document-import-schema.ts (auto-applies on first use).

ALTER TABLE import.import_job_questions
  ADD COLUMN IF NOT EXISTS difficulty TEXT NOT NULL DEFAULT 'medium';
