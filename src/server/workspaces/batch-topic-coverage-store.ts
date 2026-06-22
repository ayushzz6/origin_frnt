/**
 * Teacher-authored "covered in next class" flags for a batch's weak topics.
 *
 * This is teacher metadata (not analytics-service output), so it lives in the USER
 * database (`app.batch_topic_coverage`). The weak-topic accuracy itself is computed
 * read-time from the OGCODE pool (batch-cohort-store); coverage is merged in app
 * code by subject+topic — no cross-database join.
 */

import type { Pool } from "pg";

import { getUserPostgresPool, isUserPostgresConfigured } from "@/server/user-postgres";

declare global {
  var __originBatchCoverageSchemaEnsured: boolean | undefined;
  var __originBatchCoverageSchemaPromise: Promise<void> | undefined;
}

function pool(): Pool {
  const p = getUserPostgresPool();
  if (!p) throw new Error("USER_DATABASE_URL is not configured");
  return p;
}

/** Stable map key for a (subject, topic) pair, case-insensitive on subject. */
export function coverageKey(subject: string, topic: string): string {
  return `${(subject ?? "").toLowerCase()}|||${topic ?? ""}`;
}

export async function ensureBatchTopicCoverageSchema(): Promise<void> {
  if (!isUserPostgresConfigured()) return;
  if (globalThis.__originBatchCoverageSchemaEnsured) return;
  if (!globalThis.__originBatchCoverageSchemaPromise) {
    globalThis.__originBatchCoverageSchemaPromise = (async () => {
      await pool().query(`
        CREATE TABLE IF NOT EXISTS app.batch_topic_coverage (
          id BIGSERIAL PRIMARY KEY,
          workspace_id TEXT NOT NULL REFERENCES app.teacher_workspaces(id) ON DELETE CASCADE,
          batch_id TEXT NOT NULL REFERENCES app.batches(id) ON DELETE CASCADE,
          subject TEXT NOT NULL,
          topic TEXT NOT NULL,
          covered BOOLEAN NOT NULL DEFAULT FALSE,
          covered_at TIMESTAMPTZ,
          updated_by TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          UNIQUE (workspace_id, batch_id, subject, topic)
        );
        CREATE INDEX IF NOT EXISTS idx_batch_topic_coverage_batch
          ON app.batch_topic_coverage(workspace_id, batch_id);
      `);
      globalThis.__originBatchCoverageSchemaEnsured = true;
    })().catch((error) => {
      globalThis.__originBatchCoverageSchemaPromise = undefined;
      throw error;
    });
  }
  await globalThis.__originBatchCoverageSchemaPromise;
}

/** Coverage flags for a batch, keyed by coverageKey(subject, topic). */
export async function getBatchTopicCoverage(
  workspaceId: string,
  batchId: string,
): Promise<Map<string, boolean>> {
  await ensureBatchTopicCoverageSchema();
  const map = new Map<string, boolean>();
  const res = await pool().query(
    `SELECT subject, topic, covered FROM app.batch_topic_coverage
      WHERE workspace_id = $1 AND batch_id = $2`,
    [workspaceId, batchId],
  );
  for (const row of res.rows) {
    map.set(coverageKey(row.subject as string, row.topic as string), Boolean(row.covered));
  }
  return map;
}

/** Upsert the covered flag for one (subject, topic) in a batch. */
export async function setBatchTopicCoverage(input: {
  workspaceId: string;
  batchId: string;
  subject: string;
  topic: string;
  covered: boolean;
  userId?: string | null;
}): Promise<void> {
  await ensureBatchTopicCoverageSchema();
  await pool().query(
    `INSERT INTO app.batch_topic_coverage
       (workspace_id, batch_id, subject, topic, covered, covered_at, updated_by, updated_at)
     VALUES ($1,$2,$3,$4,$5, CASE WHEN $5 THEN NOW() ELSE NULL END, $6, NOW())
     ON CONFLICT (workspace_id, batch_id, subject, topic)
     DO UPDATE SET covered = EXCLUDED.covered,
                   covered_at = CASE WHEN EXCLUDED.covered THEN NOW() ELSE NULL END,
                   updated_by = EXCLUDED.updated_by,
                   updated_at = NOW()`,
    [input.workspaceId, input.batchId, input.subject, input.topic, input.covered, input.userId ?? null],
  );
}
