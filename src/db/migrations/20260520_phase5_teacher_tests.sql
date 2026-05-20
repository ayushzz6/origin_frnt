-- Phase 5: Teacher Tests
-- assessment.tests, test_questions, test_assignments, test_attempts, test_answers
-- See V1/teacher-admin-launch-plan/02-database-schema-design.md

CREATE SCHEMA IF NOT EXISTS assessment;

DO $$ BEGIN
  CREATE TYPE assessment.test_owner_scope AS ENUM ('student', 'workspace', 'platform');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE assessment.test_status AS ENUM ('draft', 'scheduled', 'published', 'live', 'closed', 'archived');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE assessment.test_source AS ENUM ('manual', 'random', 'imported', 'room', 'analytics_generated');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE assessment.question_source_bank AS ENUM ('ogcode', 'workspace_bag', 'platform_content');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE assessment.assignment_status AS ENUM ('assigned', 'open', 'closed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE assessment.attempt_status AS ENUM ('in_progress', 'submitted', 'timed_out', 'force_submitted', 'needs_review');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE assessment.grading_status AS ENUM ('pending', 'grading', 'completed', 'failed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE assessment.analytics_status AS ENUM ('pending', 'processing', 'completed', 'failed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS assessment.tests (
  id TEXT PRIMARY KEY,
  owner_scope assessment.test_owner_scope NOT NULL DEFAULT 'workspace',
  workspace_id TEXT REFERENCES app.teacher_workspaces(id) ON DELETE CASCADE,
  created_by TEXT NOT NULL REFERENCES origin_users(id),
  title TEXT NOT NULL,
  description TEXT,
  subject TEXT NOT NULL DEFAULT 'mixed',
  chapter TEXT,
  difficulty TEXT NOT NULL DEFAULT 'medium',
  duration_minutes INTEGER NOT NULL,
  total_questions INTEGER NOT NULL,
  status assessment.test_status NOT NULL DEFAULT 'draft',
  source assessment.test_source NOT NULL DEFAULT 'manual',
  selection_policy JSONB NOT NULL DEFAULT '{}'::jsonb,
  scoring_policy JSONB NOT NULL DEFAULT '{}'::jsonb,
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  source_import_job_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_assessment_tests_workspace_status
  ON assessment.tests(workspace_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_assessment_tests_created_by
  ON assessment.tests(created_by, created_at DESC);

CREATE TABLE IF NOT EXISTS assessment.test_questions (
  test_id TEXT NOT NULL REFERENCES assessment.tests(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  source_bank assessment.question_source_bank NOT NULL,
  ogcode_question_id TEXT,
  content_question_id TEXT REFERENCES content.questions(id) ON DELETE SET NULL,
  content_question_version_id TEXT REFERENCES content.question_versions(id) ON DELETE SET NULL,
  marks DOUBLE PRECISION NOT NULL DEFAULT 4,
  negative_marks DOUBLE PRECISION NOT NULL DEFAULT -1,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (test_id, position),
  CHECK (
    (source_bank = 'ogcode' AND ogcode_question_id IS NOT NULL)
    OR (source_bank <> 'ogcode' AND content_question_id IS NOT NULL AND content_question_version_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_test_questions_content_question
  ON assessment.test_questions(content_question_id);
CREATE INDEX IF NOT EXISTS idx_test_questions_ogcode_question
  ON assessment.test_questions(ogcode_question_id);

CREATE TABLE IF NOT EXISTS assessment.test_assignments (
  id TEXT PRIMARY KEY,
  test_id TEXT NOT NULL REFERENCES assessment.tests(id) ON DELETE CASCADE,
  workspace_id TEXT REFERENCES app.teacher_workspaces(id) ON DELETE CASCADE,
  batch_id TEXT REFERENCES app.batches(id) ON DELETE CASCADE,
  student_id TEXT REFERENCES origin_users(id) ON DELETE CASCADE,
  scheduled_start_at TIMESTAMPTZ,
  scheduled_end_at TIMESTAMPTZ,
  status assessment.assignment_status NOT NULL DEFAULT 'assigned',
  assigned_by TEXT REFERENCES origin_users(id),
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  CHECK (batch_id IS NOT NULL OR student_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_test_assignments_batch_status
  ON assessment.test_assignments(batch_id, status, scheduled_start_at);
CREATE INDEX IF NOT EXISTS idx_test_assignments_student_status
  ON assessment.test_assignments(student_id, status, scheduled_start_at);

CREATE TABLE IF NOT EXISTS assessment.test_attempts (
  id TEXT PRIMARY KEY,
  test_id TEXT NOT NULL REFERENCES assessment.tests(id) ON DELETE CASCADE,
  assignment_id TEXT REFERENCES assessment.test_assignments(id) ON DELETE SET NULL,
  workspace_id TEXT REFERENCES app.teacher_workspaces(id) ON DELETE SET NULL,
  batch_id TEXT REFERENCES app.batches(id) ON DELETE SET NULL,
  room_id TEXT,
  student_id TEXT NOT NULL REFERENCES origin_users(id) ON DELETE CASCADE,
  attempt_number INTEGER NOT NULL DEFAULT 1,
  status assessment.attempt_status NOT NULL DEFAULT 'in_progress',
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  server_deadline TIMESTAMPTZ,
  submitted_at TIMESTAMPTZ,
  score DOUBLE PRECISION,
  total_marks DOUBLE PRECISION NOT NULL DEFAULT 0,
  percentage DOUBLE PRECISION,
  time_taken_seconds INTEGER,
  grading_status assessment.grading_status NOT NULL DEFAULT 'pending',
  analytics_status assessment.analytics_status NOT NULL DEFAULT 'pending',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (test_id, student_id, attempt_number)
);

CREATE INDEX IF NOT EXISTS idx_attempts_student_status
  ON assessment.test_attempts(student_id, status, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_attempts_batch_submitted
  ON assessment.test_attempts(batch_id, submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_attempts_workspace_test
  ON assessment.test_attempts(workspace_id, test_id, submitted_at DESC);

CREATE TABLE IF NOT EXISTS assessment.test_answers (
  attempt_id TEXT NOT NULL REFERENCES assessment.test_attempts(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  question_snapshot JSONB NOT NULL,
  submitted_answer JSONB NOT NULL DEFAULT '{}'::jsonb,
  grading_result JSONB NOT NULL DEFAULT '{}'::jsonb,
  time_spent_seconds INTEGER NOT NULL DEFAULT 0,
  is_marked_for_review BOOLEAN NOT NULL DEFAULT FALSE,
  PRIMARY KEY (attempt_id, position)
);

INSERT INTO app.migrations (id, name)
VALUES ('20260520_phase5_teacher_tests', 'phase 5 teacher tests')
ON CONFLICT (id) DO NOTHING;