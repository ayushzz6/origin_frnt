import type { DifficultyLevel } from "@/server/store";
import { getRequestId, REQUEST_ID_HEADER } from "@/lib/request-id";

export type AnalyticsDifficulty = DifficultyLevel;

export interface AnalyticsTopicSignal {
  topic: string;
  subject: string;
  chapter?: string | null;
  concept?: string | null;
  accuracy: number;
  attempts: number;
  average_time_seconds: number;
  bkt_mastery: number;
  expected_correctness: number;
  severity: "high" | "medium" | "low";
  anomaly: boolean;
  recommendation_seed: string;
}

export interface AnalyticsSubjectStats {
  score: number;
  total_marks: number;
  correct: number;
  incorrect: number;
  unattempted: number;
  total_qs: number;
  accuracy: number;
  total_time_spent: number;
}

export interface AnalyticsDppPlan {
  id: string;
  title: string;
  subject: string;
  summary: string;
  question_ids: string[];
  weak_topics: string[];
  generated_from: string[];
  duration_minutes: number;
  target_question_count: number;
  sequence: number;
  degraded?: boolean;
  degraded_reason?: string | null;
}

export interface AnalyticsContextPayload {
  summary: string;
  latest_weak_topics: string[];
  latest_strong_topics: string[];
  recommended_revision_topics: string[];
  pending_dpp_focus: string[];
}

export interface AnalyticsCustomTestRequest {
  user_id: string;
  subject: string;
  difficulty?: AnalyticsDifficulty | null;
  chapter?: string | null;
  question_count: number;
  recent_weak_topics: string[];
  attempted_question_ids: string[];
}

export interface AnalyticsCustomTestResponse {
  title: string;
  description: string;
  subject: string;
  chapter?: string | null;
  difficulty: AnalyticsDifficulty;
  question_ids: string[];
  duration_minutes: number;
  focus_topics: string[];
  generation_summary: string;
  recommended_time_per_question_seconds: number;
}

export interface AnalyticsGradedAttempt {
  question_id: string;
  subject: string;
  chapter: string;
  concept: string;
  difficulty: AnalyticsDifficulty;
  question_type: string;
  answered: boolean;
  is_correct: boolean;
  credit_awarded: number;
  marks_awarded: number;
  max_marks: number;
  needs_review?: boolean;
  grading_source?: string | null;
  scoring_policy?: {
    correct_marks: number;
    incorrect_marks: number;
    unattempted_marks: number;
    partial_credit_policy?: string;
    negative_marking_mode?: string;
  };
  time_spent_seconds: number;
}

export interface AnalyticsTestAnalysisRequest {
  user_id: string;
  test_id: string;
  title: string;
  subject: string;
  chapter?: string | null;
  difficulty: AnalyticsDifficulty;
  question_count: number;
  time_taken_seconds: number;
  graded_attempts: AnalyticsGradedAttempt[];
  source_type?: string;
  room_id?: string | null;
  scoring_policy?: {
    correct_marks: number;
    incorrect_marks: number;
    unattempted_marks: number;
    partial_credit_policy?: string;
    negative_marking_mode?: string;
  };
  is_malpractice?: boolean;
}

export interface AnalyticsTestAnalysisResponse {
  weak_topics: AnalyticsTopicSignal[];
  strong_topics: AnalyticsTopicSignal[];
  subject_stats: Record<string, AnalyticsSubjectStats>;
  summary: string;
  recommendations: string[];
  dpp_plans: AnalyticsDppPlan[];
  analytics_context: AnalyticsContextPayload;
  degraded?: boolean;
  degraded_reason?: string | null;
}

export interface AnalyticsDppAttemptRequest {
  user_id: string;
  dpp_id: string;
  title: string;
  source_test_result_id?: string | null;
  focus_topics: string[];
  graded_attempts: AnalyticsGradedAttempt[];
  time_taken_seconds: number;
  source_type?: string;
  scoring_policy?: {
    correct_marks: number;
    incorrect_marks: number;
    unattempted_marks: number;
    partial_credit_policy?: string;
    negative_marking_mode?: string;
  };
}

export interface AnalyticsDppAttemptResponse {
  weak_topics: AnalyticsTopicSignal[];
  strong_topics: AnalyticsTopicSignal[];
  summary: string;
  recommendations: string[];
  resolved_topics: string[];
  still_weak_topics: string[];
  progress_score: number;
  completed: boolean;
}

function isAnalyticsConfigured(): boolean {
  return Boolean(process.env.ANALYTICS_SERVICE_URL);
}

const ANALYTICS_CIRCUIT_FAILURE_THRESHOLD = Number(process.env.ANALYTICS_SERVICE_CIRCUIT_FAILURES ?? 3);
const ANALYTICS_CIRCUIT_OPEN_MS = Number(process.env.ANALYTICS_SERVICE_CIRCUIT_OPEN_MS ?? 30_000);

let analyticsConsecutiveFailures = 0;
let analyticsCircuitOpenUntil = 0;

export class AnalyticsContractError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "AnalyticsContractError";
    this.status = status;
  }
}

function buildHeaders(requestId: string): HeadersInit {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    [REQUEST_ID_HEADER]: requestId,
  };

  if (process.env.ANALYTICS_SERVICE_TOKEN) {
    headers.Authorization = `Bearer ${process.env.ANALYTICS_SERVICE_TOKEN}`;
  }

  return headers;
}

function recordAnalyticsServiceFailure() {
  analyticsConsecutiveFailures += 1;
  if (analyticsConsecutiveFailures >= ANALYTICS_CIRCUIT_FAILURE_THRESHOLD) {
    analyticsCircuitOpenUntil = Date.now() + ANALYTICS_CIRCUIT_OPEN_MS;
  }
}

function recordAnalyticsServiceSuccess() {
  analyticsConsecutiveFailures = 0;
  analyticsCircuitOpenUntil = 0;
}

async function checkAnalyticsHealth(): Promise<boolean> {
  if (!isAnalyticsConfigured()) {
    return false;
  }
  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), 1000);
  try {
    const response = await fetch(`${process.env.ANALYTICS_SERVICE_URL}/health`, {
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

async function analyticsServiceAvailableForAttempt(): Promise<boolean> {
  if (!isAnalyticsConfigured()) {
    return false;
  }

  if (!process.env.ANALYTICS_SERVICE_TOKEN) {
    throw new Error('[analytics-client] ANALYTICS_SERVICE_TOKEN must be set when ANALYTICS_SERVICE_URL is configured');
  }

  if (analyticsCircuitOpenUntil <= Date.now()) {
    return true;
  }

  const healthy = await checkAnalyticsHealth();
  if (healthy) {
    recordAnalyticsServiceSuccess();
  }
  return healthy;
}

async function analyticsRequest<TResponse, TBody extends object>(
  path: string,
  body: TBody,
): Promise<TResponse | null> {
  if (!(await analyticsServiceAvailableForAttempt())) {
    return null;
  }

  const timeoutMs = Number(process.env.ANALYTICS_SERVICE_TIMEOUT_MS ?? 3000);
  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);
  const requestId = getRequestId();

  try {
    const response = await fetch(`${process.env.ANALYTICS_SERVICE_URL}${path}`, {
      method: "POST",
      headers: buildHeaders(requestId),
      body: JSON.stringify(body),
      cache: "no-store",
      signal: controller.signal,
    });

    if (!response.ok) {
      const message = await response.text().catch(() => "");
      const errorMsg = message || `Analytics service request failed for ${path}.`;
      if (response.status >= 400 && response.status < 500) {
        throw new AnalyticsContractError(errorMsg, response.status);
      }
      console.error('[analytics-client] Analytics service returned error status', {
        requestId,
        status: response.status,
        path,
      });
      recordAnalyticsServiceFailure();
      throw new Error(errorMsg);
    }

    recordAnalyticsServiceSuccess();
    return (await response.json()) as TResponse;
  } catch (err) {
    if (err instanceof AnalyticsContractError) {
      throw err;
    }
    recordAnalyticsServiceFailure();
    console.error('[analytics-client] Analytics service call failed', {
      requestId,
      error: err instanceof Error ? err.message : String(err),
      path,
    });
    throw err;
  } finally {
    clearTimeout(timeoutHandle);
  }
}

export async function generateCustomTestWithService(
  payload: AnalyticsCustomTestRequest,
): Promise<AnalyticsCustomTestResponse | null> {
  return analyticsRequest<AnalyticsCustomTestResponse, AnalyticsCustomTestRequest>(
    "/v1/custom-tests/generate",
    payload,
  );
}

export async function analyzeSubmittedTestWithService(
  payload: AnalyticsTestAnalysisRequest,
): Promise<AnalyticsTestAnalysisResponse | null> {
  return analyticsRequest<AnalyticsTestAnalysisResponse, AnalyticsTestAnalysisRequest>(
    "/v1/tests/analyze",
    payload,
  );
}

export async function analyzeDppAttemptWithService(
  payload: AnalyticsDppAttemptRequest,
): Promise<AnalyticsDppAttemptResponse | null> {
  return analyticsRequest<AnalyticsDppAttemptResponse, AnalyticsDppAttemptRequest>(
    "/v1/dpps/analyze-attempt",
    payload,
  );
}
