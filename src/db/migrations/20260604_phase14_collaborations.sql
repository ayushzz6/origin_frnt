-- Phase 14: Student ↔ teacher connection — collaboration model.
-- app.origin_collaborations is kept separate from app.teacher_workspaces so the
-- partner lifecycle / payout fields don't mix with the operator-suspension
-- `status` and KYC `verification_status` on the workspace row.
-- Mirrors src/server/connect/collaboration-schema.ts.
-- See PREMIUM_AND_TEACHER_CONNECTION_PLAN.md (Phase 2, section A).

CREATE TABLE IF NOT EXISTS app.origin_collaborations (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL UNIQUE REFERENCES app.teacher_workspaces(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'active', 'paused', 'terminated', 'rejected')),
  commission_bps INTEGER NOT NULL DEFAULT 0
    CHECK (commission_bps >= 0 AND commission_bps <= 10000),
  razorpay_route_account_id TEXT,
  flow1_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  flow2_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  requested_by TEXT REFERENCES origin_users(id),
  approved_by TEXT REFERENCES origin_users(id),
  approved_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_origin_collaborations_status
  ON app.origin_collaborations(status, created_at DESC);

INSERT INTO app.migrations (id, name)
VALUES ('20260604_phase14_collaborations', 'phase 14 origin collaborations')
ON CONFLICT (id) DO NOTHING;
