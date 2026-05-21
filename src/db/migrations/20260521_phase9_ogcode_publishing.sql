-- Phase 9: OGCode Publishing, Moderation, and Republish
-- content.ogcode_publications + content.ogcode_publication_status enum.
-- Mirrors src/server/workspaces/ogcode-publishing-schema.ts.
-- Aligned with V1/teacher-admin-launch-plan/02-database-schema-design.md:
-- 7-state lifecycle, FKs to content.questions / content.question_versions,
-- denormalized attribution fields, superseded_by chain for republish.

CREATE SCHEMA IF NOT EXISTS content;

DO $$ BEGIN
  CREATE TYPE content.ogcode_publication_status AS ENUM (
    'draft',
    'submitted',
    'approved',
    'published',
    'changes_requested',
    'rejected',
    'archived'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS content.ogcode_publications (
  id TEXT PRIMARY KEY,
  question_id TEXT NOT NULL REFERENCES content.questions(id) ON DELETE CASCADE,
  question_version_id TEXT NOT NULL REFERENCES content.question_versions(id),
  contributor_workspace_id TEXT REFERENCES app.teacher_workspaces(id) ON DELETE SET NULL,
  contributor_user_id TEXT REFERENCES origin_users(id) ON DELETE SET NULL,
  attribution_name TEXT NOT NULL,
  attribution_logo_asset_id TEXT REFERENCES content.assets(id),
  status content.ogcode_publication_status NOT NULL DEFAULT 'draft',
  version INTEGER NOT NULL DEFAULT 1,
  moderation_notes TEXT,
  submitted_at TIMESTAMPTZ,
  reviewed_by TEXT REFERENCES origin_users(id),
  reviewed_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  archived_at TIMESTAMPTZ,
  superseded_by TEXT REFERENCES content.ogcode_publications(id),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ogcode_publications_workspace_status
  ON content.ogcode_publications(contributor_workspace_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ogcode_publications_submitted
  ON content.ogcode_publications(status, submitted_at ASC)
  WHERE status = 'submitted';
CREATE INDEX IF NOT EXISTS idx_ogcode_publications_question
  ON content.ogcode_publications(question_id, status);

INSERT INTO app.migrations (id, name)
VALUES ('20260521_phase9_ogcode_publishing', 'phase 9 ogcode publishing moderation republish')
ON CONFLICT (id) DO NOTHING;
