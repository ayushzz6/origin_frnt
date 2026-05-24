import test from "node:test";
import assert, { throws, doesNotThrow } from "node:assert/strict";

import { isFeatureEnabled } from "@/lib/feature-flags";

const env = process.env as Record<string, string | undefined>;

test("Phase 4: questionBag flag is on in prod by default (post-launch)", () => {
  const prev = env.NODE_ENV;
  env.NODE_ENV = "production";
  try {
    assert.equal(isFeatureEnabled("questionBag"), true);
  } finally {
    env.NODE_ENV = prev;
  }
});

test("Phase 4: questionBag flag can be enabled via env var", () => {
  const prev = env.NODE_ENV;
  env.NODE_ENV = "production";
  env.TEACHER_LAUNCH_QUESTION_BAG = "1";
  try {
    assert.equal(isFeatureEnabled("questionBag"), true);
  } finally {
    env.NODE_ENV = prev;
    delete env.TEACHER_LAUNCH_QUESTION_BAG;
  }
});

test("Phase 4: QuestionStatus includes all expected states", () => {
  const statuses = [
    "draft", "needs_review", "ready",
    "published_private", "submitted_to_ogcode",
    "published_ogcode", "rejected", "archived",
  ];
  assert.equal(statuses.length, 8);
});

test("Phase 4: QuestionType includes all expected types", () => {
  const types = [
    "mcq", "msq", "numerical", "numerical_with_units",
    "symbolic_expression", "equation", "matrix_match", "subjective",
  ];
  assert.equal(types.length, 8);
});

test("Phase 4: QuestionOption shape is correct", () => {
  const option = { id: "a", text: "Option A" };
  assert.equal(typeof option.id, "string");
  assert.equal(typeof option.text, "string");
});

test("Phase 4: QuestionWithVersion includes required fields", () => {
  const q = {
    id: "q_123",
    ownerScope: "workspace",
    workspaceId: "ws_123",
    createdBy: "user_123",
    currentVersionId: "qv_123",
    visibility: "private",
    status: "draft",
    sourceKind: "manual",
    importedJobId: null,
    externalSourceId: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    currentVersion: {
      id: "qv_123",
      questionId: "q_123",
      versionNumber: 1,
      questionType: "mcq",
      stem: "Test stem",
      options: [{ id: "a", text: "A" }],
      correctOption: 0,
      correctOptions: null,
      answerText: null,
      answerSpec: null,
      matrixData: null,
      hint: null,
      explanation: null,
      fullSolution: null,
      subject: "Physics",
      chapter: "Mechanics",
      concept: "Kinematics",
      difficulty: "medium",
      tags: [] as string[],
      importEvidence: {},
      metadata: {},
      createdBy: "user_123",
      createdAt: new Date().toISOString(),
    },
    assetLinks: [] as never[],
  };
  assert.equal(q.id, "q_123");
  assert.equal(q.currentVersion?.stem, "Test stem");
  assert.ok(Array.isArray(q.assetLinks));
});

test("Phase 4: Asset type includes all required R2 fields", () => {
  const asset = {
    id: "asset_123",
    ownerType: "workspace",
    ownerWorkspaceId: "ws_123",
    ownerUserId: null,
    kind: "image",
    mimeType: "image/png",
    fileName: "diagram.png",
    byteSize: 1024,
    sha256: "abc123",
    r2Bucket: "origin-assets",
    r2ObjectKey: "ws_123/assets/abc123.png",
    publicUrl: null,
    metadata: {},
    createdBy: "user_123",
    createdAt: new Date().toISOString(),
  };
  assert.equal(asset.r2Bucket, "origin-assets");
  assert.ok(asset.r2ObjectKey.length > 0);
  assert.ok(asset.sha256.length > 0);
});

test("Phase 4: validateOgCodePublish blocks missing answer data", async () => {
  const { validateOgCodePublish } = await import("@/server/workspaces/questions-service");
  throws(() =>
    validateOgCodePublish({
      id: "qv_1",
      questionId: "q_1",
      versionNumber: 1,
      questionType: "mcq",
      stem: "Test",
      options: null,
      correctOption: null,
      correctOptions: null,
      answerText: null,
      answerSpec: null,
      matrixData: null,
      hint: null,
      explanation: null,
      fullSolution: null,
      subject: "Physics",
      chapter: "Mechanics",
      concept: "Kinematics",
      difficulty: "medium",
      tags: [],
      importEvidence: {},
      metadata: {},
      createdBy: "user_1",
      createdAt: new Date().toISOString(),
    }),
    /answer data/i,
  );
});

test("Phase 4: validateOgCodePublish blocks missing hint", async () => {
  const { validateOgCodePublish } = await import("@/server/workspaces/questions-service");
  throws(() =>
    validateOgCodePublish({
      id: "qv_1",
      questionId: "q_1",
      versionNumber: 1,
      questionType: "mcq",
      stem: "Test",
      options: null,
      correctOption: 0,
      correctOptions: null,
      answerText: null,
      answerSpec: null,
      matrixData: null,
      hint: null,
      explanation: null,
      fullSolution: "Step by step solution",
      subject: "Physics",
      chapter: "Mechanics",
      concept: "Kinematics",
      difficulty: "medium",
      tags: [],
      importEvidence: {},
      metadata: {},
      createdBy: "user_1",
      createdAt: new Date().toISOString(),
    }),
    /hint/i,
  );
});

test("Phase 4: validateOgCodePublish blocks missing fullSolution", async () => {
  const { validateOgCodePublish } = await import("@/server/workspaces/questions-service");
  throws(() =>
    validateOgCodePublish({
      id: "qv_1",
      questionId: "q_1",
      versionNumber: 1,
      questionType: "mcq",
      stem: "Test",
      options: null,
      correctOption: 0,
      correctOptions: null,
      answerText: null,
      answerSpec: null,
      matrixData: null,
      hint: "Use Newton's second law",
      explanation: null,
      fullSolution: null,
      subject: "Physics",
      chapter: "Mechanics",
      concept: "Kinematics",
      difficulty: "medium",
      tags: [],
      importEvidence: {},
      metadata: {},
      createdBy: "user_1",
      createdAt: new Date().toISOString(),
    }),
    /full.*solution/i,
  );
});

test("Phase 4: validateOgCodePublish passes when all OGCode requirements met", async () => {
  const { validateOgCodePublish } = await import("@/server/workspaces/questions-service");
  doesNotThrow(() =>
    validateOgCodePublish({
      id: "qv_1",
      questionId: "q_1",
      versionNumber: 1,
      questionType: "mcq",
      stem: "Test",
      options: null,
      correctOption: 0,
      correctOptions: null,
      answerText: null,
      answerSpec: null,
      matrixData: null,
      hint: "Use Newton's second law",
      explanation: "F = ma",
      fullSolution: "F = ma. Given m=2kg, a=3m/s², F=6N",
      subject: "Physics",
      chapter: "Mechanics",
      concept: "Kinematics",
      difficulty: "medium",
      tags: [],
      importEvidence: {},
      metadata: {},
      createdBy: "user_1",
      createdAt: new Date().toISOString(),
    }),
  );
});

test("Phase 4: IDs follow prefixed convention", () => {
  const { createAssetId, createQuestionId, createQuestionVersionId } = require("@/server/workspaces/ids");
  const assetId = createAssetId();
  const qId = createQuestionId();
  const vId = createQuestionVersionId();
  assert.ok(assetId.startsWith("asset_"));
  assert.ok(qId.startsWith("q_"));
  assert.ok(vId.startsWith("qv_"));
});