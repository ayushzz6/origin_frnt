/**
 * Phase 14 (2E, PLAN section G): teacher-cohort analytics population.
 *
 * Runs in the background AFTER a tagged test/room result has been analysed (hooked
 * from src/server/analysis-jobs.ts → processTestAnalysisJob). It performs NO new
 * compute — it only aggregates the per-topic analytics the analytics-service already
 * produced (analytics.test_topic_analytics) into the Phase-8 teacher tables:
 *
 *   1. recompute the submitting student's analytics.student_topic_profiles
 *      (full recompute from all their cohort results → idempotent per attempt),
 *   2. recompute analytics.batch_topic_snapshots for the touched subject from
 *      app.batch_members ⋈ student_topic_profiles,
 *   3. recompute the analytics.leaderboard_snapshots for the batch.
 *
 * Cross-pool (`analytics.* ⋈ app.* ⋈ origin_users`) reads are valid only under the
 * same-physical-DB invariant — guarded by assertCohortAnalyticsDbInvariant().
 */

import { getUserPostgresPool } from "@/server/user-postgres";
import { assertCohortAnalyticsDbInvariant } from "@/server/db-invariant";

import { ensureAnalyticsSchema } from "./analytics-schema";
import {
  computeBatchLeaderboard,
  upsertBatchTopicSnapshot,
  upsertStudentTopicProfile,
  createLeaderboardSnapshot,
} from "./analytics-store";

/** Which result kind triggered population — selects the snapshot_type tags. */
export type CohortSnapshotType = "test_result" | "room_result";

function pool() {
  const p = getUserPostgresPool();
  if (!p) throw new Error("USER_DATABASE_URL is not configured");
  return p;
}

/** Severity from a 0–1 accuracy, mirroring assessments.severityFromAccuracy (0–100). */
function severityFromAccuracy(accuracy01: number): "high" | "medium" | "low" {
  const pct = accuracy01 * 100;
  if (pct < 35) return "high";
  if (pct < 60) return "medium";
  return "low";
}

export async function populateCohortAnalytics(
  resultId: string,
  snapshotType: CohortSnapshotType,
): Promise<void> {
  if (!assertCohortAnalyticsDbInvariant()) return;
  await ensureAnalyticsSchema();
  const p = pool();

  // 1. Cohort context of the triggering result. No workspace/batch → not a cohort
  //    submission; nothing to populate.
  const resultRow = await p.query(
    `SELECT user_id, workspace_id, batch_id, subject
       FROM analytics.test_results
      WHERE id = $1`,
    [resultId],
  );
  const result = resultRow.rows[0];
  if (!result || !result.workspace_id || !result.batch_id) return;

  const studentId = result.user_id as string;
  const workspaceId = result.workspace_id as string;
  const batchId = result.batch_id as string;
  const subject = String(result.subject ?? "").toLowerCase();

  // 2. Recompute this student's topic profiles from ALL their cohort results
  //    (idempotent: full recompute from source → ON CONFLICT replaces).
  const studentTopics = await p.query(
    `SELECT tta.subject,
            tta.topic,
            MAX(tta.chapter) AS chapter,
            MAX(tta.concept) AS concept,
            SUM(tta.attempts)::int AS total_attempts,
            SUM(ROUND(tta.accuracy / 100.0 * tta.attempts))::int AS correct_attempts,
            AVG(tta.average_time_seconds)::float8 AS avg_time,
            MAX(tr.created_at) AS last_attempt_at
       FROM analytics.test_topic_analytics tta
       JOIN analytics.test_results tr ON tr.id = tta.test_result_id
      WHERE tr.user_id = $1 AND tr.workspace_id = $2 AND tr.batch_id = $3
        AND tr.is_malpractice = FALSE
      GROUP BY tta.subject, tta.topic`,
    [studentId, workspaceId, batchId],
  );

  for (const row of studentTopics.rows) {
    const totalAttempts = Number(row.total_attempts) || 0;
    const correctAttempts = Number(row.correct_attempts) || 0;
    const accuracy = totalAttempts > 0 ? correctAttempts / totalAttempts : 0;
    await upsertStudentTopicProfile({
      workspaceId,
      studentId,
      batchId,
      topic: row.topic as string,
      subject: row.subject as string,
      chapter: (row.chapter as string | null) ?? null,
      concept: (row.concept as string | null) ?? null,
      totalAttempts,
      correctAttempts,
      accuracy,
      averageTimeSeconds: Number(row.avg_time) || 0,
      lastAttemptAt: row.last_attempt_at ? new Date(row.last_attempt_at as string).toISOString() : null,
      masteryScore: accuracy,
    });
  }

  // 3. Recompute batch topic snapshots for the touched subject by aggregating
  //    active batch members' profiles. Appended as a fresh snapshot (the Phase-8
  //    tables are append-only time series; newest-wins on read).
  if (subject) {
    const batchTopics = await p.query(
      `SELECT stp.subject,
              stp.topic,
              MAX(stp.chapter) AS chapter,
              MAX(stp.concept) AS concept,
              SUM(stp.total_attempts)::int AS attempts,
              CASE WHEN SUM(stp.total_attempts) > 0
                   THEN SUM(stp.correct_attempts)::float8 / SUM(stp.total_attempts)
                   ELSE 0 END AS accuracy,
              AVG(stp.average_time_seconds)::float8 AS avg_time
         FROM analytics.student_topic_profiles stp
         JOIN app.batch_members bm
           ON bm.student_id = stp.student_id
          AND bm.batch_id = $2 AND bm.workspace_id = $1 AND bm.status = 'active'
        WHERE stp.workspace_id = $1 AND stp.batch_id = $2 AND stp.subject = $3
        GROUP BY stp.subject, stp.topic`,
      [workspaceId, batchId, subject],
    );

    for (const row of batchTopics.rows) {
      const accuracy = Number(row.accuracy) || 0;
      await upsertBatchTopicSnapshot({
        workspaceId,
        batchId,
        snapshotType,
        topic: row.topic as string,
        subject: row.subject as string,
        chapter: (row.chapter as string | null) ?? null,
        concept: (row.concept as string | null) ?? null,
        accuracy,
        attempts: Number(row.attempts) || 0,
        averageTimeSeconds: Number(row.avg_time) || 0,
        severity: severityFromAccuracy(accuracy),
      });
    }
  }

  // 4. Recompute the batch leaderboard snapshot from the freshly-tagged results.
  const entries = await computeBatchLeaderboard(workspaceId, batchId);
  await createLeaderboardSnapshot({
    workspaceId,
    batchId,
    snapshotType: snapshotType === "room_result" ? "room" : "test",
    entries: entries as unknown as Record<string, unknown>[],
  });
}
