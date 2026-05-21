/**
 * Idempotent runtime ensure for Phase 10 document import schema.
 * Uses the `import` Postgres schema for isolation.
 */

import type { PoolClient } from "pg";

import { getUserPostgresPool, isUserPostgresConfigured } from "@/server/user-postgres";

declare global {
  var __originDocumentImportSchemaEnsured: boolean | undefined;
  var __originDocumentImportSchemaPromise: Promise<void> | undefined;
}

const MIGRATION_ID = "20260521_phase10_document_import";

function pool() {
  const p = getUserPostgresPool();
  if (!p) throw new Error("USER_DATABASE_URL is not configured");
  return p;
}

async function recordMigration(client: PoolClient): Promise<void> {
  await client.query(
    "INSERT INTO app.migrations (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING",
    [MIGRATION_ID, "phase 10 document import"],
  );
}

export async function ensureDocumentImportSchema(): Promise<void> {
  if (!isUserPostgresConfigured()) return;
  if (globalThis.__originDocumentImportSchemaEnsured) return;
  if (!globalThis.__originDocumentImportSchemaPromise) {
    globalThis.__originDocumentImportSchemaPromise = (async () => {
      const client = await pool().connect();
      try {
        await client.query("BEGIN");
        await client.query(`CREATE SCHEMA IF NOT EXISTS import`);

        await client.query(`
          DO $$ BEGIN
            CREATE TYPE import.import_source_type AS ENUM ('pdf', 'docx', 'txt', 'image', 'url');
          EXCEPTION WHEN duplicate_object THEN NULL; END $$;

          DO $$ BEGIN
            CREATE TYPE import.import_job_status AS ENUM ('queued', 'processing', 'needs_review', 'succeeded', 'failed', 'cancelled');
          EXCEPTION WHEN duplicate_object THEN NULL; END $$;

          DO $$ BEGIN
            CREATE TYPE import.import_page_status AS ENUM ('pending', 'parsed', 'review_required', 'accepted', 'rejected');
          EXCEPTION WHEN duplicate_object THEN NULL; END $$;

          DO $$ BEGIN
            CREATE TYPE import.import_question_status AS ENUM ('draft', 'review_required', 'accepted', 'rejected', 'published');
          EXCEPTION WHEN duplicate_object THEN NULL; END $$;

          CREATE TABLE IF NOT EXISTS import.document_import_jobs (
            id TEXT PRIMARY KEY,
            workspace_id TEXT NOT NULL REFERENCES app.teacher_workspaces(id) ON DELETE CASCADE,
            source_type import.import_source_type NOT NULL,
            source_file_name TEXT NOT NULL,
            source_r2_object_key TEXT NOT NULL,
            source_r2_bucket TEXT NOT NULL,
            source_mime_type TEXT NOT NULL,
            source_size_bytes BIGINT NOT NULL DEFAULT 0,
            source_sha256 TEXT NOT NULL,
            subject TEXT,
            chapter TEXT,
            status import.import_job_status NOT NULL DEFAULT 'queued',
            total_pages INTEGER,
            processed_pages INTEGER NOT NULL DEFAULT 0,
            total_questions INTEGER,
            accepted_questions INTEGER NOT NULL DEFAULT 0,
            review_required_questions INTEGER NOT NULL DEFAULT 0,
            error_message TEXT,
            started_at TIMESTAMPTZ,
            completed_at TIMESTAMPTZ,
            created_by TEXT NOT NULL REFERENCES origin_users(id),
            metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          );

          CREATE INDEX IF NOT EXISTS idx_import_jobs_workspace
            ON import.document_import_jobs(workspace_id, status, created_at DESC);

          CREATE TABLE IF NOT EXISTS import.import_job_pages (
            id TEXT PRIMARY KEY,
            job_id TEXT NOT NULL REFERENCES import.document_import_jobs(id) ON DELETE CASCADE,
            page_number INTEGER NOT NULL,
            status import.import_page_status NOT NULL DEFAULT 'pending',
            extracted_text TEXT,
            extracted_images JSONB NOT NULL DEFAULT '[]'::jsonb,
            review_notes TEXT,
            metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            UNIQUE (job_id, page_number)
          );

          CREATE INDEX IF NOT EXISTS idx_import_pages_job_status
            ON import.import_job_pages(job_id, status, page_number);

          CREATE TABLE IF NOT EXISTS import.import_job_questions (
            id TEXT PRIMARY KEY,
            job_id TEXT NOT NULL REFERENCES import.document_import_jobs(id) ON DELETE CASCADE,
            page_id TEXT REFERENCES import.import_job_pages(id),
            question_number INTEGER,
            question_type TEXT,
            subject TEXT,
            chapter TEXT,
            concept TEXT,
            question_text TEXT,
            options JSONB,
            correct_option INTEGER,
            correct_options JSONB,
            answer_text TEXT,
            explanation TEXT,
            hint TEXT,
            has_diagram BOOLEAN NOT NULL DEFAULT false,
            diagram_description TEXT,
            status import.import_question_status NOT NULL DEFAULT 'draft',
            confidence_score NUMERIC(5,4),
            review_notes TEXT,
            rejection_reason TEXT,
            question_bag_question_id TEXT,
            metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          );

          CREATE INDEX IF NOT EXISTS idx_import_questions_job_status
            ON import.import_job_questions(job_id, status, question_number);
        `);

        await recordMigration(client);
        await client.query("COMMIT");
        globalThis.__originDocumentImportSchemaEnsured = true;
      } catch (error) {
        await client.query("ROLLBACK").catch(() => undefined);
        throw error;
      } finally {
        client.release();
      }
    })().catch((error) => {
      globalThis.__originDocumentImportSchemaPromise = undefined;
      throw error;
    });
  }
  await globalThis.__originDocumentImportSchemaPromise;
}
