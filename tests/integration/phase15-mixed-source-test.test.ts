/**
 * Phase 15 — mixed-source teacher tests (OG Code + Question Bag).
 *
 * Verifies the create path accepts and persists both source banks (with per-row
 * marks + positions), validates ogcode ids, and that the take path resolves BOTH
 * banks in order (the Phase-0 fix — workspace_bag questions used to drop silently).
 *
 * Runs only when USER_DATABASE_URL is configured. Pins the OGCODE pool to the USER
 * DSN so the ogcode catalog + content questions live in one physical DB.
 */

import test from "node:test";
import assert from "node:assert/strict";

process.env.TEACHER_LAUNCH_TEACHER_CONNECT = "1";
process.env.TEACHER_LAUNCH_TEACHER_OGCODE = "1";
if (process.env.USER_DATABASE_URL) {
  process.env.OGCODE_DATABASE_URL = process.env.OGCODE_DATABASE_URL ?? process.env.USER_DATABASE_URL;
}

import { addStudentsToBatches } from "@/server/workspaces/batches";
import { getOgcodeCatalogQuestionMap } from "@/server/ogcode-catalog";
import {
  createTeacherTest,
  deleteTeacherTest,
  updateTeacherTest,
} from "@/server/workspaces/tests-service";
import { getContentQuestionStoredMap } from "@/server/workspaces/test-question-resolver";
import {
  createAssignment,
  getAssignedTestForStudent,
  updateTest,
} from "@/server/workspaces/tests-store";
import {
  createTeacherQuestion,
  publishPrivateQuestion,
} from "@/server/workspaces/questions-service";

import { cleanup, closePool, dbConfigured, makeId, rawPool, seedFixtures } from "./_db";

const SKIP = !dbConfigured();
const it = test;

async function seedOgcodeQuestion(id: string): Promise<void> {
  // Trigger ensureCatalogSchema (creates the table on a fresh DB) before inserting.
  await getOgcodeCatalogQuestionMap(["__ensure_schema__"]);
  await rawPool().query(
    `INSERT INTO ogcode_questions
       (id, source_index, text, explanation, subject, chapter, concept, difficulty, question_type, options, correct_option)
     VALUES ($1, $2, 'OG sample question', 'because', 'physics', 'Electrostatics', 'Coulomb', 'medium', 'mcq',
             '["A","B","C","D"]'::jsonb, 0)
     ON CONFLICT (id) DO NOTHING`,
    [id, Math.floor(Math.random() * 1_000_000_000)],
  );
}

it("phase 15: mixed OG Code + Question Bag test persists and resolves both banks", { skip: SKIP }, async () => {
  const fx = await seedFixtures();
  const ogId = makeId("ogq");
  let contentQuestionId = "";

  try {
    await seedOgcodeQuestion(ogId);

    // A ready Question-Bag question.
    const bagQuestion = await createTeacherQuestion({
      workspaceId: fx.workspaceId,
      createdBy: fx.ownerId,
      actorUserId: fx.ownerId,
      questionType: "mcq",
      stem: "Bag sample question",
      options: [
        { id: "a", text: "Alpha" },
        { id: "b", text: "Beta" },
      ],
      correctOption: 0,
      subject: "physics",
      chapter: "Electrostatics",
      concept: "Coulomb",
      difficulty: "medium",
    });
    contentQuestionId = bagQuestion.id;
    await publishPrivateQuestion({
      actorUserId: fx.ownerId,
      workspaceId: fx.workspaceId,
      questionId: bagQuestion.id,
    });

    // Create the mixed-source test (ogcode first, bag second).
    const teacherTest = await createTeacherTest({
      workspaceId: fx.workspaceId,
      actorUserId: fx.ownerId,
      createdBy: fx.ownerId,
      title: "Mixed Source Test",
      subject: "physics",
      durationMinutes: 30,
      questions: [
        { position: 1, sourceBank: "ogcode", ogcodeQuestionId: ogId, marks: 4, negativeMarks: 1 },
        { position: 2, sourceBank: "workspace_bag", contentQuestionId, marks: 2, negativeMarks: 0 },
      ],
    });
    assert.equal(teacherTest.questions.length, 2, "both questions persisted");
    assert.equal(teacherTest.totalQuestions, 2, "total_questions spans both banks");

    // Publish + assign + enroll so the student can resolve it.
    await updateTest(teacherTest.id, { status: "published" });
    await createAssignment({
      testId: teacherTest.id,
      workspaceId: fx.workspaceId,
      batchId: fx.batchId,
      assignedBy: fx.ownerId,
    });
    await addStudentsToBatches({
      workspaceId: fx.workspaceId,
      batchIds: [fx.batchId],
      studentIds: [fx.studentId],
      assignedBy: null,
    });

    // The take path now returns BOTH banks' ids in position order.
    const resolved = await getAssignedTestForStudent(fx.studentId, teacherTest.id);
    assert.deepEqual(
      resolved?.orderedQuestionIds,
      [ogId, contentQuestionId],
      "ordered ids span ogcode + workspace_bag",
    );

    // Each id resolves to a renderable StoredQuestion via its bank.
    const ogMap = await getOgcodeCatalogQuestionMap([ogId]);
    assert.ok(ogMap.get(ogId), "ogcode question resolves");
    const contentMap = await getContentQuestionStoredMap([contentQuestionId]);
    const storedBag = contentMap.get(contentQuestionId);
    assert.ok(storedBag, "workspace_bag question resolves to a StoredQuestion");
    assert.equal(storedBag?.text, "Bag sample question");
    assert.deepEqual(storedBag?.options, ["Alpha", "Beta"], "content options map to string[]");

    // A non-existent ogcode id is rejected at create time.
    await assert.rejects(
      () =>
        createTeacherTest({
          workspaceId: fx.workspaceId,
          actorUserId: fx.ownerId,
          createdBy: fx.ownerId,
          title: "Bad ogcode test",
          subject: "physics",
          durationMinutes: 30,
          questions: [
            { position: 1, sourceBank: "ogcode", ogcodeQuestionId: "ogq_missing_xyz", marks: 4 },
          ],
        }),
      (e) => (e as { status?: number }).status === 400,
    );

    // Edit: replacing the question set updates the test (resume-a-draft path).
    await updateTeacherTest({
      actorUserId: fx.ownerId,
      workspaceId: fx.workspaceId,
      testId: teacherTest.id,
      patch: {},
      questions: [{ position: 1, sourceBank: "ogcode", ogcodeQuestionId: ogId, marks: 4, negativeMarks: 1 }],
    });
    const afterEdit = await getAssignedTestForStudent(fx.studentId, teacherTest.id);
    assert.deepEqual(afterEdit?.orderedQuestionIds, [ogId], "edit replaced the question set");

    // Delete removes the test (cascades questions + assignments).
    await deleteTeacherTest({
      actorUserId: fx.ownerId,
      workspaceId: fx.workspaceId,
      testId: teacherTest.id,
    });
    assert.equal(
      await getAssignedTestForStudent(fx.studentId, teacherTest.id),
      null,
      "deleted test is no longer resolvable",
    );
  } finally {
    await rawPool().query(`DELETE FROM assessment.tests WHERE workspace_id = $1`, [fx.workspaceId]);
    await rawPool().query(`DELETE FROM ogcode_questions WHERE id = $1`, [ogId]);
    await rawPool().query(`DELETE FROM app.batch_members WHERE student_id = $1`, [fx.studentId]);
    if (contentQuestionId) {
      await rawPool().query(`DELETE FROM content.questions WHERE workspace_id = $1`, [fx.workspaceId]);
    }
    await cleanup(fx);
  }
});

test.after(async () => {
  if (!SKIP) await closePool();
});
