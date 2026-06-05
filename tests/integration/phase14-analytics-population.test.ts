/**
 * Phase 14 (2E) — teacher cohort analytics population + batch leaderboard.
 *
 * A tagged (workspace_id/batch_id) test result with per-topic analytics is
 * aggregated by populateCohortAnalytics into student_topic_profiles (idempotent),
 * batch_topic_snapshots, and leaderboard_snapshots; computeBatchLeaderboard ranks a
 * batch's students by trailing mean percentage with the min-2-attempts floor.
 *
 * Runs only when USER_DATABASE_URL is configured (CI + opt-in local). Pins the
 * OGCODE pool to the same DSN so analytics.* and app.* share one physical DB — the
 * production topology populateCohortAnalytics assumes.
 */

import test from "node:test";
import assert from "node:assert/strict";

process.env.TEACHER_LAUNCH_TEACHER_CONNECT = "1";
if (process.env.USER_DATABASE_URL) {
  process.env.OGCODE_DATABASE_URL = process.env.OGCODE_DATABASE_URL ?? process.env.USER_DATABASE_URL;
}

import { addStudentsToBatches } from "@/server/workspaces/batches";
import { ensureAnalyticsTables } from "@/server/analytics-store";
import {
  computeBatchLeaderboard,
  getBatchTopicSnapshots,
  getLeaderboardHistory,
  getStudentTopicProfile,
} from "@/server/workspaces/analytics-store";
import { populateCohortAnalytics } from "@/server/workspaces/cohort-analytics";

import { cleanup, closePool, dbConfigured, makeId, rawPool, seedFixtures } from "./_db";

const SKIP = !dbConfigured();
const it = test;

async function insertTaggedResult(opts: {
  resultId: string;
  studentId: string;
  workspaceId: string;
  batchId: string;
  subject: string;
  percentage: number;
  score: number;
  topics: Array<{ topic: string; accuracy: number; attempts: number }>;
}): Promise<void> {
  const pool = rawPool();
  await pool.query(
    `INSERT INTO analytics.test_results (
       id, user_id, test_id, title, subject, difficulty, question_count,
       score, percentage, correct_answers, wrong_answers, unattempted, total_marks,
       is_malpractice, workspace_id, batch_id
     ) VALUES ($1,$2,$3,'Cohort Test',$4,'medium',10,$5,$6,5,5,0,40,FALSE,$7,$8)
     ON CONFLICT (id) DO NOTHING`,
    [opts.resultId, opts.studentId, makeId("test"), opts.subject, opts.score, opts.percentage, opts.workspaceId, opts.batchId],
  );
  for (const t of opts.topics) {
    await pool.query(
      `INSERT INTO analytics.test_topic_analytics (
         test_result_id, topic, subject, chapter, concept, accuracy, attempts,
         average_time_seconds, bkt_mastery, expected_correctness, severity,
         anomaly, recommendation_seed, band
       ) VALUES ($1,$2,$3,NULL,NULL,$4,$5,60,$6,$6,'medium',FALSE,'seed','weak')`,
      [opts.resultId, t.topic, opts.subject, t.accuracy, t.attempts, t.accuracy / 100],
    );
  }
}

it("phase 14: cohort analytics populate from a tagged result; leaderboard ranks by mean %", { skip: SKIP }, async () => {
  const fx = await seedFixtures();
  await ensureAnalyticsTables();
  const resultIds: string[] = [];

  try {
    await addStudentsToBatches({
      workspaceId: fx.workspaceId,
      batchIds: [fx.batchId],
      studentIds: [fx.studentId],
      assignedBy: null,
    });

    // Two attempts so the min-2-attempts leaderboard floor is satisfied.
    const r1 = makeId("result");
    const r2 = makeId("result");
    resultIds.push(r1, r2);
    await insertTaggedResult({
      resultId: r1,
      studentId: fx.studentId,
      workspaceId: fx.workspaceId,
      batchId: fx.batchId,
      subject: "physics",
      percentage: 40,
      score: 16,
      topics: [{ topic: "Kinematics", accuracy: 40, attempts: 5 }],
    });
    await insertTaggedResult({
      resultId: r2,
      studentId: fx.studentId,
      workspaceId: fx.workspaceId,
      batchId: fx.batchId,
      subject: "physics",
      percentage: 60,
      score: 24,
      topics: [{ topic: "Kinematics", accuracy: 60, attempts: 5 }],
    });

    // Populate from both results.
    await populateCohortAnalytics(r1, "test_result");
    await populateCohortAnalytics(r2, "test_result");

    // Student topic profile aggregates both attempts for "Kinematics".
    const profiles = await getStudentTopicProfile(fx.workspaceId, fx.studentId, "physics");
    const kinematics = profiles.find((p) => p.topic === "Kinematics");
    assert.ok(kinematics, "student has a Kinematics profile");
    assert.equal(kinematics?.totalAttempts, 10, "both attempts (5 + 5) aggregated");
    // 2 correct + 3 correct = 5 correct of 10 → 0.5 accuracy.
    assert.ok(Math.abs((kinematics?.accuracy ?? 0) - 0.5) < 0.01, "accuracy is the cumulative ratio");

    // A batch topic snapshot was recorded for the touched subject.
    const snapshots = await getBatchTopicSnapshots(fx.workspaceId, fx.batchId, { subject: "physics" });
    assert.ok(snapshots.some((s) => s.topic === "Kinematics"), "batch snapshot exists for Kinematics");

    // Leaderboard snapshot recorded + direct compute ranks the student.
    const lbHistory = await getLeaderboardHistory(fx.workspaceId, { batchId: fx.batchId, limit: 1 });
    assert.ok(lbHistory.length >= 1, "a leaderboard snapshot was created");

    const leaderboard = await computeBatchLeaderboard(fx.workspaceId, fx.batchId);
    const me = leaderboard.find((e) => e.studentId === fx.studentId);
    assert.ok(me, "student with 2 attempts is ranked");
    assert.equal(me?.attempts, 2);
    assert.ok(Math.abs((me?.meanPercentage ?? 0) - 50) < 0.01, "mean percentage = (40 + 60) / 2");
  } finally {
    const pool = rawPool();
    await pool.query(`DELETE FROM analytics.test_topic_analytics WHERE test_result_id = ANY($1)`, [resultIds]);
    await pool.query(`DELETE FROM analytics.test_results WHERE id = ANY($1)`, [resultIds]);
    await cleanup(fx); // cascades student_topic_profiles / snapshots via workspace + user FKs
  }
});

it("phase 14: min-2-attempts floor excludes single-attempt students", { skip: SKIP }, async () => {
  const fx = await seedFixtures();
  await ensureAnalyticsTables();
  const resultId = makeId("result");

  try {
    await addStudentsToBatches({
      workspaceId: fx.workspaceId,
      batchIds: [fx.batchId],
      studentIds: [fx.studentId],
      assignedBy: null,
    });
    await insertTaggedResult({
      resultId,
      studentId: fx.studentId,
      workspaceId: fx.workspaceId,
      batchId: fx.batchId,
      subject: "physics",
      percentage: 80,
      score: 32,
      topics: [{ topic: "Kinematics", accuracy: 80, attempts: 5 }],
    });

    const leaderboard = await computeBatchLeaderboard(fx.workspaceId, fx.batchId);
    assert.equal(
      leaderboard.find((e) => e.studentId === fx.studentId),
      undefined,
      "a single-attempt student is below the min-2 floor",
    );
  } finally {
    const pool = rawPool();
    await pool.query(`DELETE FROM analytics.test_topic_analytics WHERE test_result_id = $1`, [resultId]);
    await pool.query(`DELETE FROM analytics.test_results WHERE id = $1`, [resultId]);
    await cleanup(fx);
  }
});

test.after(async () => {
  if (!SKIP) await closePool();
});
