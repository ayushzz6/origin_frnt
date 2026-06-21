/**
 * Phase 14 / 2G — student "My institutes" listing (listStudentInstitutes).
 *
 * Proves the student-side visibility fix: after redeeming an active collaborator's
 * code the student can SEE the institute (enrollment exists) even before a batch is
 * assigned or a subject unlocked, and the per-institute batches + subjects fill in as
 * the teacher assigns a batch and the student picks a subject.
 *
 * Runs only when USER_DATABASE_URL is configured (CI + opt-in local). No Razorpay.
 */

import test from "node:test";
import assert from "node:assert/strict";

process.env.TEACHER_LAUNCH_TEACHER_CONNECT = "1";

import { approveCollaboration, requestCollaboration } from "@/server/connect/collaboration-service";
import {
  grantConnectSubject,
  listStudentInstitutes,
  redeemConnectCode,
} from "@/server/connect/connect-service";
import { addStudentsToBatches } from "@/server/workspaces/batches";
import { createWorkspaceCode } from "@/server/workspaces/store";
import { normalizeCode } from "@/server/workspaces/codes";

import { cleanup, closePool, dbConfigured, makeId, rawPool } from "./_db";

const SKIP = !dbConfigured();
const it = test;

it("phase 14: listStudentInstitutes surfaces the connected institute + batches + subjects", { skip: SKIP }, async () => {
  const fx = await seedActiveCollaborator();
  try {
    // Before any connection: the student has no institutes.
    assert.deepEqual(await listStudentInstitutes(fx.studentId), []);

    // Redeem the institute code → unassigned enrollment.
    const display = makeId("CODE").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12);
    await createWorkspaceCode({
      workspaceId: fx.workspaceId,
      normalizedCode: normalizeCode(display) ?? display,
      displayCode: display,
      codeType: "student_join",
      createdBy: fx.ownerId,
    });
    await redeemConnectCode({ studentId: fx.studentId, rawCode: display });

    // The institute is now visible to the student even with no batch / no subject.
    const afterRedeem = await listStudentInstitutes(fx.studentId);
    assert.equal(afterRedeem.length, 1, "one connected institute after redeem");
    const inst = afterRedeem[0];
    assert.equal(inst.workspaceId, fx.workspaceId);
    assert.equal(inst.enrollmentStatus, "unassigned");
    assert.equal(inst.isActiveCollaborator, true);
    assert.deepEqual(inst.batches, [], "no batch assigned yet");
    assert.deepEqual(inst.subjects, [], "no subject unlocked yet");

    // Teacher assigns the student to a batch → batch shows + enrollment goes active.
    await addStudentsToBatches({
      workspaceId: fx.workspaceId,
      batchIds: [fx.batchId],
      studentIds: [fx.studentId],
      assignedBy: fx.ownerId,
    });
    const afterBatch = await listStudentInstitutes(fx.studentId);
    assert.equal(afterBatch[0].enrollmentStatus, "active");
    assert.equal(afterBatch[0].batches.length, 1);
    assert.equal(afterBatch[0].batches[0].id, fx.batchId);

    // Student picks a subject → it shows under this institute.
    await grantConnectSubject({ studentId: fx.studentId, workspaceId: fx.workspaceId, subject: "physics" });
    const afterGrant = await listStudentInstitutes(fx.studentId);
    assert.deepEqual(afterGrant[0].subjects, ["physics"]);
  } finally {
    await rawPool().query(`DELETE FROM entitlements.subject_grants WHERE user_id = $1`, [fx.studentId]);
    await rawPool().query(`DELETE FROM app.batch_members WHERE student_id = $1`, [fx.studentId]);
    await rawPool().query(`DELETE FROM app.workspace_student_enrollments WHERE student_id = $1`, [fx.studentId]);
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
