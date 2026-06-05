import type { PoolClient } from "pg";

import {
  AnalyticsContractError,
  analyzeDppAttemptWithService,
  analyzeSubmittedTestWithService,
  type AnalyticsDppAttemptRequest,
  type AnalyticsTestAnalysisRequest,
} from "@/server/analytics-client";
import {
  persistDppAttemptResult,
  persistTestAnalysisResult,
  type PersistDppAttemptInput,
  type PersistTestAnalysisInput,
} from "@/server/analytics-store";
import { getOgcodePostgresPool } from "@/server/postgres";
import { createId } from "@/server/store";
import { metric } from "@/lib/metrics";

declare global {
  var __originAnalysisJobsSchemaReady: Promise<void> | undefined;
}

const MAX_ANALYSIS_ATTEMPTS = 5;

const ANALYSIS_JOBS_SCHEMA_SQL = `
CREATE SCHEMA IF NOT EXISTS app;

CREATE TABLE IF NOT EXISTS app.analysis_jobs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('test','dpp','custom_test')),
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  result JSONB,
  error TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_analysis_jobs_status_created
  ON app.analysis_jobs(status, created_at);
`;

export type AnalysisJobKind = "test" | "dpp" | "custom_test";

type TestAnalysisJobPayload = {
  resultId: string;
  persistInput: PersistTestAnalysisInput;
  request: AnalyticsTestAnalysisRequest;
};

type DppAnalysisJobPayload = {
  attemptId: string;
  persistInput: PersistDppAttemptInput;
  request: AnalyticsDppAttemptRequest;
};

type AnalysisJobPayload = TestAnalysisJobPayload | DppAnalysisJobPayload | Record<string, unknown>;

type AnalysisJobRow = {
  id: string;
  user_id: string;
  kind: AnalysisJobKind;
  payload: AnalysisJobPayload;
  attempts: number;
};

export type EnqueueAnalysisJobInput = {
  id?: string;
  userId: string;
  kind: AnalysisJobKind;
  payload: AnalysisJobPayload;
};

export type AnalysisWorkerResult = {
  claimed: number;
  completed: number;
  retried: number;
  failed: number;
};

function getPoolOrThrow() {
  const pool = getOgcodePostgresPool();
  if (!pool) {
    throw new Error("OGCODE_DATABASE_URL is not configured.");
  }
  return pool;
}

async function ensureAnalysisJobsSchema(client?: PoolClient): Promise<void> {
  if (client) {
    await client.query(ANALYSIS_JOBS_SCHEMA_SQL);
    return;
  }

  if (!globalThis.__originAnalysisJobsSchemaReady) {
    globalThis.__originAnalysisJobsSchemaReady = getPoolOrThrow()
      .query(ANALYSIS_JOBS_SCHEMA_SQL)
      .then(() => undefined)
      .catch((error) => {
        globalThis.__originAnalysisJobsSchemaReady = undefined;
        throw error;
      });
  }
  await globalThis.__originAnalysisJobsSchemaReady;
}

function normalizePayload(value: unknown): AnalysisJobPayload {
  if (typeof value === "string") {
    return JSON.parse(value) as AnalysisJobPayload;
  }
  if (value && typeof value === "object") {
    return value as AnalysisJobPayload;
  }
  return {};
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function toTestJobPayload(payload: AnalysisJobPayload): TestAnalysisJobPayload {
  if (
    "resultId" in payload &&
    typeof payload.resultId === "string" &&
    "persistInput" in payload &&
    "request" in payload
  ) {
    return payload as TestAnalysisJobPayload;
  }
  throw new Error("Invalid test analysis job payload.");
}

function toDppJobPayload(payload: AnalysisJobPayload): DppAnalysisJobPayload {
  if (
    "attemptId" in payload &&
    typeof payload.attemptId === "string" &&
    "persistInput" in payload &&
    "request" in payload
  ) {
    return payload as DppAnalysisJobPayload;
  }
  throw new Error("Invalid DPP analysis job payload.");
}

export async function enqueueAnalysisJob(input: EnqueueAnalysisJobInput): Promise<string> {
  const pool = getPoolOrThrow();
  await ensureAnalysisJobsSchema();
  const id = input.id ?? createId("analysis_job");

  await pool.query(
    `INSERT INTO app.analysis_jobs (id, user_id, kind, payload, status, attempts, error, completed_at)
     VALUES ($1, $2, $3, $4::jsonb, 'pending', 0, NULL, NULL)
     ON CONFLICT (id) DO UPDATE SET
       user_id = EXCLUDED.user_id,
       kind = EXCLUDED.kind,
       payload = EXCLUDED.payload,
       status = 'pending',
       attempts = 0,
       error = NULL,
       completed_at = NULL`,
    [id, input.userId, input.kind, JSON.stringify(input.payload)],
  );

  return id;
}

async function claimNextAnalysisJob(): Promise<AnalysisJobRow | null> {
  const pool = getPoolOrThrow();
  await ensureAnalysisJobsSchema();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await ensureAnalysisJobsSchema(client);
    const claimed = await client.query(
      `SELECT id, user_id, kind, payload, attempts
         FROM app.analysis_jobs
        WHERE status = 'pending' AND attempts < $1
        ORDER BY created_at ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED`,
      [MAX_ANALYSIS_ATTEMPTS],
    );

    const row = claimed.rows[0];
    if (!row) {
      await client.query("COMMIT");
      return null;
    }

    const updated = await client.query(
      `UPDATE app.analysis_jobs
          SET status = 'running', attempts = attempts + 1, error = NULL
        WHERE id = $1
        RETURNING id, user_id, kind, payload, attempts`,
      [row.id],
    );
    await client.query("COMMIT");

    const updatedRow = updated.rows[0];
    return {
      id: String(updatedRow.id),
      user_id: String(updatedRow.user_id),
      kind: String(updatedRow.kind) as AnalysisJobKind,
      payload: normalizePayload(updatedRow.payload),
      attempts: Number(updatedRow.attempts ?? 0),
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function completeAnalysisJob(jobId: string, result: Record<string, unknown>): Promise<void> {
  const pool = getPoolOrThrow();
  await pool.query(
    `UPDATE app.analysis_jobs
        SET status = 'complete', result = $2::jsonb, error = NULL, completed_at = NOW()
      WHERE id = $1`,
    [jobId, JSON.stringify(result)],
  );
}

async function retryOrFailAnalysisJob(job: AnalysisJobRow, error: unknown): Promise<"retried" | "failed"> {
  const message = errorMessage(error);
  const exhausted = job.attempts >= MAX_ANALYSIS_ATTEMPTS || error instanceof AnalyticsContractError;
  const status = exhausted ? "failed" : "pending";
  const pool = getPoolOrThrow();

  await pool.query(
    `UPDATE app.analysis_jobs
        SET status = $2, error = $3, completed_at = CASE WHEN $2 = 'failed' THEN NOW() ELSE NULL END
      WHERE id = $1`,
    [job.id, status, message],
  );

  if (exhausted) {
    if (job.kind === "test") {
      const payload = toTestJobPayload(job.payload);
      await persistTestAnalysisResult({
        ...payload.persistInput,
        id: payload.resultId,
        analysisStatus: "failed",
        analysisError: message,
      });
    } else if (job.kind === "dpp") {
      const payload = toDppJobPayload(job.payload);
      await persistDppAttemptResult({
        ...payload.persistInput,
        id: payload.attemptId,
        analysisStatus: "failed",
        analysisError: message,
      });
    }
    metric("origin.analysis_job.failed", { kind: job.kind });
    return "failed";
  }

  metric("origin.analysis_job.retry", { kind: job.kind });
  return "retried";
}

async function processTestAnalysisJob(job: AnalysisJobRow): Promise<Record<string, unknown>> {
  const payload = toTestJobPayload(job.payload);
  const response = await analyzeSubmittedTestWithService(payload.request);
  if (!response) {
    throw new Error("Analytics service is not configured.");
  }

  await persistTestAnalysisResult({
    ...payload.persistInput,
    id: payload.resultId,
    weakAreas: response.weak_topics.map((topic) => ({ topic: topic.topic, accuracy: Math.round(topic.accuracy) })),
    strongAreas: response.strong_topics.map((topic) => ({ topic: topic.topic, accuracy: Math.round(topic.accuracy) })),
    aiAnalysis: {
      summary:
        response.summary ||
        payload.persistInput.aiAnalysis.summary ||
        "Your detailed analytics are ready.",
      mistakes: payload.persistInput.aiAnalysis.mistakes,
      reviewEntries: payload.persistInput.aiAnalysis.reviewEntries,
      recommendations: response.recommendations,
      dppGenerated: response.dpp_plans.length > 0,
      degraded: response.degraded ?? payload.persistInput.aiAnalysis.degraded ?? false,
      degradedReason: response.degraded_reason ?? payload.persistInput.aiAnalysis.degradedReason ?? null,
      degraded_reason: response.degraded_reason ?? payload.persistInput.aiAnalysis.degraded_reason ?? null,
    },
    recommendations: response.recommendations,
    analyticsContext: response.analytics_context,
    weakTopics: response.weak_topics,
    strongTopics: response.strong_topics,
    dppPlans: response.dpp_plans,
    degraded: response.degraded ?? payload.persistInput.degraded,
    degradedReason: response.degraded_reason ?? payload.persistInput.degradedReason,
    analysisStatus: "complete",
    analysisError: null,
  });

  // Phase 14 (2E): when this submission carries cohort context (a teacher-assigned
  // test or a teacher room), populate the teacher cohort analytics in the
  // background. Best-effort + flag-gated + dynamically imported so it never blocks
  // or fails the student's own analysis, and adds zero cost while shipping dark.
  await maybePopulateCohortAnalytics(payload);

  return {
    resultId: payload.resultId,
    dppPlanCount: response.dpp_plans.length,
  };
}

async function maybePopulateCohortAnalytics(payload: TestAnalysisJobPayload): Promise<void> {
  const { workspaceId, batchId } = payload.persistInput;
  if (!workspaceId || !batchId) return;
  try {
    const { isFeatureEnabled } = await import("@/lib/feature-flags");
    if (!isFeatureEnabled("teacherConnect")) return;
    const { populateCohortAnalytics } = await import("@/server/workspaces/cohort-analytics");
    const snapshotType = payload.request.source_type === "room_test" ? "room_result" : "test_result";
    await populateCohortAnalytics(payload.resultId, snapshotType);
  } catch (error) {
    metric("origin.cohort_analytics.populate_failed", { kind: "test" });
    console.warn("[analysis-jobs] cohort analytics population skipped:", error);
  }
}

async function processDppAnalysisJob(job: AnalysisJobRow): Promise<Record<string, unknown>> {
  const payload = toDppJobPayload(job.payload);
  const response = await analyzeDppAttemptWithService(payload.request);
  if (!response) {
    throw new Error("Analytics service is not configured.");
  }

  await persistDppAttemptResult({
    ...payload.persistInput,
    id: payload.attemptId,
    response,
    analysisStatus: "complete",
    analysisError: null,
  });

  return {
    attemptId: payload.attemptId,
    completed: response.completed,
  };
}

async function processAnalysisJob(job: AnalysisJobRow): Promise<Record<string, unknown>> {
  if (job.kind === "test") {
    return processTestAnalysisJob(job);
  }
  if (job.kind === "dpp") {
    return processDppAnalysisJob(job);
  }
  throw new Error(`Unsupported analysis job kind: ${job.kind}`);
}

export async function drainAnalysisJobs(limit = 5): Promise<AnalysisWorkerResult> {
  const result: AnalysisWorkerResult = {
    claimed: 0,
    completed: 0,
    retried: 0,
    failed: 0,
  };
  const jobLimit = Math.max(1, Math.min(25, Math.trunc(limit)));

  for (let index = 0; index < jobLimit; index += 1) {
    const job = await claimNextAnalysisJob();
    if (!job) {
      break;
    }

    result.claimed += 1;
    try {
      const jobResult = await processAnalysisJob(job);
      await completeAnalysisJob(job.id, jobResult);
      result.completed += 1;
      metric("origin.analysis_job.complete", { kind: job.kind });
    } catch (error) {
      const outcome = await retryOrFailAnalysisJob(job, error);
      if (outcome === "failed") {
        result.failed += 1;
      } else {
        result.retried += 1;
      }
    }
  }

  return result;
}

export async function drainOneAnalysisJobWithTimeout(timeoutMs = 3500): Promise<AnalysisWorkerResult | null> {
  if (process.env.ORIGIN_ANALYSIS_OPPORTUNISTIC_DRAIN === "false") {
    return null;
  }

  let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([
      drainAnalysisJobs(1),
      new Promise<null>((resolve) => {
        timeoutHandle = setTimeout(() => resolve(null), Math.max(250, timeoutMs));
      }),
    ]);
  } catch {
    return null;
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }
}
