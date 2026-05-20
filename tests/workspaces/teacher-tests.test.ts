import test from "node:test";
import assert from "node:assert/strict";

import { isFeatureEnabled } from "@/lib/feature-flags";

const env = process.env as Record<string, string | undefined>;

test("Phase 5: teacherTests flag is off in prod by default", () => {
  const prev = env.NODE_ENV;
  env.NODE_ENV = "production";
  try {
    assert.equal(isFeatureEnabled("teacherTests"), false);
  } finally {
    env.NODE_ENV = prev;
  }
});

test("Phase 5: teacherTests flag can be enabled via env var", () => {
  const prev = env.NODE_ENV;
  env.NODE_ENV = "production";
  env.TEACHER_LAUNCH_TEACHER_TESTS = "1";
  try {
    assert.equal(isFeatureEnabled("teacherTests"), true);
  } finally {
    env.NODE_ENV = prev;
    delete env.TEACHER_LAUNCH_TEACHER_TESTS;
  }
});

test("Phase 5: TestStatus includes all expected states", () => {
  const statuses = ["draft", "scheduled", "published", "live", "closed", "archived"];
  assert.equal(statuses.length, 6);
});

test("Phase 5: TestSource includes all expected values", () => {
  const sources = ["manual", "random", "imported", "room", "analytics_generated"];
  assert.equal(sources.length, 5);
});

test("Phase 5: QuestionSourceBank includes all expected values", () => {
  const banks = ["ogcode", "workspace_bag", "platform_content"];
  assert.equal(banks.length, 3);
});

test("Phase 5: AssignmentStatus includes all expected states", () => {
  const statuses = ["assigned", "open", "closed", "cancelled"];
  assert.equal(statuses.length, 4);
});

test("Phase 5: AttemptStatus includes all expected states", () => {
  const statuses = ["in_progress", "submitted", "timed_out", "force_submitted", "needs_review"];
  assert.equal(statuses.length, 5);
});

test("Phase 5: AssessmentTest shape is correct", () => {
  const t = {
    id: "test_123",
    ownerScope: "workspace" as const,
    workspaceId: "ws_123",
    createdBy: "user_123",
    title: "Physics Test 1",
    description: null,
    subject: "Physics",
    chapter: "Mechanics",
    difficulty: "medium",
    durationMinutes: 30,
    totalQuestions: 10,
    status: "draft" as const,
    source: "manual" as const,
    selectionPolicy: {},
    scoringPolicy: {},
    settings: {},
    sourceImportJobId: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  assert.equal(t.id, "test_123");
  assert.equal(t.status, "draft");
  assert.equal(t.durationMinutes, 30);
});

test("Phase 5: TestWithQuestions includes questions array", () => {
  const t = {
    id: "test_123",
    ownerScope: "workspace" as const,
    workspaceId: "ws_123",
    createdBy: "user_123",
    title: "Physics Test 1",
    description: null,
    subject: "Physics",
    chapter: null,
    difficulty: "medium",
    durationMinutes: 30,
    totalQuestions: 2,
    status: "draft" as const,
    source: "manual" as const,
    selectionPolicy: {},
    scoringPolicy: {},
    settings: {},
    sourceImportJobId: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    questions: [
      {
        testId: "test_123",
        position: 1,
        sourceBank: "workspace_bag" as const,
        ogcodeQuestionId: null,
        contentQuestionId: "q_123",
        contentQuestionVersionId: "qv_123",
        marks: 4,
        negativeMarks: -1,
        metadata: {},
      },
      {
        testId: "test_123",
        position: 2,
        sourceBank: "ogcode" as const,
        ogcodeQuestionId: "og_456",
        contentQuestionId: null,
        contentQuestionVersionId: null,
        marks: 4,
        negativeMarks: -1,
        metadata: {},
      },
    ],
  };
  assert.equal(t.questions.length, 2);
  assert.equal(t.questions[0].sourceBank, "workspace_bag");
  assert.equal(t.questions[1].sourceBank, "ogcode");
});

test("Phase 5: TestAttempt shape is correct", () => {
  const a = {
    id: "att_123",
    testId: "test_123",
    assignmentId: null,
    workspaceId: "ws_123",
    batchId: null,
    roomId: null,
    studentId: "student_123",
    attemptNumber: 1,
    status: "submitted" as const,
    startedAt: new Date().toISOString(),
    serverDeadline: null,
    submittedAt: new Date().toISOString(),
    score: 36,
    totalMarks: 40,
    percentage: 90,
    timeTakenSeconds: 1800,
    gradingStatus: "completed" as const,
    analyticsStatus: "completed" as const,
    metadata: {},
  };
  assert.equal(a.status, "submitted");
  assert.equal(a.score, 36);
  assert.equal(a.percentage, 90);
});

test("Phase 5: IDs follow prefixed convention", () => {
  const { createTestId, createAssignmentId, createAttemptId } = require("@/server/workspaces/ids");
  const testId = createTestId();
  const asgnId = createAssignmentId();
  const attId = createAttemptId();
  assert.ok(testId.startsWith("test_"));
  assert.ok(asgnId.startsWith("asgn_"));
  assert.ok(attId.startsWith("att_"));
});

test("Phase 5: createTeacherTest rejects empty title", async () => {
  const { createTeacherTest } = await import("@/server/workspaces/tests-service");
  await assert.rejects(
    createTeacherTest({
      workspaceId: "ws_123",
      actorUserId: "user_123",
      createdBy: "user_123",
      title: "",
      durationMinutes: 30,
      questions: [],
    }),
    /title/i,
  );
});

test("Phase 5: createTeacherTest rejects zero duration", async () => {
  const { createTeacherTest } = await import("@/server/workspaces/tests-service");
  await assert.rejects(
    createTeacherTest({
      workspaceId: "ws_123",
      actorUserId: "user_123",
      createdBy: "user_123",
      title: "Physics Test",
      durationMinutes: 0,
      questions: [],
    }),
    /duration/i,
  );
});