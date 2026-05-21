-- Phase 12: Paid Direct Enrollment and Marketplace
-- commerce.workspace_offerings + commerce.enrollment_orders.
-- Mirrors src/server/workspaces/commerce-schema.ts.
-- See V1/teacher-admin-launch-plan/02-database-schema-design.md
-- ("Future Commerce" section).

CREATE SCHEMA IF NOT EXISTS commerce;

DO $$ BEGIN
  CREATE TYPE commerce.order_status AS ENUM (
    'created', 'payment_pending', 'paid', 'failed', 'refunded', 'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS commerce.workspace_offerings (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES app.teacher_workspaces(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  price_minor INTEGER NOT NULL CHECK (price_minor >= 0),
  currency TEXT NOT NULL DEFAULT 'INR',
  target_batch_id TEXT REFERENCES app.batches(id),
  status TEXT NOT NULL DEFAULT 'draft',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workspace_offerings_workspace_status
  ON commerce.workspace_offerings(workspace_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_workspace_offerings_batch
  ON commerce.workspace_offerings(target_batch_id) WHERE target_batch_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS commerce.enrollment_orders (
  id TEXT PRIMARY KEY,
  offering_id TEXT NOT NULL REFERENCES commerce.workspace_offerings(id),
  workspace_id TEXT NOT NULL REFERENCES app.teacher_workspaces(id),
  student_id TEXT NOT NULL REFERENCES origin_users(id),
  status commerce.order_status NOT NULL DEFAULT 'created',
  provider TEXT,
  provider_payment_id TEXT,
  amount_minor INTEGER NOT NULL CHECK (amount_minor >= 0),
  currency TEXT NOT NULL DEFAULT 'INR',
  enrollment_id TEXT REFERENCES app.workspace_student_enrollments(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_enrollment_orders_workspace_status
  ON commerce.enrollment_orders(workspace_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_enrollment_orders_student
  ON commerce.enrollment_orders(student_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_enrollment_orders_offering
  ON commerce.enrollment_orders(offering_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS uq_enrollment_orders_provider_payment
  ON commerce.enrollment_orders(provider, provider_payment_id)
  WHERE provider IS NOT NULL AND provider_payment_id IS NOT NULL;

INSERT INTO app.migrations (id, name)
VALUES ('20260521_phase12_paid_enrollment', 'phase 12 commerce workspace offerings + enrollment orders')
ON CONFLICT (id) DO NOTHING;
