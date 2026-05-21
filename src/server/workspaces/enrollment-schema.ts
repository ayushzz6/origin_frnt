/**
 * Idempotent runtime ensure for Phase 3 enrollment + batches schema.
 * Canonical SQL: src/db/migrations/20260520_phase3_enrollment_batches.sql
 */

import type { PoolClient } from "pg";

import { getUserPostgresPool, isUserPostgresConfigured } from "@/server/user-postgres";

import { ensureWorkspaceSchema } from "./schema";

declare global {
  var __originEnrollmentSchemaEnsured: boolean | undefined;
  var __originEnrollmentSchemaPromise: Promise<void> | undefined;
}

const MIGRATION_ID = "20260520_phase3_enrollment_batches";

function pool() {
  const p = getUserPostgresPool();
  if (!p) throw new Error("USER_DATABASE_URL is not configured");
  return p;
}

async function recordMigration(client: PoolClient): Promise<void> {
  await client.query(
    "INSERT INTO app.migrations (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING",
    [MIGRATION_ID, "phase 3 enrollment + batches"],
  );
}

export async function ensureEnrollmentSchema(): Promise<void> {
  if (!isUserPostgresConfigured()) return;
  if (globalThis.__originEnrollmentSchemaEnsured) return;
  if (!globalThis.__originEnrollmentSchemaPromise) {
    globalThis.__originEnrollmentSchemaPromise = (async () => {
      await ensureWorkspaceSchema();
      const client = await pool().connect();
      try {
        await client.query("BEGIN");
        await client.query(`
          DO $$ BEGIN
            CREATE TYPE app.enrollment_source AS ENUM ('code', 'manual', 'admin_import', 'paid_app', 'migration');
          EXCEPTION WHEN duplicate_object THEN NULL; END $$;

          DO $$ BEGIN
            CREATE TYPE app.enrollment_status AS ENUM ('unassigned', 'active', 'suspended', 'left');
          EXCEPTION WHEN duplicate_object THEN NULL; END $$;

          DO $$ BEGIN
            CREATE TYPE app.batch_status AS ENUM ('draft', 'active', 'completed', 'archived');
          EXCEPTION WHEN duplicate_object THEN NULL; END $$;

          DO $$ BEGIN
            CREATE TYPE app.batch_member_status AS ENUM ('active', 'removed', 'completed');
          EXCEPTION WHEN duplicate_object THEN NULL; END $$;
        `);

        await client.query(`
          CREATE TABLE IF NOT EXISTS app.workspace_student_enrollments (
            id TEXT PRIMARY KEY,
            workspace_id TEXT NOT NULL REFERENCES app.teacher_workspaces(id) ON DELETE CASCADE,
            student_id TEXT NOT NULL REFERENCES origin_users(id) ON DELETE CASCADE,
            source app.enrollment_source NOT NULL,
            join_code_id TEXT REFERENCES app.workspace_codes(id),
            status app.enrollment_status NOT NULL DEFAULT 'unassigned',
            enrolled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            assigned_at TIMESTAMPTZ,
            suspended_at TIMESTAMPTZ,
            left_at TIMESTAMPTZ,
            notes TEXT,
            metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
            UNIQUE (workspace_id, student_id)
          );

          CREATE INDEX IF NOT EXISTS idx_workspace_enrollments_workspace_status
            ON app.workspace_student_enrollments(workspace_id, status, enrolled_at DESC);
          CREATE INDEX IF NOT EXISTS idx_workspace_enrollments_student
            ON app.workspace_student_enrollments(student_id, status);

          CREATE TABLE IF NOT EXISTS app.batches (
            id TEXT PRIMARY KEY,
            workspace_id TEXT NOT NULL REFERENCES app.teacher_workspaces(id) ON DELETE CASCADE,
            name TEXT NOT NULL,
            course TEXT,
            subject TEXT,
            class_level TEXT,
            schedule_text TEXT,
            starts_at TIMESTAMPTZ,
            ends_at TIMESTAMPTZ,
            capacity INTEGER,
            status app.batch_status NOT NULL DEFAULT 'active',
            settings JSONB NOT NULL DEFAULT '{}'::jsonb,
            created_by TEXT NOT NULL REFERENCES origin_users(id),
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          );

          CREATE INDEX IF NOT EXISTS idx_batches_workspace_status
            ON app.batches(workspace_id, status, created_at DESC);
          CREATE INDEX IF NOT EXISTS idx_batches_subject
            ON app.batches(workspace_id, subject, status);

          CREATE TABLE IF NOT EXISTS app.batch_members (
            batch_id TEXT NOT NULL REFERENCES app.batches(id) ON DELETE CASCADE,
            workspace_id TEXT NOT NULL REFERENCES app.teacher_workspaces(id) ON DELETE CASCADE,
            student_id TEXT NOT NULL REFERENCES origin_users(id) ON DELETE CASCADE,
            status app.batch_member_status NOT NULL DEFAULT 'active',
            assigned_by TEXT REFERENCES origin_users(id),
            assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            removed_at TIMESTAMPTZ,
            metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
            PRIMARY KEY (batch_id, student_id)
          );

          CREATE INDEX IF NOT EXISTS idx_batch_members_workspace_student
            ON app.batch_members(workspace_id, student_id, status);
          CREATE INDEX IF NOT EXISTS idx_batch_members_batch_status
            ON app.batch_members(batch_id, status, assigned_at DESC);

          CREATE TABLE IF NOT EXISTS app.batch_staff (
            batch_id TEXT NOT NULL REFERENCES app.batches(id) ON DELETE CASCADE,
            workspace_id TEXT NOT NULL REFERENCES app.teacher_workspaces(id) ON DELETE CASCADE,
            user_id TEXT NOT NULL REFERENCES origin_users(id) ON DELETE CASCADE,
            role app.workspace_member_role NOT NULL DEFAULT 'teacher',
            assigned_by TEXT REFERENCES origin_users(id),
            assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            PRIMARY KEY (batch_id, user_id)
          );

          CREATE INDEX IF NOT EXISTS idx_batch_staff_user
            ON app.batch_staff(user_id, workspace_id);

          CREATE TABLE IF NOT EXISTS app.workspace_offerings (
            id TEXT PRIMARY KEY,
            workspace_id TEXT NOT NULL REFERENCES app.teacher_workspaces(id) ON DELETE CASCADE,
            title TEXT NOT NULL,
            description TEXT,
            status TEXT NOT NULL DEFAULT 'draft',
            price_amount NUMERIC(10,2) NOT NULL,
            price_currency TEXT NOT NULL DEFAULT 'INR',
            duration_months INTEGER,
            batch_ids TEXT[] NOT NULL DEFAULT '{}',
            subject TEXT,
            class_level TEXT,
            max_enrollments INTEGER,
            current_enrollments INTEGER NOT NULL DEFAULT 0,
            metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          );

          CREATE INDEX IF NOT EXISTS idx_workspace_offerings_workspace_status
            ON app.workspace_offerings(workspace_id, status, created_at DESC);

          CREATE TABLE IF NOT EXISTS app.enrollment_orders (
            id TEXT PRIMARY KEY,
            workspace_id TEXT NOT NULL REFERENCES app.teacher_workspaces(id) ON DELETE CASCADE,
            offering_id TEXT NOT NULL REFERENCES app.workspace_offerings(id) ON DELETE CASCADE,
            student_id TEXT NOT NULL REFERENCES origin_users(id) ON DELETE CASCADE,
            status TEXT NOT NULL DEFAULT 'pending',
            payment_provider TEXT NOT NULL,
            payment_intent_id TEXT,
            payment_provider_order_id TEXT,
            amount NUMERIC(10,2) NOT NULL,
            currency TEXT NOT NULL DEFAULT 'INR',
            enrolled_batch_id TEXT REFERENCES app.batches(id),
            enrolled_at TIMESTAMPTZ,
            payment_completed_at TIMESTAMPTZ,
            refunded_at TIMESTAMPTZ,
            refund_reason TEXT,
            metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          );

          CREATE INDEX IF NOT EXISTS idx_enrollment_orders_workspace
            ON app.enrollment_orders(workspace_id, status, created_at DESC);
          CREATE INDEX IF NOT EXISTS idx_enrollment_orders_student
            ON app.enrollment_orders(student_id, status, created_at DESC);
          CREATE INDEX IF NOT EXISTS idx_enrollment_orders_offering
            ON app.enrollment_orders(offering_id, status);
        `);

        await recordMigration(client);
        await client.query("COMMIT");
        globalThis.__originEnrollmentSchemaEnsured = true;
      } catch (error) {
        await client.query("ROLLBACK").catch(() => undefined);
        throw error;
      } finally {
        client.release();
      }
    })().catch((error) => {
      globalThis.__originEnrollmentSchemaPromise = undefined;
      throw error;
    });
  }
  await globalThis.__originEnrollmentSchemaPromise;
}
