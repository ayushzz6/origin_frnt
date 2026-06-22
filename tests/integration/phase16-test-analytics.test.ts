/**
 * Phase 16 — per-test teacher cohort analytics readers.
 *
 * Reads the LIVE source of truth (analytics.test_results + test_topic_analytics)
 * for a single teacher test: who attempted it (ranked by percentage), the cohort's
 * cumulative per-topic weakness (weakest first), and the workspace-scoped owner
 * lookup that gates a teacher loading a student's individual analytics.
 *
 * Runs only when USER_DATABASE_URL is configured. Pins the OGCODE pool to the same
 * DSN so analytics.* and origin_users share one physical DB (the topology the
 * same-physical-DB invariant requires).
 */

import test from "node:test";
import assert from "node:assert/strict";

if (process.env.USER_DATABASE_URL) {
  process.env.OGCODE_DATABASE_URL = process.env.OGCODE_DATABASE_URL ?? process.env.USER_DATABASE_URL;
}

import { ensureAnalyticsTables } from "@/server/analytics-store";
import {
  getTestAttemptCohort,
  getTestTopicWeakness,
  getCohortResultOwner,
} from "@/server/workspaces/test-cohort-store";

import { cleanup, closePool, dbConfigured, makeId, rawPool, seedFixtures } from "./_db";

const SKIP = !dbConfigured();
const it = test;

async function insertTestResult(opts: {
  resultId: string;
  testId: string;
  studentId: string;
  workspaceId: string;
  batchId: string;
  subject: string;
  percentage: number;
  score: number;
  timeTaken: number;
  topics: Array<{ topic: string; accuracy: number; attempts: number }>;
}): Promise<void> {
  const pool = rawPool();
  await pool.query(
    `INSERT INTO analytics.test_results (
       id, user_id, test_id, title, subject, difficulty, question_count,
       time_taken_seconds, score, percentage, correct_answers, wrong_answers,
       unattempted, total_marks, is_malpractice, workspace_id, batch_id, summary
     ) VALUES ($1,$2,$3,'Cohort Test',$4,'medium',10,$5,$6,$7,5,5,0,40,FALSE,$8,$9,'Cohort test result')
     ON CONFLICT (id) DO NOTHING`,
    [
      opts.resultId,
      opts.studentId,
      opts.testId,
      opts.subject,
      opts.timeTaken,
      opts.score,
      opts.percentage,
      opts.workspaceId,
      opts.batchId,
    ],
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

it("phase 16: attempt cohort lists submissions ranked by percentage; topic weakness aggregates weakest-first", { skip: SKIP }, async () => {
  const fx = await seedFixtures();
  await ensureAnalyticsTables();
  const testId = makeId("test");
  const r1 = makeId("result");
  const r2 = makeId("result");
  const resultIds = [r1, r2];

  try {
    // Two submissions of the SAME test (shared test_id), different scores.
    await insertTestResult({
      resultId: r1,
      testId,
      studentId: fx.studentId,
      workspaceId: fx.workspaceId,
      batchId: fx.batchId,
      subject: "physics",
      percentage: 40,
      score: 16,
      timeTaken: 600,
      topics: [
        { topic: "Kinematics", accuracy: 40, attempts: 5 },
        { topic: "Thermodynamics", accuracy: 80, attempts: 5 },
      ],
    });
    await insertTestResult({
      resultId: r2,
      testId,
      studentId: fx.studentId,
      workspaceId: fx.workspaceId,
      batchId: fx.batchId,
      subject: "physics",
      percentage: 75,
      score: 30,
      timeTaken: 500,
      topics: [{ topic: "Kinematics", accuracy: 60, attempts: 5 }],
    });

    // Attempt cohort — one row per result, ranked by percentage desc.
    const attempts = await getTestAttemptCohort(fx.workspaceId, testId);
    assert.equal(attempts.length, 2, "both submissions are listed");
    assert.equal(attempts[0].percentage, 75, "highest percentage ranks first");
    assert.equal(attempts[0].rank, 1);
    assert.equal(attempts[1].percentage, 40);
    assert.ok(attempts[0].displayName, "display name resolved from origin_users");
    assert.equal(attempts[0].resultId, r2);

    // Topic weakness — Kinematics mean (40+60)/2 = 50; Thermodynamics 80; weakest first.
    const weak = await getTestTopicWeakness(fx.workspaceId, testId);
    assert.equal(weak[0].topic, "Kinematics", "weakest topic is first");
    assert.ok(Math.abs(weak[0].accuracy - 50) < 0.01, "Kinematics is the cohort mean of both attempts");
    assert.equal(weak[0].severity, "medium", "50% accuracy → medium severity");
    const thermo = weak.find((w) => w.topic === "Thermodynamics");
    assert.ok(thermo && thermo.severity === "low", "80% accuracy → low severity");

    // Owner lookup gates the individual-analytics route by workspace.
    assert.equal(await getCohortResultOwner(fx.workspaceId, r1), fx.studentId);
    assert.equal(await getCohortResultOwner(makeId("ws"), r1), null, "cross-workspace lookup is denied");
  } finally {
    const pool = rawPool();
    await pool.query(`DELETE FROM analytics.test_topic_analytics WHERE test_result_id = ANY($1)`, [resultIds]);
    await pool.query(`DELETE FROM analytics.test_results WHERE id = ANY($1)`, [resultIds]);
    await cleanup(fx);
  }
});

test.after(async () => {
  if (!SKIP) await closePool();
});
