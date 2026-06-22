/**
 * Phase 17 — batch analytics read-time aggregation + weak-topic "covered" flags.
 *
 * Verifies getBatchTopicAccuracyLive / getBatchLeaderboardLive /
 * getStudentTopicProfileLive aggregate from analytics.* (OGCODE pool), and that
 * setBatchTopicCoverage (USER pool, app.batch_topic_coverage) flips the `covered`
 * flag merged into the topic rows.
 *
 * Runs only when USER_DATABASE_URL is configured. Pins OGCODE to the same DSN.
 */

import test from "node:test";
import assert from "node:assert/strict";

if (process.env.USER_DATABASE_URL) {
  process.env.OGCODE_DATABASE_URL = process.env.OGCODE_DATABASE_URL ?? process.env.USER_DATABASE_URL;
}

import { ensureAnalyticsTables } from "@/server/analytics-store";
import {
  getBatchTopicAccuracyLive,
  getBatchLeaderboardLive,
  getStudentTopicProfileLive,
} from "@/server/workspaces/batch-cohort-store";
import { setBatchTopicCoverage } from "@/server/workspaces/batch-topic-coverage-store";

import { cleanup, closePool, dbConfigured, makeId, rawPool, seedFixtures } from "./_db";

const SKIP = !dbConfigured();
const it = test;

async function insertResult(opts: {
  resultId: string;
  studentId: string;
  workspaceId: string;
  batchId: string;
  subject: string;
  percentage: number;
  topics: Array<{ topic: string; accuracy: number; attempts: number }>;
}): Promise<void> {
  const pool = rawPool();
  await pool.query(
    `INSERT INTO analytics.test_results (
       id, user_id, test_id, title, subject, difficulty, question_count,
       score, percentage, correct_answers, wrong_answers, unattempted, total_marks,
       is_malpractice, workspace_id, batch_id, summary
     ) VALUES ($1,$2,$3,'Coverage Test',$4,'medium',10,4,$5,5,5,0,40,FALSE,$6,$7,'x')
     ON CONFLICT (id) DO NOTHING`,
    [opts.resultId, opts.studentId, makeId("test"), opts.subject, opts.percentage, opts.workspaceId, opts.batchId],
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

it("phase 17: batch topics aggregate + coverage flag flips", { skip: SKIP }, async () => {
  const fx = await seedFixtures();
  await ensureAnalyticsTables();
  const resultId = makeId("result");

  try {
    await insertResult({
      resultId,
      studentId: fx.studentId,
      workspaceId: fx.workspaceId,
      batchId: fx.batchId,
      subject: "physics",
      percentage: 30,
      topics: [
        { topic: "Kinematics", accuracy: 30, attempts: 5 },
        { topic: "Optics", accuracy: 20, attempts: 5 },
      ],
    });

    // Before coverage: both topics present, none covered.
    let topics = await getBatchTopicAccuracyLive(fx.workspaceId, fx.batchId);
    assert.equal(topics.length, 2);
    assert.ok(topics.every((t) => t.covered === false), "nothing covered initially");

    const lb = await getBatchLeaderboardLive(fx.workspaceId, fx.batchId);
    assert.equal(lb.length, 1, "one student in the batch leaderboard");
    assert.equal(lb[0].studentId, fx.studentId);

    const profile = await getStudentTopicProfileLive(fx.workspaceId, fx.studentId, "physics");
    assert.equal(profile.length, 2, "student profile has both topics");

    // Mark Kinematics covered → only that topic flips.
    await setBatchTopicCoverage({
      workspaceId: fx.workspaceId,
      batchId: fx.batchId,
      subject: "physics",
      topic: "Kinematics",
      covered: true,
      userId: fx.studentId,
    });
    topics = await getBatchTopicAccuracyLive(fx.workspaceId, fx.batchId);
    assert.equal(topics.find((t) => t.topic === "Kinematics")?.covered, true, "Kinematics now covered");
    assert.equal(topics.find((t) => t.topic === "Optics")?.covered, false, "Optics still uncovered");

    // Untick → flips back.
    await setBatchTopicCoverage({
      workspaceId: fx.workspaceId,
      batchId: fx.batchId,
      subject: "physics",
      topic: "Kinematics",
      covered: false,
      userId: fx.studentId,
    });
    topics = await getBatchTopicAccuracyLive(fx.workspaceId, fx.batchId);
    assert.equal(topics.find((t) => t.topic === "Kinematics")?.covered, false, "Kinematics uncovered again");
  } finally {
    const pool = rawPool();
    await pool.query(`DELETE FROM app.batch_topic_coverage WHERE workspace_id = $1`, [fx.workspaceId]);
    await pool.query(`DELETE FROM analytics.test_topic_analytics WHERE test_result_id = $1`, [resultId]);
    await pool.query(`DELETE FROM analytics.test_results WHERE id = $1`, [resultId]);
    await cleanup(fx);
  }
});

test.after(async () => {
  if (!SKIP) await closePool();
});
