/**
 * Batch-level teacher analytics, computed at READ time from the live source of
 * truth (analytics.test_results + analytics.test_topic_analytics in the OGCODE DB),
 * with student names merged from origin_users (USER DB).
 *
 * This replaces the Phase-8 pre-aggregated tables (batch_topic_snapshots /
 * student_topic_profiles / leaderboard_snapshots) populated by
 * populateCohortAnalytics, which cannot run in the split-DB production topology
 * (analytics tables live in origin_ogcode; app.* and origin_users in origin_users
 * — no cross-database joins). Read-time aggregation needs no background population and
 * works in both split (prod) and co-located (dev) topologies.
 *
 * Accuracy is returned as a 0–1 ratio to match the shapes the existing
 * AnalyticsCenterHighFidelity component already consumes.
 */

import type { Pool } from "pg";

import { getOgcodePostgresPool } from "@/server/postgres";
import { ensureAnalyticsTables } from "@/server/analytics-store";

import { fetchDisplayNames } from "./test-cohort-store";
import { getBatchTopicCoverage, coverageKey } from "./batch-topic-coverage-store";

function analyticsPool(): Pool {
  const p = getOgcodePostgresPool();
  if (!p) throw new Error("OGCODE_DATABASE_URL is not configured");
  return p;
}

function severityFromAccuracy(accuracyPct: number): "high" | "medium" | "low" {
  if (accuracyPct < 35) return "high";
  if (accuracyPct < 60) return "medium";
  return "low";
}

/** Matches the TopicSnapshot shape AnalyticsCenterHighFidelity consumes. */
export type BatchTopicSnapshotLite = {
  id: string;
  topic: string;
  subject: string;
  chapter: string | null;
  accuracy: number; // 0–1
  attempts: number;
  severity: "high" | "medium" | "low";
  snapshotAt: string;
  /** Teacher marked this topic as covered in the next class. */
  covered: boolean;
};

export type BatchLeaderboardEntryLite = {
  rank: number;
  studentId: string;
  displayName: string;
  meanPercentage: number;
  attempts: number;
  platformRank: number;
};

export type StudentTopicProfileLite = {
  topic: string;
  subject: string;
  chapter: string | null;
  totalAttempts: number;
  correctAttempts: number;
  accuracy: number; // 0–1
  masteryScore: number; // 0–1
  lastAttemptAt: string | null;
};

/**
 * Per-topic accuracy across all of a batch's analysed submissions, weakest first.
 * Backs both the mastery radar (all topics) and the weak-concept list (weakOnly).
 */
export async function getBatchTopicAccuracyLive(
  workspaceId: string,
  batchId: string,
  opts?: { subject?: string; weakOnly?: boolean },
): Promise<BatchTopicSnapshotLite[]> {
  await ensureAnalyticsTables();
  const params: unknown[] = [workspaceId, batchId];
  let subjectFilter = "";
  if (opts?.subject) {
    params.push(opts.subject);
    subjectFilter = ` AND tta.subject = $${params.length}`;
  }
  const result = await analyticsPool().query(
    `SELECT tta.subject, tta.topic, MAX(tta.chapter) AS chapter,
            AVG(tta.accuracy)::float8 AS avg_accuracy,
            SUM(tta.attempts)::int AS attempts
       FROM analytics.test_topic_analytics tta
       JOIN analytics.test_results tr ON tr.id = tta.test_result_id
      WHERE tr.workspace_id = $1 AND tr.batch_id = $2 AND tr.is_malpractice = FALSE${subjectFilter}
      GROUP BY tta.subject, tta.topic
      ORDER BY avg_accuracy ASC`,
    params,
  );
  const coverage = await getBatchTopicCoverage(workspaceId, batchId);
  const now = new Date().toISOString();
  const rows = result.rows.map((row) => {
    const accuracyPct = Number(row.avg_accuracy) || 0;
    const subject = row.subject as string;
    const topic = row.topic as string;
    return {
      id: `${subject}-${topic}`,
      topic,
      subject,
      chapter: (row.chapter as string | null) ?? null,
      accuracy: Math.round(accuracyPct) / 100,
      attempts: Number(row.attempts) || 0,
      severity: severityFromAccuracy(accuracyPct),
      snapshotAt: now,
      covered: coverage.get(coverageKey(subject, topic)) ?? false,
    };
  });
  return opts?.weakOnly ? rows.filter((r) => r.severity !== "low") : rows;
}

/**
 * Batch leaderboard — every student who has an analysed submission tagged to the
 * batch, ranked by mean test percentage (secondary platform rank by cumulative
 * score). No min-attempts floor: the teacher wants to see everyone who attempted.
 */
export async function getBatchLeaderboardLive(
  workspaceId: string,
  batchId: string,
): Promise<BatchLeaderboardEntryLite[]> {
  await ensureAnalyticsTables();
  const result = await analyticsPool().query(
    `SELECT tr.user_id,
            AVG(tr.percentage)::float8 AS mean_pct,
            SUM(tr.score)::float8      AS total_score,
            COUNT(*)::int             AS attempts
       FROM analytics.test_results tr
      WHERE tr.workspace_id = $1 AND tr.batch_id = $2 AND tr.is_malpractice = FALSE
      GROUP BY tr.user_id`,
    [workspaceId, batchId],
  );
  const names = await fetchDisplayNames(result.rows.map((r) => r.user_id as string));
  const rows = result.rows.map((row) => ({
    studentId: row.user_id as string,
    displayName: names.get(row.user_id as string) ?? "Student",
    meanPercentage: Math.round((Number(row.mean_pct) || 0) * 100) / 100,
    totalScore: Math.round((Number(row.total_score) || 0) * 100) / 100,
    attempts: Number(row.attempts) || 0,
  }));

  const platformOrder = [...rows].sort((a, b) => b.totalScore - a.totalScore);
  const platformRankById = new Map<string, number>();
  platformOrder.forEach((r, i) => platformRankById.set(r.studentId, i + 1));

  return rows
    .sort((a, b) => b.meanPercentage - a.meanPercentage || b.attempts - a.attempts)
    .map((r, i) => ({
      rank: i + 1,
      studentId: r.studentId,
      displayName: r.displayName,
      meanPercentage: r.meanPercentage,
      attempts: r.attempts,
      platformRank: platformRankById.get(r.studentId) ?? i + 1,
    }));
}

/**
 * A single student's per-topic profile across the workspace, weakest first — the
 * teacher's individual drill-down. Aggregated live from the student's analysed
 * submissions (OGCODE DB).
 */
export async function getStudentTopicProfileLive(
  workspaceId: string,
  studentId: string,
  subject?: string,
): Promise<StudentTopicProfileLite[]> {
  await ensureAnalyticsTables();
  const params: unknown[] = [workspaceId, studentId];
  let subjectFilter = "";
  if (subject) {
    params.push(subject);
    subjectFilter = ` AND tta.subject = $${params.length}`;
  }
  const result = await analyticsPool().query(
    `SELECT tta.subject, tta.topic, MAX(tta.chapter) AS chapter,
            SUM(tta.attempts)::int AS total_attempts,
            SUM(ROUND(tta.accuracy / 100.0 * tta.attempts))::int AS correct_attempts,
            AVG(tta.accuracy)::float8 AS avg_accuracy,
            MAX(tr.created_at) AS last_attempt_at
       FROM analytics.test_topic_analytics tta
       JOIN analytics.test_results tr ON tr.id = tta.test_result_id
      WHERE tr.workspace_id = $1 AND tr.user_id = $2 AND tr.is_malpractice = FALSE${subjectFilter}
      GROUP BY tta.subject, tta.topic
      ORDER BY avg_accuracy ASC, total_attempts DESC`,
    params,
  );
  return result.rows.map((row) => {
    const totalAttempts = Number(row.total_attempts) || 0;
    const correctAttempts = Number(row.correct_attempts) || 0;
    const accuracy = totalAttempts > 0 ? correctAttempts / totalAttempts : 0;
    return {
      topic: row.topic as string,
      subject: row.subject as string,
      chapter: (row.chapter as string | null) ?? null,
      totalAttempts,
      correctAttempts,
      accuracy,
      masteryScore: accuracy,
      lastAttemptAt: row.last_attempt_at ? new Date(row.last_attempt_at as string).toISOString() : null,
    };
  });
}
