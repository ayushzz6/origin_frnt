/**
 * Per-subject premium subscription service (Phase 1.2).
 *
 * Orchestrates Razorpay Subscriptions + the subscriptions.* store + the derived
 * premium-flag recompute. Entitlement is granted ONLY by the webhook — the
 * client success handler never unlocks anything.
 *
 * See PREMIUM_AND_TEACHER_CONNECTION_PLAN.md (Phase 1.2).
 */

import { getRazorpayClient, getRazorpayKeyId } from "@/server/payments/razorpay-client";
import { getSubjectPlanId, SUBJECT_BILLING_CYCLES, SUBJECT_PRICE_MINOR } from "@/server/payments/subject-plans";
import { recomputeUserPremiumFlags } from "@/server/entitlements";
import { type Subject } from "@/lib/entitlements";

import {
  applyWebhookTransition,
  deleteWebhookEvent,
  getSubscriptionBySubject,
  listUserSubscriptions,
  recordWebhookEvent,
  upsertCreatedSubscription,
  type SubjectSubscription,
  type SubscriptionStatus,
} from "./subscriptions-store";

export type CreateSubscriptionResult = {
  subscriptionId: string;
  razorpayKeyId: string;
  shortUrl: string | null;
};

/**
 * Creates a Razorpay subscription for one subject and records a `created` row.
 * Returns the data the browser checkout needs. No entitlement is granted yet.
 */
export async function createSubjectSubscription(input: {
  userId: string;
  subject: Subject;
}): Promise<CreateSubscriptionResult> {
  const { userId, subject } = input;
  const planId = getSubjectPlanId(subject);
  const client = getRazorpayClient();

  const subscription = await client.subscriptions.create({
    plan_id: planId,
    total_count: SUBJECT_BILLING_CYCLES,
    customer_notify: 1,
    notes: { origin_user_id: userId, origin_subject: subject },
  });

  await upsertCreatedSubscription({
    userId,
    subject,
    razorpayPlanId: planId,
    razorpaySubscriptionId: subscription.id,
    shortUrl: subscription.short_url ?? null,
    amountMinor: SUBJECT_PRICE_MINOR,
  });

  return {
    subscriptionId: subscription.id,
    razorpayKeyId: getRazorpayKeyId(),
    shortUrl: subscription.short_url ?? null,
  };
}

/**
 * Cancels a subject subscription at the end of the current cycle, so the
 * student keeps access until current_period_end. The actual status flip is
 * applied by the resulting `subscription.cancelled` webhook.
 */
export async function cancelSubjectSubscription(input: {
  userId: string;
  subject: Subject;
}): Promise<SubjectSubscription> {
  const existing = await getSubscriptionBySubject(input.userId, input.subject);
  if (!existing || !existing.razorpaySubscriptionId) {
    const err = new Error("No active subscription found for this subject.");
    (err as { status?: number }).status = 404;
    throw err;
  }
  const client = getRazorpayClient();
  await client.subscriptions.cancel(existing.razorpaySubscriptionId, true);
  return existing;
}

export async function listMySubscriptions(userId: string): Promise<SubjectSubscription[]> {
  return listUserSubscriptions(userId);
}

// ─── Webhook handling ─────────────────────────────────────────────────────────

type RazorpayWebhookEvent = {
  event?: string;
  payload?: {
    subscription?: {
      entity?: {
        id?: string;
        status?: string;
        current_end?: number | null;
      };
    };
  };
};

/**
 * Maps a Razorpay subscription event to the local status. `activated` and
 * `charged` both ensure `active` (Razorpay may deliver them out of order, so we
 * never assume sequence). `halted`/`pending`/`cancelled`/`completed` keep the
 * existing period end so entitlement persists until it lapses.
 */
function statusForEvent(event: string): SubscriptionStatus | null {
  switch (event) {
    case "subscription.activated":
    case "subscription.charged":
    case "subscription.resumed":
      return "active";
    case "subscription.authenticated":
      return "authenticated";
    case "subscription.pending":
      return "pending";
    case "subscription.halted":
      return "halted";
    case "subscription.cancelled":
      return "cancelled";
    case "subscription.completed":
      return "completed";
    case "subscription.expired":
      return "expired";
    default:
      return null;
  }
}

export type WebhookProcessResult =
  | { processed: false; reason: "duplicate" | "ignored" | "unknown_subscription" }
  | { processed: true; userId: string; subject: Subject; status: SubscriptionStatus };

/**
 * Processes a verified Razorpay subscription webhook. Idempotent via the
 * webhook_events ledger; safe under duplicate delivery and reordering.
 */
export async function processSubscriptionWebhook(
  eventId: string,
  body: RazorpayWebhookEvent,
): Promise<WebhookProcessResult> {
  const eventType = body.event ?? null;

  // Idempotency: a re-delivered event id is acknowledged without reprocessing.
  const isNew = await recordWebhookEvent(eventId, eventType);
  if (!isNew) return { processed: false, reason: "duplicate" };

  // From here the event is recorded; if anything below throws we must remove the
  // ledger entry so Razorpay's retry reprocesses instead of skipping forever.
  try {
    if (!eventType) return { processed: false, reason: "ignored" };
    const status = statusForEvent(eventType);
    if (!status) return { processed: false, reason: "ignored" };

    const entity = body.payload?.subscription?.entity;
    const razorpaySubscriptionId = entity?.id;
    if (!razorpaySubscriptionId) return { processed: false, reason: "ignored" };

    // Only "active" transitions move the billing period forward; lapse states
    // keep the current period end so access persists to its natural expiry.
    const currentPeriodEnd =
      status === "active" && typeof entity?.current_end === "number"
        ? new Date(entity.current_end * 1000)
        : null;

    const updated = await applyWebhookTransition({
      razorpaySubscriptionId,
      status,
      currentPeriodEnd,
    });
    if (!updated) return { processed: false, reason: "unknown_subscription" };

    await recomputeUserPremiumFlags(updated.userId);

    return {
      processed: true,
      userId: updated.userId,
      subject: updated.subject,
      status,
    };
  } catch (error) {
    await deleteWebhookEvent(eventId).catch(() => undefined);
    throw error;
  }
}
