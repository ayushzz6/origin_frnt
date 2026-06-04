/**
 * Flow-2 enrollment-subscription service (Phase 14, sections B + D).
 *
 * Checkout creates the recurring batch-tuition Razorpay subscription (+ optional
 * Phase-1 subject add-on subscriptions) and returns the ids the browser opens
 * sequentially. GRANTS HAPPEN ONLY VIA WEBHOOKS — checkout records `created` rows
 * and never enrolls. The connect webhook verifies + records + enqueues; the job
 * drain does the enroll/assign work; a reconciliation cron tears down lapses.
 *
 * Razorpay plan creation is NOT in the checkout hot path: a per-offering monthly
 * plan is created when the teacher publishes the offering (enqueued). If the plan
 * is somehow missing at checkout we enqueue creation and return `pending`.
 */

import { AuthzError } from "@/server/authz";

import { getRazorpayClient, getRazorpayKeyId } from "@/server/payments/razorpay-client";
import { recomputeUserPremiumFlags } from "@/server/entitlements";
import { createSubjectSubscription } from "@/server/subscriptions/subscriptions-service";
import { addStudentsToBatches, getBatch, removeStudentFromBatch } from "@/server/workspaces/batches";
import { enrollStudent, setEnrollmentStatus } from "@/server/workspaces/enrollments";
import { getOffering } from "@/server/workspaces/marketplace-store";
import { normalizeSubject, type Subject } from "@/lib/entitlements";
import type { EnrollmentSubscription, EnrollmentSubscriptionStatus } from "@/server/workspaces/types";

import { assertActiveCollaborator } from "./collaboration-service";
import { enqueueConnectJob } from "./connect-jobs";
import {
  applyEnrollmentSubscriptionTransition,
  createEnrollmentSubscription,
  getEnrollmentSubscriptionByRazorpayId,
  linkEnrollmentSubscriptionEnrollment,
  listLapsedEnrollmentSubscriptions,
  recordConnectWebhookEvent,
  deleteConnectWebhookEvent,
  setOfferingPlanId,
} from "./enrollment-subscriptions-store";

/** Razorpay requires a finite total_count; 120 monthly cycles ≈ 10 years. */
const MONTHLY_BILLING_CYCLES = 120;

// ─── Publish-time plan creation ────────────────────────────────────────────────

/**
 * Creates (idempotently) the Razorpay monthly plan for a recurring offering and
 * stores it on the offering. Safe to re-run: if the offering already has a plan id
 * it is returned unchanged. Runs in the background (publish hook / job), never in
 * the checkout hot path.
 */
export async function ensureOfferingPlan(workspaceId: string, offeringId: string): Promise<string> {
  const offering = await getOffering(workspaceId, offeringId);
  if (!offering) throw new Error("Offering not found for plan creation.");
  if (offering.razorpayPlanId) return offering.razorpayPlanId;

  const client = getRazorpayClient();
  const plan = await client.plans.create({
    period: "monthly",
    interval: 1,
    item: {
      name: `Origin batch tuition — ${offering.title}`.slice(0, 255),
      amount: offering.priceMinor,
      currency: offering.currency || "INR",
    },
    notes: { origin_workspace_id: workspaceId, origin_offering_id: offeringId },
  } as Parameters<typeof client.plans.create>[0]);

  await setOfferingPlanId(workspaceId, offeringId, plan.id);
  return plan.id;
}

/** Enqueue publish-time plan creation (called from offering publish; non-blocking). */
export async function enqueueOfferingPlanCreation(
  workspaceId: string,
  offeringId: string,
): Promise<void> {
  await enqueueConnectJob({
    kind: "ensure_offering_plan",
    payload: { workspaceId, offeringId },
  });
}

export async function handleEnsureOfferingPlanJob(payload: Record<string, unknown>): Promise<void> {
  const workspaceId = String(payload.workspaceId ?? "");
  const offeringId = String(payload.offeringId ?? "");
  if (!workspaceId || !offeringId) throw new Error("ensure_offering_plan: missing ids.");
  await ensureOfferingPlan(workspaceId, offeringId);
}

// ─── Checkout ──────────────────────────────────────────────────────────────────

export type ConnectCheckoutResult =
  | { status: "pending"; detail: string }
  | {
      status: "ready";
      razorpayKeyId: string;
      batchSubscription: { subscriptionId: string; shortUrl: string | null };
      addonSubscriptions: { subject: Subject; subscriptionId: string; shortUrl: string | null }[];
    };

/**
 * Builds a Flow-2 checkout: one recurring batch-tuition subscription plus optional
 * per-subject add-on subscriptions (the Phase-1 monthly subject subs). Guard chain:
 * active collaborator → offering active → target batch exists & active. No grant or
 * enrollment happens here.
 */
export async function createConnectCheckout(input: {
  studentId: string;
  workspaceId: string;
  offeringId: string;
  addonSubjects?: string[];
}): Promise<ConnectCheckoutResult> {
  const offering = await getOffering(input.workspaceId, input.offeringId);
  if (!offering) throw new AuthzError(404, "Offering not found.");

  // Guard chain (closes the Phase-12 batch gap; also back-ported into markOrderPaidService).
  await assertActiveCollaborator(input.workspaceId);
  if (offering.status !== "active") {
    throw new AuthzError(400, `Offering is ${offering.status}; not available for enrollment.`);
  }
  if (!offering.targetBatchId) {
    throw new AuthzError(400, "This offering is not linked to a batch.");
  }
  const batch = await getBatch(input.workspaceId, offering.targetBatchId);
  if (!batch || batch.status !== "active") {
    throw new AuthzError(400, "The batch for this offering is not currently active.");
  }

  // Plan must already exist (created at publish time). Missing → enqueue + pending.
  if (!offering.razorpayPlanId) {
    await enqueueOfferingPlanCreation(input.workspaceId, input.offeringId);
    return {
      status: "pending",
      detail: "This offering is being set up for enrollment. Please try again shortly.",
    };
  }

  const client = getRazorpayClient();
  const batchSub = await client.subscriptions.create({
    plan_id: offering.razorpayPlanId,
    total_count: MONTHLY_BILLING_CYCLES,
    customer_notify: 1,
    notes: {
      origin_user_id: input.studentId,
      origin_workspace_id: input.workspaceId,
      origin_offering_id: input.offeringId,
      origin_kind: "batch_tuition",
    },
  });

  await createEnrollmentSubscription({
    offeringId: input.offeringId,
    workspaceId: input.workspaceId,
    studentId: input.studentId,
    targetBatchId: offering.targetBatchId,
    razorpayPlanId: offering.razorpayPlanId,
    razorpaySubscriptionId: batchSub.id,
    amountMinor: offering.priceMinor,
    shortUrl: batchSub.short_url ?? null,
  });

  // Subject add-ons reuse the Phase-1 per-subject subscription path verbatim.
  const addonSubjects = dedupeSubjects(input.addonSubjects);
  const addons: { subject: Subject; subscriptionId: string; shortUrl: string | null }[] = [];
  for (const subject of addonSubjects) {
    const created = await createSubjectSubscription({ userId: input.studentId, subject });
    addons.push({ subject, subscriptionId: created.subscriptionId, shortUrl: created.shortUrl });
  }

  return {
    status: "ready",
    razorpayKeyId: getRazorpayKeyId(),
    batchSubscription: { subscriptionId: batchSub.id, shortUrl: batchSub.short_url ?? null },
    addonSubscriptions: addons,
  };
}

function dedupeSubjects(values: string[] | undefined): Subject[] {
  if (!values || values.length === 0) return [];
  const out = new Set<Subject>();
  for (const v of values) {
    const s = normalizeSubject(v);
    if (s) out.add(s);
  }
  return [...out];
}

// ─── Webhook intake (non-blocking: verify → record → enqueue) ───────────────────

type RazorpaySubscriptionEvent = {
  event?: string;
  payload?: { subscription?: { entity?: { id?: string; current_end?: number | null } } };
};

function statusForEvent(event: string): EnrollmentSubscriptionStatus | null {
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

export type ConnectWebhookIntakeResult =
  | { processed: false; reason: "duplicate" | "ignored" }
  | { processed: true; enqueued: boolean };

/**
 * Records the verified event in the idempotency ledger and enqueues a transition
 * job. Returns fast — no enroll/assign happens here. The HMAC is verified by the
 * route before this is called.
 */
export async function intakeConnectWebhook(
  eventId: string,
  body: RazorpaySubscriptionEvent,
): Promise<ConnectWebhookIntakeResult> {
  const eventType = body.event ?? null;
  const isNew = await recordConnectWebhookEvent(eventId, eventType);
  if (!isNew) return { processed: false, reason: "duplicate" };

  try {
    if (!eventType) return { processed: true, enqueued: false };
    const status = statusForEvent(eventType);
    const entity = body.payload?.subscription?.entity;
    const razorpaySubscriptionId = entity?.id;
    if (!status || !razorpaySubscriptionId) return { processed: true, enqueued: false };

    const currentPeriodEnd =
      status === "active" && typeof entity?.current_end === "number"
        ? new Date(entity.current_end * 1000).toISOString()
        : null;

    await enqueueConnectJob({
      kind: "enrollment_subscription_transition",
      payload: { razorpaySubscriptionId, status, currentPeriodEnd },
    });
    return { processed: true, enqueued: true };
  } catch (error) {
    // Roll back the ledger row so Razorpay's retry reprocesses instead of skipping.
    await deleteConnectWebhookEvent(eventId).catch(() => undefined);
    throw error;
  }
}

// ─── Job handlers (run in the drain) ────────────────────────────────────────────

export async function handleEnrollmentSubscriptionTransitionJob(
  payload: Record<string, unknown>,
): Promise<void> {
  const razorpaySubscriptionId = String(payload.razorpaySubscriptionId ?? "");
  const status = String(payload.status ?? "") as EnrollmentSubscriptionStatus;
  if (!razorpaySubscriptionId || !status) return;
  const rawEnd = payload.currentPeriodEnd;
  const currentPeriodEnd = typeof rawEnd === "string" && rawEnd ? new Date(rawEnd) : null;

  const sub = await applyEnrollmentSubscriptionTransition({
    razorpaySubscriptionId,
    status,
    currentPeriodEnd,
  });
  if (!sub) return; // unknown subscription id — nothing to do

  if (status === "active") {
    await activateEnrollmentSubscription(sub);
  }
  // Lapse states (halted/cancelled/completed/expired) keep access to
  // current_period_end; the reconciliation cron tears them down after it lapses.
}

/** Enroll + assign the batch for an activated recurring subscription (idempotent). */
async function activateEnrollmentSubscription(sub: EnrollmentSubscription): Promise<void> {
  const batchActive = sub.targetBatchId
    ? Boolean(await getBatch(sub.workspaceId, sub.targetBatchId))
    : false;

  const { enrollment } = await enrollStudent({
    workspaceId: sub.workspaceId,
    studentId: sub.studentId,
    source: "paid_app",
    initialStatus: sub.targetBatchId && batchActive ? "active" : "unassigned",
  });

  if (sub.targetBatchId && batchActive) {
    await addStudentsToBatches({
      workspaceId: sub.workspaceId,
      batchIds: [sub.targetBatchId],
      studentIds: [sub.studentId],
      assignedBy: null,
    });
  }

  await linkEnrollmentSubscriptionEnrollment(sub.id, enrollment.id);
}

/**
 * Reconciliation cron: tear down batch access for recurring subscriptions whose
 * grace period has lapsed (suspend the enrollment + remove from the batch). The
 * subject add-on subscriptions are torn down by the Phase-1 recompute path.
 */
export async function reconcileEnrollmentSubscriptions(): Promise<{ tornDown: number }> {
  const lapsed = await listLapsedEnrollmentSubscriptions();
  let tornDown = 0;
  for (const sub of lapsed) {
    if (sub.targetBatchId) {
      await removeStudentFromBatch({
        workspaceId: sub.workspaceId,
        batchId: sub.targetBatchId,
        studentId: sub.studentId,
      });
    }
    await setEnrollmentStatus(sub.workspaceId, sub.studentId, "suspended");
    // Subject entitlements (if any add-on lapsed) are mirrored separately.
    await recomputeUserPremiumFlags(sub.studentId);
    tornDown += 1;
  }
  return { tornDown };
}

export { getEnrollmentSubscriptionByRazorpayId };
