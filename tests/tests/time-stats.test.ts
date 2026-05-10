import test from "node:test";
import assert from "node:assert/strict";

import {
  buildSubjectTimeBreakdown,
  shouldSubmitTestAnswer,
} from "../../src/lib/tests/time-stats";
import type { TestResult, UserAnswer } from "../../src/types";

function makeAnswer(overrides: Partial<UserAnswer>): UserAnswer {
  return {
    questionId: "q1",
    selectedOption: null,
    selectedOptions: [],
    matrixPairs: [],
    answerText: "",
    timeSpent: 0,
    isMarkedForReview: false,
    ...overrides,
  };
}

test("subject time breakdown only uses recorded subject time", () => {
  const subjectStats: NonNullable<TestResult["subjectStats"]> = {
    biology: {
      score: 0,
      total_marks: 20,
      correct: 0,
      incorrect: 0,
      unattempted: 5,
      total_qs: 5,
      accuracy: 0,
      time_spent_correct: 0,
      time_spent_incorrect: 0,
      time_spent_unattempted: 0,
      total_time_spent: 0,
    },
    physics: {
      score: 0,
      total_marks: 20,
      correct: 0,
      incorrect: 0,
      unattempted: 5,
      total_qs: 5,
      accuracy: 0,
      time_spent_correct: 0,
      time_spent_incorrect: 0,
      time_spent_unattempted: 0,
      total_time_spent: 0,
    },
  };

  assert.deepEqual(buildSubjectTimeBreakdown(subjectStats), [
    { name: "biology", time: 0 },
    { name: "physics", time: 0 },
  ]);
});

test("subject time breakdown preserves recorded per-subject time", () => {
  const subjectStats: NonNullable<TestResult["subjectStats"]> = {
    biology: {
      score: 0,
      total_marks: 20,
      correct: 0,
      incorrect: 0,
      unattempted: 5,
      total_qs: 5,
      accuracy: 0,
      time_spent_correct: 0,
      time_spent_incorrect: 0,
      time_spent_unattempted: 14,
      total_time_spent: 14,
    },
  };

  assert.deepEqual(buildSubjectTimeBreakdown(subjectStats), [{ name: "biology", time: 14 }]);
});

test("visited unanswered answers are submitted when they have recorded time", () => {
  assert.equal(shouldSubmitTestAnswer(makeAnswer({ timeSpent: 9 })), true);
  assert.equal(shouldSubmitTestAnswer(makeAnswer({ timeSpent: 0 })), false);
  assert.equal(shouldSubmitTestAnswer(makeAnswer({ selectedOption: 0 })), true);
  assert.equal(shouldSubmitTestAnswer(makeAnswer({ isMarkedForReview: true })), true);
});
