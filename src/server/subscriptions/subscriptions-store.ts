/**
 * Data store for per-subject premium subscriptions (Phase 1.2).
 * Aligned to src/db/migrations/20260601_phase13_subscriptions.sql:
 *   subscriptions.user_subscriptions + subscriptions.webhook_events.
 */

import type { Pool } from "pg";

import { getUserPostgresPool } from "@/server/user-postgres";
import { createPrefixedId } from "@/server/workspaces/ids";
import type { Subject } from "@/lib/entitlements";

import { ensureSubscriptionsSchema } from "./subscriptions-schema";

export type SubscriptionStatus =
  | "created"
  | "authenticated"
  | "active"
  | "pending"
  | "halted"
  | "cancelled"
  | "completed"
  | "expired";

export type SubjectSubscription = {
  id: string;
  userId: string;
  subject: Subject;
  razorpayPlanId: string | null;
  razorpaySubscriptionId: string | null;
  status: SubscriptionStatus;
  currentPeriodEnd: string | null;
  amountMinor: number;
  shortUrl: string | null;
  createdAt: string;
  updatedAt: string;
};

function pool(): Pool {
  const p = getUserPostgresPool();
  if (!p) throw new Error("USER_DATABASE_URL is not configured");
  return p;
}

function rowToSubscription(row: Record<string, unknown>): SubjectSubscription {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    subject: row.subject as Subject,
    razorpayPlanId: (row.razorpay_plan_id as string | null) ?? null,
    razorpaySubscriptionId: (row.razorpay_subscription_id as string | null) ?? null,
    status: row.status as SubscriptionStatus,
    currentPeriodEnd: row.current_period_end
      ? new Date(row.current_period_end as string).toISOString()
      : null,
    amountMinor: Number(row.amount_minor) || 0,
    shortUrl: (row.short_url as string | null) ?? null,
    createdAt: new Date(row.created_at as string).toISOString(),
    updatedAt: new Date(row.updated_at as string).toISOString(),
  };
}

export type UpsertCreatedSubscriptionInput = {
  userId: string;
  subject: Subject;
  razorpayPlanId: string;
  razorpaySubscriptionId: string;
  shortUrl: string | null;
  amountMinor: number;
};

/**
 * Upsert the `(user_id, subject)` row when a Razorpay subscription is created.
 * A prior cancelled/expired row for the same subject is overwritten with the
 * fresh Razorpay subscription id and reset to `created`. Entitlement is granted
 * only later, by the webhook.
 */
export async function upsertCreatedSubscription(
  input: UpsertCreatedSubscriptionInput,
): Promise<SubjectSubscription> {
  await ensureSubscriptionsSchema();
  const id = createPrefixedId("sub");
  const result = await pool().query(
    `INSERT INTO subscriptions.user_subscriptions
       (id, user_id, subject, razorpay_plan_id, razorpay_subscription_id,
        status, amount_minor, short_url, updated_at)
     VALUES ($1,$2,$3,$4,$5,'created',$6,$7,NOW())
     ON CONFLICT (user_id, subject) DO UPDATE SET
       razorpay_plan_id         = EXCLUDED.razorpay_plan_id,
       razorpay_subscription_id = EXCLUDED.razorpay_subscription_id,
       status                   = 'created',
       amount_minor             = EXCLUDED.amount_minor,
       short_url                = EXCLUDED.short_url,
       updated_at               = NOW()
     RETURNING *`,
    [
      id,
      input.userId,
      input.subject,
      input.razorpayPlanId,
      input.razorpaySubscriptionId,
      input.amountMinor,
      input.shortUrl,
    ],
  );
  return rowToSubscription(result.rows[0]);
}

export async function getSubscriptionBySubject(
  userId: string,
  subject: Subject,
): Promise<SubjectSubscription | null> {
  await ensureSubscriptionsSchema();
  const result = await pool().query(
    `SELECT * FROM subscriptions.user_subscriptions WHERE user_id = $1 AND subject = $2`,
    [userId, subject],
  );
  return result.rows[0] ? rowToSubscription(result.rows[0]) : null;
}

export async function getSubscriptionByRazorpayId(
  razorpaySubscriptionId: string,
): Promise<SubjectSubscription | null> {
  await ensureSubscriptionsSchema();
  const result = await pool().query(
    `SELECT * FROM subscriptions.user_subscriptions WHERE razorpay_subscription_id = $1`,
    [razorpaySubscriptionId],
  );
  return result.rows[0] ? rowToSubscription(result.rows[0]) : null;
}

export async function listUserSubscriptions(userId: string): Promise<SubjectSubscription[]> {
  await ensureSubscriptionsSchema();
  const result = await pool().query(
    `SELECT * FROM subscriptions.user_subscriptions WHERE user_id = $1 ORDER BY subject ASC`,
    [userId],
  );
  return result.rows.map(rowToSubscription);
}

export type ApplyWebhookTransitionInput = {
  razorpaySubscriptionId: string;
  status: SubscriptionStatus;
  /** Pass null to leave the existing period end untouched (e.g. halted/pending). */
  currentPeriodEnd: Date | null;
};

/**
 * Apply a status transition keyed on the Razorpay subscription id. Returns the
 * updated row (incl. user_id + subject) or null when no matching row exists.
 */
export async function applyWebhookTransition(
  input: ApplyWebhookTransitionInput,
): Promise<SubjectSubscription | null> {
  await ensureSubscriptionsSchema();
  const result = await pool().query(
    `UPDATE subscriptions.user_subscriptions
        SET status             = $2,
            current_period_end = COALESCE($3, current_period_end),
            updated_at         = NOW()
      WHERE razorpay_subscription_id = $1
      RETURNING *`,
    [input.razorpaySubscriptionId, input.status, input.currentPeriodEnd],
  );
  return result.rows[0] ? rowToSubscription(result.rows[0]) : null;
}

/**
 * Idempotency ledger insert. Returns true when the event is new (caller should
 * process it), false when it has already been recorded (caller returns 200).
 */
export async function recordWebhookEvent(eventId: string, eventType: string | null): Promise<boolean> {
  await ensureSubscriptionsSchema();
  const result = await pool().query(
    `INSERT INTO subscriptions.webhook_events (event_id, event_type)
     VALUES ($1, $2)
     ON CONFLICT (event_id) DO NOTHING
     RETURNING event_id`,
    [eventId, eventType],
  );
  return (result.rowCount ?? 0) > 0;
}

/**
 * Removes a ledger entry so a failed-after-record event is reprocessed on the
 * next Razorpay retry instead of being permanently skipped.
 */
export async function deleteWebhookEvent(eventId: string): Promise<void> {
  await ensureSubscriptionsSchema();
  await pool().query(`DELETE FROM subscriptions.webhook_events WHERE event_id = $1`, [eventId]);
}
