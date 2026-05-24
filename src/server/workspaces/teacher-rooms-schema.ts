/**
 * Idempotent runtime ensure for Phase 6 Teacher Rooms schema.
 * Adds workspace_id, batch_id, teacher_test_id, room_kind to rooms.rooms.
 * Canonical SQL: src/db/migrations/20260520_phase6_teacher_rooms.sql
 */

import type { PoolClient } from "pg";

import { getUserPostgresPool, isUserPostgresConfigured } from "@/server/user-postgres";
import { ensureRoomsSchema, getRoomsPostgresPoolOrThrow } from "@/server/rooms-postgres";

import { ensureAssessmentSchema } from "./assessment-schema";

declare global {
  var __originTeacherRoomsSchemaEnsured: boolean | undefined;
  var __originTeacherRoomsSchemaPromise: Promise<void> | undefined;
}

const MIGRATION_ID = "20260520_phase6_teacher_rooms";

function pool() {
  const p = getUserPostgresPool();
  if (!p) throw new Error("USER_DATABASE_URL is not configured");
  return p;
}

async function recordMigration(client: PoolClient): Promise<void> {
  await client.query(
    "INSERT INTO app.migrations (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING",
    [MIGRATION_ID, "phase 6 teacher rooms"],
  );
}

export async function ensureTeacherRoomsSchema(): Promise<void> {
  if (!isUserPostgresConfigured()) return;
  if (globalThis.__originTeacherRoomsSchemaEnsured) return;
  if (!globalThis.__originTeacherRoomsSchemaPromise) {
    globalThis.__originTeacherRoomsSchemaPromise = (async () => {
      // Audit fix (rooms 500 in prod): the rooms.rooms table is owned by
      // ensureRoomsSchema(), which awaits ensureAnalyticsSchema() before
      // running its CREATE SCHEMA. If analytics-schema setup ever fails
      // (privileges, transient connection error) the rooms schema never
      // gets created and every teacher rooms route 500s with
      // "schema 'rooms' does not exist". Create the schema defensively
      // here on the same pool the rooms SELECTs hit before falling
      // through to the canonical ensure call. Idempotent — CREATE
      // SCHEMA IF NOT EXISTS does nothing when the schema already exists.
      const roomsPool = getRoomsPostgresPoolOrThrow();
      try {
        await roomsPool.query("CREATE SCHEMA IF NOT EXISTS rooms");
      } catch (error) {
        // Surface the underlying failure rather than silently masking it.
        console.error("[teacher-rooms] CREATE SCHEMA rooms failed:", error);
        throw error;
      }
      await ensureAssessmentSchema();
      // rooms.rooms must exist before we can ALTER it. Origin deployments
      // co-locate USER_DATABASE_URL and OGCODE_DATABASE_URL on the same DB
      // because the FK references between rooms/app/content require it.
      await ensureRoomsSchema();
      // The ALTER + INSERT into app.migrations both target the user pool
      // (app.* schema), so the migration recording stays on `pool()`.
      const client = await pool().connect();
      try {
        await client.query("BEGIN");
        await client.query(`
          ALTER TABLE rooms.rooms
            ADD COLUMN IF NOT EXISTS workspace_id TEXT REFERENCES app.teacher_workspaces(id) ON DELETE SET NULL,
            ADD COLUMN IF NOT EXISTS batch_id TEXT REFERENCES app.batches(id) ON DELETE SET NULL,
            ADD COLUMN IF NOT EXISTS teacher_test_id TEXT REFERENCES assessment.tests(id) ON DELETE SET NULL,
            ADD COLUMN IF NOT EXISTS room_kind TEXT NOT NULL DEFAULT 'student_room';

          CREATE INDEX IF NOT EXISTS idx_rooms_workspace_status
            ON rooms.rooms(workspace_id, status, created_at DESC);
          CREATE INDEX IF NOT EXISTS idx_rooms_batch_status
            ON rooms.rooms(batch_id, status, created_at DESC);
          CREATE INDEX IF NOT EXISTS idx_rooms_teacher_test
            ON rooms.rooms(teacher_test_id) WHERE teacher_test_id IS NOT NULL;
        `);
        await recordMigration(client);
        await client.query("COMMIT");
        globalThis.__originTeacherRoomsSchemaEnsured = true;
      } catch (error) {
        await client.query("ROLLBACK").catch(() => undefined);
        throw error;
      } finally {
        client.release();
      }
    })().catch((error) => {
      globalThis.__originTeacherRoomsSchemaPromise = undefined;
      throw error;
    });
  }
  await globalThis.__originTeacherRoomsSchemaPromise;
}