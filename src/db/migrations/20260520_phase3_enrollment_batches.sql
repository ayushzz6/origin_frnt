-- Phase 3: Student enrollment + batch management
-- See V1/teacher-admin-launch-plan/02-database-schema-design.md
-- Tables: app.workspace_student_enrollments, app.batches, app.batch_members, app.batch_staff

DO $$ BEGIN
  CREATE TYPE app.enrollment_source AS ENUM ('code', 'manual', 'admin_import', 'paid_app', 'migration');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE app.enrollment_status AS ENUM ('unassigned', 'active', 'suspended', 'left');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE app.batch_status AS ENUM ('draft', 'active', 'completed', 'archived');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE app.batch_member_status AS ENUM ('active', 'removed', 'completed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS app.workspace_student_enrollments (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES app.teacher_workspaces(id) ON DELETE CASCADE,
  student_id TEXT NOT NULL REFERENCES origin_users(id) ON DELETE CASCADE,
  source app.enrollment_source NOT NULL,
  join_code_id TEXT REFERENCES app.workspace_codes(id),
  status app.enrollment_status NOT NULL DEFAULT 'unassigned',
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  assigned_at TIMESTAMPTZ,
  suspended_at TIMESTAMPTZ,
  left_at TIMESTAMPTZ,
  notes TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (workspace_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_workspace_enrollments_workspace_status
  ON app.workspace_student_enrollments(workspace_id, status, enrolled_at DESC);
CREATE INDEX IF NOT EXISTS idx_workspace_enrollments_student
  ON app.workspace_student_enrollments(student_id, status);

CREATE TABLE IF NOT EXISTS app.batches (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES app.teacher_workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  course TEXT,
  subject TEXT,
  class_level TEXT,
  schedule_text TEXT,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  capacity INTEGER,
  status app.batch_status NOT NULL DEFAULT 'active',
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by TEXT NOT NULL REFERENCES origin_users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_batches_workspace_status
  ON app.batches(workspace_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_batches_subject
  ON app.batches(workspace_id, subject, status);

CREATE TABLE IF NOT EXISTS app.batch_members (
  batch_id TEXT NOT NULL REFERENCES app.batches(id) ON DELETE CASCADE,
  workspace_id TEXT NOT NULL REFERENCES app.teacher_workspaces(id) ON DELETE CASCADE,
  student_id TEXT NOT NULL REFERENCES origin_users(id) ON DELETE CASCADE,
  status app.batch_member_status NOT NULL DEFAULT 'active',
  assigned_by TEXT REFERENCES origin_users(id),
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  removed_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (batch_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_batch_members_workspace_student
  ON app.batch_members(workspace_id, student_id, status);
CREATE INDEX IF NOT EXISTS idx_batch_members_batch_status
  ON app.batch_members(batch_id, status, assigned_at DESC);

CREATE TABLE IF NOT EXISTS app.batch_staff (
  batch_id TEXT NOT NULL REFERENCES app.batches(id) ON DELETE CASCADE,
  workspace_id TEXT NOT NULL REFERENCES app.teacher_workspaces(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES origin_users(id) ON DELETE CASCADE,
  role app.workspace_member_role NOT NULL DEFAULT 'teacher',
  assigned_by TEXT REFERENCES origin_users(id),
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (batch_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_batch_staff_user
  ON app.batch_staff(user_id, workspace_id);

INSERT INTO app.migrations (id, name)
VALUES ('20260520_phase3_enrollment_batches', 'phase 3 enrollment + batches')
ON CONFLICT (id) DO NOTHING;
