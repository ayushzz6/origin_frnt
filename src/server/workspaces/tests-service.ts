/**
 * Teacher Tests service layer.
 * Encodes business rules for test creation, assignment, and lifecycle.
 */

import { AuthzError } from "@/server/authz";

import { recordAuditEvent } from "./audit";
import {
  createTest,
  createAssignment,
  getTestById,
  getTestWithQuestions,
  listTests,
  updateTest,
  addQuestionToTest,
  listAttemptResults,
  getTestLeaderboard,
  type CreateTestInput,
} from "./tests-store";
import { getQuestionWithVersion } from "./questions";
import { getOgcodeCatalogQuestionMap } from "@/server/ogcode-catalog";
import type {
  AssessmentTest,
  QuestionSourceBank,
  TestAssignment,
  TestAttempt,
  TestWithQuestions,
} from "./types";

export type CreateTeacherTestInput = Omit<CreateTestInput, "totalQuestions"> & {
  actorUserId: string;
  questions: Array<{
    position: number;
    sourceBank: QuestionSourceBank;
    ogcodeQuestionId?: string | null;
    contentQuestionId?: string | null;
    contentQuestionVersionId?: string | null;
    marks?: number;
    negativeMarks?: number;
  }>;
  requestId?: string | null;
};

export async function createTeacherTest(input: CreateTeacherTestInput): Promise<TestWithQuestions> {
  if (!input.title.trim()) {
    throw new AuthzError(400, "Test title is required.");
  }
  if (input.durationMinutes <= 0) {
    throw new AuthzError(400, "Duration must be greater than 0.");
  }

  const test = await createTest({
    workspaceId: input.workspaceId,
    createdBy: input.createdBy,
    title: input.title.trim(),
    description: input.description ?? null,
    subject: input.subject ?? "mixed",
    chapter: input.chapter ?? null,
    difficulty: input.difficulty ?? "medium",
    durationMinutes: input.durationMinutes,
    totalQuestions: input.questions.length,
    status: input.status ?? "draft",
    source: "manual",
    selectionPolicy: input.selectionPolicy ?? {},
    scoringPolicy: input.scoringPolicy ?? {},
    settings: input.settings ?? {},
  });

  // Phase 15: validate every ogcode-sourced id exists, in ONE batch query (the
  // bank has thousands of rows — never per-question round-trips).
  const ogcodeIds = input.questions
    .filter((q) => q.sourceBank === "ogcode")
    .map((q) => q.ogcodeQuestionId)
    .filter((id): id is string => Boolean(id));
  const ogcodeMap = ogcodeIds.length ? await getOgcodeCatalogQuestionMap(ogcodeIds) : new Map();
  for (const id of ogcodeIds) {
    if (!ogcodeMap.has(id)) throw new AuthzError(400, `OG Code question ${id} not found.`);
  }

  for (const q of input.questions) {
    // For ogcode rows the id must be present (the CHECK constraint also enforces it).
    if (q.sourceBank === "ogcode" && !q.ogcodeQuestionId) {
      throw new AuthzError(400, "An OG Code question is missing its question id.");
    }
    // Resolve/validate workspace_bag rows and fill the version id the CHECK
    // constraint requires (the picker sends only the question id).
    let contentQuestionVersionId = q.contentQuestionVersionId ?? null;
    if (q.sourceBank === "workspace_bag") {
      if (!q.contentQuestionId) {
        throw new AuthzError(400, "A Question-Bag question is missing its question id.");
      }
      const question = await getQuestionWithVersion(q.contentQuestionId);
      if (!question) {
        throw new AuthzError(400, `Question ${q.contentQuestionId} not found.`);
      }
      if (question.workspaceId !== input.workspaceId) {
        throw new AuthzError(403, `Question ${q.contentQuestionId} does not belong to this workspace.`);
      }
      if (question.status !== "ready" && question.status !== "published_private") {
        throw new AuthzError(400, `Question ${q.contentQuestionId} is not ready for use in tests.`);
      }
      contentQuestionVersionId = contentQuestionVersionId ?? question.currentVersionId;
      if (!contentQuestionVersionId) {
        throw new AuthzError(400, `Question ${q.contentQuestionId} has no published version.`);
      }
    }
    await addQuestionToTest({
      testId: test.id,
      position: q.position,
      sourceBank: q.sourceBank,
      ogcodeQuestionId: q.ogcodeQuestionId ?? null,
      contentQuestionId: q.contentQuestionId ?? null,
      contentQuestionVersionId,
      marks: q.marks ?? 4,
      negativeMarks: q.negativeMarks ?? -1,
    });
  }

  await recordAuditEvent({
    actorUserId: input.actorUserId,
    workspaceId: input.workspaceId,
    entityType: "assessment_test",
    entityId: test.id,
    action: "test.created",
    after: test,
    requestId: input.requestId,
  });

  return getTestWithQuestions(test.id) as Promise<TestWithQuestions>;
}

export async function updateTeacherTest(input: {
  actorUserId: string;
  workspaceId: string;
  testId: string;
  patch: Partial<CreateTestInput>;
  requestId?: string | null;
}): Promise<AssessmentTest> {
  const existing = await getTestById(input.testId);
  if (!existing) throw new AuthzError(404, "Test not found.");
  if (existing.workspaceId !== input.workspaceId) throw new AuthzError(403, "Access denied.");
  if (existing.status === "live" || existing.status === "closed" || existing.status === "archived") {
    throw new AuthzError(400, "Cannot edit a live, closed, or archived test.");
  }

  const updated = await updateTest(input.testId, input.patch);
  if (!updated) throw new Error("Failed to update test.");

  await recordAuditEvent({
    actorUserId: input.actorUserId,
    workspaceId: input.workspaceId,
    entityType: "assessment_test",
    entityId: input.testId,
    action: "test.updated",
    after: updated,
    requestId: input.requestId,
  });

  return updated;
}

export async function publishTeacherTest(input: {
  actorUserId: string;
  workspaceId: string;
  testId: string;
  requestId?: string | null;
}): Promise<AssessmentTest> {
  const test = await getTestWithQuestions(input.testId);
  if (!test) throw new AuthzError(404, "Test not found.");
  if (test.workspaceId !== input.workspaceId) throw new AuthzError(403, "Access denied.");
  if (test.status !== "draft" && test.status !== "scheduled") {
    throw new AuthzError(400, "Only draft or scheduled tests can be published.");
  }
  if (test.questions.length === 0) {
    throw new AuthzError(400, "Cannot publish a test with no questions.");
  }

  const updated = await updateTest(input.testId, { status: "published" });
  if (!updated) throw new Error("Failed to publish test.");

  await recordAuditEvent({
    actorUserId: input.actorUserId,
    workspaceId: input.workspaceId,
    entityType: "assessment_test",
    entityId: input.testId,
    action: "test.published",
    after: updated,
    requestId: input.requestId,
  });

  return updated;
}

export async function scheduleTeacherTest(input: {
  actorUserId: string;
  workspaceId: string;
  testId: string;
  scheduledStartAt: string;
  scheduledEndAt: string;
  requestId?: string | null;
}): Promise<AssessmentTest> {
  const existing = await getTestById(input.testId);
  if (!existing) throw new AuthzError(404, "Test not found.");
  if (existing.workspaceId !== input.workspaceId) throw new AuthzError(403, "Access denied.");
  if (existing.status !== "draft") {
    throw new AuthzError(400, "Only draft tests can be scheduled.");
  }

  const updated = await updateTest(input.testId, { status: "scheduled" });
  if (!updated) throw new Error("Failed to schedule test.");

  await recordAuditEvent({
    actorUserId: input.actorUserId,
    workspaceId: input.workspaceId,
    entityType: "assessment_test",
    entityId: input.testId,
    action: "test.scheduled",
    after: updated,
    requestId: input.requestId,
  });

  return updated;
}

export async function assignTestToBatches(input: {
  actorUserId: string;
  workspaceId: string;
  testId: string;
  batchIds: string[];
  scheduledStartAt?: string | null;
  scheduledEndAt?: string | null;
  requestId?: string | null;
}): Promise<TestAssignment[]> {
  const test = await getTestById(input.testId);
  if (!test) throw new AuthzError(404, "Test not found.");
  if (test.workspaceId !== input.workspaceId) throw new AuthzError(403, "Access denied.");
  if (test.status !== "published" && test.status !== "scheduled") {
    throw new AuthzError(400, "Test must be published or scheduled before assignment.");
  }

  const assignments: TestAssignment[] = [];
  for (const batchId of input.batchIds) {
    const assignment = await createAssignment({
      testId: input.testId,
      workspaceId: input.workspaceId,
      batchId,
      scheduledStartAt: input.scheduledStartAt ?? null,
      scheduledEndAt: input.scheduledEndAt ?? null,
      assignedBy: input.actorUserId,
    });
    assignments.push(assignment);
    await recordAuditEvent({
      actorUserId: input.actorUserId,
      workspaceId: input.workspaceId,
      entityType: "test_assignment",
      entityId: assignment.id,
      action: "test.assigned",
      after: assignment,
      requestId: input.requestId,
    });
  }

  return assignments;
}

export async function listTeacherTests(
  workspaceId: string,
  filter?: { status?: string },
): Promise<AssessmentTest[]> {
  return listTests(workspaceId, filter as { status?: "draft" | "scheduled" | "published" | "live" | "closed" | "archived" | "all" });
}

export async function getTeacherTest(
  workspaceId: string,
  testId: string,
): Promise<TestWithQuestions | null> {
  const test = await getTestById(testId);
  if (!test) return null;
  if (test.workspaceId !== workspaceId) return null;
  return getTestWithQuestions(testId);
}

export async function getTeacherTestLeaderboard(
  workspaceId: string,
  testId: string,
  limit = 20,
): Promise<Array<TestAttempt & { rank: number }>> {
  const test = await getTestById(testId);
  if (!test) throw new AuthzError(404, "Test not found.");
  if (test.workspaceId !== workspaceId) throw new AuthzError(403, "Access denied.");
  return getTestLeaderboard(testId, limit);
}

export async function getTeacherTestResults(
  workspaceId: string,
  testId: string,
): Promise<TestAttempt[]> {
  const test = await getTestById(testId);
  if (!test) throw new AuthzError(404, "Test not found.");
  if (test.workspaceId !== workspaceId) throw new AuthzError(403, "Access denied.");
  return listAttemptResults(testId);
}

export async function closeTeacherTest(input: {
  actorUserId: string;
  workspaceId: string;
  testId: string;
  requestId?: string | null;
}): Promise<AssessmentTest> {
  const test = await getTestById(input.testId);
  if (!test) throw new AuthzError(404, "Test not found.");
  if (test.workspaceId !== input.workspaceId) throw new AuthzError(403, "Access denied.");
  if (test.status === "closed" || test.status === "archived") {
    throw new AuthzError(400, "Test is already closed or archived.");
  }

  const updated = await updateTest(input.testId, { status: "closed" });
  if (!updated) throw new Error("Failed to close test.");

  await recordAuditEvent({
    actorUserId: input.actorUserId,
    workspaceId: input.workspaceId,
    entityType: "assessment_test",
    entityId: input.testId,
    action: "test.closed",
    after: updated,
    requestId: input.requestId,
  });

  return updated;
}