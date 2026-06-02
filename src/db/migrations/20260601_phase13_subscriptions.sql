-- Phase 13: Free vs Premium tier — per-subject Razorpay Subscriptions.
-- subscriptions.user_subscriptions + subscriptions.webhook_events.
-- Mirrors src/server/subscriptions/subscriptions-schema.ts.
-- See PREMIUM_AND_TEACHER_CONNECTION_PLAN.md (Phase 1.1).
--
-- Entitlement is DERIVED at read time from active rows here; the legacy
-- origin_users.is_premium / premium_expiry columns are kept only as
-- denormalised mirrors recomputed on every webhook. Both columns are left
-- untouched by this migration (purely additive).

CREATE SCHEMA IF NOT EXISTS subscriptions;

DO $$ BEGIN
  CREATE TYPE subscriptions.subscription_status AS ENUM (
    'created', 'authenticated', 'active', 'pending', 'halted', 'cancelled', 'completed', 'expired'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- One row per (user_id, subject). A subject is entitled when status='active'
-- and (current_period_end IS NULL OR current_period_end > NOW()).
CREATE TABLE IF NOT EXISTS subscriptions.user_subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES origin_users(id) ON DELETE CASCADE,
  subject TEXT NOT NULL CHECK (subject IN ('physics', 'chemistry', 'mathematics', 'biology')),
  razorpay_plan_id TEXT,
  razorpay_subscription_id TEXT,
  status subscriptions.subscription_status NOT NULL DEFAULT 'created',
  current_period_end TIMESTAMPTZ,
  amount_minor INTEGER NOT NULL DEFAULT 49900 CHECK (amount_minor >= 0),
  short_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_user_subscriptions_user_subject
  ON subscriptions.user_subscriptions(user_id, subject);
CREATE UNIQUE INDEX IF NOT EXISTS uq_user_subscriptions_razorpay_sub
  ON subscriptions.user_subscriptions(razorpay_subscription_id)
  WHERE razorpay_subscription_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_status
  ON subscriptions.user_subscriptions(user_id, status);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_entitlement
  ON subscriptions.user_subscriptions(user_id, status, current_period_end);

-- Idempotency ledger keyed on Razorpay x-razorpay-event-id. A re-delivered
-- webhook conflicts on the PK and is acknowledged with an early 200.
CREATE TABLE IF NOT EXISTS subscriptions.webhook_events (
  event_id TEXT PRIMARY KEY,
  event_type TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO app.migrations (id, name)
VALUES ('20260601_phase13_subscriptions', 'phase 13 per-subject premium subscriptions')
ON CONFLICT (id) DO NOTHING;
