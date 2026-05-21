/**
 * Postgres-backed store for teacher analytics (Phase 8).
 */

import type { Pool } from "pg";

import { getUserPostgresPool } from "@/server/user-postgres";

import { createAnalyticsSnapshotId } from "./ids";
import { ensureAnalyticsSchema } from "./analytics-schema";
import type {
  BatchTopicSnapshot,
  LeaderboardSnapshot,
  StudentTopicProfile,
} from "./types";

function pool(): Pool {
  const p = getUserPostgresPool();
  if (!p) throw new Error("USER_DATABASE_URL is not configured");
  return p;
}

function rowToBatchTopicSnapshot(row: Record<string, unknown>): BatchTopicSnapshot {
  return {
    id: row.id as string,
    workspaceId: row.workspace_id as string,
    batchId: row.batch_id as string,
    testId: (row.test_id as string | null) ?? null,
    roomId: (row.room_id as string | null) ?? null,
    snapshotType: row.snapshot_type as "test_result" | "room_result" | "manual",
    topic: row.topic as string,
    subject: row.subject as string,
    chapter: (row.chapter as string | null) ?? null,
    concept: (row.concept as string | null) ?? null,
    accuracy: Number(row.accuracy),
    attempts: Number(row.attempts),
    averageTimeSeconds: Number(row.average_time_seconds),
    severity: row.severity as "high" | "medium" | "low",
    snapshotAt: new Date(row.snapshot_at as string).toISOString(),
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    createdAt: new Date(row.created_at as string).toISOString(),
  };
}

function rowToStudentTopicProfile(row: Record<string, unknown>): StudentTopicProfile {
  return {
    id: row.id as string,
    workspaceId: row.workspace_id as string,
    studentId: row.student_id as string,
    batchId: (row.batch_id as string | null) ?? null,
    topic: row.topic as string,
    subject: row.subject as string,
    chapter: (row.chapter as string | null) ?? null,
    concept: (row.concept as string | null) ?? null,
    totalAttempts: Number(row.total_attempts),
    correctAttempts: Number(row.correct_attempts),
    accuracy: Number(row.accuracy),
    averageTimeSeconds: Number(row.average_time_seconds),
    lastAttemptAt: row.last_attempt_at ? new Date(row.last_attempt_at as string).toISOString() : null,
    masteryScore: Number(row.mastery_score),
    updatedAt: new Date(row.updated_at as string).toISOString(),
    createdAt: new Date(row.created_at as string).toISOString(),
  };
}

function rowToLeaderboardSnapshot(row: Record<string, unknown>): LeaderboardSnapshot {
  return {
    id: row.id as string,
    workspaceId: row.workspace_id as string,
    batchId: (row.batch_id as string | null) ?? null,
    testId: (row.test_id as string | null) ?? null,
    roomId: (row.room_id as string | null) ?? null,
    snapshotType: row.snapshot_type as "test" | "room",
    snapshotAt: new Date(row.snapshot_at as string).toISOString(),
    entries: (row.entries as Record<string, unknown>[]) ?? [],
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    createdAt: new Date(row.created_at as string).toISOString(),
  };
}

// ─── Batch Topic Snapshots ────────────────────────────────────────────────────

export async function upsertBatchTopicSnapshot(input: {
  workspaceId: string;
  batchId: string;
  testId?: string | null;
  roomId?: string | null;
  snapshotType: "test_result" | "room_result" | "manual";
  topic: string;
  subject: string;
  chapter?: string | null;
  concept?: string | null;
  accuracy: number;
  attempts: number;
  averageTimeSeconds: number;
  severity: "high" | "medium" | "low";
  metadata?: Record<string, unknown>;
}): Promise<BatchTopicSnapshot> {
  await ensureAnalyticsSchema();
  const id = createAnalyticsSnapshotId();
  const result = await pool().query(
    `INSERT INTO content.batch_topic_snapshots (
       id, workspace_id, batch_id, test_id, room_id, snapshot_type,
       topic, subject, chapter, concept, accuracy, attempts,
       average_time_seconds, severity, metadata
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15::jsonb)
     RETURNING *`,
    [
      id,
      input.workspaceId,
      input.batchId,
      input.testId ?? null,
      input.roomId ?? null,
      input.snapshotType,
      input.topic,
      input.subject,
      input.chapter ?? null,
      input.concept ?? null,
      input.accuracy,
      input.attempts,
      input.averageTimeSeconds,
      input.severity,
      JSON.stringify(input.metadata ?? {}),
    ],
  );
  return rowToBatchTopicSnapshot(result.rows[0]);
}

export async function getBatchTopicSnapshots(
  workspaceId: string,
  batchId: string,
  filter?: { subject?: string; limit?: number },
): Promise<BatchTopicSnapshot[]> {
  await ensureAnalyticsSchema();
  const params: unknown[] = [workspaceId, batchId];
  let where = "workspace_id = $1 AND batch_id = $2";
  if (filter?.subject) {
    params.push(filter.subject);
    where += ` AND subject = $${params.length}`;
  }
  const limit = filter?.limit ?? 50;
  const result = await pool().query(
    `SELECT * FROM content.batch_topic_snapshots
     WHERE ${where}
     ORDER BY snapshot_at DESC
     LIMIT ${limit}`,
    params,
  );
  return result.rows.map(rowToBatchTopicSnapshot);
}

export async function getBatchWeakTopics(
  workspaceId: string,
  batchId: string,
  filter?: { subject?: string; severity?: "high" | "medium" | "low" },
): Promise<BatchTopicSnapshot[]> {
  await ensureAnalyticsSchema();
  const params: unknown[] = [workspaceId, batchId];
  let where = "workspace_id = $1 AND batch_id = $2 AND severity IN ('high', 'medium')";
  if (filter?.subject) {
    params.push(filter.subject);
    where += ` AND subject = $${params.length}`;
  }
  if (filter?.severity) {
    params.push(filter.severity);
    where += ` AND severity = $${params.length}`;
  }
  const result = await pool().query(
    `SELECT DISTINCT ON (topic, subject) *
     FROM content.batch_topic_snapshots
     WHERE ${where}
     ORDER BY topic, subject, snapshot_at DESC`,
    params,
  );
  return result.rows.map(rowToBatchTopicSnapshot);
}

// ─── Student Topic Profiles ───────────────────────────────────────────────────

export async function upsertStudentTopicProfile(input: {
  workspaceId: string;
  studentId: string;
  batchId?: string | null;
  topic: string;
  subject: string;
  chapter?: string | null;
  concept?: string | null;
  totalAttempts: number;
  correctAttempts: number;
  accuracy: number;
  averageTimeSeconds: number;
  lastAttemptAt?: string | null;
  masteryScore: number;
}): Promise<StudentTopicProfile> {
  await ensureAnalyticsSchema();
  const id = createAnalyticsSnapshotId();
  const result = await pool().query(
    `INSERT INTO content.student_topic_profiles (
       id, workspace_id, student_id, batch_id, topic, subject, chapter, concept,
       total_attempts, correct_attempts, accuracy, average_time_seconds,
       last_attempt_at, mastery_score
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
     ON CONFLICT (workspace_id, student_id, subject, topic)
     DO UPDATE SET
       total_attempts = EXCLUDED.total_attempts,
       correct_attempts = EXCLUDED.correct_attempts,
       accuracy = EXCLUDED.accuracy,
       average_time_seconds = EXCLUDED.average_time_seconds,
       last_attempt_at = EXCLUDED.last_attempt_at,
       mastery_score = EXCLUDED.mastery_score,
       updated_at = NOW()
     RETURNING *`,
    [
      id,
      input.workspaceId,
      input.studentId,
      input.batchId ?? null,
      input.topic,
      input.subject,
      input.chapter ?? null,
      input.concept ?? null,
      input.totalAttempts,
      input.correctAttempts,
      input.accuracy,
      input.averageTimeSeconds,
      input.lastAttemptAt ?? null,
      input.masteryScore,
    ],
  );
  return rowToStudentTopicProfile(result.rows[0]);
}

export async function getStudentTopicProfile(
  workspaceId: string,
  studentId: string,
  subject?: string,
): Promise<StudentTopicProfile[]> {
  await ensureAnalyticsSchema();
  const params: unknown[] = [workspaceId, studentId];
  let where = "workspace_id = $1 AND student_id = $2";
  if (subject) {
    params.push(subject);
    where += ` AND subject = $${params.length}`;
  }
  const result = await pool().query(
    `SELECT * FROM content.student_topic_profiles
     WHERE ${where}
     ORDER BY accuracy ASC, total_attempts DESC`,
    params,
  );
  return result.rows.map(rowToStudentTopicProfile);
}

export async function getBatchStudentProfiles(
  workspaceId: string,
  batchId: string,
  filter?: { subject?: string; minAttempts?: number },
): Promise<StudentTopicProfile[]> {
  await ensureAnalyticsSchema();
  const params: unknown[] = [workspaceId, batchId];
  let where = "workspace_id = $1 AND batch_id = $2";
  if (filter?.subject) {
    params.push(filter.subject);
    where += ` AND subject = $${params.length}`;
  }
  const minAttempts = filter?.minAttempts ?? 0;
  const result = await pool().query(
    `SELECT * FROM content.student_topic_profiles
     WHERE ${where} AND total_attempts >= $${params.length + 1}
     ORDER BY accuracy ASC`,
    [...params, minAttempts],
  );
  return result.rows.map(rowToStudentTopicProfile);
}

// ─── Leaderboard Snapshots ────────────────────────────────────────────────────

export async function createLeaderboardSnapshot(input: {
  workspaceId: string;
  batchId?: string | null;
  testId?: string | null;
  roomId?: string | null;
  snapshotType: "test" | "room";
  entries: Record<string, unknown>[];
  metadata?: Record<string, unknown>;
}): Promise<LeaderboardSnapshot> {
  await ensureAnalyticsSchema();
  const id = createAnalyticsSnapshotId();
  const result = await pool().query(
    `INSERT INTO content.leaderboard_snapshots (
       id, workspace_id, batch_id, test_id, room_id, snapshot_type, entries, metadata
     ) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb)
     RETURNING *`,
    [
      id,
      input.workspaceId,
      input.batchId ?? null,
      input.testId ?? null,
      input.roomId ?? null,
      input.snapshotType,
      JSON.stringify(input.entries),
      JSON.stringify(input.metadata ?? {}),
    ],
  );
  return rowToLeaderboardSnapshot(result.rows[0]);
}

export async function getLeaderboardHistory(
  workspaceId: string,
  filter?: { batchId?: string; testId?: string; roomId?: string; limit?: number },
): Promise<LeaderboardSnapshot[]> {
  await ensureAnalyticsSchema();
  const params: unknown[] = [workspaceId];
  let where = "workspace_id = $1";
  if (filter?.batchId) {
    params.push(filter.batchId);
    where += ` AND batch_id = $${params.length}`;
  }
  if (filter?.testId) {
    params.push(filter.testId);
    where += ` AND test_id = $${params.length}`;
  }
  if (filter?.roomId) {
    params.push(filter.roomId);
    where += ` AND room_id = $${params.length}`;
  }
  const limit = filter?.limit ?? 20;
  const result = await pool().query(
    `SELECT * FROM content.leaderboard_snapshots
     WHERE ${where}
     ORDER BY snapshot_at DESC
     LIMIT ${limit}`,
    params,
  );
  return result.rows.map(rowToLeaderboardSnapshot);
}

export async function getLeaderboardSnapshot(
  workspaceId: string,
  snapshotId: string,
): Promise<LeaderboardSnapshot | null> {
  await ensureAnalyticsSchema();
  const result = await pool().query(
    `SELECT * FROM content.leaderboard_snapshots WHERE id = $1 AND workspace_id = $2`,
    [snapshotId, workspaceId],
  );
  return result.rows[0] ? rowToLeaderboardSnapshot(result.rows[0]) : null;
}
