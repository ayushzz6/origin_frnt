// Legacy assessments implementation kept intact while the public server module
// is split into smaller category barrels.
import {
  buildPointsSummary,
  buildTimeAnalytics,
  calculateTimedPracticeScore,
  getOrCreateDailyActivity,
  getOrCreateStreak,
  updateUserStreak,
  updateUserStudyTime,
  awardPoints,
} from "@/server/gamification";
import {
  getOgcodeCatalogCounts,
  getOgcodeCatalogQuestionById,
  getOgcodeCatalogQuestionMap,
  getOgcodeChallengeQuestion,
  incrementOgcodeCatalogQuestionStats,
  listOgcodeCatalogChapters,
  listOgcodeCatalogQuestionPage,
  listOgcodeCatalogQuestions,
} from "@/server/ogcode-catalog";
import { getUserPostgresPool, isUserPostgresConfigured } from "@/server/user-postgres";
import {
  GraderContractError,
  gradeAssessmentBatchWithService,
  gradePracticeAnswerWithService,
  type AssessmentBatchGradeResult,
} from "@/server/grader-client";
import {
  DEFAULT_TEST_SCORING_POLICY,
  computeMarksFromCredit,
  scoringPolicyForQuestion,
  validateResolvedAssessmentQuestions,
  type AssessmentResolutionMetadata,
  type AssessmentSourceType,
} from "@/server/assessment-orchestrator";
import {
  generateCustomTestWithService,
  type AnalyticsContextPayload,
  type AnalyticsDppAttemptRequest,
  type AnalyticsDppAttemptResponse,
  type AnalyticsGradedAttempt,
  type AnalyticsTestAnalysisRequest,
  type AnalyticsTopicSignal,
} from "@/server/analytics-client";
import {
  getAttemptedQuestionIdsForUser,
  getDppPlanDetail,
  getLatestDppAttemptForPlan,
  listLatestDppAttemptsForPlans,
  getPersistedCustomTest,
  getPersistedCustomTestById,
  getPersistedResultById,
  getRecentWeakTopicsForUser,
  getOgcodeProgressForUser,
  listPendingDppPlans,
  listPersistedCustomTests,
  listPersistedTestResults,
  persistDppAttemptResult,
  persistGeneratedCustomTest,
  persistTestAnalysisResult,
  type PersistedCustomTestRecord,
  type PersistedDppAttemptRecord,
  type PersistedDppPlanRecord,
  type PersistedTestResultRecord,
  type PersistDppAttemptInput,
  type PersistTestAnalysisInput,
} from "@/server/analytics-store";
import { drainOneAnalysisJobWithTimeout, enqueueAnalysisJob } from "@/server/analysis-jobs";
import type { PracticeQuestion, TestPreview } from "@/types";
import { metric } from "@/lib/metrics";
import type {
  AppStore,
  DifficultyLevel,
  StoredQuestion,
  StoredSubjectRank,
  StoredTest,
  StoredTestResult,
  StoredUser,
  StoredUserAnswer,
} from "@/server/store";
import { createId } from "@/server/store";
import { isOgcodePostgresConfigured, getOgcodePostgresPool } from "@/server/postgres";
import { getStudentGate, type StudentGate } from "@/server/entitlements";
import { FREE_SAMPLE_POOL_SIZE, normalizeSubject as canonicalSubject } from "@/lib/entitlements";
import { isFeatureEnabled } from "@/lib/feature-flags";
import {
  getAssignedTestForStudent,
  getTeacherTestForRoom,
  getTestById as getTeacherTestById,
  listAssignedTestPreviewsForStudent,
  type AssignedTestForStudent,
} from "@/server/workspaces/tests-store";
import { getContentQuestionStoredMap } from "@/server/workspaces/test-question-resolver";
import {
  getOptionDisplayOrder,
  presentOptions,
  verifyOptionPresentationToken,
  type OptionPresentationScope,
} from "@/server/option-presentation";

export type QuestionAnswerPayload = {
  question_id?: string | number;
  questionId?: string | number;
  presentation_id?: string | null;
  presentationId?: string | null;
  selected_option?: number | null;
  selectedOption?: number | null;
  selected_options?: number[];
  selectedOptions?: number[];
  matrix_pairs?: number[][];
  matrixPairs?: number[][];
  answer_text?: string;
  answerText?: string;
  time_spent?: number;
  timeSpent?: number;
  is_marked_for_review?: boolean;
  isMarkedForReview?: boolean;
};

export type TestSubmissionPayload = {
  answers?: QuestionAnswerPayload[];
  time_taken?: number;
  timeTaken?: number;
  isMalpractice?: boolean;
  is_malpractice?: boolean;
};

export type PracticeSubmissionPayload = {
  presentation_id?: string | null;
  presentationId?: string | null;
  selected_option?: number | null;
  selectedOption?: number | null;
  selected_options?: number[];
  selectedOptions?: number[];
  matrix_pairs?: number[][];
  matrixPairs?: number[][];
  answer_text?: string;
  answerText?: string;
  time_spent?: number;
  timeSpent?: number;
};

export type CustomTestPayload = {
  subject?: string;
  difficulty?: string;
  chapter?: string;
  question_count?: number;
};

export type DppQuestionCheckPayload = PracticeSubmissionPayload & {
  question_id?: string | number;
  questionId?: string | number;
};

export type UpdateOgcodeLocationPayload = {
  subject?: string;
  latitude?: number | null;
  longitude?: number | null;
  share?: boolean;
};

export type OgcodeQuestionListFilters = {
  subject?: string | null;
  difficulty?: string | null;
  type?: string | null;
  search?: string | null;
  chapters?: string[] | null;
  status?: "solved" | "unsolved" | null;
  limit?: number | null;
  offset?: number | null;
};

export type OgcodeQuestionPage = {
  items: PracticeQuestion[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
};

export type OgcodeIndexData = {
  questionPage: OgcodeQuestionPage;
  userStats: Awaited<ReturnType<typeof getOgcodeUserStats>>;
  subjectRanks: Awaited<ReturnType<typeof getOgcodeSubjectRanks>>;
  chapters: string[] | null;
};

type TopicAccuracy = { topic: string; accuracy: number };

type GradeResult = {
  isCorrect: boolean;
  info: Record<string, unknown>;
  creditAwarded?: number;
  marksAwarded?: number;
  maxMarks?: number;
  needsReview?: boolean;
  evaluationSource?: string;
};

type SubjectiveMatch = {
  isCorrect: boolean;
  score: number;
  threshold: number;
  matchedTerms: string[];
  missingTerms: string[];
  matchMethod: "exact" | "formula" | "semantic";
};

type ReviewEntry = {
  questionId: string;
  concept: string;
  status: "correct" | "incorrect";
  error: string;
  explanation: string;
  howToApproach: string;
};

type QuestionPresentationContext = {
  scope: OptionPresentationScope;
  assessmentId: string;
  attemptKey: string | number;
};

type SerializeQuestionOptions =
  | boolean
  | {
      includeCorrectFields?: boolean;
      presentationContext?: QuestionPresentationContext;
    };

type PreparedAnswer = {
  answer: StoredUserAnswer;
  displayOrder: number[] | null;
};

type SerializedError = {
  name: string;
  message: string;
  code?: string;
  status?: number;
};

const ANALYTICS_DEGRADED_REASON = "Analytics service unavailable; showing locally scored fallback.";

function serializeError(err: unknown): SerializedError {
  if (err instanceof Error) {
    const maybeRecord = err as Error & { code?: unknown; status?: unknown };
    return {
      name: err.name,
      message: err.message,
      code: typeof maybeRecord.code === "string" ? maybeRecord.code : undefined,
      status: typeof maybeRecord.status === "number" ? maybeRecord.status : undefined,
    };
  }

  return {
    name: "NonError",
    message: typeof err === "string" ? err : "Unknown error",
  };
}

function analyticsFallbackReason(err: SerializedError): string {
  return err.code ?? (err.status ? String(err.status) : err.name || "unknown");
}

function recordAnalyticsFallback(input: {
  scope: "submitTest" | "createCustomTest" | "submitDpp";
  userId: string;
  assessmentId: string;
  err: unknown;
}) {
  const requestId = createId("req");
  const serialized = serializeError(input.err);
  const reason = analyticsFallbackReason(serialized);
  const metricName =
    input.scope === "submitTest"
      ? "origin.submit.fallback"
      : input.scope === "submitDpp"
        ? "origin.dpp.fallback"
        : "origin.custom_test.fallback";

  console.error(`[assessments.${input.scope}] analytics fallback`, {
    userId: input.userId,
    assessmentId: input.assessmentId,
    requestId,
    err: serialized,
  });
  metric(metricName, { service: "analytics", reason });

  return { requestId, reason };
}

function withDegradedPayload<T extends Record<string, unknown>>(payload: T, reason = ANALYTICS_DEGRADED_REASON): T {
  return {
    ...payload,
    degraded: true,
    degradedReason: reason,
    degraded_reason: reason,
  };
}

function normalizeSubject(subject: string): string {
  return subject.toLowerCase();
}

/**
 * Phase 1.4 — whether a subject-tagged item is visible to a (possibly free)
 * student under their entitlement gate. `mixed`/unknown subjects show for any
 * premium; the four billable subjects require the matching entitlement. When
 * gating is not enforced (flag off / non-student) everything is visible.
 */
function subjectVisibleUnderGate(subjectRaw: string | null | undefined, gate: StudentGate): boolean {
  if (!gate.enforced) return true;
  if (!gate.anyPremium) return false;
  const raw = String(subjectRaw ?? "").trim().toLowerCase();
  if (!raw || raw === "mixed" || raw === "all") return true;
  const canonical = canonicalSubject(raw);
  if (!canonical) return true;
  return gate.subjects.includes(canonical);
}

/** Throw a 403 — used to refuse access to content outside a student's entitlement. */
function throwEntitlementForbidden(message: string): never {
  const err = new Error(message);
  (err as { status?: number }).status = 403;
  throw err;
}

function normalizeDifficulty(difficulty: string): DifficultyLevel {
  const normalized = String(difficulty ?? "").trim().toLowerCase();
  if (normalized === "easy" || normalized === "medium" || normalized === "hard" || normalized === "insane") {
    return normalized as DifficultyLevel;
  }
  return "medium";
}

function sortedNumbers(values: number[] | undefined | null): number[] {
  return [...(values ?? [])].sort((left, right) => left - right);
}

function isPresentedChoiceQuestion(question: StoredQuestion): boolean {
  return (
    (question.questionType === "mcq" || question.questionType === "msq") &&
    Array.isArray(question.options) &&
    question.options.length > 1
  );
}

function normalizeSerializeQuestionOptions(options: SerializeQuestionOptions): {
  includeCorrectFields: boolean;
  presentationContext?: QuestionPresentationContext;
} {
  if (typeof options === "boolean") {
    return { includeCorrectFields: options };
  }
  return {
    includeCorrectFields: options.includeCorrectFields ?? true,
    presentationContext: options.presentationContext,
  };
}

function remapPresentedAnswer(
  userId: string,
  question: StoredQuestion,
  answer: StoredUserAnswer,
  expectedPresentation?: Partial<Pick<QuestionPresentationContext, "scope" | "assessmentId">>,
): PreparedAnswer {
  if (!isPresentedChoiceQuestion(question)) {
    return { answer, displayOrder: null };
  }

  if (!answer.presentationId) {
    if (hasResponse(answer)) {
      throw new Error("Option presentation token is required.");
    }
    return { answer, displayOrder: null };
  }

  const payload = verifyOptionPresentationToken(answer.presentationId, {
    userId,
    questionId: question.id,
    optionCount: question.options?.length ?? 0,
    scope: expectedPresentation?.scope,
    assessmentId: expectedPresentation?.assessmentId,
  });

  if (!payload) {
    throw new Error("Invalid option presentation token.");
  }

  const displayOrder = getOptionDisplayOrder(payload);
  const selectedOption =
    answer.selectedOption === null
      ? null
      : displayOrder[answer.selectedOption] ?? -1;
  const selectedOptions =
    answer.selectedOptions?.map((optionIndex) => displayOrder[optionIndex] ?? -1) ?? null;

  return {
    answer: {
      ...answer,
      selectedOption,
      selectedOptions,
    },
    displayOrder,
  };
}

function toPresentedGradeInfo(
  question: StoredQuestion,
  info: Record<string, unknown>,
  displayOrder: number[] | null,
): Record<string, unknown> {
  if (!displayOrder) {
    return info;
  }

  if (question.questionType === "mcq" && question.correctOption !== null) {
    const displayedCorrectOption = displayOrder.indexOf(question.correctOption);
    return {
      ...info,
      correctOption: displayedCorrectOption >= 0 ? displayedCorrectOption : null,
      correct_option: displayedCorrectOption >= 0 ? displayedCorrectOption : null,
    };
  }

  if (question.questionType === "msq" && question.correctOptions?.length) {
    const displayedCorrectOptions = question.correctOptions
      .map((correctOption) => displayOrder.indexOf(correctOption))
      .filter((optionIndex) => optionIndex >= 0)
      .sort((left, right) => left - right);
    return {
      ...info,
      correctOptions: displayedCorrectOptions,
      correct_options: displayedCorrectOptions,
    };
  }

  return info;
}

const SUPERSCRIPT_MAP = new Map<string, string>([
  ["\u2070", "0"],
  ["\u00b9", "1"],
  ["\u00b2", "2"],
  ["\u00b3", "3"],
  ["\u2074", "4"],
  ["\u2075", "5"],
  ["\u2076", "6"],
  ["\u2077", "7"],
  ["\u2078", "8"],
  ["\u2079", "9"],
  ["\u207b", "-"],
  ["\u207a", "+"],
]);

const GREEK_SYMBOL_MAP = new Map<string, string>([
  ["\u0391", "alpha"],
  ["\u03b1", "alpha"],
  ["\u0392", "beta"],
  ["\u03b2", "beta"],
  ["\u0393", "gamma"],
  ["\u03b3", "gamma"],
  ["\u0394", "delta"],
  ["\u03b4", "delta"],
  ["\u0395", "epsilon"],
  ["\u03b5", "epsilon"],
  ["\u0396", "zeta"],
  ["\u03b6", "zeta"],
  ["\u0397", "eta"],
  ["\u03b7", "eta"],
  ["\u0398", "theta"],
  ["\u03b8", "theta"],
  ["\u039b", "lambda"],
  ["\u03bb", "lambda"],
  ["\u039c", "mu"],
  ["\u03bc", "mu"],
  ["\u03a0", "pi"],
  ["\u03c0", "pi"],
  ["\u03a1", "rho"],
  ["\u03c1", "rho"],
  ["\u03a3", "sigma"],
  ["\u03c3", "sigma"],
  ["\u03c2", "sigma"],
  ["\u03a4", "tau"],
  ["\u03c4", "tau"],
  ["\u03a6", "phi"],
  ["\u03c6", "phi"],
  ["\u03a9", "omega"],
  ["\u03c9", "omega"],
]);

const WORD_NUMBER_MAP = new Map<string, string>([
  ["zero", "0"],
  ["one", "1"],
  ["two", "2"],
  ["three", "3"],
  ["four", "4"],
  ["five", "5"],
  ["six", "6"],
  ["seven", "7"],
  ["eight", "8"],
  ["nine", "9"],
  ["ten", "10"],
]);

const STOPWORDS = new Set([
  "a",
  "all",
  "an",
  "and",
  "approximately",
  "approx",
  "are",
  "as",
  "at",
  "be",
  "by",
  "concept",
  "dependent",
  "does",
  "equals",
  "explained",
  "for",
  "from",
  "has",
  "have",
  "hence",
  "if",
  "in",
  "is",
  "it",
  "its",
  "of",
  "on",
  "or",
  "same",
  "that",
  "the",
  "their",
  "they",
  "then",
  "therefore",
  "this",
  "to",
  "value",
  "which",
  "will",
  "with",
]);

const TOKEN_ALIASES = new Map<string, string>([
  ["acts", "act"],
  ["acting", "act"],
  ["behaves", "behave"],
  ["behaving", "behave"],
  ["degrees", "degree"],
  ["sec", "second"],
  ["seconds", "second"],
  ["approximate", "approx"],
  ["approximation", "approx"],
  ["speed", "velocity"],
  ["velocities", "velocity"],
  ["accelerations", "acceleration"],
  ["opencircuit", "open_circuit"],
  ["shortcircuit", "short_circuit"],
  ["taninverse", "arctan"],
  ["arctangent", "arctan"],
  ["sininverse", "arcsin"],
  ["arcsine", "arcsin"],
  ["cosinverse", "arccos"],
  ["arccosine", "arccos"],
]);

const FORMULA_SIGNAL_TOKENS = new Set([
  "sin",
  "cos",
  "tan",
  "arcsin",
  "arccos",
  "arctan",
  "sqrt",
  "log",
  "ln",
  "pi",
  "infinity",
]);

function replaceMappedSymbols(value: string, replacements: Map<string, string>): string {
  return Array.from(value, (character) => replacements.get(character) ?? character).join("");
}

function replaceSuperscripts(value: string): string {
  return replaceMappedSymbols(value, SUPERSCRIPT_MAP);
}

function replaceGreekLetters(value: string): string {
  return replaceMappedSymbols(value, GREEK_SYMBOL_MAP);
}

function normalizeEquationText(value: string | null | undefined): string {
  let normalized = replaceGreekLetters(replaceSuperscripts(String(value ?? "").normalize("NFKC")));
  normalized = normalized.replace(/[\u2212\u2013\u2014]/g, "-");

  for (const [word, numeric] of WORD_NUMBER_MAP.entries()) {
    normalized = normalized.replace(new RegExp(`\\b${word}\\b`, "gi"), ` ${numeric} `);
  }

  normalized = normalized
    .replace(/\\frac\s*{([^{}]+)}\s*{([^{}]+)}/g, " $1 / $2 ")
    .replace(/\\sqrt\s*{([^{}]+)}/g, " sqrt $1 ")
    .replace(/√\s*\(([^()]*)\)/g, " sqrt $1 ")
    .replace(/√\s*{([^{}]+)}/g, " sqrt $1 ")
    .replace(/√\s*([a-zA-Z0-9.]+)/g, " sqrt $1 ")
    .replace(/\\(?:times|cdot)/g, " x ")
    .replace(/\\(?:infty|infinity)/g, " infinity ")
    .replace(/\\tan\s*\^\s*\{\s*-?1\s*\}/g, " arctan ")
    .replace(/\\sin\s*\^\s*\{\s*-?1\s*\}/g, " arcsin ")
    .replace(/\\cos\s*\^\s*\{\s*-?1\s*\}/g, " arccos ")
    .replace(/\btan\s*\^\s*-?1\b/gi, " arctan ")
    .replace(/\bsin\s*\^\s*-?1\b/gi, " arcsin ")
    .replace(/\bcos\s*\^\s*-?1\b/gi, " arccos ")
    .replace(/\btan\s*-\s*1\b/gi, " arctan ")
    .replace(/\bsin\s*-\s*1\b/gi, " arcsin ")
    .replace(/\bcos\s*-\s*1\b/gi, " arccos ")
    .replace(/\bshort[\s-]*circuit\b/gi, " short_circuit ")
    .replace(/\bopen[\s-]*circuit\b/gi, " open_circuit ")
    .replace(/∞/g, " infinity ")
    .replace(/π/gi, " pi ")
    .replace(/[μµ]/g, " micro ")
    .replace(/[Ωω]/g, " ohm ")
    .replace(/°/g, " degree ")
    .replace(/×/g, " x ")
    .replace(/·/g, " ")
    .replace(/\b(\d+(?:\.\d+)?)\s*sec\b/gi, "$1 second ")
    .replace(/\b(\d+(?:\.\d+)?)\s*s\b/gi, "$1 second ")
    .replace(/\b(\d+(?:\.\d+)?)\s*cm\b/gi, "$1 centimeter ")
    .replace(/\b(\d+(?:\.\d+)?)\s*mm\b/gi, "$1 millimeter ")
    .replace(/\b(\d+(?:\.\d+)?)\s*kg\b/gi, "$1 kilogram ")
    .replace(/\b(\d+(?:\.\d+)?)\s*m\/s\b/gi, "$1 meter_per_second ")
    .replace(/\b(\d+(?:\.\d+)?)\s*m\/s\^?2\b/gi, "$1 meter_per_second_square ")
    .replace(/\b(\d+(?:\.\d+)?)\s*eV\b/g, "$1 electronvolt ")
    .replace(/[{}[\]()]/g, " ")
    .replace(/_/g, "")
    .replace(/([=:+\-*/^,;])/g, " $1 ")
    .replace(/[^\p{L}\p{N}_.%/+^=\-\s]/gu, " ")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

  return normalized;
}

function normalizeFreeText(value: string | null | undefined): string {
  return normalizeEquationText(value);
}

function compactSemanticText(value: string | null | undefined): string {
  return normalizeFreeText(value).replace(/\s+/g, "");
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function getSemanticBand(score: number, threshold: number): "strong_match" | "accepted_match" | "near_match" | "weak_match" {
  if (score >= threshold + 0.12) {
    return "strong_match";
  }
  if (score >= threshold) {
    return "accepted_match";
  }
  if (score >= threshold - 0.08) {
    return "near_match";
  }
  return "weak_match";
}

function extractNumericValues(value: string | null | undefined): number[] {
  const matches = normalizeFreeText(value)
    .replace(/,/g, "")
    .match(/[-+]?\d*\.?\d+(?:e[-+]?\d+)?/gi);

  return (matches ?? [])
    .map((entry) => Number(entry))
    .filter((entry) => Number.isFinite(entry));
}

function stemToken(token: string): string {
  if (token.endsWith("ies") && token.length > 4) {
    return `${token.slice(0, -3)}y`;
  }
  if (token.endsWith("ing") && token.length > 5) {
    return token.slice(0, -3);
  }
  if (token.endsWith("ed") && token.length > 4) {
    return token.slice(0, -2);
  }
  if (token.endsWith("es") && token.length > 4 && !token.endsWith("ses")) {
    return token.slice(0, -2);
  }
  if (token.endsWith("s") && token.length > 3 && !token.endsWith("ss")) {
    return token.slice(0, -1);
  }
  return token;
}

function canonicalizeToken(token: string): string | null {
  if (!token) {
    return null;
  }

  if (/^[-+]?\d*\.?\d+(?:e[-+]?\d+)?$/.test(token)) {
    const numeric = Number(token);
    return Number.isFinite(numeric) ? String(numeric) : token;
  }

  const squashed = token.replace(/_/g, "");
  const aliased = TOKEN_ALIASES.get(squashed) ?? token;
  const stemmed = stemToken(aliased);
  if (STOPWORDS.has(stemmed)) {
    return null;
  }
  if (stemmed.length <= 1 && !/^\d+$/.test(stemmed)) {
    return null;
  }
  return stemmed;
}

function extractSemanticTokens(value: string | null | undefined): string[] {
  return normalizeFreeText(value)
    .split(" ")
    .map((token) => token.replace(/[^a-z0-9_.]/g, ""))
    .map(canonicalizeToken)
    .filter((token): token is string => Boolean(token));
}

function normalizeFormulaComponent(token: string): string | null {
  if (!token) {
    return null;
  }
  if (/^[=+\-*/^]$/.test(token)) {
    return token;
  }

  if (/^[-+]?\d*\.?\d+(?:e[-+]?\d+)?$/.test(token)) {
    const numeric = Number(token);
    return Number.isFinite(numeric) ? String(numeric) : token;
  }

  const squashed = token.replace(/_/g, "");
  const aliased = TOKEN_ALIASES.get(squashed) ?? token;
  return aliased || null;
}

function extractFormulaComponents(value: string | null | undefined): string[] {
  return normalizeFreeText(value)
    .split(" ")
    .map((token) => token.trim())
    .filter(Boolean)
    .map(normalizeFormulaComponent)
    .filter((token): token is string => Boolean(token));
}

function formulaComponentWeight(token: string): number {
  if (/^[=+\-*/^]$/.test(token)) {
    return 1.2;
  }
  if (/^[-+]?\d/.test(token)) {
    return 1.1;
  }
  if (FORMULA_SIGNAL_TOKENS.has(token)) {
    return 1.4;
  }
  if (token.length === 1) {
    return 1;
  }
  return 1.15;
}

function isOperatorToken(token: string): boolean {
  return /^[=+\-*/^]$/.test(token);
}

function isMalformedFormulaComponents(tokens: string[]): boolean {
  if (!tokens.length) {
    return true;
  }

  if (isOperatorToken(tokens[0]) || isOperatorToken(tokens[tokens.length - 1])) {
    return true;
  }

  for (let index = 1; index < tokens.length; index += 1) {
    if (isOperatorToken(tokens[index - 1]) && isOperatorToken(tokens[index])) {
      return true;
    }
  }

  return false;
}

function weightedMultisetCoverage(expectedTokens: string[], submittedTokens: string[]) {
  const submittedCounts = new Map<string, number>();
  submittedTokens.forEach((token) => {
    submittedCounts.set(token, (submittedCounts.get(token) ?? 0) + 1);
  });

  let totalWeight = 0;
  let matchedWeight = 0;
  const matchedTerms: string[] = [];
  const missingTerms: string[] = [];

  expectedTokens.forEach((token) => {
    const weight = formulaComponentWeight(token);
    totalWeight += weight;
    const count = submittedCounts.get(token) ?? 0;
    if (count > 0) {
      matchedWeight += weight;
      matchedTerms.push(token);
      submittedCounts.set(token, count - 1);
    } else {
      missingTerms.push(token);
    }
  });

  return {
    score: totalWeight > 0 ? matchedWeight / totalWeight : 0,
    matchedTerms,
    missingTerms,
  };
}

function semanticTokenWeight(token: string): number {
  if (/^[-+]?\d/.test(token)) {
    return 2.5;
  }
  if (token.includes("_")) {
    return 1.8;
  }
  if (token.length >= 8) {
    return 1.5;
  }
  if (token.length >= 5) {
    return 1.2;
  }
  return 1;
}

function isCriticalSemanticToken(token: string): boolean {
  if (FORMULA_SIGNAL_TOKENS.has(token)) {
    return true;
  }
  return !/^\d/.test(token) && token.length >= 5;
}

function weightedCoverage(expectedTokens: string[], submittedTokens: string[]) {
  const submittedSet = new Set(submittedTokens);
  const uniqueExpected = [...new Set(expectedTokens)];
  let totalWeight = 0;
  let matchedWeight = 0;
  const matchedTerms: string[] = [];
  const missingTerms: string[] = [];

  uniqueExpected.forEach((token) => {
    const weight = semanticTokenWeight(token);
    totalWeight += weight;
    if (submittedSet.has(token)) {
      matchedWeight += weight;
      matchedTerms.push(token);
    } else {
      missingTerms.push(token);
    }
  });

  return {
    score: totalWeight > 0 ? matchedWeight / totalWeight : 0,
    matchedTerms,
    missingTerms,
  };
}

function buildCharNgrams(value: string, size = 3): Set<string> {
  const compact = compactSemanticText(value);
  if (!compact) {
    return new Set();
  }
  if (compact.length <= size) {
    return new Set([compact]);
  }

  const grams = new Set<string>();
  for (let index = 0; index <= compact.length - size; index += 1) {
    grams.add(compact.slice(index, index + size));
  }
  return grams;
}

function diceSimilarity(left: string, right: string): number {
  const leftGrams = buildCharNgrams(left);
  const rightGrams = buildCharNgrams(right);
  if (!leftGrams.size || !rightGrams.size) {
    return leftGrams.size === rightGrams.size ? 1 : 0;
  }

  let overlap = 0;
  leftGrams.forEach((gram) => {
    if (rightGrams.has(gram)) {
      overlap += 1;
    }
  });

  return (2 * overlap) / (leftGrams.size + rightGrams.size);
}

type NumericComparison = {
  score: number | null;
  conflicting: boolean;
};

function compareNumericSignals(expectedValue: string | null | undefined, submittedValue: string | null | undefined): NumericComparison {
  const expectedNumbers = extractNumericValues(expectedValue);
  if (!expectedNumbers.length) {
    return { score: null, conflicting: false };
  }

  const submittedNumbers = extractNumericValues(submittedValue);
  if (!submittedNumbers.length) {
    return { score: 0, conflicting: false };
  }

  const usedIndices = new Set<number>();
  let matched = 0;

  expectedNumbers.forEach((expected) => {
    const tolerance = Math.max(Math.abs(expected) * 0.02, 0.01);
    const matchIndex = submittedNumbers.findIndex(
      (submitted, index) => !usedIndices.has(index) && Math.abs(submitted - expected) <= tolerance,
    );
    if (matchIndex >= 0) {
      matched += 1;
      usedIndices.add(matchIndex);
    }
  });

  return {
    score: matched / expectedNumbers.length,
    conflicting: matched === 0 && submittedNumbers.length > 0,
  };
}

function buildSemanticVariants(expectedValue: string | null | undefined): string[] {
  const raw = String(expectedValue ?? "").trim();
  if (!raw) {
    return [];
  }
  const formulaHeavy = isFormulaHeavy(raw);

  const variants = new Map<string, { source: "raw" | "context" | "alternative" | "equals"; density: number }>();
  const addVariant = (candidate: string, source: "raw" | "context" | "alternative" | "equals") => {
    const trimmed = candidate.replace(/\s+/g, " ").trim();
    if (!trimmed) {
      return;
    }
    const density = extractSemanticTokens(trimmed).length + extractNumericValues(trimmed).length;
    variants.set(trimmed, { source, density });
  };

  addVariant(raw, "raw");
  if (!formulaHeavy) {
    const withoutParenthetical = raw.replace(/\([^)]*\)/g, " ").replace(/\s+/g, " ").trim();
    if (withoutParenthetical && withoutParenthetical !== raw) {
      addVariant(withoutParenthetical, "context");
    }

    [...raw.matchAll(/\(([^)]*)\)/g)].forEach((match) => {
      addVariant(match[1], "context");
      if (match[1].includes(":")) {
        addVariant(match[1].split(":").slice(1).join(":").trim(), "context");
      }
    });

    if (raw.includes(":")) {
      addVariant(raw.split(":").slice(1).join(":").trim(), "context");
    }
  }

  const pending = [...variants.keys()];
  pending.forEach((candidate) => {
    if (candidate.includes("=")) {
      addVariant(candidate.split("=").slice(1).join("=").trim(), "equals");
    }
    if (/\bor\b/i.test(candidate)) {
      candidate
        .split(/\bor\b/i)
        .map((part) => part.trim())
        .filter(Boolean)
        .forEach((part) => addVariant(part, "alternative"));
    }
  });

  const rawDensity = variants.get(raw)?.density ?? 0;
  return [...variants.entries()]
    .filter(([, meta]) => {
      if (meta.source === "raw" || meta.source === "alternative" || meta.source === "equals") {
        return true;
      }
      return meta.density >= Math.max(2, Math.ceil(rawDensity * 0.5));
    })
    .map(([candidate]) => candidate);
}

function contextCoverage(question: StoredQuestion, submittedTokens: string[]): number {
  const contextReference = `${question.concept ?? ""} ${String(question.explanation ?? "").split(/[.?!]/)[0] ?? ""}`;
  const contextTokens = extractSemanticTokens(contextReference).slice(0, 8);
  if (!contextTokens.length) {
    return 0;
  }
  return weightedCoverage(contextTokens, submittedTokens).score;
}

function isFormulaHeavy(value: string): boolean {
  return /[=\\/^*+\-]|arctan|arcsin|arccos|sqrt|pi|infinity|short_circuit|open_circuit/.test(
    normalizeFreeText(value),
  );
}

function evaluateSubjectiveVariant(
  question: StoredQuestion,
  expectedVariant: string,
  submittedValue: string | null | undefined,
): SubjectiveMatch {
  if (!compactSemanticText(submittedValue)) {
    return {
      isCorrect: false,
      score: 0,
      threshold: 1,
      matchedTerms: [],
      missingTerms: extractSemanticTokens(expectedVariant),
      matchMethod: "semantic",
    };
  }

  const submittedTokens = extractSemanticTokens(submittedValue);
  const expectedTokens = extractSemanticTokens(expectedVariant);
  const coverage = weightedCoverage(expectedTokens, submittedTokens);
  const criticalExpectedTokens = expectedTokens.filter(isCriticalSemanticToken);
  const criticalCoverage = weightedCoverage(criticalExpectedTokens, submittedTokens);
  const nonNumericCriticalCoverage = weightedCoverage(
    criticalExpectedTokens.filter((token) => !/^\d/.test(token)),
    submittedTokens,
  );
  const numericComparison = compareNumericSignals(expectedVariant, submittedValue);
  const formulaScore = diceSimilarity(expectedVariant, submittedValue ?? "");
  const contextScore = contextCoverage(question, submittedTokens);
  const formulaHeavy = isFormulaHeavy(expectedVariant);
  const submittedFormulaComponents = formulaHeavy ? extractFormulaComponents(submittedValue) : [];
  const formulaStructure = formulaHeavy
    ? weightedMultisetCoverage(
        extractFormulaComponents(expectedVariant),
        submittedFormulaComponents,
      )
    : null;
  const malformedFormula = formulaHeavy && isMalformedFormulaComponents(submittedFormulaComponents);

  const components: Array<[number, number]> = formulaHeavy
    ? [
        [coverage.score, 0.25],
        [formulaScore, 0.25],
      ]
    : [
        [coverage.score, 0.58],
        [formulaScore, 0.22],
      ];

  if (formulaStructure) {
    components.push([formulaStructure.score, 0.3]);
  }

  if (numericComparison.score !== null) {
    components.push([numericComparison.score, formulaHeavy ? 0.14 : 0.14]);
  }
  if (contextScore > 0) {
    components.push([Math.min(contextScore, 0.8), formulaHeavy ? 0.06 : 0.06]);
  }

  const totalWeight = components.reduce((sum, [, weight]) => sum + weight, 0);
  let score =
    totalWeight > 0
      ? components.reduce((sum, [value, weight]) => sum + value * weight, 0) / totalWeight
      : 0;

  const semanticDensity = Math.max(expectedTokens.length, extractNumericValues(expectedVariant).length);
  let threshold = formulaHeavy ? 0.68 : 0.72;
  if (semanticDensity >= 5) {
    threshold -= 0.06;
  } else if (semanticDensity <= 2) {
    threshold += 0.08;
  }

  const exactCompactMatch = compactSemanticText(expectedVariant) === compactSemanticText(submittedValue);
  if (exactCompactMatch) {
    return {
      isCorrect: true,
      score: 1,
      threshold,
      matchedTerms: coverage.matchedTerms,
      missingTerms: coverage.missingTerms,
      matchMethod: "exact",
    };
  }

  if (coverage.score >= 0.95 || formulaScore >= 0.94) {
    score = Math.max(score, threshold);
  }

  if (
    !formulaHeavy &&
    nonNumericCriticalCoverage.score === 1 &&
    nonNumericCriticalCoverage.matchedTerms.length > 0 &&
    (numericComparison.score === 1 || formulaScore >= 0.55)
  ) {
    score = Math.max(score, threshold);
  }

  if (
    numericComparison.score === 1 &&
    (formulaScore >= 0.55 || coverage.score >= 0.6) &&
    (!formulaHeavy || criticalCoverage.score >= 0.8)
  ) {
    score = Math.max(score, threshold);
  }

  if (numericComparison.conflicting && coverage.score < 0.85 && formulaScore < 0.85) {
    score = Math.min(score, threshold - 0.15);
  }

  if (formulaHeavy && criticalCoverage.score < 0.55) {
    score = Math.min(score, threshold - (criticalCoverage.score < 0.25 ? 0.18 : 0.08));
  }

  if (formulaHeavy && formulaStructure && formulaStructure.score < 0.88) {
    score = Math.min(score, threshold - (formulaStructure.score < 0.72 ? 0.2 : 0.1));
  }

  if (malformedFormula) {
    score = Math.min(score, threshold - 0.28);
  }

  score = clamp01(score);
  threshold = clamp01(threshold);

  const matchMethod: SubjectiveMatch["matchMethod"] =
    formulaScore >= coverage.score + 0.12 ? "formula" : "semantic";

  return {
    isCorrect: score >= threshold,
    score,
    threshold,
    matchedTerms: coverage.matchedTerms,
    missingTerms: coverage.missingTerms,
    matchMethod,
  };
}

function answersMatchAsText(question: StoredQuestion, submittedValue: string | null | undefined): SubjectiveMatch {
  if (!String(submittedValue ?? "").trim()) {
    return {
      isCorrect: false,
      score: 0,
      threshold: 1,
      matchedTerms: [],
      missingTerms: [],
      matchMethod: "semantic",
    };
  }

  const variants = buildSemanticVariants(question.answerText);
  if (!variants.length) {
    return {
      isCorrect: false,
      score: 0,
      threshold: 1,
      matchedTerms: [],
      missingTerms: [],
      matchMethod: "semantic",
    };
  }

  return variants.reduce<SubjectiveMatch>((best, variant) => {
    const current = evaluateSubjectiveVariant(question, variant, submittedValue);
    if (current.score > best.score) {
      return current;
    }
    return best;
  }, {
    isCorrect: false,
    score: 0,
    threshold: 1,
    matchedTerms: [],
    missingTerms: [],
    matchMethod: "semantic",
  });
}

function normalizeAnswer(payload: QuestionAnswerPayload | PracticeSubmissionPayload): StoredUserAnswer {
  return {
    questionId: String(
      (payload as QuestionAnswerPayload).questionId ??
        (payload as QuestionAnswerPayload).question_id ??
        "",
    ),
    presentationId:
      payload.presentationId ??
      payload.presentation_id ??
      null,
    selectedOption:
      payload.selectedOption ??
      payload.selected_option ??
      null,
    selectedOptions:
      payload.selectedOptions ??
      payload.selected_options ??
      null,
    matrixPairs:
      payload.matrixPairs ??
      payload.matrix_pairs ??
      null,
    answerText:
      (payload.answerText ?? payload.answer_text ?? null)
        ?.trim().replace(/\s+/g, ' ') ?? null,
    timeSpent:
      payload.timeSpent ??
      payload.time_spent ??
      0,
    isMarkedForReview:
      (payload as QuestionAnswerPayload).isMarkedForReview ??
      (payload as QuestionAnswerPayload).is_marked_for_review ??
      false,
  };
}

function hasResponse(answer: StoredUserAnswer): boolean {
  return (
    answer.selectedOption !== null ||
    Boolean(answer.selectedOptions?.length) ||
    Boolean(answer.matrixPairs?.length) ||
    Boolean(answer.answerText?.trim())
  );
}

function withLocalScoring(
  question: StoredQuestion,
  answer: StoredUserAnswer,
  grade: Pick<GradeResult, "isCorrect" | "info"> & { creditAwarded?: number },
  sourceType: AssessmentSourceType = "test",
): GradeResult {
  const policy = scoringPolicyForQuestion(question, sourceType);
  const creditAwarded = grade.creditAwarded ?? (grade.isCorrect ? 1 : 0);
  const marksAwarded = computeMarksFromCredit({
    answered: hasResponse(answer),
    isCorrect: grade.isCorrect,
    creditAwarded,
    policy,
  });
  return {
    ...grade,
    creditAwarded,
    marksAwarded,
    maxMarks: policy.correctMarks,
    needsReview: Boolean(grade.info.needsReview ?? grade.info.needs_review),
    evaluationSource: "local_fallback",
    info: {
      ...grade.info,
      creditAwarded,
      credit_awarded: creditAwarded,
      marksAwarded,
      marks_awarded: marksAwarded,
      maxMarks: policy.correctMarks,
      max_marks: policy.correctMarks,
      evaluationSource: "local_fallback",
      evaluation_source: "local_fallback",
    },
  };
}

function gradeAnswer(question: StoredQuestion, answer: StoredUserAnswer, sourceType: AssessmentSourceType = "test"): GradeResult {
  if (question.questionType === "mcq") {
    const isCorrect =
      question.correctOption !== null &&
      answer.selectedOption !== null &&
      answer.selectedOption === question.correctOption;
    return withLocalScoring(
      question,
      answer,
      {
        isCorrect,
        info: {
          correctOption: question.correctOption,
          correct_option: question.correctOption,
          explanation: question.explanation,
        },
      },
      sourceType,
    );
  }

  if (question.questionType === "msq") {
    const submitted = sortedNumbers(answer.selectedOptions);
    const expected = sortedNumbers(question.correctOptions);
    const isCorrect = expected.length > 0 && JSON.stringify(submitted) === JSON.stringify(expected);
    const isPartial =
      !isCorrect &&
      submitted.length > 0 &&
      expected.length > 0 &&
      submitted.every((option) => expected.includes(option));
    const creditAwarded = isCorrect ? 1 : isPartial ? Number((submitted.length / expected.length).toFixed(3)) : 0;
    return withLocalScoring(
      question,
      answer,
      {
        isCorrect,
        creditAwarded,
        info: {
          correctOptions: question.correctOptions,
          correct_options: question.correctOptions,
          explanation: question.explanation,
        },
      },
      sourceType,
    );
  }

  if (question.questionType === "numerical") {
    const submitted = extractNumericValues(answer.answerText)[0];
    const expected = extractNumericValues(question.answerText)[0];
    const tolerance = question.tolerance ?? Math.max(Math.abs(expected ?? 0) * 0.01, 0.001);
    const isCorrect =
      Number.isFinite(submitted) &&
      Number.isFinite(expected) &&
      Math.abs((submitted ?? 0) - (expected ?? 0)) <= tolerance;
    return withLocalScoring(
      question,
      answer,
      {
        isCorrect,
        info: {
          correctAnswerText: question.answerText,
          correct_answer_text: question.answerText,
          tolerance: question.tolerance,
          explanation: question.explanation,
        },
      },
      sourceType,
    );
  }

  if (question.questionType === "matrix_match") {
    const expected = [...(question.matrixData?.correct_pairs ?? [])]
      .map((pair) => pair.join(":"))
      .sort();
    const submitted = [...(answer.matrixPairs ?? [])]
      .map((pair) => pair.join(":"))
      .sort();
    const isCorrect = JSON.stringify(submitted) === JSON.stringify(expected);
    const correctPairSet = new Set(expected);
    const partialMatches = submitted.filter((pair) => correctPairSet.has(pair)).length;
    const creditAwarded = isCorrect ? 1 : expected.length > 0 ? Number((partialMatches / expected.length).toFixed(3)) : 0;
    return withLocalScoring(
      question,
      answer,
      {
        isCorrect,
        creditAwarded,
        info: {
          correctPairs: question.matrixData?.correct_pairs ?? [],
          correct_pairs: question.matrixData?.correct_pairs ?? [],
          explanation: question.explanation,
        },
      },
      sourceType,
    );
  }

  const semanticMatch = answersMatchAsText(question, answer.answerText);
  const semanticBand = getSemanticBand(semanticMatch.score, semanticMatch.threshold);
  const normalizedSemanticRatio = clamp01(
    semanticMatch.threshold > 0 ? semanticMatch.score / semanticMatch.threshold : semanticMatch.score,
  );
  const creditAwarded = semanticMatch.isCorrect
    ? 1
    : Number(
        (
          semanticBand === "near_match"
            ? normalizedSemanticRatio * 0.4
            : semanticBand === "weak_match"
              ? normalizedSemanticRatio * 0.15
              : 0
        ).toFixed(3),
      );
  return withLocalScoring(
    question,
    answer,
    {
      isCorrect: semanticMatch.isCorrect,
      creditAwarded,
      info: {
        correctAnswerText: question.answerText,
        correct_answer_text: question.answerText,
        explanation: question.explanation,
        semanticScore: Number(semanticMatch.score.toFixed(3)),
        semantic_score: Number(semanticMatch.score.toFixed(3)),
        semanticThreshold: Number(semanticMatch.threshold.toFixed(3)),
        semantic_threshold: Number(semanticMatch.threshold.toFixed(3)),
        semanticBand,
        semantic_band: semanticBand,
        matchMethod: semanticMatch.matchMethod,
        match_method: semanticMatch.matchMethod,
        matchedTerms: semanticMatch.matchedTerms,
        matched_terms: semanticMatch.matchedTerms,
        missingTerms: semanticMatch.missingTerms,
        missing_terms: semanticMatch.missingTerms,
      },
    },
    sourceType,
  );
}

async function gradePracticeAnswer(
  question: StoredQuestion,
  answer: StoredUserAnswer,
  userId: string,
): Promise<GradeResult> {
  const remoteGrade = await gradePracticeAnswerWithService(question, answer, userId);
  if (remoteGrade) {
    return remoteGrade;
  }
  return gradeAnswer(question, answer, "practice");
}

function questionById(store: AppStore, questionId: string): StoredQuestion {
  const question = store.questions.find((entry) => entry.id === questionId);
  if (!question) {
    throw new Error(`Question ${questionId} was not found.`);
  }
  return question;
}

type ResolvedQuestion = {
  question: StoredQuestion;
  source: "store" | "catalog";
};

async function resolvePracticeQuestion(store: AppStore, questionId: string): Promise<ResolvedQuestion> {
  const fromStore = store.questions.find((entry) => entry.id === questionId);
  if (fromStore) {
    return { question: fromStore, source: "store" };
  }

  const fromCatalog = await getOgcodeCatalogQuestionById(questionId);
  if (fromCatalog) {
    return { question: fromCatalog, source: "catalog" };
  }

  throw new Error(`Question ${questionId} was not found.`);
}

async function getOgcodeQuestionBank(store: AppStore): Promise<StoredQuestion[]> {
  try {
    const catalogQuestions = await listOgcodeCatalogQuestions();
    if (!catalogQuestions.length) {
      return store.questions;
    }

    const questionsById = new Map<string, StoredQuestion>();
    store.questions.forEach((question) => {
      questionsById.set(question.id, question);
    });
    catalogQuestions.forEach((question) => {
      questionsById.set(question.id, question);
    });

    return [...questionsById.values()];
  } catch {
    return store.questions;
  }
}

async function buildQuestionLookup(store: AppStore, questionIds: string[]): Promise<Map<string, StoredQuestion>> {
  const lookup = new Map<string, StoredQuestion>();

  questionIds.forEach((questionId) => {
    const question = store.questions.find((entry) => entry.id === questionId);
    if (question) {
      lookup.set(questionId, question);
    }
  });

  const missingIds = questionIds.filter((questionId) => !lookup.has(questionId));
  if (missingIds.length) {
    const catalogLookup = await getOgcodeCatalogQuestionMap(missingIds);
    catalogLookup.forEach((question, questionId) => {
      lookup.set(questionId, question);
    });
  }

  // Phase 15: ids still unresolved after store + ogcode are Question-Bag
  // (`content.questions`) ids carried by mixed-source teacher tests. Resolving
  // them here closes the gap where workspace_bag questions silently dropped on
  // take/grade. No extra query for the common case (nothing left missing).
  const stillMissingIds = questionIds.filter((questionId) => !lookup.has(questionId));
  if (stillMissingIds.length) {
    const contentLookup = await getContentQuestionStoredMap(stillMissingIds);
    contentLookup.forEach((question, questionId) => {
      lookup.set(questionId, question);
    });
  }

  return lookup;
}

type OgcodeAttemptState = {
  attemptedIds: Set<string>;
  solvedIds: Set<string>;
};

async function buildOgcodeAttemptState(store: AppStore, userId: string): Promise<OgcodeAttemptState> {
  const attemptedIds = new Set<string>();
  const solvedIds = new Set<string>();

  if (isUserPostgresConfigured()) {
    try {
      const dbState = await getOgcodeProgressForUser(userId);
      dbState.attemptedIds.forEach((id) => attemptedIds.add(id));
      dbState.solvedIds.forEach((id) => solvedIds.add(id));
    } catch (error) {
      console.error("[assessments] Failed to fetch OGCode progress from Postgres:", error);
    }
  }

  store.practiceAttempts.forEach((attempt) => {
    if (attempt.userId !== userId) {
      return;
    }

    attemptedIds.add(attempt.questionId);
    if (attempt.isCorrect) {
      solvedIds.add(attempt.questionId);
    }
  });

  return { attemptedIds, solvedIds };
}

function normalizeOgcodeStatusFilter(status: string | null | undefined): "solved" | "unsolved" | null {
  if (status === "solved" || status === "unsolved") {
    return status;
  }
  return null;
}

function normalizeOgcodeChaptersFilter(chapters: string[] | null | undefined): string[] {
  return (chapters ?? []).map((entry) => String(entry ?? "").trim()).filter(Boolean);
}

function matchesOgcodeSearch(question: StoredQuestion, rawSearch: string | null | undefined): boolean {
  const search = String(rawSearch ?? "").trim().toLowerCase();
  if (!search) {
    return true;
  }

  const haystack = [
    question.text,
    question.chapter,
    question.concept,
    ...(Array.isArray(question.tags) ? question.tags : question.tags ? [String(question.tags)] : []),
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes(search);
}

function matchesOgcodeStatus(
  questionId: string,
  status: "solved" | "unsolved" | null,
  attemptState: OgcodeAttemptState,
): boolean {
  if (!status) {
    return true;
  }
  if (status === "solved") {
    return attemptState.solvedIds.has(questionId);
  }
  return !attemptState.solvedIds.has(questionId);
}

function matchesLocalOgcodeQuestion(
  question: StoredQuestion,
  filters: OgcodeQuestionListFilters,
  attemptState: OgcodeAttemptState,
): boolean {
  const subject = filters.subject ? normalizeSubject(filters.subject) : null;
  const difficulty = filters.difficulty ? normalizeDifficulty(filters.difficulty) : null;
  const type = filters.type ? String(filters.type).trim().toLowerCase() : null;
  const chapters = normalizeOgcodeChaptersFilter(filters.chapters);
  const status = normalizeOgcodeStatusFilter(filters.status);

  if (subject && question.subject !== subject) {
    return false;
  }
  if (difficulty && question.difficulty !== difficulty) {
    return false;
  }
  if (type && question.questionType !== type) {
    return false;
  }
  if (chapters.length && !chapters.includes(question.chapter)) {
    return false;
  }
  if (!matchesOgcodeSearch(question, filters.search)) {
    return false;
  }
  return matchesOgcodeStatus(question.id, status, attemptState);
}

function serializeOgcodeQuestionPreview(
  question: StoredQuestion,
  attemptState: OgcodeAttemptState,
): PracticeQuestion {
  const attempted = attemptState.attemptedIds.has(question.id);
  const isSolved = attemptState.solvedIds.has(question.id);

  return {
    id: question.id,
    text: question.text,
    difficulty: question.difficulty,
    subject: question.subject,
    concept: question.concept,
    chapter: question.chapter,
    isSolved,
    status: isSolved ? "solved" : attempted ? "attempted" : "unattempted",
    attempted,
    questionType: question.questionType,
    tags: question.tags ?? undefined,
    frequency: question.frequency,
    acceptance_rate: Number(question.acceptanceRate.toFixed(1)),
  };
}

function clampOgcodePageSize(limit: number | null | undefined): number {
  if (!Number.isFinite(limit)) {
    return 60;
  }

  return Math.min(120, Math.max(1, Math.trunc(limit as number)));
}

function testById(store: AppStore, testId: string): StoredTest {
  const test = store.tests.find((entry) => entry.id === testId);
  if (!test) {
    throw new Error(`Test ${testId} was not found.`);
  }
  return test;
}

function computeAveragePercentage(results: StoredTestResult[]): number | null {
  if (!results.length) {
    return null;
  }
  const average = results.reduce((sum, result) => sum + result.percentage, 0) / results.length;
  return Math.round(average);
}

export function serializeQuestion(
  store: AppStore,
  userId: string,
  question: StoredQuestion,
  options: SerializeQuestionOptions = true,
) {
  const { includeCorrectFields, presentationContext } = normalizeSerializeQuestionOptions(options);
  const attempts = store.practiceAttempts.filter(
    (attempt) => attempt.userId === userId && attempt.questionId === question.id,
  );
  const isSolved = attempts.some((attempt) => attempt.isCorrect);
  const isAttempted = attempts.length > 0;
  const presented =
    presentationContext && isPresentedChoiceQuestion(question)
      ? presentOptions(question.options, {
          userId,
          scope: presentationContext.scope,
          assessmentId: presentationContext.assessmentId,
          questionId: question.id,
          attemptKey: presentationContext.attemptKey,
        })
      : { options: question.options ?? undefined, presentationId: undefined };
  const matrixData = question.matrixData
    ? {
        ...question.matrixData,
        correct_pairs: includeCorrectFields ? question.matrixData.correct_pairs : [],
      }
    : undefined;

  const base = {
    id: question.id,
    text: question.text,
    options: presented.options,
    presentationId: presented.presentationId,
    presentation_id: presented.presentationId,
    correctOption: includeCorrectFields ? question.correctOption : undefined,
    correct_option: includeCorrectFields ? question.correctOption : undefined,
    correctOptions: includeCorrectFields ? question.correctOptions : undefined,
    correct_options: includeCorrectFields ? question.correctOptions : undefined,
    answerText: includeCorrectFields ? question.answerText : undefined,
    answer_text: includeCorrectFields ? question.answerText : undefined,
    matrixData: matrixData,
    matrix_data: matrixData,
    explanation: includeCorrectFields ? question.explanation : undefined,
    hint: question.hint ?? undefined,
    subject: question.subject,
    chapter: question.chapter,
    concept: question.concept,
    difficulty: question.difficulty,
    image: question.image ?? undefined,
    tags: question.tags ?? undefined,
    questionType: question.questionType,
    question_type: question.questionType,
    acceptanceRate: Number(question.acceptanceRate.toFixed(1)),
    acceptance_rate: Number(question.acceptanceRate.toFixed(1)),
    totalCorrect: question.totalCorrect,
    total_correct: question.totalCorrect,
    frequency: question.frequency,
    attempted: isAttempted,
    attemptCount: attempts.length,
    attempt_count: attempts.length,
    isSolved: isSolved,
    status: isSolved ? "solved" : isAttempted ? "attempted" : "unattempted",
  };

  return base;
}

function resolveStoredAssessmentQuestions(
  store: AppStore,
  questionIds: string[],
  declaredTotalQuestions?: number | null,
) {
  const questionMap = new Map(store.questions.map((question) => [question.id, question]));
  const questions = questionIds
    .map((questionId) => questionMap.get(questionId))
    .filter((question): question is StoredQuestion => Boolean(question));
  const metadata = validateResolvedAssessmentQuestions({
    declaredTotalQuestions,
    questionIds,
    resolvedQuestionIds: questions.map((question) => question.id),
  });
  return { questions, metadata };
}

type ResolutionMetadataPayload = {
  totalQuestions: number;
  total_questions: number;
  declaredTotalQuestions: number | null;
  declared_total_questions: number | null;
  missingQuestionIds: string[];
  missing_question_ids: string[];
  degraded: boolean;
  degradedReason: string | null;
  degraded_reason: string | null;
};

function attachResolutionMetadata<T extends Record<string, unknown>>(
  payload: T,
  metadata: AssessmentResolutionMetadata,
): T & ResolutionMetadataPayload {
  return {
    ...payload,
    totalQuestions: metadata.resolvedTotalQuestions,
    total_questions: metadata.resolvedTotalQuestions,
    declaredTotalQuestions: metadata.declaredTotalQuestions,
    declared_total_questions: metadata.declaredTotalQuestions,
    missingQuestionIds: metadata.missingQuestionIds,
    missing_question_ids: metadata.missingQuestionIds,
    degraded: metadata.degraded,
    degradedReason: metadata.degradedReason,
    degraded_reason: metadata.degradedReason,
  };
}

export function serializeTest(store: AppStore, userId: string, test: StoredTest) {
  const results = store.testResults
    .filter((result) => result.userId === userId && result.testId === test.id)
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  const isCustom = Boolean(test.createdBy);
  const presentationContext: QuestionPresentationContext = {
    scope: isCustom ? "custom-test" : "test",
    assessmentId: test.id,
    attemptKey: String(results.length + 1),
  };
  const resolved = resolveStoredAssessmentQuestions(store, test.questionIds, test.totalQuestions);
  const questions = resolved.questions.map((question) =>
    serializeQuestion(store, userId, question, {
      includeCorrectFields: false,
      presentationContext,
    }),
  );
  const averageScore = computeAveragePercentage(results);
  const allScores = results.map((result) => result.percentage);

  return attachResolutionMetadata({
    id: test.id,
    title: test.title,
    description: test.description,
    subject: test.subject,
    chapter: test.chapter ?? undefined,
    difficulty: test.difficulty,
    duration: test.duration,
    isPremium: test.isPremium,
    is_premium: test.isPremium,
    isCustom,
    is_custom: isCustom,
    questions,
    attempted: results.length > 0,
    score: averageScore,
    attemptCount: results.length,
    attempt_count: results.length,
    allScores,
    all_scores: allScores,
  }, resolved.metadata);
}

export function serializeTestPreview(store: AppStore, userId: string, test: StoredTest) {
  const results = store.testResults
    .filter((result) => result.userId === userId && result.testId === test.id)
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  const averageScore = computeAveragePercentage(results);
  const allScores = results.map((result) => result.percentage);
  const isCustom = Boolean(test.createdBy);
  const resolved = resolveStoredAssessmentQuestions(store, test.questionIds, test.totalQuestions);

  return attachResolutionMetadata({
    id: test.id,
    title: test.title,
    description: test.description,
    subject: test.subject,
    chapter: test.chapter ?? undefined,
    difficulty: test.difficulty,
    duration: test.duration,
    isPremium: test.isPremium,
    is_premium: test.isPremium,
    isCustom,
    is_custom: isCustom,
    attempted: results.length > 0,
    score: averageScore ?? undefined,
    attemptCount: results.length,
    attempt_count: results.length,
    allScores,
    all_scores: allScores,
  }, resolved.metadata);
}

export function serializeResult(result: StoredTestResult) {
  return {
    id: result.id,
    testId: result.testId,
    test_id: result.testId,
    score: result.score,
    percentage: result.percentage,
    correctAnswers: result.correctAnswers,
    correct_answers: result.correctAnswers,
    wrongAnswers: result.wrongAnswers,
    wrong_answers: result.wrongAnswers,
    unattempted: result.unattempted,
    timeTaken: result.timeTaken,
    time_taken: result.timeTaken,
    answers: result.answers,
    weakAreas: result.weakAreas,
    weak_areas: result.weakAreas,
    strongAreas: result.strongAreas,
    strong_areas: result.strongAreas,
    aiAnalysis: result.aiAnalysis,
    ai_analysis: result.aiAnalysis,
    subjectStats: result.subjectStats,
    subject_stats: result.subjectStats,
    isMalpractice: result.isMalpractice,
    is_malpractice: result.isMalpractice,
    degraded: result.degraded ?? false,
    degradedReason: result.degradedReason ?? null,
    degraded_reason: result.degradedReason ?? null,
    analysisStatus: "complete",
    analysis_status: "complete",
    analysisError: null,
    analysis_error: null,
    createdAt: result.createdAt,
    created_at: result.createdAt,
  };
}

async function serializePersistedCustomTest(
  store: AppStore,
  userId: string,
  test: PersistedCustomTestRecord,
) {
  const questionLookup = await buildQuestionLookup(store, test.questionIds);
  return serializePersistedCustomTestWithLookup(store, userId, test, questionLookup);
}

function serializePersistedCustomTestWithLookup(
  store: AppStore,
  userId: string,
  test: PersistedCustomTestRecord,
  questionLookup: Map<string, StoredQuestion>,
) {
  const presentationContext: QuestionPresentationContext = {
    scope: "custom-test",
    assessmentId: test.id,
    attemptKey: String(test.attemptCount + 1),
  };
  const questions = test.questionIds
    .map((questionId) => questionLookup.get(questionId))
    .filter((question): question is StoredQuestion => Boolean(question))
    .map((question) =>
      serializeQuestion(store, userId, question, {
        includeCorrectFields: false,
        presentationContext,
      }),
    );
  const metadata = validateResolvedAssessmentQuestions({
    declaredTotalQuestions: test.questionCount,
    questionIds: test.questionIds,
    resolvedQuestionIds: questions.map((question) => question.id),
  });

  return attachResolutionMetadata({
    id: test.id,
    title: test.title,
    description: test.description,
    subject: test.subject,
    chapter: test.chapter ?? undefined,
    difficulty: test.difficulty,
    duration: test.durationMinutes,
    isPremium: false,
    is_premium: false,
    isCustom: true,
    is_custom: true,
    questions,
    attempted: test.attemptCount > 0,
    score: test.averageScore,
    attemptCount: test.attemptCount,
    attempt_count: test.attemptCount,
    allScores: test.allScores,
    all_scores: test.allScores,
    focusTopics: test.focusTopics,
    focus_topics: test.focusTopics,
    generationSummary: test.generationSummary,
    generation_summary: test.generationSummary,
    recommendedTimePerQuestionSeconds: test.recommendedTimePerQuestionSeconds,
    recommended_time_per_question_seconds: test.recommendedTimePerQuestionSeconds,
    createdAt: test.createdAt,
    created_at: test.createdAt,
  }, metadata);
}

function serializePersistedCustomTestPreview(test: PersistedCustomTestRecord, resolvedQuestionIds = test.questionIds) {
  const metadata = validateResolvedAssessmentQuestions({
    declaredTotalQuestions: test.questionCount,
    questionIds: test.questionIds,
    resolvedQuestionIds,
  });

  return attachResolutionMetadata({
    id: test.id,
    title: test.title,
    description: test.description,
    subject: test.subject,
    chapter: test.chapter ?? undefined,
    difficulty: test.difficulty,
    duration: test.durationMinutes,
    isPremium: false,
    is_premium: false,
    isCustom: true,
    is_custom: true,
    attempted: test.attemptCount > 0,
    score: test.averageScore ?? undefined,
    attemptCount: test.attemptCount,
    attempt_count: test.attemptCount,
    allScores: test.allScores,
    all_scores: test.allScores,
  }, metadata);
}

function serializePersistedResult(result: PersistedTestResultRecord) {
  return {
    id: result.id,
    testId: result.testId,
    test_id: result.testId,
    score: result.score,
    percentage: result.percentage,
    correctAnswers: result.correctAnswers,
    correct_answers: result.correctAnswers,
    wrongAnswers: result.wrongAnswers,
    wrong_answers: result.wrongAnswers,
    unattempted: result.unattempted,
    timeTaken: result.timeTaken,
    time_taken: result.timeTaken,
    answers: result.answers,
    weakAreas: result.weakAreas,
    weak_areas: result.weakAreas,
    strongAreas: result.strongAreas,
    strong_areas: result.strongAreas,
    aiAnalysis: result.aiAnalysis,
    ai_analysis: result.aiAnalysis,
    subjectStats: result.subjectStats,
    subject_stats: result.subjectStats,
    isMalpractice: result.isMalpractice,
    is_malpractice: result.isMalpractice,
    degraded: result.degraded ?? false,
    degradedReason: result.degradedReason ?? null,
    degraded_reason: result.degradedReason ?? null,
    analysisStatus: result.analysisStatus ?? "complete",
    analysis_status: result.analysisStatus ?? "complete",
    analysisError: result.analysisError ?? null,
    analysis_error: result.analysisError ?? null,
    createdAt: result.createdAt,
    created_at: result.createdAt,
  };
}

async function serializePersistedDppPlan(
  store: AppStore,
  userId: string,
  plan: PersistedDppPlanRecord,
  latestAttempt: PersistedDppAttemptRecord | null,
) {
  const lookup = await buildQuestionLookup(store, plan.questionIds);
  return serializePersistedDppPlanWithLookup(store, userId, plan, latestAttempt, lookup);
}

function serializePersistedDppPlanWithLookup(
  store: AppStore,
  userId: string,
  plan: PersistedDppPlanRecord,
  latestAttempt: PersistedDppAttemptRecord | null,
  lookup: Map<string, StoredQuestion>,
) {
  const presentationContext: QuestionPresentationContext = {
    scope: "dpp",
    assessmentId: plan.id,
    attemptKey: latestAttempt?.id ?? "first",
  };
  const questions = plan.questionIds
    .map((questionId) => lookup.get(questionId))
    .filter((question): question is StoredQuestion => Boolean(question))
    .map((question) =>
      serializeQuestion(store, userId, question, {
        includeCorrectFields: false,
        presentationContext,
      }),
    );

  return {
    id: plan.id,
    title: plan.title,
    subject: plan.subject,
    summary: plan.summary,
    questions,
    generatedFrom: plan.generatedFrom,
    generated_from: plan.generatedFrom,
    createdAt: plan.createdAt,
    created_at: plan.createdAt,
    completed: plan.completed,
    weakTopics: plan.weakTopics,
    weak_topics: plan.weakTopics,
    duration: plan.durationMinutes,
    duration_minutes: plan.durationMinutes,
    targetQuestionCount: plan.targetQuestionCount,
    target_question_count: plan.targetQuestionCount,
    sequence: plan.sequence,
    latestAttempt: latestAttempt
      ? {
          id: latestAttempt.id,
          summary: latestAttempt.summary,
          recommendations: latestAttempt.recommendations,
          resolvedTopics: latestAttempt.resolvedTopics,
          resolved_topics: latestAttempt.resolvedTopics,
          stillWeakTopics: latestAttempt.stillWeakTopics,
          still_weak_topics: latestAttempt.stillWeakTopics,
          progressScore: latestAttempt.progressScore,
          progress_score: latestAttempt.progressScore,
          completed: latestAttempt.completed,
          analysisStatus: latestAttempt.analysisStatus ?? "complete",
          analysis_status: latestAttempt.analysisStatus ?? "complete",
          analysisError: latestAttempt.analysisError ?? null,
          analysis_error: latestAttempt.analysisError ?? null,
          createdAt: latestAttempt.createdAt,
          created_at: latestAttempt.createdAt,
        }
      : null,
  };
}

function listTestsFallback(store: AppStore, user: StoredUser) {
  return store.tests.map((test) => serializeTest(store, user.id, test));
}

function listTestPreviewsFallback(store: AppStore, user: StoredUser) {
  return store.tests.map((test) => serializeTestPreview(store, user.id, test));
}

function getTestDetailFallback(store: AppStore, user: StoredUser, testId: string) {
  return serializeTest(store, user.id, testById(store, testId));
}

function createCustomTestFallback(
  store: AppStore,
  user: StoredUser,
  payload: CustomTestPayload,
) {
  const subject = (payload.subject ?? "mixed").toLowerCase();
  const difficultyValue = (payload.difficulty ?? "medium").toLowerCase();
  const difficulty = difficultyValue === "all" ? null : normalizeDifficulty(difficultyValue);
  const chapter = (payload.chapter ?? "").trim().toLowerCase();
  const questionCount = Math.max(1, Number(payload.question_count ?? 10));

  const candidates = store.questions.filter((question) => {
    const matchesSubject = subject === "all" || subject === "mixed" || question.subject === normalizeSubject(subject);
    const matchesDifficulty = !difficulty || question.difficulty === difficulty;
    const matchesChapter = !chapter || question.chapter.toLowerCase().includes(chapter);
    return matchesSubject && matchesDifficulty && matchesChapter;
  });

  if (!candidates.length) {
    throw new Error("No questions matched that custom test configuration.");
  }

  const selected = candidates.slice(0, Math.min(questionCount, candidates.length));
  const newTest: StoredTest = {
    id: createId("test"),
    title: `${subject === "all" || subject === "mixed" ? "Mixed" : subject[0].toUpperCase() + subject.slice(1)} Custom Test`,
    description: chapter ? `Custom practice set focused on ${chapter}.` : "Custom practice set generated from the question bank.",
    subject: subject === "all" || subject === "mixed" ? "mixed" : normalizeSubject(subject),
    chapter: chapter || null,
    difficulty: difficulty ?? "medium",
    duration: Math.max(10, selected.length * 3),
    totalQuestions: selected.length,
    isPremium: false,
    questionIds: selected.map((question) => question.id),
    createdBy: user.id,
  };

  store.tests.unshift(newTest);
  return serializeTest(store, user.id, newTest);
}

function submitTestFallback(store: AppStore, user: StoredUser, testId: string, payload: TestSubmissionPayload) {
  const test = testById(store, testId);
  const presentationContext: QuestionPresentationContext = {
    scope: test.createdBy ? "custom-test" : "test",
    assessmentId: test.id,
    attemptKey: "legacy-submit",
  };
  const submittedAnswers = payload.answers ?? [];
  const answersMap = new Map<string, StoredUserAnswer>();
  submittedAnswers.forEach((rawAnswer) => {
    const normalized = normalizeAnswer(rawAnswer);
    if (normalized.questionId) {
      answersMap.set(normalized.questionId, normalized);
    }
  });

  let correctAnswers = 0;
  let wrongAnswers = 0;
  let unattempted = 0;
  let score = 0;
  const topicStats: Record<string, { correct: number; total: number }> = {};
  const subjectStats: Record<
    string,
    {
      correct: number;
      incorrect: number;
      unattempted: number;
      total: number;
      timeCorrect: number;
      timeIncorrect: number;
      timeUnattempted: number;
    }
  > = {};
  const userAnswers: StoredUserAnswer[] = [];

  for (const questionId of test.questionIds) {
    const question = questionById(store, questionId);
    const rawAnswer = answersMap.get(questionId) ?? {
      questionId,
      selectedOption: null,
      selectedOptions: null,
      matrixPairs: null,
      answerText: null,
      timeSpent: 0,
      isMarkedForReview: false,
    };
    const { answer } = remapPresentedAnswer(user.id, question, rawAnswer, presentationContext);

    if (!topicStats[question.concept]) {
      topicStats[question.concept] = { correct: 0, total: 0 };
    }
    topicStats[question.concept].total += 1;

    if (!subjectStats[question.subject]) {
      subjectStats[question.subject] = {
        correct: 0,
        incorrect: 0,
        unattempted: 0,
        total: 0,
        timeCorrect: 0,
        timeIncorrect: 0,
        timeUnattempted: 0,
      };
    }
    subjectStats[question.subject].total += 1;

    const grade = gradeAnswer(question, answer, "test");
    const { isCorrect } = grade;
    const answered = hasResponse(answer);
    score += grade.marksAwarded ?? (isCorrect ? 4 : answered ? -1 : 0);

    if (isCorrect) {
      correctAnswers += 1;
      topicStats[question.concept].correct += 1;
      subjectStats[question.subject].correct += 1;
      subjectStats[question.subject].timeCorrect += answer.timeSpent;
      question.totalCorrect += 1;
    } else if (!answered) {
      unattempted += 1;
      subjectStats[question.subject].unattempted += 1;
      subjectStats[question.subject].timeUnattempted += answer.timeSpent;
    } else {
      wrongAnswers += 1;
      subjectStats[question.subject].incorrect += 1;
      subjectStats[question.subject].timeIncorrect += answer.timeSpent;
    }

    question.frequency += 1;
    question.acceptanceRate = question.frequency > 0 ? (question.totalCorrect / question.frequency) * 100 : 0;
    userAnswers.push(answer);
  }

  const totalMarks = test.totalQuestions * 4;
  const percentage = totalMarks > 0 ? Math.max(0, Math.round((score / totalMarks) * 100)) : 0;

  const strongAreas: TopicAccuracy[] = [];
  const weakAreas: TopicAccuracy[] = [];
  Object.entries(topicStats).forEach(([topic, stats]) => {
    const accuracy = Math.round((stats.correct / stats.total) * 100);
    const row = { topic, accuracy };
    if (accuracy > 50) {
      strongAreas.push(row);
    } else {
      weakAreas.push(row);
    }
  });
  strongAreas.sort((left, right) => right.accuracy - left.accuracy);
  weakAreas.sort((left, right) => right.accuracy - left.accuracy);

  const finalSubjectStats: StoredTestResult["subjectStats"] = {};
  Object.entries(subjectStats).forEach(([subject, stats]) => {
    const subScore = stats.correct * 4 - stats.incorrect;
    finalSubjectStats[subject] = {
      score: subScore,
      total_marks: stats.total * 4,
      correct: stats.correct,
      incorrect: stats.incorrect,
      unattempted: stats.unattempted,
      total_qs: stats.total,
      accuracy:
        stats.correct + stats.incorrect > 0
          ? Math.round((stats.correct / (stats.correct + stats.incorrect)) * 100)
          : 0,
      time_spent_correct: stats.timeCorrect,
      time_spent_incorrect: stats.timeIncorrect,
      time_spent_unattempted: stats.timeUnattempted,
      total_time_spent: stats.timeCorrect + stats.timeIncorrect + stats.timeUnattempted,
    };
  });

  const reviewEntries: ReviewEntry[] = userAnswers.flatMap((answer) => {
    const question = questionById(store, answer.questionId);
    const grade = gradeAnswer(question, answer);
    if (!hasResponse(answer)) {
      return [];
    }
    return [
      {
        questionId: question.id,
        concept: question.concept,
        status: grade.isCorrect ? ("correct" as const) : ("incorrect" as const),
        error: grade.isCorrect ? "Well Solved / Confirmed" : "Conceptual / Calculation",
        explanation: question.explanation,
        howToApproach: grade.isCorrect
          ? `Keep reinforcing ${question.concept} with one more ${question.difficulty} level problem to lock in the method.`
          : `Review ${question.concept} and repeat ${question.difficulty} level problems.`,
      },
    ];
  });
  const mistakes = reviewEntries
    .filter((entry) => entry.status === "incorrect")
    .map(({ status: _status, ...entry }) => entry);

  const aiSummary =
    correctAnswers > test.totalQuestions / 2
      ? "Good attempt!"
      : "Needs improvement.";

  const result: StoredTestResult = {
    id: createId("result"),
    userId: user.id,
    testId: test.id,
    score,
    percentage,
    correctAnswers,
    wrongAnswers,
    unattempted,
    timeTaken: payload.timeTaken ?? payload.time_taken ?? 0,
    weakAreas,
    strongAreas,
    aiAnalysis: {
      summary:
        weakAreas.length > 0
          ? `${aiSummary} Focus on ${weakAreas.slice(0, 2).map((row) => row.topic).join(", ")}.`
          : aiSummary,
      mistakes,
      reviewEntries,
      recommendations: [
        `Review the ${mistakes.length} answered questions you missed.`,
        "Focus on accuracy before speed.",
        "Repeat one mixed practice set after reviewing the explanations.",
      ],
      dppGenerated: false,
    },
    subjectStats: finalSubjectStats,
    isMalpractice: Boolean(payload.isMalpractice ?? payload.is_malpractice),
    createdAt: new Date().toISOString(),
    answers: userAnswers,
  };

  store.testResults.unshift(result);

  updateUserStreak(store, user.id);
  updateUserStudyTime(user, result.timeTaken);
  const dailyActivity = getOrCreateDailyActivity(store, user.id);
  dailyActivity.questionsPracticed += correctAnswers + wrongAnswers;
  if (score > 0) {
    awardPoints(store, user.id, score, "practice", `Completed test: ${test.title}`, result.id);
  }

  return serializeResult(result);
}

function listTestResultsFallback(store: AppStore, user: StoredUser, testId: string) {
  return store.testResults
    .filter((result) => result.userId === user.id && result.testId === testId)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .map(serializeResult);
}

function getSingleResultFallback(store: AppStore, user: StoredUser, resultId: string) {
  const result = store.testResults.find((entry) => entry.id === resultId && entry.userId === user.id);
  if (!result) {
    throw new Error(`Result ${resultId} was not found.`);
  }
  return serializeResult(result);
}

async function buildAnalyticsAttempts(
  store: AppStore,
  userId: string,
  questionIds: string[],
  answersMap: Map<string, StoredUserAnswer>,
  presentationContext: Pick<QuestionPresentationContext, "scope" | "assessmentId">,
  sourceType: AssessmentSourceType,
) {
  const questionLookup = await buildQuestionLookup(store, questionIds);
  const resolvedQuestionIds = questionIds.filter((questionId) => questionLookup.has(questionId));
  const preparedRows = resolvedQuestionIds.map((questionId) => {
    const question = questionLookup.get(questionId)!;
    const rawAnswer = answersMap.get(questionId) ?? {
      questionId,
      selectedOption: null,
      selectedOptions: null,
      matrixPairs: null,
      answerText: null,
      timeSpent: 0,
      isMarkedForReview: false,
    };
    const { answer } = remapPresentedAnswer(userId, question, rawAnswer, presentationContext);
    return { question, answer };
  });

  let remoteGrades: AssessmentBatchGradeResult[] | null = null;
  try {
    remoteGrades = await gradeAssessmentBatchWithService({
      userId,
      assessmentId: presentationContext.assessmentId,
      assessmentType: sourceType,
      scoringPolicy: DEFAULT_TEST_SCORING_POLICY,
      items: preparedRows.map(({ question, answer }) => ({
        question,
        answer,
        attemptRef: question.id,
        scoringPolicy: scoringPolicyForQuestion(question, sourceType),
      })),
    });
  } catch (error) {
    if (error instanceof GraderContractError) {
      throw error;
    }
    remoteGrades = null;
  }
  const remoteGradeMap = new Map((remoteGrades ?? []).map((grade) => [grade.questionId, grade]));

  const gradedAttempts: AnalyticsGradedAttempt[] = [];
  let correctAnswers = 0;
  let wrongAnswers = 0;
  let unattempted = 0;
  let score = 0;
  let totalMarks = 0;
  const userAnswers: StoredUserAnswer[] = [];
  const subjectStats: Record<
    string,
    {
      score: number;
      totalMarks: number;
      correct: number;
      incorrect: number;
      unattempted: number;
      total: number;
      timeCorrect: number;
      timeIncorrect: number;
      timeUnattempted: number;
    }
  > = {};

  for (const { question, answer } of preparedRows) {
    if (!subjectStats[question.subject]) {
      subjectStats[question.subject] = {
        score: 0,
        totalMarks: 0,
        correct: 0,
        incorrect: 0,
        unattempted: 0,
        total: 0,
        timeCorrect: 0,
        timeIncorrect: 0,
        timeUnattempted: 0,
      };
    }

    subjectStats[question.subject].total += 1;
    const answered = hasResponse(answer);
    const grade = remoteGradeMap.get(question.id) ?? gradeAnswer(question, answer, sourceType);
    const isCorrect = grade.isCorrect;
    const policy = scoringPolicyForQuestion(question, sourceType);
    const maxMarks = grade.maxMarks ?? policy.correctMarks;
    const marksAwarded = grade.marksAwarded ?? computeMarksFromCredit({
      answered,
      isCorrect,
      creditAwarded: grade.creditAwarded,
      policy,
    });
    const creditAwarded = grade.creditAwarded ?? (isCorrect ? 1 : 0);

    totalMarks += maxMarks;
    score += marksAwarded;
    subjectStats[question.subject].score += marksAwarded;
    subjectStats[question.subject].totalMarks += maxMarks;

    if (isCorrect) {
      correctAnswers += 1;
      subjectStats[question.subject].correct += 1;
      subjectStats[question.subject].timeCorrect += answer.timeSpent;
      question.totalCorrect += 1;
    } else if (answered) {
      wrongAnswers += 1;
      subjectStats[question.subject].incorrect += 1;
      subjectStats[question.subject].timeIncorrect += answer.timeSpent;
    } else {
      unattempted += 1;
      subjectStats[question.subject].unattempted += 1;
      subjectStats[question.subject].timeUnattempted += answer.timeSpent;
    }

    question.frequency += 1;
    question.acceptanceRate = question.frequency > 0 ? (question.totalCorrect / question.frequency) * 100 : 0;

    gradedAttempts.push({
      question_id: question.id,
      subject: question.subject,
      chapter: question.chapter,
      concept: question.concept,
      difficulty: question.difficulty,
      question_type: question.questionType,
      answered,
      is_correct: isCorrect,
      credit_awarded: creditAwarded,
      marks_awarded: marksAwarded,
      max_marks: maxMarks,
      needs_review: Boolean(grade.needsReview ?? grade.info.needsReview ?? grade.info.needs_review),
      grading_source: grade.evaluationSource ?? String(grade.info.evaluationSource ?? grade.info.evaluation_source ?? "local_fallback"),
      scoring_policy: {
        correct_marks: policy.correctMarks,
        incorrect_marks: policy.incorrectMarks,
        unattempted_marks: policy.unattemptedMarks,
        partial_credit_policy: policy.partialCreditPolicy,
        negative_marking_mode: policy.negativeMarkingMode,
      },
      time_spent_seconds: answer.timeSpent,
    });
    userAnswers.push(answer);
  }

  const finalSubjectStats: StoredTestResult["subjectStats"] = {};
  Object.entries(subjectStats).forEach(([subject, stats]) => {
    finalSubjectStats[subject] = {
      score: Number(stats.score.toFixed(3)),
      total_marks: Number(stats.totalMarks.toFixed(3)),
      correct: stats.correct,
      incorrect: stats.incorrect,
      unattempted: stats.unattempted,
      total_qs: stats.total,
      accuracy:
        stats.correct + stats.incorrect > 0
          ? Math.round((stats.correct / (stats.correct + stats.incorrect)) * 100)
          : 0,
      time_spent_correct: stats.timeCorrect,
      time_spent_incorrect: stats.timeIncorrect,
      time_spent_unattempted: stats.timeUnattempted,
      total_time_spent: stats.timeCorrect + stats.timeIncorrect + stats.timeUnattempted,
    };
  });

  return {
    gradedAttempts,
    correctAnswers,
    wrongAnswers,
    unattempted,
    score: Number(score.toFixed(3)),
    totalMarks: Number(totalMarks.toFixed(3)),
    subjectStats: finalSubjectStats,
    userAnswers,
    questionLookup,
    resolvedQuestionIds,
    missingQuestionIds: questionIds.filter((questionId) => !questionLookup.has(questionId)),
    gradeByQuestionId: new Map(
      gradedAttempts.map((attempt) => [
        attempt.question_id,
        {
          isCorrect: attempt.is_correct,
          marksAwarded: attempt.marks_awarded,
          creditAwarded: attempt.credit_awarded,
          needsReview: attempt.needs_review ?? false,
        },
      ]),
    ),
  };
}

function buildMistakesFromAnswers(
  questionLookup: Map<string, StoredQuestion>,
  answers: StoredUserAnswer[],
) {
  return buildReviewEntriesFromAnswers(questionLookup, answers)
    .filter((entry) => entry.status === "incorrect")
    .map(({ status: _status, ...entry }) => entry);
}

function buildReviewEntriesFromAnswers(
  questionLookup: Map<string, StoredQuestion>,
  answers: StoredUserAnswer[],
  gradeByQuestionId?: Map<string, { isCorrect: boolean }>,
): ReviewEntry[] {
  return answers.flatMap((answer) => {
    const question = questionLookup.get(answer.questionId);
    if (!question) {
      return [];
    }
    const grade = gradeByQuestionId?.get(answer.questionId) ?? gradeAnswer(question, answer);
    if (!hasResponse(answer)) {
      return [];
    }
    return [
      {
        questionId: question.id,
        concept: question.concept,
        status: grade.isCorrect ? ("correct" as const) : ("incorrect" as const),
        error: grade.isCorrect ? "Well Solved / Confirmed" : "Conceptual / Calculation",
        explanation: question.explanation,
        howToApproach: grade.isCorrect
          ? `Keep reinforcing ${question.concept} with one more ${question.difficulty} level problem to lock in the method.`
          : `Review ${question.concept} and repeat ${question.difficulty} level problems.`,
      },
    ];
  });
}

function buildTopicAccuracyFromAttempts(gradedAttempts: AnalyticsGradedAttempt[]) {
  const topicStats = new Map<string, { correct: number; total: number }>();
  for (const attempt of gradedAttempts) {
    const topic = attempt.concept || attempt.chapter || attempt.subject;
    const current = topicStats.get(topic) ?? { correct: 0, total: 0 };
    current.total += 1;
    if (attempt.is_correct) {
      current.correct += 1;
    }
    topicStats.set(topic, current);
  }

  const strongAreas: TopicAccuracy[] = [];
  const weakAreas: TopicAccuracy[] = [];
  for (const [topic, stats] of topicStats.entries()) {
    const accuracy = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0;
    const row = { topic, accuracy };
    if (accuracy > 50) {
      strongAreas.push(row);
    } else {
      weakAreas.push(row);
    }
  }

  strongAreas.sort((left, right) => right.accuracy - left.accuracy);
  weakAreas.sort((left, right) => left.accuracy - right.accuracy);
  return { strongAreas, weakAreas };
}

function severityFromAccuracy(accuracy: number): AnalyticsTopicSignal["severity"] {
  if (accuracy < 35) {
    return "high";
  }
  if (accuracy < 60) {
    return "medium";
  }
  return "low";
}

function buildLocalTopicSignals(gradedAttempts: AnalyticsGradedAttempt[]) {
  const grouped = new Map<
    string,
    {
      subject: string;
      chapter: string;
      concept: string;
      correct: number;
      total: number;
      totalTime: number;
    }
  >();

  for (const attempt of gradedAttempts) {
    const topic = attempt.concept || attempt.chapter || attempt.subject;
    const current = grouped.get(topic) ?? {
      subject: attempt.subject,
      chapter: attempt.chapter,
      concept: attempt.concept,
      correct: 0,
      total: 0,
      totalTime: 0,
    };
    current.total += 1;
    current.totalTime += attempt.time_spent_seconds;
    if (attempt.is_correct) {
      current.correct += 1;
    }
    grouped.set(topic, current);
  }

  const weakTopics: AnalyticsTopicSignal[] = [];
  const strongTopics: AnalyticsTopicSignal[] = [];

  for (const [topic, stats] of grouped.entries()) {
    const accuracy = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0;
    const mastery = Math.max(0, Math.min(1, accuracy / 100));
    const signal: AnalyticsTopicSignal = {
      topic,
      subject: stats.subject,
      chapter: stats.chapter,
      concept: stats.concept,
      accuracy,
      attempts: stats.total,
      average_time_seconds: stats.total > 0 ? Math.round(stats.totalTime / stats.total) : 0,
      bkt_mastery: mastery,
      expected_correctness: mastery,
      severity: severityFromAccuracy(accuracy),
      anomaly: false,
      recommendation_seed:
        accuracy > 50
          ? `Keep reinforcing ${topic} with spaced practice.`
          : `Review ${topic} and retry similar questions.`,
    };

    if (accuracy > 50) {
      strongTopics.push(signal);
    } else {
      weakTopics.push(signal);
    }
  }

  strongTopics.sort((left, right) => right.accuracy - left.accuracy);
  weakTopics.sort((left, right) => left.accuracy - right.accuracy);
  return { weakTopics, strongTopics };
}

function buildPendingAnalyticsContext(summary: string, weakAreas: TopicAccuracy[], strongAreas: TopicAccuracy[]): AnalyticsContextPayload {
  const latestWeakTopics = weakAreas.map((area) => area.topic).slice(0, 6);
  return {
    summary,
    latest_weak_topics: latestWeakTopics,
    latest_strong_topics: strongAreas.map((area) => area.topic).slice(0, 6),
    recommended_revision_topics: latestWeakTopics.slice(0, 4),
    pending_dpp_focus: latestWeakTopics.slice(0, 4),
  };
}

function buildLocalSubmittedTestResult(input: {
  store: AppStore;
  user: StoredUser;
  testId: string;
  title: string;
  questionCount: number;
  payload: TestSubmissionPayload;
  analytics: Awaited<ReturnType<typeof buildAnalyticsAttempts>>;
  isMalpractice: boolean;
  degraded?: boolean;
  degradedReason?: string;
}) {
  const { strongAreas, weakAreas } = buildTopicAccuracyFromAttempts(input.analytics.gradedAttempts);
  const totalMarks = input.analytics.totalMarks || input.questionCount * 4;
  const percentage = totalMarks > 0 ? Math.max(0, Math.round((input.analytics.score / totalMarks) * 100)) : 0;
  const reviewEntries = buildReviewEntriesFromAnswers(
    input.analytics.questionLookup,
    input.analytics.userAnswers,
    input.analytics.gradeByQuestionId,
  );
  const mistakes = reviewEntries
    .filter((entry) => entry.status === "incorrect")
    .map(({ status: _status, ...entry }) => entry);
  const aiSummary =
    input.analytics.correctAnswers > input.questionCount / 2
      ? "Good attempt!"
      : "Needs improvement.";

  const result: StoredTestResult = {
    id: createId("result"),
    userId: input.user.id,
    testId: input.testId,
    score: input.analytics.score,
    percentage,
    correctAnswers: input.analytics.correctAnswers,
    wrongAnswers: input.analytics.wrongAnswers,
    unattempted: input.analytics.unattempted,
    timeTaken: input.payload.timeTaken ?? input.payload.time_taken ?? 0,
    weakAreas,
    strongAreas,
    aiAnalysis: {
      summary:
        weakAreas.length > 0
          ? `${aiSummary} Focus on ${weakAreas.slice(0, 2).map((row) => row.topic).join(", ")}.`
          : aiSummary,
      mistakes,
      reviewEntries,
      recommendations: [
        `Review the ${mistakes.length} answered questions you missed.`,
        "Focus on accuracy before speed.",
        "Repeat one mixed practice set after reviewing the explanations.",
      ],
      dppGenerated: false,
    },
    subjectStats: input.analytics.subjectStats,
    isMalpractice: input.isMalpractice,
    degraded: input.degraded,
    degradedReason: input.degradedReason,
    createdAt: new Date().toISOString(),
    answers: input.analytics.userAnswers,
  };

  input.store.testResults.unshift(result);

  updateUserStreak(input.store, input.user.id);
  updateUserStudyTime(input.user, result.timeTaken);
  const dailyActivity = getOrCreateDailyActivity(input.store, input.user.id);
  dailyActivity.questionsPracticed += input.analytics.correctAnswers + input.analytics.wrongAnswers;
  if (input.analytics.score > 0) {
    awardPoints(input.store, input.user.id, input.analytics.score, "practice", `Completed test: ${input.title}`, result.id);
  }

  return serializeResult(result);
}

export async function listTests(store: AppStore, user: StoredUser) {
  const seeded = listTestsFallback(store, user);
  try {
    const persisted = await listPersistedCustomTests(user.id);
    const questionLookup = await buildQuestionLookup(
      store,
      persisted.flatMap((test) => test.questionIds),
    );
    const persistedSerialized = persisted.map((test) =>
      serializePersistedCustomTestWithLookup(store, user.id, test, questionLookup),
    );
    const deduped = new Map<
      string,
      Awaited<ReturnType<typeof serializePersistedCustomTest>> | ReturnType<typeof serializeTest>
    >();
    for (const test of [...persistedSerialized, ...seeded]) {
      deduped.set(test.id, test);
    }
    return [...deduped.values()];
  } catch {
    return seeded;
  }
}

export async function listTestPreviews(store: AppStore, user: StoredUser) {
  const gate = await getStudentGate(user.id, user.role);
  // Free students get no tests; premium students get their entitled subjects.
  const gateList = <T extends { subject?: string }>(tests: T[]): T[] =>
    gate.enforced ? tests.filter((test) => subjectVisibleUnderGate(test.subject, gate)) : tests;

  const seeded = listTestPreviewsFallback(store, user);
  try {
    const persisted = await listPersistedCustomTests(user.id);
    const questionLookup = await buildQuestionLookup(
      store,
      persisted.flatMap((test) => test.questionIds),
    );
    const persistedSerialized = persisted.map((test) =>
      serializePersistedCustomTestPreview(
        test,
        test.questionIds.filter((questionId) => questionLookup.has(questionId)),
      ),
    );
    const deduped = new Map<
      string,
      ReturnType<typeof serializePersistedCustomTestPreview> | ReturnType<typeof serializeTestPreview>
    >();
    for (const test of [...persistedSerialized, ...seeded]) {
      deduped.set(test.id, test);
    }
    return withAssignedTeacherTests(user.id, gateList([...deduped.values()]));
  } catch {
    return withAssignedTeacherTests(user.id, gateList(seeded));
  }
}

/**
 * Phase 14: merge teacher-assigned tests (3rd source) into the student's test
 * list. Teacher-assigned tests BYPASS the premium gate (enrollment is the
 * entitlement) and WIN the dedupe over any same-id self/custom entry. Additive
 * and best-effort — a failure here never drops the student's own tests.
 */
async function withAssignedTeacherTests(
  userId: string,
  base: Array<{ id: string }>,
): Promise<unknown[]> {
  if (!isFeatureEnabled("teacherConnect")) return base;
  try {
    const assigned = await listAssignedTestPreviewsForStudent(userId);
    if (assigned.length === 0) return base;
    const byId = new Map<string, unknown>();
    for (const test of base) byId.set(test.id, test);
    for (const a of assigned) {
      byId.set(a.id, {
        id: a.id,
        title: a.title,
        description: a.description ?? "",
        subject: a.subject,
        chapter: a.chapter ?? undefined,
        difficulty: a.difficulty,
        duration: a.durationMinutes,
        totalQuestions: a.totalQuestions,
        isPremium: false,
        is_premium: false,
        isCustom: false,
        is_custom: false,
        attempted: false,
        attemptCount: 0,
        attempt_count: 0,
        allScores: [],
        all_scores: [],
        createdByTeacher: true,
        assignmentId: a.assignmentId,
        workspaceId: a.workspaceId ?? undefined,
        source: "teacher_assigned",
        windowEndsAt: a.windowEndsAt,
      });
    }
    return [...byId.values()];
  } catch {
    return base;
  }
}

/** Build a synthetic persisted-custom-test record from a teacher-assigned test so
 * the existing detail/grade machinery can render and grade it. Question ids span
 * all source banks (ogcode + workspace_bag); buildQuestionLookup resolves each. */
function assignedTeacherTestToRecord(
  userId: string,
  assigned: AssignedTestForStudent,
): PersistedCustomTestRecord {
  const questionIds = assigned.orderedQuestionIds;
  return {
    id: assigned.test.id,
    userId,
    title: assigned.test.title,
    description: assigned.test.description ?? "",
    subject: assigned.test.subject,
    chapter: assigned.test.chapter ?? null,
    difficulty: assigned.test.difficulty,
    durationMinutes: assigned.test.durationMinutes,
    questionCount: questionIds.length || assigned.test.totalQuestions,
    questionIds,
    focusTopics: [],
    generationSummary: "",
    recommendedTimePerQuestionSeconds: 120,
    createdAt: assigned.test.createdAt,
    attemptCount: 0,
    averageScore: null,
    allScores: [],
  };
}

/** A 403-tagged error: a teacher test exists but the student is not a member. */
function teacherTestForbiddenError(): Error {
  const err = new Error("You are not enrolled in the batch for this test.");
  (err as { status?: number }).status = 403;
  return err;
}

export async function getTestDetail(store: AppStore, user: StoredUser, testId: string) {
  const seeded = store.tests.find((entry) => entry.id === testId);
  if (seeded) {
    return serializeTest(store, user.id, seeded);
  }

  const persisted = await getPersistedCustomTest(testId, user.id);
  if (persisted) {
    return serializePersistedCustomTest(store, user.id, persisted);
  }

  // Phase 14: teacher-assigned test — membership re-verified server-side.
  if (isFeatureEnabled("teacherConnect")) {
    const assigned = await getAssignedTestForStudent(user.id, testId);
    if (assigned) {
      return serializePersistedCustomTest(store, user.id, assignedTeacherTestToRecord(user.id, assigned));
    }
    const teacherTest = await getTeacherTestById(testId);
    if (teacherTest) throw teacherTestForbiddenError();
  }

  throw new Error(`Test ${testId} was not found.`);
}

export async function getRoomTestDetail(store: AppStore, user: StoredUser, testId: string) {
  const seeded = store.tests.find((entry) => entry.id === testId);
  if (seeded) {
    return serializeTest(store, user.id, seeded);
  }

  const persisted = await getPersistedCustomTestById(testId);
  if (persisted) {
    return serializePersistedCustomTest(store, user.id, persisted);
  }

  // Phase 14: a teacher room is backed by an assessment.tests id rather than a
  // persisted custom test. Resolve it over the ogcode bank (same synthetic-record
  // machinery as teacher-assigned tests); room membership is the gate (checked by
  // the room engine), so no assignment lookup here.
  if (isFeatureEnabled("teacherConnect")) {
    const roomTeacherTest = await getTeacherTestForRoom(testId);
    if (roomTeacherTest) {
      return serializePersistedCustomTest(store, user.id, assignedTeacherTestToRecord(user.id, roomTeacherTest));
    }
  }

  throw new Error(`Test ${testId} was not found.`);
}

export async function createCustomTest(
  store: AppStore,
  user: StoredUser,
  payload: CustomTestPayload,
) {
  const generatedId = createId("test");
  try {
    const subject = (payload.subject ?? "mixed").toLowerCase();
    const difficultyValue = (payload.difficulty ?? "medium").toLowerCase();
    const difficulty = difficultyValue === "all" ? null : normalizeDifficulty(difficultyValue);
    // These two reads are independent — run them concurrently instead of serially.
    const [recentWeakTopics, attemptedQuestionIds] = await Promise.all([
      getRecentWeakTopicsForUser(user.id),
      getAttemptedQuestionIdsForUser(user.id),
    ]);
    const serviceResponse = await generateCustomTestWithService({
      user_id: user.id,
      subject: subject === "all" ? "mixed" : subject,
      difficulty,
      chapter: payload.chapter?.trim() || null,
      question_count: Math.max(1, Number(payload.question_count ?? 10)),
      recent_weak_topics: recentWeakTopics,
      attempted_question_ids: attemptedQuestionIds,
    });

    if (!serviceResponse) {
      recordAnalyticsFallback({
        scope: "createCustomTest",
        userId: user.id,
        assessmentId: generatedId,
        err: new Error("Analytics service is not configured."),
      });
      return createCustomTestFallback(store, user, payload);
    }

    await persistGeneratedCustomTest({
      id: generatedId,
      userId: user.id,
      subject: serviceResponse.subject,
      chapter: serviceResponse.chapter ?? null,
      difficulty: serviceResponse.difficulty,
      title: serviceResponse.title,
      description: serviceResponse.description,
      questionIds: serviceResponse.question_ids,
      durationMinutes: serviceResponse.duration_minutes,
      focusTopics: serviceResponse.focus_topics,
      generationSummary: serviceResponse.generation_summary,
      recommendedTimePerQuestionSeconds: serviceResponse.recommended_time_per_question_seconds,
    });

    const latest = await getPersistedCustomTest(generatedId, user.id);
    if (!latest) {
      return createCustomTestFallback(store, user, payload);
    }
    return serializePersistedCustomTest(store, user.id, latest);
  } catch (err) {
    recordAnalyticsFallback({
      scope: "createCustomTest",
      userId: user.id,
      assessmentId: generatedId,
      err,
    });
    return createCustomTestFallback(store, user, payload);
  }
}

export async function submitTest(
  store: AppStore,
  user: StoredUser,
  testId: string,
  payload: TestSubmissionPayload,
  options: {
    allowRoomParticipant?: boolean;
    sourceType?: AssessmentSourceType;
    roomId?: string | null;
    // Phase 14: present for teacher-room submissions — the room's cohort, used to
    // tag analytics.test_results so Phase-2E cohort population fires. The room
    // engine has already verified membership, so no assignment gate is applied.
    roomCohort?: { workspaceId: string | null; batchId: string | null } | null;
  } = {},
) {
  const seededTest = store.tests.find((entry) => entry.id === testId);
  let persistedTest = seededTest
    ? null
    : (await getPersistedCustomTest(testId, user.id)) ??
      (options.allowRoomParticipant ? await getPersistedCustomTestById(testId) : null);

  // Phase 14: teacher-assigned test — membership re-verified server-side, then
  // routed through the same persisted path with cohort tags carried to analytics.
  let teacherCohort: { workspaceId: string | null; batchId: string | null; assignmentId: string | null } | null = null;

  // Phase 14 (rooms): a teacher_room submission resolves the assessment.tests id
  // backing the room (no assignment — room membership is the entitlement) and tags
  // the result with the ROOM's cohort. Runs before the assignment branch so a room
  // test isn't mistaken for an unassigned test and 403'd.
  if (!seededTest && !persistedTest && options.allowRoomParticipant && options.roomCohort && isFeatureEnabled("teacherConnect")) {
    const roomTeacherTest = await getTeacherTestForRoom(testId);
    if (roomTeacherTest) {
      persistedTest = assignedTeacherTestToRecord(user.id, roomTeacherTest);
      teacherCohort = {
        workspaceId: options.roomCohort.workspaceId,
        batchId: options.roomCohort.batchId,
        assignmentId: null,
      };
    }
  }

  if (!seededTest && !persistedTest && isFeatureEnabled("teacherConnect")) {
    const assigned = await getAssignedTestForStudent(user.id, testId);
    if (assigned) {
      persistedTest = assignedTeacherTestToRecord(user.id, assigned);
      teacherCohort = {
        workspaceId: assigned.workspaceId,
        batchId: assigned.batchId,
        assignmentId: assigned.assignmentId,
      };
    } else {
      const teacherTest = await getTeacherTestById(testId);
      if (teacherTest) throw teacherTestForbiddenError();
    }
  }

  if (!seededTest && !persistedTest) {
    throw new Error(`Test ${testId} was not found.`);
  }

  const submittedAnswers = payload.answers ?? [];
  const answersMap = new Map<string, StoredUserAnswer>();
  submittedAnswers.forEach((rawAnswer) => {
    const normalized = normalizeAnswer(rawAnswer);
    if (normalized.questionId) {
      answersMap.set(normalized.questionId, normalized);
    }
  });

  const title = seededTest ? seededTest.title : persistedTest!.title;
  const subject = seededTest ? seededTest.subject : persistedTest!.subject;
  const chapter = seededTest ? seededTest.chapter ?? null : persistedTest!.chapter ?? null;
  const difficulty = seededTest ? seededTest.difficulty : normalizeDifficulty(persistedTest!.difficulty);
  const questionIds = seededTest ? seededTest.questionIds : persistedTest!.questionIds;
  const declaredTotalQuestions = seededTest ? seededTest.totalQuestions : persistedTest!.questionCount;
  const sourceType =
    options.sourceType ??
    (options.allowRoomParticipant
      ? "room_test"
      : seededTest?.createdBy
        ? "custom_test"
        : seededTest
          ? "test"
          : "custom_test");

  const isMalpractice = payload.isMalpractice || payload.is_malpractice || false;
  const analytics = await buildAnalyticsAttempts(
    store,
    user.id,
    questionIds,
    answersMap,
    {
      scope: seededTest?.createdBy ? "custom-test" : seededTest ? "test" : "custom-test",
      assessmentId: testId,
    },
    sourceType,
  );
  const resolution = validateResolvedAssessmentQuestions({
    declaredTotalQuestions,
    questionIds,
    resolvedQuestionIds: analytics.resolvedQuestionIds,
  });
  const questionCount = resolution.resolvedTotalQuestions;
  const totalMarks = analytics.totalMarks;
  const percentage = totalMarks > 0 ? Math.max(0, Math.round((analytics.score / totalMarks) * 100)) : 0;
  const reviewEntries = buildReviewEntriesFromAnswers(
    analytics.questionLookup,
    analytics.userAnswers,
    analytics.gradeByQuestionId,
  );
  const mistakes = reviewEntries
    .filter((entry) => entry.status === "incorrect")
    .map(({ status: _status, ...entry }) => entry);

  const aiSummary =
    analytics.correctAnswers > questionCount / 2
      ? "Good attempt!"
      : "Needs improvement.";
  const timeTakenSeconds = payload.timeTaken ?? payload.time_taken ?? 0;
  const { strongAreas, weakAreas } = buildTopicAccuracyFromAttempts(analytics.gradedAttempts);
  const { weakTopics, strongTopics } = buildLocalTopicSignals(analytics.gradedAttempts);
  const localSummaryBase =
    weakAreas.length > 0
      ? `${aiSummary} Detailed analytics are being prepared. Focus first on ${weakAreas
          .slice(0, 2)
          .map((row) => row.topic)
          .join(", ")}.`
      : `${aiSummary} Detailed analytics are being prepared.`;
  const localSummary = resolution.degraded && resolution.degradedReason
    ? `${localSummaryBase} ${resolution.degradedReason}.`
    : localSummaryBase;
  const localRecommendations = [
    `Review the ${mistakes.length} answered questions you missed.`,
    "Focus on accuracy before speed.",
    "Detailed weak-topic DPPs will appear when analysis is ready.",
  ];
  const persistInput: PersistTestAnalysisInput = {
    userId: user.id,
    testId,
    title,
    subject,
    chapter,
    difficulty,
    questionCount,
    timeTakenSeconds,
    score: analytics.score,
    percentage,
    correctAnswers: analytics.correctAnswers,
    wrongAnswers: analytics.wrongAnswers,
    unattempted: analytics.unattempted,
    totalMarks,
    subjectStats: analytics.subjectStats,
    answers: analytics.userAnswers,
    weakAreas,
    strongAreas,
    aiAnalysis: {
      summary: localSummary,
      mistakes,
      reviewEntries,
      recommendations: localRecommendations,
      dppGenerated: false,
      degraded: resolution.degraded,
      degradedReason: resolution.degradedReason,
      degraded_reason: resolution.degradedReason,
    },
    recommendations: localRecommendations,
    analyticsContext: buildPendingAnalyticsContext(localSummary, weakAreas, strongAreas),
    weakTopics,
    strongTopics,
    dppPlans: [],
    isMalpractice,
    degraded: resolution.degraded,
    degradedReason: resolution.degradedReason,
    analysisStatus: "pending",
    analysisError: null,
    // Phase 14: cohort tags for teacher-assigned submissions (null for self tests).
    workspaceId: teacherCohort?.workspaceId ?? null,
    batchId: teacherCohort?.batchId ?? null,
    assignmentId: teacherCohort?.assignmentId ?? null,
  };
  const analysisRequest: AnalyticsTestAnalysisRequest = {
    user_id: user.id,
    test_id: testId,
    title,
    subject,
    chapter,
    difficulty,
    question_count: questionCount,
    time_taken_seconds: timeTakenSeconds,
    graded_attempts: analytics.gradedAttempts,
    source_type: sourceType,
    room_id: options.roomId ?? null,
    scoring_policy: {
      correct_marks: DEFAULT_TEST_SCORING_POLICY.correctMarks,
      incorrect_marks: DEFAULT_TEST_SCORING_POLICY.incorrectMarks,
      unattempted_marks: DEFAULT_TEST_SCORING_POLICY.unattemptedMarks,
      partial_credit_policy: DEFAULT_TEST_SCORING_POLICY.partialCreditPolicy,
      negative_marking_mode: DEFAULT_TEST_SCORING_POLICY.negativeMarkingMode,
    },
    is_malpractice: isMalpractice,
  };

  try {
    let persistedResult = await persistTestAnalysisResult(persistInput);

    try {
      await enqueueAnalysisJob({
        id: `analysis_${persistedResult.id}`,
        userId: user.id,
        kind: "test",
        payload: {
          resultId: persistedResult.id,
          persistInput: {
            ...persistInput,
            id: persistedResult.id,
          },
          request: analysisRequest,
        },
      });
    } catch (enqueueError) {
      const fallback = recordAnalyticsFallback({
        scope: "submitTest",
        userId: user.id,
        assessmentId: testId,
        err: enqueueError,
      });
      persistedResult = await persistTestAnalysisResult({
        ...persistInput,
        id: persistedResult.id,
        analysisStatus: "failed",
        analysisError: `${ANALYTICS_DEGRADED_REASON} (${fallback.reason})`,
      });
    }

    updateUserStreak(store, user.id);
    updateUserStudyTime(user, timeTakenSeconds);
    const dailyActivity = getOrCreateDailyActivity(store, user.id);
    dailyActivity.questionsPracticed += analytics.correctAnswers + analytics.wrongAnswers;
    if (analytics.score > 0) {
      awardPoints(store, user.id, analytics.score, "practice", `Completed test: ${title}`, persistedResult.id);
    }

    return serializePersistedResult(persistedResult);
  } catch (err) {
    recordAnalyticsFallback({
      scope: "submitTest",
      userId: user.id,
      assessmentId: testId,
      err,
    });
    return buildLocalSubmittedTestResult({
      store,
      user,
      testId,
      title,
      questionCount,
      payload,
      analytics,
      isMalpractice,
      degraded: true,
      degradedReason: ANALYTICS_DEGRADED_REASON,
    });
  }
}

export async function listTestResults(store: AppStore, user: StoredUser, testId: string) {
  try {
    const persisted = await listPersistedTestResults(user.id, testId);
    if (persisted.length > 0) {
      return persisted.map(serializePersistedResult);
    }
  } catch {
    // fall through
  }
  return listTestResultsFallback(store, user, testId);
}

export async function getSingleResult(store: AppStore, user: StoredUser, resultId: string) {
  try {
    let persisted = await getPersistedResultById(user.id, resultId);
    if (persisted?.analysisStatus === "pending") {
      await drainOneAnalysisJobWithTimeout();
      persisted = (await getPersistedResultById(user.id, resultId)) ?? persisted;
    }
    if (persisted) {
      return serializePersistedResult(persisted);
    }
  } catch {
    // fall through
  }
  return getSingleResultFallback(store, user, resultId);
}

export async function getSingleResultAnalysis(store: AppStore, user: StoredUser, resultId: string) {
  return getSingleResult(store, user, resultId);
}

export async function listGeneratedDpps(store: AppStore, user: StoredUser) {
  if (!isOgcodePostgresConfigured()) {
    return [];
  }
  await drainOneAnalysisJobWithTimeout();
  const plans = await listPendingDppPlans(user.id);
  if (plans.length === 0) {
    return [];
  }

  const [latestAttemptMap, questionLookup] = await Promise.all([
    listLatestDppAttemptsForPlans(
      user.id,
      plans.map((plan) => plan.id),
    ),
    buildQuestionLookup(
      store,
      plans.flatMap((plan) => plan.questionIds),
    ),
  ]);

  const serialized = plans.map((plan) =>
    serializePersistedDppPlanWithLookup(
      store,
      user.id,
      plan,
      latestAttemptMap.get(plan.id) ?? null,
      questionLookup,
    ),
  );

  // Free students get no DPPs; premium students get their entitled subjects.
  const gate = await getStudentGate(user.id, user.role);
  return gate.enforced
    ? serialized.filter((dpp) => subjectVisibleUnderGate(dpp.subject, gate))
    : serialized;
}

export async function getGeneratedDppDetail(store: AppStore, user: StoredUser, dppId: string) {
  if (!isOgcodePostgresConfigured()) {
    throw new Error("DPP analytics database is not configured.");
  }
  await drainOneAnalysisJobWithTimeout();
  const plan = await getDppPlanDetail(user.id, dppId);
  if (!plan) {
    throw new Error(`DPP ${dppId} was not found.`);
  }
  const gate = await getStudentGate(user.id, user.role);
  if (gate.enforced && !subjectVisibleUnderGate(plan.subject, gate)) {
    throwEntitlementForbidden("This DPP requires a subscription to its subject.");
  }
  const latestAttempt = await getLatestDppAttemptForPlan(user.id, dppId);
  return serializePersistedDppPlan(store, user.id, plan, latestAttempt);
}

export async function checkGeneratedDppQuestion(
  store: AppStore,
  user: StoredUser,
  dppId: string,
  payload: DppQuestionCheckPayload,
) {
  if (!isOgcodePostgresConfigured()) {
    throw new Error("DPP analytics database is not configured.");
  }

  const questionId = String(payload.questionId ?? payload.question_id ?? "").trim();
  if (!questionId) {
    throw new Error("question_id is required.");
  }

  const plan = await getDppPlanDetail(user.id, dppId);
  if (!plan) {
    throw new Error(`DPP ${dppId} was not found.`);
  }
  if (!plan.questionIds.includes(questionId)) {
    throw new Error(`Question ${questionId} is not part of DPP ${dppId}.`);
  }

  const questionLookup = await buildQuestionLookup(store, [questionId]);
  const question = questionLookup.get(questionId);
  if (!question) {
    throw new Error(`Question ${questionId} was not found.`);
  }

  const rawAnswer = normalizeAnswer(payload);
  rawAnswer.questionId = question.id;
  const prepared = remapPresentedAnswer(user.id, question, rawAnswer, {
    scope: "dpp",
    assessmentId: dppId,
  });
  const remoteGrades = await gradeAssessmentBatchWithService({
    userId: user.id,
    assessmentId: dppId,
    assessmentType: "dpp",
    scoringPolicy: DEFAULT_TEST_SCORING_POLICY,
    items: [
      {
        question,
        answer: prepared.answer,
        attemptRef: question.id,
        scoringPolicy: scoringPolicyForQuestion(question, "dpp"),
      },
    ],
  });
  const grade = remoteGrades?.[0] ?? gradeAnswer(question, prepared.answer, "dpp");
  const info = toPresentedGradeInfo(question, grade.info, prepared.displayOrder);

  return {
    isCorrect: grade.isCorrect,
    is_correct: grade.isCorrect,
    questionId: question.id,
    question_id: question.id,
    ...info,
  };
}

export async function submitGeneratedDpp(
  store: AppStore,
  user: StoredUser,
  dppId: string,
  payload: TestSubmissionPayload,
) {
  if (!isOgcodePostgresConfigured()) {
    throw new Error("DPP analytics database is not configured.");
  }
  const plan = await getDppPlanDetail(user.id, dppId);
  if (!plan) {
    throw new Error(`DPP ${dppId} was not found.`);
  }
  const submitGate = await getStudentGate(user.id, user.role);
  if (submitGate.enforced && !subjectVisibleUnderGate(plan.subject, submitGate)) {
    throwEntitlementForbidden("This DPP requires a subscription to its subject.");
  }

  const submittedAnswers = payload.answers ?? [];
  const answersMap = new Map<string, StoredUserAnswer>();
  submittedAnswers.forEach((rawAnswer) => {
    const normalized = normalizeAnswer(rawAnswer);
    if (normalized.questionId) {
      answersMap.set(normalized.questionId, normalized);
    }
  });

  const analytics = await buildAnalyticsAttempts(
    store,
    user.id,
    plan.questionIds,
    answersMap,
    {
      scope: "dpp",
      assessmentId: dppId,
    },
    "dpp",
  );
  const timeTakenSeconds = payload.timeTaken ?? payload.time_taken ?? 0;
  const progressScore =
    plan.questionIds.length > 0
      ? Math.max(0, Math.round((analytics.correctAnswers / plan.questionIds.length) * 100))
      : 0;
  const { weakTopics, strongTopics } = buildLocalTopicSignals(analytics.gradedAttempts);
  const pendingResponse: AnalyticsDppAttemptResponse = {
    weak_topics: weakTopics,
    strong_topics: strongTopics,
    summary: "Your DPP was scored. Detailed progress analytics are being prepared.",
    recommendations: [
      "Review the explanations for every missed question.",
      "Revisit the original weak topics before starting the next DPP.",
      "Detailed DPP progress will update when analysis is ready.",
    ],
    resolved_topics: strongTopics.map((topic) => topic.topic).filter((topic) => plan.weakTopics.includes(topic)),
    still_weak_topics:
      weakTopics.length > 0
        ? weakTopics.map((topic) => topic.topic)
        : plan.weakTopics,
    progress_score: progressScore,
    completed: true,
  };
  const persistInput: PersistDppAttemptInput = {
    userId: user.id,
    dppId,
    title: plan.title,
    sourceTestResultId: plan.sourceTestResultId,
    focusTopics: plan.weakTopics,
    timeTakenSeconds,
    answers: analytics.userAnswers,
    response: pendingResponse,
    analysisStatus: "pending",
    analysisError: null,
  };
  const analysisRequest: AnalyticsDppAttemptRequest = {
    user_id: user.id,
    dpp_id: dppId,
    title: plan.title,
    source_test_result_id: plan.sourceTestResultId,
    focus_topics: plan.weakTopics,
    graded_attempts: analytics.gradedAttempts,
    time_taken_seconds: timeTakenSeconds,
    source_type: "dpp",
    scoring_policy: {
      correct_marks: DEFAULT_TEST_SCORING_POLICY.correctMarks,
      incorrect_marks: DEFAULT_TEST_SCORING_POLICY.incorrectMarks,
      unattempted_marks: DEFAULT_TEST_SCORING_POLICY.unattemptedMarks,
      partial_credit_policy: DEFAULT_TEST_SCORING_POLICY.partialCreditPolicy,
      negative_marking_mode: DEFAULT_TEST_SCORING_POLICY.negativeMarkingMode,
    },
  };

  let persistedAttempt = await persistDppAttemptResult(persistInput);

  try {
    await enqueueAnalysisJob({
      id: `analysis_${persistedAttempt.id}`,
      userId: user.id,
      kind: "dpp",
      payload: {
        attemptId: persistedAttempt.id,
        persistInput: {
          ...persistInput,
          id: persistedAttempt.id,
        },
        request: analysisRequest,
      },
    });
  } catch (enqueueError) {
    const fallback = recordAnalyticsFallback({
      scope: "submitDpp",
      userId: user.id,
      assessmentId: dppId,
      err: enqueueError,
    });
    persistedAttempt = await persistDppAttemptResult({
      ...persistInput,
      id: persistedAttempt.id,
      analysisStatus: "failed",
      analysisError: `${ANALYTICS_DEGRADED_REASON} (${fallback.reason})`,
    });
  }

  updateUserStreak(store, user.id);
  updateUserStudyTime(user, timeTakenSeconds);
  const dailyActivity = getOrCreateDailyActivity(store, user.id);
  dailyActivity.questionsPracticed += analytics.correctAnswers + analytics.wrongAnswers;
  if (analytics.score > 0) {
    awardPoints(store, user.id, analytics.score, "dpp", `Completed DPP: ${plan.title}`, persistedAttempt.id);
  }

  const result = {
    id: persistedAttempt.id,
    dppId: dppId,
    dpp_id: dppId,
    summary: persistedAttempt.summary,
    recommendations: persistedAttempt.recommendations,
    resolvedTopics: persistedAttempt.resolvedTopics,
    resolved_topics: persistedAttempt.resolvedTopics,
    stillWeakTopics: persistedAttempt.stillWeakTopics,
    still_weak_topics: persistedAttempt.stillWeakTopics,
    progressScore: persistedAttempt.progressScore,
    progress_score: persistedAttempt.progressScore,
    completed: persistedAttempt.completed,
    analysisStatus: persistedAttempt.analysisStatus ?? "complete",
    analysis_status: persistedAttempt.analysisStatus ?? "complete",
    analysisError: persistedAttempt.analysisError ?? null,
    analysis_error: persistedAttempt.analysisError ?? null,
    createdAt: persistedAttempt.createdAt,
    created_at: persistedAttempt.createdAt,
    answers: persistedAttempt.answers,
  };

  return persistedAttempt.analysisStatus === "failed"
    ? withDegradedPayload(result, persistedAttempt.analysisError ?? ANALYTICS_DEGRADED_REASON)
    : result;
}

export function listPracticeQuestions(
  store: AppStore,
  user: StoredUser,
  filters: { subject?: string | null; difficulty?: string | null; type?: string | null },
) {
  return store.questions
    .filter((question) => {
      const matchesSubject = !filters.subject || question.subject === normalizeSubject(filters.subject);
      const matchesDifficulty = !filters.difficulty || question.difficulty === normalizeDifficulty(filters.difficulty);
      const matchesType = !filters.type || question.questionType === filters.type;
      return matchesSubject && matchesDifficulty && matchesType;
    })
    .map((question) =>
      serializeQuestion(store, user.id, question, {
        includeCorrectFields: false,
        presentationContext: {
          scope: "practice",
          assessmentId: "practice-list",
          attemptKey: store.practiceAttempts.filter(
            (attempt) => attempt.userId === user.id && attempt.questionId === question.id,
          ).length + 1,
        },
      }),
    );
}

export async function listOgcodeQuestionChapters(
  store: AppStore,
  _user: StoredUser,
  subject: string,
) {
  const normalizedSubject = normalizeSubject(subject);
  const chapters = new Set<string>();

  store.questions.forEach((question) => {
    if (question.subject === normalizedSubject && question.chapter) {
      chapters.add(question.chapter);
    }
  });

  try {
    const catalogChapters = await listOgcodeCatalogChapters(normalizedSubject);
    catalogChapters.forEach((chapter) => {
      if (chapter) {
        chapters.add(chapter);
      }
    });
  } catch {
    // Fall back to the local seeded store.
  }

  return [...chapters].sort((left, right) => left.localeCompare(right));
}

export async function listOgcodeQuestionPage(
  store: AppStore,
  user: StoredUser,
  filters: OgcodeQuestionListFilters,
): Promise<OgcodeQuestionPage> {
  const requestedLimit = clampOgcodePageSize(filters.limit);
  const offset = Math.max(0, Math.trunc(filters.offset ?? 0));
  const chapters = normalizeOgcodeChaptersFilter(filters.chapters);
  const status = normalizeOgcodeStatusFilter(filters.status);

  // Phase 1.4 entitlement gate. Free → fixed 500-question mixed sample pool;
  // premium → full bank scoped to entitled subjects.
  const gate = await getStudentGate(user.id, user.role);
  const isFree = gate.enforced && !gate.anyPremium;
  const isPremium = gate.enforced && gate.anyPremium;
  const emptyPage = (total: number): OgcodeQuestionPage => ({
    items: [],
    total,
    limit: requestedLimit,
    offset,
    hasMore: false,
  });

  // Premium request for an unentitled subject returns nothing.
  if (isPremium && filters.subject) {
    const requested = canonicalSubject(filters.subject);
    if (requested && !gate.subjects.includes(requested)) return emptyPage(0);
  }
  // Free pool is capped at the first FREE_SAMPLE_POOL_SIZE questions.
  if (isFree && offset >= FREE_SAMPLE_POOL_SIZE) return emptyPage(FREE_SAMPLE_POOL_SIZE);
  const limit = isFree ? Math.min(requestedLimit, FREE_SAMPLE_POOL_SIZE - offset) : requestedLimit;

  const attemptState = await buildOgcodeAttemptState(store, user.id);

  const localQuestionsById = new Map<string, StoredQuestion>();
  const localIds: string[] = [];
  store.questions.forEach((question) => {
    localQuestionsById.set(question.id, question);
    if (matchesLocalOgcodeQuestion(question, { ...filters, chapters, status }, attemptState)) {
      // Premium: hide local questions outside the entitled subjects.
      if (isPremium && !subjectVisibleUnderGate(question.subject, gate)) return;
      localIds.push(question.id);
    }
  });

  let catalogOverlap = new Map<string, StoredQuestion>();
  try {
    catalogOverlap = localIds.length ? await getOgcodeCatalogQuestionMap(localIds) : new Map<string, StoredQuestion>();
  } catch {
    catalogOverlap = new Map<string, StoredQuestion>();
  }

  const localOnlyIds = localIds.filter((questionId) => !catalogOverlap.has(questionId));
  const localPageIds = localOnlyIds.slice(offset, offset + limit);
  const remainingLimit = Math.max(0, limit - localPageIds.length);
  const remoteOffset = Math.max(0, offset - localOnlyIds.length);
  const solvedCatalogIds = [...attemptState.solvedIds];

  const remotePage = remainingLimit && !(status === "solved" && solvedCatalogIds.length === 0)
    ? await listOgcodeCatalogQuestionPage({
        subject: filters.subject,
        // Premium with no specific subject → restrict to entitled subjects.
        subjects: isPremium ? gate.subjects : null,
        difficulty: filters.difficulty,
        type: filters.type,
        search: filters.search,
        chapters,
        includeIds: status === "solved" ? solvedCatalogIds : null,
        excludeIds: status === "unsolved" ? solvedCatalogIds : null,
        limit: remainingLimit,
        offset: remoteOffset,
      }).catch(() => ({ items: [], total: 0 }))
    : { items: [], total: 0 };

  const items = [
    ...localPageIds
      .map((questionId) => localQuestionsById.get(questionId))
      .filter((question): question is StoredQuestion => Boolean(question))
      .map((question) => serializeOgcodeQuestionPreview(question, attemptState)),
    ...remotePage.items.map((question) => serializeOgcodeQuestionPreview(question, attemptState)),
  ];

  // Free pool: clamp the reported total to the sample-pool size.
  const total = isFree
    ? Math.min(localOnlyIds.length + remotePage.total, FREE_SAMPLE_POOL_SIZE)
    : localOnlyIds.length + remotePage.total;

  return {
    items,
    total,
    limit,
    offset,
    hasMore: offset + items.length < total,
  };
}

export async function listOgcodeQuestions(
  store: AppStore,
  user: StoredUser,
  filters: { subject?: string | null; difficulty?: string | null; type?: string | null },
) {
  const questions = await getOgcodeQuestionBank(store);
  const gate = await getStudentGate(user.id, user.role);
  const filtered = questions.filter((question) => {
    const matchesSubject = !filters.subject || question.subject === normalizeSubject(filters.subject);
    const matchesDifficulty = !filters.difficulty || question.difficulty === normalizeDifficulty(filters.difficulty);
    const matchesType = !filters.type || question.questionType === filters.type;
    if (!(matchesSubject && matchesDifficulty && matchesType)) return false;
    // Premium: only entitled subjects; free: everything (clamped to the pool below).
    if (gate.enforced && gate.anyPremium && !subjectVisibleUnderGate(question.subject, gate)) return false;
    return true;
  });
  const scoped = gate.enforced && !gate.anyPremium ? filtered.slice(0, FREE_SAMPLE_POOL_SIZE) : filtered;
  return scoped
    .map((question) =>
      serializeQuestion(store, user.id, question, {
        includeCorrectFields: false,
        presentationContext: {
          scope: "practice",
          assessmentId: "ogcode-list",
          attemptKey: store.practiceAttempts.filter(
            (attempt) => attempt.userId === user.id && attempt.questionId === question.id,
          ).length + 1,
        },
      }),
    );
}

export async function getPracticeQuestionDetail(store: AppStore, user: StoredUser, questionId: string) {
  const resolved = await resolvePracticeQuestion(store, questionId);
  return serializeQuestion(store, user.id, resolved.question, {
    includeCorrectFields: false,
    presentationContext: {
      scope: "practice",
      assessmentId: questionId,
      attemptKey: store.practiceAttempts.filter(
        (attempt) => attempt.userId === user.id && attempt.questionId === resolved.question.id,
      ).length + 1,
    },
  });
}

function getOrCreateSubjectRank(store: AppStore, userId: string, subject: string): StoredSubjectRank {
  let entry = store.subjectRanks.find((row) => row.userId === userId && row.subject === subject);
  if (!entry) {
    entry = {
      userId,
      subject,
      questionsSolved: 0,
      rankScore: 0,
      latitude: null,
      longitude: null,
      locationShared: false,
      updatedAt: new Date().toISOString(),
    };
    store.subjectRanks.push(entry);
  }
  return entry;
}

export async function submitPracticeQuestion(
  store: AppStore,
  user: StoredUser,
  questionId: string,
  payload: PracticeSubmissionPayload,
) {
  const resolved = await resolvePracticeQuestion(store, questionId);
  const question = resolved.question;
  const rawAnswer = normalizeAnswer(payload);
  rawAnswer.questionId = question.id;
  const prepared = remapPresentedAnswer(user.id, question, rawAnswer);
  const answer = prepared.answer;
  const grade = await gradePracticeAnswer(question, answer, user.id);
  const isCorrect = grade.isCorrect;
  const info = toPresentedGradeInfo(question, grade.info, prepared.displayOrder);

  const attemptedBefore = store.practiceAttempts.some(
    (attempt) => attempt.userId === user.id && attempt.questionId === question.id,
  );
  const solvedBefore = store.practiceAttempts.some(
    (attempt) => attempt.userId === user.id && attempt.questionId === question.id && attempt.isCorrect,
  );
  const practiceScore = calculateTimedPracticeScore(question.difficulty, answer.timeSpent, {
    isCorrect,
    alreadySolved: solvedBefore,
  });

  store.practiceAttempts.unshift({
    id: createId("practice"),
    userId: user.id,
    questionId: question.id,
    isCorrect,
    timeSpent: answer.timeSpent,
    selectedOptions: answer.selectedOptions,
    matrixPairs: answer.matrixPairs,
    answerSubmitted:
      answer.answerText ??
      (answer.selectedOption !== null ? String(answer.selectedOption) : null),
    createdAt: new Date().toISOString(),
  });

  if (resolved.source === "store") {
    question.frequency += 1;
    if (isCorrect) {
      question.totalCorrect += 1;
    }
    question.acceptanceRate = question.frequency > 0 ? (question.totalCorrect / question.frequency) * 100 : 0;
  } else {
    try {
      await incrementOgcodeCatalogQuestionStats(question.id, isCorrect);
    } catch {
      // Keep the attempt flow working even when the catalog DB is temporarily unavailable.
    }
  }

  const dailyActivity = getOrCreateDailyActivity(store, user.id);
  if (!attemptedBefore) {
    dailyActivity.questionsPracticed += 1;
    updateUserStreak(store, user.id);
  }

  if (isCorrect && !solvedBefore) {
    awardPoints(
      store,
      user.id,
      practiceScore.pointsAwarded,
      "practice",
      `Solved ${question.difficulty} ${question.subject} question in ${practiceScore.timeSpentSeconds}s (${practiceScore.speedBand})`,
      question.id,
    );

    const subjectRank = getOrCreateSubjectRank(store, user.id, question.subject);
    subjectRank.questionsSolved += 1;
    subjectRank.rankScore += practiceScore.pointsAwarded;
    subjectRank.updatedAt = new Date().toISOString();
  }

  return {
    isCorrect,
    is_correct: isCorrect,
    already_solved: solvedBefore,
    resultScore: practiceScore.resultScore,
    result_score: practiceScore.resultScore,
    pointsAwarded: practiceScore.pointsAwarded,
    points_awarded: practiceScore.pointsAwarded,
    basePoints: practiceScore.basePoints,
    base_points: practiceScore.basePoints,
    maxPoints: practiceScore.maxPoints,
    max_points: practiceScore.maxPoints,
    timeSpentSeconds: practiceScore.timeSpentSeconds,
    time_spent_seconds: practiceScore.timeSpentSeconds,
    targetTimeSeconds: practiceScore.targetTimeSeconds,
    target_time_seconds: practiceScore.targetTimeSeconds,
    speedMultiplier: practiceScore.speedMultiplier,
    speed_multiplier: practiceScore.speedMultiplier,
    speedBand: practiceScore.speedBand,
    speed_band: practiceScore.speedBand,
    ...info,
  };
}

export async function getOgcodeUserStats(store: AppStore, user: StoredUser) {
  const attempts = store.practiceAttempts.filter((attempt) => attempt.userId === user.id);
  const totalAttempts = attempts.length;
  const correctAttempts = attempts.filter((attempt) => attempt.isCorrect).length;
  const solvedCount = new Set(
    attempts.filter((attempt) => attempt.isCorrect).map((attempt) => attempt.questionId),
  ).size;
  const attemptedCount = new Set(attempts.map((attempt) => attempt.questionId)).size;
  const { total: catalogTotal } = await getOgcodeCatalogCounts();
  const storeIds = store.questions.map((question) => question.id);
  const catalogStoreOverlap = storeIds.length ? await getOgcodeCatalogQuestionMap(storeIds) : new Map<string, StoredQuestion>();
  const localOnlyCount = storeIds.filter((questionId) => !catalogStoreOverlap.has(questionId)).length;
  const totalQuestions = catalogTotal + localOnlyCount;
  const accuracy = totalAttempts > 0 ? Math.round((correctAttempts / totalAttempts) * 100) : 0;
  const syllabusCoverage = totalQuestions > 0 ? Math.round((attemptedCount / totalQuestions) * 100) : 0;

  const leaderboardData = await getOgcodeLeaderboard(store, user, null);
  const myRank = leaderboardData.myRank;
  const streak = getOrCreateStreak(store, user.id);
  const doubtCount = store.doubtSessions.filter((session) => session.userId === user.id).length;

  return {
    rank: myRank,
    accuracy,
    solvedCount,
    solved_count: solvedCount,
    totalAttempts,
    total_attempts: totalAttempts,
    syllabusCoverage,
    syllabus_coverage: syllabusCoverage,
    streak: streak.currentStreak,
    achievements: {
      first_test: totalAttempts > 0,
      streak_7: streak.currentStreak >= 7 || streak.longestStreak >= 7,
      streak_30: streak.currentStreak >= 30 || streak.longestStreak >= 30,
      streak_100: streak.currentStreak >= 100 || streak.longestStreak >= 100,
      doubt_master: doubtCount >= 50,
      top_100: myRank !== null && myRank <= 100,
      perfect_score: store.testResults.some(r => r.userId === user.id && r.percentage >= 100),
      subject_master: false,
      night_owl: false,
      early_bird: false,
    }
  };
}

export async function getOgcodeSubjectRanks(store: AppStore, user: StoredUser) {
  if (isUserPostgresConfigured() && isOgcodePostgresConfigured()) {
    const subjects = ["physics", "chemistry", "mathematics", "biology"];
    const rows = await Promise.all(
      subjects.map(async (subject) => {
        const entries = await buildLeaderboardEntriesFromDb(user, subject);
        const myEntry = entries.find((entry) => entry.isMe);
        return {
          subject,
          questionsSolved: myEntry?.questionsSolved ?? 0,
          questions_solved: myEntry?.questionsSolved ?? 0,
          rankScore: myEntry?.rankScore ?? 0,
          rank_score: myEntry?.rankScore ?? 0,
          rankPosition: myEntry?.rank ?? entries.length + 1,
          rank_position: myEntry?.rank ?? entries.length + 1,
        };
      }),
    );
    return rows.sort((left, right) => right.rankScore - left.rankScore);
  }

  // Fallback to in-memory store
  const rows = store.subjectRanks
    .filter((entry) => entry.userId === user.id)
    .sort((left, right) => right.rankScore - left.rankScore)
    .map((entry, index) => ({
      subject: entry.subject,
      questionsSolved: entry.questionsSolved,
      questions_solved: entry.questionsSolved,
      rankScore: entry.rankScore,
      rank_score: entry.rankScore,
      rankPosition: index + 1,
      rank_position: index + 1,
    }));

  return rows;
}

export async function getOgcodeIndexData(
  store: AppStore,
  user: StoredUser,
  filters: OgcodeQuestionListFilters,
): Promise<OgcodeIndexData> {
  const [subjectRanks, questionPage, userStats, chapters] = await Promise.all([
    getOgcodeSubjectRanks(store, user),
    listOgcodeQuestionPage(store, user, filters),
    getOgcodeUserStats(store, user),
    filters.subject ? listOgcodeQuestionChapters(store, user, filters.subject) : Promise.resolve(null),
  ]);

  return {
    questionPage,
    userStats,
    subjectRanks,
    chapters,
  };
}

async function buildLeaderboardEntriesFromDb(user: StoredUser, subject: string | null, location?: string | null) {
  const userPool = getUserPostgresPool();
  const ogcodePool = getOgcodePostgresPool();
  if (!userPool || !ogcodePool) return [];

  // 1. Get all students from user pool
  let users: Array<{ id: string; name: string; avatar?: string | null; total_study_time?: number; streak?: number; location?: string | null }>;
  try {
    const usersResult = await userPool.query(`
      SELECT id, name, avatar, total_study_time, streak, location
      FROM origin_users
      WHERE role = 'student' ${location ? "AND location = $1" : ""}
    `, location ? [location] : []);
    users = usersResult.rows;
  } catch (err: any) {
    // If location column is missing, retry without the filter if possible, or throw
    if (err.message?.includes('column "location" does not exist')) {
      if (location) {
        throw new Error("Regional leaderboard is currently unavailable (location data not configured in database).");
      }
      const usersResult = await userPool.query(`
        SELECT id, name, avatar, total_study_time, streak
        FROM origin_users
        WHERE role = 'student'
      `);
      users = usersResult.rows;
    } else {
      throw err;
    }
  }

  if (users.length === 0) {
    return [];
  }

  // 2. Get performance data from ogcode pool. User/profile data lives in the
  // user database, so regional filtering must happen before this query instead
  // of joining origin_users from the OGCode connection.
  const subjectFilter = subject ? "AND subject = $1" : "";
  const userIdParamIndex = subject ? 2 : 1;
  const queryParams: unknown[] = [];
  if (subject) queryParams.push(subject);
  queryParams.push(users.map((entry) => entry.id));

  let resultsResult;
  try {
    resultsResult = await ogcodePool.query(`
      SELECT
        user_id,
        SUM(correct_answers) as total_solved,
        AVG(percentage) as avg_accuracy
      FROM analytics.test_results tr
      WHERE tr.user_id = ANY($${userIdParamIndex}::text[]) ${subjectFilter}
      GROUP BY user_id
    `, queryParams);
  } catch (error) {
    console.error("[buildLeaderboardEntriesFromDb] DB query failed, falling back to empty stats:", error);
    resultsResult = { rows: [] };
  }

  const statsMap = new Map();
  resultsResult.rows.forEach(row => {
    statsMap.set(row.user_id, {
      solved: parseInt(row.total_solved || 0),
      accuracy: parseFloat(row.avg_accuracy || 0)
    });
  });

  // 3. Combine and calculate rankScore
  const entries = users.map(u => {
    const stats = statsMap.get(u.id) || { solved: 0, accuracy: 0 };
    const studyMinutes = u.total_study_time || 0;

    // Efficiency Rating: solved / study_time (scaled)
    // If studyTime is 0, we use a default multiplier for solved questions
    const rankScore = studyMinutes > 0
      ? Number((stats.solved / studyMinutes).toFixed(3))
      : stats.solved * 0.1;

    return {
      userId: u.id,
      name: u.name,
      avatar: u.avatar || undefined,
      rankScore: rankScore,
      rank_score: rankScore,
      score: stats.solved * 10, // Simple XP proxy: 10 pts per solved
      studyTime: studyMinutes,
      questionsSolved: stats.solved,
      accuracy: stats.accuracy,
      location: u.location ?? null,
      isMe: u.id === user.id,
      is_me: u.id === user.id,
    };
  });

  // 4. Sort and Rank
  return entries
    .sort((a, b) => b.rankScore - a.rankScore)
    .map((entry, index) => ({
      ...entry,
      rank: index + 1
    }));
}

export async function getOgcodeLeaderboard(store: AppStore, user: StoredUser, subject: string | null, location?: string | null) {
  let entries;
  if (isUserPostgresConfigured() && isOgcodePostgresConfigured()) {
    entries = await buildLeaderboardEntriesFromDb(user, subject, location);
  } else {
    // Fallback: build entries from in-memory store
    const allSubjectRanks = store.subjectRanks;
    const rankedUsers = Array.from(
      allSubjectRanks
        .filter((entry) => {
          const matchesSubject = !subject || entry.subject === subject;
          const userEntry = store.users.find(u => u.id === entry.userId);
          const matchesLocation = !location || userEntry?.location === location;
          return matchesSubject && matchesLocation;
        })
        .reduce<Map<string, { solved: number; rankScore: number }>>((map, entry) => {
          const existing = map.get(entry.userId) ?? { solved: 0, rankScore: 0 };
          map.set(entry.userId, {
            solved: existing.solved + entry.questionsSolved,
            rankScore: existing.rankScore + entry.rankScore,
          });
          return map;
        }, new Map())
        .entries(),
    )
      .sort(([, a], [, b]) => b.rankScore - a.rankScore)
      .map(([userId, stats], index) => {
        const u = store.users.find((u) => u.id === userId);
        return {
          userId,
          name: u?.name ?? "Unknown",
          avatar: u?.avatar ?? null,
          location: u?.location ?? null,
          questionsSolved: stats.solved,
          rankScore: stats.rankScore,
          accuracy: 0,
          streak: 0,
          xp: stats.solved * 10,
          isMe: userId === user.id,
          rank: index + 1,
        };
      });
    entries = rankedUsers;
  }

  return {
    leaderboard: entries.slice(0, 20),
    myRank: entries.find((entry) => entry.isMe)?.rank ?? null,
    my_rank: entries.find((entry) => entry.isMe)?.rank ?? null,
  };
}

export function updateOgcodeLocation(
  store: AppStore,
  user: StoredUser,
  payload: UpdateOgcodeLocationPayload,
) {
  const subject = payload.subject ? normalizeSubject(payload.subject) : "";
  if (!subject) {
    throw new Error("subject is required");
  }
  const entry = getOrCreateSubjectRank(store, user.id, subject);
  if (payload.share && payload.latitude != null && payload.longitude != null) {
    entry.latitude = Number(payload.latitude);
    entry.longitude = Number(payload.longitude);
    entry.locationShared = true;
  } else {
    entry.locationShared = false;
  }
  entry.updatedAt = new Date().toISOString();
  return { status: "updated" };
}

export async function getFocusAreas(store: AppStore, user: StoredUser) {
  const subjects = ["physics", "chemistry", "mathematics", "biology"];
  const questionBank = await getOgcodeQuestionBank(store);
  const totalBySubject = questionBank.reduce<Record<string, number>>((accumulator, question) => {
    accumulator[question.subject] = (accumulator[question.subject] ?? 0) + 1;
    return accumulator;
  }, {});

  // Fetch attempted question counts per subject from the database when available
  const attemptedBySubject: Record<string, number> = {};
  if (isOgcodePostgresConfigured()) {
    try {
      const ogcodePool = getOgcodePostgresPool();
      if (ogcodePool) {
        const result = await ogcodePool.query<{ subject: string; attempted: string }>(
          `SELECT subject, COUNT(DISTINCT question_id) AS attempted
           FROM analytics.test_results
           WHERE user_id = $1
           GROUP BY subject`,
          [user.id],
        );
        for (const row of result.rows) {
          attemptedBySubject[row.subject.toLowerCase()] = Number(row.attempted);
        }
      }
    } catch (error) {
      console.error("[getFocusAreas] DB query failed, falling back to store:", error);
      // Fall through to in-memory fallback below
    }
  }

  // Fallback: count attempted questions from the in-memory store
  if (Object.keys(attemptedBySubject).length === 0) {
    const attemptedQuestionIds = new Set<string>();
    store.practiceAttempts
      .filter((attempt) => attempt.userId === user.id)
      .forEach((attempt) => attemptedQuestionIds.add(attempt.questionId));
    store.testResults
      .filter((result) => result.userId === user.id)
      .flatMap((result) => result.answers)
      .forEach((answer) => attemptedQuestionIds.add(answer.questionId));

    const attemptedLookup = await buildQuestionLookup(store, [...attemptedQuestionIds]);
    attemptedLookup.forEach((question, questionId) => {
      if (attemptedQuestionIds.has(questionId)) {
        attemptedBySubject[question.subject] = (attemptedBySubject[question.subject] ?? 0) + 1;
      }
    });
  }

  return subjects
    .map((subject) => {
      const totalQuestions = totalBySubject[subject] ?? 0;
      const attemptedInSubject = attemptedBySubject[subject] ?? 0;
      const questionsLeft = Math.max(0, totalQuestions - attemptedInSubject);
      const dppsPending = store.dpps.filter(
        (dpp) => dpp.userId === user.id && dpp.subject === subject && !dpp.completed,
      ).length;
      const assignmentsPending = store.assignments.filter(
        (assignment) => assignment.userId === user.id && assignment.subject === subject && !assignment.completed,
      ).length;

      return {
        subject: subject[0].toUpperCase() + subject.slice(1),
        score: questionsLeft + dppsPending * 5 + assignmentsPending * 10,
        questionsLeft,
        questions_left: questionsLeft,
        dppsPending,
        dpps_pending: dppsPending,
        assignmentsPending,
        assignments_pending: assignmentsPending,
        completionRate: totalQuestions > 0 ? Math.round((attemptedInSubject / totalQuestions) * 100) : 100,
        completion_rate: totalQuestions > 0 ? Math.round((attemptedInSubject / totalQuestions) * 100) : 100,
      };
    })
    .sort((left, right) => right.score - left.score);
}

export async function getChallengeOfTheDay(store: AppStore, user: StoredUser) {
  let challenge = null;
  try {
    challenge = await getOgcodeChallengeQuestion();
  } catch {
    challenge = null;
  }
  if (!challenge) {
    const epochDay = Math.floor(Date.now() / 86_400_000);
    const curated = store.questions.filter((question) => question.isChallengeOfTheDay);
    const pool = curated.length > 0
      ? curated
      : store.questions.filter((question) => question.questionType === "mcq" && question.correctOption !== null);
    if (pool.length > 0) {
      challenge = pool[((epochDay % pool.length) + pool.length) % pool.length];
    } else {
      challenge = store.questions[0];
    }
  }
  if (!challenge) {
    throw new Error("No challenge of the day set.");
  }
  const epochDay = Math.floor(Date.now() / 86_400_000);
  const data = serializeQuestion(store, user.id, challenge, {
    includeCorrectFields: false,
    presentationContext: {
      scope: "challenge",
      assessmentId: "challenge-of-the-day",
      attemptKey: epochDay,
    },
  });
  return {
    ...data,
    isSolved: store.practiceAttempts.some(
      (attempt) => attempt.userId === user.id && attempt.questionId === challenge.id && attempt.isCorrect,
    ),
  };
}
