/**
 * Phase 14 — Flow 2 (recurring batch tuition).
 *
 * Covers: batch-not-active rejected BEFORE any Razorpay call; webhook idempotency +
 * non-blocking enqueue; drain-driven enroll + batch assignment; lapse teardown via
 * the reconciliation path. The Razorpay API is never called (we seed `created` rows
 * directly and drive the webhook intake + job drain, which make no outbound calls).
 *
 * Runs only when USER_DATABASE_URL is configured (CI + opt-in local).
 */

import test from "node:test";
import assert from "node:assert/strict";

process.env.TEACHER_LAUNCH_TEACHER_CONNECT = "1";

import { approveCollaboration, requestCollaboration } from "@/server/connect/collaboration-service";
import {
  createConnectCheckout,
  intakeConnectWebhook,
  reconcileEnrollmentSubscriptions,
} from "@/server/connect/enrollment-subscription-service";
import { createEnrollmentSubscription } from "@/server/connect/enrollment-subscriptions-store";
import { drainConnectJobs } from "@/server/connect/connect-jobs";
import { createBatch, isStudentInBatch } from "@/server/workspaces/batches";
import { getEnrollment } from "@/server/workspaces/enrollments";
import { createOffering } from "@/server/workspaces/marketplace-store";

import { cleanup, closePool, dbConfigured, makeId, rawPool, seedFixtures } from "./_db";

const SKIP = !dbConfigured();
const it = test;

const DAY = 24 * 60 * 60;
function unixIn(days: number): number {
  return Math.floor(Date.now() / 1000) + days * DAY;
}

function activatedEvent(subId: string, currentEnd: number) {
  return {
    event: "subscription.activated",
    payload: { subscription: { entity: { id: subId, current_end: currentEnd } } },
  };
}

it("phase 14: checkout rejects a non-active batch before any Razorpay call", { skip: SKIP }, async () => {
  const fx = await seedFixtures();
  await requestCollaboration({ workspaceId: fx.workspaceId, actorUserId: fx.ownerId });
  await approveCollaboration({ workspaceId: fx.workspaceId, adminUserId: fx.ownerId });
  try {
    const archivedBatch = await createBatch({
      workspaceId: fx.workspaceId,
      name: "Archived Batch",
      createdBy: fx.ownerId,
      status: "archived",
    });
    const offering = await createOffering({
      workspaceId: fx.workspaceId,
      title: "Offering for archived batch",
      priceMinor: 99900,
      currency: "INR",
      targetBatchId: archivedBatch.id,
      status: "active",
    });

    await assert.rejects(
      () =>
        createConnectCheckout({
          studentId: fx.studentId,
          workspaceId: fx.workspaceId,
          offeringId: offering.id,
        }),
      (err) => (err as { status?: number }).status === 400,
      "batch-not-active is rejected pre-Razorpay",
    );
  } finally {
    await cleanup(fx);
  }
});

it("phase 14: connect webhook is idempotent, non-blocking, then drain enrolls + assigns; lapse tears down", { skip: SKIP }, async () => {
  const fx = await seedFixtures();
  const subId = makeId("rzpsub").replace(/_/g, "");
  const evtActivate = makeId("evt");
  const evtCancel = makeId("evt");
  try {
    await createEnrollmentSubscription({
      offeringId: fx.offeringId,
      workspaceId: fx.workspaceId,
      studentId: fx.studentId,
      targetBatchId: fx.batchId,
      razorpayPlanId: "plan_test",
      razorpaySubscriptionId: subId,
      amountMinor: 99900,
      shortUrl: null,
    });

    // Webhook records + enqueues fast; it does NOT enroll inline.
    const first = await intakeConnectWebhook(evtActivate, activatedEvent(subId, unixIn(30)));
    assert.equal(first.processed, true);
    if (first.processed) assert.equal(first.enqueued, true);
    assert.equal(
      await isStudentInBatch(fx.workspaceId, fx.batchId, fx.studentId),
      false,
      "no enrollment before the drain (non-blocking)",
    );

    // Duplicate delivery is a no-op.
    const dup = await intakeConnectWebhook(evtActivate, activatedEvent(subId, unixIn(30)));
    assert.equal(dup.processed, false);

    // Drain performs the enroll + batch assignment.
    await drainConnectJobs();
    assert.equal(await isStudentInBatch(fx.workspaceId, fx.batchId, fx.studentId), true);
    const enrollment = await getEnrollment(fx.workspaceId, fx.studentId);
    assert.ok(enrollment, "enrollment row created by the drain");

    // Cancel keeps access until the period end; lapse + reconcile tears it down.
    await intakeConnectWebhook(evtCancel, {
      event: "subscription.cancelled",
      payload: { subscription: { entity: { id: subId } } },
    });
    await drainConnectJobs();
    await rawPool().query(
      `UPDATE commerce.enrollment_subscriptions
          SET current_period_end = NOW() - INTERVAL '1 day' WHERE razorpay_subscription_id = $1`,
      [subId],
    );
    const reconcile = await reconcileEnrollmentSubscriptions();
    assert.ok(reconcile.tornDown >= 1);
    assert.equal(
      await isStudentInBatch(fx.workspaceId, fx.batchId, fx.studentId),
      false,
      "lapsed subscription removed from the batch",
    );
  } finally {
    const pool = rawPool();
    await pool.query(`DELETE FROM app.connect_jobs WHERE payload->>'razorpaySubscriptionId' = $1`, [subId]);
    await pool.query(`DELETE FROM commerce.subscription_webhook_events WHERE event_id = ANY($1)`, [
      [evtActivate, evtCancel],
    ]);
    await pool.query(`DELETE FROM commerce.enrollment_subscriptions WHERE razorpay_subscription_id = $1`, [subId]);
    await cleanup(fx);
  }
});

test.after(async () => {
  if (!SKIP) await closePool();
});
