-- Phase 14: entitlements.subject_grants — single source for non-Razorpay
-- subject access (Flow-1 `teacher_code` grants + `admin_comp` comps). The
-- Razorpay-backed subject subscriptions stay in subscriptions.user_subscriptions;
-- getEntitledSubjects() resolves the UNION of both at read time.
-- Mirrors src/server/connect/subject-grants-schema.ts.
-- See PREMIUM_AND_TEACHER_CONNECTION_PLAN.md (Phase 2, section B.1 / C).

CREATE SCHEMA IF NOT EXISTS entitlements;

DO $$ BEGIN
  CREATE TYPE entitlements.grant_status AS ENUM ('active', 'revoked', 'expired');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS entitlements.subject_grants (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES origin_users(id) ON DELETE CASCADE,
  subject TEXT NOT NULL CHECK (subject IN ('physics', 'chemistry', 'mathematics', 'biology')),
  source TEXT NOT NULL CHECK (source IN ('teacher_code', 'admin_comp')),
  workspace_id TEXT REFERENCES app.teacher_workspaces(id) ON DELETE SET NULL,
  enrollment_id TEXT REFERENCES app.workspace_student_enrollments(id) ON DELETE SET NULL,
  status entitlements.grant_status NOT NULL DEFAULT 'active',
  expires_at TIMESTAMPTZ,
  granted_by TEXT REFERENCES origin_users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- At most one active teacher_code grant per (user, subject, workspace).
CREATE UNIQUE INDEX IF NOT EXISTS uq_subject_grants_active_workspace
  ON entitlements.subject_grants(user_id, subject, workspace_id)
  WHERE status = 'active' AND workspace_id IS NOT NULL;

-- At most one active admin_comp grant per (user, subject) (workspace is null).
CREATE UNIQUE INDEX IF NOT EXISTS uq_subject_grants_active_admin_comp
  ON entitlements.subject_grants(user_id, subject)
  WHERE status = 'active' AND source = 'admin_comp';

CREATE INDEX IF NOT EXISTS idx_subject_grants_user_status
  ON entitlements.subject_grants(user_id, status);
CREATE INDEX IF NOT EXISTS idx_subject_grants_entitlement
  ON entitlements.subject_grants(user_id, status, expires_at);

INSERT INTO app.migrations (id, name)
VALUES ('20260604_phase14_subject_grants', 'phase 14 entitlements.subject_grants')
ON CONFLICT (id) DO NOTHING;
