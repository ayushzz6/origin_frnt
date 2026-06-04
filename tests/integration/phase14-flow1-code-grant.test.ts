/**
 * Phase 14 — Flow 1 (redeem an institute code, then pick ONE Origin subject).
 *
 * Runs only when USER_DATABASE_URL is configured (CI + opt-in local). No Razorpay
 * calls — Flow 1 takes no payment; entitlement is the teacher_code grant.
 */

import test from "node:test";
import assert from "node:assert/strict";

process.env.TEACHER_LAUNCH_TEACHER_CONNECT = "1";

import { approveCollaboration, requestCollaboration } from "@/server/connect/collaboration-service";
import { grantConnectSubject, redeemConnectCode } from "@/server/connect/connect-service";
import { getEntitledSubjects } from "@/server/entitlements";
import { createWorkspaceCode } from "@/server/workspaces/store";
import { normalizeCode } from "@/server/workspaces/codes";

import { cleanup, closePool, dbConfigured, makeId, rawPool } from "./_db";

const SKIP = !dbConfigured();
const it = test;

it("phase 14: redeem code → pick subject grants entitlement; one subject per institute", { skip: SKIP }, async () => {
  const fx = await seedActiveCollaborator();
  try {
    const display = makeId("CODE").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12);
    await createWorkspaceCode({
      workspaceId: fx.workspaceId,
      normalizedCode: normalizeCode(display) ?? display,
      displayCode: display,
      codeType: "student_join",
      createdBy: fx.ownerId,
    });

    const redeemed = await redeemConnectCode({ studentId: fx.studentId, rawCode: display });
    assert.equal(redeemed.workspace.id, fx.workspaceId);
    assert.equal(redeemed.eligibleSubjects.length, 4);

    await grantConnectSubject({ studentId: fx.studentId, workspaceId: fx.workspaceId, subject: "physics" });
    assert.deepEqual(await getEntitledSubjects(fx.studentId), ["physics"]);

    // Idempotent for the same subject.
    await grantConnectSubject({ studentId: fx.studentId, workspaceId: fx.workspaceId, subject: "physics" });
    assert.deepEqual(await getEntitledSubjects(fx.studentId), ["physics"]);

    // A different subject for the same institute is rejected (Flow 1 = one subject).
    await assert.rejects(
      () => grantConnectSubject({ studentId: fx.studentId, workspaceId: fx.workspaceId, subject: "chemistry" }),
      (err) => (err as { status?: number }).status === 409,
    );
  } finally {
    await rawPool().query(`DELETE FROM entitlements.subject_grants WHERE user_id = $1`, [fx.studentId]);
    await cleanup(fx);
  }
});

async function seedActiveCollaborator() {
  const { seedFixtures } = await import("./_db");
  const fx = await seedFixtures();
  await requestCollaboration({ workspaceId: fx.workspaceId, actorUserId: fx.ownerId });
  await approveCollaboration({ workspaceId: fx.workspaceId, adminUserId: fx.ownerId });
  return fx;
}

test.after(async () => {
  if (!SKIP) await closePool();
});
