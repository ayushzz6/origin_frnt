/**
 * Idempotent runtime ensure for the Phase 14 entitlements schema —
 * entitlements.subject_grants.
 *
 * Single source for non-Razorpay subject access (Flow-1 `teacher_code` grants +
 * `admin_comp` comps). getEntitledSubjects() resolves the UNION of these grants
 * and the Razorpay-backed subscriptions.user_subscriptions rows at read time.
 *
 * Canonical SQL: src/db/migrations/20260604_phase14_subject_grants.sql
 */

import type { PoolClient } from "pg";

import { getUserPostgresPool, isUserPostgresConfigured } from "@/server/user-postgres";
import { ensureEnrollmentSchema } from "@/server/workspaces/enrollment-schema";

declare global {
  var __originSubjectGrantsSchemaEnsured: boolean | undefined;
  var __originSubjectGrantsSchemaPromise: Promise<void> | undefined;
}

const MIGRATION_ID = "20260604_phase14_subject_grants";

function pool() {
  const p = getUserPostgresPool();
  if (!p) throw new Error("USER_DATABASE_URL is not configured");
  return p;
}

async function recordMigration(client: PoolClient): Promise<void> {
  await client.query(
    "INSERT INTO app.migrations (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING",
    [MIGRATION_ID, "phase 14 entitlements.subject_grants"],
  );
}

export async function ensureSubjectGrantsSchema(): Promise<void> {
  if (!isUserPostgresConfigured()) return;
  if (globalThis.__originSubjectGrantsSchemaEnsured) return;
  if (!globalThis.__originSubjectGrantsSchemaPromise) {
    globalThis.__originSubjectGrantsSchemaPromise = (async () => {
      // origin_users + app.teacher_workspaces + app.workspace_student_enrollments
      // must exist before the FKs below validate. Phase 3 ensure covers all three.
      await ensureEnrollmentSchema();
      const client = await pool().connect();
      try {
        await client.query("BEGIN");

        await client.query(`CREATE SCHEMA IF NOT EXISTS entitlements;`);

        await client.query(`
          DO $$ BEGIN
            CREATE TYPE entitlements.grant_status AS ENUM ('active', 'revoked', 'expired');
          EXCEPTION WHEN duplicate_object THEN NULL; END $$;
        `);

        await client.query(`
          CREATE TABLE IF NOT EXISTS entitlements.subject_grants (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL REFERENCES origin_users(id) ON DELETE CASCADE,
            subject TEXT NOT NULL CHECK (subject IN ('physics', 'chemistry', 'mathematics', 'biology')),
            source TEXT NOT NULL CHECK (source IN ('teacher_code', 'admin_comp')),
            workspace_id TEXT REFERENCES app.teacher_workspaces(id) ON DELETE SET NULL,
            enrollment_id TEXT REFERENCES app.workspace_student_enrollments(id) ON DELETE SET NULL,
            status entitlements.grant_status NOT NULL DEFAULT 'active',
            expires_at TIMESTAMPTZ,
            granted_by TEXT REFERENCES origin_users(id),
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          );

          CREATE UNIQUE INDEX IF NOT EXISTS uq_subject_grants_active_workspace
            ON entitlements.subject_grants(user_id, subject, workspace_id)
            WHERE status = 'active' AND workspace_id IS NOT NULL;

          CREATE UNIQUE INDEX IF NOT EXISTS uq_subject_grants_active_admin_comp
            ON entitlements.subject_grants(user_id, subject)
            WHERE status = 'active' AND source = 'admin_comp';

          CREATE INDEX IF NOT EXISTS idx_subject_grants_user_status
            ON entitlements.subject_grants(user_id, status);
          CREATE INDEX IF NOT EXISTS idx_subject_grants_entitlement
            ON entitlements.subject_grants(user_id, status, expires_at);
        `);

        await recordMigration(client);
        await client.query("COMMIT");
        globalThis.__originSubjectGrantsSchemaEnsured = true;
      } catch (error) {
        await client.query("ROLLBACK").catch(() => undefined);
        throw error;
      } finally {
        client.release();
      }
    })().catch((error) => {
      globalThis.__originSubjectGrantsSchemaPromise = undefined;
      throw error;
    });
  }
  await globalThis.__originSubjectGrantsSchemaPromise;
}
