-- Phase 1: Workspace foundation + RBAC
-- See V1/teacher-admin-launch-plan/02-database-schema-design.md and 06-rbac-and-api-contracts.md
-- Tables: app.teacher_workspaces, app.workspace_members, app.workspace_codes, app.audit_events

CREATE SCHEMA IF NOT EXISTS app;

CREATE TABLE IF NOT EXISTS app.migrations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$ BEGIN
  CREATE TYPE app.teacher_workspace_type AS ENUM ('personal', 'institute');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE app.workspace_status AS ENUM ('active', 'trial', 'suspended', 'closed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE app.workspace_verification_status AS ENUM ('unverified', 'pending', 'verified', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE app.workspace_member_role AS ENUM (
    'owner', 'admin', 'teacher', 'content_manager', 'analyst', 'support'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE app.workspace_member_status AS ENUM ('invited', 'active', 'disabled', 'removed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE app.workspace_code_type AS ENUM ('student_join', 'staff_invite', 'batch_join');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE app.workspace_code_status AS ENUM ('reserved', 'active', 'revoked', 'expired');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS app.teacher_workspaces (
  id TEXT PRIMARY KEY,
  workspace_type app.teacher_workspace_type NOT NULL,
  owner_user_id TEXT NOT NULL REFERENCES origin_users(id),
  display_name TEXT NOT NULL,
  legal_name TEXT,
  slug TEXT UNIQUE,
  logo_asset_id TEXT,
  city TEXT,
  state TEXT,
  country TEXT NOT NULL DEFAULT 'IN',
  subjects TEXT[] NOT NULL DEFAULT '{}',
  courses TEXT[] NOT NULL DEFAULT '{}',
  status app.workspace_status NOT NULL DEFAULT 'active',
  verification_status app.workspace_verification_status NOT NULL DEFAULT 'unverified',
  public_profile JSONB NOT NULL DEFAULT '{}'::jsonb,
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_teacher_workspaces_owner
  ON app.teacher_workspaces(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_teacher_workspaces_type_status
  ON app.teacher_workspaces(workspace_type, status);
CREATE INDEX IF NOT EXISTS idx_teacher_workspaces_verified
  ON app.teacher_workspaces(verification_status, status);

CREATE TABLE IF NOT EXISTS app.workspace_members (
  workspace_id TEXT NOT NULL REFERENCES app.teacher_workspaces(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES origin_users(id) ON DELETE CASCADE,
  role app.workspace_member_role NOT NULL,
  status app.workspace_member_status NOT NULL DEFAULT 'active',
  invited_by TEXT REFERENCES origin_users(id),
  joined_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (workspace_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_workspace_members_user
  ON app.workspace_members(user_id, status);
CREATE INDEX IF NOT EXISTS idx_workspace_members_workspace_role
  ON app.workspace_members(workspace_id, role, status);

CREATE TABLE IF NOT EXISTS app.workspace_codes (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES app.teacher_workspaces(id) ON DELETE CASCADE,
  batch_id TEXT,
  normalized_code TEXT NOT NULL,
  display_code TEXT NOT NULL,
  code_type app.workspace_code_type NOT NULL,
  status app.workspace_code_status NOT NULL DEFAULT 'active',
  created_by TEXT NOT NULL REFERENCES origin_users(id),
  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_active_workspace_code
  ON app.workspace_codes(normalized_code)
  WHERE status IN ('reserved', 'active');

CREATE INDEX IF NOT EXISTS idx_workspace_codes_workspace_active
  ON app.workspace_codes(workspace_id, code_type, status, created_at DESC);

CREATE TABLE IF NOT EXISTS app.audit_events (
  id TEXT PRIMARY KEY,
  actor_user_id TEXT REFERENCES origin_users(id) ON DELETE SET NULL,
  workspace_id TEXT REFERENCES app.teacher_workspaces(id) ON DELETE SET NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  action TEXT NOT NULL,
  before JSONB,
  after JSONB,
  request_id TEXT,
  ip_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_events_workspace_time
  ON app.audit_events(workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_events_entity
  ON app.audit_events(entity_type, entity_id, created_at DESC);

INSERT INTO app.migrations (id, name)
VALUES ('20260520_phase1_workspaces', 'phase 1 workspace foundation + rbac')
ON CONFLICT (id) DO NOTHING;
