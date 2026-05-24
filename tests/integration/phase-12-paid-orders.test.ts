/**
 * Phase 12 integration tests — paid order flow, idempotency, refund, and
 * the batch FK we fixed in fix/phase-10-12-review-gaps.
 *
 * Runs only when USER_DATABASE_URL is configured (CI + opt-in local).
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  createOrderService,
  markOrderFailedService,
  markOrderPaidService,
  refundOrderService,
} from "@/server/workspaces/marketplace-service";

import { cleanup, closePool, dbConfigured, rawPool, seedFixtures } from "./_db";

const SKIP = !dbConfigured();
const it = test;

it("phase 12: payment success creates enrollment + batch assignment", { skip: SKIP }, async () => {
  const fx = await seedFixtures();
  try {
    const order = await createOrderService({
      workspaceId: fx.workspaceId,
      offeringId: fx.offeringId,
      studentId: fx.studentId,
    });
    assert.equal(order.status, "created");

    const paid = await markOrderPaidService({
      orderId: order.id,
      workspaceId: fx.workspaceId,
      provider: "razorpay",
      providerPaymentId: `pi_${Math.random().toString(36).slice(2)}`,
    });
    assert.equal(paid.status, "paid");
    assert.ok(paid.enrollmentId, "paid order links to enrollment");

    // Enrollment row exists for the student.
    const enrRows = await rawPool().query(
      `SELECT status, source FROM app.workspace_student_enrollments
       WHERE workspace_id = $1 AND student_id = $2`,
      [fx.workspaceId, fx.studentId],
    );
    assert.equal(enrRows.rowCount, 1);
    assert.equal(enrRows.rows[0].source, "paid_app");
    assert.equal(enrRows.rows[0].status, "active");

    // Batch assignment happened (assigned_by must be NULL — the fix we
    // shipped earlier; passing "system" would have FK-violated).
    const bmRows = await rawPool().query(
      `SELECT assigned_by FROM app.batch_members
       WHERE batch_id = $1 AND student_id = $2`,
      [fx.batchId, fx.studentId],
    );
    assert.equal(bmRows.rowCount, 1);
    assert.equal(bmRows.rows[0].assigned_by, null);
  } finally {
    await cleanup(fx);
  }
});

it("phase 12: duplicate create returns the same order id", { skip: SKIP }, async () => {
  const fx = await seedFixtures();
  try {
    const first = await createOrderService({
      workspaceId: fx.workspaceId,
      offeringId: fx.offeringId,
      studentId: fx.studentId,
    });
    const second = await createOrderService({
      workspaceId: fx.workspaceId,
      offeringId: fx.offeringId,
      studentId: fx.studentId,
    });
    assert.equal(second.id, first.id, "second create reuses first order");

    // Mark first as paid; a third create-call must reuse it (paid → reuse).
    await markOrderPaidService({
      orderId: first.id,
      workspaceId: fx.workspaceId,
      provider: "razorpay",
      providerPaymentId: "pi_dedupe",
    });
    const third = await createOrderService({
      workspaceId: fx.workspaceId,
      offeringId: fx.offeringId,
      studentId: fx.studentId,
    });
    assert.equal(third.id, first.id, "post-paid create still reuses");
    assert.equal(third.status, "paid");
  } finally {
    await cleanup(fx);
  }
});

it("phase 12: markOrderPaid is idempotent under duplicate webhook", { skip: SKIP }, async () => {
  const fx = await seedFixtures();
  try {
    const order = await createOrderService({
      workspaceId: fx.workspaceId,
      offeringId: fx.offeringId,
      studentId: fx.studentId,
    });
    const args = {
      orderId: order.id,
      workspaceId: fx.workspaceId,
      provider: "razorpay",
      providerPaymentId: "pi_replay",
    };
    const a = await markOrderPaidService(args);
    const b = await markOrderPaidService(args);
    assert.equal(a.id, b.id);
    assert.equal(b.status, "paid");

    const enrCount = await rawPool().query(
      `SELECT COUNT(*)::int AS c FROM app.workspace_student_enrollments
       WHERE workspace_id = $1 AND student_id = $2`,
      [fx.workspaceId, fx.studentId],
    );
    assert.equal(enrCount.rows[0].c, 1, "duplicate webhook does not double-enroll");
  } finally {
    await cleanup(fx);
  }
});

it("phase 12: refund preserves batch history (no rows deleted)", { skip: SKIP }, async () => {
  const fx = await seedFixtures();
  try {
    const order = await createOrderService({
      workspaceId: fx.workspaceId,
      offeringId: fx.offeringId,
      studentId: fx.studentId,
    });
    await markOrderPaidService({
      orderId: order.id,
      workspaceId: fx.workspaceId,
      provider: "razorpay",
      providerPaymentId: "pi_refund",
    });
    const refunded = await refundOrderService({
      orderId: order.id,
      workspaceId: fx.workspaceId,
      actorUserId: fx.ownerId,
      reason: "test refund",
    });
    assert.equal(refunded.status, "refunded");

    // Batch membership row still exists post-refund (history preserved).
    const bm = await rawPool().query(
      `SELECT 1 FROM app.batch_members WHERE batch_id = $1 AND student_id = $2`,
      [fx.batchId, fx.studentId],
    );
    assert.equal(bm.rowCount, 1);

    // Enrollment row still exists (operational decision: refund does not
    // auto-disenroll; an admin or workspace owner does that separately).
    const enr = await rawPool().query(
      `SELECT 1 FROM app.workspace_student_enrollments
       WHERE workspace_id = $1 AND student_id = $2`,
      [fx.workspaceId, fx.studentId],
    );
    assert.equal(enr.rowCount, 1);
  } finally {
    await cleanup(fx);
  }
});

it("phase 12: payment failure does not create enrollment", { skip: SKIP }, async () => {
  const fx = await seedFixtures();
  try {
    const order = await createOrderService({
      workspaceId: fx.workspaceId,
      offeringId: fx.offeringId,
      studentId: fx.studentId,
    });
    const failed = await markOrderFailedService({
      orderId: order.id,
      workspaceId: fx.workspaceId,
      reason: "card declined",
    });
    assert.equal(failed!.status, "failed");

    const enr = await rawPool().query(
      `SELECT COUNT(*)::int AS c FROM app.workspace_student_enrollments
       WHERE workspace_id = $1 AND student_id = $2`,
      [fx.workspaceId, fx.studentId],
    );
    assert.equal(enr.rows[0].c, 0);
  } finally {
    await cleanup(fx);
  }
});

test.after(async () => {
  if (!SKIP) await closePool();
});
