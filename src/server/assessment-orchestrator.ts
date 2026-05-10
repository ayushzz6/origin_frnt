import type { GraderScoringPolicy } from "@/server/grader-client";
import type { StoredQuestion } from "@/server/store";

export type AssessmentSourceType = "test" | "custom_test" | "room_test" | "dpp" | "ogcode" | "practice";

export type AssessmentResolutionMetadata = {
  declaredTotalQuestions: number | null;
  resolvedTotalQuestions: number;
  missingQuestionIds: string[];
  countMismatch: boolean;
  degraded: boolean;
  degradedReason: string | null;
};

export const DEFAULT_TEST_SCORING_POLICY: GraderScoringPolicy = {
  correctMarks: 4,
  incorrectMarks: -1,
  unattemptedMarks: 0,
  partialCreditPolicy: "fractional",
  negativeMarkingMode: "answered_only",
};

export function scoringPolicyForQuestion(
  question: Pick<StoredQuestion, "questionType">,
  sourceType: AssessmentSourceType,
): GraderScoringPolicy {
  if (question.questionType === "numerical" || sourceType === "ogcode" || sourceType === "practice") {
    return {
      ...DEFAULT_TEST_SCORING_POLICY,
      incorrectMarks: 0,
      negativeMarkingMode: "none",
    };
  }

  return DEFAULT_TEST_SCORING_POLICY;
}
export function computeMarksFromCredit(input: {
  answered: boolean;
  isCorrect: boolean;
  creditAwarded?: number | null;
  policy: GraderScoringPolicy;
}) {
  const credit = Math.max(0, Math.min(1, Number(input.creditAwarded ?? (input.isCorrect ? 1 : 0))));
  if (!input.answered) {
    return input.policy.unattemptedMarks;
  }
  if (input.isCorrect) {
    return input.policy.correctMarks;
  }
  if (credit > 0 && input.policy.partialCreditPolicy !== "none") {
    return Number((input.policy.correctMarks * credit).toFixed(3));
  }
  if (input.policy.negativeMarkingMode === "none" || input.policy.negativeMarkingMode === "no_negative") {
    return Math.max(0, input.policy.incorrectMarks);
  }
  return input.policy.incorrectMarks;
}

export function validateResolvedAssessmentQuestions(input: {
  declaredTotalQuestions?: number | null;
  questionIds: string[];
  resolvedQuestionIds: string[];
}): AssessmentResolutionMetadata {
  const resolvedSet = new Set(input.resolvedQuestionIds);
  const missingQuestionIds = input.questionIds.filter((questionId) => !resolvedSet.has(questionId));
  const declaredTotalQuestions = input.declaredTotalQuestions ?? null;
  const countMismatch =
    declaredTotalQuestions !== null &&
    declaredTotalQuestions !== input.resolvedQuestionIds.length;
  const degraded = missingQuestionIds.length > 0 || countMismatch;
  const reasonParts = [
    missingQuestionIds.length > 0 ? `${missingQuestionIds.length} referenced questions could not be resolved` : null,
    countMismatch ? `declared total ${declaredTotalQuestions} differs from resolved total ${input.resolvedQuestionIds.length}` : null,
  ].filter(Boolean);

  return {
    declaredTotalQuestions,
    resolvedTotalQuestions: input.resolvedQuestionIds.length,
    missingQuestionIds,
    countMismatch,
    degraded,
    degradedReason: reasonParts.length ? reasonParts.join("; ") : null,
  };
}
