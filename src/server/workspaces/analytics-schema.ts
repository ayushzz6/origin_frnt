/**
 * Idempotent runtime ensure for Phase 8 teacher analytics schema.
 * Extends the content schema with analytics snapshot tables.
 */

import type { PoolClient } from "pg";

import { getUserPostgresPool, isUserPostgresConfigured } from "@/server/user-postgres";

import { ensureStudyMaterialsSchema } from "./study-materials-schema";

declare global {
  var __originAnalyticsSchemaEnsured: boolean | undefined;
  var __originAnalyticsSchemaPromise: Promise<void> | undefined;
}

const MIGRATION_ID = "20260521_phase8_teacher_analytics";

function pool() {
  const p = getUserPostgresPool();
  if (!p) throw new Error("USER_DATABASE_URL is not configured");
  return p;
}

async function recordMigration(client: PoolClient): Promise<void> {
  await client.query(
    "INSERT INTO app.migrations (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING",
    [MIGRATION_ID, "phase 8 teacher analytics"],
  );
}

export async function ensureAnalyticsSchema(): Promise<void> {
  if (!isUserPostgresConfigured()) return;
  if (globalThis.__originAnalyticsSchemaEnsured) return;
  if (!globalThis.__originAnalyticsSchemaPromise) {
    globalThis.__originAnalyticsSchemaPromise = (async () => {
      await ensureStudyMaterialsSchema();
      const client = await pool().connect();
      try {
        await client.query("BEGIN");

        await client.query(`CREATE SCHEMA IF NOT EXISTS content;`);

        await client.query(`
          CREATE TABLE IF NOT EXISTS content.batch_topic_snapshots (
            id TEXT PRIMARY KEY,
            workspace_id TEXT NOT NULL REFERENCES app.teacher_workspaces(id) ON DELETE CASCADE,
            batch_id TEXT NOT NULL REFERENCES app.batches(id) ON DELETE CASCADE,
            test_id TEXT,
            room_id TEXT,
            snapshot_type TEXT NOT NULL CHECK (snapshot_type IN ('test_result', 'room_result', 'manual')),
            topic TEXT NOT NULL,
            subject TEXT NOT NULL,
            chapter TEXT,
            concept TEXT,
            accuracy NUMERIC(5, 4) NOT NULL DEFAULT 0,
            attempts INTEGER NOT NULL DEFAULT 0,
            average_time_seconds NUMERIC(10, 2) NOT NULL DEFAULT 0,
            severity TEXT NOT NULL CHECK (severity IN ('high', 'medium', 'low')),
            snapshot_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          );

          CREATE INDEX IF NOT EXISTS idx_batch_topic_snapshots_batch
            ON content.batch_topic_snapshots(batch_id, snapshot_at DESC);
          CREATE INDEX IF NOT EXISTS idx_batch_topic_snapshots_workspace_subject
            ON content.batch_topic_snapshots(workspace_id, subject, severity, snapshot_at DESC);
        `);

        await client.query(`
          CREATE TABLE IF NOT EXISTS content.student_topic_profiles (
            id TEXT PRIMARY KEY,
            workspace_id TEXT NOT NULL REFERENCES app.teacher_workspaces(id) ON DELETE CASCADE,
            student_id TEXT NOT NULL REFERENCES origin_users(id) ON DELETE CASCADE,
            batch_id TEXT REFERENCES app.batches(id) ON DELETE SET NULL,
            topic TEXT NOT NULL,
            subject TEXT NOT NULL,
            chapter TEXT,
            concept TEXT,
            total_attempts INTEGER NOT NULL DEFAULT 0,
            correct_attempts INTEGER NOT NULL DEFAULT 0,
            accuracy NUMERIC(5, 4) NOT NULL DEFAULT 0,
            average_time_seconds NUMERIC(10, 2) NOT NULL DEFAULT 0,
            last_attempt_at TIMESTAMPTZ,
            mastery_score NUMERIC(5, 4) NOT NULL DEFAULT 0,
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            UNIQUE (workspace_id, student_id, subject, topic)
          );

          CREATE INDEX IF NOT EXISTS idx_student_topic_profiles_student
            ON content.student_topic_profiles(student_id, subject, accuracy);
          CREATE INDEX IF NOT EXISTS idx_student_topic_profiles_batch
            ON content.student_topic_profiles(batch_id, subject, accuracy);
        `);

        await client.query(`
          CREATE TABLE IF NOT EXISTS content.leaderboard_snapshots (
            id TEXT PRIMARY KEY,
            workspace_id TEXT NOT NULL REFERENCES app.teacher_workspaces(id) ON DELETE CASCADE,
            batch_id TEXT REFERENCES app.batches(id) ON DELETE SET NULL,
            test_id TEXT,
            room_id TEXT,
            snapshot_type TEXT NOT NULL CHECK (snapshot_type IN ('test', 'room')),
            snapshot_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            entries JSONB NOT NULL DEFAULT '[]'::jsonb,
            metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          );

          CREATE INDEX IF NOT EXISTS idx_leaderboard_snapshots_workspace
            ON content.leaderboard_snapshots(workspace_id, snapshot_at DESC);
          CREATE INDEX IF NOT EXISTS idx_leaderboard_snapshots_batch
            ON content.leaderboard_snapshots(batch_id, snapshot_at DESC);
        `);

        await recordMigration(client);
        await client.query("COMMIT");
        globalThis.__originAnalyticsSchemaEnsured = true;
      } catch (error) {
        await client.query("ROLLBACK").catch(() => undefined);
        throw error;
      } finally {
        client.release();
      }
    })().catch((error) => {
      globalThis.__originAnalyticsSchemaPromise = undefined;
      throw error;
    });
  }
  await globalThis.__originAnalyticsSchemaPromise;
}
