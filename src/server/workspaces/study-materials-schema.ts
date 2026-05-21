/**
 * Idempotent runtime ensure for Phase 7 study materials schema.
 * Canonical SQL: src/db/migrations/20260521_phase7_study_materials.sql
 */

import type { PoolClient } from "pg";

import { getUserPostgresPool, isUserPostgresConfigured } from "@/server/user-postgres";

import { ensureEnrollmentSchema } from "./enrollment-schema";

declare global {
  var __originStudyMaterialsSchemaEnsured: boolean | undefined;
  var __originStudyMaterialsSchemaPromise: Promise<void> | undefined;
}

const MIGRATION_ID = "20260521_phase7_study_materials";

function pool() {
  const p = getUserPostgresPool();
  if (!p) throw new Error("USER_DATABASE_URL is not configured");
  return p;
}

async function recordMigration(client: PoolClient): Promise<void> {
  await client.query(
    "INSERT INTO app.migrations (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING",
    [MIGRATION_ID, "phase 7 study materials"],
  );
}

export async function ensureStudyMaterialsSchema(): Promise<void> {
  if (!isUserPostgresConfigured()) return;
  if (globalThis.__originStudyMaterialsSchemaEnsured) return;
  if (!globalThis.__originStudyMaterialsSchemaPromise) {
    globalThis.__originStudyMaterialsSchemaPromise = (async () => {
      await ensureEnrollmentSchema();
      const client = await pool().connect();
      try {
        await client.query("BEGIN");

        await client.query(`CREATE SCHEMA IF NOT EXISTS content;`);

        await client.query(`
          DO $$ BEGIN
            CREATE TYPE content.material_status AS ENUM ('draft', 'published', 'archived');
          EXCEPTION WHEN duplicate_object THEN NULL; END $$;

          DO $$ BEGIN
            CREATE TYPE content.material_type AS ENUM ('pdf', 'docx', 'image', 'video', 'link', 'other');
          EXCEPTION WHEN duplicate_object THEN NULL; END $$;

          DO $$ BEGIN
            CREATE TYPE content.assignment_target AS ENUM ('batch', 'student', 'workspace');
          EXCEPTION WHEN duplicate_object THEN NULL; END $$;
        `);

        await client.query(`
          CREATE TABLE IF NOT EXISTS content.study_materials (
            id TEXT PRIMARY KEY,
            workspace_id TEXT NOT NULL REFERENCES app.teacher_workspaces(id) ON DELETE CASCADE,
            title TEXT NOT NULL,
            description TEXT,
            material_type content.material_type NOT NULL DEFAULT 'pdf',
            subject TEXT,
            topic TEXT,
            class_level TEXT,
            status content.material_status NOT NULL DEFAULT 'draft',
            created_by TEXT NOT NULL REFERENCES origin_users(id),
            published_at TIMESTAMPTZ,
            archived_at TIMESTAMPTZ,
            metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          );

          CREATE INDEX IF NOT EXISTS idx_study_materials_workspace_status
            ON content.study_materials(workspace_id, status, created_at DESC);
          CREATE INDEX IF NOT EXISTS idx_study_materials_subject
            ON content.study_materials(workspace_id, subject, status);
        `);

        await client.query(`
          CREATE TABLE IF NOT EXISTS content.study_material_assets (
            id TEXT PRIMARY KEY,
            material_id TEXT NOT NULL REFERENCES content.study_materials(id) ON DELETE CASCADE,
            r2_object_key TEXT NOT NULL,
            r2_bucket TEXT NOT NULL,
            public_url TEXT NOT NULL,
            mime_type TEXT NOT NULL,
            size_bytes INTEGER NOT NULL CHECK (size_bytes > 0),
            sha256 TEXT NOT NULL,
            display_name TEXT,
            sort_order INTEGER NOT NULL DEFAULT 0,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          );

          CREATE INDEX IF NOT EXISTS idx_study_material_assets_material
            ON content.study_material_assets(material_id, sort_order);
        `);

        await client.query(`
          CREATE TABLE IF NOT EXISTS content.study_material_assignments (
            id TEXT PRIMARY KEY,
            material_id TEXT NOT NULL REFERENCES content.study_materials(id) ON DELETE CASCADE,
            workspace_id TEXT NOT NULL REFERENCES app.teacher_workspaces(id) ON DELETE CASCADE,
            target_type content.assignment_target NOT NULL,
            target_id TEXT NOT NULL,
            assigned_by TEXT REFERENCES origin_users(id),
            assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            revoked_at TIMESTAMPTZ,
            UNIQUE (material_id, target_type, target_id)
          );

          CREATE INDEX IF NOT EXISTS idx_study_material_assignments_material
            ON content.study_material_assignments(material_id, target_type, target_id);
          CREATE INDEX IF NOT EXISTS idx_study_material_assignments_target
            ON content.study_material_assignments(target_type, target_id, assigned_at DESC);
        `);

        await recordMigration(client);
        await client.query("COMMIT");
        globalThis.__originStudyMaterialsSchemaEnsured = true;
      } catch (error) {
        await client.query("ROLLBACK").catch(() => undefined);
        throw error;
      } finally {
        client.release();
      }
    })().catch((error) => {
      globalThis.__originStudyMaterialsSchemaPromise = undefined;
      throw error;
    });
  }
  await globalThis.__originStudyMaterialsSchemaPromise;
}
