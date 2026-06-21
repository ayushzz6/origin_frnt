/**
 * Phase 14 — teacher tests → student visibility + server-side membership gate.
 *
 * A published teacher test assigned to a batch is visible to enrolled students and
 * resolvable (with cohort context) only for batch members; a non-member resolves to
 * null (→ 403 at the route). Runs only when USER_DATABASE_URL is configured.
 */

import test from "node:test";
import assert from "node:assert/strict";

process.env.TEACHER_LAUNCH_TEACHER_CONNECT = "1";

import { addStudentsToBatches } from "@/server/workspaces/batches";
import {
  addQuestionToTest,
  createAssignment,
  createTest,
  getAssignedTestForStudent,
  listAssignedTestPreviewsForStudent,
} from "@/server/workspaces/tests-store";

import { cleanup, closePool, dbConfigured, makeId, rawPool, seedFixtures } from "./_db";

const SKIP = !dbConfigured();
const it = test;

it("phase 14: enrolled students see assigned teacher tests; non-members are gated", { skip: SKIP }, async () => {
  const fx = await seedFixtures();
  const outsiderId = makeId("user_outsider");
  await rawPool().query(
    `INSERT INTO origin_users (id, name, email, role, password_hash) VALUES ($1, 'Outsider', $2, 'student', 'test-no-login')
     ON CONFLICT (id) DO NOTHING`,
    [outsiderId, `${outsiderId}@example.com`],
  );

  try {
    // The fixture student joins the batch; the outsider does not.
    await addStudentsToBatches({
      workspaceId: fx.workspaceId,
      batchIds: [fx.batchId],
      studentIds: [fx.studentId],
      assignedBy: null,
    });

    const teacherTest = await createTest({
      workspaceId: fx.workspaceId,
      createdBy: fx.ownerId,
      title: "Weekly Physics Test",
      subject: "physics",
      durationMinutes: 30,
      totalQuestions: 1,
      status: "published",
    });
    await addQuestionToTest({
      testId: teacherTest.id,
      position: 0,
      sourceBank: "ogcode",
      ogcodeQuestionId: "ogq_phase14_visibility",
    });
    const assignment = await createAssignment({
      testId: teacherTest.id,
      workspaceId: fx.workspaceId,
      batchId: fx.batchId,
      assignedBy: fx.ownerId,
    });

    // Member sees it in the list.
    const previews = await listAssignedTestPreviewsForStudent(fx.studentId);
    const found = previews.find((p) => p.id === teacherTest.id);
    assert.ok(found, "assigned teacher test is visible to the enrolled student");
    assert.equal(found?.assignmentId, assignment.id);
    assert.equal(found?.workspaceId, fx.workspaceId);
    assert.equal(found?.batchId, fx.batchId);

    // Member resolves the test with cohort context + ogcode question ids.
    const resolved = await getAssignedTestForStudent(fx.studentId, teacherTest.id);
    assert.ok(resolved, "member can resolve the test");
    assert.equal(resolved?.workspaceId, fx.workspaceId);
    assert.equal(resolved?.batchId, fx.batchId);
    assert.deepEqual(resolved?.ogcodeQuestionIds, ["ogq_phase14_visibility"]);

    // Non-member is gated: not listed and not resolvable.
    const outsiderPreviews = await listAssignedTestPreviewsForStudent(outsiderId);
    assert.equal(outsiderPreviews.find((p) => p.id === teacherTest.id), undefined);
    assert.equal(await getAssignedTestForStudent(outsiderId, teacherTest.id), null);
  } finally {
    await rawPool().query(`DELETE FROM origin_users WHERE id = $1`, [outsiderId]);
    await cleanup(fx);
  }
});

test.after(async () => {
  if (!SKIP) await closePool();
});
