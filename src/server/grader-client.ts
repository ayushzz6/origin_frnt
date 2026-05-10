import type { StoredQuestion, StoredUserAnswer } from "@/server/store";
import { getRequestId, REQUEST_ID_HEADER } from "@/lib/request-id";

export type GraderScoringPolicy = {
  correctMarks: number;
  incorrectMarks: number;
  unattemptedMarks: number;
  partialCreditPolicy?: "none" | "fractional";
  negativeMarkingMode?: "answered_only" | "none" | "no_negative";
};

type RemoteBatchEvaluationRequest = {
  user_id: string | null;
  assessment_id: string | null;
  assessment_type: string | null;
  scoring_policy: RemoteScoringPolicy;
  items: Array<{
    question: RemoteQuestionSnapshot;
    submitted_answer: RemoteSubmittedAnswer;
    attempt_ref: string | null;
    scoring_policy?: RemoteScoringPolicy;
  }>;
};

type RemoteQuestionSnapshot = {
  id: string;
  subject: string | null;
  chapter: string | null;
  concept: string | null;
  question_type: string;
  options: string[] | null;
  correct_option: number | null;
  correct_options: number[];
  matrix_data: unknown;
  answer_text: string | null;
  explanation: string | null;
  hint: string | null;
  tolerance: number | null;
  answer_spec?: unknown;
};

type RemoteSubmittedAnswer = {
  answer_text: string | null;
  selected_option: number | null;
  selected_options: number[];
  matrix_pairs: number[][];
  time_spent_seconds: number;
};

type RemoteScoringPolicy = {
  correct_marks: number;
  incorrect_marks: number;
  unattempted_marks: number;
  partial_credit_policy: string;
  negative_marking_mode: string;
};

type RemoteEvaluationResponse = {
  is_correct: boolean;
  score: number;
  threshold: number;
  grading_mode: string;
  grading_method: string;
  semantic_band: string;
  credit_awarded: number;
  marks_awarded?: number;
  max_marks?: number;
  needs_review?: boolean;
  reason_codes?: string[];
  matched_terms?: string[];
  missing_terms?: string[];
  normalized_expected?: string | null;
  normalized_submitted?: string | null;
  correct_answer_text?: string | null;
  explanation?: string | null;
  hint?: string | null;
  trace_id?: string | null;
  error?: string | null;
};

type RemoteBatchEvaluationResponse = {
  items: Array<
    RemoteEvaluationResponse & {
      question_id: string;
      attempt_ref?: string | null;
    }
  >;
  trace_id?: string | null;
};

type GradeResult = {
  isCorrect: boolean;
  info: Record<string, unknown>;
};

export type AssessmentBatchGradeItem = {
  question: StoredQuestion;
  answer: StoredUserAnswer;
  attemptRef?: string | null;
  scoringPolicy?: GraderScoringPolicy;
};

export type AssessmentBatchGradeResult = GradeResult & {
  questionId: string;
  attemptRef: string | null;
  creditAwarded: number;
  marksAwarded: number;
  maxMarks: number;
  needsReview: boolean;
  evaluationSource: "python_grader";
};

export class GraderContractError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "GraderContractError";
    this.status = status;
  }
}

const DEFAULT_SCORING_POLICY: GraderScoringPolicy = {
  correctMarks: 4,
  incorrectMarks: -1,
  unattemptedMarks: 0,
  partialCreditPolicy: "fractional",
  negativeMarkingMode: "answered_only",
};

const CIRCUIT_FAILURE_THRESHOLD = Number(process.env.GRADER_SERVICE_CIRCUIT_FAILURES ?? 3);
const CIRCUIT_OPEN_MS = Number(process.env.GRADER_SERVICE_CIRCUIT_OPEN_MS ?? 30_000);

let consecutiveFailures = 0;
let circuitOpenUntil = 0;

function isGraderConfigured(): boolean {
  return Boolean(process.env.GRADER_SERVICE_URL);
}

function normalizePolicy(policy?: GraderScoringPolicy): GraderScoringPolicy {
  return {
    ...DEFAULT_SCORING_POLICY,
    ...policy,
  };
}

function toRemotePolicy(policy?: GraderScoringPolicy): RemoteScoringPolicy {
  const normalized = normalizePolicy(policy);
  return {
    correct_marks: normalized.correctMarks,
    incorrect_marks: normalized.incorrectMarks,
    unattempted_marks: normalized.unattemptedMarks,
    partial_credit_policy: normalized.partialCreditPolicy ?? "fractional",
    negative_marking_mode: normalized.negativeMarkingMode ?? "answered_only",
  };
}

function toRemoteQuestion(question: StoredQuestion): RemoteQuestionSnapshot {
  return {
    id: question.id,
    subject: question.subject ?? null,
    chapter: question.chapter ?? null,
    concept: question.concept ?? null,
    question_type: question.questionType,
    options: question.options ?? null,
    correct_option: question.correctOption,
    correct_options: question.correctOptions ?? [],
    matrix_data: question.matrixData ?? null,
    answer_text: question.answerText ?? null,
    explanation: question.explanation ?? null,
    hint: question.hint ?? null,
    tolerance: question.tolerance ?? null,
    answer_spec: question.answerSpec ?? null,
  };
}

function toRemoteAnswer(answer: StoredUserAnswer): RemoteSubmittedAnswer {
  return {
    answer_text: answer.answerText ?? null,
    selected_option: answer.selectedOption,
    selected_options: answer.selectedOptions ?? [],
    matrix_pairs: answer.matrixPairs ?? [],
    time_spent_seconds: answer.timeSpent,
  };
}

function buildHeaders(requestId: string): HeadersInit {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    [REQUEST_ID_HEADER]: requestId,
  };
  if (process.env.GRADER_SERVICE_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GRADER_SERVICE_TOKEN}`;
  }
  return headers;
}

function recordFailure() {
  consecutiveFailures += 1;
  if (consecutiveFailures >= CIRCUIT_FAILURE_THRESHOLD) {
    circuitOpenUntil = Date.now() + CIRCUIT_OPEN_MS;
  }
}

function recordSuccess() {
  consecutiveFailures = 0;
  circuitOpenUntil = 0;
}

async function checkGraderHealth(): Promise<boolean> {
  if (!isGraderConfigured()) {
    return false;
  }
  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), 1000);
  try {
    const response = await fetch(`${process.env.GRADER_SERVICE_URL}/health`, {
      headers: buildHeaders(getRequestId()),
      cache: "no-store",
      signal: controller.signal,
    });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeoutHandle);
  }
}

async function serviceAvailableForAttempt(): Promise<boolean> {
  if (!isGraderConfigured()) {
    return false;
  }

  if (!process.env.GRADER_SERVICE_TOKEN) {
    throw new Error("[grader-client] GRADER_SERVICE_TOKEN must be set when GRADER_SERVICE_URL is configured");
  }

  if (circuitOpenUntil <= Date.now()) {
    return true;
  }

  const healthy = await checkGraderHealth();
  if (healthy) {
    recordSuccess();
  }
  return healthy;
}

function graderTimeoutMs(itemCount: number): number {
  const configured = Number(process.env.GRADER_SERVICE_TIMEOUT_MS);
  if (Number.isFinite(configured) && configured > 0) {
    return configured;
  }
  return Math.min(4000, Math.max(2000, 1800 + itemCount * 75));
}

function toGradeResult(question: StoredQuestion, payload: RemoteEvaluationResponse): GradeResult {
  const creditAwarded = Number((payload.credit_awarded ?? 0).toFixed(3));
  const marksAwarded = Number((payload.marks_awarded ?? (payload.is_correct ? 4 : 0)).toFixed(3));
  const maxMarks = Number((payload.max_marks ?? 4).toFixed(3));
  return {
    isCorrect: Boolean(payload.is_correct),
    info: {
      correctOption: question.correctOption,
      correct_option: question.correctOption,
      correctOptions: question.correctOptions,
      correct_options: question.correctOptions,
      correctPairs: question.matrixData?.correct_pairs ?? [],
      correct_pairs: question.matrixData?.correct_pairs ?? [],
      correctAnswerText: payload.correct_answer_text ?? question.answerText,
      correct_answer_text: payload.correct_answer_text ?? question.answerText,
      explanation: payload.explanation ?? question.explanation,
      hint: payload.hint ?? question.hint,
      semanticScore: Number((payload.score ?? 0).toFixed(3)),
      semantic_score: Number((payload.score ?? 0).toFixed(3)),
      semanticThreshold: Number((payload.threshold ?? 0).toFixed(3)),
      semantic_threshold: Number((payload.threshold ?? 0).toFixed(3)),
      semanticBand: payload.semantic_band ?? "weak_match",
      semantic_band: payload.semantic_band ?? "weak_match",
      creditAwarded,
      credit_awarded: creditAwarded,
      marksAwarded,
      marks_awarded: marksAwarded,
      maxMarks,
      max_marks: maxMarks,
      matchMethod: payload.grading_method ?? "python_grader",
      match_method: payload.grading_method ?? "python_grader",
      matchedTerms: payload.matched_terms ?? [],
      matched_terms: payload.matched_terms ?? [],
      missingTerms: payload.missing_terms ?? [],
      missing_terms: payload.missing_terms ?? [],
      reasonCodes: payload.reason_codes ?? [],
      reason_codes: payload.reason_codes ?? [],
      needsReview: Boolean(payload.needs_review),
      needs_review: Boolean(payload.needs_review),
      gradingMode: payload.grading_mode ?? question.questionType,
      grading_mode: payload.grading_mode ?? question.questionType,
      gradingTraceId: payload.trace_id ?? null,
      grading_trace_id: payload.trace_id ?? null,
      normalizedExpected: payload.normalized_expected ?? null,
      normalized_expected: payload.normalized_expected ?? null,
      normalizedSubmitted: payload.normalized_submitted ?? null,
      normalized_submitted: payload.normalized_submitted ?? null,
      evaluationSource: "python_grader",
      evaluation_source: "python_grader",
    },
  };
}

export async function gradeAssessmentBatchWithService(input: {
  userId: string;
  assessmentId: string;
  assessmentType: string;
  items: AssessmentBatchGradeItem[];
  scoringPolicy?: GraderScoringPolicy;
}): Promise<AssessmentBatchGradeResult[] | null> {
  if (!input.items.length) {
    return [];
  }
  if (!(await serviceAvailableForAttempt())) {
    return null;
  }

  const timeoutMs = graderTimeoutMs(input.items.length);
  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);
  const requestId = getRequestId();

  const payload: RemoteBatchEvaluationRequest = {
    user_id: input.userId,
    assessment_id: input.assessmentId,
    assessment_type: input.assessmentType,
    scoring_policy: toRemotePolicy(input.scoringPolicy),
    items: input.items.map((item) => ({
      question: toRemoteQuestion(item.question),
      submitted_answer: toRemoteAnswer(item.answer),
      attempt_ref: item.attemptRef ?? item.question.id,
      scoring_policy: item.scoringPolicy ? toRemotePolicy(item.scoringPolicy) : undefined,
    })),
  };

  try {
    const response = await fetch(`${process.env.GRADER_SERVICE_URL}/v1/evaluate-batch`, {
      method: "POST",
      headers: buildHeaders(requestId),
      body: JSON.stringify(payload),
      cache: "no-store",
      signal: controller.signal,
    });

    if (!response.ok) {
      const message = await response.text().catch(() => "");
      if (response.status >= 400 && response.status < 500) {
        throw new GraderContractError(message || "Grader batch contract validation failed.", response.status);
      }
      console.error("[grader-client] Remote grader returned error status", {
        requestId,
        status: response.status,
        assessmentId: input.assessmentId,
      });
      recordFailure();
      return null;
    }

    const body = (await response.json()) as RemoteBatchEvaluationResponse;
    const byQuestionId = new Map(input.items.map((item) => [item.question.id, item.question]));
    recordSuccess();
    return body.items.map((item) => {
      const question = byQuestionId.get(item.question_id);
      if (!question) {
        throw new GraderContractError(`Unexpected grader response for question ${item.question_id}.`, 422);
      }
      const grade = toGradeResult(question, item);
      if (item.error) {
        grade.info.graderError = item.error;
        grade.info.grader_error = item.error;
      }
      const creditAwarded = Number((item.credit_awarded ?? 0).toFixed(3));
      const marksAwarded = Number((item.marks_awarded ?? 0).toFixed(3));
      const maxMarks = Number((item.max_marks ?? input.scoringPolicy?.correctMarks ?? DEFAULT_SCORING_POLICY.correctMarks).toFixed(3));
      return {
        ...grade,
        questionId: item.question_id,
        attemptRef: item.attempt_ref ?? null,
        creditAwarded,
        marksAwarded,
        maxMarks,
        needsReview: Boolean(item.needs_review),
        evaluationSource: "python_grader" as const,
      };
    });
  } catch (err) {
    if (err instanceof GraderContractError) {
      throw err;
    }
    recordFailure();
    console.error("[grader-client] Remote grader batch call failed", {
      requestId,
      error: err instanceof Error ? err.message : String(err),
      assessmentId: input.assessmentId,
    });
    return null;
  } finally {
    clearTimeout(timeoutHandle);
  }
}

export async function gradePracticeAnswerWithService(
  question: StoredQuestion,
  answer: StoredUserAnswer,
  userId: string,
): Promise<GradeResult | null> {
  if (!isGraderConfigured()) {
    return null;
  }

  const batch = await gradeAssessmentBatchWithService({
    userId,
    assessmentId: question.id,
    assessmentType: "practice",
    items: [{ question, answer, attemptRef: question.id }],
    scoringPolicy:
      question.questionType === "numerical"
        ? { correctMarks: 4, incorrectMarks: 0, unattemptedMarks: 0, negativeMarkingMode: "none" }
        : DEFAULT_SCORING_POLICY,
  });

  return batch?.[0] ?? null;
}
