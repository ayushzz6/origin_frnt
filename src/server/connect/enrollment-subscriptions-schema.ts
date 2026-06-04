/**
 * Idempotent runtime ensure for the Phase 14 Flow-2 schema:
 *   • commerce.workspace_offerings.razorpay_plan_id + billing_period (ALTER)
 *   • commerce.enrollment_subscriptions
 *   • commerce.subscription_webhook_events
 *   • app.connect_jobs (non-blocking background queue for the connect webhook)
 *
 * Canonical SQL: src/db/migrations/20260604_phase14_enrollment_subscriptions.sql
 */

import type { PoolClient } from "pg";

import { getUserPostgresPool, isUserPostgresConfigured } from "@/server/user-postgres";
import { ensureCommerceSchema } from "@/server/workspaces/commerce-schema";

declare global {
  var __originEnrollmentSubscriptionsSchemaEnsured: boolean | undefined;
  var __originEnrollmentSubscriptionsSchemaPromise: Promise<void> | undefined;
}

const MIGRATION_ID = "20260604_phase14_enrollment_subscriptions";

function pool() {
  const p = getUserPostgresPool();
  if (!p) throw new Error("USER_DATABASE_URL is not configured");
  return p;
}

async function recordMigration(client: PoolClient): Promise<void> {
  await client.query(
    "INSERT INTO app.migrations (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING",
    [MIGRATION_ID, "phase 14 enrollment subscriptions + connect jobs"],
  );
}

export async function ensureEnrollmentSubscriptionsSchema(): Promise<void> {
  if (!isUserPostgresConfigured()) return;
  if (globalThis.__originEnrollmentSubscriptionsSchemaEnsured) return;
  if (!globalThis.__originEnrollmentSubscriptionsSchemaPromise) {
    globalThis.__originEnrollmentSubscriptionsSchemaPromise = (async () => {
      // commerce.workspace_offerings + commerce.enrollment_orders + app.batches
      // (via Phase 3) must exist before the ALTER/FKs below validate.
      await ensureCommerceSchema();
      const client = await pool().connect();
      try {
        await client.query("BEGIN");

        await client.query(`
          ALTER TABLE commerce.workspace_offerings
            ADD COLUMN IF NOT EXISTS razorpay_plan_id TEXT;
        `);
        await client.query(`
          ALTER TABLE commerce.workspace_offerings
            ADD COLUMN IF NOT EXISTS billing_period TEXT NOT NULL DEFAULT 'monthly'
              CHECK (billing_period IN ('monthly', 'one_time'));
        `);

        await client.query(`
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
        `);

        await client.query(`
          CREATE TABLE IF NOT EXISTS commerce.subscription_webhook_events (
            event_id TEXT PRIMARY KEY,
            event_type TEXT,
            received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          );
        `);

        await client.query(`
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
        `);

        await recordMigration(client);
        await client.query("COMMIT");
        globalThis.__originEnrollmentSubscriptionsSchemaEnsured = true;
      } catch (error) {
        await client.query("ROLLBACK").catch(() => undefined);
        throw error;
      } finally {
        client.release();
      }
    })().catch((error) => {
      globalThis.__originEnrollmentSubscriptionsSchemaPromise = undefined;
      throw error;
    });
  }
  await globalThis.__originEnrollmentSubscriptionsSchemaPromise;
}
