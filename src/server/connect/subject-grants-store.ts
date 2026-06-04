/**
 * Data store for entitlements.subject_grants (Phase 14).
 * Aligned to src/db/migrations/20260604_phase14_subject_grants.sql.
 *
 * Holds the non-Razorpay subject access: Flow-1 `teacher_code` grants and
 * `admin_comp` comps. The Razorpay-backed subject subscriptions live in
 * subscriptions.user_subscriptions; getEntitledSubjects() unions both.
 *
 * IMPORTANT: this module must NOT import @/server/entitlements — entitlements.ts
 * imports the read helpers here, so the dependency runs one way only (the
 * backfill+recompute orchestration lives in ./premium-backfill.ts).
 */

import type { Pool, PoolClient } from "pg";

import { getUserPostgresPool } from "@/server/user-postgres";
import { createSubjectGrantId } from "@/server/workspaces/ids";
import { ALL_SUBJECTS, type Subject } from "@/lib/entitlements";

import { ensureSubjectGrantsSchema } from "./subject-grants-schema";

export type GrantSource = "teacher_code" | "admin_comp";
export type GrantStatus = "active" | "revoked" | "expired";

export type SubjectGrant = {
  id: string;
  userId: string;
  subject: Subject;
  source: GrantSource;
  workspaceId: string | null;
  enrollmentId: string | null;
  status: GrantStatus;
  expiresAt: string | null;
  grantedBy: string | null;
  createdAt: string;
  updatedAt: string;
};

/** A subject + its expiry, as needed by the entitlement union resolver. */
export type ActiveGrantRow = {
  subject: Subject;
  expiresAt: string | null;
};

function pool(): Pool {
  const p = getUserPostgresPool();
  if (!p) throw new Error("USER_DATABASE_URL is not configured");
  return p;
}

function rowToGrant(row: Record<string, unknown>): SubjectGrant {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    subject: row.subject as Subject,
    source: row.source as GrantSource,
    workspaceId: (row.workspace_id as string | null) ?? null,
    enrollmentId: (row.enrollment_id as string | null) ?? null,
    status: row.status as GrantStatus,
    expiresAt: row.expires_at ? new Date(row.expires_at as string).toISOString() : null,
    grantedBy: (row.granted_by as string | null) ?? null,
    createdAt: new Date(row.created_at as string).toISOString(),
    updatedAt: new Date(row.updated_at as string).toISOString(),
  };
}

/**
 * The currently-active, non-lapsed grant rows for a user. A grant is live while
 * its status is `active` and it has not passed its `expires_at` (NULL = never).
 * Used by the entitlement union resolver (Promise.all alongside the subscriptions
 * query) — returns subject + expiry so the mirror recompute can take MAX(expiry).
 */
export async function getActiveSubjectGrantRows(userId: string): Promise<ActiveGrantRow[]> {
  await ensureSubjectGrantsSchema();
  const res = await pool().query(
    `SELECT subject, expires_at
       FROM entitlements.subject_grants
      WHERE user_id = $1
        AND status = 'active'
        AND (expires_at IS NULL OR expires_at > NOW())`,
    [userId],
  );
  return res.rows
    .filter((r) => (ALL_SUBJECTS as string[]).includes(r.subject as string))
    .map((r) => ({
      subject: r.subject as Subject,
      expiresAt: r.expires_at ? new Date(r.expires_at as string).toISOString() : null,
    }));
}

export async function listUserGrants(userId: string): Promise<SubjectGrant[]> {
  await ensureSubjectGrantsSchema();
  const res = await pool().query(
    `SELECT * FROM entitlements.subject_grants WHERE user_id = $1 ORDER BY created_at DESC`,
    [userId],
  );
  return res.rows.map(rowToGrant);
}

/** The active grant for this (user, subject, workspace) tuple, if any. */
export async function getActiveTeacherCodeGrant(
  userId: string,
  subject: Subject,
  workspaceId: string,
): Promise<SubjectGrant | null> {
  await ensureSubjectGrantsSchema();
  const res = await pool().query(
    `SELECT * FROM entitlements.subject_grants
      WHERE user_id = $1 AND subject = $2 AND workspace_id = $3 AND status = 'active'
      LIMIT 1`,
    [userId, subject, workspaceId],
  );
  return res.rows[0] ? rowToGrant(res.rows[0]) : null;
}

/**
 * The student's single active `teacher_code` grant for a workspace, if any.
 * Flow-1 lets a student pick exactly ONE Origin subject per institute, so this
 * gate stops a second pick from silently stacking another free subject.
 */
export async function getActiveWorkspaceTeacherCodeGrant(
  userId: string,
  workspaceId: string,
): Promise<SubjectGrant | null> {
  await ensureSubjectGrantsSchema();
  const res = await pool().query(
    `SELECT * FROM entitlements.subject_grants
      WHERE user_id = $1 AND workspace_id = $2 AND source = 'teacher_code' AND status = 'active'
      ORDER BY created_at ASC
      LIMIT 1`,
    [userId, workspaceId],
  );
  return res.rows[0] ? rowToGrant(res.rows[0]) : null;
}

export type InsertTeacherCodeGrantInput = {
  userId: string;
  subject: Subject;
  workspaceId: string;
  enrollmentId?: string | null;
  expiresAt?: string | null;
  grantedBy?: string | null;
  client?: PoolClient;
};

/**
 * Inserts an active `teacher_code` grant. Idempotent: if an active grant for the
 * (user, subject, workspace) tuple already exists, it is returned unchanged
 * (matching the uq_subject_grants_active_workspace partial-unique index).
 */
export async function insertTeacherCodeGrant(
  input: InsertTeacherCodeGrantInput,
): Promise<{ grant: SubjectGrant; created: boolean }> {
  await ensureSubjectGrantsSchema();
  const runner = input.client ?? pool();
  const existing = await getActiveTeacherCodeGrant(input.userId, input.subject, input.workspaceId);
  if (existing) return { grant: existing, created: false };

  const id = createSubjectGrantId();
  const res = await runner.query(
    `INSERT INTO entitlements.subject_grants
       (id, user_id, subject, source, workspace_id, enrollment_id, status, expires_at, granted_by)
     VALUES ($1, $2, $3, 'teacher_code', $4, $5, 'active', $6, $7)
     RETURNING *`,
    [
      id,
      input.userId,
      input.subject,
      input.workspaceId,
      input.enrollmentId ?? null,
      input.expiresAt ?? null,
      input.grantedBy ?? null,
    ],
  );
  return { grant: rowToGrant(res.rows[0]), created: true };
}

/**
 * Revokes the active `teacher_code` grant for a (user, subject, workspace) tuple.
 * Returns the revoked row or null when there was no active grant.
 */
export async function revokeTeacherCodeGrant(input: {
  userId: string;
  subject: Subject;
  workspaceId: string;
}): Promise<SubjectGrant | null> {
  await ensureSubjectGrantsSchema();
  const res = await pool().query(
    `UPDATE entitlements.subject_grants
        SET status = 'revoked', updated_at = NOW()
      WHERE user_id = $1 AND subject = $2 AND workspace_id = $3 AND status = 'active'
      RETURNING *`,
    [input.userId, input.subject, input.workspaceId],
  );
  return res.rows[0] ? rowToGrant(res.rows[0]) : null;
}

/**
 * Cutover backfill (idempotent): inserts active `admin_comp` grants for all four
 * subjects for every existing premium user. The NOT EXISTS guard makes re-runs a
 * no-op. Returns the number of grant rows inserted. The caller MUST recompute the
 * is_premium / premium_expiry mirror for affected users afterwards — see
 * ./premium-backfill.ts (runPremiumGrantBackfill).
 */
export async function backfillAdminCompGrants(): Promise<number> {
  await ensureSubjectGrantsSchema();
  const res = await pool().query(
    `INSERT INTO entitlements.subject_grants
       (id, user_id, subject, source, status, expires_at, created_at)
     SELECT 'grant_' || replace(gen_random_uuid()::text, '-', ''),
            u.id, s.subject, 'admin_comp', 'active', NULL, NOW()
     FROM origin_users u
     CROSS JOIN (VALUES ('physics'), ('chemistry'), ('mathematics'), ('biology')) AS s(subject)
     WHERE u.is_premium = TRUE
       AND NOT EXISTS (
         SELECT 1 FROM entitlements.subject_grants g
         WHERE g.user_id = u.id
           AND g.subject = s.subject
           AND g.source = 'admin_comp'
           AND g.status = 'active'
       )
     RETURNING id`,
  );
  return res.rowCount ?? 0;
}

/** All user ids currently flagged is_premium — recomputed after the backfill. */
export async function listPremiumUserIds(): Promise<string[]> {
  await ensureSubjectGrantsSchema();
  const res = await pool().query<{ id: string }>(
    `SELECT id FROM origin_users WHERE is_premium = TRUE`,
  );
  return res.rows.map((r) => r.id);
}
