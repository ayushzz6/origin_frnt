/**
 * Idempotent runtime ensure for the Phase 14 collaboration schema —
 * app.origin_collaborations.
 *
 * Kept separate from app.teacher_workspaces (see collaboration-store.ts) so a
 * partner's connection lifecycle / payout fields don't mix with the workspace's
 * operator-suspension `status` and KYC `verification_status`.
 *
 * Canonical SQL: src/db/migrations/20260604_phase14_collaborations.sql
 */

import type { PoolClient } from "pg";

import { getUserPostgresPool, isUserPostgresConfigured } from "@/server/user-postgres";
import { ensureWorkspaceSchema } from "@/server/workspaces/schema";

declare global {
  var __originCollaborationSchemaEnsured: boolean | undefined;
  var __originCollaborationSchemaPromise: Promise<void> | undefined;
}

const MIGRATION_ID = "20260604_phase14_collaborations";

function pool() {
  const p = getUserPostgresPool();
  if (!p) throw new Error("USER_DATABASE_URL is not configured");
  return p;
}

async function recordMigration(client: PoolClient): Promise<void> {
  await client.query(
    "INSERT INTO app.migrations (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING",
    [MIGRATION_ID, "phase 14 origin collaborations"],
  );
}

export async function ensureCollaborationSchema(): Promise<void> {
  if (!isUserPostgresConfigured()) return;
  if (globalThis.__originCollaborationSchemaEnsured) return;
  if (!globalThis.__originCollaborationSchemaPromise) {
    globalThis.__originCollaborationSchemaPromise = (async () => {
      // app.teacher_workspaces + origin_users must exist before the FKs validate.
      await ensureWorkspaceSchema();
      const client = await pool().connect();
      try {
        await client.query("BEGIN");

        await client.query(`
          CREATE TABLE IF NOT EXISTS app.origin_collaborations (
            id TEXT PRIMARY KEY,
            workspace_id TEXT NOT NULL UNIQUE REFERENCES app.teacher_workspaces(id) ON DELETE CASCADE,
            status TEXT NOT NULL DEFAULT 'pending'
              CHECK (status IN ('pending', 'active', 'paused', 'terminated', 'rejected')),
            commission_bps INTEGER NOT NULL DEFAULT 0
              CHECK (commission_bps >= 0 AND commission_bps <= 10000),
            razorpay_route_account_id TEXT,
            flow1_enabled BOOLEAN NOT NULL DEFAULT TRUE,
            flow2_enabled BOOLEAN NOT NULL DEFAULT TRUE,
            requested_by TEXT REFERENCES origin_users(id),
            approved_by TEXT REFERENCES origin_users(id),
            approved_at TIMESTAMPTZ,
            metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          );

          CREATE INDEX IF NOT EXISTS idx_origin_collaborations_status
            ON app.origin_collaborations(status, created_at DESC);
        `);

        await recordMigration(client);
        await client.query("COMMIT");
        globalThis.__originCollaborationSchemaEnsured = true;
      } catch (error) {
        await client.query("ROLLBACK").catch(() => undefined);
        throw error;
      } finally {
        client.release();
      }
    })().catch((error) => {
      globalThis.__originCollaborationSchemaPromise = undefined;
      throw error;
    });
  }
  await globalThis.__originCollaborationSchemaPromise;
}
