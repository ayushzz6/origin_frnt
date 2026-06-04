/**
 * Non-blocking background queue for the connect (Flow-2) webhook (Phase 14, D).
 *
 * The webhook verifies the HMAC, records the event in the idempotency ledger, and
 * enqueues a job here — it never enrolls/assigns inline. The drain (cron + tests)
 * does the actual enroll/assign/teardown work. Mirrors the analysis-jobs.ts queue
 * pattern but runs in the USER pool (app.connect_jobs).
 *
 * Job handlers are resolved with dynamic import so this module does not statically
 * depend on enrollment-subscription-service (which enqueues into this queue).
 */

import type { PoolClient } from "pg";

import { getUserPostgresPool, isUserPostgresConfigured } from "@/server/user-postgres";
import { createConnectJobId } from "@/server/workspaces/ids";

import { ensureEnrollmentSubscriptionsSchema } from "./enrollment-subscriptions-schema";

const MAX_CONNECT_JOB_ATTEMPTS = 5;

export type ConnectJobKind = "enrollment_subscription_transition" | "ensure_offering_plan";

export type ConnectJobPayload = Record<string, unknown>;

type ConnectJobRow = {
  id: string;
  kind: ConnectJobKind;
  payload: ConnectJobPayload;
  attempts: number;
};

export type ConnectWorkerResult = {
  claimed: number;
  completed: number;
  retried: number;
  failed: number;
};

function pool() {
  const p = getUserPostgresPool();
  if (!p) throw new Error("USER_DATABASE_URL is not configured");
  return p;
}

function normalizePayload(value: unknown): ConnectJobPayload {
  if (typeof value === "string") return JSON.parse(value) as ConnectJobPayload;
  if (value && typeof value === "object") return value as ConnectJobPayload;
  return {};
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function enqueueConnectJob(input: {
  id?: string;
  kind: ConnectJobKind;
  payload: ConnectJobPayload;
}): Promise<string> {
  await ensureEnrollmentSubscriptionsSchema();
  const id = input.id ?? createConnectJobId();
  await pool().query(
    `INSERT INTO app.connect_jobs (id, kind, payload, status, attempts, error, completed_at)
     VALUES ($1, $2, $3::jsonb, 'pending', 0, NULL, NULL)
     ON CONFLICT (id) DO UPDATE SET
       kind = EXCLUDED.kind,
       payload = EXCLUDED.payload,
       status = 'pending',
       attempts = 0,
       error = NULL,
       completed_at = NULL`,
    [id, input.kind, JSON.stringify(input.payload)],
  );
  return id;
}

async function claimNextConnectJob(): Promise<ConnectJobRow | null> {
  await ensureEnrollmentSubscriptionsSchema();
  const client: PoolClient = await pool().connect();
  try {
    await client.query("BEGIN");
    const claimed = await client.query(
      `SELECT id, kind, payload, attempts
         FROM app.connect_jobs
        WHERE status = 'pending' AND attempts < $1
        ORDER BY created_at ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED`,
      [MAX_CONNECT_JOB_ATTEMPTS],
    );
    const row = claimed.rows[0];
    if (!row) {
      await client.query("COMMIT");
      return null;
    }
    const updated = await client.query(
      `UPDATE app.connect_jobs
          SET status = 'running', attempts = attempts + 1, error = NULL
        WHERE id = $1
        RETURNING id, kind, payload, attempts`,
      [row.id],
    );
    await client.query("COMMIT");
    const u = updated.rows[0];
    return {
      id: String(u.id),
      kind: String(u.kind) as ConnectJobKind,
      payload: normalizePayload(u.payload),
      attempts: Number(u.attempts ?? 0),
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

async function completeConnectJob(jobId: string): Promise<void> {
  await pool().query(
    `UPDATE app.connect_jobs SET status = 'complete', error = NULL, completed_at = NOW() WHERE id = $1`,
    [jobId],
  );
}

async function retryOrFailConnectJob(job: ConnectJobRow, error: unknown): Promise<"retried" | "failed"> {
  const message = errorMessage(error);
  const exhausted = job.attempts >= MAX_CONNECT_JOB_ATTEMPTS;
  const status = exhausted ? "failed" : "pending";
  await pool().query(
    `UPDATE app.connect_jobs
        SET status = $2, error = $3, completed_at = CASE WHEN $2 = 'failed' THEN NOW() ELSE NULL END
      WHERE id = $1`,
    [job.id, status, message],
  );
  return exhausted ? "failed" : "retried";
}

async function processConnectJob(job: ConnectJobRow): Promise<void> {
  // Dynamic import keeps this queue free of a static dependency on the service.
  const service = await import("./enrollment-subscription-service");
  if (job.kind === "enrollment_subscription_transition") {
    await service.handleEnrollmentSubscriptionTransitionJob(job.payload);
    return;
  }
  if (job.kind === "ensure_offering_plan") {
    await service.handleEnsureOfferingPlanJob(job.payload);
    return;
  }
  throw new Error(`Unsupported connect job kind: ${job.kind}`);
}

export async function drainConnectJobs(limit = 5): Promise<ConnectWorkerResult> {
  const result: ConnectWorkerResult = { claimed: 0, completed: 0, retried: 0, failed: 0 };
  if (!isUserPostgresConfigured()) return result;
  const jobLimit = Math.max(1, Math.min(25, Math.trunc(limit)));
  for (let index = 0; index < jobLimit; index += 1) {
    const job = await claimNextConnectJob();
    if (!job) break;
    result.claimed += 1;
    try {
      await processConnectJob(job);
      await completeConnectJob(job.id);
      result.completed += 1;
    } catch (error) {
      const outcome = await retryOrFailConnectJob(job, error);
      if (outcome === "failed") result.failed += 1;
      else result.retried += 1;
    }
  }
  return result;
}
