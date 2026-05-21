-- Phase 9: OGCode Publishing, Moderation, and Republish
-- content.ogcode_publications + content.ogcode_publication_status enum.
-- Mirrors src/server/workspaces/ogcode-publishing-schema.ts.
-- See V1/teacher-admin-launch-plan/02-database-schema-design.md and
-- 05-implementation-roadmap.md.

CREATE SCHEMA IF NOT EXISTS content;

DO $$ BEGIN
  CREATE TYPE content.ogcode_publication_status AS ENUM (
    'pending_review', 'approved', 'rejected', 'published', 'superseded'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS content.ogcode_publications (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES app.teacher_workspaces(id) ON DELETE CASCADE,
  ogcode_question_id TEXT NOT NULL,
  question_bag_question_id TEXT,
  submitted_by TEXT NOT NULL REFERENCES origin_users(id),
  status content.ogcode_publication_status NOT NULL DEFAULT 'pending_review',
  version INTEGER NOT NULL DEFAULT 1,
  hint_provided BOOLEAN NOT NULL DEFAULT FALSE,
  full_solution_provided BOOLEAN NOT NULL DEFAULT FALSE,
  admin_reviewed_by TEXT REFERENCES origin_users(id),
  admin_reviewed_at TIMESTAMPTZ,
  admin_notes TEXT,
  published_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  superseded_by TEXT REFERENCES content.ogcode_publications(id),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ogcode_publications_workspace_status
  ON content.ogcode_publications(workspace_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ogcode_publications_pending_review
  ON content.ogcode_publications(status, created_at ASC)
  WHERE status = 'pending_review';
CREATE INDEX IF NOT EXISTS idx_ogcode_publications_ogcode_question
  ON content.ogcode_publications(ogcode_question_id, status);

INSERT INTO app.migrations (id, name)
VALUES ('20260521_phase9_ogcode_publishing', 'phase 9 ogcode publishing moderation republish')
ON CONFLICT (id) DO NOTHING;
