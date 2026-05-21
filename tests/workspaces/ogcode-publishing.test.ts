import test from "node:test";
import assert from "node:assert/strict";

import { describeMissingPublishRequirements } from "../../src/server/workspaces/ogcode-publishing-service";
import type { QuestionVersion } from "../../src/server/workspaces/types";

function baseMcqVersion(overrides: Partial<QuestionVersion> = {}): QuestionVersion {
  return {
    id: "qv_test",
    questionId: "q_test",
    versionNumber: 1,
    questionType: "mcq",
    stem: "What is 2 + 2?",
    options: [
      { id: "a", text: "3" },
      { id: "b", text: "4" },
      { id: "c", text: "5" },
      { id: "d", text: "6" },
    ],
    correctOption: 1,
    correctOptions: null,
    answerText: null,
    answerSpec: null,
    matrixData: null,
    hint: "Add the numbers.",
    explanation: null,
    fullSolution: "2 + 2 equals 4 because integer addition.",
    subject: "math",
    chapter: "arithmetic",
    concept: "addition",
    difficulty: "easy",
    tags: [],
    importEvidence: {},
    metadata: {},
    createdBy: "user_test",
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

test("ogcode publish gate: passes when hint, full_solution, and correct_option all present (MCQ)", () => {
  const missing = describeMissingPublishRequirements(baseMcqVersion());
  assert.deepEqual(missing, []);
});

test("ogcode publish gate: blocks missing hint", () => {
  const missing = describeMissingPublishRequirements(baseMcqVersion({ hint: null }));
  assert.ok(missing.includes("hint"));
});

test("ogcode publish gate: blocks empty hint (whitespace-only)", () => {
  const missing = describeMissingPublishRequirements(baseMcqVersion({ hint: "   " }));
  assert.ok(missing.includes("hint"));
});

test("ogcode publish gate: blocks missing full_solution", () => {
  const missing = describeMissingPublishRequirements(baseMcqVersion({ fullSolution: null }));
  assert.ok(missing.includes("full_solution"));
});

test("ogcode publish gate: blocks MCQ with no correct_option", () => {
  const missing = describeMissingPublishRequirements(baseMcqVersion({ correctOption: null }));
  assert.ok(missing.includes("correct_option"));
});

test("ogcode publish gate: blocks MSQ with no correct_options", () => {
  const missing = describeMissingPublishRequirements(
    baseMcqVersion({ questionType: "msq", correctOption: null, correctOptions: null }),
  );
  assert.ok(missing.includes("correct_options"));
});

test("ogcode publish gate: passes for numerical with answerText", () => {
  const missing = describeMissingPublishRequirements(
    baseMcqVersion({
      questionType: "numerical",
      correctOption: null,
      options: null,
      answerText: "4",
    }),
  );
  assert.deepEqual(missing, []);
});

test("ogcode publish gate: blocks numerical with no answer", () => {
  const missing = describeMissingPublishRequirements(
    baseMcqVersion({
      questionType: "numerical",
      correctOption: null,
      options: null,
      answerText: null,
      answerSpec: null,
    }),
  );
  assert.ok(missing.includes("answer"));
});

test("ogcode publish gate: subjective passes with just hint + full_solution", () => {
  const missing = describeMissingPublishRequirements(
    baseMcqVersion({
      questionType: "subjective",
      correctOption: null,
      options: null,
    }),
  );
  assert.deepEqual(missing, []);
});

test("ogcode publish gate: reports all missing fields at once", () => {
  const missing = describeMissingPublishRequirements(
    baseMcqVersion({ hint: null, fullSolution: null, correctOption: null }),
  );
  assert.ok(missing.includes("hint"));
  assert.ok(missing.includes("full_solution"));
  assert.ok(missing.includes("correct_option"));
});
