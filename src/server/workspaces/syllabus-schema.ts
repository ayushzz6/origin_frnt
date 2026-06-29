/**
 * Idempotent runtime ensure for the teacher-authored Batch Syllabus tree.
 * A two-level tree (chapter → topic) scoped to a batch. Progress is DERIVED at
 * read time from real student topic mastery (analytics.batch_topic_snapshots),
 * with an optional per-node `manual_status` teacher override.
 */

import type { PoolClient } from "pg";

import { getUserPostgresPool, isUserPostgresConfigured } from "@/server/user-postgres";

declare global {
  var __originSyllabusSchemaEnsured: boolean | undefined;
  var __originSyllabusSchemaPromise: Promise<void> | undefined;
}

const MIGRATION_ID = "20260629_batch_syllabus";

function pool() {
  const p = getUserPostgresPool();
  if (!p) throw new Error("USER_DATABASE_URL is not configured");
  return p;
}

export async function ensureSyllabusSchema(): Promise<void> {
  if (!isUserPostgresConfigured()) return;
  if (globalThis.__originSyllabusSchemaEnsured) return;
  if (!globalThis.__originSyllabusSchemaPromise) {
    globalThis.__originSyllabusSchemaPromise = (async () => {
      const client: PoolClient = await pool().connect();
      try {
        await client.query("BEGIN");
        await client.query(`CREATE SCHEMA IF NOT EXISTS content`);
        await client.query(`
          CREATE TABLE IF NOT EXISTS content.syllabus_nodes (
            id TEXT PRIMARY KEY,
            workspace_id TEXT NOT NULL REFERENCES app.teacher_workspaces(id) ON DELETE CASCADE,
            batch_id TEXT NOT NULL REFERENCES app.batches(id) ON DELETE CASCADE,
            parent_id TEXT REFERENCES content.syllabus_nodes(id) ON DELETE CASCADE,
            kind TEXT NOT NULL CHECK (kind IN ('chapter', 'topic')),
            title TEXT NOT NULL,
            subject TEXT,
            sort_order INTEGER NOT NULL DEFAULT 0,
            manual_status TEXT CHECK (manual_status IN ('mastered', 'in_progress', 'unstarted')),
            created_by TEXT REFERENCES origin_users(id),
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          );

          CREATE INDEX IF NOT EXISTS idx_syllabus_nodes_batch
            ON content.syllabus_nodes(workspace_id, batch_id, parent_id, sort_order);
        `);
        await client.query(
          "INSERT INTO app.migrations (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING",
          [MIGRATION_ID, "batch syllabus tree"],
        );
        await client.query("COMMIT");
        globalThis.__originSyllabusSchemaEnsured = true;
      } catch (error) {
        await client.query("ROLLBACK").catch(() => undefined);
        throw error;
      } finally {
        client.release();
      }
    })().catch((error) => {
      globalThis.__originSyllabusSchemaPromise = undefined;
      throw error;
    });
  }
  await globalThis.__originSyllabusSchemaPromise;
}
