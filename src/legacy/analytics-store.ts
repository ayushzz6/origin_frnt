// Legacy analytics persistence implementation kept behind the public server barrel.
import type { PoolClient } from "pg";

import type {
  AnalyticsContextPayload,
  AnalyticsDppAttemptResponse,
  AnalyticsDppPlan,
  AnalyticsTestAnalysisResponse,
  AnalyticsTopicSignal,
} from "@/server/analytics-client";
import { selectDppQuestionsWithBagPreference, type DppBagOverride } from "@/server/dpp-question-bank";
import { getOgcodePostgresPool } from "@/server/postgres";
import { createId, type StoredUserAnswer } from "@/server/store";

declare global {
  var __originAnalyticsSchemaReady: Promise<void> | undefined;
}

export const DPP_PLAN_RETENTION_LIMIT = 30;

const ANALYTICS_SCHEMA_SQL = `
CREATE SCHEMA IF NOT EXISTS analytics;

CREATE TABLE IF NOT EXISTS analytics.custom_tests (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  subject TEXT NOT NULL,
  chapter TEXT,
  difficulty TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL,
  question_count INTEGER NOT NULL,
  focus_topics JSONB NOT NULL DEFAULT '[]'::jsonb,
  generation_summary TEXT NOT NULL,
  recommended_time_per_question_seconds INTEGER NOT NULL DEFAULT 120,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS analytics.custom_test_questions (
  test_id TEXT NOT NULL REFERENCES analytics.custom_tests(id) ON DELETE CASCADE,
  question_id TEXT NOT NULL,
  position INTEGER NOT NULL,
  PRIMARY KEY (test_id, position)
);

CREATE TABLE IF NOT EXISTS analytics.test_results (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  test_id TEXT NOT NULL,
  title TEXT NOT NULL,
  subject TEXT NOT NULL,
  chapter TEXT,
  difficulty TEXT NOT NULL,
  question_count INTEGER NOT NULL,
  time_taken_seconds INTEGER NOT NULL DEFAULT 0,
  score DOUBLE PRECISION NOT NULL,
  percentage INTEGER NOT NULL,
  correct_answers INTEGER NOT NULL,
  wrong_answers INTEGER NOT NULL,
  unattempted INTEGER NOT NULL,
  total_marks DOUBLE PRECISION NOT NULL,
  subject_stats JSONB NOT NULL DEFAULT '{}'::jsonb,
  answers JSONB NOT NULL DEFAULT '[]'::jsonb,
  summary TEXT NOT NULL,
  recommendations JSONB NOT NULL DEFAULT '[]'::jsonb,
  analytics_context JSONB NOT NULL DEFAULT '{}'::jsonb,
  weak_topics JSONB NOT NULL DEFAULT '[]'::jsonb,
  strong_topics JSONB NOT NULL DEFAULT '[]'::jsonb,
  ai_analysis JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_malpractice BOOLEAN NOT NULL DEFAULT FALSE,
  analysis_status TEXT NOT NULL DEFAULT 'complete',
  analysis_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Phase 14: cohort context for teacher-assigned submissions (same physical Neon
-- DB as app.* / assessment.*, so these mirror the assignment without an FK). They
-- let Phase-8 / 2E cohort analytics populate idempotently per attempt.
ALTER TABLE analytics.test_results ADD COLUMN IF NOT EXISTS workspace_id TEXT;
ALTER TABLE analytics.test_results ADD COLUMN IF NOT EXISTS batch_id TEXT;
ALTER TABLE analytics.test_results ADD COLUMN IF NOT EXISTS assignment_id TEXT;
CREATE INDEX IF NOT EXISTS idx_test_results_cohort
  ON analytics.test_results (workspace_id, batch_id, created_at DESC);

CREATE TABLE IF NOT EXISTS analytics.test_topic_analytics (
  id BIGSERIAL PRIMARY KEY,
  test_result_id TEXT NOT NULL REFERENCES analytics.test_results(id) ON DELETE CASCADE,
  topic TEXT NOT NULL,
  subject TEXT NOT NULL,
  chapter TEXT,
  concept TEXT,
  accuracy DOUBLE PRECISION NOT NULL,
  attempts INTEGER NOT NULL,
  average_time_seconds DOUBLE PRECISION NOT NULL,
  bkt_mastery DOUBLE PRECISION NOT NULL,
  expected_correctness DOUBLE PRECISION NOT NULL,
  severity TEXT NOT NULL,
  anomaly BOOLEAN NOT NULL DEFAULT FALSE,
  recommendation_seed TEXT NOT NULL,
  band TEXT NOT NULL DEFAULT 'weak'
);

CREATE TABLE IF NOT EXISTS analytics.dpp_plans (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  source_test_result_id TEXT REFERENCES analytics.test_results(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  subject TEXT NOT NULL,
  summary TEXT NOT NULL,
  weak_topics JSONB NOT NULL DEFAULT '[]'::jsonb,
  generated_from JSONB NOT NULL DEFAULT '[]'::jsonb,
  duration_minutes INTEGER NOT NULL,
  target_question_count INTEGER NOT NULL DEFAULT 10,
  sequence INTEGER NOT NULL DEFAULT 1,
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Question-Bag-aware DPPs: when a DPP draws on a teacher workspace's Question
-- Bag, stamp the owning workspace (gates tenant-isolated visibility) and a
-- human-readable provenance note. Null workspace_id = pure OG Code DPP.
ALTER TABLE analytics.dpp_plans ADD COLUMN IF NOT EXISTS workspace_id TEXT;
ALTER TABLE analytics.dpp_plans ADD COLUMN IF NOT EXISTS provenance_note TEXT;
CREATE INDEX IF NOT EXISTS idx_analytics_dpp_plans_workspace
  ON analytics.dpp_plans (user_id, workspace_id, completed, created_at DESC);

CREATE TABLE IF NOT EXISTS analytics.dpp_questions (
  dpp_id TEXT NOT NULL REFERENCES analytics.dpp_plans(id) ON DELETE CASCADE,
  question_id TEXT NOT NULL,
  position INTEGER NOT NULL,
  PRIMARY KEY (dpp_id, position)
);

CREATE TABLE IF NOT EXISTS analytics.dpp_attempts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  dpp_id TEXT NOT NULL REFERENCES analytics.dpp_plans(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  source_test_result_id TEXT REFERENCES analytics.test_results(id) ON DELETE SET NULL,
  focus_topics JSONB NOT NULL DEFAULT '[]'::jsonb,
  time_taken_seconds INTEGER NOT NULL DEFAULT 0,
  summary TEXT NOT NULL,
  recommendations JSONB NOT NULL DEFAULT '[]'::jsonb,
  weak_topics JSONB NOT NULL DEFAULT '[]'::jsonb,
  strong_topics JSONB NOT NULL DEFAULT '[]'::jsonb,
  resolved_topics JSONB NOT NULL DEFAULT '[]'::jsonb,
  still_weak_topics JSONB NOT NULL DEFAULT '[]'::jsonb,
  progress_score DOUBLE PRECISION NOT NULL DEFAULT 0,
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  analysis_status TEXT NOT NULL DEFAULT 'complete',
  analysis_error TEXT,
  answers JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS analytics.dpp_topic_progress (
  id BIGSERIAL PRIMARY KEY,
  dpp_attempt_id TEXT NOT NULL REFERENCES analytics.dpp_attempts(id) ON DELETE CASCADE,
  topic TEXT NOT NULL,
  subject TEXT NOT NULL,
  chapter TEXT,
  concept TEXT,
  accuracy DOUBLE PRECISION NOT NULL,
  attempts INTEGER NOT NULL,
  average_time_seconds DOUBLE PRECISION NOT NULL,
  bkt_mastery DOUBLE PRECISION NOT NULL,
  expected_correctness DOUBLE PRECISION NOT NULL,
  severity TEXT NOT NULL,
  anomaly BOOLEAN NOT NULL DEFAULT FALSE,
  recommendation_seed TEXT NOT NULL,
  band TEXT NOT NULL DEFAULT 'weak'
);

CREATE INDEX IF NOT EXISTS idx_analytics_custom_tests_user_created
  ON analytics.custom_tests(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_test_results_user_created
  ON analytics.test_results(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_dpp_plans_user_created
  ON analytics.dpp_plans(user_id, completed, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_dpp_attempts_user_created
  ON analytics.dpp_attempts(user_id, created_at DESC);

ALTER TABLE analytics.test_results ADD COLUMN IF NOT EXISTS analysis_status TEXT NOT NULL DEFAULT 'complete';
ALTER TABLE analytics.test_results ADD COLUMN IF NOT EXISTS analysis_error TEXT;
ALTER TABLE analytics.test_results ALTER COLUMN score TYPE DOUBLE PRECISION USING score::double precision;
ALTER TABLE analytics.test_results ALTER COLUMN total_marks TYPE DOUBLE PRECISION USING total_marks::double precision;
ALTER TABLE analytics.dpp_attempts ADD COLUMN IF NOT EXISTS analysis_status TEXT NOT NULL DEFAULT 'complete';
ALTER TABLE analytics.dpp_attempts ADD COLUMN IF NOT EXISTS analysis_error TEXT;
`;

export interface PersistedCustomTestRecord {
  id: string;
  userId: string;
  title: string;
  description: string;
  subject: string;
  chapter: string | null;
  difficulty: string;
  durationMinutes: number;
  questionCount: number;
  questionIds: string[];
  focusTopics: string[];
  generationSummary: string;
  recommendedTimePerQuestionSeconds: number;
  createdAt: string;
  attemptCount: number;
  averageScore: number | null;
  allScores: number[];
}

export interface PersistedTestResultRecord {
  id: string;
  testId: string;
  userId: string;
  score: number;
  percentage: number;
  correctAnswers: number;
  wrongAnswers: number;
  unattempted: number;
  timeTaken: number;
  weakAreas: Array<{ topic: string; accuracy: number }>;
  strongAreas: Array<{ topic: string; accuracy: number }>;
  aiAnalysis: {
    summary: string;
    mistakes: Array<{
      questionId: string;
      concept: string;
      status?: "correct" | "incorrect";
      error: string;
      explanation: string;
      howToApproach: string;
    }>;
    reviewEntries?: Array<{
      questionId: string;
      concept: string;
      status: "correct" | "incorrect";
      error: string;
      explanation: string;
      howToApproach: string;
    }>;
    recommendations: string[];
    dppGenerated: boolean;
    degraded?: boolean;
    degradedReason?: string | null;
    degraded_reason?: string | null;
  };
  subjectStats: Record<
    string,
    {
      score: number;
      total_marks: number;
      correct: number;
      incorrect: number;
      unattempted: number;
      total_qs: number;
      accuracy: number;
      total_time_spent: number;
    }
  >;
  isMalpractice: boolean;
  degraded?: boolean;
  degradedReason?: string | null;
  analysisStatus?: "pending" | "complete" | "failed";
  analysisError?: string | null;
  createdAt: string;
  answers: StoredUserAnswer[];
}

export interface PersistedDppPlanRecord {
  id: string;
  userId: string;
  sourceTestResultId: string | null;
  title: string;
  subject: string;
  summary: string;
  weakTopics: string[];
  generatedFrom: string[];
  durationMinutes: number;
  targetQuestionCount: number;
  sequence: number;
  completed: boolean;
  createdAt: string;
  questionIds: string[];
  latestAttemptId: string | null;
  latestProgressScore: number | null;
  /** Owning workspace when the DPP used Question-Bag questions (else null). */
  workspaceId: string | null;
  /** Human-readable note on where the DPP's questions came from. */
  provenanceNote: string | null;
}

export interface PersistedDppAttemptRecord {
  id: string;
  dppId: string;
  userId: string;
  title: string;
  summary: string;
  recommendations: string[];
  resolvedTopics: string[];
  stillWeakTopics: string[];
  progressScore: number;
  completed: boolean;
  analysisStatus?: "pending" | "complete" | "failed";
  analysisError?: string | null;
  createdAt: string;
  answers: StoredUserAnswer[];
}

export interface OriginAiAnalyticsSnapshot {
  latestWeakTopics: string[];
  latestStrongTopics: string[];
  latestTestSummary: string | null;
  pendingDppCount: number;
  pendingDppFocusTopics: string[];
  recentDppProgressSummary: string | null;
}

type PersistGeneratedCustomTestInput = {
  id: string;
  userId: string;
  subject: string;
  chapter?: string | null;
  difficulty: string;
  title: string;
  description: string;
  questionIds: string[];
  durationMinutes: number;
  focusTopics: string[];
  generationSummary: string;
  recommendedTimePerQuestionSeconds: number;
};

export type PersistTestAnalysisInput = {
  id?: string;
  userId: string;
  testId: string;
  title: string;
  subject: string;
  chapter?: string | null;
  difficulty: string;
  questionCount: number;
  timeTakenSeconds: number;
  score: number;
  percentage: number;
  correctAnswers: number;
  wrongAnswers: number;
  unattempted: number;
  totalMarks: number;
  subjectStats: Record<string, unknown>;
  answers: StoredUserAnswer[];
  weakAreas: Array<{ topic: string; accuracy: number }>;
  strongAreas: Array<{ topic: string; accuracy: number }>;
  aiAnalysis: PersistedTestResultRecord["aiAnalysis"];
  recommendations: string[];
  analyticsContext: AnalyticsContextPayload;
  weakTopics: AnalyticsTopicSignal[];
  strongTopics: AnalyticsTopicSignal[];
  dppPlans: AnalyticsDppPlan[];
  isMalpractice?: boolean;
  degraded?: boolean;
  degradedReason?: string | null;
  analysisStatus?: "pending" | "complete" | "failed";
  analysisError?: string | null;
  // Phase 14 — cohort tags for teacher-assigned submissions (null for self tests).
  workspaceId?: string | null;
  batchId?: string | null;
  assignmentId?: string | null;
};

export type PersistDppAttemptInput = {
  id?: string;
  userId: string;
  dppId: string;
  title: string;
  sourceTestResultId?: string | null;
  focusTopics: string[];
  timeTakenSeconds: number;
  answers: StoredUserAnswer[];
  response: AnalyticsDppAttemptResponse;
  analysisStatus?: "pending" | "complete" | "failed";
  analysisError?: string | null;
};

function getPoolOrThrow() {
  const pool = getOgcodePostgresPool();
  if (!pool) {
    throw new Error("OGCODE_DATABASE_URL is not configured.");
  }
  return pool;
}

function fromJsonArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function fromJsonObject<T extends object>(value: unknown, fallback: T): T {
  return value && typeof value === "object" ? (value as T) : fallback;
}

function toTopicAccuracy(topics: AnalyticsTopicSignal[]): Array<{ topic: string; accuracy: number }> {
  return topics.map((topic) => ({
    topic: topic.topic,
    accuracy: Math.round(topic.accuracy),
  }));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapPersistedCustomTestRow(row: any): PersistedCustomTestRecord {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    description: row.description,
    subject: row.subject,
    chapter: row.chapter,
    difficulty: row.difficulty,
    durationMinutes: row.duration_minutes,
    questionCount: row.question_count,
    questionIds: fromJsonArray<string>(row.question_ids),
    focusTopics: fromJsonArray<string>(row.focus_topics),
    generationSummary: row.generation_summary,
    recommendedTimePerQuestionSeconds: row.recommended_time_per_question_seconds,
    createdAt: row.created_at,
    attemptCount: row.attempt_count ?? 0,
    averageScore: row.average_score ?? null,
    allScores: fromJsonArray<number>(row.all_scores),
  };
}

export async function ensureAnalyticsSchema(client?: PoolClient): Promise<void> {
  if (client) {
    await client.query(ANALYTICS_SCHEMA_SQL);
    return;
  }
  if (!globalThis.__originAnalyticsSchemaReady) {
    globalThis.__originAnalyticsSchemaReady = getPoolOrThrow()
      .query(ANALYTICS_SCHEMA_SQL)
      .then(() => undefined)
      .catch((error) => {
        globalThis.__originAnalyticsSchemaReady = undefined;
        throw error;
      });
  }
  await globalThis.__originAnalyticsSchemaReady;
}

const ensureSchema = ensureAnalyticsSchema;

export async function ensureAnalyticsTables(): Promise<void> {
  await ensureSchema();
}

export async function pruneDppPlansForUser(
  userId: string,
  limit = DPP_PLAN_RETENTION_LIMIT,
  client?: PoolClient,
): Promise<number> {
  const normalizedLimit = Math.max(0, Math.floor(limit));
  if (!userId || normalizedLimit < 1) {
    return 0;
  }

  if (!client) {
    await ensureSchema();
  }
  const executor = client ?? getPoolOrThrow();
  const result = await executor.query(
    `WITH ranked AS (
       SELECT
         id,
         ROW_NUMBER() OVER (ORDER BY created_at DESC, sequence ASC, id DESC) AS dpp_rank
       FROM analytics.dpp_plans
       WHERE user_id = $1
     ),
     deleted AS (
       DELETE FROM analytics.dpp_plans d
       USING ranked r
       WHERE d.id = r.id AND r.dpp_rank > $2
       RETURNING d.id
     )
     SELECT COUNT(*)::int AS deleted_count FROM deleted`,
    [userId, normalizedLimit],
  );
  return Number(result.rows[0]?.deleted_count ?? 0);
}

export async function getRecentWeakTopicsForUser(userId: string): Promise<string[]> {
  await ensureSchema();
  const pool = getPoolOrThrow();
  const result = await pool.query(
    `SELECT analytics_context->'latest_weak_topics' AS weak_topics
       FROM analytics.test_results
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT 1`,
    [userId],
  );
  return fromJsonArray<string>(result.rows[0]?.weak_topics);
}

export async function getAttemptedQuestionIdsForUser(userId: string): Promise<string[]> {
  const { attemptedIds } = await getOgcodeProgressForUser(userId);
  return [...attemptedIds];
}

export async function getOgcodeProgressForUser(userId: string): Promise<{ attemptedIds: Set<string>; solvedIds: Set<string> }> {
  await ensureSchema();
  const pool = getPoolOrThrow();
  const result = await pool.query(
    `SELECT ai_analysis->'reviewEntries' AS review_entries, answers
       FROM analytics.test_results
      WHERE user_id = $1
      UNION ALL
     SELECT NULL as review_entries, answers
       FROM analytics.dpp_attempts
      WHERE user_id = $1`,
    [userId],
  );

  const attemptedIds = new Set<string>();
  const solvedIds = new Set<string>();

  for (const row of result.rows) {
    const reviewEntries = fromJsonArray<{ questionId: string; status: string }>(row.review_entries);
    for (const entry of reviewEntries) {
      if (entry.questionId) {
        attemptedIds.add(entry.questionId);
        if (entry.status === "correct") {
          solvedIds.add(entry.questionId);
        }
      }
    }

    const answers = fromJsonArray<StoredUserAnswer>(row.answers);
    for (const answer of answers) {
      if (answer?.questionId) {
        const hasResponse =
          answer.selectedOption !== null ||
          (answer.selectedOptions?.length ?? 0) > 0 ||
          (answer.matrixPairs?.length ?? 0) > 0 ||
          Boolean(answer.answerText?.trim());
        if (hasResponse) {
          attemptedIds.add(answer.questionId);
        }
      }
    }
  }

  return { attemptedIds, solvedIds };
}

export async function persistGeneratedCustomTest(input: PersistGeneratedCustomTestInput): Promise<void> {
  const pool = getPoolOrThrow();
  await ensureSchema();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await ensureSchema(client);
    await client.query(
      `INSERT INTO analytics.custom_tests (
         id, user_id, title, description, subject, chapter, difficulty, duration_minutes,
         question_count, focus_topics, generation_summary, recommended_time_per_question_seconds
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11,$12)
       ON CONFLICT (id) DO UPDATE SET
         title = EXCLUDED.title,
         description = EXCLUDED.description,
         subject = EXCLUDED.subject,
         chapter = EXCLUDED.chapter,
         difficulty = EXCLUDED.difficulty,
         duration_minutes = EXCLUDED.duration_minutes,
         question_count = EXCLUDED.question_count,
         focus_topics = EXCLUDED.focus_topics,
         generation_summary = EXCLUDED.generation_summary,
         recommended_time_per_question_seconds = EXCLUDED.recommended_time_per_question_seconds`,
      [
        input.id,
        input.userId,
        input.title,
        input.description,
        input.subject,
        input.chapter ?? null,
        input.difficulty,
        input.durationMinutes,
        input.questionIds.length,
        JSON.stringify(input.focusTopics),
        input.generationSummary,
        input.recommendedTimePerQuestionSeconds,
      ],
    );
    await client.query(`DELETE FROM analytics.custom_test_questions WHERE test_id = $1`, [input.id]);
    for (const [index, questionId] of input.questionIds.entries()) {
      await client.query(
        `INSERT INTO analytics.custom_test_questions (test_id, question_id, position) VALUES ($1, $2, $3)`,
        [input.id, questionId, index],
      );
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function listPersistedCustomTests(userId: string): Promise<PersistedCustomTestRecord[]> {
  await ensureSchema();
  const pool = getPoolOrThrow();
  const result = await pool.query(
    `SELECT
       t.*,
       (
         SELECT COALESCE(json_agg(question_id ORDER BY position), '[]'::json)
         FROM analytics.custom_test_questions q
         WHERE q.test_id = t.id
       ) AS question_ids,
       (
         SELECT COUNT(*)::int
         FROM analytics.test_results r
         WHERE r.user_id = t.user_id AND r.test_id = t.id
       ) AS attempt_count,
       (
         SELECT ROUND(AVG(r.percentage))::int
         FROM analytics.test_results r
         WHERE r.user_id = t.user_id AND r.test_id = t.id
       ) AS average_score,
       (
         SELECT COALESCE(json_agg(r.percentage ORDER BY r.created_at DESC), '[]'::json)
         FROM analytics.test_results r
         WHERE r.user_id = t.user_id AND r.test_id = t.id
       ) AS all_scores
     FROM analytics.custom_tests t
     WHERE t.user_id = $1
     ORDER BY t.created_at DESC`,
    [userId],
  );

  return result.rows.map(mapPersistedCustomTestRow);
}

export async function getPersistedCustomTest(testId: string, userId: string): Promise<PersistedCustomTestRecord | null> {
  const tests = await listPersistedCustomTests(userId);
  return tests.find((test) => test.id === testId) ?? null;
}

export async function getPersistedCustomTestById(testId: string): Promise<PersistedCustomTestRecord | null> {
  await ensureSchema();
  const pool = getPoolOrThrow();
  const result = await pool.query(
    `SELECT
       t.*,
       (
         SELECT COALESCE(json_agg(question_id ORDER BY position), '[]'::json)
         FROM analytics.custom_test_questions q
         WHERE q.test_id = t.id
       ) AS question_ids,
       (
         SELECT COUNT(*)::int
         FROM analytics.test_results r
         WHERE r.user_id = t.user_id AND r.test_id = t.id
       ) AS attempt_count,
       (
         SELECT ROUND(AVG(r.percentage))::int
         FROM analytics.test_results r
         WHERE r.user_id = t.user_id AND r.test_id = t.id
       ) AS average_score,
       (
         SELECT COALESCE(json_agg(r.percentage ORDER BY r.created_at DESC), '[]'::json)
         FROM analytics.test_results r
         WHERE r.user_id = t.user_id AND r.test_id = t.id
       ) AS all_scores
     FROM analytics.custom_tests t
     WHERE t.id = $1
     LIMIT 1`,
    [testId],
  );

  return result.rows[0] ? mapPersistedCustomTestRow(result.rows[0]) : null;
}

export async function persistTestAnalysisResult(input: PersistTestAnalysisInput): Promise<PersistedTestResultRecord> {
  const pool = getPoolOrThrow();
  await ensureSchema();
  const client = await pool.connect();
  const resultId = input.id ?? createId("result");
  const createdAt = new Date().toISOString();
  const analysisStatus = input.analysisStatus ?? "complete";
  const aiAnalysis = {
    ...input.aiAnalysis,
    degraded: input.degraded ?? input.aiAnalysis.degraded ?? false,
    degradedReason: input.degradedReason ?? input.aiAnalysis.degradedReason ?? null,
    degraded_reason: input.degradedReason ?? input.aiAnalysis.degraded_reason ?? null,
  };

  // Question-Bag-aware DPP selection for teacher-assigned tests. Computed on the
  // USER pool BEFORE the analytics transaction (separate DB) so the tx stays
  // short. Self-tests (no workspaceId) keep pure OG Code DPPs unchanged.
  const attemptedIds = input.answers
    .map((a) => a.questionId)
    .filter((id): id is string => Boolean(id));
  const dppOverrides = new Map<string, DppBagOverride>();
  if (input.workspaceId) {
    for (const plan of input.dppPlans) {
      try {
        dppOverrides.set(
          plan.id,
          await selectDppQuestionsWithBagPreference({
            workspaceId: input.workspaceId,
            subject: plan.subject,
            weakTopics: plan.weak_topics,
            ogcodeQuestionIds: plan.question_ids,
            targetCount: plan.target_question_count,
            excludeQuestionIds: attemptedIds,
          }),
        );
      } catch (error) {
        console.error("DPP bag override failed; using OG Code fallback", { planId: plan.id, error });
      }
    }
  }

  try {
    await client.query("BEGIN");
    await ensureSchema(client);

    await client.query(
      `INSERT INTO analytics.test_results (
         id, user_id, test_id, title, subject, chapter, difficulty, question_count,
         time_taken_seconds, score, percentage, correct_answers, wrong_answers, unattempted,
         total_marks, subject_stats, answers, summary, recommendations, analytics_context,
         weak_topics, strong_topics, ai_analysis, is_malpractice, analysis_status, analysis_error, created_at,
         workspace_id, batch_id, assignment_id
       ) VALUES (
         $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,
         $16::jsonb,$17::jsonb,$18,$19::jsonb,$20::jsonb,$21::jsonb,$22::jsonb,$23::jsonb,$24,$25,$26,$27,
         $28,$29,$30
       )
       ON CONFLICT (id) DO UPDATE SET
         title = EXCLUDED.title,
         subject = EXCLUDED.subject,
         chapter = EXCLUDED.chapter,
         difficulty = EXCLUDED.difficulty,
         question_count = EXCLUDED.question_count,
         time_taken_seconds = EXCLUDED.time_taken_seconds,
         score = EXCLUDED.score,
         percentage = EXCLUDED.percentage,
         correct_answers = EXCLUDED.correct_answers,
         wrong_answers = EXCLUDED.wrong_answers,
         unattempted = EXCLUDED.unattempted,
         total_marks = EXCLUDED.total_marks,
         subject_stats = EXCLUDED.subject_stats,
         answers = EXCLUDED.answers,
         summary = EXCLUDED.summary,
         recommendations = EXCLUDED.recommendations,
         analytics_context = EXCLUDED.analytics_context,
         weak_topics = EXCLUDED.weak_topics,
         strong_topics = EXCLUDED.strong_topics,
         ai_analysis = EXCLUDED.ai_analysis,
         is_malpractice = EXCLUDED.is_malpractice,
         analysis_status = EXCLUDED.analysis_status,
         analysis_error = EXCLUDED.analysis_error,
         workspace_id = EXCLUDED.workspace_id,
         batch_id = EXCLUDED.batch_id,
         assignment_id = EXCLUDED.assignment_id`,
      [
        resultId,
        input.userId,
        input.testId,
        input.title,
        input.subject,
        input.chapter ?? null,
        input.difficulty,
        input.questionCount,
        input.timeTakenSeconds,
        input.score,
        input.percentage,
        input.correctAnswers,
        input.wrongAnswers,
        input.unattempted,
        input.totalMarks,
        JSON.stringify(input.subjectStats),
        JSON.stringify(input.answers),
        input.aiAnalysis.summary,
        JSON.stringify(input.recommendations),
        JSON.stringify(input.analyticsContext),
        JSON.stringify(input.weakTopics),
        JSON.stringify(input.strongTopics),
        JSON.stringify(aiAnalysis),
        input.isMalpractice || false,
        analysisStatus,
        input.analysisError ?? null,
        createdAt,
        input.workspaceId ?? null,
        input.batchId ?? null,
        input.assignmentId ?? null,
      ],
    );

    await client.query(`DELETE FROM analytics.test_topic_analytics WHERE test_result_id = $1`, [resultId]);
    const orderedSignals = [
      ...input.weakTopics.map((signal) => ({ ...signal, band: "weak" })),
      ...input.strongTopics.map((signal) => ({ ...signal, band: "strong" })),
    ];
    for (const signal of orderedSignals) {
      await client.query(
        `INSERT INTO analytics.test_topic_analytics (
           test_result_id, topic, subject, chapter, concept, accuracy, attempts, average_time_seconds,
           bkt_mastery, expected_correctness, severity, anomaly, recommendation_seed, band
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
        [
          resultId,
          signal.topic,
          signal.subject,
          signal.chapter ?? null,
          signal.concept ?? null,
          signal.accuracy,
          signal.attempts,
          signal.average_time_seconds,
          signal.bkt_mastery,
          signal.expected_correctness,
          signal.severity,
          signal.anomaly,
          signal.recommendation_seed,
          signal.band,
        ],
      );
    }

    for (const [planIndex, plan] of input.dppPlans.entries()) {
      const planId = `${resultId}_dpp_${plan.sequence || planIndex + 1}`;
      const override = dppOverrides.get(plan.id);
      const finalQuestionIds = override?.questionIds ?? plan.question_ids;
      const planWorkspaceId = override?.workspaceId ?? null;
      const provenanceNote = override?.provenanceNote ?? null;
      await client.query(
        `INSERT INTO analytics.dpp_plans (
           id, user_id, source_test_result_id, title, subject, summary,
           weak_topics, generated_from, duration_minutes, target_question_count, sequence, completed,
           workspace_id, provenance_note
         ) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9,$10,$11,false,$12,$13)
         ON CONFLICT (id) DO UPDATE SET
           title = EXCLUDED.title,
           subject = EXCLUDED.subject,
           summary = EXCLUDED.summary,
           weak_topics = EXCLUDED.weak_topics,
           generated_from = EXCLUDED.generated_from,
           duration_minutes = EXCLUDED.duration_minutes,
           target_question_count = EXCLUDED.target_question_count,
           sequence = EXCLUDED.sequence,
           workspace_id = EXCLUDED.workspace_id,
           provenance_note = EXCLUDED.provenance_note`,
        [
          planId,
          input.userId,
          resultId,
          plan.title,
          plan.subject,
          plan.summary,
          JSON.stringify(plan.weak_topics),
          JSON.stringify(plan.generated_from),
          plan.duration_minutes,
          plan.target_question_count,
          plan.sequence,
          planWorkspaceId,
          provenanceNote,
        ],
      );
      await client.query(`DELETE FROM analytics.dpp_questions WHERE dpp_id = $1`, [planId]);
      for (const [index, questionId] of finalQuestionIds.entries()) {
        await client.query(
          `INSERT INTO analytics.dpp_questions (dpp_id, question_id, position) VALUES ($1, $2, $3)`,
          [planId, questionId, index],
        );
      }
    }
    await pruneDppPlansForUser(input.userId, DPP_PLAN_RETENTION_LIMIT, client);

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  return {
    id: resultId,
    testId: input.testId,
    userId: input.userId,
    score: input.score,
    percentage: input.percentage,
    correctAnswers: input.correctAnswers,
    wrongAnswers: input.wrongAnswers,
    unattempted: input.unattempted,
    timeTaken: input.timeTakenSeconds,
    weakAreas: input.weakAreas,
    strongAreas: input.strongAreas,
    aiAnalysis,
    subjectStats: input.subjectStats as PersistedTestResultRecord["subjectStats"],
    isMalpractice: input.isMalpractice || false,
    degraded: Boolean(input.degraded) || analysisStatus === "failed",
    degradedReason: input.degradedReason ?? input.analysisError ?? undefined,
    analysisStatus,
    analysisError: input.analysisError ?? null,
    createdAt,
    answers: input.answers,
  };
}

function mapPersistedResultRow(row: Record<string, unknown>): PersistedTestResultRecord {
  const aiAnalysis = fromJsonObject<PersistedTestResultRecord["aiAnalysis"]>(row.ai_analysis, {
    summary: String(row.summary ?? ""),
    mistakes: [],
    reviewEntries: [],
    recommendations: fromJsonArray<string>(row.recommendations),
    dppGenerated: true,
  });

  return {
    id: String(row.id),
    testId: String(row.test_id),
    userId: String(row.user_id),
    score: Number(row.score ?? 0),
    percentage: Number(row.percentage ?? 0),
    correctAnswers: Number(row.correct_answers ?? 0),
    wrongAnswers: Number(row.wrong_answers ?? 0),
    unattempted: Number(row.unattempted ?? 0),
    timeTaken: Number(row.time_taken_seconds ?? 0),
    weakAreas: toTopicAccuracy(fromJsonArray<AnalyticsTopicSignal>(row.weak_topics)),
    strongAreas: toTopicAccuracy(fromJsonArray<AnalyticsTopicSignal>(row.strong_topics)),
    aiAnalysis,
    subjectStats: fromJsonObject(row.subject_stats, {}),
    isMalpractice: Boolean(row.is_malpractice),
    degraded: Boolean(aiAnalysis.degraded) || String(row.analysis_status ?? "complete") === "failed",
    degradedReason:
      aiAnalysis.degradedReason ??
      aiAnalysis.degraded_reason ??
      (row.analysis_error ? String(row.analysis_error) : null),
    analysisStatus: String(row.analysis_status ?? "complete") as PersistedTestResultRecord["analysisStatus"],
    analysisError: row.analysis_error ? String(row.analysis_error) : null,
    createdAt: String(row.created_at),
    answers: fromJsonArray<StoredUserAnswer>(row.answers),
  };
}

export async function listPersistedTestResults(userId: string, testId: string): Promise<PersistedTestResultRecord[]> {
  await ensureSchema();
  const pool = getPoolOrThrow();
  const result = await pool.query(
    `SELECT * FROM analytics.test_results
      WHERE user_id = $1 AND test_id = $2
      ORDER BY created_at DESC`,
    [userId, testId],
  );
  return result.rows.map(mapPersistedResultRow);
}

export async function getPersistedResultById(userId: string, resultId: string): Promise<PersistedTestResultRecord | null> {
  await ensureSchema();
  const pool = getPoolOrThrow();
  const result = await pool.query(
    `SELECT * FROM analytics.test_results WHERE user_id = $1 AND id = $2 LIMIT 1`,
    [userId, resultId],
  );
  return result.rows[0] ? mapPersistedResultRow(result.rows[0]) : null;
}

function mapPersistedDppRow(row: Record<string, unknown>): PersistedDppPlanRecord {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    sourceTestResultId: row.source_test_result_id ? String(row.source_test_result_id) : null,
    title: String(row.title),
    subject: String(row.subject),
    summary: String(row.summary),
    weakTopics: fromJsonArray<string>(row.weak_topics),
    generatedFrom: fromJsonArray<string>(row.generated_from),
    durationMinutes: Number(row.duration_minutes ?? 0),
    targetQuestionCount: Number(row.target_question_count ?? 10),
    sequence: Number(row.sequence ?? 1),
    completed: Boolean(row.completed),
    createdAt: String(row.created_at),
    questionIds: fromJsonArray<string>(row.question_ids),
    latestAttemptId: row.latest_attempt_id ? String(row.latest_attempt_id) : null,
    latestProgressScore: row.latest_progress_score === null || row.latest_progress_score === undefined ? null : Number(row.latest_progress_score),
    workspaceId: row.workspace_id ? String(row.workspace_id) : null,
    provenanceNote: row.provenance_note ? String(row.provenance_note) : null,
  };
}

export async function listPendingDppPlans(userId: string): Promise<PersistedDppPlanRecord[]> {
  await ensureSchema();
  const pool = getPoolOrThrow();
  await pruneDppPlansForUser(userId);
  const result = await pool.query(
    `SELECT
       d.*,
       (
         SELECT COALESCE(json_agg(question_id ORDER BY position), '[]'::json)
         FROM analytics.dpp_questions q
         WHERE q.dpp_id = d.id
       ) AS question_ids,
       (
         SELECT a.id
         FROM analytics.dpp_attempts a
         WHERE a.dpp_id = d.id
         ORDER BY a.created_at DESC
         LIMIT 1
       ) AS latest_attempt_id,
       (
         SELECT a.progress_score
         FROM analytics.dpp_attempts a
         WHERE a.dpp_id = d.id
         ORDER BY a.created_at DESC
         LIMIT 1
       ) AS latest_progress_score
     FROM analytics.dpp_plans d
     WHERE d.user_id = $1
     ORDER BY d.completed ASC, d.created_at DESC, d.sequence ASC`,
    [userId],
  );
  return result.rows.map(mapPersistedDppRow);
}

export async function getDppPlanDetail(userId: string, dppId: string): Promise<PersistedDppPlanRecord | null> {
  const plans = await listPendingDppPlans(userId);
  return plans.find((plan) => plan.id === dppId) ?? null;
}

export async function persistDppAttemptResult(input: PersistDppAttemptInput): Promise<PersistedDppAttemptRecord> {
  await ensureSchema();
  const pool = getPoolOrThrow();
  const client = await pool.connect();
  const attemptId = input.id ?? createId("dpp_attempt");
  const createdAt = new Date().toISOString();
  const analysisStatus = input.analysisStatus ?? "complete";

  try {
    await client.query("BEGIN");
    await ensureSchema(client);
    await client.query(
      `INSERT INTO analytics.dpp_attempts (
         id, user_id, dpp_id, title, source_test_result_id, focus_topics, time_taken_seconds,
         summary, recommendations, weak_topics, strong_topics, resolved_topics, still_weak_topics,
         progress_score, completed, analysis_status, analysis_error, answers, created_at
       ) VALUES (
         $1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9::jsonb,$10::jsonb,$11::jsonb,$12::jsonb,$13::jsonb,$14,$15,$16,$17,$18::jsonb,$19
       )
       ON CONFLICT (id) DO UPDATE SET
         title = EXCLUDED.title,
         source_test_result_id = EXCLUDED.source_test_result_id,
         focus_topics = EXCLUDED.focus_topics,
         time_taken_seconds = EXCLUDED.time_taken_seconds,
         summary = EXCLUDED.summary,
         recommendations = EXCLUDED.recommendations,
         weak_topics = EXCLUDED.weak_topics,
         strong_topics = EXCLUDED.strong_topics,
         resolved_topics = EXCLUDED.resolved_topics,
         still_weak_topics = EXCLUDED.still_weak_topics,
         progress_score = EXCLUDED.progress_score,
         completed = EXCLUDED.completed,
         analysis_status = EXCLUDED.analysis_status,
         analysis_error = EXCLUDED.analysis_error,
         answers = EXCLUDED.answers`,
      [
        attemptId,
        input.userId,
        input.dppId,
        input.title,
        input.sourceTestResultId ?? null,
        JSON.stringify(input.focusTopics),
        input.timeTakenSeconds,
        input.response.summary,
        JSON.stringify(input.response.recommendations),
        JSON.stringify(input.response.weak_topics),
        JSON.stringify(input.response.strong_topics),
        JSON.stringify(input.response.resolved_topics),
        JSON.stringify(input.response.still_weak_topics),
        input.response.progress_score,
        input.response.completed,
        analysisStatus,
        input.analysisError ?? null,
        JSON.stringify(input.answers),
        createdAt,
      ],
    );
    await client.query(`UPDATE analytics.dpp_plans SET completed = $2 WHERE id = $1`, [
      input.dppId,
      input.response.completed,
    ]);
    await client.query(`DELETE FROM analytics.dpp_topic_progress WHERE dpp_attempt_id = $1`, [attemptId]);
    for (const signal of [
      ...input.response.weak_topics.map((topic) => ({ ...topic, band: "weak" })),
      ...input.response.strong_topics.map((topic) => ({ ...topic, band: "strong" })),
    ]) {
      await client.query(
        `INSERT INTO analytics.dpp_topic_progress (
           dpp_attempt_id, topic, subject, chapter, concept, accuracy, attempts, average_time_seconds,
           bkt_mastery, expected_correctness, severity, anomaly, recommendation_seed, band
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
        [
          attemptId,
          signal.topic,
          signal.subject,
          signal.chapter ?? null,
          signal.concept ?? null,
          signal.accuracy,
          signal.attempts,
          signal.average_time_seconds,
          signal.bkt_mastery,
          signal.expected_correctness,
          signal.severity,
          signal.anomaly,
          signal.recommendation_seed,
          signal.band,
        ],
      );
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  return {
    id: attemptId,
    dppId: input.dppId,
    userId: input.userId,
    title: input.title,
    summary: input.response.summary,
    recommendations: input.response.recommendations,
    resolvedTopics: input.response.resolved_topics,
    stillWeakTopics: input.response.still_weak_topics,
    progressScore: input.response.progress_score,
    completed: input.response.completed,
    analysisStatus,
    analysisError: input.analysisError ?? null,
    createdAt,
    answers: input.answers,
  };
}

function mapPersistedDppAttemptRow(row: Record<string, unknown>): PersistedDppAttemptRecord {
  return {
    id: String(row.id),
    dppId: String(row.dpp_id),
    userId: String(row.user_id),
    title: String(row.title),
    summary: String(row.summary),
    recommendations: fromJsonArray<string>(row.recommendations),
    resolvedTopics: fromJsonArray<string>(row.resolved_topics),
    stillWeakTopics: fromJsonArray<string>(row.still_weak_topics),
    progressScore: Number(row.progress_score ?? 0),
    completed: Boolean(row.completed),
    analysisStatus: String(row.analysis_status ?? "complete") as PersistedDppAttemptRecord["analysisStatus"],
    analysisError: row.analysis_error ? String(row.analysis_error) : null,
    createdAt: String(row.created_at),
    answers: fromJsonArray<StoredUserAnswer>(row.answers),
  };
}

export async function getLatestDppAttemptForPlan(userId: string, dppId: string): Promise<PersistedDppAttemptRecord | null> {
  await ensureSchema();
  const pool = getPoolOrThrow();
  const result = await pool.query(
    `SELECT * FROM analytics.dpp_attempts
      WHERE user_id = $1 AND dpp_id = $2
      ORDER BY created_at DESC
      LIMIT 1`,
    [userId, dppId],
  );
  const row = result.rows[0];
  if (!row) {
    return null;
  }
  return mapPersistedDppAttemptRow(row);
}

export async function listLatestDppAttemptsForPlans(
  userId: string,
  dppIds: string[],
): Promise<Map<string, PersistedDppAttemptRecord>> {
  await ensureSchema();
  const pool = getPoolOrThrow();
  const uniqueIds = [...new Set(dppIds.filter(Boolean))];
  if (uniqueIds.length === 0) {
    return new Map();
  }

  const result = await pool.query(
    `SELECT DISTINCT ON (dpp_id) *
       FROM analytics.dpp_attempts
      WHERE user_id = $1 AND dpp_id = ANY($2::text[])
      ORDER BY dpp_id, created_at DESC`,
    [userId, uniqueIds],
  );

  return new Map(
    result.rows.map((row) => [
      String(row.dpp_id),
      mapPersistedDppAttemptRow(row),
    ]),
  );
}

export async function getOriginAiAnalyticsSnapshot(userId: string): Promise<OriginAiAnalyticsSnapshot | null> {
  await ensureSchema();
  await pruneDppPlansForUser(userId);
  const pool = getPoolOrThrow();
  const [latestResult, pendingDppRows, latestDppAttempt] = await Promise.all([
    pool.query(
      `SELECT analytics_context, summary
         FROM analytics.test_results
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT 1`,
      [userId],
    ),
    pool.query(
      `SELECT weak_topics
         FROM analytics.dpp_plans
        WHERE user_id = $1 AND completed = FALSE
        ORDER BY created_at DESC, sequence ASC`,
      [userId],
    ),
    pool.query(
      `SELECT summary, progress_score
         FROM analytics.dpp_attempts
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT 1`,
      [userId],
    ),
  ]);

  if (!latestResult.rows[0] && pendingDppRows.rowCount === 0 && !latestDppAttempt.rows[0]) {
    return null;
  }

  const analyticsContext = fromJsonObject<AnalyticsContextPayload>(latestResult.rows[0]?.analytics_context, {
    summary: latestResult.rows[0]?.summary ?? "",
    latest_weak_topics: [],
    latest_strong_topics: [],
    recommended_revision_topics: [],
    pending_dpp_focus: [],
  });

  const pendingFocus = pendingDppRows.rows.flatMap((row) => fromJsonArray<string>(row.weak_topics));
  const pendingDppCount = pendingDppRows.rowCount ?? 0;
  return {
    latestWeakTopics: analyticsContext.latest_weak_topics ?? [],
    latestStrongTopics: analyticsContext.latest_strong_topics ?? [],
    latestTestSummary: analyticsContext.summary || latestResult.rows[0]?.summary || null,
    pendingDppCount,
    pendingDppFocusTopics: [...new Set(pendingFocus)].slice(0, 6),
    recentDppProgressSummary: latestDppAttempt.rows[0]
      ? `${latestDppAttempt.rows[0].summary} Progress ${Number(latestDppAttempt.rows[0].progress_score ?? 0).toFixed(0)}%.`
      : null,
  };
}
