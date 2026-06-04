-- Phase 14 (section B.2-B.4): recurring batch tuition (Flow 2).
--   • commerce.workspace_offerings gains razorpay_plan_id + billing_period.
--   • commerce.enrollment_subscriptions — Razorpay-Subscription-backed batch tuition
--     (the one-time commerce.enrollment_orders table stays for back-compat).
--   • commerce.subscription_webhook_events — idempotency ledger for the batch webhook
--     (separate from subscriptions.webhook_events so the two surfaces don't contend).
--   • app.connect_jobs — non-blocking background queue: the connect webhook verifies +
--     records + enqueues, and enroll/assign/entitlement work runs in the drain.
-- Mirrors src/server/connect/enrollment-subscriptions-schema.ts.
-- See PREMIUM_AND_TEACHER_CONNECTION_PLAN.md (Phase 2, sections B + D).

ALTER TABLE commerce.workspace_offerings
  ADD COLUMN IF NOT EXISTS razorpay_plan_id TEXT;
ALTER TABLE commerce.workspace_offerings
  ADD COLUMN IF NOT EXISTS billing_period TEXT NOT NULL DEFAULT 'monthly'
    CHECK (billing_period IN ('monthly', 'one_time'));

CREATE TABLE IF NOT EXISTS commerce.enrollment_subscriptions (
  id TEXT PRIMARY KEY,
  offering_id TEXT NOT NULL REFERENCES commerce.workspace_offerings(id),
  workspace_id TEXT NOT NULL REFERENCES app.teacher_workspaces(id),
  student_id TEXT NOT NULL REFERENCES origin_users(id),
  target_batch_id TEXT REFERENCES app.batches(id),
  razorpay_plan_id TEXT,
  razorpay_subscription_id TEXT,
  status TEXT NOT NULL DEFAULT 'created'
    CHECK (status IN ('created', 'authenticated', 'active', 'pending', 'halted', 'cancelled', 'completed', 'expired')),
  amount_minor INTEGER NOT NULL DEFAULT 0 CHECK (amount_minor >= 0),
  current_period_end TIMESTAMPTZ,
  short_url TEXT,
  enrollment_id TEXT REFERENCES app.workspace_student_enrollments(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_enrollment_subscriptions_razorpay_sub
  ON commerce.enrollment_subscriptions(razorpay_subscription_id)
  WHERE razorpay_subscription_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_enrollment_subscriptions_student
  ON commerce.enrollment_subscriptions(student_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_enrollment_subscriptions_workspace
  ON commerce.enrollment_subscriptions(workspace_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS commerce.subscription_webhook_events (
  event_id TEXT PRIMARY KEY,
  event_type TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS app.connect_jobs (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_connect_jobs_status_created
  ON app.connect_jobs(status, created_at);

INSERT INTO app.migrations (id, name)
VALUES ('20260604_phase14_enrollment_subscriptions', 'phase 14 enrollment subscriptions + connect jobs')
ON CONFLICT (id) DO NOTHING;
