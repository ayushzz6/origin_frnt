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

      // The ALTER must run on the pool that owns rooms.rooms (the OGCode
      // pool — see getRoomsPostgresPool → getOgcodePostgresPool). The
      // previous version ran ALTER on the USER pool, which works only
      // when USER_DATABASE_URL and OGCODE_DATABASE_URL point at the
      // same physical DB. In the current production env they don't, so
      // the ALTER was failing with "schema rooms does not exist" and
      // every teacher rooms page 500'd. The migration INSERT still
      // needs the USER pool because app.migrations lives there.
      const roomsClient = await roomsPool.connect();
      try {
        await roomsClient.query("BEGIN");
        await roomsClient.query(`
          ALTER TABLE rooms.rooms
            ADD COLUMN IF NOT EXISTS workspace_id TEXT,
            ADD COLUMN IF NOT EXISTS batch_id TEXT,
            ADD COLUMN IF NOT EXISTS teacher_test_id TEXT,
            ADD COLUMN IF NOT EXISTS room_kind TEXT NOT NULL DEFAULT 'student_room';

          CREATE INDEX IF NOT EXISTS idx_rooms_workspace_status
            ON rooms.rooms(workspace_id, status, created_at DESC);
          CREATE INDEX IF NOT EXISTS idx_rooms_batch_status
            ON rooms.rooms(batch_id, status, created_at DESC);
          CREATE INDEX IF NOT EXISTS idx_rooms_teacher_test
            ON rooms.rooms(teacher_test_id) WHERE teacher_test_id IS NOT NULL;
        `);
        await roomsClient.query("COMMIT");
      } catch (error) {
        await roomsClient.query("ROLLBACK").catch(() => undefined);
        throw error;
      } finally {
        roomsClient.release();
      }

      // FK references: only valid when app.teacher_workspaces etc. live in
      // the same physical DB as rooms.rooms. We attempt to add them on
      // the rooms pool but tolerate "relation does not exist" — a hard
      // requirement would break deployments that route the two pools to
      // different DBs.
      try {
        await roomsPool.query(`
          DO $$ BEGIN
            ALTER TABLE rooms.rooms
              ADD CONSTRAINT fk_rooms_workspace
              FOREIGN KEY (workspace_id) REFERENCES app.teacher_workspaces(id) ON DELETE SET NULL NOT VALID;
          EXCEPTION
            WHEN duplicate_object THEN NULL;
            WHEN undefined_table THEN NULL;
          END $$;
          DO $$ BEGIN
            ALTER TABLE rooms.rooms
              ADD CONSTRAINT fk_rooms_batch
              FOREIGN KEY (batch_id) REFERENCES app.batches(id) ON DELETE SET NULL NOT VALID;
          EXCEPTION
            WHEN duplicate_object THEN NULL;
            WHEN undefined_table THEN NULL;
          END $$;
          DO $$ BEGIN
            ALTER TABLE rooms.rooms
              ADD CONSTRAINT fk_rooms_teacher_test
              FOREIGN KEY (teacher_test_id) REFERENCES assessment.tests(id) ON DELETE SET NULL NOT VALID;
          EXCEPTION
            WHEN duplicate_object THEN NULL;
            WHEN undefined_table THEN NULL;
          END $$;
        `);
      } catch (error) {
        console.warn("[teacher-rooms] cross-schema FK setup skipped:", error);
      }

      // Record the migration on the USER pool (app.migrations lives there).
      try {
        const client = await pool().connect();
        try {
          await recordMigration(client);
        } finally {
          client.release();
        }
      } catch (error) {
        // Recording the migration is best-effort; don't fail the
        // bootstrap if app.migrations isn't reachable yet.
        console.warn("[teacher-rooms] recordMigration skipped:", error);
      }

      globalThis.__originTeacherRoomsSchemaEnsured = true;
    })().catch((error) => {
      globalThis.__originTeacherRoomsSchemaPromise = undefined;
      throw error;
    });
  }
  await globalThis.__originTeacherRoomsSchemaPromise;
}