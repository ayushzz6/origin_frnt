/**
 * Idempotent runtime ensure for Phase 9 OGCode publishing schema.
 */

import type { PoolClient } from "pg";

import { getUserPostgresPool, isUserPostgresConfigured } from "@/server/user-postgres";

import { ensureAnalyticsSchema } from "./analytics-schema";

declare global {
  var __originOgcodePublishingSchemaEnsured: boolean | undefined;
  var __originOgcodePublishingSchemaPromise: Promise<void> | undefined;
}

const MIGRATION_ID = "20260521_phase9_ogcode_publishing";

function pool() {
  const p = getUserPostgresPool();
  if (!p) throw new Error("USER_DATABASE_URL is not configured");
  return p;
}

async function recordMigration(client: PoolClient): Promise<void> {
  await client.query(
    "INSERT INTO app.migrations (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING",
    [MIGRATION_ID, "phase 9 ogcode publishing moderation republish"],
  );
}

export async function ensureOgcodePublishingSchema(): Promise<void> {
  if (!isUserPostgresConfigured()) return;
  if (globalThis.__originOgcodePublishingSchemaEnsured) return;
  if (!globalThis.__originOgcodePublishingSchemaPromise) {
    globalThis.__originOgcodePublishingSchemaPromise = (async () => {
      await ensureAnalyticsSchema();
      const client = await pool().connect();
      try {
        await client.query("BEGIN");

        await client.query(`CREATE SCHEMA IF NOT EXISTS content;`);

        await client.query(`
          DO $$ BEGIN
            CREATE TYPE content.ogcode_publication_status AS ENUM (
              'pending_review', 'approved', 'rejected', 'published', 'superseded'
            );
          EXCEPTION WHEN duplicate_object THEN NULL; END $$;
        `);

        await client.query(`
          CREATE TABLE IF NOT EXISTS content.ogcode_publications (
            id TEXT PRIMARY KEY,
            workspace_id TEXT NOT NULL REFERENCES app.teacher_workspaces(id) ON DELETE CASCADE,
            ogcode_question_id TEXT NOT NULL,
            question_bag_question_id TEXT,
            submitted_by TEXT NOT NULL REFERENCES origin_users(id),
            status content.ogcode_publication_status NOT NULL DEFAULT 'pending_review',
            version INTEGER NOT NULL DEFAULT 1,
            hint_provided BOOLEAN NOT NULL DEFAULT FALSE,
            full_solution_provided BOOLEAN NOT NULL DEFAULT FALSE,
            admin_reviewed_by TEXT REFERENCES origin_users(id),
            admin_reviewed_at TIMESTAMPTZ,
            admin_notes TEXT,
            published_at TIMESTAMPTZ,
            rejected_at TIMESTAMPTZ,
            superseded_by TEXT REFERENCES content.ogcode_publications(id),
            metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          );

          CREATE INDEX IF NOT EXISTS idx_ogcode_publications_workspace_status
            ON content.ogcode_publications(workspace_id, status, created_at DESC);
          CREATE INDEX IF NOT EXISTS idx_ogcode_publications_pending_review
            ON content.ogcode_publications(status, created_at ASC)
            WHERE status = 'pending_review';
          CREATE INDEX IF NOT EXISTS idx_ogcode_publications_ogcode_question
            ON content.ogcode_publications(ogcode_question_id, status);
        `);

        await recordMigration(client);
        await client.query("COMMIT");
        globalThis.__originOgcodePublishingSchemaEnsured = true;
      } catch (error) {
        await client.query("ROLLBACK").catch(() => undefined);
        throw error;
      } finally {
        client.release();
      }
    })().catch((error) => {
      globalThis.__originOgcodePublishingSchemaPromise = undefined;
      throw error;
    });
  }
  await globalThis.__originOgcodePublishingSchemaPromise;
}
